const fs = require('fs');
const path = require('path');

// Dossier à scanner
const SONGS_DIR = path.join(__dirname, 'materielchansons');
const OUTPUT_JSON = path.join(__dirname, 'data', 'partitions.json');

// Extensions à classer
const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.ogg', '.wav'];
const PDF_EXT = ['.pdf'];
const DOC_EXT = ['.doc', '.docx'];
const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

function scanSongFolders() {
  const result = [];
  const folders = fs.readdirSync(SONGS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  folders.forEach(folder => {
    const folderPath = path.join(SONGS_DIR, folder);
    const files = fs.readdirSync(folderPath, { withFileTypes: true })
      .filter(f => f.isFile())
      .map(f => f.name);

    const entry = {
      title: folder,
      audio: [],
      pdf: [],
      doc: [],
      img: []
    };

    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      const relPath = path.join('materielchansons', folder, file).replace(/\\/g, '/');
      if (AUDIO_EXT.includes(ext)) entry.audio.push(relPath);
      else if (PDF_EXT.includes(ext)) entry.pdf.push(relPath);
      else if (DOC_EXT.includes(ext)) entry.doc.push(relPath);
      else if (IMG_EXT.includes(ext)) entry.img.push(relPath);
    });

    // Ajoute seulement si au moins un fichier
    if (entry.audio.length || entry.pdf.length || entry.doc.length || entry.img.length) {
      result.push(entry);
    }
  });
  return result;
}

function updatePartitionsJson() {
  const data = scanSongFolders();
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(data, null, 2), 'utf8');
  console.log(`partitions.json mis à jour avec ${data.length} chansons.`);
}

updatePartitionsJson();
