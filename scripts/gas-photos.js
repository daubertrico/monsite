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
    if (action === 'register_profile') return registerProfile(data);
    if (action === 'upload_profile_photo') return uploadProfilePhoto(data);
    if (action === 'delete_profile_photo') return deleteProfilePhoto(data);
    if (action === 'delete_profile') return deleteProfile(data);
    if (action === 'purge_choriste') return purgeChoriste(data);
    if (action === 'bulk_purge_choristes') return bulkPurgeChoristes(data);
    if (action === 'merge_choristes') return mergeChoristes(data);
    if (action === 'bulk_register_profiles') return bulkRegisterProfiles(data);

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
    if (action === 'trombinoscope_list') {
      // Retour immédiat — la sync est déclenchée explicitement via "sync_all" (bureau)
      return getTrombinoscope();
    }
    if (action === 'force_sync_photos') {
      const pwd = (e.parameter && e.parameter.adminPassword) || '';
      if (pwd !== ADMIN_PASSWORD) return jsonOk({ error: 'Accès refusé' });
      return syncFromPhotos(true);
    }
    if (action === 'sync_all') {
      // Lance les deux syncs en une seule requête, admin uniquement
      const pwd = (e.parameter && e.parameter.adminPassword) || '';
      if (pwd !== ADMIN_PASSWORD) return jsonOk({ error: 'Accès refusé' });
      let resPhotos = null, resAtt = null;
      try { resPhotos = JSON.parse(syncFromPhotos(true).getContent()); } catch (e2) { resPhotos = { error: e2.toString() }; }
      try { resAtt    = JSON.parse(syncFromAttendance(true).getContent()); } catch (e2) { resAtt    = { error: e2.toString() }; }
      return jsonOk({ success: true, photos: resPhotos, attendance: resAtt });
    }
    if (action === 'force_sync_attendance') {
      // Force la sync (admin uniquement)
      const pwd = (e.parameter && e.parameter.adminPassword) || '';
      if (pwd !== ADMIN_PASSWORD) return jsonOk({ error: 'Accès refusé' });
      return syncFromAttendance(true);
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

// ============================================================
// TROMBINOSCOPE — profils des choristes + photos optionnelles
// ============================================================

function getTrombinoSheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('PHOTOS_SHEET_ID');
  if (!ssId) {
    getOrCreateSheet(); // force la création du SS principal
    ssId = props.getProperty('PHOTOS_SHEET_ID');
  }
  const ss = SpreadsheetApp.openById(ssId);
  let sheet = ss.getSheetByName('Trombinoscope');
  if (!sheet) {
    sheet = ss.insertSheet('Trombinoscope');
    sheet.appendRow(['key', 'prenom', 'nom', 'pupitre', 'ensembles', 'photoFileId', 'joinedAt', 'updatedAt']);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 220);
    sheet.setColumnWidth(2, 120);
    sheet.setColumnWidth(3, 140);
    sheet.setColumnWidth(4, 100);
    sheet.setColumnWidth(5, 140);
    sheet.setColumnWidth(6, 200);
    sheet.setColumnWidth(7, 180);
    sheet.setColumnWidth(8, 180);
  }
  return sheet;
}

function makeProfileKey(prenom, nom) {
  return normName(prenom) + '|' + normName(nom);
}

function findProfileRow(sheet, key) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      return { row: i + 1, data: values[i] };
    }
  }
  return null;
}

// Upsert d'un profil choriste (sans toucher à la photo)
function registerProfile(data) {
  const { prenom, nom, pupitre, ensembles } = data;
  if (!prenom || !nom) return jsonOk({ error: 'Prénom/nom manquants' });

  const sheet = getTrombinoSheet();
  const key = makeProfileKey(prenom, nom);
  const existing = findProfileRow(sheet, key);
  const now = new Date().toISOString();
  const ensembleStr = (Array.isArray(ensembles) ? ensembles : (ensembles ? [ensembles] : [])).join(',');

  if (existing) {
    sheet.getRange(existing.row, 2).setValue((prenom || '').trim());
    sheet.getRange(existing.row, 3).setValue((nom || '').trim());
    sheet.getRange(existing.row, 4).setValue((pupitre || '').trim());
    sheet.getRange(existing.row, 5).setValue(ensembleStr);
    sheet.getRange(existing.row, 8).setValue(now);
  } else {
    sheet.appendRow([
      key,
      (prenom || '').trim(),
      (nom || '').trim(),
      (pupitre || '').trim(),
      ensembleStr,
      '',
      now,
      now
    ]);
  }
  return jsonOk({ success: true });
}

