# 🚊 Tidewater Lines

A cozy **transit-network tycoon** set in the coastal city of *Olivehaven*. Stitch
the city together with **electric buses**, **light rail** and **ferries**, carry
real passengers from stop to stop, collect fares, and grow a beautiful, profitable
network — while keeping riders happy and your fleet maintained.

## How it plays

- **Trace routes.** Pick a mode (Bus 🚌 / Rail 🚊 / Ferry ⛴️) and click stops in
  order to lay a line. Ferries only connect waterside stops; light rail lays track
  (so it costs more up front but moves lots of people fast).
- **Carry passengers.** People appear at stops wanting to reach somewhere else,
  chosen by a gravity model (closer + more attractive places pull more trips).
  They route across your network, **transfer at interchange hubs** where two or
  more lines meet, and **pay a fare on arrival** — longer trips and ferries pay a
  premium.
- **Run the business.** Fares are income; vehicles cost money to buy and have a
  **daily operating cost**. Vehicles **wear out** and will **break down** if you
  don't **service** them. Watch out for over-provisioning — adding vehicles past
  the demand sweet spot costs more to run than it earns.
- **Keep the city happy.** Long waits, overcrowding and breakdowns lower the city's
  happiness; reliable, well-covered service raises it — and a happier city rides
  more.
- **Ride the rhythm of the city.** Each morning rolls a **weather** type and
  sometimes a **special event**. Event days — Match Day (Stadium), Opera Night,
  the Arts Festival, Market Day, Graduation, Travel Rush, and sunny Beach Days —
  surge demand at specific venues, rewarding players who pre-position vehicles.
  **Weather** sways outdoor/leisure demand and, for **ferries**, scales speed and
  wear: storms and blustery days leave ferries slower and wearing out faster.
- **Explore the map & stations.** Scroll / pinch to **zoom**, drag to **pan**, and
  **tap any station to look inside** — a side-on scene of the place with themed
  buildings and scenery, animated people queueing on the platform, and your
  vehicles arriving to board them (with live weather and the real waiting count).
- **Use the bank.** Short on cash to expand? Take a **loan** (up to a credit limit)
  to build a new line or fleet now, then **repay** as fares roll in. Interest
  accrues daily on the outstanding balance, and debt counts against your net worth —
  so borrow to grow, but clear it when you can.
- **Read the daily report.** Each night you get fares, running costs (including loan
  interest), net profit, riders carried and the busiest journeys. A **🔥 Demand**
  overlay shows trips people want to make but can't yet — your cue to expand.
- **Hit the goals.** Connect the city, run all three modes, build an interchange,
  reach 90% happiness, and grow your net worth to become the official Transit
  Authority.

## Tech

- **Single-file HTML5 game** — vanilla JavaScript + Canvas 2D, no engine, no build
  step, no dependencies.
- A tick-based simulation with live moving vehicles and individual passenger agents,
  Dijkstra route-planning with transfer penalties, a gravity demand model, a daily
  weather/event system, and a wear/maintenance economy.
- **Procedural ambient sound** via the Web Audio API — a brown-noise harbour "wave
  wash" with a slow swell, occasional gulls and a buoy bell, plus weather-reactive
  wind and a goal chime. No audio files; mutable and gated behind a user gesture.
- **Save/restore** in `localStorage`: auto-saves each night, manual save, and a
  Continue option on the title screen.
- **Zoomable / pannable** network map (wheel, pinch, drag) and a separate
  **station "look inside" scene** rendered on its own canvas with animated people
  and arriving vehicles.
- Mouse and touch controls; keyboard shortcuts (`1`/`2`/`3` modes, `H` demand,
  `S` save, `M` sound, `+`/`-` zoom, `Space` pause, `Esc` back).

## Where the playable build lives

Because this is a single self-contained file, the **source and the build are the
same file**, and it lives in the published site folder so it's playable online:

```
docs/play/tidewater-lines/index.html
```

- **Play locally:** open that file in a browser, or run
  `python3 -m http.server 8000 --directory docs` and visit
  `http://localhost:8000/play/tidewater-lines/`.
- **Play live:** `https://sunstar2423.github.io/Wild-Olive-Studios/play/tidewater-lines/`
- **Linked from:** the *Tidewater Lines* card on the home page (`docs/index.html`).

## Balance notes (for future tuning)

All the knobs live in the `CFG`, `MODES` and the service/repair constants near the
top of the `<script>`. The current numbers were tuned with a headless simulation so
that:

- A modest starter network (a couple of bus lines from the £30k starting fund) is
  gently profitable and teaches the loop.
- A well-run, **right-sized** network is clearly profitable, but **over-provisioning
  vehicles shows diminishing returns** — the core optimisation decision.
- **Maintenance is a real, manageable cost**; neglected fleets break down and cost
  more.

## Ideas to grow it

- [x] Save/restore via `localStorage`
- [x] Event days (festivals, match days) that spike demand at the Stadium / Opera
- [x] Weather affecting ferries and demand
- [x] Procedural ambient harbour soundscape
- [ ] Express vs. stopping services on a line
- [ ] Arrival chimes / fare jingles tied to vehicle events
- [ ] Timetable / frequency controls per line
- [ ] Season-long campaign with budget targets
