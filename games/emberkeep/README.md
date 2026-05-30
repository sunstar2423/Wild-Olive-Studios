# 🔥 Emberkeep

A moody **narrative puzzle** about a lighthouse keeper surviving an endless
winter. The supply boat will never come again — but the light must keep turning,
and a light needs fire. When the driftwood runs out, there is only one thing left
to burn: **what you remember**. Trade memories for fire, and survive the dark.

> _A story you feel as much as solve._

## How it plays

- **Tend the light (the puzzle).** Each night you climb to the lamp and route its
  **beam** to lost ships out on the black water. Tap an empty grid cell to set a
  **mirror**, tap again to flip it `◤ / ◢`, once more to take it back. The beam
  travels in straight lines and bounces off your mirrors; rocks block it; ships
  let it pass through and light up. Thread the light through every ship.
- **Earn driftwood.** Every ship you guide home brings **driftwood** — warmth for
  the hearth, paid for with skill instead of memory. Better solutions mean more
  wood, and more of yourself kept intact.
- **Feed the fire (the choice).** Warmth constantly drains as the **winter deepens**
  night after night. When the cold outpaces the wood, you go to the **hearth** and
  decide: endure as you are, or **burn a memory**. Each memory burns for warmth —
  the deeper, more precious ones burn hottest — but once given to the fire it is
  gone for good, and you feel it go.
- **Survive to the thaw.** Eight nights stand between you and spring. You will
  almost certainly have to give *something* to the dark to make it. **What you
  choose to keep decides who greets the morning** — there are several endings, from
  *The Keeper* (you reach the thaw still knowing your own name and why the light
  matters) to *The Light* (you survive, but almost nothing of you remains) and
  *The Dark* (the fire goes out).
- **Endless Winter.** When the story is done — or straight from the title — step
  into **Endless Winter**: a survival mode of **procedurally-generated** beam
  puzzles where the cold deepens forever. Walk back into it from the thaw carrying
  whatever warmth and memories you kept (so a clean story run buys a longer
  survival), or start a fresh run. Play until the light finally goes out; your
  **longest run is saved** as a best score.

The eight story puzzles are hand-authored and verified solvable within their mirror
budget; the warmth economy was tuned with a headless simulation so that skilful
light-keeping is rewarded with memories kept, weaker play forces harder
sacrifices, and the game is always winnable — even a player who guides no ships
can survive by burning everything (and live with the hollow ending). The Endless
Winter puzzles come from a generator that is guaranteed-solvable **by construction**
and re-verified against the real beam engine before each puzzle is served (3,600
generated levels across 30 difficulty tiers were brute-force checked: zero
unsolvable).

## Tech

- **Single-file HTML5 game** — vanilla JavaScript + Canvas 2D, no engine, no build
  step, no dependencies.
- A persistent, animated **atmospheric backdrop** (night sky, sea, drifting snow
  that thickens as winter deepens, a silhouetted lighthouse with a sweeping beam,
  and a hearth glow whose strength follows your warmth), with an overlaid
  interactive **beam-reflection puzzle** and narrative "sheet" screens.
- A small deterministic **beam simulator** (grid ray-march with mirror reflection,
  transparent ship collectors, and a visited-state guard against mirror loops),
  driven live so the glowing beam and lit ships update on every tap.
- A **procedural puzzle generator** for Endless Winter: it traces a random
  right-angle beam path, drops ships on the straight runs, records the bend mirrors
  as the intended solution, scatters decoy rocks off the path, and re-simulates to
  guarantee every puzzle is solvable within its mirror budget before serving it.
- **Procedural ambient sound** via the Web Audio API — filtered-noise winter wind
  with a slow breathing filter, fire crackle that follows your warmth, and soft
  tones for placing mirrors, guiding ships and burning memories. No audio files;
  mutable and gated behind a user gesture.
- **Save/restore** in `localStorage` (auto-saves each dawn, with a *Return to the
  keep* option on the title screen) and a persisted Endless Winter **best run**.
- Mouse and touch controls; full `prefers-reduced-motion` support (snow and the
  sweeping beam still, transitions disabled).

## Where the playable build lives

Because this is a single self-contained file, the **source and the build are the
same file**, and it lives in the published site folder so it's playable online:

```
docs/play/emberkeep/index.html
```

- **Play locally:** open that file in a browser, or run
  `python3 -m http.server 8000 --directory docs` and visit
  `http://localhost:8000/play/emberkeep/`.
- **Play live:** `https://sunstar2423.github.io/Wild-Olive-Studios/play/emberkeep/`
- **Linked from:** the *Emberkeep* card on the home page (`docs/index.html`).

## Balance notes (for future tuning)

All the knobs live near the top of the `<script>`:

- `WARM_START`, `WARM_MAX`, `DRIFT_PER_SHIP`, and the `DRAIN` curve (per-night cold)
  control the warmth economy.
- `LEVELS` holds the eight hand-authored puzzles (lamp position + direction, ships,
  rocks, and the mirror budget). Each is solvable by construction; a brute-force
  check confirms a solution exists within budget.
- `genLevel()` / `diffFor()` drive the Endless Winter generator and its difficulty
  ramp (turns, ship count, rocks, spare mirrors). `drainFor()` is the cold curve:
  the tuned `DRAIN` array for the story, a forever-deepening formula for endless.
- `MEMORIES` holds the nine memories, ordered tender → core, each with the warmth it
  yields when burned and the line you feel as it goes.

## Ideas to grow it

- [x] Eight hand-authored, verified-solvable beam puzzles
- [x] Memory-burning economy with multiple endings
- [x] Procedural winter soundscape + warmth-reactive backdrop
- [x] Save/restore via `localStorage`
- [x] Procedurally generated nightly puzzles for an endless mode past the thaw
- [ ] More mirror types (beam splitters, prisms, coloured lenses)
- [ ] Online/shareable seeds for the daily Endless puzzle
- [ ] Voiced or typewriter-paced narrative beats
- [ ] A second winter — New Game+ where the cold starts where it left off
