// Web App de désinscription newsletter.
// À coller dans le même projet Apps Script que Code.gs / mail_choristes.gs
// (celui lié au classeur contenant l'onglet "Réponses au formulaire 1").
//
// Déploiement : Extensions > Apps Script > Déployer > Nouveau déploiement
//   - Type : Application Web
//   - Exécuter en tant que : Moi
//   - Qui a accès : Tout le monde
// Récupérer l'URL /exec fournie et l'utiliser :
//   1. comme lien "Se désinscrire" dans le pied des e-mails (mail_choristes.gs, newsletter_template.html)
//   2. comme valeur de WEBAPP_URL dans desinscription.html à la racine du site

function doGet(e) {
  return handleUnsubscribe(e);
}

function doPost(e) {
  return handleUnsubscribe(e);
}

function handleUnsubscribe(e) {
  const SHEET_NAME = 'Réponses au formulaire 1';
  const EMAIL_COLUMN_HEADER = 'Adresse e-mail';

  const email = ((e && e.parameter && e.parameter.email) || '').toString().trim().toLowerCase();
  let message;
  let success = false;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    message = "Adresse e-mail invalide. Vérifiez l'orthographe et réessayez.";
  } else {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      message = "Erreur interne : feuille des abonnés introuvable.";
    } else {
      const data = sheet.getDataRange().getValues();
      const header = data[0].map(h => (h || '').toString().trim());
      const emailCol = header.indexOf(EMAIL_COLUMN_HEADER);
      if (emailCol === -1) {
        message = "Erreur interne : colonne e-mail introuvable.";
      } else {
        let found = false;
        // Parcours de bas en haut pour que les suppressions ne décalent pas les indices restants.
        for (let i = data.length - 1; i >= 1; i--) {
          const rowEmail = (data[i][emailCol] || '').toString().trim().toLowerCase();
          if (rowEmail === email) {
            sheet.deleteRow(i + 1);
            found = true;
          }
        }
        if (found) {
          success = true;
          message = "Vous avez bien été désinscrit·e de la newsletter de La Voix Libre. Vous ne recevrez plus d'e-mails de notre part.";
        } else {
          message = "Cette adresse e-mail n'a pas été trouvée dans notre liste d'abonnés (elle a peut-être déjà été retirée).";
        }
      }
    }
  }

  return HtmlService.createHtmlOutput(renderUnsubscribePage(message, success))
    .setTitle('Désinscription – La Voix Libre');
}

function renderUnsubscribePage(message, success) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f9f9f9;color:#333;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:20px;}
  .card{background:#fff;max-width:440px;width:100%;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);padding:32px 28px;text-align:center;}
  h1{font-size:1.4rem;color:${success ? '#8844aa' : '#cc3333'};margin-bottom:14px;}
  p{line-height:1.6;}
  a{color:#ff6699;font-weight:bold;text-decoration:none;}
</style></head>
<body><div class="card">
  <h1>${success ? '✔ Désinscription confirmée' : 'Désinscription'}</h1>
  <p>${message}</p>
  <p style="margin-top:20px;"><a href="https://chanterlavoixlibre.fr">Retour au site</a></p>
</div></body></html>`;
}
