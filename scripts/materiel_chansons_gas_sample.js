/**
 * Google Apps Script – Web App : Matériel des chansons
 *
 * Source UNIQUE des chansons affichées dans l'onglet "Chansons" de l'espace
 * choristes : un dossier Google Drive partagé — un sous-dossier = une
 * chanson — que ce script scanne. Aucun fichier dans le repo du site n'a
 * besoin d'être modifié pour ajouter, renommer ou retirer une chanson :
 * déposer/renommer/supprimer un sous-dossier dans Drive suffit.
 *
 * STRUCTURE ATTENDUE DANS LE DRIVE
 *   📁 Matériel chansons (dossier partagé, éditeur pour le bureau)
 *     📁 Wade                              <- le nom du dossier = le titre affiché
 *        Wade tutti.mp3                    <- audio -> "Écoute"
 *        Wade paroles.pdf                  <- pdf   -> "Paroles / partitions"
 *        Wade.musicxml                     <- xml   -> partition lue directement sur le site
 *        lien.txt                          <- 1 ligne = une URL -> bouton "Partition en ligne"
 *     📁 Onissa
 *        ...
 *     ... un sous-dossier par chanson ...
 *
 * - Fichiers .pdf -> "Paroles / partitions".
 * - Fichiers .mp3/.wav/.m4a/.ogg/.aac/.flac -> "Écoute".
 * - Fichier .xml ou .musicxml -> lu et affiché directement sur le site avec une
 *   visionneuse de partition intégrée (le contenu du fichier est renvoyé tel
 *   quel dans la réponse JSON ; s'il y en a plusieurs, seul le premier trouvé
 *   est utilisé).
 * - Fichier .txt (ex: lien.txt) dont la première ligne est une URL -> bouton
 *   "Partition en ligne" (pratique pour un lien flat.io).
 * - Le nom du fichier (sans l'extension) devient le libellé affiché sur le
 *   site pour les PDF/audio — pense à nommer les fichiers clairement (ex:
 *   "Sopranes.mp3" plutôt que "enregistrement (12).mp3").
 *
 * INSTALLATION
 * 1) Sur https://drive.google.com, connecté avec le compte qui possède le
 *    dossier "Matériel chansons" (compte Google personnel du créateur du
 *    dossier).
 * 2) Partage ce dossier avec les membres du bureau concernés en droit "Éditeur".
 * 3) Va sur https://script.google.com/ (connecté avec CE MÊME compte) > Nouveau projet.
 * 4) Supprime le contenu par défaut et colle-y CE fichier en entier.
 * 5) Remplace la valeur de FOLDER_ID ci-dessous par l'ID du dossier (visible
 *    dans son URL : https://drive.google.com/drive/folders/ICI_EST_L_ID).
 * 6) Déployer > Nouveau déploiement > Type : "Application Web".
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 7) Copie l'URL /exec obtenue et colle-la dans assets/js/choristes.js à la
 *    place de MATERIEL_ENDPOINT.
 *
 * IMPORTANT : le script doit être déployé avec le MÊME compte Google que
 * celui qui possède (ou a un accès complet à) le dossier Drive. Sinon
 * DriveApp.getFolderById() peut réussir tout en ne voyant aucun sous-dossier
 * (accès partiel), et le site affichera silencieusement 0 chanson — ce script
 * renvoie maintenant `ok:false` avec un message d'erreur explicite dans ce cas
 * plutôt que de se taire, pour rendre ce genre de souci visible immédiatement
 * (regarde la réponse de l'URL /exec directement dans un navigateur pour
 * diagnostiquer).
 *
 * Le matériel se met à jour automatiquement (cache de 5 minutes) ; un lien
 * "Actualiser le matériel" sur le site permet de forcer la mise à jour
 * immédiate juste après avoir ajouté un fichier.
 */

const FOLDER_ID = '1o7J27UGF0et8Xi4Qyu2af4aCIxHXQMAA';
const CACHE_KEY = 'materiel_chansons_v2';
const CACHE_TTL_SECONDS = 300; // 5 minutes

const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'];
const DOC_EXT = ['pdf'];
const SCORE_EXT = ['xml', 'musicxml'];

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
  if (!FOLDER_ID || FOLDER_ID.indexOf('COLLEZ_ICI') === 0) {
    throw new Error("FOLDER_ID n'est pas configuré dans le script.");
  }
  const root = DriveApp.getFolderById(FOLDER_ID); // lève une erreur claire si inaccessible

  const songs = [];
  let sawAnySubfolder = false;
  const folders = root.getFolders();
  while (folders.hasNext()) {
    sawAnySubfolder = true;
    const folder = folders.next();
    const documents = [];
    const recordings = [];
    let musicxml = null;
    let interactiveLink = null;
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      const ext = _extOf(name);
      if (DOC_EXT.indexOf(ext) !== -1) {
        documents.push({ label: _labelFromFilename(name), file: _docUrl(file) });
      } else if (AUDIO_EXT.indexOf(ext) !== -1) {
        recordings.push({ label: _labelFromFilename(name), file: _audioUrl(file) });
      } else if (SCORE_EXT.indexOf(ext) !== -1 && !musicxml) {
        musicxml = file.getBlob().getDataAsString('UTF-8');
      } else if (ext === 'txt' && !interactiveLink) {
        const content = file.getBlob().getDataAsString('UTF-8').trim().split('\n')[0].trim();
        if (/^https?:\/\//i.test(content)) interactiveLink = content;
      }
    }
    songs.push({
      title: folder.getName(),
      documents: documents,
      recordings: recordings,
      musicxml: musicxml,
      interactive_link: interactiveLink
    });
  }

  if (!sawAnySubfolder) {
    // Le dossier racine est accessible mais vide de notre point de vue : très
    // probablement un souci de partage (voir note d'installation ci-dessus)
    // plutôt qu'un vrai dossier vide.
    throw new Error(
      "Le dossier Drive (FOLDER_ID) est accessible mais ne contient aucun " +
      "sous-dossier visible pour le compte qui exécute ce script. Vérifie " +
      "que ce script est déployé avec le même compte Google que celui qui " +
      "possède le dossier."
    );
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
  try {
    const songs = _scanFolder();
    try { cache.put(CACHE_KEY, JSON.stringify(songs), CACHE_TTL_SECONDS); } catch (e2) {}
    return _jsonOk({ ok: true, songs: songs });
  } catch (err) {
    return _jsonOk({ ok: false, error: String(err && err.message || err), songs: [] });
  }
}
