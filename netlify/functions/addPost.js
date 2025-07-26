const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const data = JSON.parse(event.body);

  // Chemin vers posts.json (adapter si besoin)
  const postsPath = path.join(__dirname, '../../data/posts.json');
  let posts = [];

  try {
    posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
  } catch (e) {
    // Si le fichier n'existe pas ou est vide
    posts = [];
  }

  // Ajoute le nouveau post
  posts.push({
    id: Date.now().toString(),
    title: data.title,
    date: data.date,
    lieu: data.lieu,
    description: data.description,
    lien_fb: data.lien_fb
  });

  fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2), 'utf8');

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Post ajouté !' })
  };
};
