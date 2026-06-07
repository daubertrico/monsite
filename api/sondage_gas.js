// === Sondage réinscription 2026-2027 ===
// Coller dans un nouveau projet Google Apps Script lié à un Google Sheet.
// Déployer comme "Application Web" : Exécuter en tant que Moi, Accessible par Tout le monde.

var ADMIN_PASS = 'chefdechoeur';
var SHEET_NAME = 'Sondage2026';

function doPost(e) {
  try {
    var action = (e.parameter.action || '').toLowerCase();
    if (action === 'sondage') return _saveSondage(e.parameter);
    if (action === 'delete')  return _deleteSondage(e.parameter);
    return _json({ error: 'unknown_action' });
  } catch(err) {
    return _json({ error: err.toString() });
  }
}

function doGet(e) {
  try {
    var action = (e.parameter.action || '').toLowerCase();
    if (action === 'results') return _getSondageResults(e.parameter.adminPass || '');
    return _json({ error: 'unknown_action' });
  } catch(err) {
    return _json({ error: err.toString() });
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var ssId  = props.getProperty('SPREADSHEET_ID');
  if (ssId) {
    try { return SpreadsheetApp.openById(ssId); } catch(e) {}
  }
  var ss = SpreadsheetApp.create('Sondage Réinscription 2026');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function _getSheet() {
  var ss    = _getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Prénom', 'Nom', 'Réinscription', 'Lundi 20h (ABE)', 'Jeudi 19h30 (ABE)', 'Lundi 19h30 uniquement', 'Date']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _saveSondage(p) {
  var prenom = (p.prenom || '').trim();
  var nom    = (p.nom    || '').trim();
  if (!prenom || !nom || !p.reinscription) {
    return _json({ error: 'missing_fields' });
  }
  var reinscription = (p.reinscription === 'oui');
  _getSheet().appendRow([
    prenom,
    nom,
    reinscription ? 'Oui' : 'Non',
    reinscription ? (p.lundi_20h_abe    || '') : '',
    reinscription ? (p.jeudi_19h30_abe  || '') : '',
    reinscription ? (p.seul_lundi_19h30 || '') : '',
    new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
  ]);
  return _json({ ok: true });
}

function _deleteSondage(p) {
  if ((p.adminPass || '') !== ADMIN_PASS) return _json({ error: 'forbidden' });
  var rowIndex = parseInt(p.rowIndex || '0', 10);
  if (!rowIndex || rowIndex < 2) return _json({ error: 'invalid_row' });
  var sheet = _getSheet();
  if (rowIndex > sheet.getLastRow()) return _json({ error: 'not_found' });
  sheet.deleteRow(rowIndex);
  return _json({ ok: true });
}

function _getSondageResults(adminPass) {
  if (adminPass !== ADMIN_PASS) return _json({ error: 'forbidden' });
  var data = _getSheet().getDataRange().getValues();
  if (data.length <= 1) return _json([]);
  // Dédoublonnage : on garde la dernière réponse par personne (prenom+nom normalisé)
  var byPerson = {};
  data.slice(1).forEach(function(row, i) {
    var key = String(row[0]).trim().toLowerCase() + '|' + String(row[1]).trim().toLowerCase();
    byPerson[key] = { row: row, rowIndex: i + 2 };
  });
  var rows = Object.keys(byPerson).map(function(key) {
    var entry = byPerson[key];
    var row = entry.row;
    var r3 = String(row[3]).toLowerCase();
    var r4 = String(row[4]).toLowerCase();
    var r5 = String(row[5]).toLowerCase();
    return {
      _rowIndex:        entry.rowIndex,
      prenom:           row[0],
      nom:              row[1],
      reinscription:    row[2] === 'Oui',
      lundi_20h_abe:    r3 === 'oui' ? true : r3 === 'non' ? false : null,
      jeudi_19h30_abe:  r4 === 'oui' ? true : r4 === 'non' ? false : null,
      seul_lundi_19h30: r5 === 'oui',
      ts:               row[6]
    };
  });
  return _json(rows);
}
