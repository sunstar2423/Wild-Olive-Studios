// game.js — Game state and core logic for GreenAcres

const Game = {
  state: null,

  createInitialState() {
    const tiles = [];
    for (let i = 0; i < TOTAL_TILES; i++) {
      tiles.push({
        id: i, state: 'empty', crop: null, growthProgress: 0,
        soilHealth: STARTING_SOIL_HEALTH, moisture: STARTING_MOISTURE,
        previousCrop: null, fertiliser: 'none', greenhouse: false, dryWeeks: 0,
      });
    }

    const marketPrices = {};
    for (const crop of CROPS) marketPrices[crop.id] = crop.basePrice;

    const salesHistory = {};
    for (const crop of CROPS) salesHistory[crop.id] = [];

    return {
      money: STARTING_MONEY, week: 1, year: 1, season: 'Spring',
      weather: null, tiles, inventory: {},
      waterReserve: STARTING_WATER_RESERVE, sustainability: 50,
      ownedTech: [], marketPrices, salesHistory,
      recentCrops: [], mode: 'campaign',
      gameOver: false, won: false, message: '',
      climateSeverity: 0.5, demandEvent: null, demandTimer: 0,
      weatherQueue: [],
    };
  },

  init() {
    const saved = this.loadGame();
    if (saved) { this.state = saved; this.state.message = ''; }
    else { this.state = this.createInitialState(); }
    this.ensureForecast(); // migrate older saves / seed the forecast
  },

  getSeason(week, year) {
    const totalWeeks = (year - 1) * 48 + week;
    return SEASONS[Math.floor((totalWeeks - 1) / WEEKS_PER_SEASON) % 4];
  },

  isPlantableSeason(crop, tileIndex) {
    const s = this.state;
    const tile = tileIndex !== undefined ? s.tiles[tileIndex] : null;
    if (tile && tile.greenhouse) return true;
    if (s.season === 'Winter') return false;
    return true;
  },

  getGrowthRate(tile, crop) {
    const s = this.state;
    let rate = 1.0;

    if (!crop.bestSeason.includes(s.season)) {
      rate *= (s.season === 'Winter' ? 0 : 0.67);
    }

    if (tile.soilHealth < 30) rate *= 0.67;
    if (tile.moisture < 20) rate *= 0.67;

    if (tile.fertiliser === 'chemical') rate *= 1.3;
    if (tile.fertiliser === 'organic') rate *= 0.85;

    return Math.max(0.1, rate);
  },

  advanceWeek() {
    const s = this.state;
    s.week++;
    if (s.week > 48) { s.week = 1; s.year++; }
    s.season = this.getSeason(s.week, s.year);

    this.checkGameEnd();
    if (s.gameOver) { this.autoSave(); return; }

    // pull this week's weather from the forecast queue, then top it back up
    this.ensureForecast();
    const nextId = s.weatherQueue.shift();
    s.weather = WEATHER_EVENTS.find(w => w.id === nextId) || WEATHER_EVENTS[0];
    this.ensureForecast();
    this.applyWeatherEffects();

    const weatherMult = this.getWeatherMoistureMultiplier();
    let harvestedAny = false, witheredAny = false;

    for (const tile of s.tiles) {
      if (tile.state === 'planted' && tile.crop) {
        const crop = CROPS.find(c => c.id === tile.crop);

        if (weatherMult > 0 && s.weather && s.weather.id !== 'rain') {
          tile.moisture = Math.max(0, tile.moisture - crop.waterNeed * weatherMult);
        }

        if (s.weather && s.weather.id === 'rain') {
          tile.moisture = Math.min(100, tile.moisture + 20);
          if (s.ownedTech.includes('rainwater_harvesting')) {
            s.waterReserve = Math.min(500, s.waterReserve + 10);
          }
        }

        if (tile.moisture <= 0) {
          tile.dryWeeks = (tile.dryWeeks || 0) + 1;
        } else {
          tile.dryWeeks = 0;
        }

        if (tile.dryWeeks >= 3) {
          tile.state = 'withered'; tile.crop = null;
          tile.growthProgress = 0; tile.dryWeeks = 0;
          witheredAny = true; continue;
        }

        tile.growthProgress += this.getGrowthRate(tile, crop);
        if (tile.growthProgress >= crop.growthWeeks) {
          tile.state = 'ready'; harvestedAny = true;
        }
      }

      if (tile.state === 'tilled' && !tile.crop) {
        const recovery = s.ownedTech.includes('cover_cropping') ? 2 : 0.5;
        tile.soilHealth = Math.min(100, tile.soilHealth + recovery);
      }
    }

    if (s.ownedTech.includes('wind_turbine')) {
      s.money += 12; // surplus-energy income — sized to pay back over the campaign
    }

    this.updateMarket();
    this.calculateSustainability();
    this.handleDemandEvent();

    const msgs = [];
    if (harvestedAny) msgs.push('Some crops are ready to harvest!');
    if (witheredAny) msgs.push('Some crops withered!');
    if (s.demandEvent) msgs.push(`📢 ${s.demandEvent.emoji} ${s.demandEvent.name} demand: +${s.demandEvent.bonus}%!`);
    if (msgs.length === 0) msgs.push(`Week ${s.week}, ${s.season}.`);
    s.message = msgs.join('  ');
    this.autoSave();
  },

  applyWeatherEffects() {
    const s = this.state;
    if (!s.weather) return;

    if (s.weather.id === 'heatwave') {
      for (const tile of s.tiles) {
        if (tile.state === 'planted' && tile.crop) {
          const crop = CROPS.find(c => c.id === tile.crop);
          if (crop && (crop.id === 'lettuce' || crop.id === 'carrot')) {
            if (Math.random() < 0.5) {
              tile.state = 'withered'; tile.crop = null;
              tile.growthProgress = 0;
            }
          }
        }
      }
    }

    if (s.weather.id === 'frost') {
      for (const tile of s.tiles) {
        if (tile.state === 'planted' && tile.crop) {
          const crop = CROPS.find(c => c.id === tile.crop);
          if (crop && (crop.id === 'tomato' || crop.id === 'strawberry' || crop.id === 'pumpkin')) {
            if (Math.random() < 0.5) {
              tile.state = 'withered'; tile.crop = null;
              tile.growthProgress = 0;
            }
          }
        }
      }
    }

    if (s.weather.id === 'storm') {
      const count = 1 + Math.floor(Math.random() * 3);
      const planted = s.tiles.filter(t => t.state === 'planted');
      for (let i = 0; i < Math.min(count, planted.length); i++) {
        const tile = planted[Math.floor(Math.random() * planted.length)];
        if (Math.random() < 0.6) {
          tile.state = 'withered'; tile.crop = null;
          tile.growthProgress = 0;
        }
      }
    }
  },

  getWeatherMoistureMultiplier() {
    const w = this.state.weather;
    if (!w) return 1;
    if (w.id === 'drought') return 2;
    if (w.id === 'rain') return 0;
    return 1;
  },

  // Roll a single weather id, biased by climate severity (low sustainability
  // → more frequent extreme events). Season nudges seasonal hazards.
  rollWeatherId() {
    const s = this.state;
    const severity = s.climateSeverity || 0.5;
    const extremeChance = severity * 0.6;
    const r = Math.random();
    if (r < 0.25) return 'sunny';
    if (r < 0.45) return 'rain';
    if (r < 0.45 + extremeChance * 0.3) return 'drought';
    if (r < 0.45 + extremeChance * 0.5) return 'heatwave';
    if (r < 0.45 + extremeChance * 0.7) return 'frost';
    if (r < 0.45 + extremeChance * 0.9) return 'storm';
    return 'sunny';
  },

  // Keep a short queue of upcoming weather so the player gets a forecast.
  ensureForecast() {
    const s = this.state;
    if (!Array.isArray(s.weatherQueue)) s.weatherQueue = [];
    while (s.weatherQueue.length < 3) s.weatherQueue.push(this.rollWeatherId());
  },

  // Returns the next n weeks of weather events for the forecast UI.
  getForecast(n) {
    this.ensureForecast();
    return this.state.weatherQueue.slice(0, n || 2)
      .map(id => WEATHER_EVENTS.find(w => w.id === id))
      .filter(Boolean);
  },

  updateMarket() {
    const s = this.state;
    for (const crop of CROPS) {
      let price = s.marketPrices[crop.id];

      // Mean-revert toward the base price so a market always recovers over time.
      price += (crop.basePrice - price) * 0.18;
      // Small week-to-week random walk for variation.
      price += (Math.random() - 0.5) * crop.basePrice * 0.12;

      // Supply pressure: flooding the market with one crop depresses its price,
      // but the dip is bounded and fades as mean-reversion pulls it back — so
      // selling a diverse spread stays profitable while dumping one crop hurts.
      const recent = (s.salesHistory[crop.id] || []).slice(-3).reduce((a, b) => a + b, 0);
      if (recent > 4) price -= Math.min(crop.basePrice * 0.35, (recent - 4) * 1.5);

      const floor = Math.max(2, Math.round(crop.basePrice * 0.45));
      const cap = Math.round(crop.basePrice * 1.8);
      price = Math.max(floor, Math.min(cap, Math.round(price)));

      // Demand events are a special spike — they may exceed the normal cap.
      if (s.demandEvent && s.demandEvent.cropId === crop.id) {
        price = Math.round(price * (1 + s.demandEvent.bonus / 100));
      }

      s.marketPrices[crop.id] = price;
    }
  },

  handleDemandEvent() {
    const s = this.state;
    if (s.demandTimer > 0) {
      s.demandTimer--;
      if (s.demandTimer <= 0) {
        s.demandEvent = null;
        s.message = 'The special demand event has ended.';
      }
      return;
    }
    if (Math.random() < 0.08) {
      const crop = CROPS[Math.floor(Math.random() * CROPS.length)];
      const bonus = 30 + Math.floor(Math.random() * 40);
      s.demandEvent = { cropId: crop.id, name: crop.name, emoji: crop.emoji, bonus };
      s.demandTimer = 3 + Math.floor(Math.random() * 3);
    }
  },

  calculateSustainability() {
    const s = this.state;
    if (s.tiles.length === 0) return;

    const avgSoil = s.tiles.reduce((sum, t) => sum + t.soilHealth, 0) / s.tiles.length;

    let bioScore = 0;
    if (s.recentCrops.length > 0) {
      const unique = new Set(s.recentCrops).size;
      bioScore = Math.min(20, unique * 2);
    }

    let fertiliserScore = 0;
    for (const tile of s.tiles) {
      if (tile.fertiliser === 'chemical') fertiliserScore -= 5;
      if (tile.fertiliser === 'organic') fertiliserScore += 3;
    }
    fertiliserScore = Math.max(-20, fertiliserScore);

    let techScore = 0;
    if (s.ownedTech.includes('solar_power')) techScore += 10;
    if (s.ownedTech.includes('wind_turbine')) techScore += 10;
    if (s.ownedTech.includes('drip_irrigation')) techScore += 5;
    if (s.ownedTech.includes('compost_system')) techScore += 5;
    if (s.ownedTech.includes('beneficial_insects')) techScore += 5;
    if (s.ownedTech.includes('crop_rotation_planner')) techScore += 5;

    const raw = avgSoil * 0.5 + bioScore + fertiliserScore + techScore;
    s.sustainability = Math.round(Math.min(100, Math.max(0, raw)));

    s.climateSeverity = Math.max(0.05, 1 - s.sustainability / 100);
  },

  getEcoPremium() {
    const si = this.state.sustainability;
    if (si >= 80) return 1.35;
    if (si >= 60) return 1.20;
    return 1.0;
  },

  tillTile(index) {
    const s = this.state; const tile = s.tiles[index];
    if (!tile) return false;
    if (tile.state === 'tilled' || tile.state === 'planted' || tile.state === 'ready') {
      s.message = 'This tile is already in use!'; return false;
    }
    if (s.money < TILL_COST) { s.message = `Not enough money! Tilling costs $${TILL_COST}.`; return false; }
    s.money -= TILL_COST; tile.state = 'tilled';
    s.message = `Tile ${index + 1} tilled. Ready to plant.`; this.autoSave(); return true;
  },

  plantCrop(index, cropId, fertiliserType) {
    const s = this.state; const tile = s.tiles[index];
    const crop = CROPS.find(c => c.id === cropId);
    if (!tile || !crop) return false;
    if (tile.state !== 'tilled') { s.message = 'Tile must be tilled first!'; return false; }
    if (!this.isPlantableSeason(crop, index)) { s.message = 'Nothing grows in Winter! Use a Greenhouse tile.'; return false; }
    if (s.money < crop.seedCost) { s.message = `Not enough money for ${crop.name} seeds ($${crop.seedCost})!`; return false; }

    if (tile.previousCrop === cropId) {
      tile.soilHealth = Math.max(0, tile.soilHealth - 5);
      s.message = `Monoculture penalty! Soil depleted by 5.`;
    }

    const fert = fertiliserType || 'none';
    if (fert === 'chemical') {
      if (s.money < 5) { s.message = 'Chemical fertiliser costs $5 extra.'; return false; }
      s.money -= 5;
    }
    if (fert === 'organic') {
      const hasCompost = s.ownedTech.includes('compost_system');
      if (!hasCompost) {
        if (s.money < 8) { s.message = 'Organic compost costs $8 extra.'; return false; }
        s.money -= 8;
      }
      // Organic compost rebuilds soil on application (more with a Compost System).
      tile.soilHealth = Math.min(100, tile.soilHealth + (hasCompost ? 8 : 5));
    }

    s.money -= crop.seedCost;
    tile.state = 'planted'; tile.crop = cropId;
    tile.growthProgress = 0; tile.fertiliser = fert;
    tile.dryWeeks = 0; tile.previousCrop = cropId;
    s.recentCrops.push(cropId);
    if (s.recentCrops.length > 20) s.recentCrops.shift();

    const seasonOk = crop.bestSeason.includes(s.season);
    const msg = seasonOk ? '' : ' (out of season — slower growth)';
    s.message = `${crop.emoji} ${crop.name} planted on tile ${index + 1}.${msg}`;
    this.autoSave(); return true;
  },

  irrigateTile(index) {
    const s = this.state; const tile = s.tiles[index];
    if (!tile) return false;
    if (tile.state !== 'planted' && tile.state !== 'tilled') {
      s.message = 'Only tilled or planted tiles can be irrigated.'; return false;
    }

    const drip = s.ownedTech.includes('drip_irrigation');
    const cost = drip ? Math.ceil(IRRIGATION_WATER_COST / 2) : IRRIGATION_WATER_COST;
    const amount = drip ? Math.round(IRRIGATION_WATER_AMOUNT * 0.7) : IRRIGATION_WATER_AMOUNT;

    if (s.waterReserve >= 5) {
      s.waterReserve -= 5;
    } else if (s.money >= cost) {
      s.money -= cost;
    } else {
      s.message = `Not enough money ($${cost}) or water to irrigate!`; return false;
    }

    tile.moisture = Math.min(100, tile.moisture + amount);
    tile.dryWeeks = 0;
    s.message = `Tile ${index + 1} irrigated (moisture: ${tile.moisture}).`;
    this.autoSave(); return true;
  },

  harvestTile(index) {
    const s = this.state; const tile = s.tiles[index];
    if (!tile) return false;
    if (tile.state !== 'ready') { s.message = 'Nothing ready to harvest here!'; return false; }
    const crop = CROPS.find(c => c.id === tile.crop);
    if (!crop) return false;

    tile.soilHealth = Math.max(0, Math.min(100, tile.soilHealth - crop.soilDrain));

    let yield_ = 1;
    if (tile.fertiliser === 'chemical') yield_ = 2;
    if (tile.fertiliser === 'organic') yield_ = 1;

    if (!s.inventory[crop.id]) s.inventory[crop.id] = 0;
    s.inventory[crop.id] += yield_;

    tile.state = 'empty'; tile.crop = null;
    tile.growthProgress = 0; tile.fertiliser = 'none'; tile.dryWeeks = 0;

    const restoreNote = crop.soilDrain < 0 ? ` (restored ${-crop.soilDrain} soil health!)` : '';
    s.message = `Harvested ${yield_} ${crop.emoji} ${crop.name}!${restoreNote}`;
    this.autoSave(); return true;
  },

  sellCrop(cropId, quantity) {
    const s = this.state; quantity = quantity || 1;
    if (!s.inventory[cropId] || s.inventory[cropId] < quantity) {
      s.message = 'Not enough in inventory!'; return false;
    }
    const crop = CROPS.find(c => c.id === cropId);
    const premium = this.getEcoPremium();
    const price = Math.round(s.marketPrices[cropId] * premium);
    const revenue = price * quantity;
    s.inventory[cropId] -= quantity;
    s.money += revenue;

    if (!s.salesHistory[cropId]) s.salesHistory[cropId] = [];
    s.salesHistory[cropId].push(quantity);
    if (s.salesHistory[cropId].length > 12) s.salesHistory[cropId].shift();

    s.message = `Sold ${quantity}x ${crop.emoji} ${crop.name} for $${revenue}.`;
    this.autoSave(); return true;
  },

  purchaseTech(techId) {
    const s = this.state;
    const tech = TECH.find(t => t.id === techId);
    if (!tech) return false;
    if (s.ownedTech.includes(techId)) { s.message = 'Already owned!'; return false; }
    if (s.money < tech.cost) { s.message = `Not enough money! ${tech.name} costs $${tech.cost}.`; return false; }

    s.money -= tech.cost;
    s.ownedTech.push(techId);

    if (techId === 'greenhouse') {
      const emptyTiles = s.tiles.filter(t => t.state === 'empty');
      if (emptyTiles.length > 0) {
        const convert = Math.min(4, emptyTiles.length);
        for (let i = 0; i < convert; i++) {
          emptyTiles[i].greenhouse = true;
        }
        s.message = `Greenhouse built! ${convert} tiles are now covered.`;
      } else {
        s.message = 'Greenhouse built! (no empty tiles to convert)';
      }
    } else {
      s.message = `${tech.emoji} ${tech.name} purchased!`;
    }

    this.autoSave(); return true;
  },

  checkGameEnd() {
    const s = this.state;
    if (s.gameOver) return;

    const totalInv = Object.keys(s.inventory).length > 0 ? Object.values(s.inventory).reduce((a, b) => a + b, 0) : 0;
    if (s.money < 0 && totalInv === 0) {
      s.gameOver = true; s.won = false;
      s.message = '💀 Bankrupt! Game over.';
      return;
    }

    if (s.mode === 'campaign') {
      const totalWeeks = (s.year - 1) * 48 + s.week;
      if (totalWeeks > 96) {
        if (s.sustainability >= 75 && s.money >= 5000) {
          s.gameOver = true; s.won = true;
          s.message = '🏆 You win! Sustainability ≥ 75 and $5,000 by end of Year 2!';
        } else {
          s.gameOver = true; s.won = false;
          s.message = '⏰ Time\'s up! You didn\'t reach the goals by end of Year 2.';
        }
      }
    }
  },

  autoSave() {
    try { localStorage.setItem('greenacres_save', JSON.stringify(this.state)); }
    catch (e) { console.warn('Auto-save failed:', e); }
  },

  loadGame() {
    try {
      const data = localStorage.getItem('greenacres_save');
      if (!data) return null;
      return this.sanitizeSave(JSON.parse(data));
    } catch (e) { return null; }
  },

  // Rebuild a clean state from a parsed save. Saved values are copied onto a
  // fresh state only after validation (enums whitelisted, ids checked against
  // game data, numbers clamped) — several of these fields end up in innerHTML,
  // so a hand-edited or corrupt save must never carry markup or unknown ids.
  sanitizeSave(parsed) {
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tiles)) return null;
    const num = (v, fallback, min, max) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    const cropIds = new Set(CROPS.map(c => c.id));
    const s = this.createInitialState();

    s.money = Math.round(num(parsed.money, STARTING_MONEY, 0, 1e9));
    s.week = Math.round(num(parsed.week, 1, 1, 48));
    s.year = Math.round(num(parsed.year, 1, 1, 999));
    s.season = this.getSeason(s.week, s.year);
    s.waterReserve = Math.round(num(parsed.waterReserve, STARTING_WATER_RESERVE, 0, 500));
    s.sustainability = Math.round(num(parsed.sustainability, 50, 0, 100));
    s.mode = parsed.mode === 'sandbox' ? 'sandbox' : 'campaign';
    s.gameOver = parsed.gameOver === true;
    s.won = parsed.won === true;
    s.climateSeverity = num(parsed.climateSeverity, 0.5, 0.05, 1);

    s.weather = (parsed.weather && WEATHER_EVENTS.find(w => w.id === parsed.weather.id)) || null;
    s.weatherQueue = (Array.isArray(parsed.weatherQueue) ? parsed.weatherQueue : [])
      .filter(id => WEATHER_EVENTS.some(w => w.id === id)).slice(0, 3);

    const demandCrop = parsed.demandEvent && CROPS.find(c => c.id === parsed.demandEvent.cropId);
    if (demandCrop) {
      s.demandEvent = {
        cropId: demandCrop.id, name: demandCrop.name, emoji: demandCrop.emoji,
        bonus: Math.round(num(parsed.demandEvent.bonus, 0, 0, 500)),
      };
      s.demandTimer = Math.round(num(parsed.demandTimer, 0, 0, 99));
    }

    const TILE_STATES = ['empty', 'tilled', 'planted', 'ready', 'withered'];
    parsed.tiles.slice(0, TOTAL_TILES).forEach((t, i) => {
      if (!t || typeof t !== 'object') return;
      const tile = s.tiles[i];
      tile.state = TILE_STATES.includes(t.state) ? t.state : 'empty';
      tile.crop = cropIds.has(t.crop) ? t.crop : null;
      if ((tile.state === 'planted' || tile.state === 'ready') && !tile.crop) tile.state = 'empty';
      tile.growthProgress = num(t.growthProgress, 0, 0, 999);
      tile.soilHealth = num(t.soilHealth, STARTING_SOIL_HEALTH, 0, 100);
      tile.moisture = num(t.moisture, STARTING_MOISTURE, 0, 100);
      tile.previousCrop = cropIds.has(t.previousCrop) ? t.previousCrop : null;
      tile.fertiliser = ['chemical', 'organic'].includes(t.fertiliser) ? t.fertiliser : 'none';
      tile.greenhouse = t.greenhouse === true;
      tile.dryWeeks = Math.round(num(t.dryWeeks, 0, 0, 99));
    });

    if (parsed.inventory && typeof parsed.inventory === 'object') {
      for (const id of cropIds) {
        const qty = Math.round(num(parsed.inventory[id], 0, 0, 1e6));
        if (qty > 0) s.inventory[id] = qty;
      }
    }
    if (Array.isArray(parsed.ownedTech)) {
      s.ownedTech = TECH.map(t => t.id).filter(id => parsed.ownedTech.includes(id));
    }
    for (const crop of CROPS) {
      if (parsed.marketPrices) {
        s.marketPrices[crop.id] = Math.round(num(parsed.marketPrices[crop.id], crop.basePrice, 1, 9999));
      }
      if (parsed.salesHistory && Array.isArray(parsed.salesHistory[crop.id])) {
        s.salesHistory[crop.id] = parsed.salesHistory[crop.id].slice(-12).map(v => num(v, 0, 0, 1e6));
      }
    }
    s.recentCrops = (Array.isArray(parsed.recentCrops) ? parsed.recentCrops : [])
      .filter(id => cropIds.has(id)).slice(-20);
    return s;
  },

  deleteSave() {
    try { localStorage.removeItem('greenacres_save'); } catch (e) {}
  },

  newGame() {
    this.deleteSave();
    this.state = this.createInitialState();
  },

  setMode(mode) {
    this.state.mode = mode;
    this.newGame();
  },
};
