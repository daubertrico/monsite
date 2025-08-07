// Script Apps Script à coller dans Code.gs
function genererNewsletterEtBrouillon() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("posts");
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const rows = data.slice(1);

  const htmlBlocks = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowObj = {};
    header.forEach((key, index) => {
      rowObj[key.trim()] = row[index];
    });

    if (rowObj["tags"]?.toLowerCase().includes("evenements") && !rowObj["newsletter"]) {
      const formatDate = (dateStr) => {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateStr).toLocaleDateString('fr-FR', options);
      };

      const titre = rowObj["title"] || "Événement";
      const date = rowObj["date"] ? formatDate(rowObj["date"]) : "";
      const heure = rowObj["heure"] || "";
      const lieu = rowObj["lieu"] || "";
      const description = rowObj["description"] || "";
      const lienFb = rowObj["lien_fb"] || "";
      const videoUrl = rowObj["videos"] || "";
      const imageUrl = rowObj["image"] || "";

      let illustration = "";
      let ytLink = "";
      if (videoUrl && videoUrl.match(/(youtu.be\/|youtube.com\/watch\?v=)/)) {
        ytLink = videoUrl;
        let ytId = "";
        if (videoUrl.includes("v=")) {
          ytId = videoUrl.split("v=")[1]?.split("&")[0];
        } else {
          ytId = videoUrl.split("/").pop();
        }
        const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "";
        if (thumb) {
          illustration = `<a href='${ytLink}' target='_blank' style='display:block;'><img src='${thumb}' style='width: 100%; border-radius: 8px; display:block;' alt='Miniature YouTube'></a>`;
        } else {
          illustration = "";
        }
      } else if (imageUrl) {
        illustration = `<img src='${imageUrl}' style='width: 100%; border-radius: 8px;' alt='Illustration'>`;
      } else {
        illustration = "";
      }
      let links = "";
      if (lienFb) {
        links += `<p style='margin-top:10px;'><a href='${lienFb}' style='color:#8844aa; font-weight:bold; text-decoration:underline;'>Rejoindre l'événement Facebook</a></p>`;
      }
      const block = `
        <div class="encart-shadow">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout: fixed;">
            <tr>
              <td style="width: 45%; vertical-align: top;">${illustration}</td>
              <td style="width: 55%; padding-left: 20px; vertical-align: top;">
                <h3 class="encart-titre" style="color:#8844aa; font-family:'Raleway', Arial, sans-serif;">${titre}</h3>
                <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Date : ${date} à ${heure}</strong><br><strong>Lieu : ${lieu}</strong></p>
                <p style="font-size: 14px; color: #333;">${description}</p>
                ${links}
              </td>
            </tr>
          </table>
        </div>
        <hr class="encart-separator">
      `;
      htmlBlocks.push(block);
      sheet.getRange(i + 2, header.indexOf("newsletter") + 1).setValue("envoyé");
    }
  }

  const template = HtmlService.createTemplateFromFile("newsletter_template");
  template.encarts_evenements = htmlBlocks.join("\n"); // Directly join HTML blocks without transformation

  let htmlFinal = template.evaluate().getContent();
  // Correction centrage, couleur, taille et gras de la salutation
  htmlFinal = htmlFinal.replace(
    /(<div[^>]*>\s*Au plaisir de chanter pour et avec vous[^<]*<\/div>)/i,
    '<div style="text-align:center; color:#8844aa; font-family:Raleway, Arial, sans-serif; font-size:18px; font-weight:bold; margin-top:24px;">Au plaisir de chanter pour et avec vous :) !</div>'
  );

  // La génération du HTML est terminée. Copier-coller le HTML dans Gmail manuellement.
  Logger.log(htmlFinal);
}
