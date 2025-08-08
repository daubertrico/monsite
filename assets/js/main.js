// Harmonisation des titres dynamiques
function harmoniseTitles() {
  const mainTitle = document.querySelector('.site-titles h1, h1.main-title, #site-title, #page-main-title');
  if (mainTitle && !mainTitle.classList.contains('main-title')) {
    mainTitle.classList.add('main-title');
  }
}

harmoniseTitles();
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

// Utilise PapaParse pour parser correctement le CSV Google Sheets
function loadPapaParse(callback) {
  if (window.Papa) {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';
  script.onload = callback;
  document.head.appendChild(script);
}

async function fetchPostsFromCSV(csvUrl) {
  return new Promise((resolve, reject) => {
    loadPapaParse(() => {
      window.Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          // Nettoyage et conversion des champs
          const posts = results.data.map(post => {
            // Conversion du champ tags en tableau si présent
            if (post.tags) {
              post.tags = post.tags.split(',').map(tag => tag.trim());
            }
            // Conversion du champ videos en tableau si présent
            if (post.videos) {
              try {
                post.videos = JSON.parse(post.videos);
              } catch {
                post.videos = post.videos.split(',').map(v => v.trim()).filter(Boolean);
              }
            }
            return post;
          });
          resolve(posts);
        },
        error: function(err) {
          reject(err);
        }
      });
    });
  });
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
    // Nouvel ordre : Chorale Pop, Soul, Comédie Musicale, Cours de chant, puis le reste
    const desiredOrder = [
      'chorale-pop',
      'soul',
      'comedie-musicale',
      'cours-de-chant'
    ];
    // Ajoute les tuiles principales dans l'ordre
    desiredOrder.forEach(pageId => {
      const page = pagesData.find(p => p.id === pageId);
      if (!page || !page.image || !page.page_title || !page.page_subtitle) return;
      const tileLink = document.createElement('a');
      // Correction pour la tuile Espace choristes
      if (page.id === 'partitions') {
        tileLink.href = 'espace-choristes.html';
      } else {
        tileLink.href = `${page.id}.html`;
      }
      tileLink.classList.add('tile');
      tileLink.innerHTML = `
        <img src="${ASSETS_BASE_URL}images/${page.image}" alt="${page.page_title}">
        <div class="overlay">
          <p class="overlay-title">${page.page_title}</p>
          <p class="overlay-subtitle">${page.page_subtitle}</p>
        </div>
      `;
      tilesGrid.appendChild(tileLink);
    });
    // Ajoute les autres tuiles (événements, vidéos, partitions, etc.) dans l'ordre du JSON
    pagesData.forEach(page => {
      if (desiredOrder.includes(page.id)) return; // déjà affiché
      if (!page.id || !page.page_title || !page.page_subtitle) return;
      const tileLink = document.createElement('a');
      if (page.id === 'partitions') {
        tileLink.href = 'espace-choristes.html';
      } else {
        tileLink.href = `${page.id}.html`;
      }
      tileLink.classList.add('tile');
      if (page.id === 'nous-rejoindre') {
        tileLink.style.background = 'var(--background-light)';
        tileLink.style.display = 'flex';
        tileLink.style.flexDirection = 'column';
        tileLink.style.justifyContent = 'flex-end';
        tileLink.style.alignItems = 'center';
        tileLink.style.position = 'relative';
        tileLink.style.height = '300px';
        tileLink.style.borderRadius = '18px';
        tileLink.style.boxShadow = '0 8px 24px rgba(255,102,153,0.18), 0 2px 12px rgba(0,0,0,0.10)';
        tileLink.style.margin = '0';
        tileLink.style.border = '4px solid var(--accent-color-primary)';
        tileLink.style.transition = 'transform 0.2s, box-shadow 0.2s';
        tileLink.innerHTML = `
          <div class="overlay" style="background:none;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:100%;height:100%;">
            <p class="overlay-title" style="color:var(--accent-color-complementary);font-size:2.6rem;font-family:'Lobster',cursive;font-weight:bold;margin-bottom:0.5rem;letter-spacing:1px;text-shadow:2px 4px 12px rgba(255,102,153,0.18),0 2px 8px rgba(0,0,0,0.10);">${page.tile_overlay_title}! </p>
            <p class="overlay-subtitle" style="opacity:0;transition:opacity 0.3s ease;font-size:1.35rem;color:var(--accent-color-primary);font-weight:bold;text-align:center;">${page.tile_overlay_subtitle}</p>
          </div>
        `;
        // Effet 3D au survol
        tileLink.addEventListener('mouseenter', function() {
          const subtitle = tileLink.querySelector('.overlay-subtitle');
          if (subtitle) subtitle.style.opacity = '0.9';
          tileLink.style.transform = 'scale(1.04) translateY(-8px)';
          tileLink.style.boxShadow = '0 16px 32px rgba(255,102,153,0.22), 0 4px 16px rgba(0,0,0,0.14)';
        });
        tileLink.addEventListener('mouseleave', function() {
          const subtitle = tileLink.querySelector('.overlay-subtitle');
          if (subtitle) subtitle.style.opacity = '0';
          tileLink.style.transform = 'scale(1)';
          tileLink.style.boxShadow = '0 8px 24px rgba(255,102,153,0.18), 0 2px 12px rgba(0,0,0,0.10)';
        });
      } else if (page.image) {
        tileLink.innerHTML = `
          <img src="${ASSETS_BASE_URL}images/${page.image}" alt="${page.page_title}">
          <div class="overlay">
            <p class="overlay-title">${page.page_title}</p>
            <p class="overlay-subtitle">${page.page_subtitle}</p>
          </div>
        `;
      }
      tilesGrid.appendChild(tileLink);
    });
  }

  function generatePageContent(pageId) {
    // Correction : ne pas écraser le contenu statique de la page nous-rejoindre
    if (pageId === 'nous-rejoindre') {
      return;
    }
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
        if (pageId === 'soul' || pageId === 'chorale-pop') {
          // Pour la page Soul et Chorale Pop, image au-dessus, texte en dessous
          descriptionContainer = document.createElement('div');
          descriptionContainer.classList.add('image-and-text-container');
          descriptionContainer.style.display = 'flex';
          descriptionContainer.style.flexDirection = 'column';
          descriptionContainer.style.alignItems = 'stretch';
          descriptionContainer.style.width = '100%';
          if (page.image) {
            const pageImage = document.createElement('img');
            pageImage.src = `${ASSETS_BASE_URL}images/${page.image}`;
            pageImage.alt = `Image principale de la page ${page.page_title}`;
            pageImage.classList.add('page-hero-image');
            pageImage.style.width = '100%';
            pageImage.style.maxWidth = '100%';
            pageImage.style.objectFit = 'cover';
            pageImage.style.borderRadius = '18px';
            pageImage.style.boxShadow = '0 4px 24px rgba(0,0,0,0.13)';
            pageImage.style.transition = 'transform 0.3s';
            pageImage.onmouseover = function() { this.style.transform = 'scale(1.04)'; };
            pageImage.onmouseout = function() { this.style.transform = 'scale(1)'; };
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
          contentContainer.appendChild(descriptionContainer);
        } else if (pageId === 'cours-de-chant') {
          // Pour la page Cours de chant, image et texte côte à côte + infos pratiques + audio + contacts
          descriptionContainer = document.createElement('div');
          descriptionContainer.classList.add('image-and-text-container');
          descriptionContainer.style.display = 'flex';
          descriptionContainer.style.flexDirection = 'row';
        // Sur mobile, forcer l'empilement vertical
        if (window.innerWidth <= 700) {
          descriptionContainer.style.flexDirection = 'column';
          descriptionContainer.style.alignItems = 'stretch';
        }
          descriptionContainer.style.alignItems = 'flex-start';
          descriptionContainer.style.gap = '30px';
          if (page.image) {
            const pageImage = document.createElement('img');
            pageImage.src = `${ASSETS_BASE_URL}images/${page.image}`;
            pageImage.alt = `Image principale de la page ${page.page_title}`;
            pageImage.classList.add('page-hero-image');
            pageImage.style.width = '380px';
            pageImage.style.height = 'auto';
            pageImage.style.objectFit = 'cover';
            pageImage.style.borderRadius = '12px';
            descriptionContainer.appendChild(pageImage);
          }
          const textDiv = document.createElement('div');
          textDiv.classList.add('description-text');
          textDiv.style.width = '100%';
          textDiv.style.textAlign = 'justify';
          page.page_content.forEach(pText => {
            const pElement = document.createElement('p');
            pElement.textContent = pText;
            textDiv.appendChild(pElement);
          });

          // Ajout des infos pratiques (list)
          if (page.specific_content) {
            const listBlock = page.specific_content.find(sc => sc.type === 'list');
            if (listBlock) {
              const ul = document.createElement('ul');
              ul.style.marginTop = '20px';
              ul.style.marginBottom = '20px';
              ul.style.fontWeight = 'bold';
              if (listBlock.title) {
                const listTitle = document.createElement('h4');
                listTitle.textContent = listBlock.title;
                ul.appendChild(listTitle);
              }
              listBlock.items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                ul.appendChild(li);
              });
              textDiv.appendChild(ul);
            }

            // Ajout du portrait audio avec bande colorée et texte explicatif
            const audioBlock = page.specific_content.find(sc => sc.type === 'audio');
            if (audioBlock && audioBlock.url) {
              const audioDiv = document.createElement('div');
              audioDiv.style.margin = '32px 0';
              audioDiv.style.background = 'linear-gradient(90deg, #e0c3fc 0%, #8ec5fc 100%)';
              audioDiv.style.borderRadius = '18px';
              audioDiv.style.padding = '32px 28px';
              audioDiv.style.display = 'flex';
              audioDiv.style.flexDirection = 'column';
              audioDiv.style.alignItems = 'flex-start';
              audioDiv.style.boxShadow = '0 4px 18px rgba(0,0,0,0.12)';
              audioDiv.style.maxWidth = '540px';
              audioDiv.style.width = '100%';
              audioDiv.style.gap = '18px';

              // Texte explicatif
              const audioText = document.createElement('div');
              audioText.style.width = '100%';
              audioText.style.fontSize = '1.08rem';
              audioText.style.lineHeight = '1.6';
              audioText.style.color = '#222';
              audioText.style.marginBottom = '8px';
              audioText.innerHTML = `<h4 style="margin:0 0 10px 0;font-size:1.18rem;color:#222;">${audioBlock.title || 'Portrait audio'}</h4>
                <p style="margin:0;font-size:1.08rem;line-height:1.6;color:#222;">Découvrez la pratique et les méthodes de Vincent à travers ce portrait radiophonique réalisé en 2023 par Marion Lecointre et diffusé sur radio Laser.</p>`;

              // Lien audio
              const audioPlayer = document.createElement('audio');
              audioPlayer.controls = true;
              audioPlayer.src = audioBlock.url;
              audioPlayer.autoplay = true;
              audioPlayer.style.width = '100%';
              audioPlayer.style.marginTop = '8px';
              audioPlayer.style.background = '#fff';
              audioPlayer.style.borderRadius = '12px';
              audioPlayer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';

              // Diagnostic avancé
              audioPlayer.onerror = function(e) {
                const errorMsg = document.createElement('div');
                errorMsg.textContent = "Le fichier audio n'a pas pu être chargé. Vérifiez le chemin, le format ou le serveur.";
                errorMsg.style.color = 'red';
                errorMsg.style.marginTop = '12px';
                audioDiv.appendChild(errorMsg);
                console.error('[AUDIO] Erreur de chargement audio:', e, audioPlayer.src);
              };

              audioPlayer.onplay = function() {
                console.log('[AUDIO] Lecture démarrée avec succès:', audioPlayer.src);
              };

              audioPlayer.oncanplay = function() {
                console.log('[AUDIO] Peut jouer:', audioPlayer.src);
              };

              // Test autoplay avec mute
              setTimeout(() => {
                if (audioPlayer.paused) {
                  audioPlayer.muted = true;
                  audioPlayer.play().then(() => {
                    console.log('[AUDIO] Lecture démarrée en mode mute.');
                    setTimeout(() => {
                      audioPlayer.muted = false;
                      console.log('[AUDIO] Son réactivé.');
                    }, 1000);
                  }).catch((err) => {
                    console.error('[AUDIO] Impossible de démarrer la lecture:', err);
                  });
                }
              }, 500);

              audioDiv.appendChild(audioText);
              audioDiv.appendChild(audioPlayer);
              textDiv.appendChild(audioDiv);

              // Force la lecture audio après le rendu (si autorisé par le navigateur)
              setTimeout(() => {
                if (audioPlayer.paused) {
                  audioPlayer.play().catch(() => {});
                }
              }, 500);
            }

            // Ajout des contacts
            const contactBlock = page.specific_content.find(sc => sc.type === 'contact');
            if (contactBlock) {
              const contactDiv = document.createElement('div');
              contactDiv.style.margin = '20px 0';
              contactDiv.innerHTML = `<strong>Contact :</strong> <a href="mailto:${contactBlock.email}">${contactBlock.email}</a><br>
                <a href="${contactBlock.facebook}" target="_blank">Facebook</a> |
                <a href="${contactBlock.youtube}" target="_blank">YouTube</a>`;
              textDiv.appendChild(contactDiv);
            }
          }

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
      postsContainer.innerHTML = '';
      return;
    }

    let filteredPosts;
    if (!Array.isArray(pageTags) || pageTags.length === 0) {
      // Si aucun tag fourni, afficher tous les posts
      console.warn('[DEBUG] Aucun tag de page fourni à loadAndDisplayPosts, affichage de tous les posts.');
      filteredPosts = postsData;
    } else {
      filteredPosts = postsData.filter(post =>
        post.tags && post.tags.some(tag => pageTags.includes(tag))
      );
      console.log(`[DEBUG] Filtrage des posts avec tags: ${JSON.stringify(pageTags)}. Nombre de posts trouvés: ${filteredPosts.length}`);
    }

    if (filteredPosts.length === 0) {
      postsContainer.innerHTML = '<p style="color:red;">Aucun post à afficher pour ces tags.</p>';
      return;
    }

    filteredPosts.sort((a, b) => new Date(b.date) - new Date(a.date)); // du plus récent au plus ancien
    postsContainer.innerHTML = '';

    filteredPosts.forEach(post => {
      const postElement = document.createElement('article');
      postElement.classList.add('blog-post');

      // Illustrations : image d'abord, puis vidéos
      let illustrations = [];
      if (post.image) {
        illustrations.push({ type: 'image', src: /^https?:\/\//.test(post.image) ? post.image : `${ASSETS_BASE_URL}images/${post.image}` });
      }
      if (Array.isArray(post.videos) && post.videos.length > 0) {
        post.videos.forEach(function(videoObj) {
          let url = typeof videoObj === 'string' ? videoObj : videoObj.url;
          illustrations.push({ type: 'video', src: convertToEmbedUrl(url) });
        });
      } else if (post.video_url) {
        illustrations.push({ type: 'video', src: convertToEmbedUrl(post.video_url) });
      }

      // Build the illustrations column (stacked vertically)
      let illustrationsHTML = illustrations.map(ill =>
        ill.type === 'image'
          ? `<img src="${ill.src}" alt="${post.title}" class="media-illustration">`
          : `<iframe width="100%" height="220" src="${ill.src}" frameborder="0" allowfullscreen class="media-illustration"></iframe>`
      ).join('');

      // Fonction utilitaire pour transformer les URLs en liens cliquables
      function linkify(text) {
        const urlRegex = /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/gi;
        return text.replace(urlRegex, function(url) {
          return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
      }

      // Build the post HTML
      // Affiche date/heure/lieu événement sous le titre si renseigné
      let eventInfo = '';
      if (post.date || post.heure || post.lieu) {
        let dateStr = '';
        if (post.date) {
          // Tente de parser la date, sinon affiche tel quel
          let d = new Date(post.date);
          if (!isNaN(d)) {
            const jours = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
            const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
            dateStr = `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
          } else {
            // Si le format est type 24/06/2025, le parser manuellement
            const match = post.date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (match) {
              const d2 = new Date(`${match[3]}-${match[2]}-${match[1]}`);
              if (!isNaN(d2)) {
                const jours = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
                const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
                dateStr = `${jours[d2.getDay()]} ${d2.getDate()} ${mois[d2.getMonth()]} ${d2.getFullYear()}`;
              } else {
                dateStr = post.date;
              }
            } else {
              dateStr = post.date;
            }
          }
        }
        let heureStr = '';
        if (post.heure) {
          // Ajoute "h" si non présent
          let heure = post.heure.trim();
          if (!heure.endsWith('h')) {
            heure += 'h';
          }
          heureStr = `à ${heure}`;
        }
        let lieuStr = post.lieu ? `- ${post.lieu}` : '';
        eventInfo = `<div class="event-info" style="font-size:1.08rem;color:var(--accent-color-complementary);font-family:'Montserrat',sans-serif;font-weight:500;margin-bottom:8px;">${[dateStr, heureStr, lieuStr].filter(Boolean).join(' ')}</div>`;
      }

      let postHTML = `<h3>${post.title}</h3>`;
      postHTML += eventInfo;
      postHTML += `
        <div class="post-wrapper">
          <div class="media media-vertical">
            ${illustrationsHTML}
          </div>
          <div class="text-content">
            <p>${linkify(post.content)}</p>
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
  // Remplacer le chargement local par le chargement depuis la Google Sheet (CSV)

  postsData = await fetchPostsFromCSV('https://docs.google.com/spreadsheets/d/e/2PACX-1vROQBU3QffdHqtL93jVZOPjcuD0GHs2icQ13rx3-U7xvjASaQQILjk4pbVG7fk1ucFJQJMUI1GwKEy6/pub?output=csv');

  if (!globalConfig || !pagesData) {
    document.body.innerHTML = '<p style="color: red;">Erreur lors du chargement des données du site.</p>';
    return;
  }

  // postsData n'est utilisé que pour l'affichage des posts, ne jamais bloquer le site si absent
  if (!postsData) {
    console.error('[ERREUR POSTS] Impossible de charger les posts depuis le CSV Google Sheets. Les posts ne seront pas affichés.');
    postsData = [];
  }

  applyGlobalConfig();

  const currentPagePath = window.location.pathname.split('/').pop();
  if (currentPagePath === '' || currentPagePath.toLowerCase() === 'index.html') {
    generateHomeTiles();
  } else {
    const pageId = currentPagePath.replace('.html', '').toLowerCase();
    generatePageContent(pageId);
  }
}

init();

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
.blog-post .media.media-vertical {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 33%;
  min-width: 180px;
  max-width: 260px;
}
.blog-post .text-content {
  flex: 1;
  padding-left: 20px;
  text-align: justify;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.blog-post img {
  max-width: 500px;
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  object-fit: cover;
}
.blog-post iframe {
  max-width: 500px;
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
}
.blog-post h3 {
  margin: 0 0 10px 0;
}
// .post-date supprimé : la date d'édition ne s'affiche plus
@media (max-width: 700px) {
  .blog-post .post-wrapper {
    flex-direction: column;
  }
  .blog-post .media.media-vertical {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin-bottom: 12px;
  }
  .blog-post .text-content {
    padding-left: 0;
  }
}
}
`;
document.head.appendChild(styleSheet);
