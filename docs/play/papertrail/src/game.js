import {
  LOGICAL_WIDTH, LOGICAL_HEIGHT, DT,
  SHOULDER_WIDTH, BIKE_WIDTH, BIKE_HEIGHT,
  PLAYER_LATERAL_SPEED, LIVES, INVULN_TIME,
  BASE_SCROLL_SPEED, SPEED_MIN_MULT, SPEED_MAX_MULT, OFFROAD_SPEED_MULT,
  SEGMENT_LENGTH, GAP_MIN, MIN_REACTION,
  COIN_POINTS, DISTANCE_PER_POINT,
  TRICK_POINTS, CLEAN_LANDING,
  NEAR_MISS_RADIUS, NEAR_MISS_BASE, COMBO_WINDOW, COMBO_MAX,
  BOOST_POINTS, BOOST_DURATION, BOOST_MULT,
  PLAYER_Y, ZONES,
} from './constants.js';
import { sfx, music } from './audio.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let scale = 1, ox = 0, oy = 0;

function resize() {
  const ww = window.innerWidth, wh = window.innerHeight;
  const sx = ww / LOGICAL_WIDTH, sy = wh / LOGICAL_HEIGHT;
  scale = Math.min(sx, sy);
  const cw = Math.ceil(LOGICAL_WIDTH * scale);
  const ch = Math.ceil(LOGICAL_HEIGHT * scale);
  canvas.width = LOGICAL_WIDTH;
  canvas.height = LOGICAL_HEIGHT;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  ox = (ww - cw) / 2;
  oy = (wh - ch) / 2;
  canvas.style.marginLeft = ox + 'px';
  canvas.style.marginTop = oy + 'px';
}
window.addEventListener('resize', resize);
resize();

function toLogical(cx, cy) {
  return [(cx - ox) / scale, (cy - oy) / scale];
}

const STATE = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAME_OVER: 3 };
let state = STATE.TITLE;

const keys = {};
const justPressed = {};
window.addEventListener('keydown', e => {
  if (!keys[e.key]) justPressed[e.key] = true;
  keys[e.key] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

function isDown(key) { return !!keys[key]; }
function wasPressed(key) { return !!justPressed[key]; }

let touchX = null, touchActive = false;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  const [lx] = toLogical(t.clientX, t.clientY);
  touchX = lx;
  touchActive = true;
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0];
  const [lx] = toLogical(t.clientX, t.clientY);
  touchX = lx;
}, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); touchActive = false; touchX = null; }, { passive: false });
canvas.addEventListener('touchcancel', e => { touchActive = false; touchX = null; });

let player, world, score, bestScore, zoneIndex, coins;
let lastSegment;
let accTime = 0, lastTime = 0;
let entityIdCounter = 0;
let sceneryItems = [];
let scrollOffset = 0;
let zoneNameCounters = {};

/* ---- juice: particles, shake, combo, floaters ---- */
let particles = [];
let floaters = [];
let shake = 0;
let combo = { count: 0, timer: 0, mult: 1 };
let muted = false;
let timeNow = 0; // seconds since boot, for ambient animation

