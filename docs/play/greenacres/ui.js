// ui.js — Rendering and DOM event handlers for GreenAcres

const UI = {
  selectedTileIndex: null,
  selectedCropId: null,
  selectedFertiliser: 'none',
  currentTab: 'tile',
  msgTimeout: null,

  init() {
    Sound.init();
    this.cacheDOM();
    this.bindEvents();
    this.render();
  },

  cacheDOM() {
    this.els = {
      topBar: document.getElementById('top-bar'),
      stage: document.getElementById('farm-stage'),
      scenery: document.getElementById('scenery'),
      weatherFx: document.getElementById('weather-fx'),
      forecastStrip: document.getElementById('forecast-strip'),
      grid: document.getElementById('farm-grid'),
      sidePanel: document.getElementById('side-panel'),
      messageBar: document.getElementById('message-bar'),
      overlay: document.getElementById('overlay'),
      btnTill: document.getElementById('btn-till'),
      btnPlant: document.getElementById('btn-plant'),
      btnIrrigate: document.getElementById('btn-irrigate'),
      btnHarvest: document.getElementById('btn-harvest'),
      btnAdvance: document.getElementById('btn-advance'),
      howToPlayPanel: document.getElementById('how-to-play'),
    };
  },

  bindEvents() {
    this.els.grid.addEventListener('click', (e) => {
      const tileEl = e.target.closest('.tile');
      if (tileEl) {
        Sound.click();
        this.selectTile(parseInt(tileEl.dataset.index, 10));
      }
    });

    this.els.btnTill.addEventListener('click', () => {
      if (this.selectedTileIndex !== null) {
        const before = Game.state.money;
        Game.tillTile(this.selectedTileIndex);
        if (Game.state.money < before) Sound.till(); else Sound.error();
        this.render();
      } else { Game.state.message = 'Select a tile first!'; Sound.error(); this.showMessage(); }
    });

    this.els.btnPlant.addEventListener('click', () => {
      if (this.selectedTileIndex === null) { Game.state.message = 'Select a tile first!'; Sound.error(); this.showMessage(); return; }
      if (!this.selectedCropId) { Game.state.message = 'Select a crop from the Seed Shop!'; Sound.error(); this.showMessage(); return; }
      const moneyBefore = Game.state.money;
      const stateBefore = Game.state.tiles[this.selectedTileIndex].state;
      Game.plantCrop(this.selectedTileIndex, this.selectedCropId, this.selectedFertiliser);
      if (Game.state.tiles[this.selectedTileIndex].state === 'planted' && stateBefore !== 'planted') Sound.plant();
      else Sound.error();
      this.render();
    });

    this.els.btnIrrigate.addEventListener('click', () => {
      if (this.selectedTileIndex !== null) {
        const mBefore = Game.state.money, wBefore = Game.state.waterReserve;
        Game.irrigateTile(this.selectedTileIndex);
        if (Game.state.money < mBefore || Game.state.waterReserve < wBefore) Sound.irrigate();
        else Sound.error();
        this.render();
      } else { Game.state.message = 'Select a tile first!'; Sound.error(); this.showMessage(); }
    });

    this.els.btnHarvest.addEventListener('click', () => {
      if (this.selectedTileIndex !== null) {
        const invBefore = Object.values(Game.state.inventory).reduce((a, b) => a + b, 0);
        Game.harvestTile(this.selectedTileIndex);
        const invAfter = Object.values(Game.state.inventory).reduce((a, b) => a + b, 0);
        if (invAfter > invBefore) Sound.harvest(); else Sound.error();
        this.render();
      } else { Game.state.message = 'Select a tile first!'; Sound.error(); this.showMessage(); }
    });

    this.els.btnAdvance.addEventListener('click', () => {
      Sound.advance();
      Game.advanceWeek();
      if (Game.state.weather && Game.state.weather.id === 'rain') Sound.rain();
      if (Game.state.weather && (Game.state.weather.id === 'storm' || Game.state.weather.id === 'drought')) Sound.thunder();
      this.render();
    });
  },

  selectTile(index) {
    this.selectedTileIndex = index;
    this.currentTab = 'tile';
    this.render();
  },

  startNewGame() {
    if (confirm('Start a new game? All progress will be lost.')) {
      Game.newGame();
      this.selectedTileIndex = null;
      this.selectedCropId = null;
      this.currentTab = 'tile';
      this.render();
    }
  },

  render() {
    if (Game.state.gameOver) this.showGameOver();
    else this.els.overlay.classList.remove('visible');
    this.renderTopBar();
    this.renderScene();
    this.renderGrid();
    this.renderSidePanel();
    this.updateBottomButtons();
    this.showMessage();
  },

  renderTopBar() {
    const s = Game.state;
    const totalWeeks = (s.year - 1) * 48 + s.week;
    const musicIcon = Sound.musicEnabled ? '🔊' : '🔇';
    const sust = s.sustainability;

    let goalHtml;
    if (s.mode === 'campaign') {
      goalHtml = `<span class="stat" title="Goal: Sustainability ≥ 75 AND $5,000 by end of Year 2 (week 96)">🎯 $${Math.min(s.money, 5000)}/5k · 🌍 ${Math.min(sust, 75)}/75 · ${totalWeeks}/96w</span>`;
    } else {
      goalHtml = `<span class="stat">♾️ Sandbox · Week ${totalWeeks}</span>`;
    }

    this.els.topBar.innerHTML = `
      <div class="top-left">
        <a class="stat back-link" href="../../#games" title="Back to Wild Olive Studios">← Studio</a>
        <span class="stat brand">🌱 GreenAcres</span>
        <span class="stat">💰 $${s.money}</span>
        <span class="stat">📅 Yr${s.year} ${s.season} Wk${s.week}</span>
        ${goalHtml}
      </div>
      <div class="top-right">
        <span class="stat">${s.weather ? s.weather.emoji + ' ' + s.weather.name : '🌤️ Clear'}</span>
        <span class="stat sust-meter">🌍 ${sust}
          <span class="sust-bar"><span class="sust-fill" style="width:${sust}%"></span></span>
        </span>
        <span class="stat">💧 ${s.waterReserve}</span>
        <button id="btn-music" class="small-btn" title="Toggle music">${musicIcon}</button>
        <button id="btn-how-to-play" class="small-btn" title="How to play">❓</button>
        <button id="btn-new-game" class="small-btn" title="New game">🔄</button>
      </div>`;

    document.getElementById('btn-new-game').addEventListener('click', () => { Sound.click(); this.startNewGame(); });
    document.getElementById('btn-how-to-play').addEventListener('click', () => { Sound.click(); this.els.howToPlayPanel.classList.toggle('visible'); });
    document.getElementById('btn-music').addEventListener('click', () => { Sound.resume(); Sound.toggleMusic(); this.renderTopBar(); });
  },

  renderScene() {
    const s = Game.state;
    const seasonClass = 'season-' + s.season.toLowerCase();
    const weatherClass = s.weather ? 'weather-' + s.weather.id : '';
    this.els.stage.className = `${seasonClass} ${weatherClass}`.trim();
    this.els.weatherFx.className = weatherClass;

    if (this.els.scenery && !this.els.scenery.dataset.ready) {
      this.els.scenery.innerHTML = Sprites.scene();
      this.els.scenery.dataset.ready = '1';
    }
    this.renderForecast();
  },

  renderForecast() {
    const s = Game.state;
    const hasSensors = s.ownedTech.includes('precision_sensors');
    let html = '<span class="forecast-label">Forecast</span>';
    if (hasSensors) {
      Game.getForecast(3).forEach((w, i) => {
        html += `<span class="forecast-item">${w.emoji} ${w.name}<span class="fc-when">+${i + 1}w</span></span>`;
      });
    } else {
      const next = Game.getForecast(1)[0];
      html += `<span class="forecast-item fuzzy">${next ? next.emoji : '🌤️'} next week <span class="fc-when">(estimate)</span></span>`;
      html += `<span class="forecast-item fuzzy">❓ <span class="fc-when">+2w</span></span>`;
      html += `<span class="hint">📡 Buy Precision Sensors for an accurate forecast.</span>`;
    }
    this.els.forecastStrip.innerHTML = html;
  },

  renderGrid() {
    const s = Game.state;
    const hasSensors = s.ownedTech.includes('precision_sensors');
    this.els.grid.style.setProperty('--cols', COLS);
    this.els.grid.style.setProperty('--rows', ROWS);
    this.els.grid.innerHTML = '';

    s.tiles.forEach((tile, i) => {
      const div = document.createElement('div');
      div.className = `tile tile-${tile.state}`;
      div.dataset.index = i;
      if (i === this.selectedTileIndex) div.classList.add('selected');
      if (tile.greenhouse) div.classList.add('greenhouse');

      // soil health → warm-brown soil colour (darker = depleted)
      const h = tile.soilHealth;
      const hue = Math.round(20 + (h / 100) * 14);
      const sat = Math.round(34 + (h / 100) * 22);
      const lit = Math.round(20 + (h / 100) * 22);
      div.style.setProperty('--soil', `hsl(${hue}, ${sat}%, ${lit}%)`);
      div.style.setProperty('--moist', (tile.moisture / 100 * 0.9).toFixed(2));

      const sheen = document.createElement('div');
      sheen.className = 'moist-sheen';
      div.appendChild(sheen);

      if (tile.state === 'planted' || tile.state === 'ready') {
        const crop = CROPS.find(c => c.id === tile.crop);
        if (crop) {
          const g = Math.min(1, tile.growthProgress / crop.growthWeeks);
          const layer = document.createElement('div');
          layer.className = 'crop-layer';
          layer.innerHTML = Sprites.crop(crop.id, g, tile.state === 'ready');
          div.appendChild(layer);
          if (tile.state === 'ready') {
            div.classList.add('ready-glow');
            const tag = document.createElement('span');
            tag.className = 'ready-tag';
            tag.textContent = 'READY';
            div.appendChild(tag);
          }
        }
      } else if (tile.state === 'withered') {
        const layer = document.createElement('div');
        layer.className = 'crop-layer';
        layer.innerHTML = Sprites.withered();
        div.appendChild(layer);
      }

      if (tile.greenhouse) {
        const badge = document.createElement('span');
        badge.className = 'gh-badge';
        badge.textContent = '🏠';
        div.appendChild(badge);
      }

      if (hasSensors && (tile.state === 'planted' || tile.state === 'tilled' || tile.state === 'ready')) {
        const sensor = document.createElement('div');
        sensor.className = 'tile-sensor';
        sensor.innerHTML = `<span>🌱${Math.round(tile.soilHealth)}</span><span>💧${Math.round(tile.moisture)}</span>`;
        div.appendChild(sensor);
      }

      this.els.grid.appendChild(div);
    });
  },

  renderSidePanel() {
    const tabs = [
      ['tile', 'Tile'], ['seed', 'Seed Shop'], ['tech', 'Tech'],
      ['market', 'Market'], ['inventory', 'Inventory'],
    ];
    let html = '<div class="tab-bar">';
    for (const [id, label] of tabs) {
      html += `<button class="tab-btn ${this.currentTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`;
    }
    html += '</div><div class="tab-content">';

    if (this.currentTab === 'tile') html += this.renderTileTab();
    else if (this.currentTab === 'seed') html += this.renderSeedTab();
    else if (this.currentTab === 'tech') html += this.renderTechTab();
    else if (this.currentTab === 'market') html += this.renderMarketTab();
    else if (this.currentTab === 'inventory') html += this.renderInventoryTab();

    html += '</div>';
    this.els.sidePanel.innerHTML = html;

    this.els.sidePanel.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.click();
        this.currentTab = btn.dataset.tab;
        this.renderSidePanel();
        this.updateBottomButtons();
      });
    });

    this.els.sidePanel.querySelectorAll('.crop-option').forEach(el => {
      el.addEventListener('click', () => {
        Sound.click();
        this.selectedCropId = el.dataset.cropId;
        this.els.sidePanel.querySelectorAll('.crop-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        this.updateBottomButtons();
      });
    });

    this.els.sidePanel.querySelectorAll('.sell-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Game.sellCrop(btn.dataset.crop, parseInt(btn.dataset.qty, 10) || 1);
        Sound.sell();
        this.render();
      });
    });

    this.els.sidePanel.querySelectorAll('.buy-tech-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.click();
        Game.purchaseTech(btn.dataset.techId);
        this.render();
      });
    });

    this.els.sidePanel.querySelectorAll('input[name="fert"]').forEach(el => {
      el.addEventListener('change', () => {
        Sound.click();
        if (el.checked) this.selectedFertiliser = el.value;
      });
    });
  },

  _gauge(label, value, kind) {
    const v = Math.max(0, Math.min(100, value));
    let color;
    if (kind === 'soil') color = v >= 60 ? '#5fce5a' : v >= 30 ? '#e0a83a' : '#e0664a';
    else color = v >= 60 ? '#3aa0e0' : v >= 30 ? '#e0a83a' : '#e0664a';
    return `<div class="gauge">
      <div class="gauge-label">${label}: ${Math.round(value)}</div>
      <div class="gauge-track"><div class="gauge-fill" style="width:${v}%;background:${color}"></div></div>
    </div>`;
  },

  renderTileTab() {
    if (this.selectedTileIndex === null) return '<p class="hint">Click a tile to select it, then use the actions below.</p>';
    const tile = Game.state.tiles[this.selectedTileIndex];
    const idx = this.selectedTileIndex;
    let html = `<h3>📍 Tile ${idx + 1}${tile.greenhouse ? ' 🏠 Greenhouse' : ''}</h3>`;
    html += '<div class="tile-card">';
    html += `<p><strong>State:</strong> ${tile.state}</p>`;
    if (tile.crop) {
      const crop = CROPS.find(c => c.id === tile.crop);
      html += `<p><strong>Crop:</strong> ${crop.emoji} ${crop.name}</p>`;
      if (tile.state === 'planted') {
        const pct = Math.min(99, Math.round((tile.growthProgress / crop.growthWeeks) * 100));
        html += `<p><strong>Growth:</strong> ${pct}%</p>`;
        html += `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
        html += `<p><strong>Fertiliser:</strong> ${tile.fertiliser}</p>`;
      } else if (tile.state === 'ready') {
        html += `<p style="color:#ffd24a"><strong>✨ Ready to harvest!</strong></p>`;
      }
    }
    html += '<div class="stat-row">';
    html += this._gauge('Soil', tile.soilHealth, 'soil');
    html += this._gauge('Water', tile.moisture, 'water');
    html += '</div>';
    if (tile.previousCrop) {
      const prev = CROPS.find(c => c.id === tile.previousCrop);
      html += `<p class="hint">Last grown here: ${prev.emoji} ${prev.name} — plant something different to avoid the monoculture penalty.</p>`;
    }
    html += '</div>';
    return html;
  },

  renderSeedTab() {
    const s = Game.state;
    let html = '<h3>🌱 Seed Shop</h3>';
    if (s.season === 'Winter' && !s.ownedTech.includes('greenhouse')) {
      html += '<p class="hint" style="color:#ffd24a">❄️ Nothing grows outdoors in Winter — build a Greenhouse to plant year-round.</p>';
    }
    html += '<div class="crop-list">';
    for (const crop of CROPS) {
      const inSeason = crop.bestSeason.includes(s.season);
      const tag = inSeason ? `✅ in season (${crop.bestSeason.join('/')})` : `⚠️ off-season (${crop.bestSeason.join('/')})`;
      const restores = crop.soilDrain < 0 ? ' · 🌿 restores soil' : '';
      const selected = this.selectedCropId === crop.id ? 'selected' : '';
      html += `<div class="crop-option ${inSeason ? 'in-season' : ''} ${selected}" data-crop-id="${crop.id}">
        <span class="crop-emoji">${crop.emoji}</span>
        <span class="crop-name">${crop.name}</span>
        <span class="crop-cost">$${crop.seedCost}</span>
        <span class="crop-detail">${crop.growthWeeks}w · sells ~$${crop.basePrice} · ${tag}${restores}</span>
      </div>`;
    }
    html += '</div>';

    html += '<div class="fert-section"><p><strong>Fertiliser for next planting:</strong></p>';
    html += `<label><input type="radio" name="fert" value="none" ${this.selectedFertiliser === 'none' ? 'checked' : ''}> None — baseline</label>`;
    html += `<label><input type="radio" name="fert" value="chemical" ${this.selectedFertiliser === 'chemical' ? 'checked' : ''}> Chemical (+1 yield, +30% growth, −sustainability, +$5)</label>`;
    html += `<label><input type="radio" name="fert" value="organic" ${this.selectedFertiliser === 'organic' ? 'checked' : ''}> Organic (+soil, +sustainability, +$8 — free with Compost System)</label>`;
    html += '</div>';

    if (this.selectedCropId) {
      const crop = CROPS.find(c => c.id === this.selectedCropId);
      html += `<p class="hint">Selected: ${crop.emoji} ${crop.name}. Select a tilled tile and click <strong>Plant</strong>.</p>`;
    }
    return html;
  },

  renderTechTab() {
    const s = Game.state;
    let html = '<h3>🔬 Tech Shop</h3>';
    html += TECH.map(t => {
      const owned = s.ownedTech.includes(t.id);
      const canBuy = !owned && s.money >= t.cost;
      return `<div class="tech-item ${owned ? 'owned' : ''}">
        <span class="tech-emoji">${t.emoji}</span>
        <span class="tech-name">${t.name}</span>
        <span class="tech-cost">${owned ? '✅ Owned' : '$' + t.cost}</span>
        <p class="tech-desc">${t.description}</p>
        ${!owned ? `<button class="buy-tech-btn" data-tech-id="${t.id}" ${!canBuy ? 'disabled' : ''}>${canBuy ? 'Buy' : 'Need $' + (t.cost - s.money)}</button>` : ''}
      </div>`;
    }).join('');
    return html;
  },

  renderMarketTab() {
    const s = Game.state;
    let html = '<h3>📊 Market</h3>';
    if (s.demandEvent) {
      html += `<p class="demand-notice">📢 ${s.demandEvent.emoji} ${s.demandEvent.name} in demand: +${s.demandEvent.bonus}% (${s.demandTimer}w left)</p>`;
    }
    const premium = Math.round((Game.getEcoPremium() - 1) * 100);
    html += `<p class="hint">Eco-premium on every sale: <strong style="color:#6cce4a">+${premium}%</strong> (raise Sustainability for more).</p>`;
    html += '<div class="market-list">';
    for (const crop of CROPS) {
      const price = s.marketPrices[crop.id];
      const diff = price - crop.basePrice;
      const cls = diff > 3 ? 'up' : diff < -3 ? 'down' : 'flat';
      const arrow = diff > 3 ? '▲' : diff < -3 ? '▼' : '▬';
      html += `<div class="market-item">
        <span>${crop.emoji}</span>
        <span class="crop-name">${crop.name}</span>
        <span class="spark ${cls}">$${price} ${arrow}</span>
      </div>`;
    }
    html += '</div>';
    return html;
  },

  renderInventoryTab() {
    const s = Game.state;
    let html = '<h3>📦 Inventory</h3>';
    const entries = Object.entries(s.inventory).filter(([, qty]) => qty > 0);
    if (entries.length === 0) return html + '<p class="hint">Empty. Harvest ready crops, then sell them here!</p>';
    html += '<div class="inventory-list">';
    for (const [cropId, qty] of entries) {
      const crop = CROPS.find(c => c.id === cropId);
      const premium = Game.getEcoPremium();
      const price = Math.round(s.marketPrices[cropId] * premium);
      const sellAll = qty > 1 ? `<button class="sell-btn" data-crop="${cropId}" data-qty="${qty}">Sell all ($${price * qty})</button>` : '';
      html += `<div class="inv-item">
        <span>${crop.emoji}</span>
        <span class="crop-name">${crop.name}</span>
        <span class="inv-qty">x${qty}</span>
        <span class="inv-price">@ $${price}</span>
        <button class="sell-btn" data-crop="${cropId}" data-qty="1">Sell 1</button>
        ${sellAll}
      </div>`;
    }
    html += '</div>';
    return html;
  },

  updateBottomButtons() {
    const tile = this.selectedTileIndex !== null ? Game.state.tiles[this.selectedTileIndex] : null;
    this.els.btnTill.disabled = !tile || (tile.state !== 'empty' && tile.state !== 'withered');
    this.els.btnPlant.disabled = !tile || tile.state !== 'tilled' || !this.selectedCropId;
    this.els.btnIrrigate.disabled = !tile || (tile.state !== 'planted' && tile.state !== 'tilled');
    this.els.btnHarvest.disabled = !tile || tile.state !== 'ready';

    this.els.btnTill.textContent = `Till ($${TILL_COST})`;
    this.els.btnIrrigate.textContent = `Irrigate ($${IRRIGATION_WATER_COST})`;
    const sel = this.selectedCropId ? CROPS.find(c => c.id === this.selectedCropId) : null;
    this.els.btnPlant.textContent = sel ? `Plant ${sel.emoji} ($${sel.seedCost})` : 'Plant';
    this.els.btnHarvest.textContent = 'Harvest';
  },

  showGameOver() {
    const s = Game.state;
    if (s.won) Sound.win(); else Sound.lose();
    this.els.overlay.innerHTML = `
      <div class="overlay-content ${s.won ? 'win' : 'lose'}">
        <h2>${s.won ? '🏆 You Win!' : '💀 Game Over'}</h2>
        <p>${s.won ? 'You reached Sustainability ≥ 75 and $5,000 by the end of Year 2!' : s.message}</p>
        <p>Final stats:</p>
        <ul>
          <li>💰 Money: $${s.money}</li>
          <li>🌍 Sustainability: ${s.sustainability}</li>
          <li>📅 Year ${s.year}, Week ${s.week}</li>
        </ul>
        <button id="btn-play-again" class="action-btn">Play Again</button>
      </div>`;
    this.els.overlay.classList.add('visible');
    document.getElementById('btn-play-again').addEventListener('click', () => {
      Sound.click();
      Game.newGame();
      this.selectedTileIndex = null;
      this.selectedCropId = null;
      this.currentTab = 'tile';
      this.els.overlay.classList.remove('visible');
      this.render();
    });
  },

  showMessage() {
    const s = Game.state;
    if (s.message) {
      this.els.messageBar.textContent = s.message;
      this.els.messageBar.style.display = 'block';
      if (this.msgTimeout) clearTimeout(this.msgTimeout);
      this.msgTimeout = setTimeout(() => { this.els.messageBar.style.display = 'none'; }, 5000);
    }
  },
};
