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
          if (sousOngletContents[key]) {
            sousOngletContents[key].classList.toggle('active', this.dataset.sousonglet === key);
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
      if (sousOngletContents[key]) {
        sousOngletContents[key].classList.toggle('active', key === initialKey);
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
    document.querySelectorAll('.choristes-tab-content').forEach(div => div.classList.remove('active'));
    const panel = document.getElementById('tab-content-' + tab);
    if (panel) panel.classList.add('active');
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
            <th style="text-align:left;">Morceau</th>
            <th style="text-align:left;">Enregistrements</th>
            <th style="text-align:left;">Ressources</th>
            <th style="text-align:left;">Partitions interactives</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    fetch('data/partitions.json')
      .then(res => res.json())
      .then(data => {
        const tbody = document.querySelector('#partitions-table tbody');
        data.sort((a, b) => {
          if (!a.title) return 1;
          if (!b.title) return -1;
          return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
        });
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
          tbody.innerHTML += `
            <tr>
              <td>${partition.title || ''}</td>
              <td>${recordingsLinks.join('<br>')}</td>
              <td>${ressourcesLinks.join('<br>')}</td>
              <td>${interactiveLinks.join('<br>')}</td>
            </tr>
            <tr><td colspan='4' style='padding:0;'><hr style='border:0;border-top:1.5px solid #e0e0e0;margin:0;'></td></tr>
          `;
        });
        bindAudioClickOnce();
      });
  }

  document.addEventListener('DOMContentLoaded', function() {
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

    // Auto-ouverture si rôle en session (member ou chef)
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
    }

    // Utilitaire de normalisation (trim, lowercase, supprime accents/diacritiques et espaces)
    function normalizeInput(s) {
      if (!s) return '';
      try {
        return s.toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,'').trim().toLowerCase();
      } catch {
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

    // Gestion clic sur onglets principaux
    document.querySelectorAll('.choristes-tab').forEach(btn => {
      btn.addEventListener('click', function() {
        showTab(this.dataset.tab);
        if (this.dataset.tab === 'chansons') generateChansonsContent();
      });
    });
    updateTabStyles();
  });
})();
