// Harmonisation des titres dynamiques
function harmoniseTitles() {
  const mainTitle = document.querySelector('.site-titles h1, h1.main-title, #site-title, #page-main-title');
  if (mainTitle && !mainTitle.classList.contains('main-title')) {
    mainTitle.classList.add('main-title');
  }
}

harmoniseTitles();
// --- Meta Pixel (Facebook) initialization ---
(function(){
  const META_PIXEL_ID = '500759717292574';
  try {
    if (!window.fbq) {
      (function(f,b,e,v,n,t,s){if(f.fbq) return; n=f.fbq=function(){n.callMethod? n.callMethod.apply(n,arguments):n.queue.push(arguments)}; if(!f._fbq) f._fbq=n; n.push=n; n.loaded=!0; n.version='2.0'; n.queue=[]; t=b.createElement(e); t.async=!0; t.src=v; s=b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t,s)})(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    }
  } catch (e) { console.warn('Meta Pixel load failed', e); }
  try { if (window.fbq) { fbq('init', META_PIXEL_ID); fbq('track', 'PageView'); console.info('[Pixel] PageView sent'); } } catch (e) { console.warn('Meta Pixel init/track failed', e); }
})();
const ASSETS_BASE_URL = 'assets/';
const DATA_BASE_URL = 'data/';
let globalConfig = null;
let pagesData = null;
let partitionsData = null;
let postsData = null;

// Helpers: current page id and utility mapping
function getCurrentPageId() {
  const currentPagePath = window.location.pathname.split('/').pop();
  if (currentPagePath === '' || currentPagePath.toLowerCase() === 'index.html') return 'index';
  const id = currentPagePath.replace('.html', '').toLowerCase();
  // Normalise l'espace choristes vers l'ID logique 'partitions' (pour nav active et titres dynamiques)
  if (id === 'espace-choristes') return 'partitions';
  return id;
}

