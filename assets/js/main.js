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

// Normalize image source: local asset filename, absolute URL, or Google Drive share link -> direct image URL
function normalizeImageSrc(src) {
  if (!src) return '';
  src = src.trim();
  // If already absolute URL, return as-is
  if (/^https?:\/\//i.test(src)) {
    // Convert common Google Drive share links to direct image URL
    try {
      const u = new URL(src);
      // drive.google.com/file/d/FILE_ID/view?usp=sharing
      const driveFileMatch = src.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
      const idParam = u.searchParams.get('id');
      const fileId = driveFileMatch ? driveFileMatch[1] : (idParam || null);
      if (u.hostname.includes('drive.google.com') && fileId) {
        // Prefer download export as primary (sometimes avoids preview wrappers)
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    } catch (e) {
      // if URL parsing fails, fallthrough to return src
    }
    return src;
  }
    // Otherwise treat as a local asset path under assets/images
  return `${ASSETS_BASE_URL}images/${src}`;
}

// For post images: treat bare filenames as site-root files, keep absolute URLs as-is.
// This lets editors put the image file at the site root and write only the filename
// in the CSV image column (e.g. "monimage.png").
function normalizePostImageSrc(src) {
  if (!src) return '';
  src = src.trim();
  // Absolute URLs or already root-anchored paths are returned as-is
  if (/^https?:\/\//i.test(src) || src.startsWith('/')) return src;
  // Otherwise treat as a site-root filename
  return `/${src}`;
}

// If a Drive link was used, build a sensible fallback (one attempt) to try if the primary fails
function driveFallbackForSrc(src) {
  try {
    const u = new URL(src);
    if (u.hostname.includes('drive.google.com')) {
      const driveFileMatch = src.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
      const idParam = u.searchParams.get('id');
      const fileId = driveFileMatch ? driveFileMatch[1] : (idParam || null);
      if (fileId) {
        // Provide a list of fallbacks to try in order
        const download = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const view = `https://drive.google.com/uc?export=view&id=${fileId}`;
        const thumb = `https://drive.google.com/thumbnail?id=${fileId}`;
        return [download, view, thumb];
      }
    }
  } catch (e) {}
  return [];
}

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
  if (id === 'partitions') return 'espace-choristes.html';
  if (id === 'index')      return 'index.html';
  if (id === 'evenements') return 'index.html#evenements';
  return `${id}.html`;
}

function navLabelForPage(page) {
  if (!page) return '';
  // Libellés courts pour le menu (les page_title longs restent en H1 / <title> pour le SEO)
  const MENU_LABELS = {
    'nous-rejoindre': 'Nous rejoindre',
    'galerie':        'Galerie',
    'soul':           'S.O.U.L.',
    'evenements':     'Événements/Concerts',
    'partitions':     'Espace choristes'
  };
  if (MENU_LABELS[page.id]) return MENU_LABELS[page.id];
  if (page.page_title) return page.page_title;
  return page.id;
}

function computeNavOrder(pages) {
  // chorale-pop et comedie-musicale sont dans la page d'accueil, pas dans le nav
  const hideFromNav  = new Set(['chorale-pop', 'comedie-musicale']);
  const desiredOrder = ['soul', 'nous-rejoindre', 'evenements', 'galerie', 'partitions'];
  const visiblePages = pages.filter(p => !p.hidden && !hideFromNav.has(p.id));
  const byId = Object.fromEntries(visiblePages.map(p => [p.id, p]));
  const ordered  = desiredOrder.filter(id => byId[id]).map(id => byId[id]);
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

  const navHTML = '<nav class="main-nav" aria-label="Navigation principale">\
    <button class="mobile-menu-toggle" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu">☰</button>\
    <ul class="nav-links" id="main-menu"></ul>\
  </nav>';

  // If we're on the Soul site, use the soullogo at site root.
  // On la page de présentation SOUL elle-même, on n'enveloppe pas dans un lien (ça serait redondant).
  // Sur les autres pages SOUL (galerie-soul.html, etc.), le logo renvoie vers la page de présentation SOUL.
  const isSoulSite = (typeof window !== 'undefined' && window.__isSoulSite) ? true : false;
  const soulLogoPath = '/assets/images/soullogo.png';
  let logoHtml = '';
  if (isSoulSite) {
    const alt = 'SOUL';
    const isSoulHome = (currentPageId === 'soul');
    if (isSoulHome) {
      logoHtml = `<img src="${soulLogoPath}" alt="${alt}" class="site-logo" decoding="async">`;
    } else {
      logoHtml = `<a href="soul.html" class="site-logo-link" aria-label="Retour à la page S.O.U.L."><img src="${soulLogoPath}" alt="${alt}" class="site-logo" decoding="async"></a>`;
    }
  } else {
    logoHtml = `<a href="${mapPageIdToHref('index')}" class="site-logo-link">\n  <img src="${logoUrlCfg ? logoUrlCfg.valeur : ''}" alt="Logo ${siteTitleCfg ? siteTitleCfg.valeur : 'La Voix Libre'}" class="site-logo" decoding="async">\n      </a>`;
  }

  header.innerHTML = `
    <div class="header-content">
      ${logoHtml}
      <div class="site-titles">
        <h1 id="page-main-title" class="${isHome ? 'main-title' : ''}">${h1Text}</h1>
        <p id="page-subtitle" class="subtitle">${subText}</p>
      </div>
    </div>
    ${navHTML}
  `;
}

// ---- Badge d'identité (uniquement sur espace-choristes et galerie) ----
function renderAuthBadge() {
  let badge = document.getElementById('auth-badge');

  // Le badge ne s'affiche que sur les pages où la session est pertinente
  // Cloudflare Pages sert les URLs sans .html → on accepte les 2 formes
  const path = (location.pathname || '').toLowerCase();
  const allowed = /(espace-choristes|galerie)(\.html)?\/?$/.test(path);
  if (!allowed) {
    if (badge) badge.remove();
    return;
  }

  const role = (function(){
    try { return localStorage.getItem('choristesRole') || sessionStorage.getItem('choristesRole'); }
    catch { return null; }
  })();
  let profile = {};
  try { profile = JSON.parse(localStorage.getItem('choristeProfile') || '{}'); } catch {}
  const fullName = ((profile.prenom || '') + ' ' + (profile.nom || '')).trim();

  // Pas connecté ou profil pas encore renseigné → on masque/supprime le badge
  if ((role !== 'member' && role !== 'chef') || !fullName) {
    if (badge) badge.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'auth-badge';
    document.body.appendChild(badge);
  }

  const tag = role === 'chef' ? ' <span class="auth-badge-tag">bureau</span>' : '';
  badge.innerHTML =
    '<span class="auth-badge-icon" aria-hidden="true">👤</span>' +
    '<span class="auth-badge-name">' + fullName.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) + '</span>' +
    tag +
    ' <button type="button" class="auth-badge-logout" aria-label="Se déconnecter">Déconnexion</button>';

  badge.querySelector('.auth-badge-logout').addEventListener('click', function() {
    if (!confirm('Se déconnecter de l\'espace choristes ?\n\nVotre profil (prénom, nom, pupitre) sera également effacé pour cet appareil.')) return;
    try {
      localStorage.removeItem('choristesRole');
      localStorage.removeItem('espace_choristes_role');
      localStorage.removeItem('espace_choristes_authed');
      // Important : sur un ordinateur partagé, on efface aussi le profil utilisateur
      localStorage.removeItem('choristeProfile');
      sessionStorage.removeItem('choristesRole');
      sessionStorage.removeItem('espace_choristes_role');
      sessionStorage.removeItem('espace_choristes_authed');
    } catch {}
    window.IS_CHEF = false;
    document.body.classList.remove('role-chef');
    renderAuthBadge();
    // Si on est dans l'espace choristes, on renvoie vers la page d'accueil
    if (/espace-choristes(\.html)?\/?$/.test(location.pathname)) {
      location.href = 'index.html';
    }
  });
}
if (typeof window !== 'undefined') window.renderAuthBadge = renderAuthBadge;

// ---- Espace choristes password gate ----
function getGlobalConfigValue(section, champ) {
  try {
    if (!Array.isArray(globalConfig)) return null;
    const item = globalConfig.find(i => i.section === section && i.champ === champ);
    return item ? item.valeur : null;
  } catch (e) { return null; }
}

function createChoristesModal() {
  if (document.getElementById('choristes-modal')) return document.getElementById('choristes-modal');
  const overlay = document.createElement('div');
  overlay.id = 'choristes-modal';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.45)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';

  const box = document.createElement('div');
  box.style.background = '#fff';
  box.style.padding = '20px';
  box.style.borderRadius = '8px';
  box.style.maxWidth = '420px';
  box.style.width = '90%';
  box.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';

  const title = document.createElement('h3');
  title.textContent = 'Accès Espace choristes';
  title.style.marginTop = '0';
  title.style.marginBottom = '8px';

  const hint = document.createElement('p');
  hint.textContent = 'Saisissez le mot de passe pour accéder à l\'espace choristes.';
  hint.style.margin = '0 0 12px 0';
  hint.style.fontSize = '14px';

  const input = document.createElement('input');
  input.type = 'password';
  input.id = 'choristes-password-input';
  input.style.width = '100%';
  input.style.padding = '10px';
  input.style.marginBottom = '12px';
  input.style.boxSizing = 'border-box';

  const btnWrap = document.createElement('div');
  btnWrap.style.display = 'flex';
  btnWrap.style.justifyContent = 'flex-end';
  btnWrap.style.gap = '8px';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Annuler';
  cancel.style.background = '#eee';
  cancel.style.border = 'none';
  cancel.style.padding = '8px 12px';
  cancel.style.borderRadius = '6px';

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.textContent = 'Valider';
  ok.style.background = '#2b6cb0';
  ok.style.color = '#fff';
  ok.style.border = 'none';
  ok.style.padding = '8px 12px';
  ok.style.borderRadius = '6px';

  btnWrap.appendChild(cancel);
  btnWrap.appendChild(ok);

  box.appendChild(title);
  box.appendChild(hint);
  box.appendChild(input);
  box.appendChild(btnWrap);
  overlay.appendChild(box);

  // handlers
  cancel.addEventListener('click', () => { overlay.remove(); });
  ok.addEventListener('click', () => {
    const val = (input.value || '').trim();
    const expected = getGlobalConfigValue('security', 'espace_choristes_password') || 'lavoixlibre2026';
    const adminPasswords = ['bureau'];
    const soulPasswords  = ['soul2026'];
    if (val === expected || adminPasswords.includes(val) || soulPasswords.includes(val)) {
      // save role for the choristes page (choristes.js expects 'choristesRole')
      if (adminPasswords.includes(val)) {
        localStorage.setItem('choristesRole', 'chef');
        localStorage.setItem('espace_choristes_role', 'bureau');
      } else {
        localStorage.setItem('choristesRole', 'member');
        localStorage.setItem('espace_choristes_role', 'choriste');
        // Hint d'ensemble : SOUL si mdp soul2026, sinon chorale (LVL)
        localStorage.setItem('choristesEnsembleHint', soulPasswords.includes(val) ? 'soul' : 'chorale');
      }
      // also set a simple authed flag to avoid any other gate checks
      localStorage.setItem('espace_choristes_authed', '1');
      if (typeof window.renderAuthBadge === 'function') window.renderAuthBadge();
      const target = overlay.dataset.targetHref;
      overlay.remove();
      if (target) window.location.href = target;
      return;
    }
    // incorrect
    input.value = '';
    input.focus();
    input.style.border = '1px solid #d9534f';
  });
  // allow Enter to submit
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok.click(); });

  document.addEventListener('keydown', function onKey(e){
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
  });

  return overlay;
}

