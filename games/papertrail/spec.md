# spec.md — "Paper Trail"

> A 2D bicycle riding game for the web.
> **Studio:** Pater Lantern Studios
> **Working title:** *Paper Trail* (alternates: *Free Wheel*, *Trail Mix*)
> **Spec version:** 1.0

---

## 0. How to use this document

This is the single source of truth for the build. Implement it **in the phase order given in §20** — each phase is independently playable and has explicit acceptance criteria. Do not skip ahead; a working Phase 1 is worth more than a half-finished Phase 4.

When a value is given as a constant (e.g. `BASE_SCROLL_SPEED = 280`), put it in `src/data/constants.js` so it can be tuned without touching logic. All zone/obstacle/NPC content is **data-driven** (§19) — adding a new area should mean adding a config object, not writing new systems.

If anything here is ambiguous, prefer: (a) the simplest implementation that satisfies the acceptance criteria, and (b) readability of the rideable path over visual flourish.

---

## 1. Overview

*Paper Trail* is an arcade bicycle game. You ride a continuous track that scrolls toward you, steering left/right to **stay on the path**, **dodge obstacles**, and **hit ramps for jumps**. The ride flows through distinct areas — forest trails, leafy suburbs, a downtown core, a construction zone, and a park — each alive with people, animals, and traffic that give a sense of place and community.

- **Genre:** arcade / endless-style score chaser with a fixed "tour" route.
- **Platform:** web (desktop + mobile browser). No install, no build step required.
- **Perspective:** top-down ¾ view, landscape, world scrolls downward (bike rides "up" the screen).
- **Inspiration:** the feel of classic street-riding arcade games (the old *Paperboy* paper-route nostalgia) — reinterpreted as a cross-country trail ride. A nod to that lineage lives in the optional flyer-delivery mechanic (§12).
- **Session length:** 2–5 minutes per run. Pick-up-and-play; readable in three seconds.

---

## 2. Design pillars

1. **Readable danger.** The player should always understand at a glance what is path, what is hazard, and what is harmless scenery. Threat is communicated by a consistent visual language, not memorisation.
2. **Flow, not punishment.** Speed feels good. Crashes cost something but never feel cheap — generation is always *fair* (§7.3).
3. **A world that's lived-in.** Every zone has ambient life. The player is riding *through someone's neighbourhood*, not an empty track.
4. **Easy to learn, expressive to master.** Steer-and-dodge is instant. Ramps, hops, tricks, and near-miss combos give skilled players a deeper scoring game.

---

## 3. Tech stack & constraints

- **Language:** vanilla JavaScript (ES modules). **No frameworks, no bundler, no npm dependencies.** This keeps it offline-friendly and trivially runnable.
- **Rendering:** HTML5 Canvas 2D (`<canvas>`). No WebGL.
- **Audio:** Web Audio API or `<audio>` elements for SFX (§16). Music is a stretch goal.
- **Persistence:** `localStorage` for high score and settings only.
- **Target:** 60 FPS on a mid-range laptop and a modern phone browser. Logic runs on a fixed timestep; rendering interpolates (§6).
- **Browsers:** latest Chrome/Firefox/Safari, desktop and mobile.