// Track Meta Pixel Lead on tryout form submit clicks for specific pages
(function(){
  try {
    const pageId = getCurrentPageId();
    const trackOn = ['chorale-pop', 'nous-rejoindre'];
    if (!trackOn.includes(pageId)) return;
    // Delegate click on the document to catch dynamically inserted buttons
    document.addEventListener('click', function(e){
      const target = e.target;
      if (!target) return;
      // match the tryout submit button by id
      if (target.id === 'egm-submit' || target.closest && target.closest('#egm-submit')) {
        try { if (window.fbq) { fbq('track', 'Lead'); console.info('[Pixel] Lead sent'); } } catch (err) { console.warn('fbq track Lead failed', err); }
      }
    }, { capture: true });
    // Central Google Ads conversion tracking for successful tryout submissions
    // Fires once per page view when a tryout is confirmed.
    try {
      let _googleConversionTracked = false;
      function trackGoogleConversionOnce() {
        if (_googleConversionTracked) return;
        _googleConversionTracked = true;
        try { if (typeof gtag === 'function') { gtag('event', 'conversion', { 'send_to': 'AW-928718843/hk9sCNXW2o4bEPu_7LoD' }); console.info('[GTag] conversion sent'); } } catch(e) { console.warn('[GTag] conversion failed', e); }
      }
      // Listen to custom event dispatched by pages after successful submit
      document.addEventListener('tryout:success', trackGoogleConversionOnce);
      // MutationObserver fallback: when #egm-confirm becomes visible, consider it a success
      const obs = new MutationObserver(() => {
        try {
          const cb = document.getElementById('egm-confirm');
          if (cb && cb.style && cb.style.display && cb.style.display !== 'none' && cb.textContent && cb.textContent.trim().length > 0) {
            trackGoogleConversionOnce();
            obs.disconnect();
          }
        } catch(e) {}
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      // Also safe fallback: when click submit triggers, set a small timeout to check for confirmation
      document.addEventListener('click', function(e){
        const t = e.target;
        if (t && (t.id === 'egm-submit' || (t.closest && t.closest('#egm-submit')))) {
          setTimeout(() => {
            const cb = document.getElementById('egm-confirm');
            if (cb && cb.style && cb.style.display && cb.style.display !== 'none') trackGoogleConversionOnce();
          }, 800);
        }
      }, { capture: true });
    } catch (e) { console.warn('Google conversion wiring failed', e); }
  } catch (e) { console.warn('Meta Pixel lead wiring failed', e); }
})();

function mapPageIdToHref(id) {
  // Special routing rules
  if (id === 'partitions') return 'espace-choristes.html';
  if (id === 'index') return 'index.html';
  return `${id}.html`;
}

function navLabelForPage(page) {
  // Default to page_title from JSON; apply small overrides to keep legacy labels
  if (!page) return '';
  if (page.id === 'videos') return 'Nous entendre';
  if (page.id === 'evenements') return 'Événements/Concerts';
  if (page.page_title) return page.page_title;
  return page.id;
}

function computeNavOrder(pages) {
  // Desired primary order, then the rest as found in JSON
  const desiredOrder = ['chorale-pop', 'soul', 'comedie-musicale', 'cours-de-chant', 'nous-rejoindre', 'evenements', 'videos', 'partitions'];
  // Exclude hidden pages from navigation
  const visiblePages = pages.filter(p => !p.hidden);
  const byId = Object.fromEntries(visiblePages.map(p => [p.id, p]));
  const ordered = desiredOrder.filter(id => byId[id]).map(id => byId[id]);
  const remaining = visiblePages.filter(p => !desiredOrder.includes(p.id));
  return [...ordered, ...remaining];
}

// Dynamic header/nav/footer rendering
function renderHeader(currentPageId) {
  // Ensure header element exists
  let header = document.querySelector('header.main-header');
  if (!header) {
    header = document.createElement('header');
    header.className = 'main-header';
    document.body.insertBefore(header, document.body.firstChild);
  }

  // Build header content with logo and titles placeholders
  const siteTitleCfg = globalConfig?.find(i => i.section === 'head' && i.champ === 'site_title');
  const subTitleCfg = globalConfig?.find(i => i.section === 'head' && i.champ === 'sub_title');
  const logoUrlCfg = globalConfig?.find(i => i.section === 'head' && i.champ === 'logo_url');

  const isHome = currentPageId === 'index';
  const h1Text = isHome ? (siteTitleCfg?.valeur || '') : '';
  const subText = isHome ? (subTitleCfg?.valeur || '') : '';

  const navHTML = isHome ? '' : '<nav class="main-nav" aria-label="Navigation principale">\
    <button class="mobile-menu-toggle" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu">☰</button>\
    <ul class="nav-links" id="main-menu"></ul>\
  </nav>';
  header.innerHTML = `
    <div class="header-content">
      <a href="${mapPageIdToHref('index')}" class="site-logo-link">
  <img src="${logoUrlCfg ? logoUrlCfg.valeur : ''}" alt="Logo ${siteTitleCfg ? siteTitleCfg.valeur : 'La Voix Libre'}" class="site-logo" decoding="async">
      </a>
      <div class="site-titles">
        <h1 id="page-main-title" class="${isHome ? 'main-title' : ''}">${h1Text}</h1>
        <p id="page-subtitle" class="subtitle">${subText}</p>
      </div>
    </div>
    ${navHTML}
  `;
}

function renderNav(currentPageId) {
  const nav = document.querySelector('.main-nav');
  const navList = nav ? nav.querySelector('.nav-links') : null;
  if (!navList || !Array.isArray(pagesData)) return;
  navList.innerHTML = '';
  const items = computeNavOrder(pagesData);
  items.forEach(page => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = mapPageIdToHref(page.id);
    a.textContent = navLabelForPage(page);
    // Active state
    const isActive = (currentPageId === page.id) || (currentPageId === 'index' && page.id === 'index');
    // Ne pas afficher l'onglet de la page courante
    if (isActive) {
      return; // skip
    }
    li.appendChild(a);
    navList.appendChild(li);
  });
  // Contact anchor
  const contactLi = document.createElement('li');
  const contactA = document.createElement('a');
  contactA.href = '#footer';
  contactA.textContent = 'Contact';
  contactLi.appendChild(contactA);
  navList.appendChild(contactLi);

  // Smooth scroll for #footer links
  document.querySelectorAll('a[href="#footer"]').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const footer = document.getElementById('footer');
      if (footer) footer.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Mobile menu toggle behavior
  const toggleBtn = nav ? nav.querySelector('.mobile-menu-toggle') : null;
  if (toggleBtn && nav) {
    const closeMenu = () => {
      nav.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    };
    const openMenu = () => {
      nav.classList.add('open');
      toggleBtn.setAttribute('aria-expanded', 'true');
    };
    const toggleMenu = () => {
      if (nav.classList.contains('open')) closeMenu(); else openMenu();
    };
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });
    // Close when clicking a link (for mobile UX)
    navList.querySelectorAll('a').forEach(a => a.addEventListener('click', () => closeMenu()));
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) closeMenu();
    });
    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
    // Reset on resize to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeMenu();
    });
  }
}

