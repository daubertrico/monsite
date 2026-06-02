// ================================================================
// Google Apps Script – La Voix Libre : Photos de concerts
//
// INSTALLATION (une seule fois) :
//   1. Ouvrez script.google.com avec lavoixlibrerennes@gmail.com
//   2. Nouveau projet → nommez-le "Photos La Voix Libre"
//   3. Collez tout ce fichier dans l'éditeur
//   4. Remplacez PHOTO_FOLDER_ID par l'ID de votre dossier Drive
//      (créez un dossier "Photos concerts" dans Drive, ouvrez-le,
//       copiez l'ID dans l'URL : drive.google.com/drive/folders/CECI)
//   5. Déployez : Déployer → Nouveau déploiement
//      - Type : Application Web
//      - Exécuter en tant que : Moi (lavoixlibrerennes@gmail.com)
//      - Accès : Tout le monde (même anonymes)
//   6. Copiez l'URL de déploiement → collez-la dans PHOTOS_ENDPOINT
//      dans espace-choristes.html et galerie.html
// ================================================================

const PHOTO_FOLDER_ID = '1eF6Y4o28rGj9yH-caIrRe_o6236v1wXU';

// ------- Point d'entrée POST (upload) -------

function doPost(e) {
  try {
    const params = e.parameter;
    const action = params.action;
    const data = params.data ? JSON.parse(params.data) : {};

    if (action === 'upload_photo') return uploadPhoto(data);
    if (action === 'delete_photo') return deletePhoto(data);
    if (action === 'approve_photo') return approvePhoto(data);

    return jsonOk({ error: 'Action inconnue : ' + action });
  } catch (err) {
    return jsonOk({ error: err.toString() });
  }
}

// Mot de passe admin (cohérent avec espace-choristes.html)
const ADMIN_PASSWORD = 'bureau';

// Normalisation pour comparaison de noms (sans accents/casse/espaces multiples)
function normName(s) {
  return (s || '').toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ------- Point d'entrée GET (lecture galerie) -------

function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || '';

    if (action === 'gallery_list') {
      const concert = (e.parameter && e.parameter.concert) || '';
      return getGalleryList(concert);
    }
    if (action === 'concerts_list') {
      return getConcertsList();
    }
    if (action === 'pending_list') {
      // Liste des photos en attente — réservée aux admins
      const pwd = (e.parameter && e.parameter.adminPassword) || '';
      if (pwd !== ADMIN_PASSWORD) return jsonOk({ error: 'Accès refusé' });
      return getPendingList();
    }

    return jsonOk({ error: 'Action inconnue : ' + action });
  } catch (err) {
    return jsonOk({ error: err.toString() });
  }
}

// ------- Upload d'une photo -------

function uploadPhoto(data) {
  const { base64, mimeType, filename, concert, uploaderName, description, eventId } = data;

  if (!base64 || !filename) return jsonOk({ error: 'Données manquantes (base64 / filename)' });

  // Vérification basique du type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes((mimeType || '').toLowerCase())) {
    return jsonOk({ error: 'Type de fichier non autorisé. Formats acceptés : JPG, PNG, WebP.' });
  }

  // Décodage et sauvegarde dans Drive
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, filename);
  const folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
  const file = folder.createFile(blob);

  // Accès public en lecture (pour les miniatures dans la galerie)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Enregistrement dans la feuille manifeste — toutes les nouvelles photos sont en attente
  const sheet = getOrCreateSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = [];
  headers.forEach(h => {
    switch (h) {
      case 'fileId':       row.push(file.getId()); break;
      case 'filename':     row.push(filename); break;
      case 'concert':      row.push((concert || 'Non précisé').trim()); break;
      case 'uploaderName': row.push((uploaderName || 'Anonyme').trim()); break;
      case 'uploadDate':   row.push(new Date().toISOString()); break;
      case 'description':  row.push((description || '').toString().trim().slice(0, 300)); break;
      case 'eventId':      row.push((eventId || '').toString().trim()); break;
      case 'status':       row.push('pending'); break;
      default:             row.push('');
    }
  });
  sheet.appendRow(row);

  return jsonOk({ success: true, fileId: file.getId(), status: 'pending' });
}

// ------- Validation d'une photo (admin uniquement) -------
function approvePhoto(data) {
  const { fileId, adminPassword } = data;
  if (!fileId) return jsonOk({ error: 'fileId manquant' });
  if ((adminPassword || '') !== ADMIN_PASSWORD) return jsonOk({ error: 'Accès refusé' });

  const sheet = getOrCreateSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOk({ error: 'Photo introuvable' });

  const headers = values[0];
  const fileCol   = headers.indexOf('fileId');
  const statusCol = headers.indexOf('status');
  if (fileCol < 0)   return jsonOk({ error: 'Colonne fileId absente' });
  if (statusCol < 0) return jsonOk({ error: 'Colonne status absente — feuille non migrée' });

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][fileCol]) === String(fileId)) {
      sheet.getRange(i + 1, statusCol + 1).setValue('approved');
      return jsonOk({ success: true });
    }
  }
  return jsonOk({ error: 'Photo introuvable dans la feuille' });
}

