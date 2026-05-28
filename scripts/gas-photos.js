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

    return jsonOk({ error: 'Action inconnue : ' + action });
  } catch (err) {
    return jsonOk({ error: err.toString() });
  }
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

    return jsonOk({ error: 'Action inconnue : ' + action });
  } catch (err) {
    return jsonOk({ error: err.toString() });
  }
}

// ------- Upload d'une photo -------

function uploadPhoto(data) {
  const { base64, mimeType, filename, concert, uploaderName } = data;

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

  // Enregistrement dans la feuille manifeste
  const sheet = getOrCreateSheet();
  sheet.appendRow([
    file.getId(),
    filename,
    (concert || 'Non précisé').trim(),
    (uploaderName || 'Anonyme').trim(),
    new Date().toISOString()
  ]);

  return jsonOk({ success: true, fileId: file.getId() });
}

// ------- Liste des photos (optionnellement filtrée par concert) -------

function getGalleryList(concertFilter) {
  const sheet = getOrCreateSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOk({ photos: [] });

  const headers = values[0]; // ['fileId','filename','concert','uploaderName','uploadDate']
  let photos = values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[String(h)] = row[i]; });
    return obj;
  });

  if (concertFilter) {
    photos = photos.filter(p => p.concert === concertFilter);
  }

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
    sheet.appendRow(['fileId', 'filename', 'concert', 'uploaderName', 'uploadDate']);
    sheet.setFrozenRows(1);
    // Largeurs de colonnes confortables
    sheet.setColumnWidth(1, 180); // fileId
    sheet.setColumnWidth(2, 240); // filename
    sheet.setColumnWidth(3, 220); // concert
    sheet.setColumnWidth(4, 140); // uploaderName
    sheet.setColumnWidth(5, 200); // uploadDate
  }

  return sheet;
}

// ------- Helper JSON -------

function jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