function renderFooter() {
  let footer = document.querySelector('footer.main-footer');
  if (!footer) {
    footer = document.createElement('footer');
    footer.className = 'main-footer';
    footer.id = 'footer';
    document.body.appendChild(footer);
  }
  const emailCfg = globalConfig?.find(i => i.section === 'footer' && i.champ === 'email');
  const fbCfg = globalConfig?.find(i => i.section === 'footer' && i.champ === 'facebook');
  const igCfg = globalConfig?.find(i => i.section === 'footer' && i.champ === 'instagram');
  const ytCfg = globalConfig?.find(i => i.section === 'footer' && i.champ === 'youtube');

  const year = new Date().getFullYear();
  const email = emailCfg?.valeur || 'contact@lavoixlibre.fr';
  footer.innerHTML = `
    <div class="footer-content">
      <p>&copy; ${year} La Voix Libre. Tous droits réservés.</p>
      <p>Contact : <a href="mailto:${email}">${email}</a></p>
      <div class="social-links">
        <a href="${fbCfg?.valeur || '#'}" target="_blank" aria-label="Facebook La Voix Libre">Facebook</a>
        <a href="${igCfg?.valeur || '#'}" target="_blank" aria-label="Instagram La Voix Libre">Instagram</a>
        <a href="${ytCfg?.valeur || '#'}" target="_blank" aria-label="YouTube La Voix Libre">YouTube</a>
      </div>
      <div class="newsletter-link" style="margin-top:10px;">
        <a href="#newsletter" id="newsletter-btn" aria-label="Newsletter La Voix Libre" style="display:inline-flex;align-items:center;text-decoration:none;vertical-align:middle;background:#ff6699;color:#fff;font-family:'Open Sans',Arial,sans-serif;font-size:18px;font-weight:bold;border-radius:6px;padding:8px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.12);transition:background 0.2s,box-shadow 0.2s;cursor:pointer;margin:0 auto;min-height:40px;">
          <span style="display:inline-block;vertical-align:middle;height:24px;width:24px;margin-right:8px;">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="height:24px;width:24px;"><rect x="3" y="5" width="18" height="14" rx="2" fill="#fff"/><path d="M3 7l9 6 9-6" stroke="#ff6699" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span style="color:#fff;font-family:'Open Sans',Arial,sans-serif;font-size:18px;vertical-align:middle;">S'inscrire à la newsletter</span>
        </a>
      </div>
    </div>
  `;

  // Inject popup if not present
  if (!document.getElementById('newsletter-popup')) {
    const popup = document.createElement('div');
    popup.id = 'newsletter-popup';
    popup.style.display = 'none';
    popup.style.position = 'fixed';
    popup.style.top = '0';
    popup.style.left = '0';
    popup.style.width = '100vw';
    popup.style.height = '100vh';
    popup.style.background = 'rgba(0,0,0,0.6)';
    popup.style.zIndex = '9999';
    popup.style.justifyContent = 'center';
    popup.style.alignItems = 'center';
    popup.innerHTML = `
      <div style="background:#fff;padding:32px 24px;border-radius:8px;max-width:420px;width:90%;position:relative;box-shadow:0 4px 24px rgba(0,0,0,0.2);">
        <button id="close-newsletter-popup" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:22px;cursor:pointer;">&times;</button>
        <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSd-z95vEaCKjSXvC3auiEApXopyl3zpRfLEpcS7M5Ktr6Zamw/viewform?embedded=true" width="100%" height="520" frameborder="0" marginheight="0" marginwidth="0" style="border:none;" loading="lazy" referrerpolicy="strict-origin-when-cross-origin">Chargement…</iframe>
      </div>`;
    document.body.appendChild(popup);
  }

  // Wire up open/close handlers (idempotent)
  const btn = document.getElementById('newsletter-btn');
  const popupEl = document.getElementById('newsletter-popup');
  const closeBtn = document.getElementById('close-newsletter-popup');
  if (btn && popupEl) {
    btn.onclick = function(e) { e.preventDefault(); popupEl.style.display = 'flex'; };
  }
  if (closeBtn && popupEl) {
    closeBtn.onclick = function() { popupEl.style.display = 'none'; };
  }
  if (popupEl) {
    popupEl.onclick = function(e) { if (e.target === popupEl) popupEl.style.display = 'none'; };
  }
}

