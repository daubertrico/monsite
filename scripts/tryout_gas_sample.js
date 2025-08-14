/**
 * Google Apps Script – Web App pour \"Séances d'essai\" (indépendant des présences)
 *
 * 1) Créez un Google Sheet : \"séance d'essai\" avec un onglet \"inscriptions\".
 *    En-têtes en ligne 1 : timestamp, prenom, nom, email, telephone, date, pupitre, message, ts
 * 2) Collez ce script dans un projet Apps Script (lié au Sheet ou autonome).
 * 3) Remplacez les constantes SHEET_ID et ADMIN_PASS.
 * 4) Déployez en Web App : Exécuter en \"Moi\", Accès \"Anyone with link\".
 * 5) Récupérez l'URL du déploiement et mettez-la dans TRYOUT_ENDPOINT côté site.
 */

// Vous pouvez définir l'ID de la feuille ici OU via Script Properties (clé: TRYOUT_SHEET_ID)
const SHEET_ID = '1XdLI0vjHHTWfJ-cfQySQfMAHX3igGK_GZb00tU7Mbqo';
function _getSheetId(){
  try {
    const prop = PropertiesService.getScriptProperties().getProperty('TRYOUT_SHEET_ID');
    return (prop && prop.trim()) || SHEET_ID;
  } catch(e){
    return SHEET_ID;
  }
}
const SHEET_NAME = 'inscriptions';
const ADMIN_PASS = 'chefdechoeur'; // Doit correspondre côté site

function _sheet() {
  let sid = _getSheetId();
  let ss;
  try {
    if (sid && sid.length > 0) {
      ss = SpreadsheetApp.openById(sid);
    }
  } catch (e) {
    ss = null;
  }
  if (!ss) {
    // Fallback: crée un nouveau classeur si l'ID fourni est invalide (ex: lien "pub?output=csv")
    ss = SpreadsheetApp.create('Essais – Inscriptions');
    sid = ss.getId();
    try { PropertiesService.getScriptProperties().setProperty('TRYOUT_SHEET_ID', sid); } catch (e2) {}
  }
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  // Prépare les en-têtes si la feuille est vide
  if (sh.getLastRow() === 0) {
    sh.appendRow(['timestamp','prenom','nom','email','telephone','date','pupitre','message','ts']);
  }
  return sh;
}

function _jsonOk(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const ct = (e.postData && e.postData.type) || '';
    let data = {};
    if (ct === 'application/x-www-form-urlencoded') {
      const params = e.parameter || {};
      if (params.data) data = JSON.parse(params.data);
    } else {
      // application/json ou autre
      data = JSON.parse(e.postData.contents || '{}');
    }
    const action = (e.parameter && e.parameter.action) || data.action || '';

    if (action === 'tryout') {
      const sh = _sheet();
      const row = [new Date(), data.prenom || '', data.nom || '', data.email || '', data.telephone || '', data.date || '', data.pupitre || '', data.message || '', data.ts || ''];
      sh.appendRow(row);
      // Optionnel : email de confirmation
      try {
        if (data.email) {
          const subject = 'Votre séance d\'essai – La Voix Libre';
          const body = 'Bonjour ' + (data.prenom || '') + ',\n\nVotre inscription à la séance d\'essai est bien prise en compte.\nRendez-vous : ' + (data.date || '') + '\n\nA très vite !\nLa Voix Libre';
          MailApp.sendEmail(data.email, subject, body);
        }
      } catch (e2) {}
      return _jsonOk({ ok: true });
    }

    if (action === 'tryout_list') {
      // Protection simple par mot de passe admin
      const pass = (e.parameter && e.parameter.adminPass) || data.adminPass || '';
      if (pass !== ADMIN_PASS) return _jsonOk({ ok: false, error: 'unauthorized' });
      const sh = _sheet();
      const values = sh.getDataRange().getValues();
      const headers = values.shift();
      const items = values.map(r => ({
        timestamp: r[0], prenom: r[1], nom: r[2], email: r[3], telephone: r[4], date: r[5], pupitre: r[6], message: r[7], ts: r[8]
      }));
      return _jsonOk({ ok: true, items });
    }

    return _jsonOk({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return _jsonOk({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  // Optionnel: route tryout_list en GET pour debug
  const action = (e.parameter && e.parameter.action) || '';
  if (action === 'tryout_list') {
    const pass = (e.parameter && e.parameter.adminPass) || '';
    if (pass !== ADMIN_PASS) return _jsonOk({ ok: false, error: 'unauthorized' });
    const sh = _sheet();
    const values = sh.getDataRange().getValues();
    const headers = values.shift();
    const items = values.map(r => ({
      timestamp: r[0], prenom: r[1], nom: r[2], email: r[3], telephone: r[4], date: r[5], pupitre: r[6], message: r[7], ts: r[8]
    }));
    return _jsonOk({ ok: true, items });
  }
  return _jsonOk({ ok: true, hello: 'tryout web app' });
}
