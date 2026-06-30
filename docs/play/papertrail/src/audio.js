let ctx = null;
let muted = false;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, duration, type = 'square', vol = 0.08) {
  if (muted) return;
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch (e) { /* ignore */ }
}

function noise(c, dur, vol) {
  try {
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(gain);
    gain.connect(c.destination);
    src.start(c.currentTime);
  } catch (e) { /* ignore */ }
}

export const sfx = {
  coin() { tone(880, 0.1, 'sine', 0.06); setTimeout(() => tone(1320, 0.08, 'sine', 0.04), 50); },
  crash() { tone(120, 0.3, 'sawtooth', 0.1); tone(80, 0.4, 'sawtooth', 0.08); noise(getCtx(), 0.15, 0.06); },
  start() { tone(660, 0.15, 'sine', 0.06); setTimeout(() => tone(880, 0.2, 'sine', 0.06), 120); },
  hop() { tone(440, 0.1, 'sine', 0.05); tone(660, 0.08, 'sine', 0.04); },
  land() { tone(220, 0.08, 'sine', 0.05); },
  ramp() { tone(330, 0.12, 'sine', 0.06); setTimeout(() => tone(550, 0.18, 'sine', 0.05), 60); },
  trick() { tone(700, 0.06, 'triangle', 0.05); setTimeout(() => tone(950, 0.06, 'triangle', 0.05), 50); },
  nearmiss() { tone(1100, 0.05, 'sine', 0.035); },
  boost() { tone(300, 0.1, 'sawtooth', 0.05); setTimeout(() => tone(600, 0.12, 'sawtooth', 0.05), 70); setTimeout(() => tone(900, 0.18, 'sine', 0.05), 150); },
  over() { tone(300, 0.15, 'square', 0.06); setTimeout(() => tone(200, 0.3, 'square', 0.06), 200); },
  zone() { tone(523, 0.1, 'sine', 0.05); setTimeout(() => tone(659, 0.1, 'sine', 0.05), 100); setTimeout(() => tone(784, 0.15, 'sine', 0.05), 200); },
  thunder() {
    if (muted) return;
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, c.currentTime + 0.6);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.12, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.8);
      noise(c, 0.3, 0.12);
    } catch (e) { /* ignore */ }
  },
  isMuted() { return muted; },
  toggleMute() { muted = !muted; if (muted) music.stop(); return muted; },
  setMuted(v) { muted = v; if (muted) music.stop(); },
};

/* ---- procedural music ---- */
const THEMES = {
  forest:     { root: 147, chord: [0, 3, 7],     wave: 'sine',     bpm: 70, pattern: [0, 1, 2, 1] },
  suburb:     { root: 165, chord: [0, 4, 7],     wave: 'triangle', bpm: 95, pattern: [0, 2, 1, 2, 0, 1, 2, 1] },
  downtown:   { root: 196, chord: [0, 3, 7],     wave: 'square',   bpm: 110, pattern: [0, 1, 2, 3, 2, 1] },
  construction: { root: 110, chord: [0, 2, 7],   wave: 'sawtooth', bpm: 90, pattern: [0, 0, 1, 1, 2, 2, 1, 1] },
  park:       { root: 131, chord: [0, 4, 7],     wave: 'sine',     bpm: 75, pattern: [0, 2, 0, 1, 0, 2, 0, 1] },
  harbour:    { root: 165, chord: [0, 3, 7],     wave: 'triangle', bpm: 80, pattern: [0, 0, 2, 2, 1, 1, 2, 2] },
  university: { root: 175, chord: [0, 4, 7],     wave: 'sine',     bpm: 85, pattern: [0, 1, 2, 3, 4, 3, 2, 1] },
  arts:       { root: 220, chord: [0, 3, 7, 10], wave: 'triangle', bpm: 100, pattern: [0, 2, 1, 3, 0, 2, 1, 3] },
};

let musicState = {
  playing: false,
  masterGain: null,
  droneOsc: null,
  droneGain: null,
  padOscs: [],
  padGain: null,
  arpTimer: null,
  arpBeat: 0,
  currentThemeId: null,
};

function freqFromRoot(root, semitones) {
  return root * Math.pow(2, semitones / 12);
}