// Ensure header titles reflect the current page (non-index)
function setHeaderTitles(currentPageId) {
  if (!pagesData || currentPageId === 'index') return;
  const page = pagesData.find(p => p.id === currentPageId);
  if (!page) return;
  const h1 = document.getElementById('page-main-title');
  const sub = document.getElementById('page-subtitle');
  if (h1) h1.textContent = page.page_title || '';
  if (sub) sub.textContent = page.page_subtitle || '';
  // Update document.title to include site title if available
  const siteTitleCfg = globalConfig?.find(i => i.section === 'head' && i.champ === 'site_title');
  const siteTitle = siteTitleCfg?.valeur || '';
  if (page.page_title) {
    document.title = siteTitle ? `${page.page_title} – ${siteTitle}` : page.page_title;
  }
}

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
      const imgJpg = `${ASSETS_BASE_URL}images/${page.image}`;
      const imgWebp = imgJpg.replace(/\.[a-zA-Z0-9]+$/, '.webp');
      tileLink.innerHTML = `
        <picture>
          <source srcset="${imgWebp}" type="image/webp">
          <img src="${imgJpg}" alt="${page.page_title}" loading="lazy" decoding="async">
        </picture>
        <div class="overlay">
          <p class="overlay-title">${page.page_title}</p>
          <p class="overlay-subtitle">${page.page_subtitle}</p>
        </div>
      `;
      tilesGrid.appendChild(tileLink);
    });
    // Ajoute les autres tuiles (événements, vidéos, partitions, etc.) dans l'ordre du JSON
    pagesData.forEach(page => {
      if (page.hidden) return; // skip hidden pages from home tiles
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
        const imgJpg2 = `${ASSETS_BASE_URL}images/${page.image}`;
        const imgWebp2 = imgJpg2.replace(/\.[a-zA-Z0-9]+$/, '.webp');
        tileLink.innerHTML = `
          <picture>
            <source srcset="${imgWebp2}" type="image/webp">
            <img src="${imgJpg2}" alt="${page.page_title}" loading="lazy" decoding="async">
          </picture>
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
    // L'espace choristes (partitions) a un contenu spécifique géré dans sa page dédiée
    if (pageId === 'partitions') {
      // Assure les titres dynamiques; le reste est géré par espace-choristes.html
      return;
    }
    const page = pagesData.find(p => p.id === pageId);
    const contentContainer = document.getElementById('page-content-container');
    const pageMainTitle = document.getElementById('page-main-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    console.log('[DEBUG] Appel de generatePageContent pour id :', pageId);
    if (!page) {
      if (contentContainer) {
        contentContainer.innerHTML = '<div style="color:red;font-weight:bold;padding:24px;">Erreur : la page demandée n\'existe pas dans pages.json.<br>Id recherché : <b>' + pageId + '</b></div>';
      }
      console.error('[ERREUR] Objet page non trouvé dans pages.json pour id :', pageId);
      return;
    }
    console.log('[DEBUG] Objet page trouvé :', page);
    if (!contentContainer || !pageMainTitle || !pageSubtitle) {
      document.body.innerHTML = '<div style="color:red;font-weight:bold;padding:24px;">Erreur critique : éléments HTML manquants pour l\'affichage dynamique.<br>Vérifiez la présence de #page-content-container, #page-main-title, #page-subtitle dans le HTML.</div>';
      console.error('[ERREUR] Eléments HTML manquants pour affichage dynamique.');
      return;
    }
    console.log('[DEBUG] Eléments HTML trouvés, injection du contenu...');

    pageMainTitle.textContent = page.page_title;
    pageSubtitle.textContent = page.page_subtitle;
    contentContainer.innerHTML = '';

      if (page.page_content && page.page_content.length > 0) {
        let descriptionContainer;
  if (pageId === 'cours-de-chant') {
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
            const imgJpg = `${ASSETS_BASE_URL}images/${page.image}`;
            const imgWebp = imgJpg.replace(/\.[a-zA-Z0-9]+$/, '.webp');
            const pic = document.createElement('picture');
            pic.innerHTML = `
              <source srcset="${imgWebp}" type="image/webp">
              <img src="${imgJpg}" alt="Image principale de la page ${page.page_title}" class="page-hero-image" loading="lazy" decoding="async" style="width:380px;height:auto;object-fit:cover;border-radius:12px;">
            `;
            descriptionContainer.appendChild(pic);
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
              // Add a clear Tarifs button linking to the Nous rejoindre section
              const tarifsBtn = document.createElement('div');
              tarifsBtn.style.marginTop = '12px';
              tarifsBtn.innerHTML = `<a href="nous-rejoindre.html#cours-de-chant" class="tarifs-cta" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#8844aa;color:#fff;font-weight:700;text-decoration:none;border:2px solid #8844aa;">Tarifs</a>`;
              textDiv.appendChild(tarifsBtn);
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
              audioPlayer.autoplay = false;
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

              // (Autoplay direct retiré pour compatibilité navigateurs; la relance muette ci-dessus suffit.)
            }

            // Lien interne vers page dédiée "cours de chant lyrique à Rennes"
            const internalLink = document.createElement('p');
            internalLink.style.marginTop = '8px';
            internalLink.innerHTML = 'Vous cherchez spécifiquement des <a href="/cours-de-chant-lyrique-rennes.html">cours de chant lyrique à Rennes</a> ? Consultez notre page dédiée.';
            textDiv.appendChild(internalLink);

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
          // Centrage du texte de présentation en l'absence d'illustration
          descriptionContainer.style.display = 'flex';
          descriptionContainer.style.justifyContent = 'center';
          const textDiv = document.createElement('div');
          textDiv.classList.add('description-text');
          textDiv.style.width = '100%';
          textDiv.style.maxWidth = '900px';
          textDiv.style.margin = '0 auto';
          textDiv.style.textAlign = 'center';
          page.page_content.forEach(pText => {
            const pElement = document.createElement('p');
            pElement.textContent = pText;
            textDiv.appendChild(pElement);
          });
          descriptionContainer.appendChild(textDiv);
          descriptionContainer.style.flexDirection = 'column';
          contentContainer.appendChild(descriptionContainer);
  } else if (pageId === 'nous-rejoindre') {
          // Rendu spécifique type "sections" + "faq" pour reproduire l'ancienne page
          descriptionContainer = document.createElement('div');
          descriptionContainer.classList.add('image-and-text-container');
          // Centrage du texte d'introduction en l'absence d'illustration
          descriptionContainer.style.display = 'flex';
          descriptionContainer.style.justifyContent = 'center';
          const textDiv = document.createElement('div');
          textDiv.classList.add('description-text');
          textDiv.style.width = '100%';
          textDiv.style.maxWidth = '900px';
          textDiv.style.margin = '0 auto';
          textDiv.style.textAlign = 'center';
          // Texte d'intro
          if (Array.isArray(page.page_content)) {
            page.page_content.forEach(pText => {
              const pElement = document.createElement('p');
              pElement.textContent = pText;
              textDiv.appendChild(pElement);
            });
          }
          descriptionContainer.appendChild(textDiv);
          contentContainer.appendChild(descriptionContainer);

          // Blocs sections
          const sectionsBlock = page.specific_content && page.specific_content.find(sc => sc.type === 'sections');
          if (sectionsBlock && Array.isArray(sectionsBlock.items)) {
            sectionsBlock.items.forEach(section => {
              const sec = document.createElement('section');
              // If the section provides an explicit anchor in the JSON, set it so it can be targeted by links
              if (section.anchor) sec.id = section.anchor;
              sec.className = 'section';
              // Desktop default: row layout. On small viewports, force column so the
              // illustration stacks above the text (mobile UX requirement).
              sec.style.display = 'flex';
              sec.style.marginBottom = '48px';
              // Use a JS breakpoint so we don't rely only on CSS (some phones report
              // widths slightly above the CSS breakpoint). This preserves the desktop
              // layout while fixing mobile where the text was displayed beside the image.
              if (window.innerWidth <= 900) {
                sec.style.flexDirection = 'column';
                sec.style.alignItems = 'stretch';
                sec.style.gap = '12px';
              } else {
                sec.style.flexDirection = 'row';
                sec.style.alignItems = 'center';
                sec.style.gap = '32px';
              }

              const imgWrap = document.createElement('div');
              imgWrap.style.flex = '1';
              // Default thumbnail sizing for desktop
              imgWrap.style.minWidth = '220px';
              imgWrap.style.maxWidth = '220px';
              imgWrap.style.background = '#f9f9f9';
              imgWrap.style.borderRadius = '12px';
              imgWrap.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              imgWrap.style.padding = '16px';
              imgWrap.style.textAlign = 'center';
              // If on small screens, relax the fixed sizing so the image becomes full-width
              if (window.innerWidth <= 900) {
                imgWrap.style.minWidth = '0';
                imgWrap.style.maxWidth = '100%';
                imgWrap.style.width = '100%';
                imgWrap.style.padding = '0';
                imgWrap.style.boxShadow = 'none';
                imgWrap.style.background = 'transparent';
              }
              if (section.image) {
                const imgJpg = `${ASSETS_BASE_URL}images/${section.image}`;
                const imgWebp = imgJpg.replace(/\.[a-zA-Z0-9]+$/, '.webp');
                const pic = document.createElement('picture');
                pic.innerHTML = `
                  <source srcset="${imgWebp}" type="image/webp">
                  <img src="${imgJpg}" alt="${section.title || ''}" loading="lazy" decoding="async" style="width:220px;height:160px;border-radius:8px;object-fit:cover;display:block;margin:0 auto;">
                `;
                imgWrap.appendChild(pic);
              }

              const right = document.createElement('div');
              right.style.flex = '2';
              if (window.innerWidth <= 900) {
                right.style.width = '100%';
              }
              const h2 = document.createElement('h2');
              h2.style.color = '#8844aa';
              h2.style.fontFamily = "'Lobster',cursive";
              h2.style.fontSize = '2em';
              // Make the section title clickable when a CTA URL is provided in the JSON
              if (section.cta && section.cta.url) {
                const a = document.createElement('a');
                a.href = section.cta.url;
                a.textContent = section.title || '';
                a.style.color = 'inherit';
                a.style.textDecoration = 'none';
                a.setAttribute('aria-label', section.title ? `En savoir plus sur ${section.title}` : 'En savoir plus');
                // Ensure focus styles remain visible for keyboard users
                a.style.outline = 'none';
                a.addEventListener('focus', function() { a.style.textDecoration = 'underline'; });
                a.addEventListener('blur', function() { a.style.textDecoration = 'none'; });
                h2.appendChild(a);
              } else {
                h2.textContent = section.title || '';
              }
              right.appendChild(h2);

              if (section.description) {
                const p = document.createElement('p');
                p.textContent = section.description;
                right.appendChild(p);
              }

              if (Array.isArray(section.details) && section.details.length) {
                const list = document.createElement('p');
                list.innerHTML = section.details.map(d => `<strong>${d.split(':')[0]}:</strong> ${d.split(':').slice(1).join(':').trim()}`).join('<br>');
                right.appendChild(list);
              }

              if (section.newsletter) {
                const nl = document.createElement('p');
                nl.innerHTML = `<a href="#newsletter" style="color:#8844aa;text-decoration:underline;">Abonnez-vous à la newsletter</a> pour être tenu·e au courant.`;
                right.appendChild(nl);
              }

              if (section.contactEmail) {
                const ctaMail = document.createElement('p');
                ctaMail.innerHTML = `Contact : <a href="mailto:${section.contactEmail}" style="color:#8844aa;text-decoration:underline;">${section.contactEmail}</a>`;
                right.appendChild(ctaMail);
              }

              if (section.cta && section.cta.url) {
                const more = document.createElement('a');
                more.href = section.cta.url;
                more.textContent = section.cta.text || 'En savoir plus';
                more.style.color = '#8844aa';
                more.style.textDecoration = 'underline';
                right.appendChild(more);
              }

              // If a Calendly link is provided in the section JSON, render a CTA button
              if (section.calendly) {
                const calButton = document.createElement('div');
                calButton.style.marginTop = '12px';
                calButton.innerHTML = `<a href="${section.calendly}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#3981FF;color:#fff;font-weight:700;text-decoration:none;border:2px solid #3981FF;box-shadow:0 2px 6px rgba(57,129,255,0.2);">Prendre rendez‑vous</a>`;
                right.appendChild(calButton);
              }

              sec.appendChild(imgWrap);
              sec.appendChild(right);
              contentContainer.appendChild(sec);

              // Injecte l'encart d'essai SOUS le titre "Chorale Pop", pleine largeur (de la photo au texte)
              try {
                const title = (section.title || '').toLowerCase();
                const ctaUrl = (section.cta && section.cta.url) ? (section.cta.url || '').toLowerCase() : '';
                // Detect the chorale section without relying on an exact title string.
                // Accept titles containing 'chorale' or CTA URLs referencing the chorale page.
                const isChoraleSection = title.includes('chorale') || ctaUrl.includes('chorale-pop') || ctaUrl.includes('chorale');
                if (isChoraleSection) {
                  // Reconfigure le conteneur en grille pour permettre des éléments pleine largeur
                  // Switch to a grid layout on wider screens so the CTA can span full width.
                  if (window.innerWidth > 900) {
                    sec.style.display = 'grid';
                    sec.style.gridTemplateColumns = 'minmax(260px,1fr) 2fr';
                    sec.style.alignItems = 'start';
                    sec.style.gap = '16px';
                  } else {
                    // On small screens keep column stacking and let the CTA be full width naturally
                    sec.style.display = 'flex';
                    sec.style.flexDirection = 'column';
                    sec.style.alignItems = 'stretch';
                    sec.style.gap = '12px';
                  }

                  // Déplace le titre pour qu'il soit pleine largeur
                  if (right && right.contains(h2)) {
                    right.removeChild(h2);
                    h2.style.gridColumn = '1 / -1';
                    h2.style.marginBottom = '8px';
                    sec.insertBefore(h2, sec.firstChild);
                  }

                  // Crée l'encart CTA en pleine largeur juste sous le titre
                  const cta = document.createElement('div');
                  cta.style.gridColumn = '1 / -1';
                  cta.style.width = '100%';
                  cta.style.margin = '6px 0 10px 0';
                  cta.style.padding = '14px 18px';
                  cta.style.border = '1px solid #b6e0fe';
                  cta.style.background = '#eaf6ff';
                  cta.style.borderRadius = '12px';
                  cta.style.boxShadow = '0 2px 10px #3981FF22';
                  cta.style.display = 'flex';
                  cta.style.alignItems = 'center';
                  cta.style.flexWrap = 'wrap';
                  cta.innerHTML = '<span>🎶 Envie de chanter ? Inscrivez‑vous</span> <a href="chorale-pop.html#tryout" style="display:inline-block;margin-left:12px;padding:10px 14px;border-radius:10px;background:#3981FF;color:#fff;font-weight:700;text-decoration:none;border:2px solid #3981FF;box-shadow:0 2px 6px #3981FF33;">Séance d’essai gratuite</a>';
                  // Insère le CTA juste après le titre
                  if (sec.firstChild && sec.firstChild.tagName && sec.firstChild.tagName.toLowerCase() === 'h2') {
                    sec.insertBefore(cta, sec.children[1] || null);
                  } else {
                    sec.insertBefore(cta, sec.firstChild);
                  }
                }
              } catch {}
            });
          }

          // FAQ
          const faqBlock = page.specific_content && page.specific_content.find(sc => sc.type === 'faq');
          if (faqBlock && Array.isArray(faqBlock.items) && faqBlock.items.length) {
            const faq = document.createElement('section');
            faq.className = 'faq';
            faq.style.marginTop = '48px';
            faq.style.textAlign = 'center';
            const h2 = document.createElement('h2');
            h2.textContent = faqBlock.title || 'Questions fréquentes';
            h2.style.color = '#8844aa';
            h2.style.fontFamily = "'Lobster',cursive";
            h2.style.fontSize = '2em';
            faq.appendChild(h2);
            const ul = document.createElement('ul');
            ul.style.display = 'inline-block';
            ul.style.textAlign = 'left';
            faqBlock.items.forEach(item => {
              const li = document.createElement('li');
              li.textContent = item;
              ul.appendChild(li);
            });
            faq.appendChild(ul);
            contentContainer.appendChild(faq);
          }

        } else {
          // Pour Soul, Chorale Pop et autres pages, image et texte côte à côte
          descriptionContainer = document.createElement('div');
          descriptionContainer.classList.add('image-and-text-container');
          if (page.image) {
            const imgJpg = `${ASSETS_BASE_URL}images/${page.image}`;
            const imgWebp = imgJpg.replace(/\.[a-zA-Z0-9]+$/, '.webp');
            const pic = document.createElement('picture');
            pic.innerHTML = `
              <source srcset="${imgWebp}" type="image/webp">
              <img src="${imgJpg}" alt="Image principale de la page ${page.page_title}" class="page-hero-image" loading="lazy" decoding="async">
            `;
            descriptionContainer.appendChild(pic);
          }
          const textDiv = document.createElement('div');
          textDiv.classList.add('description-text');
          page.page_content.forEach(pText => {
            const pElement = document.createElement('p');
            pElement.textContent = pText;
            textDiv.appendChild(pElement);
          });
          // (Suppression du lien SEO contextuel sur la page Chorale Pop)
          descriptionContainer.appendChild(textDiv);
          contentContainer.appendChild(descriptionContainer);
        }
      }

    if (page.display_posts) {
      const postsSection = document.createElement('section');
      postsSection.classList.add('dynamic-posts-section');
      postsSection.innerHTML = '<div id="posts-container"></div>';
      // If this is the SOUL page, inject the audition embed BEFORE the posts
      if (pageId === 'soul') {
        try {
          const auditionWrapper = document.createElement('div');
          auditionWrapper.style.maxWidth = '900px';
          auditionWrapper.style.margin = '0 auto 18px auto';
          auditionWrapper.style.borderRadius = '10px';
          auditionWrapper.style.overflow = 'hidden';
          auditionWrapper.style.border = '1px solid #e8e8f2';
          auditionWrapper.style.boxShadow = '0 6px 18px rgba(0,0,0,0.06)';
          auditionWrapper.innerHTML = `
            <div style="background:#fff;padding:8px 12px;">
              <div style="width:100%;">
                <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSd7L0GtI9ctgS8gN6phoIAnC-hC0ZvDhNRKeJ-UyvQqLHIMsg/viewform?embedded=true" width="100%" height="1400" frameborder="0" marginheight="0" marginwidth="0" style="display:block;width:100%;min-height:900px;" loading="lazy">Chargement…</iframe>
              </div>
            </div>
          `;
          contentContainer.appendChild(auditionWrapper);
        } catch (e) { console.warn('[AUDITION] Injection échouée', e); }
      }
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

    // Ensure posts are displayed newest first (by date when available)
    try {
      if (Array.isArray(postsData) && postsData.length) {
        postsData.sort((a, b) => {
          const parseDate = item => {
            const v = (item.date || item.Date || item.published || item.created || item.timestamp || '').toString();
            const d = new Date(v);
            return isNaN(d.getTime()) ? 0 : d.getTime();
          };
          return parseDate(b) - parseDate(a);
        });
      }
    } catch (err) {
      // Fallback: reverse order if parsing/sort fails
      postsData = postsData.slice().reverse();
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
          ? `<img src="${ill.src}" alt="${post.title}" class="media-illustration" loading="lazy" decoding="async">`
          : `<iframe width="100%" height="220" src="${ill.src}" frameborder="0" allowfullscreen class="media-illustration" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`
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

// SEO meta, Open Graph, Twitter cards, and JSON-LD
function ensureSeoMeta(currentPageId) {
  // Site base URL (update if known)
  const origin = window.location.origin || '';
  const path = window.location.pathname;
  const canonicalUrl = origin ? origin + path : path;
  const siteTitleCfg = globalConfig?.find(i => i.section === 'head' && i.champ === 'site_title');
  const siteTitle = siteTitleCfg?.valeur || 'La Voix Libre';
  const page = pagesData?.find(p => p.id === currentPageId);
  const pageTitle = page?.page_title || document.title || siteTitle;
  const pageDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || 'Chant, chorales et cours à Rennes.';
  const ogImage = (page?.image ? `${ASSETS_BASE_URL}images/${page.image}` : (globalConfig?.find(i => i.section==='head' && i.champ==='logo_url')?.valeur)) || '';

  function upsert(name, content) {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }
  function upsertProperty(property, content) {
    if (!content) return;
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }
  function upsertLink(rel, href) {
    if (!href) return;
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  // Canonical
  upsertLink('canonical', canonicalUrl);

  // Open Graph
  upsertProperty('og:type', currentPageId === 'index' ? 'website' : 'article');
  upsertProperty('og:site_name', siteTitle);
  upsertProperty('og:title', pageTitle);
  upsertProperty('og:description', pageDesc);
  if (ogImage) upsertProperty('og:image', ogImage);
  upsertProperty('og:url', canonicalUrl);

  // Twitter Cards
  upsert('twitter:card', 'summary_large_image');
  upsert('twitter:title', pageTitle);
  upsert('twitter:description', pageDesc);
  if (ogImage) upsert('twitter:image', ogImage);

  // Robots: noindex for Espace choristes (privé)
  if (currentPageId === 'partitions') {
    upsert('robots', 'noindex, nofollow');
  }

  // JSON-LD: WebSite + optional Breadcrumb (préserver les autres scripts LD existants)
  function upsertJsonLd(id, data) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }
  const ldWebsite = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteTitle,
    url: origin || undefined,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${origin}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
  upsertJsonLd('ld-website', ldWebsite);

  if (currentPageId && currentPageId !== 'index') {
    const ldBreadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: origin || '/' },
        { '@type': 'ListItem', position: 2, name: pageTitle, item: canonicalUrl }
      ]
    };
    upsertJsonLd('ld-breadcrumb', ldBreadcrumb);
  }

  // Inject LocalBusiness on homepage to renforcer le SEO local (éviter doublons sur les pages dédiées)
  if (currentPageId === 'index') {
    const logoUrl = (globalConfig?.find(i => i.section==='head' && i.champ==='logo_url')?.valeur) || '';
    const email = (globalConfig?.find(i => i.section==='footer' && i.champ==='email')?.valeur) || '';
    const sameAs = [];
    const fb = globalConfig?.find(i => i.section==='footer' && i.champ==='facebook')?.valeur; if (fb) sameAs.push(fb);
    const ig = globalConfig?.find(i => i.section==='footer' && i.champ==='instagram')?.valeur; if (ig) sameAs.push(ig);
    const yt = globalConfig?.find(i => i.section==='footer' && i.champ==='youtube')?.valeur; if (yt) sameAs.push(yt);
    const ldLocal = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: siteTitle,
      url: origin || undefined,
      image: logoUrl || undefined,
      email: email || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: '21 rue Papu',
        addressLocality: 'Rennes',
        postalCode: '35000',
        addressCountry: 'FR'
      },
      areaServed: 'Rennes',
      sameAs: sameAs.length ? sameAs : undefined
    };
    upsertJsonLd('ld-localbusiness', ldLocal);
  }
}


