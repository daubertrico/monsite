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
        const active = btn.classList.contains('active');
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.style.background = active ? '#3981FF' : '#e0e0e0';
        btn.style.color = active ? '#fff' : '#222';
        btn.style.border = active ? '2.5px solid #3981FF' : '2.5px solid #e0e0e0';
        btn.style.boxShadow = active ? '0 2px 8px #3981FF33' : '0 2px 8px #3981FF11';
        btn.style.textDecoration = active ? 'underline' : 'none';
        btn.style.textUnderlineOffset = active ? '6px' : '';
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
      const active = btn.classList.contains('active');
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.style.background = active ? '#3981FF' : '#e0e0e0';
      btn.style.color = active ? '#fff' : '#222';
      btn.style.border = active ? '2.5px solid #3981FF' : '2.5px solid #e0e0e0';
      btn.style.boxShadow = active ? '0 2px 8px #3981FF33' : '0 2px 8px #3981FF11';
      btn.style.textDecoration = active ? 'underline' : 'none';
      btn.style.textUnderlineOffset = active ? '6px' : '';
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
      <div class="legal-warning" style="background:#fff3cd;color:#856404;border:1px solid #ffeeba;padding:12px 18px;margin-bottom:18px;border-radius:8px;font-size:1.05em;">
        <strong>Attention :</strong> Ces partitions sont des arrangements réalisés pour la chorale La Voix Libre. Elles sont protégées par le droit d’auteur et strictement réservées à un usage interne. Merci de ne pas les diffuser.
      </div>
      <h2>Espace choristes : catalogue des partitions</h2>
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
      }).catch(e=>{console.error('failed to load partitions.json',e);});
  }

  function initChoristesPage(){
  // Rôles ARIA de base pour les onglets principaux (inclut maintenant 'asso')
  const tabsContainer = document.querySelector('.choristes-tabs');
  if (tabsContainer) tabsContainer.setAttribute('role', 'tablist');
  document.querySelectorAll('.choristes-tab').forEach(btn => btn.setAttribute('role', 'tab'));
    document.querySelectorAll('.choristes-tab-content').forEach(p => p.setAttribute('role', 'tabpanel'));

    setupSousOnglets();

    const passwordContainer = document.getElementById('password-container');
    const tabsWrap = document.getElementById('tabs-container');
    const passwordInput = document.getElementById('partition-password');
    const submitBtn = document.getElementById('partition-submit');
    const errorMsg = document.getElementById('partition-error');

    // Affichage conditionnel selon rôle en session
    const storedRole = sessionStorage.getItem('choristesRole');
    if (storedRole === 'member' || storedRole === 'chef') {
      if (passwordContainer) passwordContainer.style.display = 'none';
      if (tabsWrap) tabsWrap.style.display = '';
      window.IS_CHEF = (storedRole === 'chef');
      if (document && document.body) {
        document.body.classList.toggle('role-chef', window.IS_CHEF);
      }
      showTab('chansons');
      generateChansonsContent();
    } else {
      // Aucune session: forcer l'affichage du formulaire de mot de passe
      if (passwordContainer) passwordContainer.style.display = '';
      if (tabsWrap) tabsWrap.style.display = 'none';
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
        const enteredRaw = passwordInput ? passwordInput.value : '';
        const entered = normalizeInput(enteredRaw);
        const correctRaw = await getPartitionPassword();
        const correct = correctRaw ? normalizeInput(correctRaw) : null;
        let role = null;
        if (entered === 'chefdechoeur') {
          role = 'chef';
        } else if (!correct || entered === correct) {
          role = 'member';
        }
        if (role) {
          sessionStorage.setItem('choristesRole', role);
          window.IS_CHEF = (role === 'chef');
          if (document && document.body) {
            document.body.classList.toggle('role-chef', window.IS_CHEF);
          }
          if (passwordContainer) passwordContainer.style.display = 'none';
          if (tabsWrap) tabsWrap.style.display = '';
          showTab('chansons');
          generateChansonsContent();
        } else {
          if (errorMsg) errorMsg.style.display = 'block';
        }
      });
    }

    // Déconnexion / Changer de rôle
    const logoutBtn = document.getElementById('logout-role');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(){
        try { sessionStorage.removeItem('choristesRole'); } catch {}
        window.IS_CHEF = false;
        if (document && document.body) {
          document.body.classList.remove('role-chef');
        }
        if (tabsWrap) tabsWrap.style.display = 'none';
        if (passwordContainer) passwordContainer.style.display = '';
        const err = document.getElementById('partition-error');
        if (err) err.style.display = 'none';
        const input = document.getElementById('partition-password');
        if (input) { input.value = ''; input.focus(); }
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
