# 🫒 Grove & Press

An olive-oil tycoon. Run a small farm through the turning seasons: **plant →
grow → harvest → press → bottle → rail to the city → sell → reinvest.**

## The loop

1. **🌿 The Grove** — Plant olive trees ($ each). Press *Grow the season* to age
   your trees and ripen a crop on the mature ones (the yield varies per tree and
   per year — some years are bumper, some are lean). Harvest the ripe trees, then
   rail your olives to the press (costs freight). You start with two mature trees
   and $200 — enough to reach your first market.
2. **🏭 The Press & Bottling House** — Turn olives into bottled oil across three
   grades: **Extra-Virgin** (premium, more olives/bottle), **Virgin**, and
   **Pomace** (cheap, fast-moving). Each bottle has a press fee. A sensible split
   is auto-suggested; tune it with +/−, then rail the bottles to the city.
3. **🏙️ City Farmers Market** — A live, animated market. **NPC customers wander
   in and move around**, stop by your stall, and buy oil while stock lasts —
   foodies favour Extra-Virgin, bargain-hunters grab Pomace. Neighbouring farms
   (honey, cheese, bread, wine) trade alongside you. Earn money before the timer
   runs out, then return to the grove for the next year. Leftover bottles carry
   over.

Run out of money, trees, *and* stock and it's game over — but every grove has
lean years, so just replant and try again.

## Tech

- **Single-file HTML5 game** — vanilla JS, DOM UI for the farm/press panels and
  a **Canvas 2D** scene for the animated market crowd. No engine, no build step.
- Touch- and mouse-friendly.
- **Save & continue** via `localStorage` — pick up where you left off (with a
  Continue button on the title screen).
- **Procedural audio** via the Web Audio API (no sound files): an upbeat loop
  that plays only in the market, a coin chime when a customer buys from your
  stall, and small SFX for planting, harvesting, shipping, pressing, etc.
  Mute toggle in the HUD (🔊).
- At the market you can **see neighbouring stalls making sales too** — floating
  "+$" pops over the honey/cheese/bread/wine stalls as NPCs spend there.
- **Co-op loans:** if you can't cover a rail fare, the shortfall becomes a loan
  shown in the HUD. Interest accrues each grow season and the loan auto-repays
  from spare cash; let it balloon past the limit and the co-op forecloses.

## Where it lives

- **Playable build / source:** `docs/play/grove-and-press/index.html`
- **Play locally:** `python3 -m http.server 8000 --directory docs` →
  `http://localhost:8000/play/grove-and-press/`
- **Play live:** `https://sunstar2423.github.io/Wild-Olive-Studios/play/grove-and-press/`
- **Linked from:** the *Grove & Press* card on the home page.

## Ideas to grow it

- [ ] Weather/blight events and irrigation upgrades
- [x] Buy a second market stall (more selling points)
- [x] Set your own prices per grade (price elasticity: cheaper sells faster)
- [ ] Reputation that grows your premium customer base over the years
- [x] Sound effects + upbeat market music
- [x] Save/continue across sessions (localStorage)