async function init() {
  // Parallelize the small JSON requests to avoid blocking sequential waits
  try {
    const [g, p, part] = await Promise.all([
      fetchJson('global_config.json'),
      fetchJson('pages.json'),
      fetchJson('partitions.json')
    ]);
    globalConfig = g;
    pagesData = p;
    partitionsData = part;
  } catch (err) {
    console.error('[INIT] Erreur lors des fetch JSON initiaux :', err);
  }

  // Load posts CSV in background — don't block the main render on this.
  fetchPostsFromCSV('https://docs.google.com/spreadsheets/d/e/2PACX-1vROQBU3QffdHqtL93jVZOPjcuD0GHs2icQ13rx3-U7xvjASaQQILjk4pbVG7fk1ucFJQJMUI1GwKEy6/pub?output=csv')
    .then(data => {
      postsData = data || [];
      console.info('[POSTS] CSV chargé en arrière-plan, posts disponibles :', postsData.length);
      // If current page displays posts, attempt to render them now
      try {
        const currentPageId = getCurrentPageId();
        if (currentPageId && pagesData) {
          const page = pagesData.find(pp => pp.id === currentPageId);
          if (page && page.display_posts) {
            // ensure posts container exists and call loader
            const postsContainer = document.getElementById('posts-container');
            if (postsContainer) loadAndDisplayPosts(page.tags);
          }
        }
      } catch (e) { console.warn('[POSTS] rendu différé échoué', e); }
    })
    .catch(err => {
      console.error('[ERREUR POSTS] Impossible de charger les posts depuis le CSV Google Sheets (background):', err);
      postsData = [];
    });

  // If critical JSONs are missing, show a non-destructive warning but don't erase the whole page
  if (!globalConfig || !pagesData) {
    const warn = document.createElement('div');
    warn.style.cssText = 'color:red;font-weight:bold;padding:20px;background:#fff7f7;border-left:4px solid #e53935;';
    warn.textContent = 'Erreur lors du chargement des données du site. Certaines fonctionnalités peuvent être limitées.';
    document.body.insertBefore(warn, document.body.firstChild);
    // still proceed where possible (partial rendering may work)
  }

  // Render unified header/nav/footer
  const currentPageId = getCurrentPageId();
  renderHeader(currentPageId);
  if (currentPageId !== 'index') {
    renderNav(currentPageId);
  }
  renderFooter();
  
  // Apply global config (sets document.title, logo fallback, social links if present)
  applyGlobalConfig();

  if (currentPageId === 'index') {
    generateHomeTiles();
  } else {
  // Set header titles before generating content (covers pages with custom static bodies)
  setHeaderTitles(currentPageId);
    generatePageContent(currentPageId);
  }

  // Ensure SEO meta tags and structured data are present
  ensureSeoMeta(currentPageId);
}