### Run instructions (include in README)
ES modules require a server (not `file://`). From the project root:
```
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## 4. Core gameplay loop

1. World scrolls toward the player at the current speed.
2. Player steers left/right within the road, modulates speed, hops small hazards, and rides ramps for big air.
3. Obstacles, collectibles, ramps, and NPCs scroll into view from the top.
4. Player scores from distance, coins, near-misses, tricks, and (optionally) deliveries.
5. Hitting a solid/un-cleared obstacle or leaving the road into a wall = **crash** → lose a life.
6. Out of lives → **Game Over** → show score + best → restart.
7. The route transitions through each zone in sequence (§11). In **Tour mode** it ends with a finish line; in **Endless mode** it loops with rising difficulty.

---

## 5. Camera, world & coordinate system

- **Logical resolution:** `LOGICAL_WIDTH = 1280`, `LOGICAL_HEIGHT = 720` (16:9). Render to this internal size, then scale-to-fit the window with letterboxing; maintain aspect ratio.
- **Axes:** `x` = horizontal (0 = left edge). `y` = screen vertical (0 = top). The world conceptually moves in `-y` past a camera-locked player; implement as: entities spawn at `y < 0` (above view) and move **downward** (`y += scrollSpeed * dt`); despawn when `y > LOGICAL_HEIGHT + margin`.
- **Road:** a vertical band centred horizontally. `roadWidth` is per-zone (§19), e.g. forest `480`, city `620`. `roadLeft = (1280 - roadWidth)/2`, `roadRight = roadLeft + roadWidth`. Outside the road on each side is a **shoulder** band (`SHOULDER_WIDTH = 70`, penalty zone) and beyond that **scenery/wall** (crash on contact).
- **Player position:** camera-locked vertically at `player.y = 540` (lower third). The player moves only on `x`.
- **Parallax:** roadside scenery (trees, houses, lamp posts) scrolls at the world speed; a far background layer (sky/treeline/skyline) scrolls at `~0.3×` for depth.

---

## 6. Game loop & timing

- Use `requestAnimationFrame`. Accumulate elapsed time and step **physics at a fixed `dt = 1/60 s`**; carry leftover time to the next frame. Cap accumulated time to avoid spiral-of-death (max ~5 steps/frame).
- Rendering may interpolate between steps but a clean fixed-step render is acceptable for v1.
- All speeds in this spec are **per second** and must be multiplied by `dt`.

```
let acc = 0, last = performance.now();
function frame(now){
  acc += Math.min((now - last)/1000, 0.1); last = now;
  while (acc >= DT){ update(DT); acc -= DT; }
  render();
  requestAnimationFrame(frame);
}
```

---

## 7. Track & procedural generation

### 7.1 Segments
The world advances in **segments** of `SEGMENT_LENGTH = 220` px scrolled. Track total distance scrolled in `world.distance` (px). On crossing each new segment boundary, run the spawner for that segment using the **current zone config**.

### 7.2 What the spawner places per segment (zone-weighted)
- With probability `zone.obstacleDensity`, spawn an **obstacle row** (1–3 obstacles across the road) drawn from `zone.obstacleTable` by weight.
- With probability `zone.rampChance`, place a **ramp** in a clear lane.
- With probability `zone.coinChance`, place a **coin pickup** or a short coin trail (3–5 coins), biased toward risky lines next to obstacles to reward tight play.
- With low probability, place a **boost** pickup (§9).
- Independently, spawn **ambient NPCs** (§10) from `zone.ambientTable` — these mostly live on the shoulders/scenery; a few cross the road as moving hazards.

### 7.3 Fairness rules (non-negotiable)
- Every obstacle row must leave at least one continuous lateral gap `≥ GAP_MIN = BIKE_WIDTH * 2.6` somewhere across the road.
- Consecutive rows must be spaced so the player has `≥ MIN_REACTION = 0.7 s` of travel between them at current speed (`spacing ≥ scrollSpeed * 0.7`). Increase spacing as speed rises.
- Never place a **solid** obstacle in the landing zone the spawner just promised behind a ramp.
- Coin trails must be reachable without requiring contact with a solid obstacle.

---

## 8. Player / Bike

### 8.1 Movement
- Steer: `player.x += dir * PLAYER_LATERAL_SPEED * dt`, `PLAYER_LATERAL_SPEED = 420`. Add light easing (accelerate toward target lateral velocity) so steering feels weighty, not robotic.
- Clamp `player.x` so the bike stays within `[roadLeft - SHOULDER_WIDTH, roadRight + SHOULDER_WIDTH - BIKE_WIDTH]`. Beyond the shoulder = wall = crash.
- Speed control: Up/Down scales the scroll multiplier between `SPEED_MIN_MULT = 0.6` and `SPEED_MAX_MULT = 1.6`. Effective scroll = `BASE_SCROLL_SPEED * difficultyMult * playerSpeedMult`.
- Visuals: gentle lean when steering, spinning wheels, a subtle bob; small dust particles at the rear wheel.

### 8.2 Bike dimensions / lives
- `BIKE_WIDTH = 44`, `BIKE_HEIGHT = 72` (collision box slightly smaller than art for generosity).
- `LIVES = 3`. After a crash: respawn centred on road, `INVULN_TIME = 1.5 s` of blinking invulnerability; scroll briefly eases back up from `0.5×`.

### 8.3 Jump (ramps)
- Riding over a ramp enters **AIR** state for `AIR_DURATION = 0.85 s`.
- Track an `airHeight` value following a parabola peaking at `AIR_MAX_HEIGHT = 60`. Render by drawing the bike with a slight upward `y` offset + scale-up (`1 + airHeight/600`) and a **separate ground shadow** that shrinks with height — this sells the jump in top-down.
- While airborne: immune to **all ground obstacles**. The **landing footprint** must be clear of `solid` obstacles, or the player crashes on landing.
- **Tricks:** tapping ←/→ while airborne triggers a spin (rotate the sprite). Each spin = `+TRICK_POINTS = 50`. Returning to neutral lean just before landing = **clean landing** `+CLEAN_LANDING = 100`. Tricks are pure upside — no fail state, to keep it approachable.

### 8.4 Bunny hop
- Space = a small hop: `HOP_DURATION = 0.45 s`, `HOP_HEIGHT = 22`, clears **low** obstacles only (§9). `HOP_COOLDOWN = 0.6 s`. Show the same shadow-shrink treatment, scaled down.

### 8.5 Off-road penalty
- On a **shoulder**: scroll drops to `OFFROAD_SPEED_MULT = 0.5×`, a slow point drain applies, light screen shake, and dust/gravel particles. This is a soft warning, not a crash.
- Past the shoulder into scenery/wall: **crash**.

---

## 9. Obstacles

Each obstacle has a **clearance class** that defines how it can be beaten:

| Class | Meaning | Cleared by | Examples |
|---|---|---|---|
| `low` | flat/ground hazard | bunny hop **or** ramp jump | pothole, puddle, debris, cone, gravel patch |
| `mid` | waist-height | ramp jump only | log, trash bin, bench, planter, pipe |
| `solid` | tall/immovable | **dodge only** | parked car, cement mixer, fountain, scaffold |
| `moving` | crosses the road on a path | dodge / time it | dog, taxi, pedestrian, deer, duck |

Rules:
- Visual language must encode class (e.g. low = flat with a hop-arrow hint on first encounter; solid = obvious bulk with a grounded shadow). Keep it consistent across zones.
- `moving` obstacles follow a simple path (cross left→right or right→left at a set speed, optionally pausing). They are telegraphed: spawn partly visible on a shoulder before entering the road.
- Collision = crash unless the obstacle's class was legitimately cleared by the player's current air/hop state.

---

## 10. NPCs & ambiance ("sense of place")

Ambient life is what makes each area feel like a community. Two roles:

- **Decorative** (vast majority): live on shoulders/scenery, never collide. Kids playing in a yard, a dog walker on the path, a busker, pigeons, a cat on a fence, picnickers, a flagger waving. Lightly animated (idle bob, occasional wave/bark/flap). These exist purely for atmosphere and react in tiny ways as you pass (a head turn, a wave).
- **Reactive hazards** (a few): `moving` obstacles per §9 — a dog darting across, a reversing car, a jogger, ducks crossing. These are gameplay; decorative NPCs are flavour. Keep the ratio heavily toward decorative so the world feels populated, not lethal.

Each zone's `ambientTable` (§19) defines which NPC kinds appear and their weights.

---

## 11. Zones / areas

The route runs through these in order. Each is data-driven (§19): palette, road width, obstacle/ambient tables, scenery set, music mood. Between zones, scroll a **transition gateway** (a sign / bridge / tunnel / park gate) and show a banner: *"Now entering: Maple Street."* Difficulty nudges up at each transition.

1. **Whispering Pines — Forest Trail.** Narrow dirt track, dappled light. Obstacles: fallen logs (`mid`), rocks (`solid`), roots & puddles (`low`), darting deer/rabbits (`moving`). Ambient: birds, a hiker, a park ranger. Ramps: dirt mounds. Palette: deep greens, earthy browns.
2. **Maple Street — Suburbs.** Wider paved road, driveways and lawns. Obstacles: parked cars (`solid`), trash bins (`mid`), sprinklers & skateboards (`low`), a dog / reversing car (`moving`). Ambient: kids playing, a mail carrier, a lawn mower, a cat on a fence. **Delivery mechanic active (§12).** Palette: warm pastels, green lawns.
3. **Downtown — City Core.** Widest road, lane markings. Obstacles: taxis & buses pulling out (`solid`/`moving`), traffic cones & potholes & open manhole (`low`), a hot-dog cart (`mid`), pedestrians at crossings (`moving`). Ambient: sidewalk crowds, a street musician, pigeons. Palette: greys with neon-sign accents.
4. **The Build — Construction Zone.** Plated/gravel surface, hazard stripes. Obstacles: barriers & planks (`mid`), cement mixer & scaffolding (`solid`), gravel patches (`low`, slows you), a swinging crane load (`moving`). Ambient: workers, a flagger waving you through, sparks. Palette: hazard orange/yellow, concrete grey.
5. **Greenfield Park — Park.** Winding path, open green. Obstacles: benches & picnic spreads (`mid`), fountains (`solid`), frisbees & loose balls (`low`), joggers / ducks / a loose dog (`moving`). Ambient: families, kite flyers, a busker, ducks on a pond. Ramps: little hills. Palette: bright greens, blue water.

> Modes: **Tour** runs the five zones once and ends at a finish line with a final score tally. **Endless** loops the sequence indefinitely, ramping difficulty. MVP ships the continuous sequence; modes are a small selector in Phase 4.

---

## 12. Optional: delivery mechanic (the *Paperboy* nod)

Active in suburb zones only; clearly secondary to the core ride. Mailboxes (`mailbox` entities) sit at the road edge by driveways. The player can **toss a flyer** (a second action button / swipe) toward the nearest mailbox.

- Flyer lands in mailbox = `+DELIVERY = 75`. A perfect toss onto the porch = `+150`.
- Missing is harmless (no penalty) — pure bonus, keeps the title meaningful without complicating the core loop.
- Implement only after Phases 1–3 are solid. If scope is tight, this is the first thing to cut.

---

## 13. Controls

**Desktop (keyboard):**

| Input | Action |
|---|---|
| ← / → or A / D | Steer left / right |
| ↑ / ↓ or W / S | Speed up / slow down |
| Space | Bunny hop |
| ← / → while airborne | Trick spin |
| F | Toss flyer (suburb only, if delivery enabled) |
| P | Pause |
| M | Mute |
| Enter | Start / Restart |

**Mobile (touch):** auto-forward. Tap/hold left or right screen half to steer. Swipe up to hop. On-screen buttons for pause, mute, and (in suburbs) toss. Keep the play field unobstructed.

Support both simultaneously; detect touch vs pointer at runtime.

---

## 14. HUD / UI

Minimal, top-aligned, never covering the path:
- **Score** (top-left), animated count-up.
- **Lives** as small bike icons (top-right).
- **Distance / zone name** (top-centre): current zone label + metres ridden (`metres = floor(distance / 10)`).
- **Combo meter** appears only while a near-miss combo is live, showing the multiplier and a draining timer bar.
- **Best score** shown on title and game-over screens.

---

## 15. Game states / screens

State machine: `TITLE → PLAYING ⇄ PAUSED → GAME_OVER → (restart) TITLE/PLAYING`, plus a non-blocking `ZONE_TRANSITION` overlay during play.

- **Title:** game logo (*Paper Trail* / Pater Lantern Studios), Start, mode selector (Tour/Endless), best score, brief controls hint.
- **Playing:** the loop.
- **Paused:** dim overlay, Resume / Restart / Mute.
- **Game Over:** final score, best (with "New Best!" flash if beaten), Restart, Title.

---

## 16. Audio

SFX (short, punchy): bike bell (start), coin pickup, ramp whoosh, mid-air trick whir, landing thud, crash, off-road gravel rumble, delivery thunk, zone-transition chime. Provide a **mute toggle** persisted to `localStorage`. Generate simple tones via Web Audio if no asset files are supplied.

**Stretch:** one looping music bed per zone matching its mood, cross-fading on transition.

---

## 17. Art direction

- **Style:** flat 2D, drawn programmatically with canvas paths for v1 — a cohesive low-detail look with a distinct palette per zone. Optional later: swap in sprite sheets via a single render abstraction (don't hard-code drawing calls all over the place).
- **Depth:** every entity gets a soft elliptical ground shadow; shadows are the main depth cue in top-down and double as the jump/hop feedback (§8.3).
- **Readability first:** silhouette-readable shapes; the rideable path always visually distinct from hazards; threat colour-coded by clearance class. Decorative NPCs are visibly *softer* / lower-contrast than hazards so players never confuse flavour with danger.
- **Juice:** dust at the wheels, gravel on off-road, sparks in construction, a small speed-line vignette at high speed, screen shake on crash (short, low amplitude). Tasteful, not seizure-inducing.

---

## 18. Difficulty curve

- `difficultyMult` starts at `1.0` and rises slowly with distance: `difficultyMult = 1 + min(distance / 60000, 1.2)` (caps the auto-ramp; capping prevents runaway speed).
- Each zone transition adds a small step-up to `obstacleDensity` and `moving`-obstacle frequency.
- In Endless mode, each completed loop applies an additional multiplier to density and base speed.
- Always preserve the §7.3 fairness rules regardless of difficulty.

---

## 19. Data structures / schemas

Put these in `src/data/`. Everything content-related is config, not code.

**Entity (runtime):**
```js
{
  id, type,          // 'obstacle' | 'collectible' | 'ramp' | 'npc' | 'mailbox'
  kind,              // 'log' | 'car' | 'coin' | 'deer' | ...
  x, y, w, h,
  clearance,         // for obstacles: 'low' | 'mid' | 'solid' | 'moving'
  collidable,        // bool
  velX, velY,        // world-relative; moving entities add to scroll
  path,              // optional fn(entity, dt) for crossing NPCs/animals
  value,             // points for collectibles
  decorative,        // bool: ambiance only, never collides
  state              // misc per-kind state (anim phase, spin, etc.)
}
```

**Zone config:**
```js
{
  id: 'forest',
  name: 'Whispering Pines',
  lengthMeters: 600,        // Tour-mode length before transition
  roadWidth: 480,
  palette: { road, edge, shoulder, bg, accent },
  scrollMult: 1.0,
  obstacleDensity: 0.45,    // prob of an obstacle row per segment
  rampChance: 0.10,
  coinChance: 0.5,
  boostChance: 0.04,
  obstacleTable: [          // weighted draw
    { kind:'log',   clearance:'mid',    weight:3, w:120, h:34 },
    { kind:'rock',  clearance:'solid',  weight:2, w:56,  h:56 },
    { kind:'puddle',clearance:'low',    weight:3, w:90,  h:40 },
    { kind:'deer',  clearance:'moving', weight:1, w:60,  h:70, speed:160 }
  ],
  ambientTable: [
    { kind:'bird', weight:3 }, { kind:'hiker', weight:2 }, { kind:'ranger', weight:1 }
  ],
  scenery: ['pine','rock','bush'],
  music: 'forest_calm',
  delivery: false
}
```

**Save data (`localStorage`):** `{ bestScore, muted, lastMode }`.

---

## 20. Build phases & acceptance criteria

**Phase 0 — Scaffold.**
Canvas + scale-to-fit + letterbox; fixed-timestep loop; input layer (keyboard + touch); state machine (TITLE/PLAYING/PAUSED/GAME_OVER); empty HUD.
*Done when:* a blank scrolling road renders at a steady 60 FPS; the bike moves left/right within road bounds; TITLE → PLAYING → GAME_OVER → restart all work.

**Phase 1 — Core ride (MVP).**
One zone (forest) from config; world scroll; player movement + road bounds + off-road penalty; segment spawner with fairness (§7.3); obstacles with collision → crash → lose life → respawn → game over; coins + distance scoring; HUD shows score / lives / distance.
*Done when:* a full single-zone run is playable end-to-end — ride, dodge, collect, crash out of all lives, see Game Over, restart.

**Phase 2 — Jumps, hops, combos.**
Ramps + AIR state with shadow/arc; bunny hop; clearance-class logic; tricks + clean-landing scoring; near-miss combo system with multiplier + timer.
*Done when:* ramps launch the bike and clear obstacles; hops clear `low` obstacles; tricks and clean landings score; near-misses build and reset a combo correctly.

**Phase 3 — Zones & ambiance.**
All five zones via config; transition gateways + banners; roadside scenery with parallax; ambient decorative NPCs and `moving` hazards per zone; per-zone palettes.
*Done when:* a run transitions through all zones, each visibly distinct, each populated with appropriate hazards and ambient life.

**Phase 4 — Modes, polish, audio, mobile, delivery.**
Tour vs Endless selector; difficulty ramp (§18); SFX + mute; particles + screen shake; high-score persistence; pause screen; touch controls verified on a phone; optional flyer-delivery in suburbs (§12).
*Done when:* the game feels polished, runs well on desktop and mobile, persists a best score, and is fun for 3+ minutes.

---

## 21. Out of scope (v1)

No online leaderboards or accounts; no multiplayer; no 3D/WebGL; no level editor; no narrative/cutscenes; no asset pipeline beyond optional drop-in sprites/SFX.

---

## 22. Stretch goals (post-v1)

Day/night & weather per run; unlockable bikes/riders; a "rush hour" boss segment; daily seeded challenge; gamepad support; photo mode; an online leaderboard.

---

## 23. Suggested file structure

```
paper-trail/
  index.html            # canvas + module entry, minimal CSS
  src/
    main.js             # bootstrap, state machine, screens
    engine/
      loop.js           # fixed-timestep loop
      input.js          # keyboard + touch
      render.js         # canvas helpers, scaling, shadows, particles
      audio.js          # SFX, mute
      storage.js        # localStorage save/load
    game/
      player.js         # movement, air, hop, crash
      world.js          # scroll, road, zones, transitions
      spawner.js        # segment generation + fairness
      entities.js       # obstacle/collectible/npc update + draw
      scoring.js        # score, combo, tricks, delivery
    data/
      constants.js      # all tunables (see below)
      zones.js          # zone configs (§19)
  assets/               # optional sprites / sfx
  README.md
