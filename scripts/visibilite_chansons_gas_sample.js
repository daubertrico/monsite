/**
 * Google Apps Script – Web App : Visibilité des chansons (mode "chef de chœur")
 *
 * À quoi ça sert : quand vous cochez/décochez, dans l'espace choristes en mode
 * "chef de chœur", les cases "voix libre" / "soul" à côté d'une chanson, le
 * site envoie ce réglage ici pour qu'il soit conservé (et vu par tout le
 * monde ensuite) au lieu de disparaître au rechargement de la page.
 *
 * INSTALLATION
 * 1) Allez sur https://script.google.com/ > Nouveau projet.
 * 2) Supprimez le contenu par défaut et collez-y CE fichier en entier.
 * 3) Vérifiez ADMIN_PASS ci-dessous : il doit être identique à
 *    VISIBILITY_ADMIN_PASS dans assets/js/choristes.js (déjà le cas si vous
 *    n'avez rien changé).
 * 4) Déployer > Nouveau déploiement > Type : "Application Web".
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 5) Copiez l'URL /exec obtenue et collez-la dans assets/js/choristes.js à la
 *    place de VISIBILITY_ENDPOINT = ''.
 * 6) Un classeur Google Sheet nommé "Visibilité des chansons" sera créé tout
 *    seul au premier réglage coché (onglet "visibilite_chansons").
 *
 * Cases décochées par défaut : si une chanson n'a jamais été réglée ici, le
 * site utilise les valeurs par défaut de data/partitions.json (généralement :
 * visible pour tout le monde).
 */

const ADMIN_PASS = 'chefdechoeur'; // Doit correspondre à VISIBILITY_ADMIN_PASS côté site
const SHEET_NAME = 'visibilite_chansons';

function _getSheetId() {
  try {
    const prop = PropertiesService.getScriptProperties().getProperty('VISIBILITY_SHEET_ID');
    return (prop && prop.trim()) || '';
  } catch (e) {
    return '';
  }
}

function _spreadsheet() {
  let sid = _getSheetId();
  let ss;
  try {
    if (sid) ss = SpreadsheetApp.openById(sid);
  } catch (e) {
    ss = null;
  }
  if (!ss) {
    ss = SpreadsheetApp.create('Visibilité des chansons');
    sid = ss.getId();
    try { PropertiesService.getScriptProperties().setProperty('VISIBILITY_SHEET_ID', sid); } catch (e2) {}
  }
  return ss;
}

function _sheet() {
  const ss = _spreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['key', 'title', 'lv', 'soul']);
  }
  return sh;
}

function _jsonOk(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Lit tous les réglages enregistrés et les renvoie sous forme d'objet
// { [key]: { lv: bool, soul: bool } } indexé par clé de chanson normalisée.
function _readOverrides() {
  const sh = _sheet();
  const values = sh.getDataRange().getValues();
  values.shift(); // headers
  const overrides = {};
  values.forEach(r => {
    const key = r[0];
    if (!key) return;
    overrides[key] = { lv: !!r[2], soul: !!r[3] };
  });
  return overrides;
}

function _saveOverride(key, title, lv, soul) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = _sheet();
    const values = sh.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === key) { rowIndex = i + 1; break; }
    }
    const row = [key, title || '', !!lv, !!soul];
    if (rowIndex > 0) {
      sh.getRange(rowIndex, 1, 1, 4).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    let data = {};
    if (e.parameter && e.parameter.data) {
      data = JSON.parse(e.parameter.data);
    } else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents || '{}');
    }

    if ((data.adminPass || '') !== ADMIN_PASS) {
      return _jsonOk({ ok: false, error: 'unauthorized' });
    }
    if (!data.key) {
      return _jsonOk({ ok: false, error: 'missing_key' });
    }

    _saveOverride(data.key, data.title, data.lv, data.soul);
    return _jsonOk({ ok: true });
  } catch (err) {
    return _jsonOk({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  return _jsonOk({ ok: true, overrides: _readOverrides() });
}