function startDrone(c, theme) {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = theme.root * 0.5;
  const gain = c.createGain();
  gain.gain.value = 0.025;
  osc.connect(gain);
  gain.connect(musicState.masterGain);
  osc.start();
  return { osc, gain };
}

function startPad(c, theme) {
  const oscs = [];
  const baseFreq = theme.root;
  for (let i = 0; i < Math.min(theme.chord.length, 3); i++) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freqFromRoot(baseFreq, theme.chord[i]);
    const gain = c.createGain();
    gain.gain.value = 0.015;
    osc.connect(gain);
    gain.connect(musicState.masterGain);
    osc.start();
    oscs.push({ osc, gain });
  }
  return oscs;
}

function scheduleArpNote(c, theme) {
  if (!musicState.playing || muted) return;
  const chord = theme.chord;
  const pattern = theme.pattern;
  const noteIdx = pattern[musicState.arpBeat % pattern.length] % chord.length;
  const semitones = chord[noteIdx];
  const freq = freqFromRoot(theme.root, semitones);
  const vol = 0.04;
  const now = c.currentTime;
  const dur = 60 / theme.bpm * 0.7;
  const osc = c.createOscillator();
  osc.type = theme.wave;
  osc.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.02);
  gain.gain.linearRampToValueAtTime(vol * 0.001, now + dur);
  osc.connect(gain);
  gain.connect(musicState.masterGain);
  osc.start(now);
  osc.stop(now + dur + 0.05);
  musicState.arpBeat++;
}

export const music = {
  start(themeId) {
    if (muted) return;
    this.stop();
    try {
      const c = getCtx();
      musicState.masterGain = c.createGain();
      musicState.masterGain.gain.value = 0.12;
      musicState.masterGain.connect(c.destination);
      const theme = THEMES[themeId] || THEMES.forest;
      musicState.currentThemeId = themeId;
      const d = startDrone(c, theme);
      musicState.droneOsc = d.osc;
      musicState.droneGain = d.gain;
      musicState.padOscs = startPad(c, theme);
      musicState.playing = true;
      musicState.arpBeat = 0;
      const intervalMs = 60000 / theme.bpm;
      scheduleArpNote(c, theme);
      musicState.arpTimer = setInterval(() => {
        if (muted) return;
        scheduleArpNote(getCtx(), theme);
      }, intervalMs);
    } catch (e) { /* ignore audio errors */ }
  },

  stop() {
    if (musicState.arpTimer) { clearInterval(musicState.arpTimer); musicState.arpTimer = null; }
    try {
      if (musicState.droneOsc) { musicState.droneOsc.stop(); musicState.droneOsc = null; }
      if (musicState.droneGain) { musicState.droneGain.disconnect(); musicState.droneGain = null; }
      for (const p of musicState.padOscs) { p.osc.stop(); p.gain.disconnect(); }
      musicState.padOscs = [];
      if (musicState.masterGain) { musicState.masterGain.disconnect(); musicState.masterGain = null; }
    } catch (e) { /* ignore */ }
    musicState.playing = false;
  },

  changeTheme(themeId) {
    if (muted || !musicState.playing) return;
    try {
      const c = getCtx();
      const theme = THEMES[themeId] || THEMES.forest;
      musicState.currentThemeId = themeId;
      if (musicState.droneOsc) { musicState.droneOsc.stop(); musicState.droneOsc = null; }
      if (musicState.droneGain) { musicState.droneGain.disconnect(); musicState.droneGain = null; }
      for (const p of musicState.padOscs) { p.osc.stop(); p.gain.disconnect(); }
      musicState.padOscs = [];
      if (musicState.arpTimer) { clearInterval(musicState.arpTimer); musicState.arpTimer = null; }
      const d = startDrone(c, theme);
      musicState.droneOsc = d.osc;
      musicState.droneGain = d.gain;
      musicState.padOscs = startPad(c, theme);
      musicState.arpBeat = 0;
      const intervalMs = 60000 / theme.bpm;
      scheduleArpNote(c, theme);
      musicState.arpTimer = setInterval(() => {
        if (muted) return;
        scheduleArpNote(getCtx(), theme);
      }, intervalMs);
    } catch (e) { /* ignore */ }
  },
};
