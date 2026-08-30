/**
 * Google Apps Script – Web App combiné : "Séances d'essai" (La Voix Libre) + "Auditions SOUL"
 *
 * IMPORTANT — rien n'est écrasé : ce fichier contient le code des séances
 * d'essai EXACTEMENT tel qu'il existe déjà (mêmes fonctions _sheet(), doPost
 * action 'tryout', doPost action 'tryout_list', etc. — copié à l'identique),
 * plus le nouveau code des auditions SOUL ajouté À LA SUITE. Il n'y a donc
 * PAS deux scripts à gérer : vous collez CE fichier entier à la place de
 * l'ancien, et les inscriptions aux séances d'essai continuent de fonctionner
 * exactement comme avant (même feuille "inscriptions", mêmes emails).
 * Les auditions SOUL, elles, écrivent dans un nouvel onglet séparé
 * "auditions_soul" du même classeur — aucune collision possible.
 *
 * 1) Ouvrez le projet Apps Script existant (celui derrière TRYOUT_ENDPOINT côté site).
 * 2) Remplacez tout le contenu du fichier .gs par le contenu de CE fichier
 *    (un simple copier-coller intégral — pas un "ajout à la main").
 * 3) Vérifiez SHEET_ID (déjà le bon normalement) et ADMIN_PASS.
 * 4) Un nouvel onglet "auditions_soul" sera créé automatiquement au premier
 *    passage dans le même classeur Google Sheet que les séances d'essai.
 * 5) Déployez : Déployer > Gérer les déploiements > (icône crayon) > Version "Nouvelle version" > Déployer.
 *    L'URL /exec reste identique, inutile de la remettre à jour côté site.
 * 6) Côté site (assets/js/main.js), AUDITION_ENDPOINT pointe déjà vers cette même URL.
 *
 * --- Agenda Google automatique ---
 * Chaque audition réservée crée un événement dans l'agenda Google du compte
 * qui a déployé ce script (celui utilisé pour "Exécuter en : Moi"). Pas besoin
 * de lien ni d'ID de calendrier : CalendarApp.getDefaultCalendar() cible
 * automatiquement l'agenda principal de ce compte. Si les 4 places d'un même
 * créneau sont prises, vous verrez 4 événements à la même heure, un par
 * candidat·e — c'est voulu, ça vous permet de voir d'un coup d'œil qui vient
 * à quelle heure.
 * Si vous préférez un agenda dédié (pas le principal), créez-le dans Google
 * Calendar, ouvrez ses "Paramètres et partage", copiez son "ID du calendrier"
 * (ressemble à xxxx@group.calendar.google.com) et collez-le dans
 * AUDITION_CALENDAR_ID ci-dessous à la place de "" .
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
const AUDITION_SHEET_NAME = 'auditions_soul';
const ADMIN_PASS = 'chefdechoeur'; // Doit correspondre côté site
const AUDITION_LOCATION = '14-16 rue Papu, Rennes';
// Laissez vide '' pour utiliser l'agenda principal du compte qui a déployé ce script.
// Sinon, collez l'ID d'un agenda dédié (Paramètres du calendrier > "ID du calendrier").
const AUDITION_CALENDAR_ID = '';

function _auditionCalendar() {
  return AUDITION_CALENDAR_ID ? CalendarApp.getCalendarById(AUDITION_CALENDAR_ID) : CalendarApp.getDefaultCalendar();
}

function _spreadsheet() {
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
    // Fallback: crée un nouveau classeur si l'ID fourni est invalide
    ss = SpreadsheetApp.create('Essais – Inscriptions');
    sid = ss.getId();
    try { PropertiesService.getScriptProperties().setProperty('TRYOUT_SHEET_ID', sid); } catch (e2) {}
  }
  return ss;
}

function _sheet() {
  const ss = _spreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['timestamp','prenom','nom','email','telephone','date','pupitre','message','ts']);
  }
  return sh;
}

function _auditionSheet() {
  const ss = _spreadsheet();
  const sh = ss.getSheetByName(AUDITION_SHEET_NAME) || ss.insertSheet(AUDITION_SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['timestamp','prenom','nom','email','telephone','creneau','message','ts']);
  }
  return sh;
}

function _jsonOk(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _auditionCounts() {
  const sh = _auditionSheet();
  const values = sh.getDataRange().getValues();
  values.shift(); // headers
  const counts = {};
  values.forEach(r => {
    const creneau = r[5];
    if (!creneau) return;
    counts[creneau] = (counts[creneau] || 0) + 1;
  });
  return counts;
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

    // ---- Auditions SOUL ----
    if (action === 'audition') {
      const sh = _auditionSheet();
      const row = [new Date(), data.prenom || '', data.nom || '', data.email || '', data.telephone || '', data.creneau || '', data.message || '', data.ts || ''];
      sh.appendRow(row);

      // Email de confirmation au candidat
      try {
        if (data.email) {
          const subject = 'Votre audition SOUL – La Voix Libre';
          const body = 'Bonjour ' + (data.prenom || '') + ',\n\n'
            + 'Votre inscription à l\'audition SOUL est bien prise en compte.\n'
            + 'Créneau réservé : ' + (data.creneau || '') + '\n'
            + 'Lieu : ' + AUDITION_LOCATION + '\n\n'
            + 'A très vite !\nSOUL – La Voix Libre';
          MailApp.sendEmail(data.email, subject, body);
        }
      } catch (e2) {}

      // Ajout automatique dans l'agenda Google (un événement par candidat·e)
      try {
        if (data.start && data.end) {
          const nomComplet = ((data.prenom || '') + ' ' + (data.nom || '')).trim();
          _auditionCalendar().createEvent(
            'Audition SOUL – ' + nomComplet,
            new Date(data.start),
            new Date(data.end),
            {
              location: AUDITION_LOCATION,
              description: 'Email : ' + (data.email || '') + '\nTéléphone : ' + (data.telephone || '') + '\nMessage : ' + (data.message || '')
            }
          );
        }
      } catch (e3) {}

      return _jsonOk({ ok: true });
    }

    if (action === 'audition_list') {
      const pass = (e.parameter && e.parameter.adminPass) || data.adminPass || '';
      if (pass !== ADMIN_PASS) return _jsonOk({ ok: false, error: 'unauthorized' });
      const sh = _auditionSheet();
      const values = sh.getDataRange().getValues();
      const headers = values.shift();
      const items = values.map(r => ({
        timestamp: r[0], prenom: r[1], nom: r[2], email: r[3], telephone: r[4], creneau: r[5], message: r[6], ts: r[7]
      }));
      return _jsonOk({ ok: true, items });
    }

    if (action === 'audition_counts') {
      return _jsonOk({ ok: true, counts: _auditionCounts() });
    }

    return _jsonOk({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return _jsonOk({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || '';

  if (action === 'tryout_list') {
    const pass = (e.parameter && e.parameter.adminPass) || '';
    if (pass !== ADMIN_PASS) return _jsonOk({ ok: false, error: 'unauthorized' });
    const sh = _sheet();
    const values = sh.getDataRange().getValues();
    values.shift();
    const items = values.map(r => ({
      timestamp: r[0], prenom: r[1], nom: r[2], email: r[3], telephone: r[4], date: r[5], pupitre: r[6], message: r[7], ts: r[8]
    }));
    return _jsonOk({ ok: true, items });
  }

  if (action === 'audition_list') {
    const pass = (e.parameter && e.parameter.adminPass) || '';
    if (pass !== ADMIN_PASS) return _jsonOk({ ok: false, error: 'unauthorized' });
    const sh = _auditionSheet();
    const values = sh.getDataRange().getValues();
    values.shift();
    const items = values.map(r => ({
      timestamp: r[0], prenom: r[1], nom: r[2], email: r[3], telephone: r[4], creneau: r[5], message: r[6], ts: r[7]
    }));
    return _jsonOk({ ok: true, items });
  }

  if (action === 'audition_counts') {
    return _jsonOk({ ok: true, counts: _auditionCounts() });
  }

  return _jsonOk({ ok: true, hello: 'tryout + audition web app' });
}
