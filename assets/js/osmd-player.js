/**
 * Petit moteur de lecture audio pour les partitions OpenSheetMusicDisplay,
 * avec gestion mute/solo par voix (pupitre) et réglage du tempo.
 *
 * Adapté (et simplifié en JS pur, sans build) à partir du projet MIT
 * "osmd-audio-player" de Jimmy Utterström (https://github.com/jimutt/osmd-audio-player),
 * en ajoutant le filtrage mute/solo par voix nécessaire pour une répétition
 * de chorale (écouter un pupitre seul, ou tous ensemble).
 *
 * Dépend du synthétiseur "soundfont-player" (global `Soundfont`), à charger
 * avant ce script.
 */
(function (global) {
  'use strict';

  const GM_INSTRUMENTS = [
    'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
    'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavi', 'Celesta', 'Glockenspiel',
    'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
    'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion',
    'Harmonica', 'Tango Accordion', 'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)',
    'Electric Guitar (jazz)', 'Electric Guitar (clean)', 'Electric Guitar (muted)',
    'Overdriven Guitar', 'Distortion Guitar', 'Guitar harmonics', 'Acoustic Bass',
    'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1',
    'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2', 'Violin', 'Viola', 'Cello', 'Contrabass',
    'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani', 'String Ensemble 1',
    'String Ensemble 2', 'SynthStrings 1', 'SynthStrings 2', 'Choir Aahs', 'Voice Oohs',
    'Synth Choir', 'Orchestra Hit', 'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn',
    'Brass Section', 'SynthBrass 1', 'SynthBrass 2', 'Soprano Sax', 'Alto Sax', 'Tenor Sax',
    'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet', 'Piccolo', 'Flute', 'Recorder',
    'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina'
  ];

  function gmInstrumentName(midiId) {
    return (GM_INSTRUMENTS[midiId] || 'Acoustic Grand Piano').toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
  }

  class EventEmitter {
    constructor() { this.subscribers = new Map(); }
    on(event, cb) {
      if (!this.subscribers.has(event)) this.subscribers.set(event, []);
      this.subscribers.get(event).push(cb);
    }
    emit(event, ...args) {
      (this.subscribers.get(event) || []).forEach(cb => cb(...args));
    }
  }

  // Une étape = une position du curseur OSMD (même ordre, même index), ce qui
  // garde le curseur affiché synchronisé avec le son. Le tick de chaque étape
  // vient du temps réel de la position dans la partition (voir loadScore).
  // L'ancienne version déduisait ce tick en additionnant les durées des notes
  // et en cherchant "la première étape vide" : avec des triolets (durées en
  // 1/3), les arrondis flottants créaient des étapes fantômes et toute la
  // suite de la partition se retrouvait compressée (lecture qui s'accélère
  // jusqu'à devenir inaudible).
  class StepQueue {
    constructor() { this.steps = []; }
    addStep(tick, notes, measure) { this.steps.push({ tick, notes, measure }); }
  }

  class PlaybackScheduler {
    constructor(wholeNoteLength, audioContext, noteSchedulingCallback) {
      this.wholeNoteLength = wholeNoteLength;
      this.audioContext = audioContext;
      this.noteSchedulingCallback = noteSchedulingCallback;
      this.stepQueue = new StepQueue();
      this.stepQueueIndex = 0;
      this.scheduledTicks = new Set();
      this.currentTick = 0;
      this.currentTickTimestamp = 0;
      this.audioContextStartTime = 0;
      this.schedulerIntervalHandle = null;
      this.scheduleInterval = 200;
      this.schedulePeriod = 500;
      this.tickDenominator = 1024;
      this.lastTickOffset = 300;
      this.playing = false;
    }
    get audioContextTime() {
      if (!this.audioContext) return 0;
      return (this.audioContext.currentTime - this.audioContextStartTime) * 1000;
    }
    get tickDuration() { return this.wholeNoteLength / this.tickDenominator; }
    get calculatedTick() {
      return this.currentTick + Math.round((this.audioContextTime - this.currentTickTimestamp) / this.tickDuration);
    }
    start() {
      this.playing = true;
      this.audioContextStartTime = this.audioContext.currentTime;
      this.currentTickTimestamp = this.audioContextTime;
      if (!this.schedulerIntervalHandle) {
        this.schedulerIntervalHandle = global.setInterval(() => this.scheduleIterationStep(), this.scheduleInterval);
      }
    }
    setIterationStep(step) {
      step = Math.min(this.stepQueue.steps.length - 1, step);
      this.stepQueueIndex = step;
      this.currentTick = this.stepQueue.steps[this.stepQueueIndex] ? this.stepQueue.steps[this.stepQueueIndex].tick : 0;
    }
    pause() { this.playing = false; }
    reset() {
      this.playing = false;
      this.currentTick = 0;
      this.currentTickTimestamp = 0;
      this.stepQueueIndex = 0;
      global.clearInterval(this.schedulerIntervalHandle);
      this.schedulerIntervalHandle = null;
    }
    // Change le tempo sans saut : on fige d'abord la position courante avec
    // l'ancienne durée de tick avant d'appliquer la nouvelle.
    setWholeNoteLength(length) {
      if (this.playing) {
        this.currentTick = this.calculatedTick;
        this.currentTickTimestamp = this.audioContextTime;
      }
      this.wholeNoteLength = length;
    }
    // positionInWholeNotes : temps écoulé depuis le début de la partition, en rondes.
    loadStep(positionInWholeNotes, currentVoiceEntries, measure) {
      const tick = this.lastTickOffset + Math.round(positionInWholeNotes * this.tickDenominator * 1000) / 1000;
      const notes = [];
      for (const entry of currentVoiceEntries || []) {
        if (entry.IsGrace) continue;
        notes.push(...entry.Notes);
      }
      this.stepQueue.addStep(tick, notes, measure);
    }
    scheduleIterationStep() {
      if (!this.playing) return;
      this.currentTick = this.calculatedTick;
      this.currentTickTimestamp = this.audioContextTime;
      let nextStep = this.stepQueue.steps[this.stepQueueIndex];
      while (nextStep && this.currentTickTimestamp + (nextStep.tick - this.currentTick) * this.tickDuration
        <= this.currentTickTimestamp + this.schedulePeriod) {
        const step = nextStep;
        let timeToTick = (step.tick - this.currentTick) * this.tickDuration;
        if (timeToTick < 0) timeToTick = 0;
        this.scheduledTicks.add(step.tick);
        this.noteSchedulingCallback(timeToTick / 1000, step.notes, this.stepQueueIndex);
        this.stepQueueIndex++;
        nextStep = this.stepQueue.steps[this.stepQueueIndex];
      }
      for (const tick of this.scheduledTicks) {
        if (tick <= this.currentTick) this.scheduledTicks.delete(tick);
      }
      if (!nextStep && this.onEnd) {
        const last = this.stepQueue.steps[this.stepQueue.steps.length - 1];
        if (!last || this.currentTick > last.tick) this.onEnd();
      }
    }
  }

  class SoundfontPlayer {
    constructor() { this.players = new Map(); this.audioContext = null; }
    init(audioContext) { this.audioContext = audioContext; }
    async load(midiId) {
      if (this.players.has(midiId)) return;
      const player = await global.Soundfont.instrument(this.audioContext, gmInstrumentName(midiId));
      this.players.set(midiId, player);
    }
    stop(midiId) { if (this.players.has(midiId)) this.players.get(midiId).stop(); }
    stopAll() { for (const player of this.players.values()) player.stop(); }
    schedule(midiId, time, notes) {
      if (!this.players.has(midiId)) return;
      for (const note of notes) {
        if (note.articulation === 'staccato') {
          note.gain = Math.max(note.gain + 0.3, note.gain * 1.3);
          note.duration = Math.min(note.duration * 0.4, 0.4);
        }
      }
      this.players.get(midiId).schedule(time, notes);
    }
  }

  const PlaybackState = { INIT: 'INIT', PLAYING: 'PLAYING', STOPPED: 'STOPPED', PAUSED: 'PAUSED' };

  class PlaybackEngine {
    constructor() {
      this.ac = new (global.AudioContext || global.webkitAudioContext)();
      this.ac.suspend();
      this.instrumentPlayer = new SoundfontPlayer();
      this.instrumentPlayer.init(this.ac);
      this.events = new EventEmitter();
      this.cursor = null;
      this.sheet = null;
      this.scheduler = null;
      this.iterationSteps = 0;
      this.currentIterationStep = 0;
      this.cursorIndex = 0;
      this.timeoutHandles = [];
      this.defaultBpm = 100;
      this.playbackSettings = { bpm: this.defaultBpm };
      this.scoreInstruments = [];
      this.voiceVolumes = new Map();
      this.soloVoiceIds = new Set();
      this.instrumentMode = 'piano';
      this.ready = false;
      this.setState(PlaybackState.INIT);
    }
    get wholeNoteLength() { return Math.round((60 / this.playbackSettings.bpm) * 4000); }

    getVoices() {
      const voices = [];
      for (const instrument of this.scoreInstruments) {
        for (const voice of instrument.Voices) {
          voices.push({
            voiceId: voice.__playerUid,
            label: instrument.Name || ('Pupitre ' + voice.__playerUid)
          });
        }
      }
      return voices;
    }
    setVoiceVolume(voiceId, volume) {
      this.voiceVolumes.set(voiceId, Math.max(0, Math.min(1, volume)));
    }
    getVoiceVolume(voiceId) {
      return this.voiceVolumes.has(voiceId) ? this.voiceVolumes.get(voiceId) : 1;
    }
    setVoiceSolo(voiceId, solo) {
      if (solo) this.soloVoiceIds.add(voiceId); else this.soloVoiceIds.delete(voiceId);
    }
    clearSolos() { this.soloVoiceIds.clear(); }
    getVoiceGain(voiceId) {
      if (this.soloVoiceIds.size > 0 && !this.soloVoiceIds.has(voiceId)) return 0;
      return this.getVoiceVolume(voiceId);
    }
    setInstrumentMode(mode) { this.instrumentMode = mode === 'voix' ? 'voix' : 'piano'; }
    getMidiIdForVoice(voice) { return this.instrumentMode === 'voix' ? voice.__originalMidiId : 0; }

    async loadScore(osmd) {
      this.ready = false;
      this.sheet = osmd.Sheet;
      this.scoreInstruments = this.sheet.Instruments;
      this.cursor = osmd.cursor;
      if (this.sheet.HasBPMInfo) this.setBpm(this.sheet.DefaultStartTempoInBpm);

      // Chaque voix reçoit un identifiant unique (__playerUid) car plusieurs
      // pupitres (soprano/alto/ténor/basse) partagent souvent le même VoiceId
      // (1) dans un export MuseScore, ce qui faisait que couper/soloer un
      // pupitre agissait sur tous les autres. On précharge à la fois un son
      // de piano (id MIDI 0) et le son "voix/choeur" déclaré par la partition
      // pour chaque voix, afin de pouvoir basculer instantanément entre les
      // deux via setInstrumentMode('piano' | 'voix').
      const midiIds = new Set([0]);
      let voiceUid = 0;
      for (const instrument of this.sheet.Instruments) {
        for (const voice of instrument.Voices) {
          voice.__originalMidiId = instrument.MidiInstrumentId;
          voice.__playerUid = voiceUid++;
          midiIds.add(instrument.MidiInstrumentId);
        }
      }
      await Promise.all([...midiIds].map(id => this.instrumentPlayer.load(id)));

      this.scheduler = new PlaybackScheduler(this.wholeNoteLength, this.ac, (delay, notes, stepIndex) =>
        this.notePlaybackCallback(delay, notes, stepIndex));
      this.scheduler.onEnd = () => this.onPlaybackEnd();

      // Position de chaque étape = temps de la position du curseur dans la
      // partition. Si le temps recule (reprise/renvoi), on continue d'avancer
      // en ajoutant la fin de la mesure quittée puis le début de celle atteinte.
      this.cursor.reset();
      const it = this.cursor.Iterator;
      let steps = 0;
      let position = 0;
      let prevTs = null;
      let prevMeasureEnd = null;
      while (!it.EndReached) {
        const measure = it.CurrentMeasure;
        const ts = it.currentTimeStamp.RealValue;
        if (prevTs !== null) {
          if (ts >= prevTs) position += ts - prevTs;
          else position += (prevMeasureEnd - prevTs) + (ts - measure.AbsoluteTimestamp.RealValue);
        }
        this.scheduler.loadStep(position, it.CurrentVoiceEntries, measure);
        prevTs = ts;
        prevMeasureEnd = measure.AbsoluteTimestamp.RealValue + measure.Duration.RealValue;
        this.cursor.next();
        steps++;
      }
      this.iterationSteps = steps;
      this.cursor.reset();
      this.cursorIndex = 0;

      this.ready = true;
      this.setState(PlaybackState.STOPPED);
    }

    async play() {
      if (this.state === PlaybackState.PLAYING) return;
      await this.ac.resume();
      // Reprend à l'étape courante : 0 après Stop, juste après la dernière
      // note jouée après Pause, ou la mesure choisie par un clic.
      this.scheduler.setIterationStep(this.currentIterationStep);
      this.moveCursorTo(this.currentIterationStep);
      this.cursor.show();
      this.setState(PlaybackState.PLAYING);
      this.scheduler.start();
    }
    async stop() {
      this.setState(PlaybackState.STOPPED);
      this.stopPlayers();
      this.clearTimeouts();
      this.scheduler.reset();
      this.cursor.reset();
      this.cursorIndex = 0;
      this.currentIterationStep = 0;
      this.cursor.hide();
    }
    pause() {
      if (this.state !== PlaybackState.PLAYING) return;
      this.setState(PlaybackState.PAUSED);
      this.ac.suspend();
      this.stopPlayers();
      this.scheduler.pause();
      this.clearTimeouts();
      this.scheduler.setIterationStep(this.currentIterationStep);
    }
    // Place la lecture au début de la mesure donnée (SourceMeasure d'OSMD) ;
    // continue de jouer si on était en lecture.
    seekToMeasure(sourceMeasure) {
      const steps = this.scheduler ? this.scheduler.stepQueue.steps : [];
      const index = steps.findIndex(s => s.measure === sourceMeasure);
      if (index < 0) return false;
      const wasPlaying = this.state === PlaybackState.PLAYING;
      if (wasPlaying) {
        this.stopPlayers();
        this.clearTimeouts();
        this.scheduler.pause();
      }
      this.currentIterationStep = index;
      this.scheduler.setIterationStep(index);
      this.moveCursorTo(index);
      this.cursor.show();
      if (wasPlaying) this.scheduler.start();
      else this.setState(PlaybackState.PAUSED);
      return true;
    }
    // Après un nouveau rendu (zoom), OSMD réinitialise son curseur : on le
    // replace là où il était.
    resyncCursor(cursor) {
      const target = this.cursorIndex;
      this.cursor = cursor;
      this.cursor.reset();
      this.cursorIndex = 0;
      this.moveCursorTo(target);
      if (this.state === PlaybackState.STOPPED || this.state === PlaybackState.INIT) this.cursor.hide();
      else this.cursor.show();
    }
    moveCursorTo(index) {
      if (index < this.cursorIndex) { this.cursor.reset(); this.cursorIndex = 0; }
      while (this.cursorIndex < index && !this.cursor.Iterator.EndReached) {
        this.cursor.next();
        this.cursorIndex++;
      }
    }
    onPlaybackEnd() {
      if (this.state !== PlaybackState.PLAYING || this._endTimer) return;
      // Laisse sonner la dernière note avant de revenir au début.
      this._endTimer = global.setTimeout(() => {
        this._endTimer = null;
        if (this.state === PlaybackState.PLAYING) this.stop();
      }, 1500);
    }
    setBpm(bpm) {
      this.playbackSettings.bpm = bpm;
      if (this.scheduler) this.scheduler.setWholeNoteLength(this.wholeNoteLength);
    }
    on(event, cb) { this.events.on(event, cb); }

    notePlaybackCallback(audioDelay, notes, stepIndex) {
      if (this.state !== PlaybackState.PLAYING) return;
      const scheduledNotes = new Map();
      for (const note of notes) {
        if (note.isRest()) continue;
        const voice = note.ParentVoiceEntry.ParentVoice;
        const gain = this.getVoiceGain(voice.__playerUid);
        if (gain <= 0) continue;

        let duration = note.Length.RealValue * this.wholeNoteLength;
        if (note.NoteTie) {
          if (Object.is(note.NoteTie.StartNote, note) && note.NoteTie.Notes[1]) {
            duration += note.NoteTie.Notes[1].Length.RealValue * this.wholeNoteLength;
          } else {
            duration = 0;
          }
        }
        if (duration === 0) continue;

        const midiId = this.getMidiIdForVoice(voice);
        if (!scheduledNotes.has(midiId)) scheduledNotes.set(midiId, []);
        const fixedKey = (note.ParentVoiceEntry.ParentVoice.Parent.SubInstruments[0].fixedKey) || 0;
        scheduledNotes.get(midiId).push({
          note: note.halfTone - fixedKey * 12,
          duration: duration / 1000,
          gain: gain,
          articulation: note.ParentVoiceEntry.isStaccato() ? 'staccato' : 'none'
        });
      }
      for (const [midiId, ns] of scheduledNotes) {
        this.instrumentPlayer.schedule(midiId, this.ac.currentTime + audioDelay, ns);
      }
      this.timeoutHandles.push(
        global.setTimeout(() => this.iterationCallback(stepIndex), Math.max(0, audioDelay * 1000 - 35)),
        global.setTimeout(() => this.events.emit('iteration', notes), audioDelay * 1000)
      );
    }
    setState(state) { this.state = state; this.events.emit('state-change', state); }
    stopPlayers() {
      this.instrumentPlayer.stopAll();
    }
    clearTimeouts() {
      this.timeoutHandles.forEach(h => global.clearTimeout(h));
      this.timeoutHandles = [];
      if (this._endTimer) { global.clearTimeout(this._endTimer); this._endTimer = null; }
    }
    iterationCallback(stepIndex) {
      if (this.state !== PlaybackState.PLAYING) return;
      this.moveCursorTo(stepIndex);
      this.currentIterationStep = stepIndex + 1;
    }
  }

  global.OsmdPlayerEngine = PlaybackEngine;
})(window);
