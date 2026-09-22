/**
 * Synchronise le dossier Google Drive "Matériel chansons" vers le repo du
 * site : télécharge les PDF/audio/partitions MusicXML/liens dans
 * materielchansons/<chanson>/... et régénère data/partitions.json en
 * conséquence.
 *
 * Structure attendue dans le dossier Drive partagé (FOLDER_ID) : trois
 * sous-dossiers "Archives", "La Voix Libre" et "Soul", chacun contenant un
 * sous-dossier par chanson. La visibilité d'une chanson (pour les choristes
 * La Voix Libre / SOUL) dépend uniquement du/des sous-dossier(s) dans
 * lesquel(s) elle se trouve ; "Archives" n'est jamais synchronisé (chansons
 * retirées de l'affichage). Une chanson présente à la fois dans "La Voix
 * Libre" et "Soul" est fusionnée et visible pour les deux.
 *
 * Lancé automatiquement par .github/workflows/sync-drive-materiel.yml (toutes
 * les 30 minutes) : rien à faire côté site, il suffit de déposer/déplacer/
 * supprimer un sous-dossier ou un fichier dans le dossier Drive partagé.
 *
 * Authentification : compte de service Google (lecture seule sur Drive),
 * fourni via la variable d'environnement GOOGLE_SERVICE_ACCOUNT_KEY (contenu
 * JSON complet de la clé). Voir la doc du dépôt pour la mise en place.
 */

import { GoogleAuth } from 'google-auth-library';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
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

// Catégories reconnues parmi les sous-dossiers directs du dossier Drive
// partagé. 'archives' n'a pas de champ de visibilité : ces chansons ne sont
// jamais synchronisées.
const CATEGORY_VISIBILITY = { lv: 'visible_lavoixlibre', soul: 'visible_soul' };

function extOf(name) {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function labelFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || name;
}

function normalizeCategoryName(name) {
  return (name || '')
    .toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

function categoryOf(folderName) {
  const n = normalizeCategoryName(folderName);
  if (n === 'archives' || n === 'archive') return 'archives';
  if (n === 'la voix libre' || n === 'lavoixlibre') return 'lv';
  if (n === 'soul') return 'soul';
  return null;
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

// Télécharge (si besoin) le contenu d'un sous-dossier "chanson" et retourne
// ses documents/recordings/musicxml/lien. Met à jour state/seenLocalPaths.
async function scanSongFolder(auth, folder, state, newState, seenLocalPaths) {
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

  return { songDirName, documents, recordings, musicxmlPath, interactiveLink };
}

async function main() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY manquant.');
  const credentials = JSON.parse(keyJson);
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });

  const topFolders = (await listChildren(auth, FOLDER_ID))
    .filter(f => f.mimeType === 'application/vnd.google-apps.folder');

  const categoryFolders = topFolders
    .map(f => ({ folder: f, category: categoryOf(f.name) }))
    .filter(f => f.category && f.category !== 'archives');

  if (categoryFolders.length === 0) {
    throw new Error(
      "Aucun sous-dossier 'La Voix Libre' ou 'Soul' trouvé dans le dossier Drive : " +
      "vérifie que le compte de service a bien accès en lecture au dossier " +
      "'Matériel chansons', et que les sous-dossiers sont nommés 'Archives', " +
      "'La Voix Libre' et 'Soul'."
    );
  }

  const state = await loadState();
  const newState = { files: {} };
  const seenLocalPaths = new Set();
  const songsByTitle = new Map();

  for (const { folder: categoryFolder, category } of categoryFolders) {
    const songFolders = (await listChildren(auth, categoryFolder.id))
      .filter(f => f.mimeType === 'application/vnd.google-apps.folder');

    for (const songFolder of songFolders) {
      const { documents, recordings, musicxmlPath, interactiveLink } =
        await scanSongFolder(auth, songFolder, state, newState, seenLocalPaths);

      let entry = songsByTitle.get(songFolder.name);
      if (!entry) {
        entry = {
          title: songFolder.name,
          documents: [],
          recordings: [],
          musicxml: null,
          interactive_link: null,
          visible_lavoixlibre: false,
          visible_soul: false
        };
        songsByTitle.set(songFolder.name, entry);
      }
      entry.documents.push(...documents);
      entry.recordings.push(...recordings);
      if (!entry.musicxml && musicxmlPath) entry.musicxml = musicxmlPath;
      if (!entry.interactive_link && interactiveLink) entry.interactive_link = interactiveLink;
      entry[CATEGORY_VISIBILITY[category]] = true;
    }
  }

  // Garde-fou : si aucune chanson n'a été trouvée (dossiers "La Voix Libre"/
  // "Soul" créés mais pas encore de sous-dossier chanson dedans, erreur
  // Drive transitoire, etc.), on n'efface rien du matériel déjà synchronisé.
  if (songsByTitle.size === 0 && Object.keys(state.files).length > 0) {
    throw new Error(
      "Aucune chanson trouvée dans 'La Voix Libre' ou 'Soul' alors que du " +
      "matériel était déjà synchronisé : par sécurité, rien n'a été modifié. " +
      "Vérifie que les sous-dossiers de chansons sont bien déplacés à " +
      "l'intérieur de 'La Voix Libre' / 'Soul' (pas seulement les dossiers " +
      "eux-mêmes)."
    );
  }

  // Supprime les fichiers locaux qui ne correspondent plus à rien sur Drive
  // (fichier renommé/supprimé/archivé côté Drive depuis la dernière synchro).
  for (const [fileId, entry] of Object.entries(state.files)) {
    if (!seenLocalPaths.has(entry.path) && !(fileId in newState.files)) {
      const abs = path.join(REPO_ROOT, entry.path);
      if (existsSync(abs)) {
        await rm(abs, { force: true });
        console.log('Supprimé (plus sur Drive) :', entry.path);
      }
    }
  }

  // Nettoie les dossiers de chansons vides restants (chanson supprimée/renommée/archivée).
  if (existsSync(MATERIEL_DIR)) {
    const currentSongDirs = new Set([...songsByTitle.keys()].map(sanitizeName));
    for (const entry of await readdir(MATERIEL_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && !currentSongDirs.has(entry.name)) {
        await rm(path.join(MATERIEL_DIR, entry.name), { recursive: true, force: true });
        console.log('Dossier chanson supprimé :', entry.name);
      }
    }
  }

  const songs = [...songsByTitle.values()];
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