init();

// Notify that dynamic content has been rendered so other listeners (e.g. smooth-scroll)
// can react. generatePageContent already performs synchronous DOM insertions; we
// dispatch this event at the end of that function's logical flow. To avoid
// duplicating logic we dispatch from here after init() calls generatePageContent.
// However, some pages may re-render later; individual renderers should also
// dispatch 'site:content-rendered' if they perform async updates. We emit a
// gentle fallback here after a short delay to cover usual cases.
setTimeout(() => {
  try {
    document.dispatchEvent(new Event('site:content-rendered'));
  } catch (e) {}
}, 400);

// Smooth-scroll handler: when a page is rendered dynamically and the URL contains a hash,
// try to scroll to the target element once it's available. Retries a few times with delay.
(function enableHashSmoothScroll() {
  if (!('location' in window) || !window.location.hash) return;
  const targetId = window.location.hash.slice(1);
  if (!targetId) return;
  let attempts = 0;
  const maxAttempts = 40; // retry longer on slower networks (40 * 150ms ~ 6s)
  const delay = 150;
  const tryScroll = () => {
    attempts++;
    const el = document.getElementById(targetId);
    if (el) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        el.scrollIntoView();
      }
      return;
    }
    if (attempts < maxAttempts) {
      setTimeout(tryScroll, delay);
    }
  };

  // If the dynamic renderer emits a signal that content finished rendering, try immediately
  document.addEventListener('site:content-rendered', function onRendered(e) {
    // small timeout to let microtasks settle
    setTimeout(tryScroll, 50);
  }, { once: true });

  // Also start a fallback polling in case the event was missed or rendering happened earlier
  setTimeout(tryScroll, 200);
})();
