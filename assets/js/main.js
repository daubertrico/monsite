document.addEventListener('DOMContentLoaded', () => {
  // --- CONFIURATION GLOBALE ---
  // URL de base pour les assets (images) et les données JSON
  const ASSETS_BASE_URL = 'assets/'; // <-- C'est ça la correction : pointe vers le dossier 'assets/'
  const DATA_BASE_URL = 'data/';

  // Variables pour stocker les données chargées
  let globalConfig = null;   // Contient les données de global_config.json
  let pagesData = null;      // Contient les données de pages.json
  let partitionsData = null; // Contient les données de partitions.json
  let postsData = null;      // Contient les données de posts.json

  // --- FONCTIONS UTILITAIRES ---

  /**
   * Charge un fichier JSON de manière asynchrone.
   * @param {string} filename Le nom du fichier JSON à charger (ex: 'global_config.json').
   * @returns {Promise<Object|null>} Une promesse qui résout avec les données JSON parsées, ou null en cas d'échec.
   */
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
      return null; // Retourne null en cas d'échec de chargement
    }
  }


  /**
   * Applique la configuration globale du site au header et au footer.
   * Nécessite que globalConfig soit chargé.
   */
  function applyGlobalConfig() {
    if (!globalConfig || globalConfig.length === 0) {
      console.warn("[WARN] Configuration globale non chargée ou vide. Impossible d'appliquer le thème.");
      return;
    }

    console.log("[DEBUG] Application de la configuration globale...");

    // --- Mise à jour du HEADER ---

    const siteTitleConfig = globalConfig.find(item => item.section === 'head' && item.champ === 'site_title');
    if (siteTitleConfig) {
      document.title = siteTitleConfig.valeur;
      console.log(`[DEBUG] Titre du document mis à jour: ${document.title}`);
    }

    const logoUrlConfig = globalConfig.find(item => item.section === 'head' && item.champ === 'logo_url');
    const siteLogo = document.querySelector('.site-logo');
    if (siteLogo && logoUrlConfig) {
      // Le logo est un cas particulier, son chemin complet est dans global_config.json,
      // donc nous ne préfixons PAS avec ASSETS_BASE_URL pour lui.
      // Si le logo est bien dans assets/images/logo.png et que global_config.json a "assets/images/logo.png"
      // alors c'est direct.
      siteLogo.src = logoUrlConfig.valeur;
      siteLogo.alt = `Logo ${siteTitleConfig ? siteTitleConfig.valeur : 'La Voix Libre'}`;
      console.log(`[DEBUG] Logo du site mis à jour: ${siteLogo.src}`);
    } else {
      console.warn("[WARN] Logo du site (.site-logo) ou configuration du logo manquante.");
    }

    // Les titres h1 et subtitle du header sont gérés par generatePageContent pour les pages internes
    // et par le HTML statique pour index.html, puis mis à jour si nécessaire par applyGlobalConfig
    // C'est déjà géré dans init() pour index.html

    // --- Mise à jour du FOOTER ---

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


  // --- FONCTIONS DE GÉNÉRATION DE CONTENU ---

  /**
   * Génère et affiche les tuiles sur la page d'accueil (index.html).
   * Nécessite que pagesData soit chargé.
   */
  function generateHomeTiles() {
    console.log("[DEBUG] Génération des tuiles de la page d'accueil...");

    const tilesGrid = document.getElementById('main-tiles-grid');
    if (!tilesGrid || !pagesData) {
      console.error("[ERREUR] Conteneur de tuiles (#main-tiles-grid) ou données de pages (pagesData) manquants.");
      return;
    }

    tilesGrid.innerHTML = ''; // Vide le conteneur

    pagesData.forEach(page => {
      if (!page.id || !page.image || !page.tile_overlay_title || !page.tile_overlay_subtitle) {
        console.warn(`[WARN] Données incomplètes pour une tuile, sautée:`, page);
        return;
      }

      const tileLink = document.createElement('a');
      tileLink.href = `${page.id}.html`;
      tileLink.classList.add('tile');

      const tileImage = document.createElement('img');
      // Assurez-vous que page.image est "images/nom_image.jpg"
      tileImage.src = `${ASSETS_BASE_URL}images/${page.image}`; // <-- CORRECTION ICI pour les tuiles
      tileImage.alt = page.tile_overlay_title;

      const overlayDiv = document.createElement('div');
      overlayDiv.classList.add('overlay');

      const overlayTitle = document.createElement('p');
      overlayTitle.classList.add('overlay-title');
      overlayTitle.textContent = page.tile_overlay_title;

      const overlaySubtitle = document.createElement('p');
      overlaySubtitle.classList.add('overlay-subtitle');
      overlaySubtitle.textContent = page.tile_overlay_subtitle;

      overlayDiv.appendChild(overlayTitle);
      overlayDiv.appendChild(overlaySubtitle);

      tileLink.appendChild(tileImage);
      tileLink.appendChild(overlayDiv);

      tilesGrid.appendChild(tileLink);
      console.log(`[DEBUG] Tuile ajoutée pour: ${page.id}`);
    });

    console.log("[DEBUG] Génération des tuiles terminée.");
  }


  /**
   * Génère le contenu spécifique d'une page intérieure.
   * @param {string} pageId L'ID de la page à générer.
   */
  function generatePageContent(pageId) {
    console.log(`[DEBUG] Génération du contenu pour la page: ${pageId}.`);
    const page = pagesData.find(p => p.id === pageId);
    const contentContainer = document.getElementById('page-content-container');
    const pageMainTitle = document.getElementById('page-main-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    if (!page || !contentContainer || !pageMainTitle || !pageSubtitle) {
      console.error(`[ERREUR] Contenu non trouvé pour la page ${pageId} ou conteneurs HTML manquants.`);
      if (contentContainer) {
        contentContainer.innerHTML = '<p>Désolé, le contenu de cette page n\'est pas disponible ou les éléments HTML nécessaires sont manquants.</p>';
      }
      return;
    }
    console.log(`[DEBUG] Page '${pageId}' trouvée dans pagesData.`);

    // Mettre à jour les titres dans le header de la page spécifique
    pageMainTitle.textContent = page.page_title;
    pageSubtitle.textContent = page.page_subtitle;
    console.log(`[DEBUG] Titres de la page mis à jour: ${page.page_title} / ${page.page_subtitle}`);

    // Efface tout contenu HTML préexistant dans le conteneur principal
    contentContainer.innerHTML = '';
    console.log("[DEBUG] Conteneur de contenu vidé.");

    // Gérer la page "partitions" avec protection par mot de passe
    if (pageId === 'partitions' && page.is_protected) {
      console.log("[DEBUG] Page 'partitions' détectée, affichage du formulaire de mot de passe.");
      renderPasswordProtectedSection(contentContainer, page);
      return; // Arrête la génération normale de contenu
    }

    // --- Ajout du contenu textuel principal de la page ---
    if (page.page_content && page.page_content.length > 0) {
      const descriptionContainer = document.createElement('div');
      descriptionContainer.classList.add('image-and-text-container');

      if (page.image) {
        const pageImage = document.createElement('img');
        // Assurez-vous que page.image est "images/nom_image.jpg"
        pageImage.src = `${ASSETS_BASE_URL}images/${page.image}`;
        pageImage.alt = `Image principale de la page ${page.page_title}`;
        pageImage.classList.add('page-hero-image');
        descriptionContainer.appendChild(pageImage);
        console.log(`[DEBUG] Image de la page ajoutée: ${page.image}`);
      } else {
        console.log(`[DEBUG] Pas d'image définie pour la page ${pageId}.`);
      }

      const textDiv = document.createElement('div');  // Création du div pour le texte
      textDiv.classList.add('description-text');       // Ajout de la classe CSS

      page.page_content.forEach(pText => {
        const pElement = document.createElement('p');
        pElement.textContent = pText;
        textDiv.appendChild(pElement);                 // Ajout du paragraphe au div
      });
      descriptionContainer.appendChild(textDiv);            // Ajout du div au conteneur principal

      contentContainer.appendChild(descriptionContainer)
      console.log(`[DEBUG ${page.page_content.length} paragraphes de contenu principal ajoutés.`);
    } else {
      console.log(`[DEBUG] Pas de 'page_content' défini pour la page ${pageId}.`);
    }

    // --- Ajout des éléments de contenu spécifiques (listes, audio, vidéo) ---
    if (page.specific_content && page.specific_content.length > 0) {
      console.log(`[DEBUG] ${page.specific_content.length} éléments de contenu spécifique trouvés.`);
      page.specific_content.forEach((item, index) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.classList.add('specific-content-section');

        if (item.title) {
          const titleElement = document.createElement('h3');
          titleElement.textContent = item.title;
          sectionDiv.appendChild(titleElement);
        }

        if (item.type === 'list' && item.items) {
          const ulElement = document.createElement('ul');
          item.items.forEach(listItem => {
            const liElement = document.createElement('li');
            liElement.textContent = listItem;
            ulElement.appendChild(liElement);
          });
          sectionDiv.appendChild(ulElement);
          console.log(`[DEBUG Ajout d'une liste (specific_content #${index}).`);
        } else if (item.type === 'audio' && item.url) {
          const audioEmbed = document.createElement('iframe');
          audioEmbed.setAttribute('width', '100%');
          audioEmbed.setAttribute('height', '166');
          audioEmbed.setAttribute('scrolling', 'no');
          audioEmbed.setAttribute('frameborder', 'no');
          audioEmbed.setAttribute('allow', 'autoplay');
          const embedUrl = item.url.includes('soundcloud.com/') ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(item.url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true` : item.url;
          audioEmbed.src = embedUrl;
          sectionDiv.appendChild(audioEmbed);
          console.log(`[DEBUG] Ajout d'un embed audio (specific_content #${index}).`);
        } else if (item.type === 'video' && item.url) {
          const videoEmbed = document.createElement('iframe');
          videoEmbed.setAttribute('width', '100%');
          videoEmbed.setAttribute('height', '315');
          videoEmbed.setAttribute('src', item.url.replace('watch?v=', 'embed/'));
          videoEmbed.setAttribute('frameborder', '0');
          videoEmbed.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
          videoEmbed.setAttribute('allowfullscreen', '');
          sectionDiv.appendChild(videoEmbed);
          console.log(`[DEBUG] Ajout d'un embed vidéo (specific_content #${index}).`);
        } else if (item.type === 'paragraph' && item.text) {
          const pElement = document.createElement('p');
          pElement.textContent = item.text;
          sectionDiv.appendChild(pElement);
          console.log(`[DEBUG] Ajout d'un paragraphe (specific_content #${index}).`);
        } else {
          console.warn(`[WARN] Type de contenu spécifique non reconnu ou incomplet pour l'élément #${index}:`, item);
        }

        contentContainer.appendChild(sectionDiv);
      });
    } else {
      console.log(`[DEBUG] Pas de 'specific_content' défini pour la page ${pageId}.`);
    }

    // --- Section pour les posts dynamiques ---
    if (page.display_posts) {
      console.log(`[DEBUG] La page '${pageId}' demande l'affichage des posts.`);
      const postsSection = document.createElement('section');
      postsSection.classList.add('dynamic-posts-section');
      postsSection.innerHTML = '<h2>Actualités et Articles</h2><div id="posts-container"></div>';
      contentContainer.appendChild(postsSection);
      loadAndDisplayPosts(page.tags);
    } else {
      console.log(`[DEBUG] La page '${pageId}' ne demande pas l'affichage des posts.`);
    }

    console.log(`[DEBUG] Génération du contenu pour la page '${pageId}' terminée.`);
  }


  /**
   * Charge et affiche les posts filtrés par les tags de la page actuelle.
   * @param {string[]} pageTags Les tags associés à la page actuelle pour le filtrage.
   */
  function loadAndDisplayPosts(pageTags) {
    console.log(`[DEBUG] Chargement et affichage des posts avec tags: ${pageTags.join(', ')}.`);

    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) {
      console.error("[ERREUR] Conteneur des posts (#posts-container) manquant.");
      return;
    }

    if (!postsData || postsData.length === 0) {
      postsContainer.innerHTML = '<p>Aucun post disponible pour le moment.</p>';
      console.warn("[WARN] postsData est vide ou non chargé.");
      return;
    }

    const filteredPosts = postsData.filter(post =>
      post.tags && pageTags.some(pageTag => post.tags.includes(pageTag))
    );

    console.log(`[DEBUG] ${filteredPosts.length} posts trouvés après filtrage.`);

    if (filteredPosts.length === 0) {
      postsContainer.innerHTML = '<p>Aucun post pertinent pour cette section pour le moment.</p>';
      return;
    }

    filteredPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    postsContainer.innerHTML = ''; // Nettoyer le conteneur

    filteredPosts.forEach(post => {
      if (!post.id || !post.title || !post.date || !post.content) {
        console.warn(`[WARN] Post incomplet, sautée:`, post);
        return;
      }

      const postElement = document.createElement('article');
      postElement.classList.add('blog-post');

      let postHTML = `
        <h3>${post.title}</h3>
        <p class="post-date">${new Date(post.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      `;

      if (post.image) {
        // Assurez-vous que post.image est "images/nom_image.jpg"
        postHTML += `<img src="${ASSETS_BASE_URL}images/${post.image}" alt="${post.title}" class="post-image">`; // <-- CORRECTION ICI pour les posts
      }

      postHTML += `<p>${post.content}</p>`;

      if (post.video_url) {
        postHTML += `
          <div class="post-video-embed">
            <iframe width="100%" height="315" src="${post.video_url.replace('watch?v=', 'embed/')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>
        `;
      }

      postElement.innerHTML = postHTML;
      postsContainer.appendChild(postElement);
      console.log(`[DEBUG] Post '${post.title}' ajouté.`);
    });

    console.log("[DEBUG] Affichage des posts terminé.");
  }


  // --- Fonctions spécifiques à la page Partitions ---

  /**
   * Rend la section protégée par mot de passe pour la page partitions.
   * @param {HTMLElement} container Le conteneur où rendre le formulaire.
   * @param {Object} page L'objet page contenant les détails de la partition.
   */
  function renderPasswordProtectedSection(container, page) {
    console.log("[DEBUG] Rendu de la section protégée par mot de passe.");

    const passwordForm = document.createElement('div');
    passwordForm.classList.add('password-form-container');
    passwordForm.innerHTML = `
      <h2>${page.page_title}</h2>
      <p>${page.page_subtitle}</p>
      <p>${page.page_content ? page.page_content.join('<br>') : ''}</p>
      <div class="password-input-group">
        <label for="password-input">Mot de passe :</label>
        <input type="password" id="password-input" placeholder="Entrez le mot de passe">
        <button id="password-submit">Accéder</button>
      </div>
      <p id="password-message" style="color: red; margin-top: 10px;"></p>
    `;
    container.appendChild(passwordForm);

    const passwordInput = document.getElementById('password-input');
    const passwordSubmit = document.getElementById('password-submit');
    const passwordMessage = document.getElementById('password-message');
    const correctPassword = page.password; // Récupère le mot de passe depuis les données de la page

    if (!passwordInput || !passwordSubmit || !passwordMessage || !correctPassword) {
      console.error("[ERREUR] Éléments du formulaire de mot de passe manquants ou mot de passe non défini.");
      passwordForm.innerHTML = '<p style="color: red;">Erreur: Impossible de charger le formulaire d\'accès.</p>';
      return;
    }

    passwordSubmit.addEventListener('click', () => {
      if (passwordInput.value === correctPassword) {
        console.log("[DEBUG] Mot de passe correct. Affichage des partitions.");
        passwordMessage.textContent = '';
        passwordForm.remove();
        renderPartitionsTable(container);
      } else {
        console.warn("[WARN] Mot de passe incorrect.");
        passwordMessage.textContent = 'Mot de passe incorrect. Veuillez réessayer.';
      }
    });

    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        passwordSubmit.click();
      }
    });
  }


  /**
   * Rend le tableau des partitions après une authentification réussie.
   * @param {HTMLElement} container Le conteneur où rendre le tableau.
   *
   */
  function renderPartitionsTable(container) {
    console.log("[DEBUG] Rendu du tableau des partitions.");

    if (!partitionsData || partitionsData.length === 0) {
      container.innerHTML = '<p>Aucune partition disponible pour le moment.</p>';
      console.warn("[WARN] partitionsData est vide ou non chargé.");
      return;
    }

    const tableContainer = document.createElement('div');
    tableContainer.classList.add('partitions-table-wrapper'); // Pour le défilement horizontal sur mobile
    tableContainer.innerHTML = `
      <table class="partitions-table">
        <thead>
          <tr>
            <th data-sort="title_partition">Titre Partition</th>
            <th data-sort="atelier">Atelier</th>
            <th data-sort="description">Description</th>
            <th>PDF</th>
            <th>Audio</th>
            <th>MuseScore</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    container.appendChild(tableContainer);

    const tbody = tableContainer.querySelector('.partitions-table tbody');
    renderTableRows(tbody, partitionsData); // Affiche les lignes initiales

    const headers = tableContainer.querySelectorAll('.partitions-table th[data-sort]');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const sortKey = header.dataset.sort;
        const currentOrder = header.dataset.order === 'asc' ? 'desc' : 'asc';

        headers.forEach(h => {
          if (h !== header) {
            h.removeAttribute('data-order');
          }
        });

        const sortedData = [...partitionsData].sort((a, b) => {
          const valA = String(a[sortKey] || '').toLowerCase(); // Gérer les valeurs null/undefined
          const valB = String(b[sortKey] || '').toLowerCase();

          if (valA < valB) return currentOrder === 'asc' ? -1 : 1;
          if (valA > valB) return currentOrder === 'asc' ? 1 : -1;
          return 0;
        });

        header.dataset.order = currentOrder;
        renderTableRows(tbody, sortedData);
        console.log(`[DEBUG] Tableau trié par '${sortKey}' en ordre ${currentOrder}.`);
      });
    });
  }


  /**
   * Génère les lignes du tableau des partitions.
   * @param {HTMLElement} tbody L'élément <tbody> du tableau.
   * @param {Object[]} data Les données des partitions à afficher.
   */
  function renderTableRows(tbody, data) {
    tbody.innerHTML = '';

    data.forEach(partition => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${partition.title_partition || 'N/A'}</td>
        <td>${partition.atelier || 'N/A'}</td>
        <td>${partition.description || 'N/A'}</td>
        <td>${partition.lien_pdf ? `<a href="${partition.lien_pdf}" target="_blank" download>PDF</a>` : 'N/A'}</td>
        <td>${partition.lien_audio ? `<a href="${partition.lien_audio}" target="_blank">Audio</a>` : 'N/A'}</td>
        <td>${partition.lien_musescore ? `<a href="https://musescore.com/sheetmusic/embed/${getMusescoreId(partition.lien_musescore)}" target="_blank">MuseScore</a>` : 'N/A'}</td>
      `;
      tbody.appendChild(tr);
    });

    console.log(`[DEBUG] ${data.length} lignes de partitions rendues.`);
  }


  /**
   * Extrait l'ID MuseScore d'une URL d'intégration.
   * @param {string} url L'URL MuseScore.
   * @returns {string} L'ID MuseScore extrait.
   */
  function getMusescoreId(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const scoreIndex = pathParts.indexOf('scores');
      if (scoreIndex !== -1 && pathParts.length > scoreIndex + 1) {
        return pathParts[scoreIndex + 1];
      }
    } catch (e) {
      console.error("[ERREUR] Erreur lors de l'extraction de l'ID MuseScore:", e);
    }
    return '';
  }


  // --- FONCTION D'INITIALISATION PRINCIPALE ---

  async function init() {
    console.log("[DEBUG] Démarrage de l'initialisation du site.");

    // Chargement de toutes les données JSON
    globalConfig = await fetchJson('global_config.json');
    pagesData = await fetchJson('pages.json');
    partitionsData = await fetchJson('partitions.json');
    postsData = await fetchJson('posts.json');

    // Vérification du succès du chargement des données
    if (!globalConfig || !pagesData || !postsData) { // partitionsData n'est pas critique pour toutes les pages
      console.error("[ERREUR FATALE] Échec du chargement des données essentielles. Le site pourrait ne pas fonctionner correctement. Veuillez vérifier les chemins des fichiers JSON et leur contenu.");

      // Afficher un message d'erreur visible si possible
      const mainContent = document.querySelector('.main-content') || document.body;
      mainContent.innerHTML = '<p style="color: red; text-align: center; font-size: 1.2rem; margin-top: 50px;">Oups ! Un problème est survenu lors du chargement des données du site. Veuillez consulter la console du navigateur pour plus de détails (F12 > Console).</p>';
      return;
    }

    console.log("[DEBUG] Toutes les données JSON essentielles chargées avec succès.");

    // Appliquer la configuration globale
    applyGlobalConfig();

    // Déterminer la page actuelle
    const currentPagePath = window.location.pathname.split('/').pop();
    console.log(`[DEBUG] Chemin de la page actuelle: ${currentPagePath}`);

    if (currentPagePath === '' || currentPagePath === 'index.html') {
      // C'est la page d'accueil
      console.log("[DEBUG] Page d'accueil détectée. Génération des tuiles.");
      generateHomeTiles();

      // Pour l'accueil, les titres H1/subtitle du header sont déjà définis statiquement
      // et mis à jour par applyGlobalConfig si la config globale les change.
      // On s'assure qu'ils sont bien affichés par défaut si aucune config spécifique n'existe.
      const headerMainTitle = document.querySelector('.site-titles h1');
      const headerSubtitle = document.querySelector('.site-titles .subtitle');
      if (headerMainTitle && headerMainTitle.textContent === '') {
        headerMainTitle.textContent = "La Voix Libre"; // Valeur par défaut
      }
      if (headerSubtitle && headerSubtitle.textContent === '') {
        headerSubtitle.textContent = "Chant, Corps, Esprit"; // Valeur par défaut
      }
    } else {
      // C'est une page intérieure
      const pageId = currentPagePath.replace('.html', '');
      console.log(`[DEBUG] Page intérieure détectée: ${pageId}. Génération du contenu.`);
      generatePageContent(pageId);
    }

    console.log("[DEBUG Initialisation du site terminée.");
  }

  // Lancer l'initialisation quand le DOM est prêt
  init();
});