// Upload de la photo de profil — remplace la précédente si elle existe
function uploadProfilePhoto(data) {
  const { base64, mimeType, prenom, nom } = data;
  if (!prenom || !nom) return jsonOk({ error: 'Prénom/nom manquants' });
  if (!base64) return jsonOk({ error: 'Image manquante' });

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes((mimeType || '').toLowerCase())) {
    return jsonOk({ error: 'Type de fichier non autorisé' });
  }

  const sheet = getTrombinoSheet();
  const key = makeProfileKey(prenom, nom);
  let existing = findProfileRow(sheet, key);
  if (!existing) {
    // Crée une ligne si elle n'existe pas encore
    const now = new Date().toISOString();
    sheet.appendRow([key, prenom.trim(), nom.trim(), '', '', '', now, now]);
    existing = findProfileRow(sheet, key);
  }

  // Supprime l'ancienne photo si présente
  const prevId = String(existing.data[5] || '');
  if (prevId) {
    try { DriveApp.getFileById(prevId).setTrashed(true); } catch (e) {}
  }

  // Upload la nouvelle photo
  const bytes = Utilities.base64Decode(base64);
  const filename = 'trombi_' + key.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now() + '.jpg';
  const blob = Utilities.newBlob(bytes, mimeType, filename);
  const folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  sheet.getRange(existing.row, 6).setValue(file.getId());
  sheet.getRange(existing.row, 8).setValue(new Date().toISOString());

  return jsonOk({ success: true, fileId: file.getId() });
}

// Suppression de la photo de profil (par le propriétaire ou un admin)
function deleteProfilePhoto(data) {
  const { prenom, nom, adminPassword } = data;
  if (!prenom || !nom) return jsonOk({ error: 'Prénom/nom manquants' });

  const sheet = getTrombinoSheet();
  const key = makeProfileKey(prenom, nom);
  const existing = findProfileRow(sheet, key);
  if (!existing) return jsonOk({ error: 'Profil introuvable' });

  const isAdmin = (adminPassword || '') === ADMIN_PASSWORD;
  const sameOwner = normName(existing.data[1]) === normName(prenom)
                 && normName(existing.data[2]) === normName(nom);
  if (!isAdmin && !sameOwner) return jsonOk({ error: 'Suppression refusée' });

  const prevId = String(existing.data[5] || '');
  if (prevId) {
    try { DriveApp.getFileById(prevId).setTrashed(true); } catch (e) {}
  }
  sheet.getRange(existing.row, 6).setValue('');
  sheet.getRange(existing.row, 8).setValue(new Date().toISOString());
  return jsonOk({ success: true });
}

// Suppression totale d'un choriste : profil trombinoscope + toutes ses photos uploadées + toutes ses présences
function purgeChoriste(data) {
  const { prenom, nom, adminPassword } = data;
  if ((adminPassword || '') !== ADMIN_PASSWORD) return jsonOk({ error: 'Accès refusé' });
  if (!prenom || !nom) return jsonOk({ error: 'Prénom/nom manquants' });

  const normP   = normName(prenom);
  const normNom = normName(nom);
  const normFull = normName(prenom + ' ' + nom);
  let profile = 0, photos = 0, attendance = 0;

  // 1) Trombinoscope : supprime la ligne + photo de profil
  try {
    const tromb = getTrombinoSheet();
    const key = makeProfileKey(prenom, nom);
    const existing = findProfileRow(tromb, key);
    if (existing) {
      const photoId = String(existing.data[5] || '');
      if (photoId) {
        try { DriveApp.getFileById(photoId).setTrashed(true); } catch (e) {}
      }
      tromb.deleteRow(existing.row);
      profile = 1;
    }
  } catch (e) {}

  // 2) Photos uploadées : on parcourt la feuille Photos, on trash les fichiers Drive et on supprime les lignes
  try {
    const photoSheet = getOrCreateSheet();
    const values = photoSheet.getDataRange().getValues();
    if (values.length >= 2) {
      const headers = values[0];
      const fileCol = headers.indexOf('fileId');
      const upCol   = headers.indexOf('uploaderName');
      if (upCol >= 0) {
        for (let i = values.length - 1; i >= 1; i--) {
          const up = String(values[i][upCol] || '');
          if (normName(up) === normFull) {
            const fileId = fileCol >= 0 ? String(values[i][fileCol] || '') : '';
            if (fileId) {
              try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
            }
            photoSheet.deleteRow(i + 1);
            photos++;
          }
        }
      }
    }
  } catch (e) {}

  // 3) Présences : on parcourt toutes les feuilles de la spreadsheet attendance
  try {
    const attSheetId = PropertiesService.getScriptProperties().getProperty('ATTENDANCE_SHEET_ID') || DEFAULT_ATTENDANCE_SHEET_ID;
    if (attSheetId) {
      const attSs = SpreadsheetApp.openById(attSheetId);
      attSs.getSheets().forEach(s => {
        const values = s.getDataRange().getValues();
        if (values.length < 2) return;
        const headers = values[0].map(h => String(h).toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''));
        const findCol = (names) => {
          for (const name of names) { const i = headers.indexOf(name); if (i >= 0) return i; }
          return -1;
        };
        const pCol = findCol(['prenom', 'firstname', 'first_name']);
        const nCol = findCol(['nom', 'lastname', 'last_name', 'name']);
        if (pCol < 0 || nCol < 0) return;
        for (let i = values.length - 1; i >= 1; i--) {
          if (normName(values[i][pCol]) === normP && normName(values[i][nCol]) === normNom) {
            s.deleteRow(i + 1);
            attendance++;
          }
        }
      });
    }
  } catch (e) {}

  return jsonOk({ success: true, profile: profile, photos: photos, attendance: attendance });
}