```

---

## 24. Consolidated tunable constants (starting values)

```js
// display
LOGICAL_WIDTH = 1280; LOGICAL_HEIGHT = 720; DT = 1/60;
// road
SHOULDER_WIDTH = 70;
// player
BIKE_WIDTH = 44; BIKE_HEIGHT = 72;
PLAYER_LATERAL_SPEED = 420;
LIVES = 3; INVULN_TIME = 1.5;
// speed / scroll
BASE_SCROLL_SPEED = 280; SPEED_MIN_MULT = 0.6; SPEED_MAX_MULT = 1.6;
OFFROAD_SPEED_MULT = 0.5;
// jump / hop
AIR_DURATION = 0.85; AIR_MAX_HEIGHT = 60;
HOP_DURATION = 0.45; HOP_HEIGHT = 22; HOP_COOLDOWN = 0.6;
// generation
SEGMENT_LENGTH = 220; GAP_MIN = BIKE_WIDTH * 2.6; MIN_REACTION = 0.7;
// scoring
COIN_POINTS = 10; TRICK_POINTS = 50; CLEAN_LANDING = 100;
NEAR_MISS_RADIUS = 30; NEAR_MISS_BASE = 5; COMBO_WINDOW = 2.0;
DELIVERY = 75; PERFECT_DELIVERY = 150;
DISTANCE_PER_POINT = 10; // 1 point per 10px scrolled (= per metre)
```

---

*End of spec. Build in phase order. When in doubt: keep the path readable and the ride fair.*