function initEspaceChoristesGate() {
  // delegated listener to catch clicks on any anchor that links to espace-choristes
  document.addEventListener('click', function (e) {
    try {
      const a = e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      const href = (a.getAttribute('href') || '').replace(/^\.\//, '');
      if (href.indexOf('espace-choristes.html') !== -1) {
        // Si déjà authentifié (session persistante), on ne redemande pas le mdp
        const role = localStorage.getItem('choristesRole') || sessionStorage.getItem('choristesRole');
        if (role === 'chef' || role === 'member') return;
        e.preventDefault();
        const modal = createChoristesModal();
        modal.dataset.targetHref = a.href || href;
        document.body.appendChild(modal);
        const input = modal.querySelector('#choristes-password-input');
        if (input) setTimeout(() => input.focus(), 50);
      }
    } catch (e) { console.warn('choristes gate handler error', e); }
  }, true);
}

// initialize gate as soon as possible
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initEspaceChoristesGate);
  else initEspaceChoristesGate();
}

function renderNav(currentPageId) {
  const nav = document.querySelector('.main-nav');
  const navList = nav ? nav.querySelector('.nav-links') : null;
  if (!navList || !Array.isArray(pagesData)) return;
  navList.innerHTML = '';

  // Lien "La Voix Libre" → accueil (masqué si déjà sur la homepage OU sur le site SOUL)
  const _isSoulNav = (typeof window !== 'undefined' && window.__isSoulSite) ? true : false;
  if (currentPageId !== 'index' && !_isSoulNav) {
    const liHome = document.createElement('li');
    const aHome  = document.createElement('a');
    aHome.href = 'index.html';
    aHome.textContent = 'La Voix Libre';
    liHome.appendChild(aHome);
    navList.appendChild(liHome);
  }

  const items = computeNavOrder(pagesData);
  items.forEach(page => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href = mapPageIdToHref(page.id);
    a.textContent = navLabelForPage(page);
    // Sur le site SOUL, le lien "Galerie" pointe vers la galerie SOUL dédiée
    if (_isSoulNav && page.id === 'galerie') {
      a.href = 'galerie-soul.html';
    }
    const isActive = (currentPageId === page.id);
    if (isActive) return; // ne pas afficher la page courante
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

  // SOUL : remplacer la nav HTML par une nav SVG "gravée" sur le bord inférieur du logo
  try { applySoulCurvedNav(); } catch(e) { console.warn('soul curved nav', e); }
}

// Construit une nav SVG dont le texte suit la courbe inférieure du disque SOUL
function applySoulCurvedNav() {
  if (!document.body || !document.body.classList.contains('page-soul')) return;
  const header = document.querySelector('.main-header.soul-header');
  if (!header) return;

  // Retire une éventuelle ancienne instance
  const previous = header.querySelector('.soul-curved-nav');
  if (previous) previous.remove();

  const links = Array.from(document.querySelectorAll('.main-nav .nav-links li a'));
  if (!links.length) return;

  // Arc dans un viewBox 380x380 — centre (190,190), rayon proche du bord du disque
  // Arc large pour donner de la place au texte
  const cx = 190, cy = 190, r = 172;
  const halfArc = 70 * Math.PI / 180;
  const startX = cx - r * Math.sin(halfArc);
  const endX   = cx + r * Math.sin(halfArc);
  const y      = cy + r * Math.cos(halfArc);

  // Répartition des items le long de l'arc
  const N = links.length;
  const margin = 0.18;
  const usable = 1 - 2 * margin;
  const offsets = links.map((_, i) => {
    if (N === 1) return 50;
    return (margin + (i / (N - 1)) * usable) * 100;
  });

  // Libellés raccourcis pour tenir sur l'arc
  const SHORT_LABELS = {
    'Espace choristes': 'Choristes',
    'La Voix Libre': 'Accueil'
  };

  // Construction du SVG en chaîne — innerHTML est parsé correctement en namespace SVG
  const texts = links.map((a, i) => {
    const original = (a.textContent || '').trim();
    const txt = SHORT_LABELS[original] || original;
    const href = a.getAttribute('href') || '#';
    const off  = offsets[i].toFixed(2);
    return `<a href="${href}"><text>
      <textPath href="#soul-nav-arc" startOffset="${off}%" text-anchor="middle">${txt}</textPath>
    </text></a>`;
  }).join('');

  const wrap = document.createElement('div');
  wrap.className = 'soul-curved-nav';
  // sweep-flag = 0 → arc qui passe par le BAS du disque (forme de sourire / U)
  wrap.innerHTML = `<svg viewBox="0 0 380 380" xmlns="http://www.w3.org/2000/svg" aria-hidden="false">
    <defs>
      <path id="soul-nav-arc" d="M ${startX.toFixed(2)},${y.toFixed(2)} A ${r},${r} 0 0 0 ${endX.toFixed(2)},${y.toFixed(2)}" fill="none"/>
    </defs>
    ${texts}
  </svg>`;
  header.appendChild(wrap);
}

// Mesure dynamique du gap Behold et application à toutes les grilles de vignettes de la page
// (YouTube + galerie photos), pour un espacement uniforme avec le widget Behold (Instagram).
function syncYoutubeGapToBehold() {
  const grids = document.querySelectorAll('.youtube-grid, .photo-mosaic');
  if (!grids.length) return;

  function measureBeholdGap() {
    const behold = document.querySelector('behold-widget');
    if (!behold || !behold.shadowRoot) return null;
    const candidates = behold.shadowRoot.querySelectorAll('*');
    for (const el of candidates) {
      const cs = getComputedStyle(el);
      const gap = cs.columnGap && cs.columnGap !== 'normal' ? cs.columnGap : cs.gap;
      if (gap && gap !== 'normal' && parseFloat(gap) > 0) return gap;
    }
    return null;
  }

  function apply(gap) {
    grids.forEach(g => { g.style.gap = gap; });
  }

  let attempts = 0;
  const max = 24;            // ≈ 12 secondes au total
  const interval = setInterval(() => {
    const gap = measureBeholdGap();
    if (gap) { apply(gap); clearInterval(interval); }
    else if (++attempts >= max) clearInterval(interval);
  }, 500);
}
// Alias pour rétrocompat (ancien nom appelé depuis le bloc SOUL)
function syncSoulYoutubeGapToBehold() { return syncYoutubeGapToBehold(); }

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
  const isSoulSite = (typeof window !== 'undefined' && window.__isSoulSite) ? true : false;

  if (isSoulSite) {
    // Footer SOUL — esprit "verso de pochette vinyle" : sobre, lisible, deux blocs clairs
    const fb = fbCfg?.valeur || '';
    const ig = igCfg?.valeur || '';
    const yt = ytCfg?.valeur || '';
    footer.innerHTML = `
      <div class="soul-footer-content">
        <div class="soul-footer-row">
          <div class="soul-footer-brand">
            <img src="/assets/images/soullogo.png" alt="S.O.U.L. — ensemble vocal a cappella à Rennes" class="soul-footer-logo">
            <div class="soul-footer-brand-text">
              <div class="soul-footer-name">S.O.U.L.</div>
              <div class="soul-footer-tag">Ensemble vocal a cappella · Rennes</div>
            </div>
          </div>

          <div class="soul-footer-grid">
            <div class="soul-footer-block">
              <div class="soul-footer-label">Suivre</div>
              <ul class="soul-footer-links">
                ${fb ? `<li><a href="${fb}" target="_blank" rel="noopener noreferrer">Facebook</a></li>` : ''}
                ${ig ? `<li><a href="${ig}" target="_blank" rel="noopener noreferrer">Instagram</a></li>` : ''}
                ${yt ? `<li><a href="${yt}" target="_blank" rel="noopener noreferrer">YouTube</a></li>` : ''}
              </ul>
            </div>
            <div class="soul-footer-block">
              <div class="soul-footer-label">Contact</div>
              <ul class="soul-footer-links">
                <li><a href="mailto:${email}">${email}</a></li>
                <li><a href="#newsletter">S'inscrire à la newsletter</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div class="soul-footer-meta">© ${year} S.O.U.L. · Rennes</div>
      </div>
    `;
    return;
  }

  // Default footer for the main site
  footer.innerHTML = `
    <div class="footer-content">
      <div class="footer-brand">
        <span class="footer-brand-name">La Voix Libre</span>
        <p class="footer-tagline">Chorale &amp; ateliers de chant à Rennes</p>
      </div>

      <a href="#newsletter" id="newsletter-btn" class="footer-newsletter-btn" aria-label="S'inscrire à la newsletter La Voix Libre">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
        <span>S'inscrire à la newsletter</span>
      </a>

      <nav class="social-links" aria-label="Réseaux sociaux">
        <a href="${fbCfg?.valeur || '#'}" target="_blank" rel="noopener noreferrer" aria-label="Facebook La Voix Libre">Facebook</a>
        <a href="${igCfg?.valeur || '#'}" target="_blank" rel="noopener noreferrer" aria-label="Instagram La Voix Libre">Instagram</a>
        <a href="${ytCfg?.valeur || '#'}" target="_blank" rel="noopener noreferrer" aria-label="YouTube La Voix Libre">YouTube</a>
      </nav>

      <div class="footer-divider"></div>

      <p class="footer-contact">Contact : <a href="mailto:${email}">${email}</a></p>
      <p class="footer-copyright">&copy; ${year} La Voix Libre. Tous droits réservés.</p>
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
    // Build the request URL relative to the current location so the code
    // works whether the site is hosted at the root or in a subdirectory.
    const url = new URL(`${DATA_BASE_URL}${filename}`, window.location.href).href;
    console.log(`[DEBUG] fetch url: ${url}`);
    // Force the browser to bypass any cached response (helps when users have
    // stale cached assets or a Service Worker). This is safe for small JSON
    // files; if you want to re-enable caching later, remove the option.
    const response = await fetch(url, { cache: 'no-store' });
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
    const tilesGrid   = document.getElementById('main-tiles-grid');
    const homeContent = document.getElementById('home-chorale-content');
    if (!pagesData) return;

    // === SECTION 1 : Contenu grande chorale + bloc comédie musicale ===
    if (homeContent) {
      homeContent.innerHTML = '';
      const choralePopPage = pagesData.find(p => p.id === 'chorale-pop');
      const comediePage    = pagesData.find(p => p.id === 'comedie-musicale');

      // --- Chorale : hero image ---
      if (choralePopPage && choralePopPage.image) {
        const hero = document.createElement('div');
        hero.className = 'home-hero';
        const imgJpg  = `${ASSETS_BASE_URL}images/${choralePopPage.image}`;
        const imgWebp = imgJpg.replace(/\.[a-zA-Z0-9]+$/, '.webp');
        hero.innerHTML = `
          <picture>
            <source srcset="${imgWebp}" type="image/webp">
            <img src="${imgJpg}" alt="La Voix Libre, chorale pop polyphonique à Rennes en concert" loading="eager" decoding="async">
          </picture>
          <div class="home-hero-overlay">
            <p class="home-hero-tag">Chœur pop à Rennes depuis 2017</p>
          </div>`;
        homeContent.appendChild(hero);
      }

      // --- Chorale : paragraphes + chips infos pratiques ---
      if (choralePopPage) {
        const INFO_RE   = /^(Répétitions|Lieu|Tarif|Horaires|Contact)\s*:/i;
        const CHIP_ICON = { répétitions:'🗓', lieu:'📍', tarif:'💶', horaires:'⏰', contact:'✉️' };
        const paras = [], chips = [];
        (choralePopPage.page_content || []).forEach(txt => {
          if (!txt || !txt.trim()) return;
          const m = txt.match(/^([A-ZÀ-Ÿa-zàâäéèêëïîôöùûü]+)\s*:/i);
          if (INFO_RE.test(txt) && m) {
            const key  = m[1].toLowerCase();
            chips.push((CHIP_ICON[key] || '•') + ' ' + txt.replace(/^[^:]+:\s*/, ''));
          } else {
            paras.push(txt);
          }
        });
        paras.slice(0, 3).forEach(txt => {
          const p = document.createElement('p');
          p.className = 'home-intro-text';
          p.textContent = txt;
          homeContent.appendChild(p);
        });
        if (chips.length) {
          const wrap = document.createElement('div');
          wrap.className = 'home-info-chips';
          chips.forEach(c => {
            const s = document.createElement('span');
            s.className = 'home-info-chip';
            s.textContent = c;
            wrap.appendChild(s);
          });
          homeContent.appendChild(wrap);
        }

        // --- Chef de chœur : mention + bouton vers la page Vincent ---
        const conductor = document.createElement('div');
        conductor.className = 'home-conductor';
        conductor.innerHTML = `
          <p class="home-intro-text" style="margin-bottom:12px;">L'ensemble est dirigé par <strong>Vincent T-Dauberlieu</strong>, chef de chœur et pédagogue vocal.</p>
          <a href="vincent.html" class="home-cta-btn">En savoir plus sur Vincent →</a>`;
        homeContent.appendChild(conductor);
      }

      // --- Comédie musicale ---
      if (comediePage) {
        // Séparateur de section
        const divider = document.createElement('div');
        divider.className = 'home-section-divider';
        divider.innerHTML = '<h2>Comédie musicale</h2>';
        homeContent.appendChild(divider);

        // Carte image + texte
        const card    = document.createElement('div');
        card.className = 'home-comedie-card';
        const imgJpg  = `${ASSETS_BASE_URL}images/comediemusicale.jpg`;
        const imgWebp = imgJpg.replace('.jpg', '.webp');
        const imgWrap = document.createElement('div');
        imgWrap.className = 'home-comedie-img-wrap';
        imgWrap.innerHTML = `<picture><source srcset="${imgWebp}" type="image/webp"><img src="${imgJpg}" alt="Comédie musicale amateur La Voix Libre à Rennes - spectacle La Furie des Mers" loading="lazy" decoding="async"></picture>`;
        const body  = document.createElement('div');
        body.className = 'home-comedie-body';
        const desc  = document.createElement('p');
        desc.textContent = 'En plus de ses activités chorales, La Voix Libre produit régulièrement des comédies musicales amateurs : spectacles complets avec chant, jeu scénique, costumes et décors, préparés en équipe sur toute une saison.';
        const ctaBtn = document.createElement('button');
        ctaBtn.className = 'home-cta-btn';
        ctaBtn.textContent = 'En savoir plus ↓';
        ctaBtn.setAttribute('aria-expanded', 'false');
        body.appendChild(desc);
        body.appendChild(ctaBtn);
        card.appendChild(imgWrap);
        card.appendChild(body);
        homeContent.appendChild(card);

        // Accordéon dépliable
        const expand = document.createElement('div');
        expand.className = 'home-comedie-expand';
        (comediePage.page_content || []).forEach(txt => {
          if (!txt || !txt.trim()) return;
          const p = document.createElement('p'); p.textContent = txt; expand.appendChild(p);
        });
        (comediePage.specific_content || []).forEach(sc => {
          if (sc.type !== 'list') return;
          if (sc.title) { const h3 = document.createElement('h3'); h3.textContent = sc.title; expand.appendChild(h3); }
          const ul = document.createElement('ul');
          (sc.items || []).forEach(item => { const li = document.createElement('li'); li.textContent = item; ul.appendChild(li); });
          expand.appendChild(ul);
        });
        ctaBtn.addEventListener('click', () => {
          const open = expand.style.display !== 'none';
          expand.style.display = open ? 'none' : 'block';
          ctaBtn.textContent   = open ? 'En savoir plus ↓' : 'Masquer ↑';
          ctaBtn.setAttribute('aria-expanded', String(!open));
          if (!open) expand.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        homeContent.appendChild(expand);
      }
    }

    // === SECTION 2 : Concerts & événements (depuis Google Agenda) ===
    loadHomeEvents(homeContent);

    // === SECTION 3 : Actualités Instagram (Behold), sous le calendrier ===
    if (homeContent) {
      const insta = document.createElement('section');
      insta.className = 'insta-section';
      insta.setAttribute('aria-label', 'Actualités Instagram');
      const feedId = (typeof window !== 'undefined' && window.BEHOLD_FEED_ID && !window.BEHOLD_FEED_ID.startsWith('VOTRE_ID')) ? window.BEHOLD_FEED_ID : '';
      insta.innerHTML = `
        <div class="home-section-divider"><h2>La Voix Libre sur Insta — Actualités</h2></div>
        ${feedId ? `<behold-widget feed-id="${feedId}"></behold-widget>` : `<p class="insta-fallback">Flux Instagram bientôt disponible.</p>`}`;
      homeContent.appendChild(insta);
    }

    // === SECTION 4 : Nos enregistrements (playlist YouTube), sous la rubrique Insta ===
    if (homeContent) {
      const yt = document.createElement('section');
      yt.className = 'youtube-section';
      yt.setAttribute('aria-label', 'Nos enregistrements YouTube');
      yt.innerHTML = `
        <div class="home-section-divider"><h2>La Voix Libre sur YouTube — Enregistrements</h2></div>
        <div class="youtube-grid" data-playlist="PLrXSL-oTlPbZbzdhKFRSggddJz8wGXbog" data-limit="6" aria-live="polite">
          <div class="youtube-skeleton"></div>
          <div class="youtube-skeleton"></div>
          <div class="youtube-skeleton"></div>
          <div class="youtube-skeleton"></div>
          <div class="youtube-skeleton"></div>
          <div class="youtube-skeleton"></div>
        </div>`;
      homeContent.appendChild(yt);
      if (typeof initYoutubeGrids === 'function') initYoutubeGrids();
      if (typeof syncYoutubeGapToBehold === 'function') syncYoutubeGapToBehold();
    }
  }

  // Constantes Google Agenda — Grande Chorale uniquement
  const _HOME_CAL_KEY = 'AIzaSyDkjr4VKTHb1mzjUL_smPZslusM538Pbes';
  const _HOME_CAL_ID  = '8d33f051731fd272256bc497e3167c610e09fcab8e8a022315bdf7d1aa9a282e@group.calendar.google.com';
  const _HOME_KW = /(concert|événement|evenement|déambulation|deambulation|spectacle|stage|pique[- ]?nique)/i;
  const _JOURS   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const _MOIS_L  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const _MOIS_C  = ['jan','fév','mar','avr','mai','jun','juil','août','sep','oct','nov','déc'];
  // Format identique au sélecteur d'upload (espace-choristes) pour la correspondance photos ↔ événements
  const _K_JOURS = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
  const _K_MOIS  = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];

  async function loadHomeEvents(container, opts) {
    if (!container) return;
    opts = opts || {};
    const calId       = opts.calendarId   || _HOME_CAL_ID;
    const showThumbs  = opts.showThumbs !== false;          // par défaut : oui (homepage)
    const sectionId   = opts.sectionId    || 'evenements';
    const subtitle    = opts.subtitle     || 'Prochaines dates de La Voix Libre à Rennes et alentours.';

    const section = document.createElement('section');
    section.id = sectionId;
    section.style.cssText = 'scroll-margin-top:80px;';
    section.innerHTML = `
      <div class="home-section-divider"><h2>Concerts &amp; événements</h2></div>
      <p class="home-section-subtitle">${subtitle}</p>
      <div id="${sectionId}-upcoming"></div>`;
    container.appendChild(section);

    const upEl = section.querySelector('#' + sectionId + '-upcoming');
    const paEl = null; // Plus de section séparée pour les passés
    const skel = h => `<div style="height:${h}px;border-radius:12px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-bottom:10px;"></div>`;
    if (upEl) upEl.innerHTML = skel(72) + skel(80) + skel(64);
    if (paEl) paEl.innerHTML = skel(50) + skel(50);

    // ---- Chargement des photos (groupées par concert) — uniquement quand showThumbs ----
    const photosByKey = {};
    if (showThumbs) {
      try {
        const ep = (typeof window !== 'undefined' && window.PHOTOS_ENDPOINT) || '';
        if (ep && !ep.startsWith('REMPLACER')) {
          const pd = await fetch(ep + (ep.includes('?') ? '&' : '?') + 'action=gallery_list', { cache: 'no-store' }).then(r => r.json());
          (pd.photos || []).forEach(p => {
            const k = p.eventId ? ('id:' + p.eventId) : ('name:' + (p.concert || '').trim());
            if (!photosByKey[k]) photosByKey[k] = [];
            photosByKey[k].push(p);
          });
        }
      } catch(e) { /* photos non disponibles */ }
    }

    // ---- Chargement des événements (calendrier configurable) ----
    const now  = new Date();
    const tMin = new Date(now.getTime() - 365*24*3600*1000).toISOString();
    const tMax = new Date(now.getTime() + 2*365*24*3600*1000).toISOString();
    let allEvents = [];
    try {
      const url = 'https://www.googleapis.com/calendar/v3/calendars/'
        + encodeURIComponent(calId)
        + '/events?key=' + _HOME_CAL_KEY
        + '&timeMin=' + encodeURIComponent(tMin)
        + '&timeMax=' + encodeURIComponent(tMax)
        + '&maxResults=200&orderBy=startTime&singleEvents=true';
      const data = await fetch(url).then(r => r.json());
      allEvents = (data.items || []).filter(ev => _HOME_KW.test(ev.summary || ''));
      allEvents.forEach(ev => { ev._ts = new Date(ev.start.dateTime || ev.start.date).getTime(); });
    } catch(e) { /* silencieux */ }

    // SEO : injecte un Schema.org ItemList de Event (uniquement les concerts à venir + le dernier passé)
    try {
      const futureEvents = allEvents.filter(ev => ev._ts >= now.getTime());
      const ensembleKey = (calId === _HOME_CAL_ID) ? 'lvl' : 'soul';
      if (typeof injectEventsJsonLd === 'function') injectEventsJsonLd(futureEvents, ensembleKey);
    } catch(e) { /* silencieux */ }

    // Tri : à venir du plus proche au plus lointain, passés du plus récent au plus ancien
    const upcoming = allEvents.filter(ev => ev._ts >= now.getTime()).sort((a,b) => a._ts - b._ts);
    const pastAll  = allEvents.filter(ev => ev._ts <  now.getTime()).sort((a,b) => b._ts - a._ts);
    // 3 derniers événements passés (du plus récent au plus ancien)
    const lastPast = pastAll.slice(0, 3);

    // ---- Helpers ----
    function evDate(ev) { return new Date(ev.start.dateTime || ev.start.date); }
    function fullDate(ev) {
      const d = evDate(ev);
      let s = _JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + _MOIS_L[d.getMonth()] + ' ' + d.getFullYear();
      if (ev.start.dateTime) {
        const h = d.getHours().toString().padStart(2,'0');
        const m = d.getMinutes().toString().padStart(2,'0');
        s += ' à ' + h + 'h' + (m !== '00' ? m : '');
      }
      return s;
    }
    function esc(s) { return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c)); }
    // Sanitise une description d'événement Google Agenda en gardant les tags de formatage usuels
    // (Google Agenda envoie souvent du HTML : <p>, <strong>, <br>, <a>, etc.)
    function escDescHtml(html) {
      if (!html) return '';
      const ALLOWED = /^(p|br|strong|b|em|i|u|ul|ol|li|a|span)$/i;
      // Retire tous les tags non autorisés et les attributs dangereux des tags autorisés
      const cleaned = html.replace(/<\s*\/?\s*([a-zA-Z0-9]+)([^>]*)>/g, (_m, tag, attrs) => {
        if (!ALLOWED.test(tag)) return '';
        // Pour <a>, ne conserver que href (et forcer target/rel sécurisés)
        if (/^a$/i.test(tag) && /^<\s*a\b/i.test(_m)) {
          const hrefMatch = attrs.match(/href\s*=\s*['"]([^'"]+)['"]/i);
          const href = hrefMatch ? hrefMatch[1] : '#';
          if (!/^(https?:|mailto:|#)/i.test(href)) return '';
          return `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">`;
        }
        // Pour les autres, retirer tout attribut (pas de style/onclick/etc.)
        return _m.startsWith('</') ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`;
      });
      // Si le HTML ne contient aucun saut de bloc, on traduit les \n en <br>
      return /<\s*(p|br|div|li)\b/i.test(cleaned) ? cleaned : cleaned.replace(/\n/g, '<br>');
    }
    function concertKey(ev) {
      const d = evDate(ev);
      return (ev.summary||'Concert') + ' – ' + _K_JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + _K_MOIS[d.getMonth()] + ' ' + d.getFullYear();
    }

    // ---- Lightbox inline ----
    function ensureLightbox() {
      let lb = document.getElementById('ev-lightbox');
      if (lb) return lb;
      lb = document.createElement('div');
      lb.id = 'ev-lightbox';
      lb.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.90);z-index:10000;align-items:center;justify-content:center;padding:16px;flex-direction:column;';
      lb.innerHTML = '<button id="ev-lb-close" style="position:absolute;top:14px;right:18px;background:none;border:none;color:#fff;font-size:2.2rem;cursor:pointer;line-height:1;">&times;</button>'
        + '<img id="ev-lb-img" src="" alt="" style="max-width:min(92vw,1200px);max-height:88vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.7);">';
      document.body.appendChild(lb);
      const close = () => { lb.style.display = 'none'; document.body.style.overflow = ''; };
      lb.querySelector('#ev-lb-close').addEventListener('click', close);
      lb.addEventListener('click', e => { if (e.target === lb) close(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && lb.style.display !== 'none') close(); });
      return lb;
    }
    function openPhoto(fileId) {
      const lb = ensureLightbox();
      lb.querySelector('#ev-lb-img').src = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1600';
      lb.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    // ---- Miniatures photos ----
    function createThumbs(photos) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.07);';
      photos.forEach(p => {
        const img = document.createElement('img');
        img.src = 'https://drive.google.com/thumbnail?id=' + p.fileId + '&sz=w120';
        img.alt = p.concert || '';
        img.loading = 'lazy';
        img.style.cssText = 'width:72px;height:72px;object-fit:cover;border-radius:6px;cursor:pointer;transition:transform .2s,opacity .2s;';
        img.addEventListener('mouseenter', () => { img.style.transform = 'scale(1.08)'; img.style.opacity = '.88'; });
        img.addEventListener('mouseleave', () => { img.style.transform = ''; img.style.opacity = '1'; });
        img.addEventListener('click',      () => openPhoto(p.fileId));
        wrap.appendChild(img);
      });
      return wrap;
    }

    // Rend la carte cliquable : toggle .event-card--open pour afficher/masquer .event-card-details
    function bindCardToggle(card) {
      card.setAttribute('role', 'button');
      card.setAttribute('aria-expanded', 'false');
      card.setAttribute('tabindex', '0');
      const toggle = () => {
        const open = card.classList.toggle('event-card--open');
        card.setAttribute('aria-expanded', String(open));
      };
      card.addEventListener('click', e => {
        // Évite de déclencher le toggle si on clique sur un lien ou une miniature de photo
        if (e.target.closest('a, img')) return;
        toggle();
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    }

    // ---- Carte événement à venir ----
    // Les détails sont toujours visibles (pas de pli) — les visiteurs veulent voir tout de suite.
    function createCardUp(ev) {
      const d    = evDate(ev);
      const div  = document.createElement('div');
      div.className = 'event-card event-card--upcoming';
      const loc  = ev.location    ? `<div class="event-card-loc">📍 ${esc(ev.location)}</div>` : '';
      const desc = ev.description ? `<div class="event-card-desc">${escDescHtml(ev.description)}</div>` : '';
      div.innerHTML = `
        <div class="event-card-date">
          <div class="event-card-day">${d.getDate()}</div>
          <div class="event-card-month">${_MOIS_C[d.getMonth()]}</div>
        </div>
        <div class="event-card-body">
          <div class="event-card-fulldate">${esc(fullDate(ev))}</div>
          <div class="event-card-title">${esc(ev.summary||'')}</div>
          ${loc}${desc}
        </div>`;
      return div;
    }

    // ---- Carte événement passé ----
    function createCardPast(ev) {
      const d   = evDate(ev);
      const div = document.createElement('div');
      div.className = 'event-card event-card--past';
      const loc  = ev.location    ? ` · ${esc(ev.location)}` : '';
      const desc = ev.description ? `<div class="event-card-desc">${escDescHtml(ev.description)}</div>` : '';
      div.innerHTML = `
        <div class="event-card-inner">
          <div class="event-card-date">
            <div class="event-card-day">${d.getDate()}</div>
            <div class="event-card-month">${_MOIS_C[d.getMonth()]}</div>
          </div>
          <div class="event-card-body">
            <div class="event-card-title">${esc(ev.summary||'')}</div>
            <div class="event-card-fulldate">${_JOURS[d.getDay()]} ${d.getDate()} ${_MOIS_L[d.getMonth()]} ${d.getFullYear()}${loc}</div>
            <div class="event-card-details">${desc}</div>
          </div>
          <span class="event-card-chevron" aria-hidden="true">▾</span>
        </div>`;
      // Les événements passés sont toujours cliquables (photos potentielles à révéler)
      bindCardToggle(div);
      return div;
    }

    // ---- Rendu (à venir puis dernier passé en grisé) ----
    if (upEl) {
      upEl.innerHTML = '';
      if (!upcoming.length && !lastPast.length) {
        upEl.innerHTML = '<p style="color:#888;font-style:italic;padding:6px 0;">Aucun concert annoncé pour le moment. Abonnez-vous à la <a href="#footer" style="color:var(--accent-color-primary);">newsletter</a> pour être informé·e !</p>';
      } else {
        upcoming.forEach(ev => upEl.appendChild(createCardUp(ev)));
        // 3 derniers événements passés à la fin, en grisé
        lastPast.forEach(ev => {
          const card   = createCardPast(ev);
          const photos = photosByKey['id:' + ev.id] || photosByKey['name:' + concertKey(ev)] || [];
          // Les miniatures vont dans .event-card-details pour qu'elles s'affichent au clic
          if (photos.length) {
            const details = card.querySelector('.event-card-details');
            if (details) details.appendChild(createThumbs(photos));
            else card.appendChild(createThumbs(photos));
          }
          upEl.appendChild(card);
        });
      }
    }
  }

  // ---------------------------------------------------------------
  // Playlist YouTube : grille de 6 vignettes + lightbox au clic
  // ---------------------------------------------------------------
  async function loadYoutubePlaylist(grid, playlistId, limit) {
    if (!grid || grid.dataset.initialized === '1') return;
    grid.dataset.initialized = '1';

    const KEY = (typeof window !== 'undefined' && window.YT_API_KEY) || 'AIzaSyDkjr4VKTHb1mzjUL_smPZslusM538Pbes';
    const url = 'https://www.googleapis.com/youtube/v3/playlistItems'
      + '?part=snippet&maxResults=50'
      + '&playlistId=' + encodeURIComponent(playlistId)
      + '&key=' + KEY;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.error || !data.items) {
        grid.innerHTML = '<p class="insta-fallback">Impossible de charger la playlist YouTube.</p>';
        console.warn('YouTube API error', data.error);
        return;
      }
      // Trie par date d'ajout dans la playlist, plus récent en premier
      const items = data.items
        .filter(it => it.snippet && it.snippet.resourceId && it.snippet.resourceId.videoId)
        .sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt))
        .slice(0, limit);

      if (!items.length) {
        grid.innerHTML = '<p class="insta-fallback">Aucune vidéo dans cette playlist pour le moment.</p>';
        return;
      }

      const esc = s => (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] || c));
      grid.innerHTML = items.map(it => {
        const v = it.snippet.resourceId.videoId;
        const t = esc(it.snippet.title || '');
        const thumbs = it.snippet.thumbnails || {};
        const thumb  = (thumbs.medium && thumbs.medium.url)
                    || (thumbs.high   && thumbs.high.url)
                    || (thumbs.default && thumbs.default.url) || '';
        return `
          <button class="yt-item" type="button" data-video-id="${v}" aria-label="Lire : ${t}">
            <img src="${thumb}" alt="${t}" loading="lazy" decoding="async">
            <span class="yt-play" aria-hidden="true"></span>
          </button>`;
      }).join('');

      grid.querySelectorAll('.yt-item').forEach(btn => {
        btn.addEventListener('click', () => openYoutubeLightbox(btn.dataset.videoId));
      });
    } catch (e) {
      grid.innerHTML = '<p class="insta-fallback">Impossible de charger la playlist YouTube.</p>';
      console.warn('YouTube fetch failed', e);
    }
  }

  function ensureYoutubeLightbox() {
    let lb = document.getElementById('yt-lightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.id = 'yt-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Lecteur vidéo YouTube');
    lb.innerHTML = `
      <button id="yt-lb-close" type="button" aria-label="Fermer">&times;</button>
      <div class="yt-lb-frame"><iframe id="yt-lb-iframe" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    document.body.appendChild(lb);
    const close = () => {
      lb.classList.remove('open');
      document.body.style.overflow = '';
      const f = document.getElementById('yt-lb-iframe');
      if (f) f.src = ''; // stoppe la vidéo
    };
    lb.querySelector('#yt-lb-close').addEventListener('click', close);
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && lb.classList.contains('open')) close(); });
    return lb;
  }

  function openYoutubeLightbox(videoId) {
    const lb = ensureYoutubeLightbox();
    const f = document.getElementById('yt-lb-iframe');
    f.src = 'https://www.youtube.com/embed/' + encodeURIComponent(videoId) + '?autoplay=1&rel=0&modestbranding=1';
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function initYoutubeGrids() {
    document.querySelectorAll('.youtube-grid[data-playlist]').forEach(grid => {
      const playlist = grid.getAttribute('data-playlist');
      const limit = parseInt(grid.getAttribute('data-limit') || '6', 10);
      loadYoutubePlaylist(grid, playlist, limit);
    });
  }
  if (typeof window !== 'undefined') window.initYoutubeGrids = initYoutubeGrids;

  function generatePageContent(pageId) {
    // L'espace choristes (partitions) a un contenu spécifique géré dans sa page dédiée
    if (pageId === 'partitions') {
      // Assure les titres dynamiques; le reste est géré par espace-choristes.html
      return;
    }
    const page = pagesData.find(p => p.id === pageId);
    const contentContainer = document.getElementById('page-content-container');
    // If the page contains a static, hand-authored body (data-static="true"),
    // respect it and do not inject dynamic content. This avoids duplications
    // like the portrait audio block which is already present in the static HTML.
    try {
      if (contentContainer && contentContainer.getAttribute && contentContainer.getAttribute('data-static') === 'true') {
        console.info('[INFO] Page provides static content; skipping dynamic injection for', pageId);
        return;
      }
    } catch (e) { /* ignore and proceed with dynamic rendering */ }
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

    // ====================================================================
    // SOUL : layout dédié (présentation + calendrier SOUL + Insta + YouTube)
    // ====================================================================
    if (pageId === 'soul') {
      // Présentation (paragraphes page_content + photo d'illustration)
      if (Array.isArray(page.page_content) && page.page_content.length) {
        const intro = document.createElement('div');
        intro.className = 'soul-intro';

        const textCol = document.createElement('div');
        textCol.className = 'soul-intro-text';
        page.page_content.forEach(txt => {
          if (!txt || !txt.trim()) return;
          const p = document.createElement('p');
          p.textContent = txt;
          textCol.appendChild(p);
        });

        const imgCol = document.createElement('div');
        imgCol.className = 'soul-intro-image';
        imgCol.innerHTML = `<img src="${ASSETS_BASE_URL}images/soul-presentation.jpg" alt="SOUL en répétition à Rennes" loading="lazy" decoding="async">`;

        intro.appendChild(textCol);
        intro.appendChild(imgCol);
        contentContainer.appendChild(intro);
      }

      // Calendrier des événements SOUL (même modèle que l'accueil)
      const SOUL_CAL_ID = '566b739a047c4ccbdfaef5b1c27f57bd9810a47c22294678e1ed5cb74fc2e5ce@group.calendar.google.com';
      loadHomeEvents(contentContainer, {
        calendarId: SOUL_CAL_ID,
        showThumbs: false,
        sectionId: 'soul-evenements',
        subtitle: 'Prochaines dates de SOUL à Rennes et alentours.'
      });

      // Instagram SOUL (Behold) — compte séparé via window.BEHOLD_SOUL_FEED_ID
      const insta = document.createElement('section');
      insta.className = 'insta-section';
      insta.setAttribute('aria-label', 'Actualités Instagram SOUL');
      const soulFeedId = (typeof window !== 'undefined' && window.BEHOLD_SOUL_FEED_ID && !window.BEHOLD_SOUL_FEED_ID.startsWith('VOTRE_ID')) ? window.BEHOLD_SOUL_FEED_ID : '';
      insta.innerHTML = `
        <div class="home-section-divider"><h2>SOUL sur Insta — Actualités</h2></div>
        ${soulFeedId ? `<behold-widget feed-id="${soulFeedId}"></behold-widget>` : `<p class="insta-fallback">Flux Instagram SOUL bientôt disponible.</p>`}`;
      contentContainer.appendChild(insta);
      // Charge le script Behold à la volée si nécessaire
      if (soulFeedId && !document.querySelector('script[data-behold]')) {
        const s = document.createElement('script');
        s.type = 'module';
        s.src = 'https://w.behold.so/widget.js';
        s.setAttribute('data-behold', '');
        document.head.appendChild(s);
      }

      // Playlist YouTube SOUL
      const yt = document.createElement('section');
      yt.className = 'youtube-section';
      yt.setAttribute('aria-label', 'Nos enregistrements YouTube SOUL');
      yt.innerHTML = `
        <div class="home-section-divider"><h2>SOUL sur YouTube — Enregistrements</h2></div>
        <div class="youtube-grid" data-playlist="PLrXSL-oTlPbY4oyR-Kic48Fu_UWhQSR2o" data-limit="6" aria-live="polite">
          <div class="youtube-skeleton"></div>
          <div class="youtube-skeleton"></div>
          <div class="youtube-skeleton"></div>
          <div class="youtube-skeleton"></div>
          <div class="youtube-skeleton"></div>
          <div class="youtube-skeleton"></div>
        </div>`;
      contentContainer.appendChild(yt);
      if (typeof initYoutubeGrids === 'function') initYoutubeGrids();
      if (typeof syncSoulYoutubeGapToBehold === 'function') syncSoulYoutubeGapToBehold();

      // Émet l'événement pour le footer SOUL custom + sortie : on ne fait pas le rendu générique
      try { document.dispatchEvent(new CustomEvent('site:content-rendered', { detail: { pageId } })); } catch(e) {}
      return;
    }

      if ((page.page_content && page.page_content.length > 0) || pageId === 'nous-rejoindre') {
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
              <img src="${imgJpg}" alt="${page.page_title} - La Voix Libre, Rennes" class="page-hero-image" loading="lazy" decoding="async" style="width:380px;height:auto;object-fit:cover;border-radius:12px;">
            `;
            descriptionContainer.appendChild(pic);
          }
          const textDiv = document.createElement('div');
          textDiv.classList.add('description-text');
          textDiv.style.width = '100%';
          textDiv.style.textAlign = 'justify';
          // If the page_content contains heading-like entries (user expects sections),
          // try to turn them into H2 + paragraphs. Fallback: render as plain paragraphs.
          function isHeadingLike(s) {
            if (!s || typeof s !== 'string') return false;
            const trimmed = s.trim();
            if (trimmed.length === 0) return false;
            // Heuristic: short string, starts with uppercase (including accented), not ending with a period
            if (trimmed.length > 80) return false;
            if (/\.$/.test(trimmed)) return false;
            return /^[A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜÇŒ][\w\s'’\-\u00C0-\u017F]+$/.test(trimmed);
          }

          if (pageId === 'cours-de-chant') {
            // Build sections from page.page_content when possible
            let i = 0;
            while (i < page.page_content.length) {
              const current = (page.page_content[i] || '').trim();
              if (isHeadingLike(current)) {
                const h2 = document.createElement('h2');
                h2.textContent = current;
                h2.style.marginTop = '0';
                h2.style.color = '#133';
                h2.style.fontWeight = '800';
                h2.style.letterSpacing = '0.2px';
                textDiv.appendChild(h2);
                // consume following paragraphs until next heading-like or end
                let j = i + 1;
                while (j < page.page_content.length && !isHeadingLike(page.page_content[j])) {
                  const paragraph = document.createElement('p');
                  paragraph.textContent = page.page_content[j] || '';
                  textDiv.appendChild(paragraph);
                  j++;
                }
                i = j;
                continue;
              }
              // Fallback: plain paragraph
              const pElement = document.createElement('p');
              pElement.textContent = current;
              textDiv.appendChild(pElement);
              i++;
            }
          } else {
            page.page_content.forEach(pText => {
              const pElement = document.createElement('p');
              pElement.textContent = pText;
              textDiv.appendChild(pElement);
            });
          }

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
              // Avoid adding the audio if an identical player already exists on the page
              const existingAudio = document.querySelector(`audio[src="${audioBlock.url}"]`);
              if (existingAudio) {
                console.info('[AUDIO] Le fichier audio est d\u00e9j\u00e0 pr\u00e9sent sur la page, saut de l\'injection.');
              } else {
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
              }

              // (Autoplay direct retiré pour compatibilité navigateurs; la relance muette ci-dessus suffit.)
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
          // Intro centrée
          if (Array.isArray(page.page_content)) {
            const intro = document.createElement('div');
            intro.style.cssText = 'max-width:720px;margin:0 auto 32px auto;text-align:center;';
            page.page_content.forEach(pText => {
              if (!pText || !pText.trim()) return;
              const p = document.createElement('p');
              p.className = 'home-intro-text';
              p.style.textAlign = 'center';
              p.textContent = pText;
              intro.appendChild(p);
            });
            contentContainer.appendChild(intro);
          }

          // Sections sous forme de cartes (style page d'accueil)
          const sectionsBlock = page.specific_content && page.specific_content.find(sc => sc.type === 'sections');
          if (sectionsBlock && Array.isArray(sectionsBlock.items)) {
            sectionsBlock.items.forEach(section => {
              const card = document.createElement('div');
              card.className = 'nr-card';
              if (section.anchor) card.id = section.anchor;

              // Image
              if (section.image) {
                const imgJpg  = `${ASSETS_BASE_URL}images/${section.image}`;
                const imgWebp = imgJpg.replace(/\.[a-zA-Z0-9]+$/, '.webp');
                const imgWrap = document.createElement('div');
                imgWrap.className = 'nr-card-img';
                imgWrap.innerHTML = `<picture><source srcset="${imgWebp}" type="image/webp"><img src="${imgJpg}" alt="${section.title||''}" loading="lazy" decoding="async"></picture>`;
                card.appendChild(imgWrap);
              }

              // Corps
              const body = document.createElement('div');
              body.className = 'nr-card-body';

              const h2 = document.createElement('h2');
              h2.className = 'nr-card-title';
              h2.textContent = section.title || '';
              body.appendChild(h2);

              if (section.description) {
                const p = document.createElement('p');
                p.className = 'nr-card-desc';
                p.textContent = section.description;
                body.appendChild(p);
              }

              // Détails -> chips (icône selon le mot-clé)
              if (Array.isArray(section.details) && section.details.length) {
                const chipIcons = { lieu:'📍', horaires:'🗓', horaire:'🗓', tarif:'💶', tarifs:'💶', inscription:'✏️' };
                const chips = document.createElement('div');
                chips.className = 'nr-card-chips';
                section.details.forEach(d => {
                  const idx = d.indexOf(':');
                  const key = (idx > -1 ? d.slice(0, idx) : '').trim().toLowerCase();
                  const val = idx > -1 ? d.slice(idx + 1).trim() : d.trim();
                  if (!val) return;
                  const chip = document.createElement('span');
                  chip.className = 'nr-chip';
                  chip.textContent = (chipIcons[key] || '•') + ' ' + val;
                  chips.appendChild(chip);
                });
                body.appendChild(chips);
              }

              // CTA + newsletter sur une ligne d'actions
              const actions = document.createElement('div');
              actions.className = 'nr-card-actions';
              if (section.cta && section.cta.url) {
                const cta = document.createElement('a');
                cta.href = section.cta.url;
                cta.className = 'home-cta-btn';
                cta.textContent = (section.cta.text || 'En savoir plus') + ' →';
                actions.appendChild(cta);
              }
              if (section.contactEmail) {
                const mail = document.createElement('a');
                mail.href = 'mailto:' + section.contactEmail;
                mail.className = 'nr-link';
                mail.textContent = 'Nous contacter';
                actions.appendChild(mail);
              }
              if (section.newsletter) {
                const nl = document.createElement('a');
                nl.href = '#newsletter';
                nl.className = 'nr-link';
                nl.textContent = 'Newsletter';
                actions.appendChild(nl);
              }
              if (actions.children.length) body.appendChild(actions);

              card.appendChild(body);
              contentContainer.appendChild(card);
            });
          }

          // FAQ en accordéon
          const faqBlock = page.specific_content && page.specific_content.find(sc => sc.type === 'faq');
          if (faqBlock && Array.isArray(faqBlock.items) && faqBlock.items.length) {
            const divider = document.createElement('div');
            divider.className = 'home-section-divider';
            divider.innerHTML = `<h2>${faqBlock.title || 'Questions fréquentes'}</h2>`;
            contentContainer.appendChild(divider);

            const faqWrap = document.createElement('div');
            faqWrap.className = 'nr-faq';
            faqBlock.items.forEach(item => {
              const sepIdx = item.search(/\?\s/);
              const q = sepIdx > -1 ? item.slice(0, sepIdx + 1) : item;
              const a = sepIdx > -1 ? item.slice(sepIdx + 2).trim() : '';
              const it = document.createElement('div');
              it.className = 'nr-faq-item';
              const qEl = document.createElement('button');
              qEl.className = 'nr-faq-q';
              qEl.type = 'button';
              qEl.textContent = q;
              const aEl = document.createElement('div');
              aEl.className = 'nr-faq-a';
              aEl.textContent = a || item;
              qEl.addEventListener('click', () => it.classList.toggle('open'));
              it.appendChild(qEl);
              it.appendChild(aEl);
              faqWrap.appendChild(it);
            });
            contentContainer.appendChild(faqWrap);
          }

          // ---- Séances d'essai ----
          (function() {
            const TRYOUT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwnHOsGXoPiesDXlexMoKGscnEvnvOCyNmZzCND03KhU4dl5mDPzzbD5TNG318kodwk/exec';
            const TRYOUT_DATES = [
              { value: '14 septembre 2025', label: 'Dimanche 14 septembre à 19h30' },
              { value: '21 septembre 2025', label: 'Dimanche 21 septembre à 19h30' }
            ];
            const TRYOUT_LIEU = '47b rue Papu, Rennes (Avenir de Rennes)';

            const essaiSection = document.createElement('section');
            essaiSection.className = 'nr-essai';
            essaiSection.id = 'seances-essai';
            essaiSection.style.cssText = 'scroll-margin-top:80px;margin-bottom:40px;';
            essaiSection.innerHTML = `
              <div class="home-section-divider"><h2>Venir essayer avant de s'inscrire</h2></div>
              <div class="nr-essai-card">
                <div class="nr-essai-intro">
                  <p>Nous recommandons de venir à une séance d'essai avant de vous inscrire officiellement — l'inscription étant définitive, c'est l'occasion idéale de découvrir l'ambiance, le répertoire et l'équipe.</p>
                  <p><strong>L'essai est gratuit</strong>, mais l'inscription préalable est obligatoire pour organiser l'accueil.</p>
                </div>
                <div class="nr-essai-dates">
                  <div class="nr-essai-date-item">
                    <span class="nr-essai-date-icon" aria-hidden="true">🗓</span>
                    <div><strong>Dimanche 14 septembre</strong> à 19h30</div>
                  </div>
                  <div class="nr-essai-date-item">
                    <span class="nr-essai-date-icon" aria-hidden="true">🗓</span>
                    <div><strong>Dimanche 21 septembre</strong> à 19h30</div>
                  </div>
                  <div class="nr-essai-date-item">
                    <span class="nr-essai-date-icon" aria-hidden="true">📍</span>
                    <div>${TRYOUT_LIEU}</div>
                  </div>
                </div>
                <button type="button" class="home-cta-btn nr-essai-btn" id="open-tryout-form">S'inscrire à une séance d'essai →</button>
              </div>`;
            contentContainer.appendChild(essaiSection);

            // ---- Modal formulaire ----
            function buildTryoutModal() {
              if (document.getElementById('tryout-overlay')) return;
              const overlay = document.createElement('div');
              overlay.id = 'tryout-overlay';
              overlay.className = 'tryout-overlay';
              overlay.setAttribute('role', 'dialog');
              overlay.setAttribute('aria-modal', 'true');
              overlay.setAttribute('aria-labelledby', 'tryout-dialog-title');
              overlay.innerHTML = `
                <div class="tryout-dialog" id="tryout-dialog">
                  <button type="button" class="tryout-close" id="tryout-close" aria-label="Fermer">&times;</button>
                  <h3 id="tryout-dialog-title" style="margin:0 0 16px 0;font-family:'Lobster',cursive;color:var(--accent-color-complementary);font-size:1.4rem;">Séance d'essai — La Voix Libre</h3>
                  <form id="tryout-form" novalidate>
                    <div class="tryout-field-row">
                      <div class="tryout-field">
                        <label for="tryout-prenom">Prénom <span aria-hidden="true">*</span></label>
                        <input type="text" id="tryout-prenom" name="prenom" required autocomplete="given-name">
                      </div>
                      <div class="tryout-field">
                        <label for="tryout-nom">Nom <span aria-hidden="true">*</span></label>
                        <input type="text" id="tryout-nom" name="nom" required autocomplete="family-name">
                      </div>
                    </div>
                    <div class="tryout-field">
                      <label for="tryout-email">Email <span aria-hidden="true">*</span></label>
                      <input type="email" id="tryout-email" name="email" required autocomplete="email">
                    </div>
                    <div class="tryout-field">
                      <label for="tryout-telephone">Téléphone <span aria-hidden="true">*</span></label>
                      <input type="tel" id="tryout-telephone" name="telephone" required autocomplete="tel">
                    </div>
                    <div class="tryout-field">
                      <label for="tryout-date">Date souhaitée <span aria-hidden="true">*</span></label>
                      <select id="tryout-date" name="date" required>
                        <option value="" disabled selected>Choisir une date…</option>
                        ${TRYOUT_DATES.map(d => `<option value="${d.value}">${d.label}</option>`).join('')}
                      </select>
                    </div>
                    <div class="tryout-field">
                      <label for="tryout-message">Message (optionnel)</label>
                      <textarea id="tryout-message" name="message" rows="3" placeholder="Une question, une info utile…"></textarea>
                    </div>
                    <div id="tryout-error" style="display:none;color:#c0392b;font-size:.9rem;margin-bottom:8px;" role="alert"></div>
                    <div class="egm-submit-row">
                      <button type="submit" id="egm-submit" class="home-cta-btn">Envoyer ma demande</button>
                      <span id="tryout-spinner" style="display:none;font-size:.9rem;color:#888;">Envoi…</span>
                    </div>
                  </form>
                  <div id="egm-confirm" style="display:none;text-align:center;padding:20px 0;">
                    <p style="font-size:1.1rem;font-weight:600;color:var(--accent-color-complementary);">✅ Inscription enregistrée !</p>
                    <p style="color:#444;">Vous recevrez un email de confirmation. À très vite !</p>
                  </div>
                </div>`;
              document.body.appendChild(overlay);

              const close = () => { overlay.style.display = 'none'; document.body.style.overflow = ''; };
              overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
              overlay.querySelector('#tryout-close').addEventListener('click', close);
              document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.style.display !== 'none') close(); });

              overlay.querySelector('#tryout-form').addEventListener('submit', async function(e) {
                e.preventDefault();
                const form = this;
                const errEl = document.getElementById('tryout-error');
                const spinner = document.getElementById('tryout-spinner');
                const submitBtn = document.getElementById('egm-submit');
                errEl.style.display = 'none';

                const prenom    = form.prenom.value.trim();
                const nom       = form.nom.value.trim();
                const email     = form.email.value.trim();
                const telephone = form.telephone.value.trim();
                const date      = form.date.value;
                if (!prenom || !nom || !email || !telephone || !date) {
                  errEl.textContent = 'Merci de remplir tous les champs obligatoires.';
                  errEl.style.display = 'block';
                  return;
                }

                spinner.style.display = 'inline';
                submitBtn.disabled = true;

                try {
                  const payload = JSON.stringify({
                    action: 'tryout',
                    prenom, nom, email,
                    telephone,
                    date, pupitre: '',
                    message: form.message.value.trim(),
                    ts: new Date().toISOString()
                  });
                  await fetch(TRYOUT_ENDPOINT, {
                    method: 'POST',
                    body: new URLSearchParams({ data: payload }),
                    mode: 'no-cors'
                  });
                  form.style.display = 'none';
                  document.getElementById('egm-confirm').style.display = 'block';
                  try { document.dispatchEvent(new CustomEvent('tryout:success')); } catch(ex) {}
                } catch(err) {
                  errEl.textContent = 'Une erreur est survenue. Réessayez ou contactez-nous par email.';
                  errEl.style.display = 'block';
                  submitBtn.disabled = false;
                  spinner.style.display = 'none';
                }
              });
            }

            document.getElementById('open-tryout-form').addEventListener('click', function() {
              buildTryoutModal();
              const overlay = document.getElementById('tryout-overlay');
              overlay.style.display = 'flex';
              document.body.style.overflow = 'hidden';
              setTimeout(() => { const f = overlay.querySelector('#tryout-prenom'); if (f) f.focus(); }, 80);
            });

            // ---- Panneau admin (bureau uniquement) ----
            const role = (function(){ try { return localStorage.getItem('choristesRole') || sessionStorage.getItem('choristesRole'); } catch(e){ return null; } })();
            if (role === 'chef') {
              const TRYOUT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1XdLI0vjHHTWfJ-cfQySQfMAHX3igGK_GZb00tU7Mbqo/edit';
              const adminPanel = document.createElement('div');
              adminPanel.className = 'tryout-admin-panel';
              adminPanel.innerHTML = `
                <div class="tryout-admin-header">
                  <span class="tryout-admin-icon" aria-hidden="true">🔐</span>
                  <strong>Inscriptions reçues — vue bureau</strong>
                </div>
                <div class="tryout-admin-sheet-link">
                  <p>Les inscriptions sont enregistrées directement dans le Google Sheet :</p>
                  <a href="${TRYOUT_SHEET_URL}" target="_blank" rel="noopener noreferrer" class="tryout-admin-sheet-btn">
                    📊 Ouvrir le tableau des inscriptions
                  </a>
                  <p class="tryout-admin-hint">Colonnes : date · prénom · nom · email · téléphone · message · horodatage</p>
                </div>`;
              essaiSection.appendChild(adminPanel);
            }
          })();

          // Widget d'inscription HelloAsso — Saison 2026-2027
          const inscriptionSection = document.createElement('section');
          inscriptionSection.className = 'nr-inscription';
          inscriptionSection.id = 'inscription';
          inscriptionSection.style.cssText = 'scroll-margin-top:80px;margin-top:40px;';

          const inscriptionDivider = document.createElement('div');
          inscriptionDivider.className = 'home-section-divider';
          inscriptionDivider.innerHTML = '<h2>Inscription — Saison 2026-2027</h2>';
          inscriptionSection.appendChild(inscriptionDivider);

          const promoNotice = document.createElement('div');
          promoNotice.className = 'nr-promo-notice';
          promoNotice.innerHTML = `
            <div class="nr-promo-inner">
              <span class="nr-promo-icon" aria-hidden="true">🎉</span>
              <div class="nr-promo-text">
                <strong>Membres actuels de la chorale :</strong> bénéficiez de <strong>18&nbsp;€ de réduction</strong> en vous réinscrivant avant le <strong>13&nbsp;juillet</strong>.
                Saisissez le code promo <strong class="nr-promo-code">PREINSCRIP</strong> lors de votre inscription ci-dessous.
              </div>
            </div>`;
          inscriptionSection.appendChild(promoNotice);

          const haFrame = document.createElement('iframe');
          haFrame.id = 'haWidget';
          haFrame.allowTransparency = true;
          haFrame.scrolling = 'auto';
          haFrame.src = 'https://www.helloasso.com/associations/la-voix-libre-le-chant-incarne/adhesions/la-voix-libre-2026-2027/widget';
          haFrame.style.cssText = 'width:100%;height:750px;border:none;display:block;';
          haFrame.title = 'Formulaire d\'inscription La Voix Libre 2026-2027';
          haFrame.addEventListener('load', function() {
            window.addEventListener('message', function(e) {
              try {
                const dataHeight = e.data && e.data.height;
                if (dataHeight && dataHeight > parseFloat(haFrame.style.height || 0)) {
                  haFrame.style.height = dataHeight + 'px';
                }
              } catch(err) {}
            });
          });
          inscriptionSection.appendChild(haFrame);
          contentContainer.appendChild(inscriptionSection);

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
              <img src="${imgJpg}" alt="${page.page_title} - La Voix Libre, Rennes" class="page-hero-image" loading="lazy" decoding="async">
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
      // Audition form injection for the SOUL page removed per request.
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

  function loadAndDisplayPosts(pageTags, options = {}) {
    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) return;

    if (!postsData || postsData.length === 0) {
      postsContainer.innerHTML = '';
      return;
    }

    const noIllustrations = options && options.noIllustrations;

    // Ensure posts are displayed newest first (by date when available)
    // Use a robust extractor that tolerates multiple field names and common formats
    function extractTimestamp(post) {
      if (!post) return 0;
      const keys = ['date','Date','published','created','timestamp','ts','time'];
      for (const k of keys) {
        let v = post[k];
        if (!v) continue;
        v = String(v).trim();
        // Unix seconds or ms
        if (/^\d{10}$/.test(v)) return Number(v) * 1000;
        if (/^\d{13}$/.test(v)) return Number(v);
        // dd/mm/yyyy or dd-mm-yyyy optionally with time
        const dm = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ T](.*))?$/);
        if (dm) {
          const dd = dm[1].padStart(2,'0');
          const mm = dm[2].padStart(2,'0');
          const yyyy = dm[3];
          const rest = dm[4] ? 'T' + dm[4] : '';
          const iso = `${yyyy}-${mm}-${dd}${rest}`;
          const d = new Date(iso);
          if (!isNaN(d.getTime())) return d.getTime();
        }
        // Try native parsing (ISO formats, RFC etc.)
        const d2 = new Date(v);
        if (!isNaN(d2.getTime())) return d2.getTime();
      }
      return 0;
    }
    try {
      if (Array.isArray(postsData) && postsData.length) {
        postsData.sort((a, b) => extractTimestamp(b) - extractTimestamp(a));
      }
    } catch (err) {
      // Fallback: reverse order if parsing/sort fails
      try { postsData = postsData.slice().reverse(); } catch(e) {}
    }

    let filteredPosts;
    if (!Array.isArray(pageTags) || pageTags.length === 0) {
      // Si aucun tag fourni, afficher tous les posts
      console.warn('[DEBUG] Aucun tag de page fourni à loadAndDisplayPosts, affichage de tous les posts.');
      filteredPosts = postsData;
    } else {
      // Special-case for the "evenements" page: require posts to have
      // - the "evenements" tag AND
      // - either "chorale_pop" or a comédie-related tag
      // This allows posts like [evenements + chorale_pop + soul] to show,
      // but excludes posts that are only [evenements + soul] without chorale_pop/comédie.
      if (pageTags.includes('evenements')) {
        const comedieVariants = ['comedie', 'comédie', 'comédie-musicale', 'comedie-musicale', 'comédie_musicale'];
        filteredPosts = postsData.filter(post => {
          if (!post.tags || !post.tags.includes('evenements')) return false;
          if (post.tags.includes('chorale_pop') || post.tags.includes('chorale-pop')) return true;
          return post.tags.some(t => comedieVariants.includes(t));
        });
        console.log(`[DEBUG] Filtrage spécial 'evenements' (requiert chorale_pop ou comédie). Nombre de posts trouvés: ${filteredPosts.length}`);
      } else {
        // Default behavior: any post matching any of the page tags
        filteredPosts = postsData.filter(post =>
          post.tags && post.tags.some(tag => pageTags.includes(tag))
        );
        console.log(`[DEBUG] Filtrage des posts avec tags: ${JSON.stringify(pageTags)}. Nombre de posts trouvés: ${filteredPosts.length}`);
      }
    }

    // Note: exclusion of posts tagged 'soul' was intentionally removed per request.
    // Posts are now shown/filtered according to the logic above (evenements requires chorale_pop or comédie variants).

    if (filteredPosts.length === 0) {
      postsContainer.innerHTML = '<p style="color:red;">Aucun post à afficher pour ces tags.</p>';
      return;
    }

  // Sort filtered posts newest first using the robust extractor
  filteredPosts.sort((a, b) => extractTimestamp(b) - extractTimestamp(a));
    postsContainer.innerHTML = '';

    filteredPosts.forEach(post => {
      const postElement = document.createElement('article');
      postElement.classList.add('blog-post');

      // Illustrations : image(s) d'abord, puis vidéos
      let illustrations = [];
      if (!noIllustrations) {
        // Support multiple ways to specify images in the CSV:
        // - post.image (string): filename, absolute URL, Google Drive share link, or comma-separated list
        // - post.images (array)
        // - alternative fields: post.illustration, post.illustration_url
        const imageCandidates = [];
        if (post.image) imageCandidates.push(post.image);
        if (post.images && Array.isArray(post.images)) imageCandidates.push(...post.images);
        if (post.illustration) imageCandidates.push(post.illustration);
        if (post.illustration_url) imageCandidates.push(post.illustration_url);

        imageCandidates.forEach(imgField => {
          if (!imgField) return;
          // Split comma-separated lists (CSV authors sometimes list multiple filenames in one cell)
          const parts = ('' + imgField).split(',').map(s => s.trim()).filter(Boolean);
          parts.forEach(p => {
            const src = normalizePostImageSrc(p);
            // prepare an assets fallback (useful when hosting serves files under a subpath)
            const assetsFallback = `${ASSETS_BASE_URL}images/${p}`;
            illustrations.push({ type: 'image', src, fallback: (assetsFallback !== src ? [assetsFallback] : []) });
          });
        });

        // Videos (YouTube): same as before
        if (Array.isArray(post.videos) && post.videos.length > 0) {
          post.videos.forEach(function(videoObj) {
            let url = typeof videoObj === 'string' ? videoObj : videoObj.url;
            illustrations.push({ type: 'video', src: convertToEmbedUrl(url) });
          });
        } else if (post.video_url) {
          illustrations.push({ type: 'video', src: convertToEmbedUrl(post.video_url) });
        }
      }

      // Build the illustrations column (stacked vertically)
      let illustrationsHTML = illustrations.map(ill => {
        if (ill.type === 'image') {
          // Render a small transparent placeholder initially and defer actual loading to JS
          const placeholder = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
          const fallbackAttr = (ill.fallback && ill.fallback.length) ? ` data-fallback='${JSON.stringify(ill.fallback)}'` : '';
          return `<img data-src="${ill.src}" src="${placeholder}" alt="${post.title}" class="media-illustration" loading="lazy" decoding="async"${fallbackAttr}>`;
        }
        return `<iframe width="100%" height="220" src="${ill.src}" frameborder="0" allowfullscreen class="media-illustration" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      }).join('');

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

      // Exergue lien: affiche un lien visible en haut du post si une colonne 'lien' (ou 'link'/'url') est fournie
      const linkUrl = post.lien || post.link || post.url || post.website;
      if (linkUrl) {
        // Determine display text: prefer a title if provided, default to French friendly text
        const linkText = post.lien_text || post.link_title || post.title_link_text || 'toutes les infos ici';
        postHTML += `<div class="post-link-badge" style="margin-bottom:8px;"><a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#fff;border:1px solid #e6e6e6;padding:8px 12px;border-radius:6px;color:#0b63a7;text-decoration:none;font-weight:600;">${linkText}</a></div>`;
      }
      if (noIllustrations) {
        // Render a single full-width text column for affichages (no media)
        postHTML += `
          <div class="post-wrapper">
            <div class="text-content" style="width:100%;">
              <p>${linkify(post.content)}</p>
            </div>
          </div>
        `;
      } else {
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
      }

      postElement.innerHTML = postHTML;
      postsContainer.appendChild(postElement);
      // After inserting the post, process deferred images to avoid broken icons
      try { processDeferredImages(postElement); } catch (e) { console.warn('processDeferredImages failed', e); }
    });
  }

  // Deferred image loader: tries primary URL, then fallback; hides image if both fail
  function processDeferredImages(root) {
    const imgs = (root || document).querySelectorAll('img[data-src]');
    imgs.forEach(imgEl => {
      // avoid re-processing
      if (imgEl.dataset._loading === '1') return;
      imgEl.dataset._loading = '1';
      const src = imgEl.dataset.src;
      const fallbackAttr = imgEl.dataset.fallback || '';
      // If fallbackAttr holds a JSON array (we stored multiple fallbacks), parse it
      let fallbacks = [];
      try {
        if (fallbackAttr.startsWith('[')) fallbacks = JSON.parse(fallbackAttr);
        else if (fallbackAttr) fallbacks = [fallbackAttr];
      } catch (e) { fallbacks = fallbackAttr ? [fallbackAttr] : []; }

      const tryLoadChain = (urls) => {
        if (!urls || urls.length === 0) { imgEl.style.display = 'none'; return; }
        const url = urls[0];
            const tester = new Image();
            let timedOut = false;
            const to = setTimeout(() => { timedOut = true; tester.onerror(); }, 8000);
            tester.onload = function() {
              clearTimeout(to);
              // determine orientation from natural dimensions
              try {
                const w = tester.naturalWidth || tester.width || 0;
                const h = tester.naturalHeight || tester.height || 0;
                if (w && h && imgEl.classList) {
                  if (h > w) {
                    imgEl.classList.add('media-portrait');
                    imgEl.classList.remove('media-landscape');
                  } else {
                    imgEl.classList.add('media-landscape');
                    imgEl.classList.remove('media-portrait');
                  }
                }
              } catch (ee) {}
              imgEl.src = url;
              imgEl.style.display = '';
            };
            tester.onerror = function() {
              clearTimeout(to);
              // try next
              tryLoadChain(urls.slice(1));
            };
            try { tester.src = url; } catch (e) { clearTimeout(to); tryLoadChain(urls.slice(1)); }
      };

      if (!src) { imgEl.style.display = 'none'; return; }
      const primary = [src];
      // If fallbackAttr is empty and the src is a Drive link, ask driveFallbackForSrc
      if (fallbacks.length === 0 && src.includes('drive.google.com')) {
        try { fallbacks = driveFallbackForSrc(src); } catch (e) { fallbacks = []; }
      }
      // Build chain: primary first, then fallbacks
      const chain = primary.concat(fallbacks || []);
      tryLoadChain(chain);
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

  // ====================================================
  // Schemas réutilisables (générés une seule fois par page)
  // ====================================================
  const logoUrl = (globalConfig?.find(i => i.section==='head' && i.champ==='logo_url')?.valeur) || '';
  const logoAbs = logoUrl ? (origin ? origin + (logoUrl.startsWith('/') ? logoUrl : '/' + logoUrl) : logoUrl) : '';
  const email   = (globalConfig?.find(i => i.section==='footer' && i.champ==='email')?.valeur) || '';
  const sameAsLVL = [];
  ['facebook','instagram','youtube'].forEach(k => {
    const v = globalConfig?.find(i => i.section==='footer' && i.champ===k)?.valeur;
    if (v) sameAsLVL.push(v);
  });

  const ADDR_PAPU = {
    '@type': 'PostalAddress',
    streetAddress: '47b rue Papu',
    addressLocality: 'Rennes',
    postalCode: '35000',
    addressCountry: 'FR'
  };
  const PLACE_RENNES = { '@type': 'Place', name: 'Rennes, Bretagne, France', address: ADDR_PAPU };

  const PERSON_VINCENT = {
    '@type': 'Person',
    '@id': (origin || '') + '/vincent.html#person',
    name: 'Vincent T-Dauberlieu',
    alternateName: 'Vincent Tricotel',
    givenName: 'Vincent',
    familyName: 'T-Dauberlieu',
    jobTitle: 'Chef de chœur, pédagogue vocal',
    description: "Chef de chœur de La Voix Libre depuis 2017 et de S.O.U.L. depuis 2019, professeur de chant à Rennes. Plus de 10 ans d'études vocales en France et en Allemagne (conservatoires, maisons d'opéra, cabarets).",
    knowsAbout: ['Direction de chœur', 'Pédagogie vocale', 'Chant lyrique', 'Chant soul', 'Anatomie de la voix', 'Pédagogie AFCM'],
    image: origin ? origin + '/assets/images/courschant.jpg' : '/assets/images/courschant.jpg',
    url: (origin || '') + '/vincent.html'
  };

  const MUSIC_GROUP_LVL = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    '@id': (origin || 'https://chanterlavoixlibre.fr') + '/#musicgroup-lvl',
    name: 'La Voix Libre',
    alternateName: ['Chorale La Voix Libre', 'Chœur La Voix Libre Rennes'],
    description: "Chœur rennais fondé en mars 2017, composé d'environ 80 chanteur·euse·s passionné·e·s, débutant·e·s comme confirmé·e·s. Répertoire pop, gospel, soul, chants du monde, chanson française.",
    genre: ['Chorale', 'Pop', 'Gospel', 'Soul', 'Chant du monde', 'Chant choral'],
    foundingDate: '2017-03',
    foundingLocation: PLACE_RENNES,
    location: PLACE_RENNES,
    url: 'https://chanterlavoixlibre.fr/',
    logo: logoAbs || undefined,
    image: logoAbs || undefined,
    email: email || undefined,
    director: PERSON_VINCENT,
    sameAs: sameAsLVL.length ? sameAsLVL : undefined
  };

  const MUSIC_GROUP_SOUL = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    '@id': 'https://soulrennes.fr/#musicgroup-soul',
    name: 'S.O.U.L.',
    alternateName: ['SOUL Rennes', 'Ensemble vocal SOUL Rennes', 'Chorale SOUL Rennes'],
    description: "Ensemble vocal a cappella rennais fondé en 2019, sous la direction de Vincent T-Dauberlieu. Répertoire soul, funk, gospel, jazz, pop. Auditions chaque année en septembre.",
    genre: ['A cappella', 'Soul', 'Funk', 'Gospel', 'Jazz', 'Pop'],
    foundingDate: '2019',
    foundingLocation: PLACE_RENNES,
    location: PLACE_RENNES,
    url: 'https://soulrennes.fr/',
    logo: (origin || '') + '/assets/images/soullogo.png',
    image: (origin || '') + '/assets/images/soullogo.png',
    director: PERSON_VINCENT
  };

  const MUSIC_SCHOOL = {
    '@context': 'https://schema.org',
    '@type': ['MusicSchool', 'LocalBusiness'],
    '@id': (origin || 'https://chanterlavoixlibre.fr') + '/#musicschool',
    name: 'La Voix Libre — chorale et cours de chant à Rennes',
    description: "Association rennaise (loi 1901) proposant des chorales (La Voix Libre, S.O.U.L., comédie musicale) et des cours individuels de chant lyrique, jazz et pop avec Vincent T-Dauberlieu.",
    url: origin || 'https://chanterlavoixlibre.fr/',
    logo: logoAbs || undefined,
    image: logoAbs || undefined,
    email: email || undefined,
    address: ADDR_PAPU,
    areaServed: ['Rennes', 'Ille-et-Vilaine', 'Bretagne'],
    founder: PERSON_VINCENT,
    employee: PERSON_VINCENT,
    sameAs: sameAsLVL.length ? sameAsLVL : undefined
  };

  // ====================================================
  // Injection ciblée selon la page
  // ====================================================
  if (currentPageId === 'index') {
    upsertJsonLd('ld-musicschool', MUSIC_SCHOOL);
    upsertJsonLd('ld-musicgroup-lvl', MUSIC_GROUP_LVL);
    upsertJsonLd('ld-person-vincent', { '@context': 'https://schema.org', ...PERSON_VINCENT });
  } else if (currentPageId === 'soul') {
    upsertJsonLd('ld-musicgroup-soul', MUSIC_GROUP_SOUL);
    upsertJsonLd('ld-person-vincent', { '@context': 'https://schema.org', ...PERSON_VINCENT });
  } else if (currentPageId === 'vincent' || currentPageId === 'cours-de-chant' || currentPageId === 'cours-de-chant-lyrique-rennes') {
    upsertJsonLd('ld-musicschool', MUSIC_SCHOOL);
    upsertJsonLd('ld-person-vincent', { '@context': 'https://schema.org', ...PERSON_VINCENT });
  } else if (currentPageId === 'chorale-pop' || currentPageId === 'chorale-rennes') {
    upsertJsonLd('ld-musicgroup-lvl', MUSIC_GROUP_LVL);
    upsertJsonLd('ld-musicschool', MUSIC_SCHOOL);
  } else if (currentPageId === 'evenements') {
    upsertJsonLd('ld-musicgroup-lvl', MUSIC_GROUP_LVL);
  }

  // Expose les objets pour que loadHomeEvents puisse créer des Event reliés
  if (typeof window !== 'undefined') {
    window.__LD_CONTEXT = {
      origin,
      musicGroupLVL: MUSIC_GROUP_LVL,
      musicGroupSOUL: MUSIC_GROUP_SOUL,
      musicSchool: MUSIC_SCHOOL,
      addrPapu: ADDR_PAPU,
      upsertJsonLd
    };
  }
}