// Fusion de deux profils : reclasse les photos uploadées et les présences du slave sous le nom du master,
// transfère la photo/pupitre du slave si master n'en a pas, puis supprime le slave du trombinoscope.
function mergeChoristes(data) {
  const { masterPrenom, masterNom, slavePrenom, slaveNom, adminPassword } = data;
  if ((adminPassword || '') !== ADMIN_PASSWORD) return jsonOk({ error: 'Accès refusé' });
  if (!masterPrenom || !masterNom || !slavePrenom || !slaveNom) return jsonOk({ error: 'Profils incomplets' });

  const tromb = getTrombinoSheet();
  const masterKey = makeProfileKey(masterPrenom, masterNom);
  const slaveKey  = makeProfileKey(slavePrenom, slaveNom);
  if (masterKey === slaveKey) return jsonOk({ error: 'Master et slave identiques' });

  const master = findProfileRow(tromb, masterKey);
  const slave  = findProfileRow(tromb, slaveKey);
  if (!master) return jsonOk({ error: 'Profil master introuvable' });
  if (!slave)  return jsonOk({ error: 'Profil slave introuvable' });

  // 1) Transfert du pupitre si master vide
  const masterPupitre = String(master.data[3] || '').trim();
  const slavePupitre  = String(slave.data[3]  || '').trim();
  if (!masterPupitre && slavePupitre) {
    tromb.getRange(master.row, 4).setValue(slavePupitre);
  }

  // 2) Transfert des ensembles si master vide ou différent
  const masterEns = String(master.data[4] || '').trim();
  const slaveEns  = String(slave.data[4]  || '').trim();
  if (!masterEns && slaveEns) {
    tromb.getRange(master.row, 5).setValue(slaveEns);
  } else if (masterEns && slaveEns && masterEns !== slaveEns) {
    // Union (pour ne pas perdre d'info)
    const merged = Array.from(new Set((masterEns + ',' + slaveEns).split(',').map(s => s.trim()).filter(Boolean))).join(',');
    tromb.getRange(master.row, 5).setValue(merged);
  }

  // 3) Photo de profil : master prioritaire, sinon prend celle du slave
  const masterPhoto = String(master.data[5] || '').trim();
  const slavePhoto  = String(slave.data[5]  || '').trim();
  if (!masterPhoto && slavePhoto) {
    tromb.getRange(master.row, 6).setValue(slavePhoto);
    // ne pas trash : photo réassignée au master
  } else if (slavePhoto && masterPhoto && slavePhoto !== masterPhoto) {
    // Master a déjà une photo, on jette celle du slave
    try { DriveApp.getFileById(slavePhoto).setTrashed(true); } catch (e) {}
  }

  // 4) Réattribue les photos uploadées du slave au master (uploaderName)
  const slaveFullName  = (slavePrenom + ' ' + slaveNom).trim();
  const masterFullName = (masterPrenom + ' ' + masterNom).trim();
  let photosReassigned = 0;
  try {
    const photoSheet = getOrCreateSheet();
    const photoValues = photoSheet.getDataRange().getValues();
    if (photoValues.length >= 2) {
      const headers = photoValues[0];
      const upCol = headers.indexOf('uploaderName');
      if (upCol >= 0) {
        for (let i = 1; i < photoValues.length; i++) {
          if (normName(photoValues[i][upCol]) === normName(slaveFullName)) {
            photoSheet.getRange(i + 1, upCol + 1).setValue(masterFullName);
            photosReassigned++;
          }
        }
      }
    }
  } catch (e) {}

  // 5) Réattribue les présences du slave au master
  let attendanceReassigned = 0;
  try {
    const attSheetId = PropertiesService.getScriptProperties().getProperty('ATTENDANCE_SHEET_ID') || DEFAULT_ATTENDANCE_SHEET_ID;
    if (attSheetId) {
      const attSs = SpreadsheetApp.openById(attSheetId);
      const slavePN  = normName(slavePrenom);
      const slaveNN  = normName(slaveNom);
      attSs.getSheets().forEach(s => {
        const values = s.getDataRange().getValues();
        if (values.length < 2) return;
        const headers = values[0].map(h => String(h).toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''));
        const findCol = (names) => { for (const n of names) { const i = headers.indexOf(n); if (i >= 0) return i; } return -1; };
        const pCol = findCol(['prenom', 'firstname', 'first_name']);
        const nCol = findCol(['nom', 'lastname', 'last_name', 'name']);
        if (pCol < 0 || nCol < 0) return;
        for (let i = 1; i < values.length; i++) {
          if (normName(values[i][pCol]) === slavePN && normName(values[i][nCol]) === slaveNN) {
            s.getRange(i + 1, pCol + 1).setValue(masterPrenom);
            s.getRange(i + 1, nCol + 1).setValue(masterNom);
            attendanceReassigned++;
          }
        }
      });
    }
  } catch (e) {}

  // 6) Supprime la ligne du slave (photo de profil déjà gérée plus haut)
  tromb.deleteRow(slave.row);

  return jsonOk({
    success: true,
    photosReassigned: photosReassigned,
    attendanceReassigned: attendanceReassigned
  });
}

