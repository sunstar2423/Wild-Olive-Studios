# SPEC.md — "GreenAcres" — A Sustainable Farming Simulator

## 0. Purpose of this document

This is a build specification for a browser-based farming simulator game. You are the implementing developer. Build the game **exactly** as described, **phase by phase** (see Section 10). After each phase, ensure the game runs by opening `index.html` in a browser with no errors before moving on.

Treat this document as the source of truth. Do not simplify it into a toy or a mockup. Where a number is given, use it (you may tune for balance later). Where something is unspecified, choose the simplest robust option and note it in code comments.

---

## 1. Concept

A turn-based farming management game, inspired by SimFarm, but built around **environmental sustainability** as a core mechanic rather than flavour. The player grows a diverse range of crops (grains, vegetables, fruits, legumes), manages soil health and water, responds to weather events, sells into a fluctuating market, and invests in green technology to farm profitably **without degrading the environment**.

The central tension: chemical-heavy, water-heavy, monoculture farming is profitable short-term but degrades soil, raises emissions, and (thematically) worsens the weather — while sustainable practices cost more up front but keep the land productive and unlock premium "eco-certified" prices.

---

## 2. Technology constraints (important)

- **Vanilla HTML, CSS, and JavaScript only.** No frameworks (no React/Vue), no build step, no bundler.
- **No external libraries or CDNs.** Everything runs offline by opening the file.
- The game must run by **opening `index.html` directly in a browser** (file:// protocol). Nothing may require a server.
- Use **`localStorage`** for save/load (this is fine here — the game runs in the user's own browser).
- Use **CSS Grid** for the farm tile layout, and **emoji** for crop/visual representation (no image assets needed).
- Write clean, commented, modular code. Split logic across files (see Section 9).
- Target modern desktop browsers (Firefox/Chrome). No need to support old browsers.

---

## 3. Core game loop

1. Player views their farm (a grid of tiles), money, current season, weather, and sustainability score.
2. Player takes actions: till soil, plant seeds, irrigate, apply fertiliser/compost, install technology, harvest ready crops, sell harvested produce.
3. Player clicks **"Advance Week"** to progress time.
4. On time advance: crops grow, water and soil update, a weather event resolves, the market shifts, and the sustainability index recalculates.
5. Repeat. The player pursues profit and a high sustainability rating, working toward goals (Section 8).

One **turn = one week**. Four seasons of (say) 12 weeks each = a 48-week year.

---

## 4. The farm grid

- A grid of tiles, default **6 columns × 5 rows = 30 tiles**.
- Each tile has a **state**: `empty` (untilled), `tilled` (ready to plant), `planted` (a crop is growing), `ready` (crop mature, harvestable), or `withered` (crop died — e.g. frost/neglect; must be cleared).
- Each tile tracks **soil health** (0–100, starts at ~70) and **moisture** (0–100).
- Clicking a tile selects it and shows its details in a side panel (state, crop, growth progress, soil health, moisture).
- Visual: render each tile as a coloured cell. Soil health tints the tile background (rich brown/green = healthy, pale/grey = depleted). A growing crop shows its emoji, scaling or changing through growth stages (e.g. 🌱 sprout → small → 🌾/🥕/🍅 mature). Ready crops get a highlight/glow.

---

## 5. Crops

Implement these crops in a data structure (`CROPS` in `data.js`). Columns:

| Crop | Category | Emoji | Seed cost | Growth (weeks) | Water need | Soil drain | Base price | Best season | Notes |
|------|----------|-------|-----------|----------------|------------|------------|------------|-------------|-------|
| Wheat | Grain | 🌾 | 10 | 4 | Low (1) | 2 | 25 | Spring/Summer | Reliable staple |
| Corn | Grain | 🌽 | 15 | 6 | High (3) | 3 | 45 | Summer | Thirsty, high yield |
| Rice | Grain | 🌾 | 20 | 7 | High (3) | 2 | 55 | Summer | Very water-intensive |
| Carrot | Vegetable | 🥕 | 8 | 3 | Med (2) | 1 | 20 | Spring/Autumn | Quick, low impact |
| Potato | Vegetable | 🥔 | 10 | 4 | Med (2) | 2 | 30 | Spring/Autumn | Hardy |
| Tomato | Vegetable | 🍅 | 12 | 5 | Med (2) | 2 | 50 | Summer | Frost-sensitive, high value |
| Lettuce | Vegetable | 🥬 | 6 | 2 | Med (2) | 1 | 18 | Spring/Autumn | Fast, cool-season; heat-sensitive |
| Beans | Legume | 🫘 | 9 | 4 | Low (1) | **-2 (restores)** | 28 | Spring/Summer | **Nitrogen-fixing: restores soil** |
| Soybean | Legume | 🫛 | 11 | 5 | Low (1) | **-2 (restores)** | 35 | Summer | **Restores soil** |
| Strawberry | Fruit | 🍓 | 18 | 6 | Med (2) | 2 | 70 | Spring/Summer | High value, perishable |
| Pumpkin | Fruit | 🎃 | 16 | 7 | Med (2) | 3 | 60 | Autumn | Big autumn earner |
| Sunflower | Other | 🌻 | 7 | 5 | Low (1) | 1 | 30 | Summer | Pollinator-friendly (biodiversity bonus) |

Key mechanics from this table:
- **Legumes (beans, soybean) have negative soil drain** — they *restore* soil health when grown. This is the foundation of the crop-rotation mechanic.
- **Season suitability**: a crop planted out of its best season grows slower (e.g. +50% growth time) or yields less. Winter: nothing grows outdoors unless the player has a Greenhouse (tech).
- **Water need** determines how fast a tile's moisture depletes when that crop is growing.
- **Soil drain** is applied to the tile's soil health on harvest.

---

## 6. Core systems

### 6.1 Soil health (per tile, 0–100)
- Drops by the crop's `soil drain` value each time a crop is **harvested** from that tile.
- **Monoculture penalty**: planting the *same crop* on a tile two+ times in a row applies an extra −5 soil health per repeat. Encourages rotation.
- **Legumes** restore soil (negative drain) — the player rotates legumes in to rebuild depleted tiles.
- Low soil health (<30) reduces yield and growth speed on that tile.
- Restored by: legumes, the **Compost System** tech, or leaving a tile **fallow** (tilled but unplanted) for a few weeks (slow natural recovery, faster with Cover Cropping tech).

### 6.2 Water / moisture (per tile, 0–100)
- Each growing tile loses moisture per week based on the crop's water need and the weather (drought accelerates loss).
- Player **irrigates** a tile (costs water from a farm water reserve, or money if no reserve).
- Crops below a moisture threshold grow slower; at zero for too long, they wither.
- **Rain** weather refills moisture for free. **Rainwater Harvesting** tech banks rainfall into the reserve.

### 6.3 Fertiliser choice (player decision per planting)
Three options when planting/tending:
- **None** — baseline, no cost, no penalty.
- **Chemical fertiliser** — costs money, speeds growth ~30% and boosts yield, BUT reduces soil health faster and **lowers the sustainability index** (pollution/emissions).
- **Organic compost** — costs money (or free with Compost System tech), grows slightly slower, but **improves soil health** and **raises sustainability**.

### 6.4 Sustainability Index (global, 0–100)
A headline score recalculated each turn from:
- Average soil health across tiles (+)
- Water-use efficiency — penalised for over-irrigation, improved by Drip Irrigation (+/−)
- Fertiliser mix — chemical use lowers it, organic raises it (+/−)
- **Biodiversity** — number of *distinct* crop types grown recently; monocultures score low (+)
- Emissions — lowered by Solar/Wind tech (+/−)
- Green tech installed (+)

The sustainability index **matters mechanically** (it's not just a number):
- **Eco-certified market premium**: at index ≥ 60, all produce sells at a bonus (e.g. +20%); at ≥ 80, a bigger bonus.
- **Climate feedback** (see 6.5): low sustainability makes weather more extreme; high sustainability stabilises it.

### 6.5 Weather (resolves each week)
Each week, roll a weather event. Probabilities shift with the **Climate Severity**, which is inversely tied to the sustainability index (low sustainability → more frequent extreme events — a thematic feedback loop the player feels).

| Weather | Effect |
|---------|--------|
| ☀️ Sunny / Ideal | Normal growth. |
| 🌧️ Rain | Refills tile moisture for free; Rainwater Harvesting banks extra. Minor flood risk to a random tile at very high frequency. |
| 🌵 Drought | Moisture loss doubled; unirrigated crops suffer. |
| 🔥 Heatwave | Cool-season crops (lettuce, carrot) take damage. |
| ❄️ Frost | Warm-season crops (tomato, strawberry, pumpkin) damaged or killed if unprotected. |
| ⛈️ Storm | Damages 1–3 random tiles' crops. |

Display the **current week's weather** and a short **forecast** (next 1–2 weeks, optionally fuzzy) so the player can plan. Precision Sensors tech improves forecast accuracy.

### 6.6 Market (per crop, dynamic)
- Each crop has a base price that **fluctuates ±** each week (small random walk within a band).
- **Supply/demand**: selling a large quantity of one crop in a short window **depresses that crop's price** (you flood the market); prices recover over time. Encourages selling a diverse spread.
- Occasional **demand events**: "Festival! Pumpkins +50% this week" or a contract to deliver N of a crop for a bonus.
- The eco-certified premium (6.4) applies on top when sustainability is high.
- Show a **market panel** with current price and a simple up/down indicator per crop.

---

## 7. Technology tree (green upgrades)

One-time purchases in a **Tech shop**, each costing money and providing a permanent benefit. Gate a few behind sustainability or money milestones if convenient.

| Tech | Cost | Effect |
|------|------|--------|
| 💧 Drip Irrigation | 300 | Halves water used per irrigation; improves sustainability. |
| 🪣 Rainwater Harvesting | 250 | Rain weeks add water to your reserve. |
| ♻️ Compost System | 350 | Organic compost becomes free and restores +soil each use. |
| ☀️ Solar Power | 400 | Cuts farm emissions; raises sustainability; powers Greenhouse. |
| 🏡 Greenhouse | 600 | Grow any crop in any season (incl. winter) on greenhouse tiles. |
| 📡 Precision Sensors | 300 | Shows optimal water/soil per tile; better weather forecast; reduces waste. |
| 🌱 Cover Cropping / No-Till | 250 | Fallow tiles recover soil much faster; reduces erosion. |
| 🐞 Beneficial Insects (IPM) | 200 | Natural pest resistance; removes need for (and penalty of) pesticides. |
| 🔄 Crop Rotation Planner | 200 | Highlights good rotation choices; bonus sustainability for rotating well. |
| 🌬️ Wind Turbine | 450 | Further emissions cut + small passive income from surplus energy. |

Each tech should visibly change play, not just add a number. (E.g. Greenhouse adds greenhouse tiles or a toggle; Sensors reveal hidden tile info; Drip changes irrigation cost.)

---

## 8. Goals & progression

Provide **two modes** (or one mode with optional goals):
- **Campaign goal**: reach **Sustainability Index ≥ 75 AND $5,000 saved** by the end of **Year 2 (week 96)**. Win screen on success.
- **Endless / Sandbox**: play indefinitely; track a high-score (a blend of profit + sustainability + biodiversity).

Show progress toward the goal in the UI. Lose condition (optional): bankruptcy (money < 0 with no harvest pending) ends the game.

---

## 9. Suggested file structure

Keep it modular and readable:

- `index.html` — page shell, UI containers, loads the scripts in order.
- `style.css` — all styling; farm grid via CSS Grid; tile state styles; panels.
- `data.js` — static data: `CROPS`, `TECH`, `WEATHER`, season definitions, market base prices.
- `game.js` — game state object + core logic: turn advance, growth, soil/water updates, weather resolution, market updates, sustainability calc, save/load.
- `ui.js` — rendering and DOM event handlers: draw grid, panels, market, tech shop; wire up buttons.

Maintain a single source-of-truth **game state object** (farm tiles, money, week, season, weather, water reserve, owned tech, sustainability index, market prices, recent-sales history). All systems read/write that object; `ui.js` renders from it. Save = serialise state to `localStorage`; load = restore it.

---

## 10. Build phases (BUILD IN THIS ORDER)

Build and verify each phase runs before starting the next. Each phase should leave the game **playable**.

**Phase 1 — Playable core (MVP).**
Grid of tiles; till; plant a few crops (start with wheat, carrot, tomato, beans); crops grow over weeks; harvest when ready; money; a basic seed shop; "Advance Week" button; sell harvested produce at a fixed price. A complete plant→grow→harvest→sell→buy loop.

**Phase 2 — Soil, water & seasons.**
Add per-tile soil health and moisture; irrigation; season cycle affecting growth; monoculture penalty; legumes restoring soil; soil/moisture affecting yield and speed.

**Phase 3 — Sustainability & fertiliser.**
Add the Sustainability Index and its display; fertiliser choice (none/chemical/organic) with their trade-offs; biodiversity tracking; eco-certified market premium.

**Phase 4 — Weather & climate feedback.**
Add weekly weather events with their effects; the forecast display; climate severity tied inversely to sustainability.

**Phase 5 — Technology tree.**
Add the Tech shop and all upgrades, each with a real gameplay effect.

**Phase 6 — Dynamic market.**
Add price fluctuation, supply/demand price depression, demand events/contracts.

**Phase 7 — Goals, save/load & polish.**
Add campaign goal + endless mode; localStorage save/load; win/lose screens; a short how-to-play panel; visual polish and tile animations.

---

## 11. UI layout (rough)

- **Top bar**: 💰 money · 📅 Year/Season/Week · current weather icon + name · 🌍 Sustainability Index · 💧 water reserve.
- **Centre**: the farm grid.
- **Right panel** (tabbed or stacked): Selected Tile info & actions · Seed Shop · Tech Shop · Market prices.
- **Bottom**: primary actions (Till, Plant, Irrigate, Harvest) and the big **Advance Week** button.
- Keep it clean and readable; colour-code soil health and price up/down. Emoji carry the visuals.

---

## 12. Acceptance criteria (the game is "done" when)

- Opens from `index.html` with **no console errors**.
- The full core loop works: plant → grow over weeks → harvest → sell → earn → reinvest.
- Soil health and water visibly change with play and affect outcomes.
- Sustainability Index responds correctly to practices and gates the eco premium.
- Weather events occur and have visible effects; low sustainability noticeably worsens weather.
- The market moves and flooding one crop drops its price.
- All tech upgrades are purchasable and each changes play.
- Save/load via localStorage works across page reloads.
- The campaign goal can be reached, triggering a win screen.

---

## 13. Notes for the implementing model

- Build **phase by phase**; after each phase, confirm `index.html` runs cleanly before continuing.
- Prefer clarity over cleverness; comment each system.
- Keep all game-balance numbers in `data.js` so they're easy to tune.
- Don't add external dependencies. Don't require a server. Don't use a build step.
- If a feature is ambiguous, implement the simplest version that satisfies the acceptance criteria and leave a `// TODO:` note.
