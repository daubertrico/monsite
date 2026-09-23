// Logic spécifique pour la page Espace choristes (partitions)
(function() {
  // Le matériel des chansons (PDF/audio/partition/lien) est synchronisé
  // automatiquement depuis Google Drive vers ce fichier par
  // .github/workflows/sync-drive-materiel.yml (voir scripts/sync_drive_materiel.mjs).
  // Rien à modifier ici pour ajouter/masquer une chanson : la visibilité
  // (La Voix Libre / SOUL / Archives) dépend du sous-dossier Drive dans
  // lequel elle se trouve, voir visible_lavoixlibre/visible_soul ci-dessous.
  const MATERIEL_MANIFEST = 'data/partitions.json';
  const OSMD_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.4/build/opensheetmusicdisplay.min.js';
  const SOUNDFONT_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/soundfont-player@0.12.0/dist/soundfont-player.min.js';
  const OSMD_PLAYER_SCRIPT_URL = 'assets/js/osmd-player.js?v=20260923a';
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

  // ---- Visionneuse de partition MusicXML (chargée à la demande) ----
  let osmdLoadingPromise = null;
  function loadOSMD() {
    if (window.opensheetmusicdisplay) return Promise.resolve();
    if (osmdLoadingPromise) return osmdLoadingPromise;
    osmdLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = OSMD_SCRIPT_URL;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Impossible de charger la visionneuse de partition.'));
      document.head.appendChild(script);
    });
    return osmdLoadingPromise;
  }

  let soundfontLoadingPromise = null;
  function loadSoundfont() {
    if (window.Soundfont) return Promise.resolve();
    if (soundfontLoadingPromise) return soundfontLoadingPromise;
    soundfontLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SOUNDFONT_SCRIPT_URL;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Impossible de charger le synthétiseur audio.'));
      document.head.appendChild(script);
    });
    return soundfontLoadingPromise;
  }

  let osmdPlayerLoadingPromise = null;
  function loadOsmdPlayerEngine() {
    if (window.OsmdPlayerEngine) return Promise.resolve();
    if (osmdPlayerLoadingPromise) return osmdPlayerLoadingPromise;
    osmdPlayerLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = OSMD_PLAYER_SCRIPT_URL;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Impossible de charger le lecteur de partition.'));
      document.head.appendChild(script);
    });
    return osmdPlayerLoadingPromise;
  }

  function showScoreModal(title, musicxmlUrl) {
    let overlay = document.getElementById('score-modal-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'score-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;width:100vw;height:100vh;display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-bottom:1px solid #e0e0e0;flex-wrap:wrap;gap:10px;">
          <strong>${escAttr(title)}</strong>
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" id="score-zoom-out" style="background:#eee;color:#333;border:none;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:1.1em;">－</button>
              <span id="score-zoom-value" style="min-width:3.5em;text-align:center;font-size:0.9em;">60%</span>
              <button type="button" id="score-zoom-in" style="background:#eee;color:#333;border:none;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:1.1em;">＋</button>
            </div>
            <button type="button" id="score-print-btn" style="background:#eee;color:#333;border:none;border-radius:6px;padding:0 12px;height:28px;cursor:pointer;font-size:0.9em;">🖨️ Imprimer</button>
            <button type="button" id="score-modal-close" style="background:none;border:none;font-size:1.3em;cursor:pointer;color:#3981FF;">✖</button>
          </div>
        </div>
        <div id="score-player-controls" style="display:none;padding:10px 18px;border-bottom:1px solid #e0e0e0;background:#f7f9fc;"></div>
        <div id="score-modal-body" style="overflow:auto;padding:12px 18px;flex:1;"><em>Chargement de la partition…</em></div>
      </div>`;
    document.body.appendChild(overlay);
    let engine = null;
    let osmdRef = null;
    let zoom = 0.6;
    const close = () => { if (engine) { try { engine.stop(); } catch (e) {} } overlay.remove(); };
    overlay.querySelector('#score-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const body = overlay.querySelector('#score-modal-body');
    const controls = overlay.querySelector('#score-player-controls');
    const zoomValue = overlay.querySelector('#score-zoom-value');
    const applyZoom = (delta) => {
      if (!osmdRef) return;
      zoom = Math.min(2.5, Math.max(0.4, +(zoom + delta).toFixed(2)));
      zoomValue.textContent = Math.round(zoom * 100) + '%';
      osmdRef.zoom = zoom;
      osmdRef.render();
      if (engine) engine.cursor = osmdRef.cursor;
    };
    overlay.querySelector('#score-zoom-in').addEventListener('click', () => applyZoom(0.1));
    overlay.querySelector('#score-zoom-out').addEventListener('click', () => applyZoom(-0.1));
    overlay.querySelector('#score-print-btn').addEventListener('click', () => window.print());

    Promise.all([loadOSMD(), fetch(musicxmlUrl).then(res => res.text())]).then(([, musicxml]) => {
      body.innerHTML = '';
      const container = document.createElement('div');
      // Page unique "infinie" (comportement par défaut d'OSMD) : la pagination
      // A4 en grille 2 colonnes empêchait le curseur de lecture de s'afficher
      // correctement, on revient donc à l'affichage simple.
      container.id = 'score-pages-grid';
      if (!document.getElementById('score-pages-style')) {
        const style = document.createElement('style');
        style.id = 'score-pages-style';
        style.textContent = '#score-pages-grid{position:relative;}#score-pages-grid img,#score-pages-grid svg{max-width:100%;height:auto;}'
          // OSMD donne au curseur un z-index négatif par défaut. Comme rien
          // dans la modale ne crée de contexte d'empilement local, il remonte
          // jusqu'au niveau de la fenêtre (z-index 10000) et se retrouve
          // derrière tout le panneau blanc : invisible en permanence. On force
          // ici un z-index positif (règle !important, seule façon de gagner
          // sur le style inline que la librairie réapplique à chaque show()).
          + '#score-pages-grid img[id^="cursorImg-"]{z-index:1000 !important;}'
          + '@media print{body>*:not(#score-modal-overlay){display:none !important;}#score-modal-overlay{position:static !important;background:none !important;}#score-modal-overlay>div{width:auto !important;height:auto !important;overflow:visible !important;}#score-modal-overlay #score-print-btn,#score-modal-overlay #score-zoom-out,#score-modal-overlay #score-zoom-in,#score-modal-overlay #score-zoom-value,#score-modal-overlay #score-modal-close,#score-player-controls{display:none !important;}#score-modal-body{overflow:visible !important;}}';
        document.head.appendChild(style);
      }
      body.appendChild(container);
      const osmd = new window.opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
        autoResize: false,
        // Curseur rouge bien visible (voir aussi la règle CSS z-index ci-dessus,
        // qui est le vrai correctif du bug d'invisibilité).
        cursorsOptions: [{ type: 0, color: '#e0293e', alpha: 0.6, follow: true }]
      });
      return osmd.load(musicxml).then(() => {
        osmd.zoom = zoom;
        return osmd.render();
      }).then(() => osmd);
    }).then(osmd => {
      osmdRef = osmd;
      controls.innerHTML = '<em>Chargement du lecteur audio…</em>';
      controls.style.display = 'block';
      setupScorePlayer(osmd, controls).then(e => { engine = e; }).catch(err => {
        console.error('Lecture audio de la partition indisponible :', err);
        controls.innerHTML = '<em>Lecture audio indisponible : ' + escAttr(err.message || String(err)) + '</em>';
        controls.style.display = 'block';
      });
    }).catch(err => {
      body.innerHTML = '<em>Erreur lors de l\'affichage de la partition : ' + escAttr(err.message || String(err)) + '</em>';
    });
  }

  function withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      promise.then(v => { clearTimeout(timer); resolve(v); }, err => { clearTimeout(timer); reject(err); });
    });
  }

  // Construit les contrôles de lecture (play/pause/stop, tempo, mute/solo par
  // pupitre) sous la partition affichée, et retourne le moteur de lecture.
  function setupScorePlayer(osmd, controls) {
    return withTimeout(
      Promise.all([loadSoundfont(), loadOsmdPlayerEngine()]),
      20000,
      'Le chargement du synthétiseur audio a expiré (réseau lent ou bloqué). Réessaie ou vérifie ta connexion.'
    ).then(() => {
      const engine = new window.OsmdPlayerEngine();
      return withTimeout(
        engine.loadScore(osmd),
        30000,
        'Le chargement des instruments audio a expiré (réseau lent ou bloqué). Réessaie ou vérifie ta connexion.'
      ).then(() => {
        const voices = engine.getVoices();
        const defaultBpm = Math.round(engine.playbackSettings.bpm);
        const voiceRows = voices.map((v, i) => `
          <div style="display:inline-flex;align-items:center;gap:6px;margin:2px 14px 2px 0;font-size:0.92em;">
            <span style="min-width:5em;">${escAttr(v.label)}</span>
            <input type="range" class="score-voice-volume" data-voice-id="${v.voiceId}" min="0" max="100" value="100" style="width:90px;">
            <span class="score-voice-volume-value" style="min-width:2.5em;text-align:right;">100%</span>
            <button type="button" class="score-voice-solo" data-voice-id="${v.voiceId}" style="font-size:0.85em;padding:1px 6px;border-radius:6px;border:1px solid #3981FF;background:#fff;color:#3981FF;cursor:pointer;">Solo</button>
          </div>`).join('');
        controls.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
            <button type="button" id="score-play-btn" style="background:#3981FF;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;">▶ Lire</button>
            <button type="button" id="score-stop-btn" style="background:#eee;color:#333;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;">■ Stop</button>
            <label style="display:flex;align-items:center;gap:6px;font-size:0.9em;">
              Tempo
              <input type="range" id="score-bpm-range" min="20" max="220" value="${defaultBpm}" style="width:120px;">
              <span id="score-bpm-value">${defaultBpm}</span> bpm
            </label>
            <div style="display:flex;align-items:center;gap:6px;font-size:0.9em;">
              Son
              <button type="button" class="score-instrument-btn active" data-mode="piano" style="border:1px solid #3981FF;background:#3981FF;color:#fff;border-radius:6px 0 0 6px;padding:4px 10px;cursor:pointer;">🎹 Piano</button>
              <button type="button" class="score-instrument-btn" data-mode="voix" style="border:1px solid #3981FF;border-left:none;background:#fff;color:#3981FF;border-radius:0 6px 6px 0;padding:4px 10px;cursor:pointer;">🗣️ Voix</button>
            </div>
          </div>
          ${voices.length ? `<div id="score-voice-rows">${voiceRows}</div>` : ''}
        `;
        controls.style.display = 'block';

        const playBtn = controls.querySelector('#score-play-btn');
        const stopBtn = controls.querySelector('#score-stop-btn');
        const bpmRange = controls.querySelector('#score-bpm-range');
        controls.querySelectorAll('.score-instrument-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            controls.querySelectorAll('.score-instrument-btn').forEach(b => {
              const active = b === btn;
              b.classList.toggle('active', active);
              b.style.background = active ? '#3981FF' : '#fff';
              b.style.color = active ? '#fff' : '#3981FF';
            });
            engine.setInstrumentMode(btn.getAttribute('data-mode'));
          });
        });
        const bpmValue = controls.querySelector('#score-bpm-value');

        playBtn.addEventListener('click', () => {
          if (engine.state === 'PLAYING') { engine.pause(); } else { engine.play(); }
        });
        stopBtn.addEventListener('click', () => engine.stop());
        bpmRange.addEventListener('input', () => {
          bpmValue.textContent = bpmRange.value;
          engine.setBpm(Number(bpmRange.value));
        });
        engine.on('state-change', state => {
          playBtn.textContent = state === 'PLAYING' ? '⏸ Pause' : '▶ Lire';
        });

        controls.querySelectorAll('.score-voice-volume').forEach(range => {
          const valueLabel = range.nextElementSibling;
          range.addEventListener('input', () => {
            valueLabel.textContent = range.value + '%';
            engine.setVoiceVolume(Number(range.getAttribute('data-voice-id')), Number(range.value) / 100);
          });
        });
        controls.querySelectorAll('.score-voice-solo').forEach(btn => {
          btn.addEventListener('click', () => {
            const voiceId = Number(btn.getAttribute('data-voice-id'));
            const isSolo = btn.classList.toggle('active');
            btn.style.background = isSolo ? '#3981FF' : '#fff';
            btn.style.color = isSolo ? '#fff' : '#3981FF';
            engine.setVoiceSolo(voiceId, isSolo);
          });
        });

        return engine;
      });
    });
  }

  function bindScoreClickOnce() {
    if (window.__scoreClickBound) return;
    document.addEventListener('click', function(e) {
      if (e.target.classList && e.target.classList.contains('score-link')) {
        e.preventDefault();
        const idx = e.target.getAttribute('data-score-idx');
        const data = window.__choristesScores && window.__choristesScores[idx];
        if (data) showScoreModal(data.title, encodeURI(data.musicxml));
      }
    }, { capture: false });
    window.__scoreClickBound = true;
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

  function generateChansonsContent() {
    const container = document.getElementById('tab-content-chansons');
    if (!container) return;
    container.innerHTML = `
      <div class="legal-warning" style="background:#fff3cd;color:#856404;border:1px solid #ffeeba;padding:10px 16px;margin-bottom:14px;border-radius:8px;font-size:.93em;">
        <strong>Usage interne.</strong> Ces arrangements sont réservés aux membres — merci de ne pas les diffuser.
      </div>
      <div class="ensemble-selector">
        <p class="ensemble-selector-label">Quelles chansons afficher ?</p>
        <div class="ensemble-btns">
          <button type="button" class="ensemble-btn chansons-ensemble-btn active" data-ensemble="lavoixlibre">
            <span class="ens-icon">🎼</span>
            <span class="ens-name">La Voix Libre</span>
            <span class="ens-check">✓ Sélectionné</span>
          </button>
          <button type="button" class="ensemble-btn chansons-ensemble-btn" data-ensemble="soul">
            <span class="ens-icon">🎤</span>
            <span class="ens-name">SOUL</span>
            <span class="ens-check">✓ Sélectionné</span>
          </button>
        </div>
      </div>
      <div class="partition-search-bar">
        <input type="search" id="partition-search" placeholder="Rechercher une chanson…" autocomplete="off">
      </div>
      <div id="chansons-all" class="chansons-list"></div>
    `;

    function renderTable(parts, ensemble){
      // Simple choix d'ensemble (comme pour le calendrier) : tout le monde a
      // accès aux deux, on affiche juste les chansons du répertoire choisi.
      const visibleParts = parts.filter(p => ensemble === 'soul' ? p.visible_soul === true : p.visible_lavoixlibre === true);
      if (!visibleParts || visibleParts.length===0) return '<em>Aucune chanson.</em>';
      window.__choristesScores = [];
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

        const recordingsLinks = (partition.recordings||[]).map(r => `<a href="#" class="audio-link" data-src="${encodeURI(r.file)}">${r.label}</a>`).join('<br>');
        const ressourcesLinks = (partition.documents||[]).map(d => `<a href="${encodeURI(d.file)}" target="_blank">${d.label}</a>`).join('<br>');
        const interactiveLink = partition.interactive_link ? `<a href="${partition.interactive_link}" target="_blank">Partition en ligne</a>` : '';
        let scoreLink = '';
        if (partition.musicxml) {
          const idx = window.__choristesScores.length;
          window.__choristesScores.push({ title: partition.title, musicxml: partition.musicxml });
          scoreLink = `<a href="#" class="score-link" data-score-idx="${idx}">🎼 Voir la partition</a>`;
        }
        const extraLinks = [interactiveLink, scoreLink].filter(Boolean).join('<br>');

        return `<tr><td style="padding:10px 0;"><strong>${displayTitle}</strong><div style="margin-top:6px;">${recordingsLinks}${recordingsLinks && ressourcesLinks ? '<br>' : ''}${ressourcesLinks}${(recordingsLinks||ressourcesLinks) && extraLinks ? '<br>' : ''}${extraLinks}</div></td></tr><tr><td><hr style='border:0;border-top:1.5px solid #e0e0e0;margin:0;'></td></tr>`;
      }).join('') + '</tbody></table>';
    }

    // Fichier statique régénéré automatiquement par la synchro Drive (voir
    // MATERIEL_MANIFEST ci-dessus) : simple fetch, pas d'appel externe.
    function fetchMateriel() {
      return fetch(MATERIEL_MANIFEST)
        .then(res => res.json())
        .then(songs => ({ songs: Array.isArray(songs) ? songs : [] }))
        .catch(e => ({ songs: [], error: e.message || String(e) }));
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

    let parts = [];
    const savedEnsemble = localStorage.getItem('choristesChansonsEnsemble');
    const ensembleHint = localStorage.getItem('choristesEnsembleHint');
    let chansonsEnsemble = savedEnsemble || (ensembleHint === 'soul' ? 'soul' : 'lavoixlibre');
    const listEl = document.getElementById('chansons-all');
    const ensembleBtns = Array.from(container.querySelectorAll('.chansons-ensemble-btn'));

    function updateEnsembleBtnStyles() {
      ensembleBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-ensemble') === chansonsEnsemble));
    }
    ensembleBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        chansonsEnsemble = this.getAttribute('data-ensemble');
        localStorage.setItem('choristesChansonsEnsemble', chansonsEnsemble);
        updateEnsembleBtnStyles();
        rerender();
      });
    });
    updateEnsembleBtnStyles();

    function rerender() {
      listEl.innerHTML = parts.length ? renderTable(parts, chansonsEnsemble) : '<em>Chargement des chansons…</em>';
      const searchInput = document.getElementById('partition-search');
      applySearchFilter(searchInput ? searchInput.value : '');
      bindAudioClickOnce();
      bindScoreClickOnce();
    }
    rerender();

    // Recherche en temps réel
    const searchInput = document.getElementById('partition-search');
    if (searchInput) {
      searchInput.addEventListener('input', function() { applySearchFilter(this.value); });
      searchInput.focus();
    }

    fetchMateriel().then(({ songs, error }) => {
      if (error) {
        console.error('fetchMateriel failed', error);
        listEl.innerHTML = '<em>Impossible de charger les chansons pour le moment. Réessaie plus tard ou préviens le bureau.</em>';
        return;
      }
      parts = sortParts(songs);
      rerender();
    });
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
