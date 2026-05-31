// Logic spécifique pour la page Espace choristes (partitions)
(function() {
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

  function generateChansonsContent() {
    const container = document.getElementById('tab-content-chansons');
    if (!container) return;
    container.innerHTML = `
      <div class="legal-warning" style="background:#fff3cd;color:#856404;border:1px solid #ffeeba;padding:10px 16px;margin-bottom:14px;border-radius:8px;font-size:.93em;">
        <strong>Usage interne.</strong> Ces arrangements sont réservés aux membres — merci de ne pas les diffuser.
      </div>
      <div class="partition-search-bar">
        <input type="search" id="partition-search" placeholder="Rechercher une chanson…" autocomplete="off">
      </div>
      <div id="chansons-all" class="chansons-list"></div>
    `;

    function renderTable(parts){
      if (!parts || parts.length===0) return '<em>Aucune chanson.</em>';
      return '<table style="width:100%;border-collapse:collapse;"><tbody>' + parts.map(partition => {
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

        return `<tr><td style="padding:10px 0;"><strong>${displayTitle}</strong><div style="margin-top:6px;">${recordingsLinks}${recordingsLinks && ressourcesLinks ? '<br>' : ''}${ressourcesLinks}${(recordingsLinks||ressourcesLinks) && interactiveLink ? '<br>' : ''}${interactiveLink}</div></td></tr><tr><td><hr style='border:0;border-top:1.5px solid #e0e0e0;margin:0;'></td></tr>`;
      }).join('') + '</tbody></table>';
    }

    // load partitions and show a single consolidated list
    fetch('data/partitions.json')
      .then(res => res.json())
      .then(data => {
        // Keep the original order from the JSON but present to the user sorted
        // alphabetically by title (locale-aware, accents handled, case-insensitive).
        const parts = (data || []).filter(p => p && p.title).sort((a, b) => {
          try { return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }); } catch (e) { return String(a.title).localeCompare(String(b.title)); }
        });
        document.getElementById('chansons-all').innerHTML = renderTable(parts);
        bindAudioClickOnce();

        // Recherche en temps réel
        const searchInput = document.getElementById('partition-search');
        if (searchInput) {
          searchInput.addEventListener('input', function() {
            const q = this.value.trim().toLowerCase()
              .normalize('NFD').replace(/[̀-ͯ]/g, '');
            const rows = document.querySelectorAll('#chansons-all tr');
            let prevIsHr = false;
            rows.forEach(tr => {
              const td = tr.querySelector('td');
              if (!td) return;
              // Les lignes <hr> (séparateurs) alternent avec les lignes de données
              const isHr = !!tr.querySelector('hr');
              if (isHr) { tr.classList.add('partition-row-hidden'); prevIsHr = true; return; }
              if (!q) { tr.classList.remove('partition-row-hidden'); prevIsHr = false; return; }
              const text = td.textContent.toLowerCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '');
              const match = text.includes(q);
              tr.classList.toggle('partition-row-hidden', !match);
              prevIsHr = false;
            });
            // Afficher les séparateurs seulement entre les lignes visibles
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
          });
          searchInput.focus();
        }
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

    // ---- Restauration de session ----
    const storedRole = sessionStorage.getItem('choristesRole');
    if (storedRole === 'member' || storedRole === 'chef') {
      window.IS_CHEF = (storedRole === 'chef');
      if (document.body) document.body.classList.toggle('role-chef', window.IS_CHEF);
      if (hasProf()) showTabs();
      else           showProfileStep(false);
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
        if (entered === 'bureau') role = 'chef';
        else if (!correct || entered === correct) role = 'member';

        if (role) {
          sessionStorage.setItem('choristesRole', role);
          window.IS_CHEF = (role === 'chef');
          if (document.body) document.body.classList.toggle('role-chef', window.IS_CHEF);
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
        try { sessionStorage.removeItem('choristesRole'); } catch {}
        window.IS_CHEF = false;
        if (document.body) document.body.classList.remove('role-chef');
        if (tabsWrap)          tabsWrap.style.display = 'none';
        if (profileStep)       profileStep.style.display = 'none';
        if (passwordContainer) passwordContainer.style.display = '';
        const err = document.getElementById('partition-error');
        if (err) err.style.display = 'none';
        if (passwordInput) { passwordInput.value = ''; passwordInput.focus(); }
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
