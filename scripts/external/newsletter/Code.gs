// Script Apps Script à coller dans Code.gs
function genererNewsletterEtBrouillon() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("posts");
  if (!sheet) {
    Logger.log("Feuille 'posts' introuvable.");
    return;
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    Logger.log("Aucune ligne de données trouvée dans 'posts'.");
    return;
  }

  // Normalise les en-têtes (trim)
  const rawHeader = data[0];
  const header = rawHeader.map(h => (h || "").toString().trim());
  const rows = data.slice(1);

  const htmlBlocks = [];
  const rowsToMark = []; // stocke les numéros de ligne (1-based) à marquer "envoyé" après succès

  const newsletterColIndex = header.indexOf("newsletter");
  if (newsletterColIndex === -1) {
    Logger.log("Colonne 'newsletter' introuvable dans les en-têtes. Vérifiez l'ordre des colonnes.");
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowObj = {};
    for (let j = 0; j < header.length; j++) {
      rowObj[header[j]] = row[j];
    }

    const tags = (rowObj["tags"] || "").toString();
    const newsletterVal = (rowObj["newsletter"] || "").toString();

    if (tags.toLowerCase().includes("evenements") && newsletterVal.trim() === "") {
      // Formatage de la date (supporte Date objet ou chaîne)
      let dateStr = "";
      const dateRaw = rowObj["date"];
      try {
        if (dateRaw) {
          const d = (dateRaw instanceof Date) ? dateRaw : new Date(dateRaw);
          if (!isNaN(d.getTime())) {
            const tz = Session.getScriptTimeZone() || 'Europe/Paris';
            dateStr = Utilities.formatDate(d, tz, "d MMMM yyyy");
          }
        }
      } catch (e) {
        dateStr = (dateRaw || "").toString();
      }

      const titre = rowObj["title"] || "Événement";
      const heure = rowObj["heure"] || "";
      const lieu = rowObj["lieu"] || "";
      // Utiliser la colonne 'content' fournie par votre feuille (pas 'description')
      const description = rowObj["content"] || "";
      const lienFb = rowObj["lien_fb"] || "";
      const videoUrl = rowObj["videos"] || "";
      const imageUrl = rowObj["image"] || "";

      let illustration = "";
      let ytLink = "";
      if (videoUrl && /(youtu.be\/|youtube.com\/watch\?v=)/.test(videoUrl)) {
        ytLink = videoUrl;
        let ytId = "";
        if (videoUrl.indexOf("v=") !== -1) {
          ytId = videoUrl.split("v=")[1]?.split("&")[0] || "";
        } else {
          ytId = videoUrl.split("/").pop() || "";
        }
        const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "";
        if (thumb) {
          illustration = `<a href='${ytLink}' target='_blank' style='display:block;'><img src='${thumb}' style='width: 100%; border-radius: 8px; display:block;' alt='Miniature YouTube'></a>`;
        }
      } else if (imageUrl) {
        illustration = `<img src='${imageUrl}' style='width: 100%; border-radius: 8px;' alt='Illustration'>`;
      }

      let links = "";
      if (lienFb) {
        links += `<p style='margin-top:10px;'><a href='${lienFb}' style='color:#8844aa; font-weight:bold; text-decoration:underline;'>Rejoindre l\'événement Facebook</a></p>`;
      }

      const block = `
        <div class="encart-shadow">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout: fixed;">
            <tr>
              <td style="width: 45%; vertical-align: top;">${illustration}</td>
              <td style="width: 55%; padding-left: 20px; vertical-align: top;">
                <h3 class="encart-titre" style="color:#8844aa; font-family:'Raleway', Arial, sans-serif;">${titre}</h3>
                <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Date : ${dateStr} à ${heure}</strong><br><strong>Lieu : ${lieu}</strong></p>
                <p style="font-size: 14px; color: #333;">${description}</p>
                ${links}
              </td>
            </tr>
          </table>
        </div>
        <hr class="encart-separator">
      `;

      htmlBlocks.push(block);
      // conserver la ligne à marquer après création du brouillon
      rowsToMark.push(i + 2); // i starts at 0, +2 to get sheet row number
    }
  }

  if (htmlBlocks.length === 0) {
    Logger.log("Aucun événement non marqué trouvé pour la newsletter.");
    return;
  }

  const template = HtmlService.createTemplateFromFile("newsletter_template");
  template.encarts_evenements = htmlBlocks.join("\n");

  let htmlFinal = template.evaluate().getContent();
  // Correction centrage, couleur, taille et gras de la salutation
  htmlFinal = htmlFinal.replace(
    /(<div[^>]*>\s*Au plaisir de chanter pour et avec vous[^<]*<\/div>)/i,
    '<div style="text-align:center; color:#8844aa; font-family:Raleway, Arial, sans-serif; font-size:18px; font-weight:bold; margin-top:24px;">Au plaisir de chanter pour et avec vous :) !</div>'
  );

  // Créer un brouillon Gmail avec le HTML généré
  try {
    const now = new Date();
    const monthNum = now.getMonth() + 1; // numéro du mois en cours (1-12)
    const subject = `newsletter ${monthNum}`;

    // createDraft(to, subject, body, options) - on laisse le destinataire vide pour un brouillon
    const draft = GmailApp.createDraft('', subject, 'Version texte : voir le brouillon HTML', { htmlBody: htmlFinal });
    Logger.log('Brouillon créé : ' + (draft && draft.getId ? draft.getId() : 'ID indisponible'));

    // Après succès, marquer les lignes traitées
    for (let k = 0; k < rowsToMark.length; k++) {
      const sheetRow = rowsToMark[k];
      sheet.getRange(sheetRow, newsletterColIndex + 1).setValue('envoyé');
    }

    Logger.log('Lignes marquées comme envoyées : ' + rowsToMark.join(','));
  } catch (err) {
    Logger.log('Erreur lors de la création du brouillon Gmail : ' + err.toString());
    // Ne pas marquer les lignes si échec
  }
}
