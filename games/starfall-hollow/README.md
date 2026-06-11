# 🌠 Starfall Hollow

A **story adventure** for explorers aged 11-and-a-bit and up. A star has fallen,
the village **Heartlamp** has gone dark, and you — the keeper's apprentice —
must cross an ever-growing world to bring five star shards home.

> _Lost things should go home._

## The adventure

You explore the Hollow on foot, top-down Zelda-style, talking to everyone,
poking everything, and slowly unlocking the map region by region:

| Region | What waits there |
|---|---|
| 🏘️ **Willowdale Village** | Home base — the dark Heartlamp, Marlo's shop, Tilda's bakery, four gated roads out |
| ⚙️ **The Old Mill** | A four-lever logic puzzle locked in the Miller's Rhyme |
| 🌲 **Whispering Woods** | Berry bushes, a toll-collecting fox, and the Owl Sage's three riddles |
| 🏖️ **Glimmer Cove** | A crab merchant who sells rumours, and a pitch-dark tide cave with a **musical memory puzzle** (lantern required) |
| 🏔️ **Frostpeak** | A mitten-less yeti and an **ice-sliding puzzle** where you can't stop halfway (warm cloak required) |
| 🌠 **Starfall Crater** | Four rune pillars to wake in the right order — and the fallen star itself |

### Act II — Above the Clouds

Relighting the Heartlamp isn't the end. Lumen reveals he was *shaken loose* —
something is unpicking the **Night Loom** that holds the dark sky together.
A star bridge opens in the crater and carries you to a second world:

| Region | What waits there |
|---|---|
| ☁️ **Skyharbor** | A village above the weather — Nimbus's Cloud Goods, a balloon captain's post round, and a star kid missing three glowbugs |
| 🌬️ **Gale Gardens** | Wind-gust lanes that shove you about, a knot-gate only a Wind Bell can comb open, and a **weathervane riddle** |
| 💎 **Mirror Vale** | Selene's observatory and the Prism Chamber — a **rotatable-mirror moonbeam puzzle** (Moon Lens required) |
| 🌙 **Moon Temple** | A guardian who demands three numbers, the pitch-dark **Shadowdeep maze** that remembers them, and Umbra — the shadow who started it all |

Act II has its own items (Skyboots, Moon Lens, Wind Bell, Comet Kite), its own
collectibles (10 moonstones), three more Sir Plod encounters, four new music
themes, a new push-wind movement mechanic, and a second, true ending at the
Night Loom — roughly doubling the length of the story.

### Systems

- **Story chapters** — five main quests gate the world open one region at a
  time; finishing the story takes a good while, and the journal always shows
  the next goal.
- **Side quests** — Pip's runaway kite, Tilda's berry order, Yura's lost
  mitten, and Sir Plod, a knighted snail questing across all five regions at
  snail pace.
- **Coins & shops** — chests, hidden sparkles and quest rewards fund a real
  economy: lantern and cloak (progression items), honeycake (fox bribe),
  explorer's map, pearl charm that *hums near hidden treasure*, and a purely
  cosmetic stardust trail.
- **Choices & dialogue** — branching conversations with typewriter text,
  riddles with retries, and an ending conversation that asks *why* you did
  any of it.
- **Replay value** — 13 hidden sparkles, optional quests, post-game free roam
  with epilogue dialogue for every character, and a completion record in the
  credits.

## Tech

- **Single-file HTML5 game** — vanilla JS, no engine, no build step, no assets.
- **All graphics drawn in code** on a pixel-scaled canvas: procedural tiles
  with per-cell hash variation, hand-drawn-in-canvas characters (fox, owl,
  crab, yeti, snail knight, living star), animated water, ambient particles
  per region (pollen, fireflies, snow, sea-sparkle, starbits), dynamic
  lantern lighting in caves, and a y-sorted draw list.
- **All music & sound synthesized with the Web Audio API** — each region has
  its own generatively-composed loop (scale + chord progression + seeded
  melody), plus ~25 synthesized sound effects.
- **Saves automatically** to `localStorage` (position, quests, flags, coins,
  items); continue from the title screen.
- Full **touch controls** (d-pad + action button) for phones and tablets,
  keyboard (WASD/arrows + E) on desktop.
- World data is validated by construction: every map, warp, entity position
  and the ice-slide puzzle were machine-checked for reachability/solvability.

## Run it

Open `docs/play/starfall-hollow/index.html` in a browser, or play the deployed
build at `https://sunstar2423.github.io/Wild-Olive-Studios/play/starfall-hollow/`.
