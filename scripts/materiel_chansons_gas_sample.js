/**
 * Google Apps Script – Web App : Matériel des chansons (paroles PDF, enregistrements)
 *
 * À quoi ça sert : le bureau dépose des fichiers dans un dossier Google Drive
 * partagé — un sous-dossier = une chanson — et ce script les scanne pour que
 * le site les affiche automatiquement dans l'onglet "Chansons" de l'espace
 * choristes. Ni toi ni le bureau n'avez besoin de toucher au code ou à
 * data/partitions.json : créer un nouveau sous-dossier suffit à faire
 * apparaître une nouvelle chanson.
 *
 * STRUCTURE ATTENDUE DANS LE DRIVE
 *   📁 Matériel chansons (dossier partagé, éditeur pour le bureau)
 *     📁 Wade
 *        Wade tutti.mp3
 *        Wade paroles.pdf
 *     📁 Onissa
 *        Canto de candomble 1.pdf
 *        Voix principale et tutti.m4a
 *     ... un sous-dossier par chanson ...
 *
 * Le nom du sous-dossier devient le titre de la chanson (doit correspondre,
 * sans se soucier des accents/majuscules, au titre existant dans
 * data/partitions.json pour compléter une chanson déjà là ; sinon la chanson
 * apparaît comme nouvelle entrée). Les fichiers .pdf sont classés en
 * "Paroles / partitions", les .mp3/.wav/.m4a/.ogg/.aac/.flac en "Écoute".
 * Le nom du fichier (sans l'extension) devient le libellé affiché sur le site
 * — pense à nommer les fichiers clairement (ex: "Sopranes.mp3" plutôt que
 * "enregistrement (12).mp3").
 *
 * INSTALLATION
 * 1) Sur https://drive.google.com, crée un dossier "Matériel chansons".
 * 2) Partage-le avec les membres du bureau concernés en droit "Éditeur".
 * 3) Partage-le aussi en "Lecteur" pour "Toute personne disposant du lien"
 *    (nécessaire pour que le site puisse afficher/lire les fichiers dans le
 *    navigateur des choristes — clic droit sur le dossier > Partager > Accès
 *    général > "Toute personne disposant du lien" > Lecteur).
 * 4) Ouvre le dossier, copie son ID dans l'URL, ex :
 *    https://drive.google.com/drive/folders/ICI_EST_L_ID
 * 5) Va sur https://script.google.com/ > Nouveau projet.
 * 6) Supprime le contenu par défaut et colle-y CE fichier en entier.
 * 7) Remplace la valeur de FOLDER_ID ci-dessous par l'ID copié à l'étape 4.
 * 8) Déployer > Nouveau déploiement > Type : "Application Web".
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 9) Copie l'URL /exec obtenue et colle-la dans assets/js/choristes.js à la
 *    place de MATERIEL_ENDPOINT = ''.
 *
 * Une fois en place, le matériel se met à jour automatiquement (cache de 5
 * minutes) ; un lien "Actualiser le matériel" sur le site permet de forcer la
 * mise à jour immédiate juste après avoir ajouté un fichier.
 */

const FOLDER_ID = 'COLLEZ_ICI_ID_DU_DOSSIER_DRIVE';
const CACHE_KEY = 'materiel_chansons_v1';
const CACHE_TTL_SECONDS = 300; // 5 minutes

const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'];
const DOC_EXT = ['pdf'];

function _extOf(name) {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function _labelFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || name;
}

// Lien de lecture directe (utilisable dans une balise <audio src="...">).
function _audioUrl(file) {
  return 'https://drive.google.com/uc?export=download&id=' + file.getId();
}

// Lien d'ouverture dans la visionneuse Drive (mieux pour un PDF cliqué dans un
// nouvel onglet que le lien de téléchargement direct).
function _docUrl(file) {
  return 'https://drive.google.com/file/d/' + file.getId() + '/view';
}

function _scanFolder() {
  if (!FOLDER_ID || FOLDER_ID.indexOf('COLLEZ_ICI') === 0) return [];
  let root;
  try {
    root = DriveApp.getFolderById(FOLDER_ID);
  } catch (e) {
    return [];
  }
  const songs = [];
  const folders = root.getFolders();
  while (folders.hasNext()) {
    const folder = folders.next();
    const documents = [];
    const recordings = [];
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      const ext = _extOf(name);
      if (DOC_EXT.indexOf(ext) !== -1) {
        documents.push({ label: _labelFromFilename(name), file: _docUrl(file) });
      } else if (AUDIO_EXT.indexOf(ext) !== -1) {
        recordings.push({ label: _labelFromFilename(name), file: _audioUrl(file) });
      }
    }
    songs.push({ title: folder.getName(), documents: documents, recordings: recordings });
  }
  return songs;
}

function _jsonOk(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const forceRefresh = !!(e && e.parameter && e.parameter.refresh === '1');
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const cached = cache.get(CACHE_KEY);
    if (cached) return _jsonOk({ ok: true, songs: JSON.parse(cached) });
  }
  const songs = _scanFolder();
  try { cache.put(CACHE_KEY, JSON.stringify(songs), CACHE_TTL_SECONDS); } catch (e2) {}
  return _jsonOk({ ok: true, songs: songs });
}
