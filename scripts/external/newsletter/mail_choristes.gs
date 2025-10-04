// Crée des brouillons Gmail pour les rappels choristes (ne pas envoyer)
function envoyerMailChoristesHtmlDraft() {
  const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("posts");
  if (!feuille) {
    Logger.log("Feuille 'posts' introuvable.");
    return;
  }

  const donnees = feuille.getDataRange().getValues();
  if (!donnees || donnees.length < 2) {
    Logger.log("Aucune donnée dans 'posts'.");
    return;
  }

  const header = donnees[0].map(h => (h || "").toString().trim());
  const rows = donnees.slice(1);

  const idx = name => header.indexOf(name);
  const idxTitle = idx('title');
  const idxDate = idx('date');
  const idxHeure = idx('heure');
  const idxTags = idx('tags');
  const idxLieu = idx('lieu');
  const idxLienFb = idx('lien_fb');
  const idxId = idx('id');
  const idxMailCh = idx('mail_choristes');
  const idxNewsletter = idx('newsletter');

  if (idxTitle === -1 || idxDate === -1 || idxTags === -1 || idxMailCh === -1) {
    Logger.log('Colonnes requises manquantes (title/date/tags/mail_choristes). Vérifiez les en-têtes.');
    return;
  }

  const aujourdHui = new Date();
  Logger.log('Headers detected: ' + header.join(' | '));
  Logger.log('Indexes: title=' + idxTitle + ', date=' + idxDate + ', heure=' + idxHeure + ', tags=' + idxTags + ', lieu=' + idxLieu + ', lien_fb=' + idxLienFb + ', mail_choristes=' + idxMailCh + ', id=' + idxId + ', newsletter=' + idxNewsletter);

  let draftsCreated = 0;

  for (let i = 0; i < rows.length; i++) {
    const sheetRow = i + 2; // ligne réelle dans la feuille (1-based)
    const row = rows[i];

    const tags = (row[idxTags] || '').toString();
    const mailChVal = (idxMailCh !== -1 ? (row[idxMailCh] || '').toString() : '');
    if (!tags || !tags.toLowerCase().includes('evenements')) {
      Logger.log('Ligne ' + sheetRow + ' ignorée: tags non présents ou ne contiennent pas evenements (' + tags + ')');
      continue;
    }
    if (mailChVal && mailChVal.trim() !== '') {
      Logger.log('Ligne ' + sheetRow + ' ignorée: colonne mail_choristes déjà remplie (' + mailChVal + ')');
      continue; // déjà traité pour choristes
    }

    const title = (row[idxTitle] || '').toString();
    const dateCell = row[idxDate];
    const heure = (row[idxHeure] || '').toString();
    const lieu = (row[idxLieu] || '').toString();
    const lienFb = (row[idxLienFb] || '').toString();
    const mailChoristes = (idxMailCh !== -1 ? (row[idxMailCh] || '').toString() : '');

    // Parse date robustly
    let dateEvenement = null;
    if (dateCell instanceof Date && !isNaN(dateCell.getTime())) {
      dateEvenement = dateCell;
    } else if (typeof dateCell === 'string' && dateCell.includes('/')) {
      const parts = dateCell.split('/').map(p => p.trim());
      if (parts.length === 3) {
        const [jj, mm, aaaa] = parts;
        dateEvenement = new Date(`${aaaa}-${mm}-${jj}`);
      }
    } else if (typeof dateCell === 'number') {
      // Excel/Sheets serial date
      dateEvenement = new Date(Math.round((dateCell - 25569) * 86400 * 1000));
    }
    if (!dateEvenement || isNaN(dateEvenement.getTime())) continue;

    // Normalize the heure cell: it may be a Date (time only), a string like "19:30", or a serial number
    const heureCell = row[idxHeure];
    const normalizedTime = formatHeureCell(heureCell);
    if (normalizedTime && dateEvenement) {
      // apply hours/minutes to the dateEvenement so computations and formatting are correct
      dateEvenement.setHours(normalizedTime.hours, normalizedTime.minutes, 0, 0);
    }

    const diffJours = Math.ceil((dateEvenement - aujourdHui) / (1000 * 60 * 60 * 24));
    if (diffJours > 30) continue; // ignore events beyond 30 jours

  const dateFormatee = Utilities.formatDate(dateEvenement, Session.getScriptTimeZone() || 'Europe/Paris', 'dd/MM/yyyy');
  // prefer the normalized HH:mm when available to avoid date artifacts like "1899 ..."
  const timeFormatee = (normalizedTime ? pad2(normalizedTime.hours) + ':' + pad2(normalizedTime.minutes) : Utilities.formatDate(dateEvenement, Session.getScriptTimeZone() || 'Europe/Paris', 'HH:mm'));
    const sujet = `${title} – Rappel choristes`;

    // Construire l'encart pratique pour le template mail_choristes
  const detailsHtml = `
      <div class="encart-shadow">
        <h3 class="encart-titre">${escapeHtml(title)}</h3>
    <p><strong>Date :</strong> ${dateFormatee}${timeFormatee ? ' à ' + timeFormatee : ''}</p>
        <p><strong>Lieu :</strong> ${escapeHtml(lieu) || 'à confirmer'}</p>
        ${lienFb ? (`<p><a href="${escapeHtml(lienFb)}" target="_blank">Lien Facebook de l'événement</a></p>`) : ''}
        <hr class="encart-separator">
        <p style="margin-top:8px">Préparez : partitions, eau, et bonne humeur. Merci de confirmer votre présence sur l'espace choristes.</p>
      </div>
    `;

  // Build a plain-text intro but use the nicely formatted time (no 1899 year nor timezone)
  const introText = `Bonjour les ami·e·s choristes,\n\nJe vous rappelle que le ${dateFormatee}${timeFormatee ? ' à ' + timeFormatee : ''} nous jouons : ${escapeHtml(title)}.\n\nPréparons ensemble ce bel événement ! Pour cela, merci de confirmer votre présence en remplissant le calendrier de participation.`;

    const ctaHtml = `<p>Partagez l'événement et invitez vos proches — l'événement est annoncé sur <a href="https://chanterlavoixlibre.fr/evenements" target="_blank">chanterlavoixlibre.fr/evenements</a> et sur nos réseaux.</p>`;

    try {
      // build html using the requested newsletter head + footer and inject the event encart
      const htmlFinal = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter - La Voix Libre</title>
  <link href="https://fonts.googleapis.com/css2?family=Lobster&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'Lobster';
      src: url('data:font/woff2;charset=utf-8;base64,d09GMgABAAAAAA...') format('woff2');
      font-weight: normal;
      font-style: normal;
    }
    .encart-titre {
      font-family: 'Raleway', Arial, sans-serif;
      font-size: 20px;
      font-weight: 700;
      color: #8844aa;
      margin-top: 0;
      margin-bottom: 8px;
      text-align: left;
    }
    .encart-shadow {
      box-shadow: 0 4px 12px rgba(0,0,0,0.10);
      border-radius: 12px;
      background: #fff;
      margin-bottom: 32px;
    }
    .chant-ensemble {
      font-family: 'Raleway', Arial, sans-serif;
      font-size: 1.15em;
      color: #8844aa;
      margin: 24px 0 0 0;
      text-align: center;
      letter-spacing: 1px;
    }
    .encart-separator {
      width: 80%;
      margin: 0 auto 32px auto;
      border: none;
      border-top: 2px solid #eee;
      height: 0;
      display: block;
    }
  </style>
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); overflow: hidden;">
    <div style="background: #ff6699; color: #fff; padding: 20px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 20px;">
  <img src="https://chanterlavoixlibre.fr/assets/images/entete.png" alt="La Voix Libre - chant chorale à Rennes" style="width:100%; max-width:560px; border-radius:12px; display:block; margin:auto;">
    </div>
    <div style="padding: 20px; text-align: center;">
      <div style="text-align:justify;margin-bottom:14px">${escapeHtml(introText).replace(/\n/g,'<br>')}</div>
      ${detailsHtml}
    </div>
  <div style="text-align:center; color:#8844aa; font-family:Raleway, Arial, sans-serif; font-size:18px; font-weight:bold; margin-top:24px;">Au plaisir de chanter ensemble,<br>Vincent</div>
    <div style="background: #8844aa; color: #fff; text-align: center; padding: 10px; font-size: 0.9rem;">
      <p>Suivez-nous : <a href="https://www.facebook.com/chanterlavoixlibre/" style="color: #ffcccc; text-decoration: none;">Facebook</a> | <a href="https://www.instagram.com/chanterlavoixlibre/" style="color: #ffcccc; text-decoration: none;">Instagram</a> | <a href="https://www.youtube.com/channel/UC5xRWArmPqnh_OdfvubC38Q" style="color: #ffcccc; text-decoration: none;">YouTube</a></p>
      <p><a href="https://chanterlavoixlibre.fr" style="color: #ffcccc; text-decoration: none;">chanterlavoixlibre.fr</a></p>
    </div>
    
  </div>
</body>
</html>`;

  const to = mailChoristes || '';
  // create draft without recipient so Gmail shows the full HTML body reliably in the draft preview
  GmailApp.createDraft('', sujet, 'Version texte : voir le brouillon en HTML', { htmlBody: htmlFinal });
  Logger.log('Brouillon créé pour ligne ' + sheetRow + (to ? ' destinataire: ' + to : ' (pas de destinataire)'));
      draftsCreated++;

      // marquer la colonne newsletter uniquement après succès (si présente)
      if (idxNewsletter !== -1) {
        feuille.getRange(sheetRow, idxNewsletter + 1).setValue('envoyé');
      }
      // remplir la case mail_choristes avec 'ok'
      feuille.getRange(sheetRow, idxMailCh + 1).setValue('ok');
    } catch (err) {
      Logger.log('Erreur création brouillon ligne ' + sheetRow + ' : ' + err.toString());
    }
  }
  Logger.log('Execution terminée. Brouillons créés: ' + draftsCreated);
}

// Petite fonction utilitaire pour échapper du texte dans le HTML
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Parse the heure cell which may be a Date object (time-only), a string like '19:30', or a serial number
function formatHeureCell(cell) {
  if (cell instanceof Date && !isNaN(cell.getTime())) {
    return { hours: cell.getHours(), minutes: cell.getMinutes() };
  }
  if (typeof cell === 'string') {
    const s = cell.trim();
    // ISO time or HH:MM
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (m) return { hours: parseInt(m[1], 10), minutes: parseInt(m[2], 10) };
    // try parsing as full datetime string
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return { hours: parsed.getHours(), minutes: parsed.getMinutes() };
  }
  if (typeof cell === 'number') {
    // Sheets serial: fraction of a day represents time only when <1, or full date when >1
    if (cell < 1) {
      const totalMinutes = Math.round(cell * 24 * 60);
      return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
    } else {
      const d = new Date(Math.round((cell - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return { hours: d.getHours(), minutes: d.getMinutes() };
    }
  }
  return null;
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }
