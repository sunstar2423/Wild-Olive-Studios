# 🥁 Groove Grove

A **drum machine & beat-making game** — program drum patterns, layer bass and
keys on top, finger-drum live pads like a real drummer, and graduate from
**Beat School** by mastering the grooves that built modern music.

> _Plant a beat. Grow a groove._

## How it plays

### 🎛 Studio — your beat lab

- **Program beats** on a classic 16-step sequencer with 8 drum voices
  (kick, snare, clap, closed/open hats, tom, percussion, crash). Columns are
  16th-notes; beat numbers mark the pulse.
- **Layer music on top.** Switch to the **Bass** tab (8 notes of A-minor
  pentatonic) and the **Keys** tab (6 diatonic chord stabs) to turn a beat into
  a track. Everything is tuned to one scale, so whatever you write sounds good
  together.
- **Be the drummer.** Eight velocity-lit **live pads** (keyboard `A S D F G H J K`
  or tap on mobile) let you finger-drum over the groove. Arm **● Rec** while
  the sequencer runs and your hits are **quantized straight into the grid** —
  exactly like performance-recording on a hardware drum machine.
- **Build songs.** Four patterns (A–D), copy/clear with undo, chain them into
  a song (up to 32 bars) and play it back in **Song mode** — the grid follows
  the arrangement live.
- **Shape the groove.** Tempo (60–200 BPM), a **swing** control for shuffle
  feel, four synthesized **drum kits** (Studio, 808, Neon, Junkyard), and a
  full **mixer** with per-channel volume plus mute/solo on every row.
- **See your sound.** An audio-reactive waveform visualizer rides on top of
  the studio, and every hit flashes its pad and grid cell in its track colour.

### 🎓 Beat School — learn real grooves

Twelve levels teach the rhythms that power real records, in rising difficulty:

four-on-the-floor → backbeat → the Money Beat → stadium rock → disco →
boom bap → house → dembow (reggaetón) → the 3–2 son clave → half-time trap →
funk syncopation → an Amen-style breakbeat workout.

Each level: **listen** to the target beat, **rebuild it** on the grid, and
**check** your answer. Misses and extras are marked on the grid, a ghost-hint
appears if you're stuck, and a perfect match earns ★★★. Stars unlock the
**Neon** (8★) and **Junkyard** (16★) kits back in the Studio, and each level
unlocks the next.

## Tech

- **Single-file HTML5 game** — vanilla JavaScript, no engine, no build step.
- **Every sound is synthesized live with the Web Audio API** — zero samples.
  Kicks are pitch-swept sines with a click transient, snares blend tone and
  filtered noise, hats are six detuned square waves through a highpass,
  claps are multi-tap noise bursts; the bass is a filter-enveloped mono synth
  with a sub oscillator, keys are detuned chord stabs through a dub delay.
  Drum kits are just parameter sets over the same voices.
- **Sample-accurate sequencing** via the standard look-ahead scheduler pattern
  (timer thread schedules ~120 ms ahead on the audio clock), with swing applied
  to off-steps and a draw-queue keeping the UI in lockstep with the audio.
- Progress, patterns, mixer state, and Beat School stars **auto-save to
  `localStorage`**.

## Run it

Open `docs/play/groove-grove/index.html` in a browser, or play the deployed
build at `https://sunstar2423.github.io/Wild-Olive-Studios/play/groove-grove/`.
