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
// Coordonnées et liens pour l'email de confirmation
const EGM_ADDRESS_NAME = 'L\'Avenir de Rennes';
const EGM_ADDRESS = '21 rue Papu, 35000 Rennes';
const EGM_MAPS = "https://maps.google.com/?q=L'Avenir%20de%20Rennes%2C%2021%20Rue%20Papu%2C%2035000%20Rennes";
const EGM_DURATION = '2 heures';
const EGM_WEBSITE = 'https://chanterlavoixlibre.fr';
const EGM_INSTAGRAM = 'https://instagram.com/chanterlavoixlibre';
const EGM_FACEBOOK = 'https://facebook.com/chanterlavoixlibre';

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
      // Email de confirmation
      try {
        if (data.email) {
          const prenom = data.prenom || '';
          const when = data.date || '';
          const subject = '🎶 Bienvenue à La Voix Libre – votre séance d\u2019essai est confirmée !';
          const textBody =
`Bonjour ${prenom},\n\nMerci pour votre inscription à une séance d\'essai avec La Voix Libre ! 🎵\nNous sommes ravis de vous accueillir pour partager un moment convivial, plein d’énergie, de musique et de bonne humeur.\n\n📅 Informations pratiques\n\nDate & heure : ${when}\n\nLieu : ${EGM_ADDRESS_NAME} — ${EGM_ADDRESS} (plan d’accès : ${EGM_MAPS})\n\nDurée : Environ ${EGM_DURATION}\n\nTenue conseillée : confortable, qui permet de bouger librement\n\n🔎 À propos de La Voix Libre\n\nLa Voix Libre, c’est un chœur dynamique, ouvert à tous niveaux, où l’on chante Pop, Soul, Gospel et musiques du monde… le tout dans une ambiance décontractée et bienveillante.\n\n📌 Pour rester connecté(e)\n\nSite web : ${EGM_WEBSITE}\nInstagram : ${EGM_INSTAGRAM}\nFacebook : ${EGM_FACEBOOK}\n\n🎤 Hâte de chanter ensemble !\n\nEn attendant la séance, n’hésitez pas à parcourir nos vidéos et photos pour vous mettre dans l’ambiance… et surtout, venez comme vous êtes !\n\nMusicalement,\nVincent – Chef de chœur\n🎶 La Voix Libre`;
          const htmlBody = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#1f2937;line-height:1.6;">
  <h2 style="margin:0 0 8px 0;">🎶 Bienvenue à La Voix Libre – votre séance d’essai est confirmée !</h2>
  <p>Bonjour <strong>${prenom}</strong>,</p>
  <p>Merci pour votre inscription à une séance d’essai avec <strong>La Voix Libre</strong> ! 🎵<br>
  Nous sommes ravis de vous accueillir pour partager un moment convivial, plein d’énergie, de musique et de bonne humeur.</p>
  <h3 style="margin:16px 0 8px 0;">📅 Informations pratiques</h3>
  <ul style="margin:0 0 12px 18px;padding:0;">
    <li><strong>Date & heure :</strong> ${when}</li>
  <li><strong>Lieu :</strong> ${EGM_ADDRESS_NAME} — ${EGM_ADDRESS} (<a href="${EGM_MAPS}" target="_blank" rel="noopener">plan d’accès</a>)</li>
    <li><strong>Durée :</strong> Environ ${EGM_DURATION}</li>
    <li><strong>Tenue conseillée :</strong> confortable, qui permet de bouger librement</li>
  </ul>
  <h3 style="margin:16px 0 8px 0;">🔎 À propos de La Voix Libre</h3>
  <p>La Voix Libre, c’est un chœur dynamique, ouvert à tous niveaux, où l’on chante Pop, Soul, Gospel et musiques du monde…
  le tout dans une ambiance décontractée et bienveillante.</p>
  <h3 style="margin:16px 0 8px 0;">📌 Pour rester connecté(e)</h3>
  <p>
    🌐 <a href="${EGM_WEBSITE}" target="_blank" rel="noopener">Site web</a><br>
    📸 <a href="${EGM_INSTAGRAM}" target="_blank" rel="noopener">Instagram</a><br>
    📘 <a href="${EGM_FACEBOOK}" target="_blank" rel="noopener">Facebook</a>
  </p>
  <h3 style="margin:16px 0 8px 0;">🎤 Hâte de chanter ensemble !</h3>
  <p>En attendant la séance, n’hésitez pas à parcourir nos vidéos et photos pour vous mettre dans l’ambiance…
  et surtout, venez comme vous êtes !</p>
  <p style="margin-top:18px;">Musicalement,<br>
  Vincent – Chef de chœur<br>
  🎶 La Voix Libre</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;">
  <p style="font-size:12px;color:#6b7280;">Lieu habituel : ${EGM_ADDRESS_NAME}, ${EGM_ADDRESS}</p>
  </div>`;
          MailApp.sendEmail({
            to: data.email,
            subject: subject,
            body: textBody,
            htmlBody: htmlBody,
            name: 'La Voix Libre'
          });
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