// Injecte une liste d'événements Schema.org (ItemList de Event) — appelée après loadHomeEvents
function injectEventsJsonLd(events, ensembleKey) {
  const ctx = (typeof window !== 'undefined') ? window.__LD_CONTEXT : null;
  if (!ctx || !Array.isArray(events) || !events.length) return;
  const performer = ensembleKey === 'soul' ? ctx.musicGroupSOUL : ctx.musicGroupLVL;
  const performerLite = { '@type': 'MusicGroup', name: performer.name, url: performer.url };

  const items = events.slice(0, 50).map((ev, i) => {
    const start = ev.start && (ev.start.dateTime || ev.start.date);
    const end   = ev.end   && (ev.end.dateTime   || ev.end.date);
    if (!start) return null;
    // Lieu : si l'agenda fournit ev.location, on l'utilise, sinon adresse par défaut
    const placeName = (ev.location || '').trim() || 'Rennes';
    const place = {
      '@type': 'Place',
      name: placeName,
      address: ev.location ? { '@type': 'PostalAddress', addressLocality: 'Rennes', addressCountry: 'FR' } : ctx.addrPapu
    };
    // URL unique par événement (requis par Google pour les Carrousels d'événements)
    const evIdSafe = (ev.id || String(i)).replace(/[^a-zA-Z0-9_-]/g, '');
    const evUrl = (ctx.origin || '') + '/#event-' + evIdSafe;
    const description = (ev.description || '').replace(/<[^>]+>/g, '').trim();
    return {
      '@type': 'Event',
      '@id': evUrl,
      url: evUrl,
      name: ev.summary || 'Concert',
      startDate: start,
      endDate: end || undefined,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: place,
      image: performer.logo || performer.image || undefined,
      performer: performerLite,
      organizer: { '@type': 'Organization', name: 'La Voix Libre', url: 'https://chanterlavoixlibre.fr/' },
      description: description || ((ev.summary || 'Concert') + ' — La Voix Libre, Rennes.'),
      offers: {
        '@type': 'Offer',
        url: evUrl,
        price: '0',
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        validFrom: start
      }
    };
  }).filter(Boolean);

  if (!items.length) return;
  // Google n'aime pas ItemList comme conteneur Carousel d'Events.
  // On expose chaque Event en JSON-LD séparé (ce qui rend chaque concert éligible aux résultats enrichis d'Événements).
  items.forEach((ev, i) => {
    ctx.upsertJsonLd('ld-event-' + (ensembleKey || 'lvl') + '-' + i, ev);
  });
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
    // --- Domain-specific overrides ---
    try {
      const hostname = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : '';
      const pathname = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
      // SOUL si on est sur soulrennes.fr, ou si l'URL démarre par /soul, ou sur une page dédiée SOUL
      // comme galerie-soul.html, soul.html, etc.
      const isSoulPath = pathname.startsWith('/soul') || /\/(soul|galerie-soul)(\.html)?$/.test(pathname);
      const isSoulSite = hostname.includes('soulrennes') || isSoulPath;
      if (isSoulSite) {
        // Remove pages that should not be accessible from the SOUL domain/subpath
        // ('galerie' est gardé : sur SOUL, le lien est intercepté pour pointer vers galerie-soul.html)
        const banned = ['chorale-pop', 'comedie-musicale', 'cours-de-chant', 'evenements', 'videos', 'nous-rejoindre'];
        if (Array.isArray(pagesData)) {
          pagesData = pagesData.filter(p => !banned.includes(p.id));
        }
        // Override footer contacts for SOUL
        function setGlobalConfig(section, champ, valeur) {
          if (!Array.isArray(globalConfig)) globalConfig = [];
          const found = globalConfig.find(i => i.section === section && i.champ === champ);
          if (found) found.valeur = valeur;
          else globalConfig.push({ section: section, champ: champ, valeur: valeur });
        }
        setGlobalConfig('footer', 'email', 'contacter.soul@protonmail.com');
        setGlobalConfig('footer', 'facebook', 'https://www.facebook.com/profile.php?id=61584638320678');
        setGlobalConfig('footer', 'instagram', 'https://www.instagram.com/soul.rennes/');
        // Use soul logo and site title for SOUL
        setGlobalConfig('head', 'logo_url', '/assets/images/soullogo.png');
        setGlobalConfig('head', 'site_title', 'SOUL');
        // Expose a global flag so renderers can adapt (logo, labels...)
        try {
          window.__isSoulSite = true;
          // Add a CSS hook class to the document so we can override styles in CSS
          try { document.documentElement.classList.add('soul-site'); } catch (ee) { console.warn('cannot add soul-site class', ee); }
        } catch(e) { console.warn('cannot set __isSoulSite', e); }
      }
    } catch (e) {
      console.warn('[INIT] Domain-specific overrides failed', e);
    }
  } catch (err) {
    console.error('[INIT] Erreur lors des fetch JSON initiaux :', err);
  }

  // Load official documents manifest and render documents officiels section
  async function loadDocumentsOfficiels() {
    try {
      const docs = await fetchJson('docs_officiels.json');
      const container = document.getElementById('documents-officiels-section');
      if (!container) return;
      const placeholder = container.querySelector('.documents-officiels-placeholder');
      if (!docs || !Array.isArray(docs) || docs.length === 0) {
        if (placeholder) placeholder.innerHTML = '<p style="margin-top:8px;color:#444;font-style:italic;">Aucun document officiel n\'est affiché publiquement pour l\'instant.</p>';
        return;
      }
      // Simple title normalization
      function normalizeDocTitle(name) {
        if (!name) return '';
        let s = String(name).replace(/\.[^.]+$/, ''); // remove extension
        // remove leading dates or numbers like 2025_07_ or 202507
        s = s.replace(/^[0-9\-_\.\s\(\)]+/, '');
        s = s.replace(/[_\-]+/g, ' ');
        s = s.replace(/\s{2,}/g, ' ');
        s = s.trim();
        // Capitalize first letter of each word (basic)
        s = s.split(' ').map(w => w ? (w.charAt(0).toUpperCase() + w.slice(1)) : '').join(' ');
        return s;
      }
      function escapeHtml(s){ return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

      docs.sort((a,b)=> (a.folder||'').localeCompare(b.folder||'') || (a.filename||'').localeCompare(b.filename||''));
      let html = '<ul style="list-style:disc;padding-left:18px;margin:8px 0;">';
      docs.forEach(d => {
        const rel = (d.path || d.filename || '').replace(/\\\\/g,'/');
        const url = rel.indexOf('/') === 0 ? rel : '/' + rel;
        const title = normalizeDocTitle(d.title || d.filename || rel.split('/').pop());
        html += `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`;
        if (d.folder) html += ` <small style="color:#666">(${escapeHtml(d.folder)})</small>`;
        html += '</li>';
      });
      html += '</ul>';
      if (placeholder) placeholder.innerHTML = html;
      else container.insertAdjacentHTML('beforeend', html);
    } catch (e) {
      console.warn('loadDocumentsOfficiels failed', e);
    }
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
  renderNav(currentPageId);
  renderFooter();
  renderAuthBadge();
  
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
  // Load documents list for espace choristes (documents officiels)
  try { loadDocumentsOfficiels(); } catch(e) { /* ignore */ }
  // Initialise les grilles YouTube présentes dans la page (statiques ou dynamiques)
  try { initYoutubeGrids(); } catch(e) { /* ignore */ }
  // Synchronise le gap YouTube sur celui de Behold (Insta) si les deux sont sur la page
  try { syncYoutubeGapToBehold(); } catch(e) { /* ignore */ }
}

init();

// Robust delegated handlers to ensure footer/contact and espace-choristes links always work
function ensureDelegatedNavHandlers() {
  // smooth scroll for #footer links (works even if nav was replaced)
  document.removeEventListener('click', delegatedNavHandler, true);
  document.addEventListener('click', delegatedNavHandler, true);
}

function delegatedNavHandler(e) {
  try {
    const a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    const href = (a.getAttribute('href') || '').trim();
    // Contact -> scroll to footer
    if (href === '#footer') {
      const footer = document.getElementById('footer');
      if (footer) {
        e.preventDefault();
        footer.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    // Espace choristes -> open modal (use existing createChoristesModal)
    if (href.indexOf('espace-choristes.html') !== -1 || href.indexOf('partitions') !== -1) {
      // Si déjà authentifié (session persistante), on ne redemande pas le mdp
      const role = (function(){
        try { return localStorage.getItem('choristesRole') || sessionStorage.getItem('choristesRole'); }
        catch { return null; }
      })();
      if (role === 'chef' || role === 'member') return;
      e.preventDefault();
      const modal = createChoristesModal();
      modal.dataset.targetHref = a.href || href;
      if (!document.body.contains(modal)) document.body.appendChild(modal);
      const input = modal.querySelector('#choristes-password-input');
      if (input) setTimeout(() => input.focus(), 50);
      return;
    }
  } catch (err) { console.warn('delegatedNavHandler error', err); }
}

// install after a short delay to ensure header/nav rendered
setTimeout(ensureDelegatedNavHandlers, 250);

// Attach direct handlers to important anchors to avoid being blocked by other listeners
function attachDirectHandlers() {
  try {
    // Espace choristes anchors
    document.querySelectorAll('a[href*="espace-choristes.html"], a[href*="espace-choristes"], a[href*="partitions"]').forEach(a => {
      a.addEventListener('click', function(e){
        try {
          // Si déjà authentifié (session persistante), on ne redemande pas le mdp
          const role = (function(){
            try { return localStorage.getItem('choristesRole') || sessionStorage.getItem('choristesRole'); }
            catch { return null; }
          })();
          if (role === 'chef' || role === 'member') return;
          e.preventDefault();
          const modal = createChoristesModal();
          modal.dataset.targetHref = a.href || a.getAttribute('href');
          if (!document.body.contains(modal)) document.body.appendChild(modal);
          const input = modal.querySelector('#choristes-password-input');
          if (input) setTimeout(()=>input.focus(),50);
        } catch(err) { console.warn('choristes anchor handler', err); }
      }, { capture: true });
    });

    // Footer/contact anchors
    document.querySelectorAll('a[href="#footer"]').forEach(a => {
      a.addEventListener('click', function(e){
        try { e.preventDefault(); const footer = document.getElementById('footer'); if (footer) footer.scrollIntoView({ behavior: 'smooth' }); } catch(err) { console.warn('footer anchor handler', err); }
      }, { capture: true });
    });
  } catch (e) { console.warn('attachDirectHandlers failed', e); }
}

setTimeout(attachDirectHandlers, 400);

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