// Purge en masse : prend une liste de profils, exécute purgeChoriste sur chacun, retourne le bilan agrégé
function bulkPurgeChoristes(data) {
  const { profiles, adminPassword } = data;
  if ((adminPassword || '') !== ADMIN_PASSWORD) return jsonOk({ error: 'Accès refusé' });
  if (!Array.isArray(profiles) || profiles.length === 0) return jsonOk({ error: 'Liste vide' });

  let totalProfile = 0, totalPhotos = 0, totalAttendance = 0, failed = 0;
  const details = [];
  profiles.forEach(p => {
    try {
      const r = JSON.parse(purgeChoriste({
        prenom: p.prenom, nom: p.nom, adminPassword: adminPassword
      }).getContent());
      if (r.error) { failed++; details.push({ name: p.prenom + ' ' + p.nom, error: r.error }); }
      else {
        totalProfile += (r.profile || 0);
        totalPhotos += (r.photos || 0);
        totalAttendance += (r.attendance || 0);
      }
    } catch (e) {
      failed++;
      details.push({ name: p.prenom + ' ' + p.nom, error: e.toString() });
    }
  });
  return jsonOk({
    success: true,
    count: profiles.length,
    profile: totalProfile,
    photos: totalPhotos,
    attendance: totalAttendance,
    failed: failed,
    details: details
  });
}

// Sync depuis les uploaders de photos : extrait les noms uniques de la feuille Photos
// et les ajoute au trombinoscope (sans toucher aux profils déjà existants).
function maybeSyncFromPhotos() {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('LAST_PHOTOS_SYNC') || 0);
  if (Date.now() - last < 10 * 60 * 1000) return null; // throttle 10 min
  return syncFromPhotos(false);
}