// ------- Liste des photos en attente (admin uniquement) -------
function getPendingList() {
  const sheet = getOrCreateSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOk({ photos: [] });

  const headers = values[0];
  const statusCol = headers.indexOf('status');

  let photos = values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[String(h)] = row[i]; });
    return obj;
  });

  // Pending = photos dont le status est explicitement "pending"
  // (les anciennes photos sans status sont implicitement "approved")
  photos = photos.filter(p => statusCol >= 0 && String(p.status || '').toLowerCase() === 'pending');

  // Vérifie que le fichier Drive est toujours là
  photos = photos.filter(p => {
    if (!p.fileId) return false;
    try {
      const f = DriveApp.getFileById(p.fileId);
      return f && !f.isTrashed();
    } catch (e) { return false; }
  });

  photos.reverse(); // plus récente en premier
  return jsonOk({ photos });
}

// ------- Suppression d'une photo -------
//   Autorisée si :
//     - le nom fourni correspond (insensible casse/accents) au uploaderName stocké, OU
//     - le mot de passe admin ('bureau') est fourni.

function deletePhoto(data) {
  const { fileId, uploaderName, adminPassword } = data;
  if (!fileId) return jsonOk({ error: 'fileId manquant' });

  const sheet = getOrCreateSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOk({ error: 'Photo introuvable' });

  const headers = values[0];
  const fileCol = headers.indexOf('fileId');
  const upCol   = headers.indexOf('uploaderName');
  if (fileCol < 0) return jsonOk({ error: 'Colonne fileId absente' });

  let targetRow = -1;
  let storedUploader = '';
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][fileCol]) === String(fileId)) {
      targetRow = i + 1; // 1-based row index for Sheet API
      storedUploader = upCol >= 0 ? String(values[i][upCol] || '') : '';
      break;
    }
  }
  if (targetRow < 0) return jsonOk({ error: 'Photo introuvable dans la feuille' });

  const isAdmin = (adminPassword || '') === ADMIN_PASSWORD;
  const isOwner = uploaderName && storedUploader
    && normName(uploaderName) === normName(storedUploader);

  if (!isAdmin && !isOwner) {
    return jsonOk({ error: "Suppression refusée : seul l'auteur de la photo peut la retirer." });
  }

  // Met le fichier Drive à la corbeille (réversible 30j)
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (e) {
    // fichier déjà absent — on continue pour nettoyer la ligne
  }

  // Supprime la ligne du manifeste
  sheet.deleteRow(targetRow);

  return jsonOk({ success: true });
}

// ------- Liste des photos (optionnellement filtrée par concert) -------

function getGalleryList(concertFilter) {
  const sheet = getOrCreateSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOk({ photos: [] });

  const headers = values[0];
  let photos = values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[String(h)] = row[i]; });
    return obj;
  });

  // Filtre modération : seules les photos approuvées sont publiques.
  // Les anciennes photos sans status explicite restent visibles (rétrocompat).
  photos = photos.filter(p => {
    const s = String(p.status || '').toLowerCase();
    return s === '' || s === 'approved';
  });

  if (concertFilter) {
    photos = photos.filter(p => p.concert === concertFilter);
  }

  // Ignore les photos dont le fichier Drive a été supprimé ou mis à la corbeille
  photos = photos.filter(p => {
    if (!p.fileId) return false;
    try {
      const f = DriveApp.getFileById(p.fileId);
      return f && !f.isTrashed();
    } catch (e) {
      return false;
    }
  });

  photos.reverse(); // plus récent en premier
  return jsonOk({ photos });
}

// ------- Liste des concerts (pour le filtre et le datalist) -------

function getConcertsList() {
  const sheet = getOrCreateSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOk({ concerts: [] });

  const concertCol = values[0].indexOf('concert');
  if (concertCol < 0) return jsonOk({ concerts: [] });

  const concerts = [...new Set(
    values.slice(1)
      .map(row => (row[concertCol] || '').toString().trim())
      .filter(Boolean)
  )].sort();

  return jsonOk({ concerts });
}

// ------- Feuille manifeste (création automatique si absente) -------

function getOrCreateSheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('PHOTOS_SHEET_ID');
  let ss;

  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      ssId = null; // spreadsheet supprimé, on en recrée un
    }
  }

  if (!ssId) {
    ss = SpreadsheetApp.create('Photos – La Voix Libre');
    ssId = ss.getId();
    props.setProperty('PHOTOS_SHEET_ID', ssId);
  }

  let sheet = ss.getSheetByName('Photos');
  if (!sheet) {
    sheet = ss.insertSheet('Photos');
    sheet.appendRow(['fileId', 'filename', 'concert', 'uploaderName', 'uploadDate', 'description', 'eventId', 'status']);
    sheet.setFrozenRows(1);
    // Largeurs de colonnes confortables
    sheet.setColumnWidth(1, 180); // fileId
    sheet.setColumnWidth(2, 240); // filename
    sheet.setColumnWidth(3, 220); // concert
    sheet.setColumnWidth(4, 140); // uploaderName
    sheet.setColumnWidth(5, 200); // uploadDate
    sheet.setColumnWidth(6, 320); // description
    sheet.setColumnWidth(7, 260); // eventId
  } else {
    // Migration : ajoute les colonnes manquantes aux feuilles déjà existantes
    let header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    ['description', 'eventId', 'status'].forEach(name => {
      if (header.indexOf(name) < 0) {
        const col = header.length + 1;
        sheet.getRange(1, col).setValue(name);
        const w = name === 'eventId' ? 260 : (name === 'status' ? 110 : 320);
        sheet.setColumnWidth(col, w);
        header.push(name);
      }
    });
  }

  return sheet;
}

// ------- Helper JSON -------

function jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
