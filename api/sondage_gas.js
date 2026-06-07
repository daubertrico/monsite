// === Sondage réinscription 2026-2027 ===
// Coller dans un nouveau projet Google Apps Script lié à un Google Sheet.
// Déployer comme "Application Web" : Exécuter en tant que Moi, Accessible par Tout le monde.

var ADMIN_PASS = 'chefdechoeur';
var SHEET_NAME = 'Sondage2026';

function doPost(e) {
  try {
    var action = (e.parameter.action || '').toLowerCase();
    if (action === 'sondage') return _saveSondage(e.parameter);
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

function _getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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

function _getSondageResults(adminPass) {
  if (adminPass !== ADMIN_PASS) return _json({ error: 'forbidden' });
  var data = _getSheet().getDataRange().getValues();
  if (data.length <= 1) return _json([]);
  var rows = data.slice(1).map(function(row) {
    return {
      prenom:          row[0],
      nom:             row[1],
      reinscription:   row[2] === 'Oui',
      lundi_20h_abe:   row[3] === 'Oui' ? true : row[3] === 'Non' ? false : null,
      jeudi_19h30_abe: row[4] === 'Oui' ? true : row[4] === 'Non' ? false : null,
      seul_lundi_19h30: row[5] === 'Oui',
      ts:              row[6]
    };
  });
  return _json(rows);
}
