// sound.js — Procedural audio for GreenAcres (Web Audio API, no external files)

const Sound = {
  ctx: null,
  masterGain: null,
  musicGain: null,
  sfxGain: null,
  musicPlaying: false,
  musicEnabled: true,
  sfxEnabled: true,
  _activeOscs: [],
  _musicTimer: null,
  _chordIdx: 0,

  _chords: [
    { freqs: [261.63, 329.63, 392.00], dur: 4 },
    { freqs: [220.00, 261.63, 329.63], dur: 4 },
    { freqs: [246.94, 311.13, 369.99], dur: 4 },
    { freqs: [196.00, 246.94, 293.66], dur: 4 },
  ],

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.15;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.4;
      this.sfxGain.connect(this.masterGain);
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  // --- Music ---

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
    return this.musicEnabled;
  },

  startMusic() {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    this.resume();
    this._playChord(this._chords[0]);
    this._chordIdx = 1;
    this._musicTimer = setInterval(() => {
      if (!this.musicPlaying) return;
      if (this._chordIdx >= this._chords.length) this._chordIdx = 0;
      this._playChord(this._chords[this._chordIdx]);
      this._chordIdx++;
    }, 4000);
  },

  stopMusic() {
    this.musicPlaying = false;
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    this._stopOscs();
  },

  _playChord(chord) {
    this._stopOscs();
    const t = this.ctx.currentTime;
    chord.freqs.forEach(f => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.5);
      g.gain.linearRampToValueAtTime(0.04, t + chord.dur - 0.5);
      g.gain.linearRampToValueAtTime(0, t + chord.dur);
      o.connect(g);
      g.connect(this.musicGain);
      o.start(t);
      o.stop(t + chord.dur);
      this._activeOscs.push({ o, g, tStop: t + chord.dur });
    });
  },

  _stopOscs() {
    this._activeOscs.forEach(({ o, g }) => {
      try { o.stop(); } catch (e) {}
      try { g.disconnect(); } catch (e) {}
    });
    this._activeOscs = [];
  },

  // --- SFX helpers ---

  _tone(freq, dur, type, vol, dest) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur);
  },

  _noise(dur, vol, freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = freq || 500;
    src.connect(flt);
    flt.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur);
  },

  // --- Public SFX ---

  click() {
    if (!this.sfxEnabled) return;
    this.resume();
    this._tone(660, 0.04, 'square', 0.08);
  },

  till() {
    if (!this.sfxEnabled) return;
    this.resume();
    this._noise(0.12, 0.18, 120);
    this._tone(70, 0.1, 'sine', 0.15);
  },

  plant() {
    if (!this.sfxEnabled) return;
    this.resume();
    this._tone(440, 0.12, 'sine', 0.18);
    setTimeout(() => this._tone(660, 0.08, 'sine', 0.12), 60);
  },

  irrigate() {
    if (!this.sfxEnabled) return;
    this.resume();
    this._noise(0.35, 0.1, 800);
    this._tone(360, 0.25, 'sine', 0.08);
  },

  harvest() {
    if (!this.sfxEnabled) return;
    this.resume();
    const notes = [523, 659, 784];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, 0.12, 'sine', 0.2), i * 80));
  },

  sell() {
    if (!this.sfxEnabled) return;
    this.resume();
    this._tone(880, 0.08, 'sine', 0.18);
    setTimeout(() => this._tone(1320, 0.12, 'sine', 0.18), 80);
  },

  advance() {
    if (!this.sfxEnabled) return;
    this.resume();
    this._tone(330, 0.06, 'sine', 0.1);
    setTimeout(() => this._tone(440, 0.06, 'sine', 0.1), 70);
    setTimeout(() => this._tone(550, 0.08, 'sine', 0.1), 140);
  },

  rain() {
    if (!this.sfxEnabled) return;
    this.resume();
    this._noise(0.6, 0.05, 1200);
  },

  thunder() {
    if (!this.sfxEnabled) return;
    this.resume();
    this._noise(0.4, 0.25, 80);
    this._tone(55, 0.3, 'sine', 0.15);
  },

  win() {
    if (!this.sfxEnabled) return;
    this.resume();
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.3, 'sine', 0.2), i * 180)
    );
  },

  lose() {
    if (!this.sfxEnabled) return;
    this.resume();
    [400, 350, 300, 200].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.25, 'sine', 0.15), i * 180)
    );
  },

  error() {
    if (!this.sfxEnabled) return;
    this.resume();
    this._tone(180, 0.15, 'sawtooth', 0.08);
    setTimeout(() => this._tone(130, 0.15, 'sawtooth', 0.08), 100);
  },
};
