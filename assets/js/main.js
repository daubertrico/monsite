document.addEventListener('DOMContentLoaded', () => {
  const ASSETS_BASE_URL = 'assets/';
  const DATA_BASE_URL = 'data/';
  let globalConfig = null;
  let pagesData = null;
  let partitionsData = null;
  let postsData = null;

  async function fetchJson(filename) {
    console.log(`[DEBUG] Tentative de chargement de ${DATA_BASE_URL}${filename}`);
    try {
      const response = await fetch(`${DATA_BASE_URL}${filename}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur HTTP ${response.status} lors du chargement de ${filename}: ${errorText}`);
      }
      const data = await response.json();
      console.log(`[DEBUG] ${filename} chargé avec succès. Données:`, data);
      return data;
    } catch (error) {
      console.error(`[ERREUR FATALE] Impossible de charger le fichier ${filename}:`, error);
      return null;
    }
  }

  function applyGlobalConfig() {
    if (!globalConfig || globalConfig.length === 0) {
      console.warn("[WARN] Configuration globale non chargée ou vide. Impossible d'appliquer le thème.");
      return;
    }

    console.log("[DEBUG] Application de la configuration globale...");
    const siteTitleConfig = globalConfig.find(item => item.section === 'head' && item.champ === 'site_title');
    if (siteTitleConfig) {
      document.title = siteTitleConfig.valeur;
      console.log(`[DEBUG] Titre du document mis à jour: ${document.title}`);
    }

    const logoUrlConfig = globalConfig.find(item => item.section === 'head' && item.champ === 'logo_url');
    const siteLogo = document.querySelector('.site-logo');
    if (siteLogo && logoUrlConfig) {
      siteLogo.src = logoUrlConfig.valeur;
      siteLogo.alt = `Logo ${siteTitleConfig ? siteTitleConfig.valeur : 'La Voix Libre'}`;
      console.log(`[DEBUG] Logo du site mis à jour: ${siteLogo.src}`);
    } else {
      console.warn("[WARN] Logo du site (.site-logo) ou configuration du logo manquante.");
    }

    const footerEmailConfig = globalConfig.find(item => item.section === 'footer' && item.champ === 'email');
    const contactEmailLink = document.querySelector('.main-footer .footer-content a[href^="mailto:"]');
    if (contactEmailLink && footerEmailConfig) {
      contactEmailLink.href = `mailto:${footerEmailConfig.valeur}`;
      contactEmailLink.textContent = footerEmailConfig.valeur;
      console.log(`[DEBUG] Email du footer mis à jour: ${contactEmailLink.textContent}`);
    } else {
      console.warn("[WARN] Lien email du footer ou configuration email manquante.");
    }

    const footerFacebookConfig = globalConfig.find(item => item.section === 'footer' && item.champ === 'facebook');
    const footerInstagramConfig = globalConfig.find(item => item.section === 'footer' && item.champ === 'instagram');
    const footerYouTubeConfig = globalConfig.find(item => item.section === 'footer' && item.champ === 'youtube');
    
    const socialLinks = document.querySelectorAll('.social-links a');
    socialLinks.forEach(link => {
      const ariaLabel = link.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.includes('Facebook') && footerFacebookConfig) {
        link.href = footerFacebookConfig.valeur;
        console.log(`[DEBUG] Lien Facebook mis à jour: ${link.href}`);
      } else if (ariaLabel && ariaLabel.includes('Instagram') && footerInstagramConfig) {
        link.href = footerInstagramConfig.valeur;
        console.log(`[DEBUG] Lien Instagram mis à jour: ${link.href}`);
      } else if (ariaLabel && ariaLabel.includes('YouTube') && footerYouTubeConfig) {
        link.href = footerYouTubeConfig.valeur;
        console.log(`[DEBUG] Lien YouTube mis à jour: ${link.href}`);
      }
    });
    console.log("[DEBUG] Configuration globale appliquée.");
  }

  function generateHomeTiles() {
    const tilesGrid = document.getElementById('main-tiles-grid');
    if (!tilesGrid || !pagesData) return;

    tilesGrid.innerHTML = '';
    pagesData.forEach(page => {
      if (!page.id || !page.image || !page.tile_overlay_title || !page.tile_overlay_subtitle) return;

      const tileLink = document.createElement('a');
      tileLink.href = `${page.id}.html`;
      tileLink.classList.add('tile');

      tileLink.innerHTML = `
        <img src="${ASSETS_BASE_URL}images/${page.image}" alt="${page.tile_overlay_title}">
        <div class="overlay">
          <p class="overlay-title">${page.tile_overlay_title}</p>
          <p class="overlay-subtitle">${page.tile_overlay_subtitle}</p>
        </div>
      `;

      tilesGrid.appendChild(tileLink);
    });
  }

  function generatePageContent(pageId) {
    const page = pagesData.find(p => p.id === pageId);
    const contentContainer = document.getElementById('page-content-container');
    const pageMainTitle = document.getElementById('page-main-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    if (!page || !contentContainer || !pageMainTitle || !pageSubtitle) return;

    pageMainTitle.textContent = page.page_title;
    pageSubtitle.textContent = page.page_subtitle;
    contentContainer.innerHTML = '';

      if (page.page_content && page.page_content.length > 0) {
        let descriptionContainer;
        if (pageId === 'soul') {
          // Pour la page Soul, image au-dessus, texte en dessous
          descriptionContainer = document.createElement('div');
          descriptionContainer.classList.add('image-and-text-container');
          if (page.image) {
            const pageImage = document.createElement('img');
            pageImage.src = `${ASSETS_BASE_URL}images/${page.image}`;
            pageImage.alt = `Image principale de la page ${page.page_title}`;
            pageImage.classList.add('page-hero-image');
            descriptionContainer.appendChild(pageImage);
          }
          const textDiv = document.createElement('div');
          textDiv.classList.add('description-text');
          textDiv.style.width = '100%';
          textDiv.style.margin = '0 auto';
          textDiv.style.textAlign = 'justify';
          page.page_content.forEach(pText => {
            const pElement = document.createElement('p');
            pElement.textContent = pText;
            textDiv.appendChild(pElement);
          });
          descriptionContainer.appendChild(textDiv);
          descriptionContainer.style.flexDirection = 'column';
          contentContainer.appendChild(descriptionContainer);
        } else if (pageId === 'cours-de-chant') {
          // Pour la page Cours de chant, image et texte côte à côte
          descriptionContainer = document.createElement('div');
          descriptionContainer.classList.add('image-and-text-container');
          descriptionContainer.style.display = 'flex';
          descriptionContainer.style.flexDirection = 'row';
          descriptionContainer.style.alignItems = 'center';
          descriptionContainer.style.gap = '20px';
          if (page.image) {
            const pageImage = document.createElement('img');
            pageImage.src = `${ASSETS_BASE_URL}images/${page.image}`;
            pageImage.alt = `Image principale de la page ${page.page_title}`;
            pageImage.classList.add('page-hero-image');
            pageImage.style.width = '50%';
            pageImage.style.height = 'auto';
            pageImage.style.objectFit = 'cover';
            descriptionContainer.appendChild(pageImage);
          }
          const textDiv = document.createElement('div');
          textDiv.classList.add('description-text');
          textDiv.style.width = '50%';
          textDiv.style.textAlign = 'justify';
          page.page_content.forEach(pText => {
            const pElement = document.createElement('p');
            pElement.textContent = pText;
            textDiv.appendChild(pElement);
          });
          descriptionContainer.appendChild(textDiv);
          contentContainer.appendChild(descriptionContainer);
        } else if (pageId === 'videos') {
          // Ne pas afficher d'image d'illustration sur la page vidéos
          descriptionContainer = document.createElement('div');
          descriptionContainer.classList.add('image-and-text-container');
          const textDiv = document.createElement('div');
          textDiv.classList.add('description-text');
          textDiv.style.width = '100%';
          textDiv.style.margin = '0 auto';
          textDiv.style.textAlign = 'justify';
          page.page_content.forEach(pText => {
            const pElement = document.createElement('p');
            pElement.textContent = pText;
            textDiv.appendChild(pElement);
          });
          descriptionContainer.appendChild(textDiv);
          descriptionContainer.style.flexDirection = 'column';
          contentContainer.appendChild(descriptionContainer);
        } else {
          // Pour les autres pages, image et texte côte à côte
          descriptionContainer = document.createElement('div');
          descriptionContainer.classList.add('image-and-text-container');
          if (page.image) {
            const pageImage = document.createElement('img');
            pageImage.src = `${ASSETS_BASE_URL}images/${page.image}`;
            pageImage.alt = `Image principale de la page ${page.page_title}`;
            pageImage.classList.add('page-hero-image');
            descriptionContainer.appendChild(pageImage);
          }
          const textDiv = document.createElement('div');
          textDiv.classList.add('description-text');
          page.page_content.forEach(pText => {
            const pElement = document.createElement('p');
            pElement.textContent = pText;
            textDiv.appendChild(pElement);
          });
          descriptionContainer.appendChild(textDiv);
          contentContainer.appendChild(descriptionContainer);
        }
      }

    if (page.display_posts) {
      const postsSection = document.createElement('section');
      postsSection.classList.add('dynamic-posts-section');
      postsSection.innerHTML = '<div id="posts-container"></div>';
      contentContainer.appendChild(postsSection);
      loadAndDisplayPosts(page.tags);
    }
  }

  function convertToEmbedUrl(videoUrl) {
    if (!videoUrl) return '';
    try {
      const url = new URL(videoUrl);
      if (url.hostname === 'youtu.be') {
        return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
      } else if (url.hostname.includes('youtube.com') && url.searchParams.get('v')) {
        return `https://www.youtube.com/embed/${url.searchParams.get('v')}`;
      } else {
        return videoUrl; // fallback
      }
    } catch {
      return videoUrl;
    }
  }

  function loadAndDisplayPosts(pageTags) {
    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) return;

    if (!postsData || postsData.length === 0) {
      postsContainer.innerHTML = '<p>Aucun post disponible pour le moment.</p>';
      return;
    }

    const filteredPosts = postsData.filter(post =>
      post.tags && pageTags.some(tag => post.tags.includes(tag))
    );

    if (filteredPosts.length === 0) {
      postsContainer.innerHTML = '<p>Aucun post pertinent pour cette section pour le moment.</p>';
      return;
    }

    filteredPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    postsContainer.innerHTML = '';

    filteredPosts.forEach(post => {
      const postElement = document.createElement('article');
      postElement.classList.add('blog-post');

      let mediaContent = '';
      if (post.image) {
        mediaContent = `<img src="${ASSETS_BASE_URL}images/${post.image}" alt="${post.title}">`;
      } else if (post.video_url) {
        const embedUrl = convertToEmbedUrl(post.video_url);
        mediaContent = `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
      }

      const postHTML = `
        <h3>${post.title}</h3>
        <div class="post-wrapper">
          <div class="media">${mediaContent}</div>
          <div class="text-content">
            <p class="post-date">${new Date(post.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p>${post.content}</p>
          </div>
        </div>
      `;

      postElement.innerHTML = postHTML;
      postsContainer.appendChild(postElement);
    });
  }

  async function init() {
    globalConfig = await fetchJson('global_config.json');
    pagesData = await fetchJson('pages.json');
    partitionsData = await fetchJson('partitions.json');
    postsData = await fetchJson('posts.json');

    if (!globalConfig || !pagesData || !postsData) {
      document.body.innerHTML = '<p style="color: red;">Erreur lors du chargement des données du site.</p>';
      return;
    }

    applyGlobalConfig();

    const currentPagePath = window.location.pathname.split('/').pop();
    if (currentPagePath === '' || currentPagePath === 'index.html') {
      generateHomeTiles();
    } else {
      const pageId = currentPagePath.replace('.html', '');
      generatePageContent(pageId);
    }
  }

  init();
});

const styleSheet = document.createElement("style")
styleSheet.innerText = `
.blog-post {
  margin-bottom: 20px;
  border: 1px solid #ccc;
  padding: 10px;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
}
.blog-post .post-wrapper {
  display: flex;
  align-items: stretch;
}
.blog-post .media {
  flex: 1;
}
.blog-post .text-content {
  flex: 2;
  padding-left: 20px;
  text-align: justify;
}
.blog-post img,
.blog-post iframe {
  max-width: 100%;
  height: auto;
  filter: grayscale(100%);
}
.blog-post h3 {
  margin: 0 0 10px 0;
}
.post-date {
  font-size: 0.85rem;
  color: #777;
  margin-bottom: 15px;
}
`;
document.head.appendChild(styleSheet);