/* deterministic pseudo-random for stable textures (no per-frame flicker) */
function hash01(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function addParticle(p) {
  p.life = p.life ?? 0.5;
  p.maxLife = p.life;
  p.vx = p.vx ?? 0;
  p.vy = p.vy ?? 0;
  p.size = p.size ?? 3;
  p.grav = p.grav ?? 0;
  p.color = p.color ?? 'rgba(200,200,200,0.6)';
  particles.push(p);
}

function addFloater(x, y, text, color) {
  floaters.push({ x, y, text, color: color || '#ffe27a', life: 0.9, maxLife: 0.9 });
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
  for (const f of floaters) { f.y -= 28 * dt; f.life -= dt; }
  floaters = floaters.filter(f => f.life > 0);
  if (shake > 0) shake = Math.max(0, shake - dt * 26);
}

function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    if (p.shape === 'line') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.shrink ? a : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of floaters) {
    const a = Math.min(1, f.life / f.maxLife * 1.4);
    ctx.globalAlpha = a;
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/* ---- weather ---- */
let weather = { type: 'clear', timer: 0, changeTimer: 0, clouds: [], rain: [], snow: [], flash: 0, thunderTimer: 0 };
const WEATHER_TYPES = ['clear', 'cloudy', 'rainy', 'stormy', 'snowy'];

function initWeather() {
  weather = { type: 'clear', timer: 0, changeTimer: 40 + Math.random() * 30, clouds: [], rain: [], snow: [], flash: 0, thunderTimer: 0 };
  for (let i = 0; i < 8; i++) {
    weather.clouds.push({ x: Math.random() * LOGICAL_WIDTH, y: Math.random() * 150, w: 80 + Math.random() * 140, h: 25 + Math.random() * 25, speed: 4 + Math.random() * 10, opacity: 0.15 + Math.random() * 0.3 });
  }
}

function changeWeather() {
  const prev = weather.type;
  const types = WEATHER_TYPES.filter(t => t !== prev || Math.random() < 0.3);
  weather.type = types[Math.floor(Math.random() * types.length)];
  weather.rain = [];
  weather.snow = [];
  if (weather.type === 'rainy' || weather.type === 'stormy') {
    for (let i = 0; i < 250; i++) weather.rain.push({ x: Math.random() * LOGICAL_WIDTH, y: Math.random() * LOGICAL_HEIGHT, speed: 350 + Math.random() * 250, len: 8 + Math.random() * 12 });
  }
  if (weather.type === 'snowy') {
    for (let i = 0; i < 180; i++) weather.snow.push({ x: Math.random() * LOGICAL_WIDTH, y: Math.random() * LOGICAL_HEIGHT, speed: 30 + Math.random() * 50, size: 2 + Math.random() * 4, drift: (Math.random() - 0.5) * 15 });
  }
  if (weather.type === 'cloudy' || weather.type === 'rainy' || weather.type === 'stormy') {
    if (weather.clouds.length < 8) {
      for (let i = weather.clouds.length; i < 10; i++) weather.clouds.push({ x: Math.random() * LOGICAL_WIDTH, y: Math.random() * 150, w: 80 + Math.random() * 140, h: 25 + Math.random() * 25, speed: 4 + Math.random() * 10, opacity: 0.15 + Math.random() * 0.3 });
    }
    for (const c of weather.clouds) c.opacity = Math.min(0.6, c.opacity + 0.2);
  } else if (prev === 'cloudy' || prev === 'rainy' || prev === 'stormy') {
    for (const c of weather.clouds) c.opacity = Math.max(0.1, c.opacity - 0.15);
  }
  weather.changeTimer = 25 + Math.random() * 35;
}

function updateWeather(dt) {
  if (state !== STATE.PLAYING) return;
  weather.timer += dt;
  weather.changeTimer -= dt;
  if (weather.flash > 0) weather.flash -= dt;
  if (weather.thunderTimer > 0) weather.thunderTimer -= dt;
  if (weather.changeTimer <= 0) changeWeather();
  for (const c of weather.clouds) {
    c.x += c.speed * dt;
    if (c.x > LOGICAL_WIDTH + c.w) c.x = -c.w;
  }
  for (const r of weather.rain) {
    r.y += r.speed * dt;
    r.x -= 25 * dt;
    if (r.y > LOGICAL_HEIGHT + 10) { r.y = -10; r.x = Math.random() * LOGICAL_WIDTH; }
  }
  for (const s of weather.snow) {
    s.y += s.speed * dt;
    s.x += s.drift * dt;
    if (s.y > LOGICAL_HEIGHT + 10) { s.y = -10; s.x = Math.random() * LOGICAL_WIDTH; s.drift = (Math.random() - 0.5) * 15; }
  }
  if (weather.type === 'stormy' && weather.flash <= 0 && Math.random() < 0.003) {
    weather.flash = 0.08 + Math.random() * 0.12;
    weather.thunderTimer = 0.4;
    sfx.thunder();
  }
}

function drawWeather() {
  if (state === STATE.TITLE || state === STATE.GAME_OVER) return;
  if (weather.type === 'clear') return;

  if (weather.type === 'cloudy' || weather.type === 'rainy' || weather.type === 'stormy') {
    for (const c of weather.clouds) {
      ctx.fillStyle = `rgba(160,165,175,${c.opacity})`;
      ctx.beginPath();
      ctx.ellipse(c.x + c.w / 2, c.y + c.h * 0.4, c.w * 0.45, c.h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(180,185,195,${c.opacity * 0.7})`;
      ctx.beginPath();
      ctx.ellipse(c.x + c.w * 0.65, c.y + c.h * 0.55, c.w * 0.3, c.h * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(175,180,190,${c.opacity * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(c.x + c.w * 0.3, c.y + c.h * 0.6, c.w * 0.25, c.h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (weather.type === 'rainy' || weather.type === 'stormy') {
    ctx.strokeStyle = 'rgba(160,190,220,0.35)';
    ctx.lineWidth = 1.5;
    for (const r of weather.rain) {
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - 3, r.y + r.len);
      ctx.stroke();
    }
  }

  if (weather.type === 'snowy') {
    for (const s of weather.snow) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(s.x * s.y) * 0.15 + 0.15})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (weather.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, weather.flash * 5)})`;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }
}

function getZoneName(zone) {
  const names = zone.names || [zone.id];
  const idx = zoneNameCounters[zone.id] || 0;
  return names[idx % names.length];
}

function initGame() {
  const zone = ZONES[0];
  const roadLeft = (LOGICAL_WIDTH - zone.roadWidth) / 2;
  player = {
    x: LOGICAL_WIDTH / 2 - BIKE_WIDTH / 2,
    y: PLAYER_Y,
    vx: 0,
    lives: LIVES,
    invulnTimer: 0,
    speedMult: 1.0,
    offroad: false,
    hopTimer: 0,
    hopHeight: 0,
    airTimer: 0,
    airHeight: 0,
    trickCount: 0,
    rampCooldown: 0,
    lean: 0,
    wheelRot: 0,
    pedal: 0,
    boostTimer: 0,
    spinDir: 0,
    spinAccum: 0,
  };
  world = { distance: 0, zoneDistance: 0, entities: [] };
  score = 0;
  coins = 0;
  zoneIndex = 0;
  lastSegment = -1;
  entityIdCounter = 0;
  sceneryItems = [];
  scrollOffset = 0;
  zoneNameCounters = {};
  particles = [];
  floaters = [];
  shake = 0;
  combo = { count: 0, timer: 0, mult: 1 };
  player.boostTimer = 0;
  initWeather();
  bestScore = loadBest();
}

function loadBest() {
  try { return parseInt(localStorage.getItem('papertrail_best')) || 0; } catch { return 0; }
}
function saveBest(s) {
  try { localStorage.setItem('papertrail_best', String(s)); } catch {}}
function spawnEntity(e) {
  e.id = entityIdCounter++;
  world.entities.push(e);
}

function pickWeighted(table) {
  const total = table.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of table) { r -= o.weight; if (r <= 0) return o; }
  return table[table.length - 1];
}

function scenerySize(kind) {
  const sizes = {
    pine: [35, 85], bush: [40, 30], stump: [30, 20],
    house: [70, 60], tree: [35, 85], fence: [50, 24], lamp: [10, 60],
    building: [60, 100], sign: [30, 50], planter: [36, 24],
    barrel: [30, 35], pipe: [60, 20], gravel_pile: [40, 24],
    pond: [60, 40],
  };
  const s = sizes[kind] || [40, 40];
  return [s[0] + (Math.random() - 0.5) * s[0] * 0.4, s[1] + (Math.random() - 0.5) * s[1] * 0.3];
}

function generateScenerySegment() {
  const zone = ZONES[zoneIndex];
  if (!zone.sceneryTable || zone.sceneryTable.length === 0) return;
  const roadLeft = (LOGICAL_WIDTH - zone.roadWidth) / 2;
  const roadRight = roadLeft + zone.roadWidth;
  if (Math.random() < zone.sceneryDensity) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side === -1
      ? 10 + Math.random() * (roadLeft - 60)
      : roadRight + 20 + Math.random() * (LOGICAL_WIDTH - roadRight - 80);
    const pick = pickWeighted(zone.sceneryTable);
    const [w, h] = scenerySize(pick.kind);
    sceneryItems.push({ x, y: -SEGMENT_LENGTH - Math.random() * 100, kind: pick.kind, h, w, seed: Math.floor(Math.random() * 9999), side });
  }
}

function spawnSegment(segIndex) {
  const zone = ZONES[zoneIndex];
  const roadLeft = (LOGICAL_WIDTH - zone.roadWidth) / 2;
  const roadRight = roadLeft + zone.roadWidth;
  const baseY = -SEGMENT_LENGTH - 50;

  if (Math.random() < zone.coinChance) {
    const count = 3 + Math.floor(Math.random() * 3);
    const startX = roadLeft + 40 + Math.random() * (zone.roadWidth - 80 - count * 30);
    for (let i = 0; i < count; i++) {
      spawnEntity({
        type: 'coin', kind: 'coin',
        x: startX + i * 30, y: baseY + i * 25,
        w: 20, h: 20, collidable: false, value: COIN_POINTS,
        decorative: false, state: 0,
      });
    }
  }

  if (Math.random() < zone.obstacleDensity) {
    const table = zone.obstacleTable;
    const totalW = table.reduce((s, o) => s + o.weight, 0);
    const count = 1 + Math.floor(Math.random() * 2);
    const placements = [];
    const movers = [];
    for (let a = 0; a < 20 && placements.length + movers.length < count; a++) {
      let r = Math.random() * totalW, sum = 0;
      let chosen = table[0];
      for (const o of table) { sum += o.weight; if (r <= sum) { chosen = o; break; } }
      if (chosen.clearance === 'moving') {
        // telegraphed road-crosser: enters from a shoulder and traverses
        const fromLeft = Math.random() < 0.5;
        movers.push({
          kind: chosen.kind, clearance: 'moving',
          x: fromLeft ? roadLeft - 30 : roadRight + 30 - chosen.w,
          y: baseY + 20 + Math.random() * (SEGMENT_LENGTH - chosen.h - 40),
          w: chosen.w, h: chosen.h,
          velX: (fromLeft ? 1 : -1) * (chosen.speed || 120),
        });
        continue;
      }
      const ox = roadLeft + 20 + Math.random() * (zone.roadWidth - chosen.w - 40);
      const oy = baseY + 20 + Math.random() * (SEGMENT_LENGTH - chosen.h - 40);
      let ok = true;
      for (const p of placements) {
        if (Math.abs(p.x - ox) < GAP_MIN + chosen.w) { ok = false; break; }
      }
      if (ok) placements.push({ kind: chosen.kind, clearance: chosen.clearance, x: ox, y: oy, w: chosen.w, h: chosen.h });
    }
    const gapStart = roadLeft + 20 + Math.random() * (zone.roadWidth - GAP_MIN - 40);
    const gapEnd = gapStart + GAP_MIN;
    const filtered = placements.filter(p => p.x + p.w < gapStart || p.x > gapEnd);
    if (filtered.length === 0 && placements.length > 0) {
      const last = placements[placements.length - 1];
      last.x = roadRight - last.w - 10;
      filtered.push(last);
    }
    for (const p of filtered) {
      spawnEntity({
        type: 'obstacle', kind: p.kind, clearance: p.clearance,
        x: p.x, y: p.y, w: p.w, h: p.h,
        collidable: true, decorative: false, state: 0,
      });
    }
    for (const m of movers) {
      spawnEntity({
        type: 'obstacle', kind: m.kind, clearance: 'moving',
        x: m.x, y: m.y, w: m.w, h: m.h, velX: m.velX,
        collidable: true, decorative: false, state: Math.random() * 6,
      });
    }
  }

  if (Math.random() < (zone.boostChance || 0)) {
    const bx = roadLeft + 30 + Math.random() * (zone.roadWidth - 70);
    spawnEntity({
      type: 'boost', kind: 'boost',
      x: bx, y: baseY + Math.random() * SEGMENT_LENGTH,
      w: 26, h: 26, collidable: false, decorative: false, state: 0,
    });
  }

  if (Math.random() < zone.rampChance) {
    const rw = 100, rh = 28;
    const rx = roadLeft + 20 + Math.random() * (zone.roadWidth - rw - 40);
    spawnEntity({
      type: 'ramp', kind: 'ramp',
      x: rx, y: baseY + 20 + Math.random() * (SEGMENT_LENGTH - rh - 40),
      w: rw, h: rh,
      collidable: false, decorative: false, state: 0,
    });
  }

  if (Math.random() < 0.2) {
    const cx = roadLeft + 30 + Math.random() * (zone.roadWidth - 60);
    const bikeColors = ['#5588cc','#66aa44','#cc6633','#aa44aa','#cc4444','#44aaaa','#cc8833','#6688dd'];
    spawnEntity({
      type: 'obstacle', kind: 'cyclist', clearance: 'moving',
      x: cx, y: baseY + Math.random() * SEGMENT_LENGTH,
      w: 36, h: 48,
      collidable: false, decorative: true, state: 0,
      velY: 40 + Math.random() * 50,
      lean: (Math.random() - 0.5) * 0.4,
      bikeColor: bikeColors[Math.floor(Math.random() * bikeColors.length)],
      riderColor: ['#cc6644','#4488cc','#66cc44','#cc4488'][Math.floor(Math.random() * 4)],
    });
  }
}

function getPlayerBox() {
  const cx = player.x + BIKE_WIDTH / 2;
  const cy = player.y + BIKE_HEIGHT / 2;
  const s = 6;
  return {
    x: cx - BIKE_WIDTH / 2 + s,
    y: cy - BIKE_HEIGHT / 2 + s,
    w: BIKE_WIDTH - s * 2,
    h: BIKE_HEIGHT - s * 2,
  };
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* ---- drawing ---- */
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shade(hex, amt) {
  // amt -1..1; lighten/darken a #rrggbb
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function drawGroundSide(x0, w, baseColor, zoneId) {
  // textured verge that scrolls with the world for a grounded feel
  const grad = ctx.createLinearGradient(x0, 0, x0 + w, 0);
  grad.addColorStop(0, shade(baseColor, -0.12));
  grad.addColorStop(0.5, baseColor);
  grad.addColorStop(1, shade(baseColor, 0.06));
  ctx.fillStyle = grad;
  ctx.fillRect(x0, 0, w, LOGICAL_HEIGHT);

  // scrolling tonal bands give a sense of motion on the verge
  const period = 64;
  const off = scrollOffset % period;
  ctx.fillStyle = shade(baseColor, -0.08);
  for (let y = -period + off; y < LOGICAL_HEIGHT; y += period) {
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x0, y, w, period * 0.5);
  }
  ctx.globalAlpha = 1;
}

function drawRoad() {
  const zone = ZONES[zoneIndex];
  const pal = zone.palette;
  const roadLeft = (LOGICAL_WIDTH - zone.roadWidth) / 2;
  const roadRight = roadLeft + zone.roadWidth;
  const shoulderL = roadLeft - SHOULDER_WIDTH;
  const shoulderR = roadRight + SHOULDER_WIDTH;

  /* far scenery ground with vertical depth gradient */
  const bgGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
  bgGrad.addColorStop(0, shade(pal.bg, -0.18));
  bgGrad.addColorStop(0.35, pal.bg);
  bgGrad.addColorStop(1, shade(pal.bg, 0.05));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  /* shoulder verges (grass/dirt) */
  drawGroundSide(shoulderL, roadLeft - shoulderL + 2, pal.shoulder, zone.id);
  drawGroundSide(roadRight - 2, shoulderR - roadRight + 2, pal.shoulder, zone.id);

  /* road surface with subtle cross gradient (lit centre, shaded edges) */
  const rGrad = ctx.createLinearGradient(roadLeft, 0, roadRight, 0);
  rGrad.addColorStop(0, shade(pal.road, -0.16));
  rGrad.addColorStop(0.5, shade(pal.road, 0.05));
  rGrad.addColorStop(1, shade(pal.road, -0.16));
  ctx.fillStyle = rGrad;
  ctx.fillRect(roadLeft, 0, zone.roadWidth, LOGICAL_HEIGHT);

  /* scrolling surface speckle / cracks (deterministic, no flicker) */
  ctx.fillStyle = shade(pal.road, -0.22);
  const period = 220;
  const off = scrollOffset % period;
  for (let i = 0; i < 46; i++) {
    const sy = ((hash01(i * 3.3) * period) - off + period * 4) % (LOGICAL_HEIGHT + period) - period;
    const sx = roadLeft + 14 + hash01(i * 7.7) * (zone.roadWidth - 28);
    const sw = 2 + hash01(i * 1.9) * 5;
    ctx.globalAlpha = 0.25 + hash01(i) * 0.2;
    ctx.fillRect(sx, sy, sw, sw + hash01(i * 5) * 14);
  }
  ctx.globalAlpha = 1;

  /* curbs: shadowed inner edge + bright lip */
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(roadLeft + 3, 0); ctx.lineTo(roadLeft + 3, LOGICAL_HEIGHT);
  ctx.moveTo(roadRight - 3, 0); ctx.lineTo(roadRight - 3, LOGICAL_HEIGHT);
  ctx.stroke();
  ctx.strokeStyle = shade(pal.edge, 0.25);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(roadLeft, 0); ctx.lineTo(roadLeft, LOGICAL_HEIGHT);
  ctx.moveTo(roadRight, 0); ctx.lineTo(roadRight, LOGICAL_HEIGHT);
  ctx.stroke();

  /* animated dashed centre line (scrolls with the world) */
  ctx.strokeStyle = pal.roadLine;
  ctx.lineWidth = 5;
  ctx.lineCap = 'butt';
  ctx.setLineDash([30, 34]);
  ctx.lineDashOffset = -scrollOffset;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(LOGICAL_WIDTH / 2, 0);
  ctx.lineTo(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT);
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* solid lane edge lines just inside the curbs */
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.strokeStyle = shade(pal.roadLine, 0.05);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(roadLeft + 16, 0); ctx.lineTo(roadLeft + 16, LOGICAL_HEIGHT);
  ctx.moveTo(roadRight - 16, 0); ctx.lineTo(roadRight - 16, LOGICAL_HEIGHT);
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* warning hatch on the shoulder boundary */
  ctx.strokeStyle = 'rgba(255,200,100,0.14)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 14]);
  ctx.lineDashOffset = -scrollOffset;
  ctx.beginPath();
  ctx.moveTo(shoulderL, 0); ctx.lineTo(shoulderL, LOGICAL_HEIGHT);
  ctx.moveTo(shoulderR, 0); ctx.lineTo(shoulderR, LOGICAL_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

function groundShadow(cx, cy, rx, ry, alpha) {
  ctx.fillStyle = `rgba(0,0,0,${alpha ?? 0.22})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawScenery() {
  for (const s of sceneryItems) {
    if (s.y + s.h < -50 || s.y > LOGICAL_HEIGHT + 50) continue;
    ctx.save();
    const cx = s.x + s.w / 2;
    switch (s.kind) {
      case 'pine': {
        groundShadow(cx + 6, s.y + s.h * 0.96, s.w * 0.5, s.h * 0.08, 0.22);
        ctx.fillStyle = '#3a2a18';
        ctx.fillRect(cx - 3, s.y + s.h * 0.78, 6, s.h * 0.24);
        // three stacked tiers, dark to light
        const tiers = [[0.0, 0.5, '#1f4a22'], [0.22, 0.62, '#2c5e2c'], [0.46, 0.78, '#367236']];
        for (const [ty, by, col] of tiers) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(cx, s.y + s.h * ty);
          ctx.lineTo(s.x + s.w * 0.06, s.y + s.h * by);
          ctx.lineTo(s.x + s.w * 0.94, s.y + s.h * by);
          ctx.closePath();
          ctx.fill();
        }
        // sun-side highlight
        ctx.fillStyle = 'rgba(150,200,120,0.25)';
        ctx.beginPath();
        ctx.moveTo(cx, s.y + s.h * 0.05);
        ctx.lineTo(cx - s.w * 0.18, s.y + s.h * 0.5);
        ctx.lineTo(cx, s.y + s.h * 0.5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'tree': {
        groundShadow(cx + 6, s.y + s.h * 0.94, s.w * 0.55, s.h * 0.08, 0.22);
        ctx.fillStyle = '#5a4028';
        ctx.fillRect(cx - 4, s.y + s.h * 0.6, 8, s.h * 0.4);
        ctx.fillStyle = '#4a3320';
        ctx.fillRect(cx + 1, s.y + s.h * 0.6, 3, s.h * 0.4);
        // layered canopy blobs
        const blobs = [[0, 0.3, 0.52, '#2f5e24'], [-0.22, 0.42, 0.32, '#3a7030'], [0.24, 0.4, 0.3, '#356a2c'], [0.02, 0.22, 0.38, '#45824a']];
        for (const [dx, dy, r, col] of blobs) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(cx + s.w * dx, s.y + s.h * dy, s.w * r, s.h * r * 0.62, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(180,220,150,0.3)';
        ctx.beginPath();
        ctx.ellipse(cx - s.w * 0.16, s.y + s.h * 0.24, s.w * 0.16, s.h * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'bush': {
        groundShadow(cx + 4, s.y + s.h * 0.92, s.w * 0.55, s.h * 0.18, 0.2);
        const blobs = [[0, 0.55, 0.5, '#2f5e26'], [-0.26, 0.5, 0.3, '#387030'], [0.28, 0.52, 0.28, '#35692c'], [0.05, 0.36, 0.32, '#46824a']];
        for (const [dx, dy, r, col] of blobs) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(cx + s.w * dx, s.y + s.h * dy, s.w * r, s.h * r * 0.85, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // berries / flecks
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = 'rgba(200,230,160,0.5)';
          ctx.beginPath();
          ctx.arc(s.x + hash01(s.seed + i) * s.w, s.y + s.h * 0.3 + hash01(s.seed + i * 2) * s.h * 0.4, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'stump':
        groundShadow(cx + 3, s.y + s.h * 0.7, s.w * 0.55, s.h * 0.3, 0.2);
        ctx.fillStyle = '#5a3a24';
        ctx.beginPath();
        ctx.ellipse(cx, s.y + s.h * 0.55, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a5636';
        ctx.beginPath();
        ctx.ellipse(cx, s.y + s.h * 0.42, s.w * 0.4, s.h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5a3a24';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(cx, s.y + s.h * 0.42, s.w * 0.4 * i / 3, s.h * 0.3 * i / 3, 0, 0, Math.PI * 2); ctx.stroke(); }
        break;
      case 'house': {
        groundShadow(cx + 8, s.y + s.h * 0.98, s.w * 0.6, s.h * 0.08, 0.25);
        const wallGrad = ctx.createLinearGradient(s.x, 0, s.x + s.w, 0);
        const wallCol = ['#d8bd97', '#c9d2c0', '#e0c0a8', '#bcd0d8'][s.seed % 4];
        wallGrad.addColorStop(0, shade(wallCol, -0.12));
        wallGrad.addColorStop(0.5, wallCol);
        wallGrad.addColorStop(1, shade(wallCol, -0.2));
        ctx.fillStyle = wallGrad;
        ctx.fillRect(s.x, s.y + s.h * 0.32, s.w, s.h * 0.68);
        // roof
        const roofCol = ['#8a3a2a', '#5a6a7a', '#7a5a3a', '#6a4a5a'][s.seed % 4];
        ctx.fillStyle = roofCol;
        ctx.beginPath();
        ctx.moveTo(s.x - 6, s.y + s.h * 0.34);
        ctx.lineTo(cx, s.y);
        ctx.lineTo(s.x + s.w + 6, s.y + s.h * 0.34);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shade(roofCol, 0.18);
        ctx.beginPath();
        ctx.moveTo(cx, s.y);
        ctx.lineTo(s.x + s.w + 6, s.y + s.h * 0.34);
        ctx.lineTo(cx, s.y + s.h * 0.34);
        ctx.closePath();
        ctx.fill();
        // chimney
        ctx.fillStyle = shade(roofCol, -0.2);
        ctx.fillRect(s.x + s.w * 0.7, s.y + s.h * 0.06, s.w * 0.12, s.h * 0.2);
        // windows (lit warm)
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(s.x + s.w * 0.14, s.y + s.h * 0.46, s.w * 0.24, s.h * 0.22);
        ctx.fillRect(s.x + s.w * 0.62, s.y + s.h * 0.46, s.w * 0.24, s.h * 0.22);
        ctx.strokeStyle = shade(wallCol, -0.35);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(s.x + s.w * 0.14, s.y + s.h * 0.46, s.w * 0.24, s.h * 0.22);
        ctx.strokeRect(s.x + s.w * 0.62, s.y + s.h * 0.46, s.w * 0.24, s.h * 0.22);
        ctx.beginPath();
        ctx.moveTo(s.x + s.w * 0.26, s.y + s.h * 0.46); ctx.lineTo(s.x + s.w * 0.26, s.y + s.h * 0.68);
        ctx.moveTo(s.x + s.w * 0.74, s.y + s.h * 0.46); ctx.lineTo(s.x + s.w * 0.74, s.y + s.h * 0.68);
        ctx.stroke();
        // door
        ctx.fillStyle = '#5a3a26';
        ctx.fillRect(s.x + s.w * 0.42, s.y + s.h * 0.72, s.w * 0.16, s.h * 0.28);
        ctx.fillStyle = '#e0c060';
        ctx.beginPath(); ctx.arc(s.x + s.w * 0.55, s.y + s.h * 0.86, 1.6, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'fence':
        ctx.fillStyle = '#9a8a64';
        ctx.fillRect(s.x, s.y + s.h * 0.8, s.w, 4);
        ctx.fillRect(s.x, s.y + s.h * 0.3, s.w, 4);
        for (let i = 0; i < Math.floor(s.w / 12); i++) {
          ctx.fillStyle = i % 2 ? '#9a8a64' : '#8a7a54';
          ctx.fillRect(s.x + 4 + i * 12, s.y, 4, s.h);
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(s.x + 4 + i * 12, s.y, 1.5, s.h);
        }
        break;
      case 'lamp':
        groundShadow(cx + 4, s.y + s.h * 0.99, 10, 3, 0.18);
        ctx.fillStyle = '#4a4a52';
        ctx.fillRect(cx - 2.5, s.y + s.h * 0.12, 5, s.h * 0.88);
        ctx.fillStyle = '#5a5a64';
        ctx.fillRect(cx - 2.5, s.y + s.h * 0.12, 2, s.h * 0.88);
        ctx.fillStyle = '#3a3a42';
        ctx.fillRect(cx - 6, s.y + s.h * 0.1, 12, 4);
        // glow
        const lg = ctx.createRadialGradient(cx, s.y + s.h * 0.1, 1, cx, s.y + s.h * 0.1, 26);
        lg.addColorStop(0, 'rgba(255,225,140,0.85)');
        lg.addColorStop(1, 'rgba(255,225,140,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.arc(cx, s.y + s.h * 0.1, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff0b0';
        ctx.beginPath(); ctx.arc(cx, s.y + s.h * 0.1, 5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'building': {
        groundShadow(cx + 8, s.y + s.h * 0.99, s.w * 0.6, s.h * 0.04, 0.25);
        const bcol = ['#6a6a7e', '#70687a', '#5e6a78', '#74707e'][s.seed % 4];
        const bg = ctx.createLinearGradient(s.x, 0, s.x + s.w, 0);
        bg.addColorStop(0, shade(bcol, 0.08));
        bg.addColorStop(1, shade(bcol, -0.22));
        ctx.fillStyle = bg;
        ctx.fillRect(s.x, s.y, s.w, s.h);
        // parapet
        ctx.fillStyle = shade(bcol, 0.18);
        ctx.fillRect(s.x - 2, s.y, s.w + 4, 6);
        // window grid, some lit
        const cols = Math.max(2, Math.floor(s.w / 16));
        const rows = Math.max(3, Math.floor(s.h / 22));
        const gw = (s.w - 8) / cols, gh = (s.h - 16) / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const lit = hash01(s.seed + r * 7 + c * 13) > 0.55;
            ctx.fillStyle = lit ? '#ffe7a0' : '#2c3242';
            ctx.fillRect(s.x + 5 + c * gw, s.y + 11 + r * gh, gw * 0.62, gh * 0.6);
          }
        }
        break;
      }
      case 'sign':
        ctx.fillStyle = '#52525a';
        ctx.fillRect(cx - 2.5, s.y + s.h * 0.35, 5, s.h * 0.65);
        ctx.fillStyle = ['#d04848', '#3a8acc', '#cc8a2a', '#3aa06a'][s.seed % 4];
        roundRect(s.x, s.y, s.w, s.h * 0.46, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(s.x + s.w * 0.2, s.y + s.h * 0.14, s.w * 0.6, 3);
        ctx.fillRect(s.x + s.w * 0.2, s.y + s.h * 0.26, s.w * 0.45, 3);
        break;
      case 'planter':
        groundShadow(cx + 3, s.y + s.h * 0.96, s.w * 0.55, s.h * 0.12, 0.18);
        ctx.fillStyle = '#7a6a54';
        roundRect(s.x, s.y + s.h * 0.5, s.w, s.h * 0.5, 4); ctx.fill();
        ctx.fillStyle = '#8a7a64';
        ctx.fillRect(s.x, s.y + s.h * 0.5, s.w, 4);
        for (const [dx, dy, r] of [[0, 0.42, 0.34], [-0.24, 0.4, 0.22], [0.24, 0.4, 0.22]]) {
          ctx.fillStyle = dx === 0 ? '#46824a' : '#357030';
          ctx.beginPath();
          ctx.ellipse(cx + s.w * dx, s.y + s.h * dy, s.w * r, s.h * r, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#e88aa0';
        ctx.beginPath(); ctx.arc(cx, s.y + s.h * 0.32, 2.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'barrel':
        groundShadow(cx + 3, s.y + s.h * 0.92, s.w * 0.5, s.h * 0.16, 0.2);
        {
          const bgr = ctx.createLinearGradient(s.x, 0, s.x + s.w, 0);
          bgr.addColorStop(0, '#b85426'); bgr.addColorStop(0.5, '#e07a3a'); bgr.addColorStop(1, '#9a4420');
          ctx.fillStyle = bgr;
          roundRect(s.x, s.y, s.w, s.h, 4); ctx.fill();
        }
        ctx.fillStyle = '#f0f0e0';
        ctx.fillRect(s.x, s.y + s.h * 0.28, s.w, s.h * 0.12);
        ctx.fillRect(s.x, s.y + s.h * 0.6, s.w, s.h * 0.12);
        break;
      case 'pipe':
        groundShadow(cx, s.y + s.h * 0.92, s.w * 0.5, s.h * 0.25, 0.2);
        {
          const pg = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
          pg.addColorStop(0, '#a89a86'); pg.addColorStop(0.5, '#8a7a66'); pg.addColorStop(1, '#5a4d3e');
          ctx.fillStyle = pg;
          roundRect(s.x, s.y, s.w, s.h, s.h / 2); ctx.fill();
        }
        ctx.fillStyle = '#4a3f32';
        ctx.beginPath(); ctx.ellipse(s.x + s.h / 2, s.y + s.h / 2, s.h * 0.32, s.h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'gravel_pile':
        groundShadow(cx, s.y + s.h * 0.95, s.w * 0.55, s.h * 0.18, 0.2);
        ctx.fillStyle = '#8a7a5a';
        ctx.beginPath();
        ctx.moveTo(cx, s.y);
        ctx.lineTo(s.x, s.y + s.h);
        ctx.lineTo(s.x + s.w, s.y + s.h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,240,200,0.25)';
        ctx.beginPath();
        ctx.moveTo(cx, s.y); ctx.lineTo(cx - s.w * 0.2, s.y + s.h); ctx.lineTo(cx, s.y + s.h); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = i % 2 ? '#9a8a6a' : '#6f6044';
          ctx.beginPath();
          ctx.arc(s.x + 4 + hash01(s.seed + i) * (s.w - 8), s.y + s.h * 0.4 + hash01(s.seed + i * 3) * (s.h * 0.55), 2 + hash01(s.seed + i * 5) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'pond': {
        const pg = ctx.createRadialGradient(cx, s.y + s.h * 0.5, 2, cx, s.y + s.h * 0.5, s.w / 2);
        pg.addColorStop(0, '#5fa0c0'); pg.addColorStop(1, '#356a8a');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.ellipse(cx, s.y + s.h * 0.5, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a5068'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, s.y + s.h * 0.5, s.w / 2, s.h / 2, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(cx - s.w * 0.18, s.y + s.h * 0.36, s.w * 0.18, s.h * 0.1, -0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        ctx.fillStyle = '#3a5a2a';
        ctx.beginPath();
        ctx.ellipse(cx, s.y + s.h * 0.5, s.w / 2, s.h * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
  }
}

function drawEntity(e) {
  if (e.y + e.h < -50 || e.y > LOGICAL_HEIGHT + 50) return;
  ctx.save();
  if (e.type === 'coin') {
    // spinning gold coin (width oscillates to fake rotation)
    const spin = Math.abs(Math.cos(e.state * 4));
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const rx = Math.max(2, e.w / 2 * spin);
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, e.w);
    glow.addColorStop(0, 'rgba(255,210,90,0.5)');
    glow.addColorStop(1, 'rgba(255,210,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, e.w, 0, Math.PI * 2); ctx.fill();
    const cg = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    cg.addColorStop(0, '#c89020'); cg.addColorStop(0.5, '#ffe070'); cg.addColorStop(1, '#c89020');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    if (rx > 5) {
      ctx.strokeStyle = '#fff2c0'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.6, e.h * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (e.type === 'boost') {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const pulse = Math.sin(e.state * 6) * 0.2 + 0.9;
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, e.w * pulse);
    glow.addColorStop(0, 'rgba(120,230,255,0.7)');
    glow.addColorStop(1, 'rgba(120,230,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, e.w * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy - 11);
    ctx.lineTo(cx - 7, cy + 2);
    ctx.lineTo(cx - 1, cy + 2);
    ctx.lineTo(cx - 5, cy + 11);
    ctx.lineTo(cx + 8, cy - 3);
    ctx.lineTo(cx + 1, cy - 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3aa6d0'; ctx.lineWidth = 1.4; ctx.stroke();
  } else if (e.type === 'obstacle') {
    // grounded contact shadow under every obstacle
    if (e.clearance !== 'low') groundShadow(e.x + e.w / 2 + 4, e.y + e.h - 2, e.w * 0.52, e.h * 0.18, 0.22);
    const facing = (e.velX || 0) < 0 ? -1 : 1;
    switch (e.kind) {
      case 'log': {
        const lg = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
        lg.addColorStop(0, '#8a6038'); lg.addColorStop(0.5, '#6a4628'); lg.addColorStop(1, '#4a3018');
        ctx.fillStyle = lg;
        roundRect(e.x, e.y, e.w, e.h, e.h / 2); ctx.fill();
        // end rings
        ctx.fillStyle = '#7a5634';
        ctx.beginPath(); ctx.ellipse(e.x + e.h / 2, e.y + e.h / 2, e.h * 0.32, e.h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9a7448';
        ctx.beginPath(); ctx.ellipse(e.x + e.h / 2, e.y + e.h / 2, e.h * 0.18, e.h * 0.24, 0, 0, Math.PI * 2); ctx.fill();
        // bark lines
        ctx.strokeStyle = 'rgba(60,40,20,0.6)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(e.x + e.h + i * (e.w / 5), e.y + 4);
          ctx.lineTo(e.x + e.h + i * (e.w / 5), e.y + e.h - 4);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,230,180,0.18)';
        ctx.fillRect(e.x + e.h, e.y + 3, e.w - e.h - 6, 3);
        break;
      }
      case 'rock': {
        const rg = ctx.createRadialGradient(e.x + e.w * 0.38, e.y + e.h * 0.34, 2, e.x + e.w / 2, e.y + e.h / 2, e.w * 0.6);
        rg.addColorStop(0, '#9a9a9a'); rg.addColorStop(1, '#565660');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(e.x + e.w * 0.5, e.y);
        ctx.lineTo(e.x + e.w, e.y + e.h * 0.4);
        ctx.lineTo(e.x + e.w * 0.78, e.y + e.h);
        ctx.lineTo(e.x + e.w * 0.2, e.y + e.h);
        ctx.lineTo(e.x, e.y + e.h * 0.45);
        ctx.closePath();
        ctx.fill();
        // facets
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(e.x + e.w * 0.5, e.y); ctx.lineTo(e.x + e.w * 0.5, e.y + e.h * 0.5); ctx.lineTo(e.x, e.y + e.h * 0.45); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.moveTo(e.x + e.w * 0.5, e.y + e.h * 0.5); ctx.lineTo(e.x + e.w * 0.78, e.y + e.h); ctx.lineTo(e.x + e.w * 0.2, e.y + e.h); ctx.closePath(); ctx.fill();
        break;
      }
      case 'puddle':
        ctx.fillStyle = 'rgba(20,40,55,0.55)';
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(120,170,200,0.45)';
        ctx.beginPath();
        ctx.ellipse(e.x + e.w * 0.4, e.y + e.h * 0.38, e.w / 4, e.h / 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,190,215,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2 - 2, e.h / 2 - 2, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'car':
        drawCar(e, '#c63a3a', '#8a2424');
        break;
      case 'taxi':
        drawCar(e, '#f0c020', '#caa010', true);
        break;
      case 'bin': {
        const bg = ctx.createLinearGradient(e.x, 0, e.x + e.w, 0);
        bg.addColorStop(0, '#3f6a3f'); bg.addColorStop(0.5, '#5a8a5a'); bg.addColorStop(1, '#345a34');
        ctx.fillStyle = bg;
        roundRect(e.x, e.y + 4, e.w, e.h - 4, 5); ctx.fill();
        ctx.fillStyle = '#2f4f2f';
        roundRect(e.x - 2, e.y, e.w + 4, 8, 3); ctx.fill();
        ctx.fillStyle = '#6a9a6a';
        ctx.fillRect(e.x + 5, e.y + 12, 3, e.h - 18);
        ctx.fillRect(e.x + e.w - 8, e.y + 12, 3, e.h - 18);
        break;
      }
      case 'cone': {
        const cg = ctx.createLinearGradient(e.x, 0, e.x + e.w, 0);
        cg.addColorStop(0, '#d05a16'); cg.addColorStop(0.5, '#ff8a3a'); cg.addColorStop(1, '#c0500e');
        ctx.fillStyle = '#b85010';
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h, e.w * 0.6, e.h * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(e.x + e.w / 2, e.y);
        ctx.lineTo(e.x + 2, e.y + e.h);
        ctx.lineTo(e.x + e.w - 2, e.y + e.h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(e.x + e.w * 0.32, e.y + e.h * 0.4); ctx.lineTo(e.x + e.w * 0.68, e.y + e.h * 0.4); ctx.lineTo(e.x + e.w * 0.74, e.y + e.h * 0.56); ctx.lineTo(e.x + e.w * 0.26, e.y + e.h * 0.56); ctx.closePath(); ctx.fill();
        break;
      }
      case 'barrier': {
        const bg = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
        bg.addColorStop(0, '#ff7a30'); bg.addColorStop(1, '#d04a14');
        ctx.fillStyle = bg;
        roundRect(e.x, e.y, e.w, e.h, 3); ctx.fill();
        // diagonal hazard stripes
        ctx.save();
        roundRect(e.x, e.y, e.w, e.h, 3); ctx.clip();
        ctx.fillStyle = '#f4f0e4';
        for (let i = -e.h; i < e.w; i += 22) {
          ctx.beginPath();
          ctx.moveTo(e.x + i, e.y + e.h); ctx.lineTo(e.x + i + 11, e.y + e.h);
          ctx.lineTo(e.x + i + 11 + e.h, e.y); ctx.lineTo(e.x + i + e.h, e.y);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        // legs
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(e.x + 6, e.y + e.h, 5, 6);
        ctx.fillRect(e.x + e.w - 11, e.y + e.h, 5, 6);
        break;
      }
      case 'mixer': {
        const mg = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
        mg.addColorStop(0, '#f0a83a'); mg.addColorStop(1, '#b06a18');
        ctx.fillStyle = mg;
        roundRect(e.x, e.y, e.w, e.h, 6); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(e.x, e.y + e.h * 0.5, e.w, 4);
        // drum
        const dg = ctx.createRadialGradient(e.x + e.w * 0.42, e.y + e.h * 0.4, 3, e.x + e.w / 2, e.y + e.h / 2, e.w / 2.6);
        dg.addColorStop(0, '#9a9aa2'); dg.addColorStop(1, '#42424a');
        ctx.fillStyle = dg;
        ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2 + e.state;
          ctx.beginPath();
          ctx.moveTo(e.x + e.w / 2, e.y + e.h / 2);
          ctx.lineTo(e.x + e.w / 2 + Math.cos(a) * e.w / 3, e.y + e.h / 2 + Math.sin(a) * e.w / 3);
          ctx.stroke();
        }
        break;
      }
      case 'gravel':
        ctx.fillStyle = '#7a6a4a';
        roundRect(e.x, e.y, e.w, e.h, 4); ctx.fill();
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = i % 3 === 0 ? '#9a8a6a' : (i % 3 === 1 ? '#6a5a3a' : '#8a7a58');
          ctx.beginPath();
          ctx.arc(e.x + 4 + hash01(e.id + i) * (e.w - 8), e.y + 4 + hash01(e.id + i * 3) * (e.h - 8), 1.6 + hash01(e.id + i * 5) * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'bench': {
        const wg = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
        wg.addColorStop(0, '#8a5a36'); wg.addColorStop(1, '#5a3a22');
        ctx.fillStyle = wg;
        for (let i = 0; i < 3; i++) ctx.fillRect(e.x, e.y + i * (e.h * 0.18), e.w, e.h * 0.12);
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(e.x + 6, e.y, 5, e.h);
        ctx.fillRect(e.x + e.w - 11, e.y, 5, e.h);
        break;
      }
      case 'fountain': {
        ctx.fillStyle = '#7a8290';
        ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a626e';
        ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2 - 4, 0, Math.PI * 2); ctx.fill();
        const wg = ctx.createRadialGradient(e.x + e.w / 2, e.y + e.h / 2, 2, e.x + e.w / 2, e.y + e.h / 2, e.w / 3);
        wg.addColorStop(0, '#bfe6ff'); wg.addColorStop(1, '#5a9ac8');
        ctx.fillStyle = wg;
        ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cfe9f5';
        ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 9, 0, Math.PI * 2); ctx.fill();
        // droplets
        ctx.fillStyle = 'rgba(200,235,255,0.7)';
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          const rr = e.w / 4 + Math.sin(e.state * 5 + i) * 4;
          ctx.beginPath(); ctx.arc(e.x + e.w / 2 + Math.cos(a) * rr, e.y + e.h / 2 + Math.sin(a) * rr, 1.6, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'ball': {
        const bg = ctx.createRadialGradient(e.x + e.w * 0.36, e.y + e.h * 0.34, 1, e.x + e.w / 2, e.y + e.h / 2, e.w / 2);
        bg.addColorStop(0, '#ff8866'); bg.addColorStop(1, '#cc3a22');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2 - 2, -0.6, 1.4); ctx.stroke();
        break;
      }
      case 'dog':
        drawDog(e, facing);
        break;
      case 'cyclist':
        {
          const lean = e.lean || 0;
          const bikeColor = e.bikeColor || '#5588cc';
          const riderColor = e.riderColor || '#cc6644';
          const s = Math.min(e.w, e.h) / 48;
          ctx.save();
          ctx.translate(e.x + e.w / 2, e.y + e.h / 2);

          const fwY = -16 * s, rwY = 12 * s, wR = 9 * s;
          const hbY = -20 * s, seatY = -3 * s, bbY = 0;

          ctx.fillStyle = '#555';
          ctx.beginPath();
          ctx.arc(0, fwY, wR, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, rwY, wR, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.arc(0, fwY, wR * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, rwY, wR * 0.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = bikeColor;
          ctx.lineWidth = 2 * s;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, rwY);
          ctx.lineTo(0, bbY);
          ctx.moveTo(0, bbY);
          ctx.lineTo(0, seatY);
          ctx.moveTo(0, bbY);
          ctx.lineTo(0, fwY);
          ctx.moveTo(0, fwY);
          ctx.lineTo(0, hbY);
          ctx.stroke();

          ctx.strokeStyle = bikeColor;
          ctx.lineWidth = 1.5 * s;
          ctx.beginPath();
          ctx.moveTo(-6 * s, rwY);
          ctx.lineTo(-6 * s, bbY);
          ctx.moveTo(6 * s, rwY);
          ctx.lineTo(6 * s, bbY);
          ctx.moveTo(-6 * s, seatY);
          ctx.lineTo(6 * s, seatY);
          ctx.stroke();

          ctx.fillStyle = '#555';
          ctx.fillRect(-4 * s, seatY - 1.5 * s, 8 * s, 3 * s);
          ctx.fillStyle = '#444';
          ctx.fillRect(-5 * s, hbY - 1 * s, 10 * s, 2 * s);

          ctx.fillStyle = riderColor;
          ctx.beginPath();
          ctx.ellipse(0, 2 * s, 6 * s, 4 * s, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#e8dcc8';
          ctx.beginPath();
          ctx.arc(0 + lean * 2, -8 * s, 4 * s, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = riderColor;
          ctx.lineWidth = 1.5 * s;
          ctx.beginPath();
          ctx.moveTo(-4 * s + lean * 2, 0);
          ctx.lineTo(-6 * s + lean * 2, -6 * s);
          ctx.moveTo(4 * s + lean * 2, 0);
          ctx.lineTo(6 * s + lean * 2, -6 * s);
          ctx.stroke();

          ctx.strokeStyle = '#555';
          ctx.lineWidth = 1.5 * s;
          ctx.beginPath();
          ctx.moveTo(-3 * s, 3 * s);
          ctx.lineTo(-4 * s, bbY + 2 * s);
          ctx.moveTo(3 * s, 3 * s);
          ctx.lineTo(4 * s, bbY + 2 * s);
          ctx.stroke();

          ctx.fillStyle = '#cc6644';
          ctx.beginPath();
          ctx.arc(0 + lean * 2, -11 * s, 5 * s, Math.PI, 2 * Math.PI);
          ctx.fill();

          ctx.restore();
        }
        break;
      case 'pedestrian':
      case 'jogger': {
        const cx = e.x + e.w / 2;
        const walk = Math.sin(e.state * 8) * (e.kind === 'jogger' ? 5 : 3);
        // legs
        ctx.strokeStyle = '#445';
        ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, e.y + e.h * 0.62);
        ctx.lineTo(cx - walk, e.y + e.h);
        ctx.moveTo(cx, e.y + e.h * 0.62);
        ctx.lineTo(cx + walk, e.y + e.h);
        ctx.stroke();
        // torso
        const shirt = e.kind === 'jogger' ? '#e0533a' : ['#5a7fc0', '#6aa060', '#b07050', '#8a6abc'][e.id % 4];
        const tg = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
        tg.addColorStop(0, shade(shirt, 0.12)); tg.addColorStop(1, shade(shirt, -0.18));
        ctx.fillStyle = tg;
        roundRect(cx - 6, e.y + e.h * 0.28, 12, e.h * 0.4, 4); ctx.fill();
        // arms swinging
        ctx.strokeStyle = shade(shirt, -0.1); ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 5, e.y + e.h * 0.36); ctx.lineTo(cx - 7 + walk, e.y + e.h * 0.58);
        ctx.moveTo(cx + 5, e.y + e.h * 0.36); ctx.lineTo(cx + 7 - walk, e.y + e.h * 0.58);
        ctx.stroke();
        // head
        ctx.fillStyle = '#e8c9a0';
        ctx.beginPath(); ctx.arc(cx, e.y + e.h * 0.18, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ['#3a2a1a', '#5a3a1a', '#222'][e.id % 3];
        ctx.beginPath(); ctx.arc(cx, e.y + e.h * 0.15, 7, Math.PI, Math.PI * 2); ctx.fill();
        break;
      }
      default:
        ctx.fillStyle = '#ff6666';
        ctx.fillRect(e.x, e.y, e.w, e.h);
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  } else if (e.type === 'ramp') {
    groundShadow(e.x + e.w / 2 + 4, e.y + e.h, e.w * 0.55, e.h * 0.25, 0.25);
    // wooden ramp with plank shading
    const rg = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
    rg.addColorStop(0, '#a8824e'); rg.addColorStop(1, '#6a4a2a');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y + e.h);
    ctx.lineTo(e.x + e.w / 2, e.y);
    ctx.lineTo(e.x + e.w, e.y + e.h);
    ctx.closePath();
    ctx.fill();
    // planks
    ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2 * t, e.y + e.h * t);
      ctx.lineTo(e.x + e.w - e.w / 2 * t, e.y + e.h * t);
      ctx.stroke();
    }
    // chevron up-arrows (launch hint)
    ctx.fillStyle = '#ffe070';
    for (let k = 0; k < 2; k++) {
      const ay = e.y + e.h * (0.55 - k * 0.28);
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2, ay);
      ctx.lineTo(e.x + e.w / 2 - 7, ay + 7);
      ctx.lineTo(e.x + e.w / 2 - 4, ay + 7);
      ctx.lineTo(e.x + e.w / 2, ay + 3);
      ctx.lineTo(e.x + e.w / 2 + 4, ay + 7);
      ctx.lineTo(e.x + e.w / 2 + 7, ay + 7);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ---- detailed obstacle helpers (top-down) ---- */
function drawCar(e, body, dark, isTaxi) {
  const bg = ctx.createLinearGradient(e.x, 0, e.x + e.w, 0);
  bg.addColorStop(0, dark); bg.addColorStop(0.5, body); bg.addColorStop(1, dark);
  ctx.fillStyle = bg;
  roundRect(e.x + 2, e.y, e.w - 4, e.h, 10); ctx.fill();
  // roof / cabin
  ctx.fillStyle = shade(body, -0.12);
  roundRect(e.x + 8, e.y + e.h * 0.28, e.w - 16, e.h * 0.44, 6); ctx.fill();
  // windscreen + rear window
  ctx.fillStyle = 'rgba(150,210,240,0.9)';
  roundRect(e.x + 11, e.y + e.h * 0.16, e.w - 22, e.h * 0.14, 3); ctx.fill();
  roundRect(e.x + 11, e.y + e.h * 0.72, e.w - 22, e.h * 0.12, 3); ctx.fill();
  // headlights (front = top)
  ctx.fillStyle = '#fff4c0';
  ctx.beginPath(); ctx.arc(e.x + 9, e.y + 4, 3, 0, Math.PI * 2); ctx.arc(e.x + e.w - 9, e.y + 4, 3, 0, Math.PI * 2); ctx.fill();
  // tail lights
  ctx.fillStyle = '#cc3322';
  ctx.fillRect(e.x + 7, e.y + e.h - 5, 6, 3);
  ctx.fillRect(e.x + e.w - 13, e.y + e.h - 5, 6, 3);
  if (isTaxi) {
    ctx.fillStyle = '#222';
    ctx.fillRect(e.x + e.w / 2 - 8, e.y + e.h * 0.46, 16, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 6px Inter, sans-serif';
    ctx.fillText('TAXI', e.x + e.w / 2 - 7, e.y + e.h * 0.46 + 5);
    // checker stripe
    ctx.fillStyle = '#111';
    for (let i = 0; i < Math.floor(e.w / 8); i++) if (i % 2) ctx.fillRect(e.x + 4 + i * 8, e.y + e.h - 2, 8, 2);
  }
  // wing mirrors
  ctx.fillStyle = dark;
  ctx.fillRect(e.x, e.y + e.h * 0.32, 4, 5);
  ctx.fillRect(e.x + e.w - 4, e.y + e.h * 0.32, 4, 5);
}

function drawDog(e, facing) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
  ctx.scale(facing, 1);
  const bodyCol = ['#9a7048', '#5a4030', '#c8a060', '#3a3a3a'][e.id % 4];
  const bg = ctx.createLinearGradient(0, -e.h / 2, 0, e.h / 2);
  bg.addColorStop(0, shade(bodyCol, 0.12)); bg.addColorStop(1, shade(bodyCol, -0.18));
  ctx.fillStyle = bg;
  // body
  roundRect(-e.w / 2, -e.h * 0.3, e.w * 0.78, e.h * 0.6, e.h * 0.3); ctx.fill();
  // legs (trotting)
  const trot = Math.sin(e.state * 12) * 3;
  ctx.strokeStyle = shade(bodyCol, -0.25); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-e.w * 0.3, e.h * 0.2); ctx.lineTo(-e.w * 0.3 + trot, e.h * 0.5);
  ctx.moveTo(e.w * 0.1, e.h * 0.2); ctx.lineTo(e.w * 0.1 - trot, e.h * 0.5);
  ctx.stroke();
  // tail
  ctx.beginPath();
  ctx.moveTo(-e.w * 0.45, -e.h * 0.1);
  ctx.quadraticCurveTo(-e.w * 0.62, -e.h * 0.3, -e.w * 0.5, -e.h * 0.4);
  ctx.stroke();
  // head
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(e.w * 0.3, -e.h * 0.05, e.h * 0.3, 0, Math.PI * 2); ctx.fill();
  // snout
  ctx.fillStyle = shade(bodyCol, -0.12);
  roundRect(e.w * 0.42, -e.h * 0.12, e.w * 0.2, e.h * 0.2, 3); ctx.fill();
  // ear
  ctx.fillStyle = shade(bodyCol, -0.28);
  ctx.beginPath(); ctx.ellipse(e.w * 0.22, -e.h * 0.22, e.h * 0.1, e.h * 0.16, -0.5, 0, Math.PI * 2); ctx.fill();
  // nose + eye
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(e.w * 0.6, -e.h * 0.02, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(e.w * 0.36, -e.h * 0.1, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBike() {
  const cx = player.x + BIKE_WIDTH / 2;
  const cy = player.y + BIKE_HEIGHT / 2;
  const hopOff = (player.hopTimer > 0 ? -player.hopHeight : 0) + (player.airTimer > 0 ? -player.airHeight : 0);
  const scaleUp = player.airTimer > 0 ? 1 + player.airHeight / 600 : 1;

  const blink = player.invulnTimer > 0 && Math.sin(player.invulnTimer * 20) > 0;

  /* ground shadow stays put and shrinks while airborne (depth cue) */
  const airFrac = player.airTimer > 0 ? player.airHeight / 60 : (player.hopTimer > 0 ? player.hopHeight / 22 : 0);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = `rgba(0,0,0,${0.28 - airFrac * 0.16})`;
  ctx.beginPath();
  ctx.ellipse(0, 10, BIKE_WIDTH * (0.42 - airFrac * 0.14), 8 - airFrac * 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (blink) return;

  ctx.save();
  ctx.translate(cx, cy + hopOff);
  ctx.scale(scaleUp, scaleUp);

  /* trick spin while airborne */
  if (player.airTimer > 0 && Math.abs(player.spinAccum) > 0.01) {
    ctx.rotate(player.spinAccum);
  } else {
    ctx.rotate(player.lean * 0.12);
  }

  const lean = player.lean * 0.3;
  const fwY = -22, rwY = 20, wR = 14;
  const hbY = -26, seatY = -2, bbY = 2;
  const frameCol = '#3f7fc4';
  const pedal = player.pedal;

  /* boost flame at rear */
  if (player.boostTimer > 0) {
    const fl = 14 + Math.sin(timeNow * 30) * 5;
    const fg = ctx.createLinearGradient(0, rwY, 0, rwY + fl + 14);
    fg.addColorStop(0, 'rgba(255,240,160,0.9)');
    fg.addColorStop(0.5, 'rgba(255,150,60,0.7)');
    fg.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-7, rwY);
    ctx.quadraticCurveTo(0, rwY + fl + 16, 7, rwY);
    ctx.closePath();
    ctx.fill();
  }

  /* tyres with subtle radial shading */
  for (const wy of [fwY, rwY]) {
    const tg = ctx.createRadialGradient(0, wy, wR * 0.4, 0, wy, wR);
    tg.addColorStop(0, '#3a3a3e'); tg.addColorStop(1, '#16161a');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(0, wy, wR, 0, Math.PI * 2); ctx.fill();
    // rim
    ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, wy, wR * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#cfd3da';
    ctx.beginPath(); ctx.arc(0, wy, wR * 0.55, 0, Math.PI * 2); ctx.fill();
  }

  /* spokes — blur to a disc at speed */
  const fast = player.speedMult > 1.15 || player.boostTimer > 0;
  if (fast) {
    for (const wy of [fwY, rwY]) {
      ctx.fillStyle = 'rgba(190,195,205,0.45)';
      ctx.beginPath(); ctx.arc(0, wy, wR * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.strokeStyle = '#9aa0aa'; ctx.lineWidth = 1;
    for (const wy of [fwY, rwY]) {
      for (let i = 0; i < 6; i++) {
        const a = player.wheelRot + i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 2, wy + Math.sin(a) * 2);
        ctx.lineTo(Math.cos(a) * (wR * 0.55), wy + Math.sin(a) * (wR * 0.55));
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = '#dde1e8';
  for (const wy of [fwY, rwY]) { ctx.beginPath(); ctx.arc(0, wy, 2.4, 0, Math.PI * 2); ctx.fill(); }

  /* frame — drawn with a soft shadow for volume */
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(0, rwY); ctx.lineTo(0, bbY); ctx.lineTo(0, seatY);
  ctx.moveTo(0, bbY); ctx.lineTo(0, fwY); ctx.lineTo(0, hbY);
  ctx.stroke();

  ctx.strokeStyle = frameCol; ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, rwY); ctx.lineTo(0, bbY);
  ctx.moveTo(0, bbY); ctx.lineTo(0, seatY);
  ctx.moveTo(0, bbY); ctx.lineTo(0, fwY);
  ctx.moveTo(0, fwY); ctx.lineTo(0, hbY);
  ctx.stroke();
  // frame highlight
  ctx.strokeStyle = shade(frameCol, 0.4); ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-0.8, rwY); ctx.lineTo(-0.8, fwY);
  ctx.stroke();

  /* stays */
  ctx.strokeStyle = frameCol; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, rwY); ctx.lineTo(-5, bbY);
  ctx.moveTo(7, rwY); ctx.lineTo(5, bbY);
  ctx.moveTo(-5, seatY); ctx.lineTo(-6, rwY);
  ctx.moveTo(5, seatY); ctx.lineTo(6, rwY);
  ctx.stroke();

  /* seat */
  ctx.fillStyle = '#2a2a2e';
  roundRect(-5, seatY - 2, 10, 4, 2); ctx.fill();

  /* handlebars */
  ctx.strokeStyle = '#33363c'; ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.moveTo(-8, hbY); ctx.lineTo(8, hbY); ctx.stroke();
  ctx.fillStyle = '#1c1c20';
  ctx.fillRect(-9, hbY - 2, 3, 4);
  ctx.fillRect(6, hbY - 2, 3, 4);

  /* pedalling legs (animate fore/aft with pedal phase) */
  const legSwing = Math.sin(pedal) * 4;
  ctx.strokeStyle = '#2c2c34'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 4); ctx.lineTo(-4, bbY + 4 + legSwing);
  ctx.moveTo(4, 4); ctx.lineTo(4, bbY + 4 - legSwing);
  ctx.stroke();
  // pedals
  ctx.fillStyle = '#111';
  ctx.fillRect(-6, bbY + 3 + legSwing, 4, 2.5);
  ctx.fillRect(2, bbY + 3 - legSwing, 4, 2.5);

  /* rider torso — jersey with shading */
  const jg = ctx.createLinearGradient(-9, 0, 9, 0);
  jg.addColorStop(0, '#d4861f'); jg.addColorStop(0.5, '#f7b743'); jg.addColorStop(1, '#c87714');
  ctx.fillStyle = jg;
  ctx.beginPath();
  ctx.ellipse(lean * 1.5, 3, 9, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // backpack / number panel
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(lean * 1.5, 4, 4, 3, 0, 0, Math.PI * 2); ctx.fill();

  /* arms to bars */
  ctx.strokeStyle = '#e8caa0'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-5 + lean, 0); ctx.lineTo(-8 + lean * 2, -7);
  ctx.moveTo(5 + lean, 0); ctx.lineTo(8 + lean * 2, -7);
  ctx.stroke();

  /* head + helmet */
  ctx.fillStyle = '#e8caa0';
  ctx.beginPath(); ctx.arc(lean * 1.5, -6, 5.6, 0, Math.PI * 2); ctx.fill();
  const hg = ctx.createLinearGradient(0, -14, 0, -4);
  hg.addColorStop(0, '#e0503a'); hg.addColorStop(1, '#a8331f');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(lean * 1.5, -8, 6.6, Math.PI, 2 * Math.PI); ctx.fill();
  ctx.fillRect(-6 + lean * 1.5, -8, 13, 2.4);
  // helmet vents
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lean * 1.5 - 3, -12); ctx.lineTo(lean * 1.5 - 3, -8);
  ctx.moveTo(lean * 1.5 + 3, -12); ctx.lineTo(lean * 1.5 + 3, -8);
  ctx.stroke();

  ctx.restore();
}

/* ---- game update ---- */
function scrollSpeed() {
  const diffMult = 1 + Math.min(world.distance / 60000, 1.2);
  const boost = player.boostTimer > 0 ? BOOST_MULT : 1;
  return BASE_SCROLL_SPEED * diffMult * player.speedMult * boost;
}

function transitionToNextZone() {
  const prevZone = ZONES[zoneIndex];
  zoneNameCounters[prevZone.id] = (zoneNameCounters[prevZone.id] || 0) + 1;
  zoneIndex++;
  if (zoneIndex >= ZONES.length) zoneIndex = 0;
  world.zoneDistance = 0;
  world.entities = [];
  sceneryItems = [];
  lastSegment = Math.floor(world.distance / SEGMENT_LENGTH);
  const zone = ZONES[zoneIndex];
  const zoneName = getZoneName(zone);
  const roadLeft = (LOGICAL_WIDTH - zone.roadWidth) / 2;
  player.x = Math.max(roadLeft + 10, Math.min(player.x, roadLeft + zone.roadWidth - BIKE_WIDTH - 10));
  document.getElementById('hud-zone').textContent = zoneName;
  music.changeTheme(zone.id);
  const banner = document.getElementById('zone-banner');
  document.getElementById('zone-banner-name').textContent = zoneName;
  banner.hidden = false;
  banner.style.animation = 'none';
  void banner.offsetWidth;
  banner.style.animation = 'bannerFade 3s ease-in-out forwards';
  setTimeout(() => { banner.hidden = true; }, 3000);
  sfx.zone();
}

function updateWorld(dt) {
  const zone = ZONES[zoneIndex];
  const roadLeft = (LOGICAL_WIDTH - zone.roadWidth) / 2;
  const roadRight = roadLeft + zone.roadWidth;
  const ss = scrollSpeed();

  scrollOffset += ss * dt;
  world.distance += ss * dt;
  world.zoneDistance += ss * dt;

  if (world.zoneDistance >= zone.lengthMeters * 10) {
    transitionToNextZone();
    return;
  }

  for (const s of sceneryItems) s.y += ss * dt;
  sceneryItems = sceneryItems.filter(s => s.y < LOGICAL_HEIGHT + 100);

  const newSeg = Math.floor(world.distance / SEGMENT_LENGTH);
  while (lastSegment < newSeg) {
    lastSegment++;
    spawnSegment(lastSegment);
    generateScenerySegment();
  }

  for (const e of world.entities) {
    if (e.velY) {
      e.y += (ss - e.velY) * dt;
    } else {
      e.y += ss * dt;
    }
    if (e.velX) e.x += e.velX * dt;
    e.state += dt;
  }
  // despawn once below view or fully crossed off the sides
  world.entities = world.entities.filter(e =>
    e.y < LOGICAL_HEIGHT + 100 && e.x > -160 && e.x < LOGICAL_WIDTH + 160);

  const px = player.x;
  const crashL = roadLeft - SHOULDER_WIDTH;
  const crashR = roadRight + SHOULDER_WIDTH - BIKE_WIDTH;

  player.offroad = px < roadLeft || px + BIKE_WIDTH > roadRight;

  if (px < crashL || px > crashR) {
    crashPlayer();
    return;
  }

  if (player.offroad) {
    player.speedMult = Math.min(player.speedMult, OFFROAD_SPEED_MULT);
  }
}

function updatePlayer(dt) {
  const zone = ZONES[zoneIndex];
  const roadLeft = (LOGICAL_WIDTH - zone.roadWidth) / 2;
  const roadRight = roadLeft + zone.roadWidth;
  const shoulderL = roadLeft - SHOULDER_WIDTH;
  const shoulderR = roadRight + SHOULDER_WIDTH - BIKE_WIDTH;

  if (player.invulnTimer > 0) player.invulnTimer -= dt;

  let dir = 0;
  if (isDown('ArrowLeft') || isDown('a') || isDown('A')) dir = -1;
  else if (isDown('ArrowRight') || isDown('d') || isDown('D')) dir = 1;
  else if (touchActive && touchX !== null) {
    const cx = player.x + BIKE_WIDTH / 2;
    if (touchX < cx - 20) dir = -1;
    else if (touchX > cx + 20) dir = 1;
  }

  const targetVx = dir * PLAYER_LATERAL_SPEED;
  player.vx += (targetVx - player.vx) * Math.min(1, dt * 8);
  player.x += player.vx * dt;
  player.lean += (dir - player.lean) * Math.min(1, dt * 6);

  player.x = Math.max(shoulderL, Math.min(shoulderR, player.x));

  if (isDown('ArrowUp') || isDown('w') || isDown('W')) {
    player.speedMult = Math.min(player.speedMult + dt * 2, SPEED_MAX_MULT);
  } else if (isDown('ArrowDown') || isDown('s') || isDown('S')) {
    player.speedMult = Math.max(player.speedMult - dt * 2, SPEED_MIN_MULT);
  } else {
    player.speedMult += (1 - player.speedMult) * Math.min(1, dt * 2);
  }

  const ss = scrollSpeed();
  player.wheelRot += ss * dt * 0.03;
  player.pedal += ss * dt * 0.05;
  if (player.boostTimer > 0) player.boostTimer -= dt;

  // wheel dust trail (more when fast / boosting / offroad)
  const grounded = player.airTimer <= 0 && player.hopTimer <= 0;
  if (grounded && state === STATE.PLAYING) {
    const rate = player.offroad ? 0.9 : (player.boostTimer > 0 ? 0.6 : 0.28);
    if (Math.random() < rate) {
      const dustCol = player.offroad ? 'rgba(150,130,90,0.5)' : 'rgba(210,210,215,0.32)';
      addParticle({
        x: player.x + BIKE_WIDTH / 2 + (Math.random() - 0.5) * 10,
        y: player.y + BIKE_HEIGHT * 0.7,
        vx: -player.vx * 0.2 + (Math.random() - 0.5) * 20,
        vy: 30 + Math.random() * 40,
        size: 2 + Math.random() * 3, life: 0.4 + Math.random() * 0.3,
        color: dustCol, shrink: true,
      });
    }
  }
  if (player.boostTimer > 0 && Math.random() < 0.7) {
    addParticle({
      x: player.x + BIKE_WIDTH / 2 + (Math.random() - 0.5) * 8,
      y: player.y + BIKE_HEIGHT * 0.8,
      vx: (Math.random() - 0.5) * 30, vy: 80 + Math.random() * 60,
      size: 2 + Math.random() * 3, life: 0.35,
      color: 'rgba(255,170,70,0.6)', shrink: true,
    });
  }

  if (wasPressed(' ') && player.hopTimer <= 0 && player.airTimer <= 0) {
    player.hopTimer = 0.45;
    player.hopHeight = 0;
    sfx.hop();
  }

  if (player.hopTimer > 0) {
    player.hopTimer -= dt;
    const t = player.hopTimer / 0.45;
    player.hopHeight = Math.sin(t * Math.PI) * 22;
    if (player.hopTimer <= 0) {
      player.hopHeight = 0;
      if (player.airTimer <= 0) sfx.land();
    }
  }

  if (player.airTimer > 0) {
    player.airTimer -= dt;
    const t = player.airTimer / 0.85;
    player.airHeight = Math.sin(t * Math.PI) * 60;
    // trick spins: hold a direction to rotate; each full turn scores
    const spinIn = (isDown('ArrowLeft') || isDown('a') || isDown('A')) ? -1
      : (isDown('ArrowRight') || isDown('d') || isDown('D')) ? 1 : 0;
    if (spinIn !== 0) {
      const before = Math.floor(Math.abs(player.spinAccum) / (Math.PI * 2));
      player.spinAccum += spinIn * dt * 12;
      const after = Math.floor(Math.abs(player.spinAccum) / (Math.PI * 2));
      if (after > before) {
        player.trickCount++;
        score += TRICK_POINTS;
        addFloater(player.x + BIKE_WIDTH / 2, player.y - 30, '+' + TRICK_POINTS + ' spin!', '#9ad8ff');
        sfx.trick();
      }
    }
    if (player.airTimer <= 0) {
      player.airHeight = 0;
      // clean landing if not mid-spin
      const spinRem = Math.abs(player.spinAccum) % (Math.PI * 2);
      const clean = spinRem < 0.5 || spinRem > Math.PI * 2 - 0.5;
      if (player.trickCount > 0 && clean) {
        score += CLEAN_LANDING;
        addFloater(player.x + BIKE_WIDTH / 2, player.y - 30, '+' + CLEAN_LANDING + ' clean!', '#ffe27a');
      }
      player.spinAccum = 0;
      player.trickCount = 0;
      shake = Math.max(shake, 3);
      sfx.land();
      checkLandingCollision();
    }
  } else {
    if (player.rampCooldown > 0) player.rampCooldown -= dt;
    if (player.rampCooldown <= 0) {
      const pb = getPlayerBox();
      for (const e of world.entities) {
        if (e.type === 'ramp' && aabb(pb, e)) {
          player.airTimer = 0.85;
          player.airHeight = 0;
          player.trickCount = 0;
          player.spinAccum = 0;
          player.hopTimer = 0;
          player.hopHeight = 0;
          player.rampCooldown = 1.5;
          sfx.ramp();
          break;
        }
      }
    }
  }

  checkCoinPickups();
  checkNearMiss(dt);
  checkObstacleCollisions();
}

function checkNearMiss(dt) {
  // tick the combo timer down; passing close to a hazard while grounded refreshes it
  if (combo.timer > 0) {
    combo.timer -= dt;
    if (combo.timer <= 0) { combo.count = 0; combo.mult = 1; }
  }
  if (player.invulnTimer > 0 || player.airTimer > 0) return;
  const pcx = player.x + BIKE_WIDTH / 2;
  const pcy = player.y + BIKE_HEIGHT / 2;
  for (const e of world.entities) {
    if (e.type !== 'obstacle' || !e.collidable || e._missed) continue;
    // only when it has passed the player (just behind) and was close laterally
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
    if (ecy > pcy + BIKE_HEIGHT * 0.3 && ecy < pcy + BIKE_HEIGHT) {
      const dx = Math.abs(ecx - pcx) - (e.w / 2 + BIKE_WIDTH / 2);
      if (dx > 0 && dx < NEAR_MISS_RADIUS) {
        e._missed = true;
        combo.count = Math.min(COMBO_MAX, combo.count + 1);
        combo.mult = combo.count;
        combo.timer = COMBO_WINDOW;
        const pts = NEAR_MISS_BASE * combo.mult;
        score += pts;
        addFloater(pcx, pcy - 30, '+' + pts + (combo.mult > 1 ? ' x' + combo.mult : ''), '#ffd27a');
        sfx.nearmiss();
      }
    }
  }
}

function checkCoinPickups() {
  const pb = getPlayerBox();
  for (let i = world.entities.length - 1; i >= 0; i--) {
    const e = world.entities[i];
    if (e.type === 'coin' && aabb(pb, e)) {
      score += e.value;
      coins++;
      sfx.coin();
      for (let k = 0; k < 6; k++) {
        addParticle({
          x: e.x + e.w / 2, y: e.y + e.h / 2,
          vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120 - 30,
          size: 1.5 + Math.random() * 2, life: 0.35,
          color: 'rgba(255,225,120,0.9)', shrink: true,
        });
      }
      world.entities.splice(i, 1);
    } else if (e.type === 'boost' && aabb(pb, e)) {
      player.boostTimer = BOOST_DURATION;
      score += BOOST_POINTS;
      sfx.boost();
      shake = Math.max(shake, 4);
      addFloater(player.x + BIKE_WIDTH / 2, player.y - 30, 'BOOST!', '#9af0ff');
      world.entities.splice(i, 1);
    }
  }
}

function checkLandingCollision() {
  if (player.invulnTimer > 0) return;
  const pb = getPlayerBox();
  for (const e of world.entities) {
    if (e.type !== 'obstacle' || !e.collidable) continue;
    if (e.clearance === 'solid' && aabb(pb, e)) {
      crashPlayer();
      return;
    }
  }
}

function checkObstacleCollisions() {
  if (player.invulnTimer > 0) return;
  if (player.airTimer > 0) return;
  const pb = getPlayerBox();
  for (const e of world.entities) {
    if (e.type !== 'obstacle' || !e.collidable) continue;
    if (player.hopTimer > 0 && e.clearance === 'low') continue;
    if (aabb(pb, e)) {
      crashPlayer();
      return;
    }
  }
}

function crashPlayer() {
  if (player.invulnTimer > 0) return;
  player.lives--;
  sfx.crash();
  shake = 16;
  combo.count = 0; combo.mult = 1; combo.timer = 0;
  player.boostTimer = 0;
  // debris burst
  for (let k = 0; k < 22; k++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 60 + Math.random() * 220;
    addParticle({
      x: player.x + BIKE_WIDTH / 2, y: player.y + BIKE_HEIGHT / 2,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 40,
      size: 2 + Math.random() * 3.5, life: 0.5 + Math.random() * 0.4,
      color: k % 3 === 0 ? 'rgba(63,127,196,0.9)' : (k % 3 === 1 ? 'rgba(240,167,62,0.9)' : 'rgba(120,120,130,0.8)'),
      grav: 220, shrink: true,
    });
  }
  if (player.lives <= 0) {
    gameOver();
  } else {
    const zone = ZONES[zoneIndex];
    const roadLeft = (LOGICAL_WIDTH - zone.roadWidth) / 2;
    player.x = roadLeft + zone.roadWidth / 2 - BIKE_WIDTH / 2;
    player.vx = 0;
    player.invulnTimer = INVULN_TIME;
    player.airTimer = 0;
    player.airHeight = 0;
    player.hopTimer = 0;
    player.hopHeight = 0;
    player.rampCooldown = 0;
    player.speedMult = 0.5;
  }
}

function gameOver() {
  state = STATE.GAME_OVER;
  if (score > bestScore) {
    bestScore = score;
    saveBest(bestScore);
    document.getElementById('new-best').hidden = false;
  } else {
    document.getElementById('new-best').hidden = true;
  }
  document.getElementById('final-score').textContent = score;
  document.getElementById('best-score-over').textContent = bestScore;
  document.getElementById('final-distance').textContent = Math.floor(world.distance / 10);
  document.getElementById('final-coins').textContent = coins;
  document.getElementById('screen-over').hidden = false;
  document.getElementById('hud').hidden = true;
  music.stop();
  sfx.over();
}

/* ---- main loop ---- */
function frame(now) {
  const elapsed = (now - lastTime) / 1000;
  lastTime = now;
  accTime += Math.min(elapsed, 0.1);

  while (accTime >= DT) {
    update(DT);
    accTime -= DT;
  }
  render();

  for (const k in justPressed) justPressed[k] = false;

  requestAnimationFrame(frame);
}

function update(dt) {
  timeNow += dt;
  if (state === STATE.PLAYING) {
    if (wasPressed('p') || wasPressed('P')) {
      state = STATE.PAUSED;
      document.getElementById('pause-overlay').hidden = false;
      return;
    }
    if (wasPressed('m') || wasPressed('M')) toggleMute();
    updateWorld(dt);
    updatePlayer(dt);
    updateWeather(dt);
    updateParticles(dt);
    score += Math.floor(scrollSpeed() * dt / DISTANCE_PER_POINT);
    updateHUD();
  } else if (state === STATE.PAUSED) {
    if (wasPressed('p') || wasPressed('P')) {
      state = STATE.PLAYING;
      document.getElementById('pause-overlay').hidden = true;
    }
    if (wasPressed('m') || wasPressed('M')) toggleMute();
  }
}

function drawSpeedLines() {
  const eff = player.speedMult + (player.boostTimer > 0 ? 0.5 : 0);
  if (eff <= 1.2) return;
  const intensity = Math.min(1, (eff - 1.2) / 0.7);
  ctx.strokeStyle = `rgba(255,255,255,${0.05 + intensity * 0.12})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const lx = hash01(i * 4.1) * LOGICAL_WIDTH;
    const ly = (hash01(i * 9.3) * LOGICAL_HEIGHT + scrollOffset * 2.5) % LOGICAL_HEIGHT;
    const len = 30 + intensity * 60;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, ly + len);
    ctx.stroke();
  }
  // edge vignette
  const vg = ctx.createRadialGradient(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_HEIGHT * 0.35, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH * 0.6);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${intensity * 0.28})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}

function render() {
  ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  if (state === STATE.TITLE) return;

  ctx.save();
  if (shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  drawRoad();
  drawScenery();
  drawWeather();
  for (const e of world.entities) drawEntity(e);
  drawBike();
  drawParticles();
  drawSpeedLines();

  ctx.restore();

  if (state === STATE.PAUSED) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }
}

function updateHUD() {
  const zone = ZONES[zoneIndex];
  document.getElementById('hud-score').textContent = score;
  document.getElementById('hud-distance').textContent = Math.floor(world.distance / 10) + 'm';
  document.getElementById('hud-zone').textContent = getZoneName(zone);
  let hearts = '';
  for (let i = 0; i < player.lives; i++) hearts += '\u2764';
  document.getElementById('hud-lives').textContent = hearts || '\u{1F480}';
  const spd = Math.round((player.speedMult + (player.boostTimer > 0 ? BOOST_MULT - 1 : 0)) * 100);
  const spdEl = document.getElementById('hud-speed');
  spdEl.textContent = spd + '%';
  spdEl.style.color = player.boostTimer > 0 ? '#6fe0ff' : '';
  // combo meter
  const comboEl = document.getElementById('hud-combo');
  if (comboEl) {
    if (combo.count > 1 && combo.timer > 0) {
      comboEl.hidden = false;
      comboEl.querySelector('.combo-mult').textContent = 'x' + combo.mult;
      comboEl.querySelector('.combo-bar-fill').style.width = Math.max(0, (combo.timer / COMBO_WINDOW) * 100) + '%';
    } else {
      comboEl.hidden = true;
    }
  }
}

function toggleMute() {
  muted = sfx.toggleMute();
  try { localStorage.setItem('papertrail_muted', muted ? '1' : '0'); } catch {}
  const mi = document.getElementById('mute-indicator');
  if (mi) mi.textContent = muted ? '\ud83d\udd07' : '\ud83d\udd0a';
  if (!muted && state === STATE.PLAYING) music.start(ZONES[zoneIndex].id);
}

/* ---- UI wiring ---- */
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-title').addEventListener('click', goToTitle);

window.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (state === STATE.TITLE) startGame();
    else if (state === STATE.GAME_OVER) startGame();
  }
});

