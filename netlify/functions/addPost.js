const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const data = JSON.parse(event.body);
  const repo = 'daubertrico/monsite';
  const branch = 'ma-nouvelle-branche';
  const filePath = 'data/posts.json';
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    return { statusCode: 500, body: 'Missing GITHUB_TOKEN env variable' };
  }

  // 1. Get the current file (posts.json) from GitHub
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
  const headers = {
    'Authorization': `token ${githubToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'NetlifyFunction'
  };

  let posts = [];
  let sha = null;

  try {
    const res = await fetch(apiUrl, { headers });
    if (!res.ok) throw new Error('Failed to fetch posts.json');
    const fileData = await res.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf8');
    posts = JSON.parse(content);
    sha = fileData.sha;
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
    lien_fb: data.lien_fb,
    tags: data.tags // Ajout du champ tags pour affichage sur le site
  });

  // 2. Commit the new file to GitHub
  const newContent = Buffer.from(JSON.stringify(posts, null, 2)).toString('base64');
  const commitRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: 'Ajout automatique d’un post via Cloudflare Pages',
      content: newContent,
      branch,
      sha
    })
  });

  if (!commitRes.ok) {
    const errorText = await commitRes.text();
    return { statusCode: 500, body: `GitHub commit failed: ${errorText}` };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Post ajouté et commit GitHub effectué (Cloudflare Pages) !' })
  };
};
