/**
 * Synchronise le dossier Google Drive "Matériel chansons" vers le repo du
 * site : télécharge les PDF/audio/partitions MusicXML/liens dans
 * materielchansons/<chanson>/... et régénère data/partitions.json en
 * conséquence.
 *
 * Lancé automatiquement par .github/workflows/sync-drive-materiel.yml (toutes
 * les 30 minutes) : rien à faire côté site, il suffit de déposer/renommer/
 * supprimer un sous-dossier ou un fichier dans le dossier Drive partagé.
 *
 * Authentification : compte de service Google (lecture seule sur Drive),
 * fourni via la variable d'environnement GOOGLE_SERVICE_ACCOUNT_KEY (contenu
 * JSON complet de la clé). Voir la doc du dépôt pour la mise en place.
 */

import { GoogleAuth } from 'google-auth-library';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const FOLDER_ID = '1o7J27UGF0et8Xi4Qyu2af4aCIxHXQMAA';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MATERIEL_DIR = path.join(REPO_ROOT, 'materielchansons');
const MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'partitions.json');
const STATE_PATH = path.join(REPO_ROOT, 'data', 'materiel-sync-state.json');

const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'];
const DOC_EXT = ['pdf'];
const SCORE_EXT = ['xml', 'musicxml'];

function extOf(name) {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function labelFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || name;
}

// Caractères invalides sous Windows (le dépôt est aussi utilisé en local sur
// Windows) : \ / : * ? " < > |
function sanitizeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+$/, '').replace(/\.+$/, '') || 'sans-titre';
}

async function driveFetch(auth, url) {
  const client = await auth.getClient();
  const res = await client.request({ url, responseType: 'json' });
  return res.data;
}

async function driveDownload(auth, fileId, destPath) {
  const client = await auth.getClient();
  const res = await client.request({
    url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    responseType: 'stream'
  });
  await mkdir(path.dirname(destPath), { recursive: true });
  await pipeline(res.data, createWriteStream(destPath));
}

async function driveDownloadText(auth, fileId) {
  const client = await auth.getClient();
  const res = await client.request({
    url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    responseType: 'text'
  });
  return res.data;
}

async function listChildren(auth, folderId) {
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id,name,mimeType,modifiedTime,md5Checksum)',
      pageSize: '1000'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await driveFetch(auth, `https://www.googleapis.com/drive/v3/files?${params.toString()}`);
    files.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf8'));
  } catch {
    return { files: {} };
  }
}

async function main() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY manquant.');
  const credentials = JSON.parse(keyJson);
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });

  const subfolders = (await listChildren(auth, FOLDER_ID))
    .filter(f => f.mimeType === 'application/vnd.google-apps.folder');

  if (subfolders.length === 0) {
    throw new Error(
      "Le dossier Drive est accessible mais ne contient aucun sous-dossier : " +
      "vérifie que le compte de service a bien accès en lecture au dossier " +
      "'Matériel chansons' (partage > ajouter son email)."
    );
  }

  const state = await loadState();
  const newState = { files: {} };
  const seenLocalPaths = new Set();
  const songs = [];

  for (const folder of subfolders) {
    const songDirName = sanitizeName(folder.name);
    const songDir = path.join(MATERIEL_DIR, songDirName);
    const children = await listChildren(auth, folder.id);

    const documents = [];
    const recordings = [];
    let musicxmlPath = null;
    let interactiveLink = null;

    for (const file of children) {
      if (file.mimeType === 'application/vnd.google-apps.folder') continue;
      const ext = extOf(file.name);
      const isDoc = DOC_EXT.includes(ext);
      const isAudio = AUDIO_EXT.includes(ext);
      const isScore = SCORE_EXT.includes(ext) && !musicxmlPath;
      const isLink = ext === 'txt' && !interactiveLink;
      if (!isDoc && !isAudio && !isScore && !isLink) continue;

      if (isLink) {
        const content = (await driveDownloadText(auth, file.id)).trim().split('\n')[0].trim();
        if (/^https?:\/\//i.test(content)) interactiveLink = content;
        continue;
      }

      const localFileName = sanitizeName(file.name);
      const localPath = path.join(songDir, localFileName);
      const relPath = path.relative(REPO_ROOT, localPath).split(path.sep).join('/');
      seenLocalPaths.add(relPath);

      const changeKey = file.md5Checksum || file.modifiedTime;
      const prev = state.files[file.id];
      const needsDownload = !prev || prev.key !== changeKey || !existsSync(localPath);
      if (needsDownload) {
        await driveDownload(auth, file.id, localPath);
        console.log('Téléchargé :', relPath);
      }
      newState.files[file.id] = { key: changeKey, path: relPath };

      if (isDoc) documents.push({ label: labelFromFilename(file.name), file: relPath });
      else if (isAudio) recordings.push({ label: labelFromFilename(file.name), file: relPath });
      else if (isScore) musicxmlPath = relPath;
    }

    songs.push({
      title: folder.name,
      documents,
      recordings,
      musicxml: musicxmlPath,
      interactive_link: interactiveLink
    });
  }

  // Supprime les fichiers locaux qui ne correspondent plus à rien sur Drive
  // (fichier renommé/supprimé côté Drive depuis la dernière synchro).
  for (const [fileId, entry] of Object.entries(state.files)) {
    if (!seenLocalPaths.has(entry.path) && !(fileId in newState.files)) {
      const abs = path.join(REPO_ROOT, entry.path);
      if (existsSync(abs)) {
        await rm(abs, { force: true });
        console.log('Supprimé (plus sur Drive) :', entry.path);
      }
    }
  }

  // Nettoie les dossiers de chansons vides restants (chanson supprimée/renommée).
  if (existsSync(MATERIEL_DIR)) {
    const { readdir } = await import('node:fs/promises');
    const currentSongDirs = new Set(subfolders.map(f => sanitizeName(f.name)));
    for (const entry of await readdir(MATERIEL_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && !currentSongDirs.has(entry.name)) {
        await rm(path.join(MATERIEL_DIR, entry.name), { recursive: true, force: true });
        console.log('Dossier chanson supprimé :', entry.name);
      }
    }
  }

  songs.sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(songs, null, 2) + '\n', 'utf8');
  await writeFile(STATE_PATH, JSON.stringify(newState, null, 2) + '\n', 'utf8');

  console.log(`OK : ${songs.length} chanson(s) synchronisée(s).`);
}

main().catch(err => {
  console.error('Échec de la synchronisation :', err);
  process.exit(1);
});
