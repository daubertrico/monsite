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
      <h2>Espace choristes : partitions et ressources</h2>
      <table id="partitions-table" style="width:100%;border-collapse:collapse;margin:2em 0;font-family:'Segoe UI',Arial,sans-serif;background:#fff;box-shadow:0 2px 8px #0002;">
        <thead>
          <tr>
            <th style="width:64px;text-align:center;">Vis.</th>
            <th style="text-align:left;">Morceau</th>
            <th style="text-align:left;">Enregistrements</th>
            <th style="text-align:left;">Ressources</th>
            <th style="text-align:left;">Partitions interactives</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    // Visibility helpers (persist in localStorage)
    const VIS_KEY = 'partitionsVisibility';
    function simplifyKey(s){ return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase(); }
    function loadVisibility(){ try { return JSON.parse(localStorage.getItem(VIS_KEY) || '{}'); } catch { return {}; } }
    function saveVisibility(m){ try { localStorage.setItem(VIS_KEY, JSON.stringify(m||{})); } catch {} }
    function isVisible(part){ const m = loadVisibility(); const k = simplifyKey(part.title); if (k in m) return !!m[k]; if (typeof part.visible !== 'undefined') return !!part.visible; return true; }

    fetch('data/partitions.json')
      .then(res => res.json())
      .then(data => {
        const tbody = document.querySelector('#partitions-table tbody');
        data.sort((a, b) => {
          if (!a.title) return 1;
          if (!b.title) return -1;
          return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
        });

        // If not chef, filter out hidden partitions
        if (!window.IS_CHEF) {
          data = data.filter(p => isVisible(p));
        }

        data.forEach(partition => {
          const recordingsLinks = [];
          const ressourcesLinks = [];
          const interactiveLinks = [];
          if (partition.recordings) {
            partition.recordings.forEach(rec => {
              recordingsLinks.push(`<a href="#" class="audio-link" data-src="${rec.file}">${rec.label}</a>`);
            });
          }
          if (partition.recordings_link) {
            recordingsLinks.push(`<a href="${partition.recordings_link}" target="_blank">Enregistrements</a>`);
          }
          if (partition.documents) {
            partition.documents.forEach(doc => {
              ressourcesLinks.push(`<a href="${doc.file}" target="_blank">${doc.label}</a>`);
            });
          }
          if (partition.paroles_prononciation_image) {
            ressourcesLinks.push(`<a href="${partition.paroles_prononciation_image}" target="_blank">Paroles & prononciation</a>`);
          }
          if (partition.interactive_link) {
            interactiveLinks.push(`<a href="${partition.interactive_link}" target="_blank">Partition interactive</a>`);
          } else if (partition.flatio_link) {
            interactiveLinks.push(`<a href="${partition.flatio_link}" target="_blank">Partition interactive</a>`);
          }

          // Visibility control (chef only)
          const key = simplifyKey(partition.title);
          const visible = isVisible(partition);
          const visCell = window.IS_CHEF ? `<td style="width:64px;text-align:center;"><label title="${visible ? 'Visible pour les choristes' : 'Masqué pour les choristes'}" style="cursor:pointer;"><input type="checkbox" data-vis-key="${key}" class="vis-toggle" ${visible ? 'checked' : ''} style="transform:scale(1.05);margin-right:6px; vertical-align:middle;">${visible ? '👁️' : '🙈'}</label></td>` : `<td style="width:64px;"></td>`;

          tbody.innerHTML += `
            <tr data-vis-key="${key}">
              ${visCell}
              <td class="title-cell">${partition.title || ''}</td>
              <td>${recordingsLinks.join('<br>')}</td>
              <td>${ressourcesLinks.join('<br>')}</td>
              <td>${interactiveLinks.join('<br>')}</td>
            </tr>
            <tr><td colspan='5' style='padding:0;'><hr style='border:0;border-top:1.5px solid #e0e0e0;margin:0;'></td></tr>
          `;
        });

        // Apply dimming for hidden items when chef views
        if (window.IS_CHEF) {
          document.querySelectorAll('#partitions-table tbody tr[data-vis-key]').forEach(tr => {
            const k = tr.getAttribute('data-vis-key');
            const p = { title: tr.querySelector('.title-cell') ? tr.querySelector('.title-cell').textContent : '' };
            const v = isVisible(p);
            const titleTd = tr.querySelector('.title-cell');
            if (titleTd) titleTd.style.opacity = v ? '1' : '0.45';
          });
        }

        // Bind checkbox toggles
        document.querySelectorAll('.vis-toggle').forEach(chk => {
          chk.addEventListener('change', function(){
            try {
              const visMap = loadVisibility();
              const k = this.dataset.visKey;
              visMap[k] = !!this.checked;
              saveVisibility(visMap);
              // update UI: icon and dimming
              const row = this.closest('tr');
              if (row) {
                const titleTd = row.querySelector('.title-cell');
                if (titleTd) titleTd.style.opacity = this.checked ? '1' : '0.45';
                // update label emoji
                const lbl = this.parentElement;
                if (lbl) lbl.innerHTML = `<input type=\"checkbox\" data-vis-key=\"${k}\" class=\"vis-toggle\" ${this.checked ? 'checked' : ''} style=\"transform:scale(1.05);margin-right:6px;vertical-align:middle;\">${this.checked ? '👁️' : '🙈'}`;
                // re-bind newly created checkbox (simple approach)
                const newChk = row.querySelector('.vis-toggle');
                if (newChk && newChk !== this) {
                  newChk.addEventListener('change', arguments.callee);
                }
              }
            } catch (e) { console.error(e); }
          });
        });

        // Create export button in admin panel for convenience
        if (window.IS_CHEF) {
          try {
            const admin = document.getElementById('admin-panel');
            if (admin && !document.getElementById('btn-export-visibility')) {
              const div = document.createElement('div');
              div.style.marginTop = '10px';
              div.innerHTML = `<button id="btn-export-visibility" type="button" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:600;background:#eef5ff;color:#134;border:2px solid #98bfff;">Exporter visibilité (JSON)</button>`;
              admin.appendChild(div);
              document.getElementById('btn-export-visibility').addEventListener('click', async function(){
                try {
                  const resp = await fetch('data/partitions.json');
                  const parts = await resp.json();
                  const vis = loadVisibility();
                  const patched = parts.map(p => { const k = simplifyKey(p.title); if (k in vis) p.visible = !!vis[k]; return p; });
                  const blob = new Blob([JSON.stringify(patched, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'partitions-with-visibility.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
                } catch (e) { console.error(e); alert('Export failed: ' + (e && e.message)); }
              });
            }
          } catch (e) { console.error(e); }
        }

        bindAudioClickOnce();
      });
  }

  function initChoristesPage(){
    // Rôles ARIA de base pour les onglets principaux
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
