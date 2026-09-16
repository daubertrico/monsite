// Logic spécifique pour la page Espace choristes (partitions)
(function() {
  // URL du Web App Google Apps Script (voir scripts/visibilite_chansons_gas_sample.js
  // pour le code à déployer). Tant que c'est vide, les cases à cocher du mode
  // "chef de chœur" restent visibles mais ne persistent que le temps de la session.
  const VISIBILITY_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz8oUrLwCIfGYctW0aF5gXYssDJFcfnHe84Bhd6qhgaD9wrKFWtHbOQ6vISViSQH4YBpg/exec';
  const VISIBILITY_ADMIN_PASS = 'chefdechoeur';
  // URL du Web App Google Apps Script (voir scripts/materiel_chansons_gas_sample.js
  // pour le code à déployer). Il scanne un dossier Google Drive partagé avec le
  // bureau : un sous-dossier = une chanson, les PDF/enregistrements dedans sont
  // détectés automatiquement. Tant que c'est vide, seul data/partitions.json est utilisé.
  const MATERIEL_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxsgakVg3j1qQNtT4w5Az6DbZZt_Ftw8D8l_J8sWbZY-nSuRkiEgjnTl9htNurwVSs/exec';
  function setupSousOnglets() {
    const sousOnglets = document.querySelectorAll('.calendrier-sous-onglet');
    const sousOngletContents = {
      grandechorale: document.getElementById('sousonglet-grandechorale'),
      soul: document.getElementById('sousonglet-soul')
    };
    function updateSousOngletStyles() {
      sousOnglets.forEach(btn => {
        btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
        // Pour les boutons ensemble-btn, toggle la classe active (CSS gère le reste)
      });
    }
    sousOnglets.forEach(btn => {
      btn.setAttribute('role', 'tab');
      btn.addEventListener('click', function() {
        sousOnglets.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        Object.keys(sousOngletContents).forEach(key => {
          const el = sousOngletContents[key];
          if (el) {
            const isActive = (this.dataset.sousonglet === key);
            el.classList.toggle('active', isActive);
            // Assure aussi l'affichage sur desktop (où le CSS n'a pas !important)
            el.style.display = isActive ? '' : 'none';
          }
        });
        updateSousOngletStyles();
      });
    });
    const cont = document.querySelector('.calendrier-sous-onglets');
    if (cont) cont.setAttribute('role', 'tablist');
    updateSousOngletStyles();
    // Initial state for mobile: ensure correct content has .active
    const initialActiveBtn = Array.from(sousOnglets).find(b => b.classList.contains('active'));
    const initialKey = initialActiveBtn ? initialActiveBtn.dataset.sousonglet : 'grandechorale';
    Object.keys(sousOngletContents).forEach(key => {
      const el = sousOngletContents[key];
      if (el) {
        const isActive = (key === initialKey);
        el.classList.toggle('active', isActive);
        el.style.display = isActive ? '' : 'none';
      }
    });
  }

  async function getPartitionPassword() {
    try {
      const response = await fetch('data/pages.json');
      const pages = await response.json();
      const partitionPage = pages.find(p => p.id === 'partitions');
      return partitionPage && partitionPage.password ? partitionPage.password : null;
    } catch {
      return null;
    }
  }

  function updateTabStyles() {
    document.querySelectorAll('.choristes-tab').forEach(btn => {
      btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
    });
  }

  function showTab(tab) {
    document.querySelectorAll('.choristes-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
  const contents = document.querySelectorAll('.choristes-tab-content');
  contents.forEach(div => { div.classList.remove('active'); div.style.display = 'none'; });
  const panel = document.getElementById('tab-content-' + tab);
  if (panel) { panel.classList.add('active'); panel.style.display = ''; }
    updateTabStyles();
  }

  function bindAudioClickOnce() {
    if (window.__audioClickBound) return;
    document.addEventListener('click', function(e) {
      if (e.target.classList && e.target.classList.contains('audio-link')) {
        e.preventDefault();
        const src = e.target.getAttribute('data-src');
        let player = document.getElementById('popup-audio-player');
        if (!player) {
          player = document.createElement('div');
          player.id = 'popup-audio-player';
          player.style.position = 'fixed';
          player.style.bottom = '30px';
          player.style.left = '50%';
          player.style.transform = 'translateX(-50%)';
          player.style.background = '#fff';
          player.style.border = '1.5px solid #3981FF';
          player.style.borderRadius = '12px';
          player.style.boxShadow = '0 4px 24px rgba(0,0,0,0.12)';
          player.style.padding = '16px 24px 12px 24px';
          player.style.zIndex = '9999';
          player.innerHTML = '<audio id="audio-player" controls style="width:320px;"></audio><button id="close-audio" style="margin-left:16px;font-size:1.2em;cursor:pointer;background:none;border:none;color:#3981FF;">✖</button>';
          document.body.appendChild(player);
          document.getElementById('close-audio').onclick = function() { player.remove(); };
        }
        const audio = document.getElementById('audio-player');
        audio.src = src;
        audio.play();
      }
    }, { capture: false });
    window.__audioClickBound = true;
  }

  // ---- Tutoriel de bienvenue (une seule fois, après la première saisie du profil) ----
  // Visite guidée : met en surbrillance chaque onglet réel de la page et bascule
  // dessus au fil des étapes, avec une bulle + flèche qui pointe vers lui.
  const TUTO_SEEN_KEY = 'choristesTutoSeen';
  const TOUR_STEPS = [
    { tab: 'chansons', title: 'Chansons', text: "Retrouve ici les paroles (PDF) et des enregistrements pour t'entraîner par pupitre, chanson par chanson." },
    { tab: 'calendrier', title: 'Calendrier', text: "Consulte les dates de répétitions et de concerts, et indique ta présence directement depuis cet onglet." },
    { tab: 'infos', title: 'Infos & liens', text: "Toutes les informations pratiques de la chorale (contacts, documents, liens utiles) réunies au même endroit." },
    { tab: 'photos', title: 'Photos', text: "Retrouve les photos des concerts et répétitions, et ajoute les tiennes pour les partager avec le reste de la chorale." },
    { tab: 'trombinoscope', title: 'Trombinoscope', text: "Retrouve le nom et le pupitre de chaque choriste. Tu peux cliquer sur ta photo à tout moment pour la changer." }
  ];

  function showOnboardingTuto() {
    let index = 0;

    const spotlight = document.createElement('div');
    spotlight.className = 'onboarding-spotlight';
    const blocker = document.createElement('div');
    blocker.className = 'onboarding-blocker';
    const tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';
    tooltip.innerHTML = `
      <div class="onboarding-tooltip-title" id="onboarding-tooltip-title"></div>
      <p class="onboarding-tooltip-text" id="onboarding-tooltip-text"></p>
      <div class="onboarding-tooltip-nav">
        <button type="button" class="onboarding-skip" id="onboarding-skip">Passer</button>
        <span class="onboarding-tooltip-step" id="onboarding-tooltip-step"></span>
        <button type="button" class="onboarding-next" id="onboarding-next">Suivant →</button>
      </div>
    `;
    document.body.appendChild(blocker);
    document.body.appendChild(spotlight);
    document.body.appendChild(tooltip);

    const titleEl = tooltip.querySelector('#onboarding-tooltip-title');
    const textEl  = tooltip.querySelector('#onboarding-tooltip-text');
    const stepEl  = tooltip.querySelector('#onboarding-tooltip-step');
    const nextBtn = tooltip.querySelector('#onboarding-next');
    const skipBtn = tooltip.querySelector('#onboarding-skip');

    function position() {
      const step = TOUR_STEPS[index];
      const target = document.querySelector('.choristes-tab[data-tab="' + step.tab + '"]');
      if (!target) { close(); return; }
      const r = target.getBoundingClientRect();
      spotlight.style.top = (r.top - 6) + 'px';
      spotlight.style.left = (r.left - 6) + 'px';
      spotlight.style.width = (r.width + 12) + 'px';
      spotlight.style.height = (r.height + 12) + 'px';

      const spaceBelow = window.innerHeight - r.bottom;
      const showBelow = spaceBelow > 180;
      tooltip.classList.toggle('arrow-up', showBelow);
      tooltip.classList.toggle('arrow-down', !showBelow);
      const top = showBelow ? (r.bottom + 16) : (r.top - tooltip.offsetHeight - 16);
      let left = r.left + r.width / 2 - tooltip.offsetWidth / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - tooltip.offsetWidth - 12));
      const maxTop = window.innerHeight - tooltip.offsetHeight - 12;
      tooltip.style.top = Math.max(12, Math.min(top, maxTop)) + 'px';
      tooltip.style.left = left + 'px';
      tooltip.style.setProperty('--arrow-left', ((r.left + r.width / 2) - left) + 'px');
    }

    function render() {
      const step = TOUR_STEPS[index];
      if (typeof showTab === 'function') showTab(step.tab);
      titleEl.textContent = step.title;
      textEl.textContent = step.text;
      stepEl.textContent = (index + 1) + ' / ' + TOUR_STEPS.length;
      nextBtn.textContent = (index === TOUR_STEPS.length - 1) ? "C'est parti ! 🎉" : 'Suivant →';
      const target = document.querySelector('.choristes-tab[data-tab="' + step.tab + '"]');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      setTimeout(position, 260);
    }

    function close() {
      try { localStorage.setItem(TUTO_SEEN_KEY, '1'); } catch (e) {}
      window.removeEventListener('resize', position);
      document.removeEventListener('keydown', onKey);
      blocker.remove();
      spotlight.remove();
      tooltip.remove();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    nextBtn.addEventListener('click', function() {
      if (index === TOUR_STEPS.length - 1) { close(); return; }
      index++;
      render();
    });
    skipBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', position);

    render();
  }

  function maybeShowOnboardingTuto() {
    let seen = false;
    try { seen = localStorage.getItem(TUTO_SEEN_KEY) === '1'; } catch (e) {}
    if (!seen) showOnboardingTuto();
  }

  function escAttr(s) {
    return (s || '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // Normalisation de clé alignée sur simplifyKey() côté api/save_visibility.php
  function simplifyPartitionKey(s) {
    if (!s) return '';
    return s.toString().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function generateChansonsContent() {
    const container = document.getElementById('tab-content-chansons');
    if (!container) return;
    const isAdmin = !!window.IS_ADMIN;
    container.innerHTML = `
      <div class="legal-warning" style="background:#fff3cd;color:#856404;border:1px solid #ffeeba;padding:10px 16px;margin-bottom:14px;border-radius:8px;font-size:.93em;">
        <strong>Usage interne.</strong> Ces arrangements sont réservés aux membres — merci de ne pas les diffuser.
      </div>
      ${isAdmin ? `<div class="legal-warning" style="background:#eef5ff;color:#134;border:1px solid #98bfff;padding:10px 16px;margin-bottom:14px;border-radius:8px;font-size:.93em;">
        <strong>🔐 Mode chef de chœur.</strong> Coche les cases sous chaque chanson pour choisir si elle apparaît pour les choristes de la Voix Libre et/ou de SOUL. Décoche les deux pour la masquer complètement. Ces réglages sont invisibles pour le bureau et les choristes.
      </div>` : ''}
      <div class="partition-search-bar">
        <input type="search" id="partition-search" placeholder="Rechercher une chanson…" autocomplete="off">
      </div>
      <div id="chansons-all" class="chansons-list"></div>
    `;

    function renderTable(parts, role, ensembleHint){
      // Le bureau et le chef de chœur voient tout ; les choristes ne voient que
      // les chansons rendues visibles pour leur ensemble (par défaut : visibles).
      const visibleParts = (role === 'member')
        ? parts.filter(p => ensembleHint === 'soul' ? p.visible_soul !== false : p.visible_lavoixlibre !== false)
        : parts;
      if (!visibleParts || visibleParts.length===0) return '<em>Aucune chanson.</em>';
      return '<table style="width:100%;border-collapse:collapse;"><tbody>' + visibleParts.map(partition => {
        // Build display title with suffixes when needed to distinguish arrangements
        let displayTitle = partition.title || '';
        const hasSoul = partition.visible_soul === true;
        const hasLv = partition.visible_lavoixlibre === true;
        // If title already contains an explicit qualifier (grande chorale/LVL), keep it.
        const lcTitle = (displayTitle || '').toLowerCase();
        const alreadyQual = /grande chorale|lvl|soul/i.test(lcTitle);
        if (!alreadyQual) {
          if (hasLv && !hasSoul) displayTitle = displayTitle + ' — Grande chorale';
          else if (hasSoul && !hasLv) displayTitle = displayTitle + ' — SOUL';
        }

        const recordingsLinks = (partition.recordings||[]).map(r => `<a href="#" class="audio-link" data-src="${r.file}">${r.label}</a>`).join('<br>');
        const ressourcesLinks = (partition.documents||[]).map(d => `<a href="${d.file}" target="_blank">${d.label}</a>`).join('<br>');
        const interactiveLink = partition.interactive_link ? `<a href="${partition.interactive_link}" target="_blank">Partition interactive</a>` : (partition.flatio_link ? `<a href="${partition.flatio_link}" target="_blank">Partition interactive</a>` : '');

        let adminControls = '';
        if (isAdmin) {
          const lvChecked = partition.visible_lavoixlibre !== false ? 'checked' : '';
          const soulChecked = partition.visible_soul !== false ? 'checked' : '';
          const hiddenFromAll = partition.visible_lavoixlibre === false && partition.visible_soul === false;
          adminControls = `<div class="admin-visibility-controls" style="margin-top:8px;padding-top:6px;border-top:1px dashed #cfe3ff;font-size:.85em;color:#345;">
            <label style="margin-right:14px;cursor:pointer;"><input type="checkbox" class="vis-toggle" data-title="${escAttr(partition.title)}" data-group="lv" ${lvChecked}> Voix Libre</label>
            <label style="cursor:pointer;"><input type="checkbox" class="vis-toggle" data-title="${escAttr(partition.title)}" data-group="soul" ${soulChecked}> SOUL</label>
            ${hiddenFromAll ? ' <span style="color:#b91c1c;font-weight:600;">🔒 masquée pour tous les choristes</span>' : ''}
          </div>`;
        }

        return `<tr><td style="padding:10px 0;"><strong>${displayTitle}</strong><div style="margin-top:6px;">${recordingsLinks}${recordingsLinks && ressourcesLinks ? '<br>' : ''}${ressourcesLinks}${(recordingsLinks||ressourcesLinks) && interactiveLink ? '<br>' : ''}${interactiveLink}</div>${adminControls}</td></tr><tr><td><hr style='border:0;border-top:1.5px solid #e0e0e0;margin:0;'></td></tr>`;
      }).join('') + '</tbody></table>';
    }

    function saveVisibility(title, lv, soul) {
      if (!VISIBILITY_ENDPOINT) {
        console.warn('VISIBILITY_ENDPOINT non configuré : ce réglage ne sera pas conservé au rechargement (voir scripts/visibilite_chansons_gas_sample.js).');
        return;
      }
      const key = simplifyPartitionKey(title);
      if (!key) return;
      const payload = JSON.stringify({ adminPass: VISIBILITY_ADMIN_PASS, key, title, lv, soul });
      fetch(VISIBILITY_ENDPOINT, {
        method: 'POST',
        body: new URLSearchParams({ data: payload }),
        mode: 'no-cors'
      }).catch(e => console.error('save_visibility failed', e));
    }

    function fetchVisibilityOverrides() {
      if (!VISIBILITY_ENDPOINT) return Promise.resolve({});
      return fetch(VISIBILITY_ENDPOINT)
        .then(res => res.json())
        .then(json => (json && json.ok && json.overrides) ? json.overrides : {})
        .catch(() => ({}));
    }

    function fetchMateriel(forceRefresh) {
      if (!MATERIEL_ENDPOINT) return Promise.resolve([]);
      const url = MATERIEL_ENDPOINT + (forceRefresh ? '?refresh=1' : '');
      return fetch(url)
        .then(res => res.json())
        .then(json => (json && json.ok && json.songs) ? json.songs : [])
        .catch(() => []);
    }

    // Fusionne le matériel scanné depuis le Drive (source vivante, alimentée par le
    // bureau) avec la liste de partitions.json : complète les chansons existantes et
    // ajoute automatiquement les nouveaux dossiers-chansons.
    function mergeMateriel(parts, materielSongs) {
      const byKey = new Map();
      parts.forEach(p => byKey.set(simplifyPartitionKey(p.title), p));
      (materielSongs || []).forEach(song => {
        const key = simplifyPartitionKey(song.title);
        if (!key) return;
        const existing = byKey.get(key);
        if (existing) {
          existing.documents = song.documents || [];
          existing.recordings = song.recordings || [];
        } else {
          const newPart = { title: song.title, documents: song.documents || [], recordings: song.recordings || [] };
          parts.push(newPart);
          byKey.set(key, newPart);
        }
      });
      return parts;
    }

    function applySearchFilter(q) {
      q = (q || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const rows = document.querySelectorAll('#chansons-all tr');
      rows.forEach(tr => {
        const td = tr.querySelector('td');
        if (!td) return;
        const isHr = !!tr.querySelector('hr');
        if (isHr) { tr.classList.add('partition-row-hidden'); return; }
        if (!q) { tr.classList.remove('partition-row-hidden'); return; }
        const text = td.textContent.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        tr.classList.toggle('partition-row-hidden', !text.includes(q));
      });
      if (q) {
        const allRows = Array.from(document.querySelectorAll('#chansons-all tr'));
        allRows.forEach((tr, i) => {
          if (!tr.querySelector('hr')) return;
          const prev = allRows[i-1];
          const next = allRows[i+1];
          const prevHidden = !prev || prev.classList.contains('partition-row-hidden');
          const nextHidden = !next || next.classList.contains('partition-row-hidden');
          tr.classList.toggle('partition-row-hidden', prevHidden || nextHidden);
        });
      }
    }

    function sortParts(parts) {
      parts.sort((a, b) => {
        try { return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }); } catch (e) { return String(a.title).localeCompare(String(b.title)); }
      });
      return parts;
    }

    // Affiche d'abord la liste statique (data/partitions.json, quasi instantané),
    // puis complète en arrière-plan avec les réglages de visibilité et le matériel
    // Drive : ces deux appels passent par Google Apps Script, qui peut mettre
    // plusieurs secondes (parfois 10-20s) à répondre. On ne bloque plus l'affichage
    // en attendant — la liste apparaît tout de suite et se met à jour dès que
    // ces données arrivent.
    fetch('data/partitions.json').then(res => res.json())
      .then((data) => {
        let parts = sortParts((data || []).filter(p => p && p.title));
        const role = localStorage.getItem('choristesRole') || sessionStorage.getItem('choristesRole');
        const ensembleHint = localStorage.getItem('choristesEnsembleHint');
        const listEl = document.getElementById('chansons-all');

        function rerender() {
          listEl.innerHTML = renderTable(parts, role, ensembleHint);
          const searchInput = document.getElementById('partition-search');
          applySearchFilter(searchInput ? searchInput.value : '');
        }
        rerender();
        bindAudioClickOnce();

        // Lien pour forcer une actualisation immédiate du matériel Drive (sinon
        // il se met à jour tout seul au bout de quelques minutes via le cache).
        if (MATERIEL_ENDPOINT) {
          const refreshWrap = document.createElement('div');
          refreshWrap.style.cssText = 'margin:10px 0 4px;font-size:.85em;';
          refreshWrap.innerHTML = '<a href="#" id="materiel-refresh-link">🔄 Actualiser le matériel (paroles / enregistrements ajoutés récemment)</a>';
          container.insertBefore(refreshWrap, listEl);
          const refreshLink = refreshWrap.querySelector('#materiel-refresh-link');
          refreshLink.addEventListener('click', function(e) {
            e.preventDefault();
            refreshLink.textContent = '⏳ Actualisation…';
            fetchMateriel(true).then(songs => {
              parts = mergeMateriel(parts, songs);
              rerender();
              refreshLink.textContent = '🔄 Actualiser le matériel (paroles / enregistrements ajoutés récemment)';
            });
          });
        }

        if (isAdmin) {
          listEl.addEventListener('change', function(e) {
            const cb = e.target;
            if (!cb.classList || !cb.classList.contains('vis-toggle')) return;
            const title = cb.getAttribute('data-title');
            const partition = parts.find(p => p.title === title);
            if (!partition) return;
            if (cb.dataset.group === 'lv') partition.visible_lavoixlibre = cb.checked;
            else partition.visible_soul = cb.checked;
            saveVisibility(title, partition.visible_lavoixlibre !== false, partition.visible_soul !== false);
            rerender();
          });
        }

        // Recherche en temps réel
        const searchInput = document.getElementById('partition-search');
        if (searchInput) {
          searchInput.addEventListener('input', function() { applySearchFilter(this.value); });
          searchInput.focus();
        }

        // Réglages de visibilité (Google Sheet, via chef de chœur) : arrivent en
        // arrière-plan et mettent à jour l'affichage dès que prêts.
        fetchVisibilityOverrides().then(overrides => {
          if (!overrides || Object.keys(overrides).length === 0) return;
          parts.forEach(p => {
            const o = overrides[simplifyPartitionKey(p.title)];
            if (o) {
              p.visible_lavoixlibre = !!o.lv;
              p.visible_soul = !!o.soul;
            }
          });
          rerender();
        });

        // Matériel Drive (paroles/enregistrements ajoutés par le bureau) : idem,
        // fusionné dès qu'il arrive plutôt que de bloquer l'affichage initial.
        fetchMateriel().then(materielSongs => {
          if (!materielSongs || materielSongs.length === 0) return;
          parts = sortParts(mergeMateriel(parts, materielSongs));
          rerender();
        });
      }).catch(e=>{console.error('failed to load partitions.json',e);});
  }

  function initChoristesPage(){
    // ARIA
    document.querySelectorAll('.choristes-tab').forEach(btn => btn.setAttribute('role', 'tab'));
    document.querySelectorAll('.choristes-tab-content').forEach(p => p.setAttribute('role', 'tabpanel'));
    setupSousOnglets();

    const passwordContainer = document.getElementById('password-container');
    const profileStep       = document.getElementById('profile-step');
    const tabsWrap          = document.getElementById('tabs-container');
    const passwordInput     = document.getElementById('partition-password');
    const submitBtn         = document.getElementById('partition-submit');
    const errorMsg          = document.getElementById('partition-error');

    // ---- Helpers profil ----
    function getProf() { try { return JSON.parse(localStorage.getItem('choristeProfile') || '{}'); } catch { return {}; } }
    function setProf(p){ localStorage.setItem('choristeProfile', JSON.stringify(p||{})); }
    function hasProf()  { const p = getProf(); return !!(p.prenom && p.nom && p.pupitre); }

    // ---- Afficher les tabs ----
    function showTabs() {
      if (passwordContainer) passwordContainer.style.display = 'none';
      if (profileStep)       profileStep.style.display = 'none';
      if (tabsWrap)          tabsWrap.style.display = '';

      // Bandeau profil dans le calendrier
      const p = getProf();
      const banner = document.getElementById('profile-banner');
      const nameEl = document.getElementById('pb-name-display');
      if (banner && nameEl && p.prenom) {
        nameEl.textContent = p.prenom + ' ' + p.nom + ' · ' + p.pupitre;
        banner.style.display = 'flex';
      }

      // Pré-remplir le champ photo depuis le profil
      const photoUploader = document.getElementById('photo-uploader');
      if (photoUploader && p.prenom) {
        photoUploader.value = p.prenom + (p.nom ? ' ' + p.nom : '');
      }

      showTab('chansons');
      generateChansonsContent();
      // Afficher le sondage réinscription si pas encore répondu (seulement chorale + bureau)
      const _hint = localStorage.getItem('choristesEnsembleHint');
      if (window.IS_CHEF || _hint === 'chorale') {
        if (typeof window.showSurveyIfNeeded === 'function') {
          window.showSurveyIfNeeded();
        }
      }
      // Le formulaire de réinscription HelloAsso ne concerne que la Voix Libre,
      // pas les choristes SOUL (autre formulaire, voir onglet Infos & liens).
      const reinscriptionBloc = document.getElementById('reinscription-bloc');
      if (reinscriptionBloc) {
        reinscriptionBloc.style.display = (_hint === 'soul') ? 'none' : '';
      }
    }

    // ---- Afficher l'étape profil ----
    function showProfileStep(returnToCalendar) {
      if (passwordContainer) passwordContainer.style.display = 'none';
      if (profileStep)       profileStep.style.display = '';
      if (tabsWrap)          tabsWrap.style.display = 'none';
      if (returnToCalendar)  profileStep.dataset.returnTo = 'calendrier';
      else                   delete profileStep.dataset.returnTo;

      // Pré-remplir si profil partiel existe
      const p = getProf();
      const prenomEl  = document.getElementById('profile-step-prenom');
      const nomEl     = document.getElementById('profile-step-nom');
      const pupitreEl = document.getElementById('profile-step-pupitre');
      if (prenomEl  && p.prenom)  prenomEl.value  = p.prenom;
      if (nomEl     && p.nom)     nomEl.value     = p.nom;
      if (pupitreEl && p.pupitre) pupitreEl.value = p.pupitre;
      setTimeout(() => { if (prenomEl) prenomEl.focus(); }, 80);
    }

    // ---- Soumission profil ----
    function bindProfileStep() {
      const btn = document.getElementById('profile-step-submit');
      if (!btn) return;
      btn.addEventListener('click', function() {
        const prenomEl  = document.getElementById('profile-step-prenom');
        const nomEl     = document.getElementById('profile-step-nom');
        const pupitreEl = document.getElementById('profile-step-pupitre');
        const errEl     = document.getElementById('profile-step-error');

        const prenom  = (prenomEl?.value  || '').trim();
        const nom     = (nomEl?.value     || '').trim();
        const pupitre = (pupitreEl?.value || '');

        [prenomEl, nomEl, pupitreEl].forEach(el => el?.classList.remove('input-error'));
        let ok = true;
        if (!prenom)  { prenomEl?.classList.add('input-error');  prenomEl?.focus();  ok = false; }
        if (!nom)     { nomEl?.classList.add('input-error');     if (ok) nomEl?.focus(); ok = false; }
        if (!pupitre) { pupitreEl?.classList.add('input-error'); if (ok) pupitreEl?.focus(); ok = false; }

        if (!ok) { if (errEl) errEl.style.display = 'block'; return; }
        if (errEl) errEl.style.display = 'none';

        setProf({ prenom, nom, pupitre });
        // Met à jour le badge global maintenant que prénom/nom sont connus
        if (typeof window.renderAuthBadge === 'function') window.renderAuthBadge();
        // Signal espace-choristes.html pour synchroniser le profil côté serveur (+ photo si choisie)
        try { document.dispatchEvent(new CustomEvent('choriste:profile-saved', { detail: { prenom, nom, pupitre } })); } catch (e) {}

        // Mettre à jour aussi les champs profil du calendrier (présences)
        [['choriste-prenom','choriste-nom','choriste-pupitre'],
         ['choriste-prenom-soul','choriste-nom-soul','choriste-pupitre-soul']].forEach(([p,n,v]) => {
          const pe = document.getElementById(p); if (pe) pe.value = prenom;
          const ne = document.getElementById(n); if (ne) ne.value = nom;
          const ve = document.getElementById(v); if (ve) ve.value = pupitre;
        });

        const returnTo = profileStep?.dataset.returnTo;
        showTabs();
        if (returnTo) showTab(returnTo);
        maybeShowOnboardingTuto();
      });

      // Entrée = soumettre
      [document.getElementById('profile-step-prenom'),
       document.getElementById('profile-step-nom'),
       document.getElementById('profile-step-pupitre')].forEach(el => {
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
      });
    }
    bindProfileStep();

    // ---- Bouton "Modifier mon profil" dans le bandeau calendrier ----
    const modifyBtn = document.getElementById('pb-modify-btn');
    if (modifyBtn) {
      modifyBtn.addEventListener('click', function() {
        showProfileStep(true); // returnToCalendar = true
      });
    }

    // ---- Restauration de session (persistante via localStorage) ----
    // Migration douce : reprend l'ancien sessionStorage s'il existait
    try {
      const legacy = sessionStorage.getItem('choristesRole');
      if (legacy && !localStorage.getItem('choristesRole')) {
        localStorage.setItem('choristesRole', legacy);
        sessionStorage.removeItem('choristesRole');
      }
    } catch {}
    const storedRole = localStorage.getItem('choristesRole');
    if (storedRole === 'member' || storedRole === 'chef' || storedRole === 'admin') {
      window.IS_CHEF = (storedRole === 'chef' || storedRole === 'admin');
      window.IS_ADMIN = (storedRole === 'admin');
      if (document.body) {
        document.body.classList.toggle('role-chef', window.IS_CHEF);
        document.body.classList.toggle('role-admin', window.IS_ADMIN);
      }
      if (hasProf()) {
        showTabs();
        // Sync silencieuse du profil vers le trombinoscope (au cas où ce n'est pas encore fait)
        const _p = getProf();
        try {
          document.dispatchEvent(new CustomEvent('choriste:profile-saved', {
            detail: { prenom: _p.prenom, nom: _p.nom, pupitre: _p.pupitre }
          }));
        } catch (e) {}
      } else {
        showProfileStep(false);
      }
    } else {
      if (passwordContainer) passwordContainer.style.display = '';
      if (tabsWrap)          tabsWrap.style.display = 'none';
    }

    // Utilitaire de normalisation (trim, lowercase, supprime accents/diacritiques et espaces)
    function normalizeInput(s) {
      if (!s) return '';
      try {
        // Fallback diacritics removal without Unicode properties for wider browser support
        return s.toString()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '')
          .trim()
          .toLowerCase();
      } catch (e) {
        return s.toString().trim().toLowerCase();
      }
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async function() {
        const entered    = normalizeInput(passwordInput ? passwordInput.value : '');
        const correctRaw = await getPartitionPassword();
        const correct    = correctRaw ? normalizeInput(correctRaw) : null;
        let role = null;
        let ensembleHint = null;
        if (entered === 'chefdechoeur2026') role = 'admin';
        else if (entered === 'bureau') role = 'chef';
        else if (entered === 'soul2026') { role = 'member'; ensembleHint = 'soul'; }
        else if (!correct || entered === correct) { role = 'member'; ensembleHint = 'chorale'; }

        if (role) {
          localStorage.setItem('choristesRole', role);
          if (ensembleHint) {
            localStorage.setItem('choristesEnsembleHint', ensembleHint);
          }
          window.IS_CHEF = (role === 'chef' || role === 'admin');
          window.IS_ADMIN = (role === 'admin');
          if (document.body) {
            document.body.classList.toggle('role-chef', window.IS_CHEF);
            document.body.classList.toggle('role-admin', window.IS_ADMIN);
          }
          if (hasProf()) showTabs();
          else           showProfileStep(false);
        } else {
          if (errorMsg) errorMsg.style.display = 'block';
        }
      });
      // Enter pour soumettre le mot de passe
      if (passwordInput) passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });
    }

    // Déconnexion
    const logoutBtn = document.getElementById('logout-role');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(){
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
        window.IS_ADMIN = false;
        if (document.body) { document.body.classList.remove('role-chef'); document.body.classList.remove('role-admin'); }
        // Redirection vers la page d'accueil après déconnexion
        location.href = 'index.html';
      });
    }

    // Gestion clic sur onglets principaux
    document.querySelectorAll('.choristes-tab').forEach(btn => {
      btn.addEventListener('click', function() {
        showTab(this.dataset.tab);
        if (this.dataset.tab === 'chansons') generateChansonsContent();
      });
    });
    updateTabStyles();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChoristesPage);
  } else {
    initChoristesPage();
  }
})();