function startGame() {
  document.getElementById('screen-title').hidden = true;
  document.getElementById('screen-over').hidden = true;
  document.getElementById('pause-overlay').hidden = true;
  document.getElementById('zone-banner').hidden = true;
  document.getElementById('hud').hidden = false;
  const comboEl = document.getElementById('hud-combo');
  if (comboEl) comboEl.hidden = true;
  initGame();
  state = STATE.PLAYING;
  accTime = 0;
  lastTime = performance.now();
  sfx.start();
  music.start(ZONES[zoneIndex].id);
}

function goToTitle() {
  document.getElementById('screen-over').hidden = true;
  document.getElementById('zone-banner').hidden = true;
  document.getElementById('hud').hidden = true;
  document.getElementById('screen-title').hidden = false;
  music.stop();
  state = STATE.TITLE;
}

/* ---- mute wiring ---- */
const muteBtn = document.getElementById('mute-indicator');
if (muteBtn) muteBtn.addEventListener('click', toggleMute);

/* ---- boot ---- */
function boot() {
  resize();
  try { muted = localStorage.getItem('papertrail_muted') === '1'; } catch {}
  sfx.setMuted(muted);
  if (muteBtn) muteBtn.textContent = muted ? '\ud83d\udd07' : '\ud83d\udd0a';
  const saved = loadBest();
  document.getElementById('best-score-title').textContent = saved > 0 ? 'Best: ' + saved : 'Best: \u2014';
  document.getElementById('hud-zone').textContent = getZoneName(ZONES[0]);
  state = STATE.TITLE;
  document.getElementById('screen-title').hidden = false;
  document.getElementById('screen-over').hidden = true;
  document.getElementById('hud').hidden = true;
  initGame();
  lastTime = performance.now();
  requestAnimationFrame(frame);
}

boot();
