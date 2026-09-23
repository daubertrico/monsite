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

  class StepQueue {
    constructor() { this.steps = []; }
    createStep(tick) {
      let step = this.steps.find(s => s.tick === tick);
      if (!step) { step = { tick, notes: [] }; this.steps.push(step); }
      return step;
    }
    addNote(tick, note) {
      const step = this.steps.find(s => s.tick === tick) || this.createStep(tick);
      step.notes.push(note);
    }
    sort() { this.steps.sort((a, b) => a.tick - b.tick); return this; }
    getFirstEmptyTick() { return this.sort().steps.filter(s => !s.notes.length)[0].tick; }
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
      this.stepQueue.sort();
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
    loadNotes(currentVoiceEntries) {
      let thisTick = this.lastTickOffset;
      if (this.stepQueue.steps.length > 0) thisTick = this.stepQueue.getFirstEmptyTick();
      for (const entry of currentVoiceEntries) {
        if (entry.IsGrace) continue;
        for (const note of entry.Notes) {
          this.stepQueue.addNote(thisTick, note);
          this.stepQueue.createStep(thisTick + note.Length.RealValue * this.tickDenominator);
        }
      }
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
        this.noteSchedulingCallback(timeToTick / 1000, step.notes);
        this.stepQueueIndex++;
        nextStep = this.stepQueue.steps[this.stepQueueIndex];
      }
      for (const tick of this.scheduledTicks) {
        if (tick <= this.currentTick) this.scheduledTicks.delete(tick);
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

      this.scheduler = new PlaybackScheduler(this.wholeNoteLength, this.ac, (delay, notes) =>
        this.notePlaybackCallback(delay, notes));

      this.cursor.reset();
      let steps = 0;
      while (!this.cursor.Iterator.EndReached) {
        if (this.cursor.Iterator.CurrentVoiceEntries) this.scheduler.loadNotes(this.cursor.Iterator.CurrentVoiceEntries);
        this.cursor.next();
        steps++;
      }
      this.iterationSteps = steps;
      this.cursor.reset();

      this.ready = true;
      this.setState(PlaybackState.STOPPED);
    }

    async play() {
      await this.ac.resume();
      if (this.state === PlaybackState.INIT || this.state === PlaybackState.STOPPED) this.cursor.show();
      this.setState(PlaybackState.PLAYING);
      this.scheduler.start();
    }
    async stop() {
      this.setState(PlaybackState.STOPPED);
      this.stopPlayers();
      this.clearTimeouts();
      this.scheduler.reset();
      this.cursor.reset();
      this.currentIterationStep = 0;
      this.cursor.hide();
    }
    pause() {
      this.setState(PlaybackState.PAUSED);
      this.ac.suspend();
      this.stopPlayers();
      this.scheduler.setIterationStep(this.currentIterationStep);
      this.scheduler.pause();
      this.clearTimeouts();
    }
    setBpm(bpm) {
      this.playbackSettings.bpm = bpm;
      if (this.scheduler) this.scheduler.wholeNoteLength = this.wholeNoteLength;
    }
    on(event, cb) { this.events.on(event, cb); }

    notePlaybackCallback(audioDelay, notes) {
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
        global.setTimeout(() => this.iterationCallback(), Math.max(0, audioDelay * 1000 - 35)),
        global.setTimeout(() => this.events.emit('iteration', notes), audioDelay * 1000)
      );
    }
    setState(state) { this.state = state; this.events.emit('state-change', state); }
    stopPlayers() {
      this.instrumentPlayer.stopAll();
    }
    clearTimeouts() { this.timeoutHandles.forEach(h => global.clearTimeout(h)); this.timeoutHandles = []; }
    iterationCallback() {
      if (this.state !== PlaybackState.PLAYING) return;
      if (this.currentIterationStep > 0) this.cursor.next();
      this.currentIterationStep++;
    }
  }

  global.OsmdPlayerEngine = PlaybackEngine;
})(window);