function syncFromPhotos(force) {
  const sheet = getOrCreateSheet(); // feuille "Photos"
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOk({ added: 0 });

  const headers = values[0];
  const upCol = headers.indexOf('uploaderName');
  if (upCol < 0) return jsonOk({ error: 'Colonne uploaderName absente' });

  const seen = new Set();
  const candidates = [];
  for (let i = 1; i < values.length; i++) {
    const fullName = String(values[i][upCol] || '').trim();
    if (!fullName) continue;
    if (fullName.toLowerCase() === 'anonyme') continue;
    // Sépare prénom / nom au premier espace
    const parts = fullName.split(/\s+/);
    if (parts.length < 2) continue;
    const prenom = parts[0];
    const nom = parts.slice(1).join(' ');
    const key = makeProfileKey(prenom, nom);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ prenom, nom, key });
  }

  const tromb = getTrombinoSheet();
  const now = new Date().toISOString();
  let added = 0;
  candidates.forEach(c => {
    const existing = findProfileRow(tromb, c.key);
    if (!existing) {
      // Pas de pupitre disponible depuis les photos — on laisse vide
      tromb.appendRow([c.key, c.prenom, c.nom, '', '', '', now, now]);
      added++;
    }
    // Si le profil existe déjà, on ne touche à rien (l'utilisateur peut avoir mis à jour pupitre/photo)
  });

  PropertiesService.getScriptProperties().setProperty('LAST_PHOTOS_SYNC', String(Date.now()));
  return jsonOk({ success: true, added: added, totalUniqueUploaders: candidates.length });
}

// Suppression complète d'un profil (admin uniquement) — supprime la photo + la ligne
function deleteProfile(data) {
  const { prenom, nom, adminPassword } = data;
  if ((adminPassword || '') !== ADMIN_PASSWORD) return jsonOk({ error: 'Accès refusé' });
  if (!prenom || !nom) return jsonOk({ error: 'Prénom/nom manquants' });

  const sheet = getTrombinoSheet();
  const key = makeProfileKey(prenom, nom);
  const existing = findProfileRow(sheet, key);
  if (!existing) return jsonOk({ error: 'Profil introuvable' });

  // Met la photo à la corbeille si présente
  const photoId = String(existing.data[5] || '');
  if (photoId) {
    try { DriveApp.getFileById(photoId).setTrashed(true); } catch (e) {}
  }
  sheet.deleteRow(existing.row);
  return jsonOk({ success: true });
}

// Sync auto depuis la feuille des présences : extrait les uniques (prénom, nom, pupitre)
// et les upsert dans Trombinoscope. Throttle : 1 fois par 10 minutes max.
function maybeSyncFromAttendance() {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('LAST_ATT_SYNC') || 0);
  if (Date.now() - last < 10 * 60 * 1000) return null; // < 10 min → skip
  return syncFromAttendance(false);
}

// ID de la Spreadsheet des présences (peut être surchargé via Properties du script)
const DEFAULT_ATTENDANCE_SHEET_ID = '1xUQwtyLf_cT-5xCR27uILIcp-VxEFaE99PpMbVJPQa4';

function syncFromAttendance(force) {
  const props = PropertiesService.getScriptProperties();
  const attSheetId = props.getProperty('ATTENDANCE_SHEET_ID') || DEFAULT_ATTENDANCE_SHEET_ID;
  if (!attSheetId) {
    return jsonOk({ error: 'ATTENDANCE_SHEET_ID non configuré' });
  }
  let attSs;
  try { attSs = SpreadsheetApp.openById(attSheetId); }
  catch (e) { return jsonOk({ error: 'Feuille attendance introuvable : ' + e.toString() }); }

  // Parcourt toutes les feuilles du spreadsheet (peut y avoir une feuille par calendrier)
  const sheets = attSs.getSheets();
  const seen = new Map(); // key -> { prenom, nom, pupitre, ensembles:Set }

  sheets.forEach(s => {
    const values = s.getDataRange().getValues();
    if (values.length < 2) return;
    const headers = values[0].map(h => String(h).toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    const findCol = (names) => {
      for (const name of names) {
        const i = headers.indexOf(name);
        if (i >= 0) return i;
      }
      return -1;
    };
    const pCol  = findCol(['prenom', 'firstname', 'first_name']);
    const nCol  = findCol(['nom', 'lastname', 'last_name', 'name']);
    const puCol = findCol(['pupitre', 'voice', 'voix']);
    const calCol = findCol(['calendar', 'calendrier', 'ensemble']);
    if (pCol < 0 || nCol < 0) return; // feuille non exploitable

    for (let i = 1; i < values.length; i++) {
      const prenom = String(values[i][pCol] || '').trim();
      const nom    = String(values[i][nCol] || '').trim();
      if (!prenom || !nom) continue;
      const pupitre = puCol >= 0 ? String(values[i][puCol] || '').trim() : '';
      const cal     = calCol >= 0 ? String(values[i][calCol] || '').toLowerCase().trim() : '';
      const key = makeProfileKey(prenom, nom);
      if (!seen.has(key)) {
        seen.set(key, { prenom, nom, pupitre, ensembles: new Set() });
      }
      const entry = seen.get(key);
      if (pupitre && !entry.pupitre) entry.pupitre = pupitre;
      if (cal) {
        if (cal.includes('soul')) entry.ensembles.add('soul');
        else entry.ensembles.add('chorale');
      } else {
        // Fallback : le nom de la feuille peut indiquer l'ensemble
        const sn = (s.getName() || '').toLowerCase();
        if (sn.includes('soul')) entry.ensembles.add('soul');
        else if (sn) entry.ensembles.add('chorale');
      }
    }
  });

  // Upsert dans Trombinoscope
  const tromb = getTrombinoSheet();
  const now = new Date().toISOString();
  let added = 0, updated = 0;
  seen.forEach((entry, key) => {
    const existing = findProfileRow(tromb, key);
    const ensStr = Array.from(entry.ensembles).join(',');
    if (existing) {
      // On ne modifie le pupitre que s'il était vide (pour ne pas écraser une saisie utilisateur)
      const currentPup = String(existing.data[3] || '').trim();
      if (!currentPup && entry.pupitre) {
        tromb.getRange(existing.row, 4).setValue(entry.pupitre);
      }
      const currentEns = String(existing.data[4] || '').trim();
      if (!currentEns && ensStr) {
        tromb.getRange(existing.row, 5).setValue(ensStr);
      }
      tromb.getRange(existing.row, 8).setValue(now);
      updated++;
    } else {
      tromb.appendRow([key, entry.prenom, entry.nom, entry.pupitre, ensStr, '', now, now]);
      added++;
    }
  });

  props.setProperty('LAST_ATT_SYNC', String(Date.now()));
  return jsonOk({ success: true, added: added, updated: updated, total: seen.size });
}

// Bulk-register : ajout en masse de plusieurs choristes (admin uniquement)
// Utile pour seed le trombinoscope rétrospectivement.
function bulkRegisterProfiles(data) {
  const { profiles, adminPassword } = data;
  if ((adminPassword || '') !== ADMIN_PASSWORD) return jsonOk({ error: 'Accès refusé' });
  if (!Array.isArray(profiles) || profiles.length === 0) return jsonOk({ error: 'Liste vide' });

  const sheet = getTrombinoSheet();
  const now = new Date().toISOString();
  let added = 0, updated = 0, skipped = 0;

  profiles.forEach(p => {
    const prenom  = (p.prenom || '').trim();
    const nom     = (p.nom || '').trim();
    const pupitre = (p.pupitre || '').trim();
    if (!prenom || !nom) { skipped++; return; }
    const ensembleStr = Array.isArray(p.ensembles) ? p.ensembles.join(',') : '';
    const key = makeProfileKey(prenom, nom);
    const existing = findProfileRow(sheet, key);
    if (existing) {
      sheet.getRange(existing.row, 2).setValue(prenom);
      sheet.getRange(existing.row, 3).setValue(nom);
      if (pupitre) sheet.getRange(existing.row, 4).setValue(pupitre);
      if (ensembleStr) sheet.getRange(existing.row, 5).setValue(ensembleStr);
      sheet.getRange(existing.row, 8).setValue(now);
      updated++;
    } else {
      sheet.appendRow([key, prenom, nom, pupitre, ensembleStr, '', now, now]);
      added++;
    }
  });

  return jsonOk({ success: true, added: added, updated: updated, skipped: skipped });
}

// Liste publique (pour les choristes connectés) du trombinoscope
function getTrombinoscope() {
  const sheet = getTrombinoSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOk({ choristes: [] });
  const headers = values[0];

  let choristes = values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[String(h)] = row[i]; });
    return {
      prenom: String(obj.prenom || ''),
      nom: String(obj.nom || ''),
      pupitre: String(obj.pupitre || ''),
      ensembles: String(obj.ensembles || '').split(',').map(s => s.trim()).filter(Boolean),
      photoFileId: String(obj.photoFileId || '')
    };
  }).filter(c => c.prenom && c.nom);

  return jsonOk({ choristes });
}

// ------- Helper JSON -------

function jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
