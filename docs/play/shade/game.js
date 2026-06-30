/* Shade - a tiny Hollow Knight inspired platformer
 * Paper Lantern Studios
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Constants
  // --------------------------------------------------------------------------
  const TILE = 32;
  const GRAVITY = 0.58;
  const MOVE_ACCEL = 0.85;
  const MOVE_FRICTION = 0.82;
  const AIR_FRICTION = 0.94;
  const MAX_SPEED = 5.2;
  const JUMP_VEL = -12.0;
  const JUMP_CUT = -4.5;
  const COYOTE_TIME = 8;
  const JUMP_BUFFER = 6;
  const INVINCIBLE_TIME = 90;
  const ATTACK_COOLDOWN = 22;
  const ATTACK_RANGE = 56;
  const ATTACK_WIDTH = 34;
  const ATTACK_DURATION = 12;
  const KNOCKBACK_X = 5;
  const KNOCKBACK_Y = -5;
  const MAX_HEALTH = 3;

  const COLORS = {
    bg: '#120c1d',
    tile: '#2a1f3d',
    tileTop: '#3d2e55',
    tileEdge: '#7fd3ff',
    spike: '#ff5e5e',
    shard: '#ffd27a',
    door: '#f0a73e',
    player: '#1a1423',
    playerEye: '#7fd3ff',
    enemy: '#2a0f1f',
    enemyCore: '#ff5e5e',
    wisp: '#1f2a3d',
    wispCore: '#7fd3ff',
    power: '#a78bfa',
    text: '#f4ecd8',
    // Extended palette for the detailed art pass
    maskPale: '#ece3cf',
    maskShade: '#b7ad93',
    cloak: '#171022',
    cloakLit: '#2c2140',
    cloakTrim: '#4a3a66',
    rimCool: '#8fdcff',
    rimWarm: '#f3b367',
    crystal: '#8fe9ff',
    moss: '#5f8f5a',
    mushroom: '#7fd3ff'
  };

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  const canvas = document.getElementById('shade-canvas');
  const ctx = canvas.getContext('2d');

  let lastTime = 0;
  let screenShake = 0;
  let muted = false;
  try { muted = localStorage.getItem('shade-muted') === 'true'; } catch (e) {}
  let currentLevelIdx = 0;
  let state = 'menu'; // menu, playing, paused, win, death
  let level = null;
  let player = null;
  let enemies = [];
  let particles = [];
  let collectibles = [];
  let powerUps = [];
  let camera = { x: 0, y: 0 };
  let stars = [];
  let ambient = { stalactites: [], pillars: [], orbs: [], fireflies: [] };
  let textures = null;

  function lw() { return canvas.width / (window.devicePixelRatio || 1); }
  function lh() { return canvas.height / (window.devicePixelRatio || 1); }

  const keys = {};
  const pressed = {};

  // --------------------------------------------------------------------------
  // Audio
  // --------------------------------------------------------------------------
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx && AudioCtx) audioCtx = new AudioCtx();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone({ freq = 440, duration = 0.12, type = 'sine', vol = 0.12, slide = 0 }) {
    if (muted || !audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq + slide, t + duration);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  function sfx(name) {
    ensureAudio();
    switch (name) {
      case 'jump':
        playTone({ freq: 280, duration: 0.16, type: 'square', vol: 0.08, slide: 520 });
        break;
      case 'double':
        playTone({ freq: 420, duration: 0.14, type: 'sine', vol: 0.08, slide: 360 });
        break;
      case 'land':
        playTone({ freq: 120, duration: 0.08, type: 'triangle', vol: 0.1, slide: -40 });
        break;
      case 'attack':
        playTone({ freq: 180, duration: 0.09, type: 'sawtooth', vol: 0.08, slide: 400 });
        break;
      case 'hit':
        playTone({ freq: 220, duration: 0.12, type: 'square', vol: 0.12, slide: -120 });
        break;
      case 'kill':
        playTone({ freq: 160, duration: 0.22, type: 'sawtooth', vol: 0.1, slide: -100 });
        break;
      case 'shard':
        playTone({ freq: 880, duration: 0.18, type: 'sine', vol: 0.08, slide: 440 });
        break;
      case 'power':
        playTone({ freq: 330, duration: 0.25, type: 'sine', vol: 0.12, slide: 660 });
        break;
      case 'hurt':
        playTone({ freq: 140, duration: 0.28, type: 'sawtooth', vol: 0.14, slide: -80 });
        break;
      case 'win':
        playTone({ freq: 440, duration: 0.3, type: 'sine', vol: 0.1, slide: 220 });
        setTimeout(() => playTone({ freq: 660, duration: 0.4, type: 'sine', vol: 0.1, slide: 220 }), 180);
        break;
      case 'die':
        playTone({ freq: 220, duration: 0.5, type: 'sawtooth', vol: 0.12, slide: -140 });
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Input
  // --------------------------------------------------------------------------
  function isDown(code) { return !!keys[code]; }
  function wasPressed(code) {
    if (pressed[code]) { pressed[code] = false; return true; }
    return false;
  }

  window.addEventListener('keydown', (e) => {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;

    if (e.code === 'KeyR') {
      if (state === 'playing') restartLevel();
    }
    if (e.code === 'Escape') {
      if (state === 'playing') openPause();
      else if (state === 'paused') resumeGame();
      else if (state === 'win' || state === 'death') showScreen('screen-select');
    }
  });

  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // Touch controls (simple zones)
  let touchLeft = false, touchRight = false, touchJumpPressed = false, touchJumpHeld = false, touchAttackPressed = false;
  let previousTouches = new Set();
  canvas.addEventListener('touchstart', handleTouch, { passive: false });
  canvas.addEventListener('touchmove', handleTouch, { passive: false });
  canvas.addEventListener('touchend', handleTouch, { passive: false });
  canvas.addEventListener('touchcancel', handleTouch, { passive: false });

  function handleTouch(e) {
    e.preventDefault();
    touchLeft = touchRight = touchJumpHeld = false;
    const current = new Set();
    for (const t of e.touches) {
      const zone = touchZone(t);
      current.add(zone);
      if (zone === 'left') touchLeft = true;
      if (zone === 'right') touchRight = true;
      if (zone === 'jump') touchJumpHeld = true;
    }
    if (current.has('jump') && !previousTouches.has('jump')) touchJumpPressed = true;
    if (current.has('attack') && !previousTouches.has('attack')) touchAttackPressed = true;
    previousTouches = current;
  }

  function touchZone(t) {
    const x = t.clientX / window.innerWidth;
    const y = t.clientY / window.innerHeight;
    if (x < 0.25) return 'left';
    if (x < 0.5) return 'right';
    if (x > 0.7 && y > 0.5) return 'attack';
    return 'jump';
  }

  // --------------------------------------------------------------------------
  // Particles
  // --------------------------------------------------------------------------
  function spawnParticles(x, y, count, color, speed = 3, life = 40) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const sp = Math.random() * speed + 1;
      particles.push({
        x, y,
        vx: Math.cos(angle) * sp,
        vy: Math.sin(angle) * sp,
        life: life + Math.random() * 20,
        maxLife: life + Math.random() * 20,
        color,
        size: Math.random() * 3 + 2
      });
    }
  }

  function spawnDust(x, y, dir) {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 2 + dir * 1.5,
        vy: (Math.random() - 0.5) * 1.5 - 1,
        life: 20 + Math.random() * 10,
        maxLife: 30,
        color: 'rgba(201,184,154,0.6)',
        size: Math.random() * 2 + 1
      });
    }
  }

  // --------------------------------------------------------------------------
  // Level loading
  // --------------------------------------------------------------------------
  function loadLevel(idx) {
    const data = LEVELS[idx];
    if (!data) return false;
    currentLevelIdx = idx;

    const rows = data.map;
    const height = rows.length;
    const width = rows[0].length;

    level = {
      width, height,
      grid: new Array(width * height).fill(0),
      pxWidth: width * TILE,
      pxHeight: height * TILE,
      name: data.name,
      hint: data.hint,
      parallax: data.parallax
    };

    enemies = [];
    collectibles = [];
    powerUps = [];
    particles = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ch = rows[y][x];
        const i = y * width + x;
        if (ch === '#') level.grid[i] = 1;
        else if (ch === '^') level.grid[i] = 2;
        else if (ch === '=') level.grid[i] = 3;
        else if (ch === 'P') {
          player = createPlayer(x * TILE + TILE / 2 - 13, y * TILE + TILE - 36);
        } else if (ch === 'D') {
          level.door = { x: x * TILE, y: y * TILE, w: TILE, h: TILE };
        } else if (ch === 's') {
          collectibles.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, type: 'shard', r: 8, taken: false });
        } else if (ch === 'n') {
          powerUps.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, type: 'nail', r: 14, taken: false, bob: Math.random() * Math.PI * 2 });
        } else if (ch === 'm') {
          powerUps.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, type: 'wing', r: 14, taken: false, bob: Math.random() * Math.PI * 2 });
        } else if (ch === 'E') {
          enemies.push(createCrawler(x * TILE, y * TILE + TILE - 24));
        } else if (ch === 'F') {
          enemies.push(createWisp(x * TILE + TILE / 2, y * TILE + TILE / 2));
        }
      }
    }

    camera.x = player.x - lw() / 2;
    camera.y = player.y - lh() / 2;
    clampCamera();
    generateStars();
    return true;
  }

  function createPlayer(x, y) {
    return {
      x, y, w: 26, h: 36,
      vx: 0, vy: 0,
      dir: 1,
      onGround: false,
      coyote: 0,
      jumpBuffer: 0,
      jumpsLeft: 1,
      hasNail: true,
      hasWing: false,
      attacking: 0,
      attackCooldown: 0,
      invincible: 0,
      health: MAX_HEALTH,
      shards: 0,
      facing: 1,
      anim: 'idle',
      animTimer: 0,
      blink: 0,
      blinkTimer: 120 + Math.random() * 120,
      dead: false
    };
  }

  function createCrawler(x, y) {
    return {
      type: 'crawler', x, y, w: 28, h: 24,
      vx: -1.2, vy: 0,
      health: 1,
      patrolLeft: x - 60, patrolRight: x + 60,
      hitFlash: 0,
      walkPhase: Math.random() * Math.PI * 2,
      seed: Math.random() * 1000
    };
  }

  function createWisp(x, y) {
    return {
      type: 'wisp', x, y, w: 20, h: 20,
      vx: 0, vy: 0,
      health: 1,
      originX: x, originY: y,
      phase: Math.random() * Math.PI * 2,
      glowPhase: Math.random() * Math.PI * 2,
      trail: [],
      hitFlash: 0
    };
  }

  function generateStars() {
    stars = [];
    for (let i = 0; i < 160; i++) {
      stars.push({
        x: Math.random() * level.pxWidth,
        y: Math.random() * level.pxHeight,
        size: Math.random() * 2 + 0.5,
        blink: Math.random() * Math.PI * 2,
        layer: Math.floor(Math.random() * 3)
      });
    }

    // Richer cavern backdrop: hanging stalactites, distant ruined pillars,
    // glowing orbs and drifting fireflies.
    ambient = { stalactites: [], pillars: [], orbs: [], fireflies: [] };
    const span = level.pxWidth + 400;

    for (let i = 0; i < Math.ceil(span / 110); i++) {
      ambient.stalactites.push({
        x: Math.random() * span - 200,
        w: 26 + Math.random() * 48,
        h: 70 + Math.random() * 150,
        up: Math.random() < 0.5 // true = stalagmite rising from below
      });
    }

    for (let i = 0; i < Math.ceil(span / 240); i++) {
      ambient.pillars.push({
        x: Math.random() * span - 200,
        w: 40 + Math.random() * 50,
        top: Math.random() * level.pxHeight * 0.3,
        broken: Math.random() < 0.5
      });
    }

    for (let i = 0; i < 14; i++) {
      ambient.orbs.push({
        x: Math.random() * span - 200,
        y: Math.random() * level.pxHeight,
        r: 30 + Math.random() * 60,
        phase: Math.random() * Math.PI * 2,
        warm: Math.random() < 0.4
      });
    }

    for (let i = 0; i < 26; i++) {
      ambient.fireflies.push({
        x: Math.random() * level.pxWidth,
        y: Math.random() * level.pxHeight,
        r: 1 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.5,
        warm: Math.random() < 0.5
      });
    }
  }

  // Stable pseudo-random in [0,1) from integer coordinates — used to give each
  // terrain tile consistent texture detail across frames.
  function hash2(x, y) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h ^= h >> 16;
    return (h >>> 0) / 4294967296;
  }

  // --------------------------------------------------------------------------
  // Physics helpers
  // --------------------------------------------------------------------------
  function tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return 1;
    return level.grid[ty * level.width + tx];
  }

  function isWall(tx, ty) { return tileAt(tx, ty) === 1; }
  function isPlatform(tx, ty) { return tileAt(tx, ty) === 3; }
  function isSolid(tx, ty) { const v = tileAt(tx, ty); return v === 1 || v === 3; }
  function spikeAt(tx, ty) { return tileAt(tx, ty) === 2; }

  function rectTileCollision(x, y, w, h, check) {
    const left = Math.floor(x / TILE);
    const right = Math.floor((x + w - 0.001) / TILE);
    const top = Math.floor(y / TILE);
    const bottom = Math.floor((y + h - 0.001) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (check(tx, ty)) return { tx, ty };
      }
    }
    return null;
  }

  function moveEntityX(e) {
    e.x += e.vx;
    const check = e === player ? isWall : isSolid;
    const hit = rectTileCollision(e.x, e.y, e.w, e.h, check);
    if (hit) {
      if (e.vx > 0) e.x = hit.tx * TILE - e.w;
      else if (e.vx < 0) e.x = (hit.tx + 1) * TILE;
      e.vx = 0;
      return true;
    }
    return false;
  }

  function moveEntityY(e) {
    const prevY = e.y;
    e.y += e.vy;

    if (e === player) {
      // Walls are fully solid
      const wallHit = rectTileCollision(e.x, e.y, e.w, e.h, isWall);
      if (wallHit) {
        if (e.vy > 0) e.y = wallHit.ty * TILE - e.h;
        else if (e.vy < 0) e.y = (wallHit.ty + 1) * TILE;
        e.vy = 0;
        return true;
      }
      // Platforms are one-way (land from above only)
      if (e.vy > 0) {
        const platHit = rectTileCollision(e.x, e.y, e.w, e.h, isPlatform);
        if (platHit && prevY + e.h <= platHit.ty * TILE) {
          e.y = platHit.ty * TILE - e.h;
          e.vy = 0;
          return true;
        }
      }
    } else {
      // Enemies treat platforms as solid
      const hit = rectTileCollision(e.x, e.y, e.w, e.h, isSolid);
      if (hit) {
        if (e.vy > 0) e.y = hit.ty * TILE - e.h;
        else if (e.vy < 0) e.y = (hit.ty + 1) * TILE;
        e.vy = 0;
        return true;
      }
    }
    return false;
  }

  function checkGround(e) {
    const left = Math.floor((e.x + 2) / TILE);
    const right = Math.floor((e.x + e.w - 2) / TILE);
    const ty = Math.floor((e.y + e.h + 1) / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tx, ty)) return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // Update
  // --------------------------------------------------------------------------
  function update(dt) {
    if (state !== 'playing') return;

    // Player input
    const left = isDown('ArrowLeft') || isDown('KeyA') || touchLeft;
    const right = isDown('ArrowRight') || isDown('KeyD') || touchRight;
    const jumpPressed = wasPressed('Space') || wasPressed('KeyZ') || wasPressed('KeyJ') || touchJumpPressed;
    const jumpHeld = isDown('Space') || isDown('KeyZ') || isDown('KeyJ') || touchJumpHeld;
    const attackPressed = wasPressed('KeyX') || wasPressed('KeyK') || touchAttackPressed;
    touchJumpPressed = false;
    touchAttackPressed = false;

    if (left) player.facing = -1;
    if (right) player.facing = 1;

    // Horizontal movement
    if (left && !right) {
      player.vx -= MOVE_ACCEL;
      if (player.vx < -MAX_SPEED) player.vx = -MAX_SPEED;
    } else if (right && !left) {
      player.vx += MOVE_ACCEL;
      if (player.vx > MAX_SPEED) player.vx = MAX_SPEED;
    } else {
      player.vx *= player.onGround ? MOVE_FRICTION : AIR_FRICTION;
      if (Math.abs(player.vx) < 0.05) player.vx = 0;
    }

    // Jump
    if (jumpPressed) player.jumpBuffer = JUMP_BUFFER;
    if (player.jumpBuffer > 0) player.jumpBuffer--;

    let canJump = player.onGround || player.coyote > 0;
    if (player.hasWing) {
      canJump = canJump || player.jumpsLeft > 0;
    }

    if (player.jumpBuffer > 0 && canJump) {
      if (!player.onGround && player.coyote <= 0 && player.hasWing && player.jumpsLeft > 0) {
        // double jump
        player.vy = JUMP_VEL;
        player.jumpsLeft--;
        player.jumpBuffer = 0;
        spawnParticles(player.x + player.w / 2, player.y + player.h, 8, 'rgba(127,211,255,0.7)', 4, 30);
        sfx('double');
      } else {
        player.vy = JUMP_VEL;
        player.onGround = false;
        player.coyote = 0;
        player.jumpBuffer = 0;
        if (player.hasWing) player.jumpsLeft = 1;
        spawnParticles(player.x + player.w / 2, player.y + player.h, 6, 'rgba(201,184,154,0.6)', 3, 25);
        sfx('jump');
      }
    }

    // Variable jump height
    if (!jumpHeld && player.vy < JUMP_CUT) {
      player.vy = JUMP_CUT;
    }

    // Gravity
    player.vy += GRAVITY;
    if (player.vy > 14) player.vy = 14;

    // Move X
    const oldX = player.x;
    moveEntityX(player);
    if (player.x !== oldX) {
      player.anim = Math.abs(player.vx) > 0.3 ? 'run' : 'idle';
    } else {
      player.anim = 'idle';
    }

    // Move Y
    const wasOnGround = player.onGround;
    moveEntityY(player);
    player.onGround = checkGround(player);
    if (player.onGround) {
      player.coyote = COYOTE_TIME;
      if (player.hasWing) player.jumpsLeft = 1;
      if (!wasOnGround) {
        spawnDust(player.x + player.w / 2, player.y + player.h, player.vx > 0 ? -1 : 1);
        sfx('land');
      }
    } else {
      player.coyote--;
    }

    // Boundaries
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.y > level.pxHeight + 200) die();

    // Spikes
    if (rectTileCollision(player.x + 4, player.y + 4, player.w - 8, player.h - 8, spikeAt)) {
      takeDamage(3);
    }

    // Attack
    if (player.attackCooldown > 0) player.attackCooldown--;
    if (player.attacking > 0) player.attacking--;

    if (attackPressed && player.hasNail && player.attackCooldown === 0) {
      player.attacking = ATTACK_DURATION;
      player.attackCooldown = ATTACK_COOLDOWN;
      sfx('attack');
      // check hits
      const ax = player.x + (player.facing > 0 ? player.w : -ATTACK_RANGE);
      const ay = player.y + player.h / 2 - ATTACK_WIDTH / 2;
      enemies.forEach(en => {
        if (en.health <= 0) return;
        if (rectsOverlap(ax, ay, ATTACK_RANGE, ATTACK_WIDTH, en.x, en.y, en.w, en.h)) {
          en.health--;
          en.hitFlash = 10;
          screenShake = 4;
          spawnParticles(en.x + en.w / 2, en.y + en.h / 2, 10, COLORS.enemyCore, 5, 35);
          sfx('hit');
          if (en.health <= 0) {
            spawnParticles(en.x + en.w / 2, en.y + en.h / 2, 16, COLORS.enemyCore, 6, 50);
            sfx('kill');
          }
        }
      });
    }

    // Invincibility
    if (player.invincible > 0) player.invincible--;

    // Enemy update
    enemies = enemies.filter(e => e.health > 0);
    enemies.forEach(en => {
      if (en.type === 'crawler') updateCrawler(en);
      else if (en.type === 'wisp') updateWisp(en);
      if (en.hitFlash > 0) en.hitFlash--;

      // Touch damage
      if (player.invincible <= 0 && rectsOverlap(player.x + 4, player.y + 4, player.w - 8, player.h - 8, en.x, en.y, en.w, en.h)) {
        takeDamage(1, en);
      }
    });

    // Collectibles
    collectibles.forEach(c => {
      if (c.taken) return;
      const dx = (player.x + player.w / 2) - c.x;
      const dy = (player.y + player.h / 2) - c.y;
      if (dx * dx + dy * dy < (c.r + 14) * (c.r + 14)) {
        c.taken = true;
        player.shards++;
        spawnParticles(c.x, c.y, 12, COLORS.shard, 4, 40);
        sfx('shard');
      }
    });

    // Power-ups
    powerUps.forEach(p => {
      if (p.taken) return;
      p.bob += 0.08;
      const dx = (player.x + player.w / 2) - p.x;
      const dy = (player.y + player.h / 2) - (p.y + Math.sin(p.bob) * 4);
      if (dx * dx + dy * dy < (p.r + 16) * (p.r + 16)) {
        p.taken = true;
        if (p.type === 'nail') player.hasNail = true;
        if (p.type === 'wing') player.hasWing = true;
        spawnParticles(p.x, p.y, 18, COLORS.power, 5, 60);
        sfx('power');
      }
    });

    // Door
    if (level.door && rectsOverlap(player.x, player.y, player.w, player.h, level.door.x + 4, level.door.y, level.door.w - 8, level.door.h)) {
      winLevel();
    }

    // Particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
    });
    particles = particles.filter(p => p.life > 0);

    // Animation timer
    player.animTimer++;

    // Camera
    updateCamera();

    // Screen shake decay
    if (screenShake > 0) screenShake *= 0.85;
    if (screenShake < 0.5) screenShake = 0;

    // HUD
    updateHud();
  }

  function updateCrawler(e) {
    e.x += e.vx;

    // Wall collision
    const wall = rectTileCollision(e.x, e.y, e.w, e.h, isSolid);
    if (wall) {
      e.vx *= -1;
      e.x += e.vx * 2;
    }

    // Floor ahead: check tile below the leading foot
    const leadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
    const footY = e.y + e.h + 2;
    const floorAhead = isSolid(Math.floor(leadX / TILE), Math.floor(footY / TILE));
    if (!floorAhead) {
      e.vx *= -1;
      e.x += e.vx * 2;
    }

    // Patrol clamp
    if (e.x < e.patrolLeft) e.vx = Math.abs(e.vx);
    if (e.x > e.patrolRight) e.vx = -Math.abs(e.vx);

    // Advance the leg walk cycle based on travel
    e.walkPhase += Math.abs(e.vx) * 0.35;
  }

  function updateWisp(e) {
    e.phase += 0.04;
    e.glowPhase += 0.07;
    e.x = e.originX + Math.sin(e.phase) * 50;
    e.y = e.originY + Math.cos(e.phase * 1.3) * 20;
    // Record a short motion trail for the spirit's wispy tail
    e.trail.unshift({ x: e.x + e.w / 2, y: e.y + e.h / 2 });
    if (e.trail.length > 8) e.trail.pop();
  }

  function takeDamage(amount, source) {
    if (player.invincible > 0 || player.dead) return;
    player.health -= amount;
    player.invincible = INVINCIBLE_TIME;
    screenShake = 8;
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 14, COLORS.playerEye, 5, 45);
    sfx('hurt');

    if (source) {
      const cx = source.x + source.w / 2;
      const dir = (player.x + player.w / 2) < cx ? -1 : 1;
      player.vx = dir * KNOCKBACK_X;
    } else {
      player.vx = -player.facing * KNOCKBACK_X;
    }
    player.vy = KNOCKBACK_Y;

    if (player.health <= 0) die();
  }

  function die() {
    if (player.dead) return;
    player.dead = true;
    sfx('die');
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 30, COLORS.playerEye, 6, 70);
    setTimeout(() => {
      showScreen('screen-death');
      state = 'death';
    }, 600);
  }

  function winLevel() {
    if (state !== 'playing') return;
    state = 'win';
    sfx('win');
    saveProgress();
    const totalShards = collectibles.length;
    document.getElementById('win-stats').textContent =
      `Shards ${player.shards}/${totalShards} · Health ${player.health}/${MAX_HEALTH}`;
    const nextBtn = document.getElementById('btn-next');
    nextBtn.hidden = currentLevelIdx >= LEVELS.length - 1;
    showScreen('screen-win');
  }

  // --------------------------------------------------------------------------
  // Camera
  // --------------------------------------------------------------------------
  function updateCamera() {
    const targetX = player.x + player.w / 2 - lw() / 2;
    const targetY = player.y + player.h / 2 - lh() / 2;
    camera.x += (targetX - camera.x) * 0.08;
    camera.y += (targetY - camera.y) * 0.08;
    clampCamera();
  }

  function clampCamera() {
    camera.x = Math.max(0, Math.min(camera.x, level.pxWidth - lw()));
    camera.y = Math.max(0, Math.min(camera.y, level.pxHeight - lh()));
    if (level.pxWidth < lw()) camera.x = (level.pxWidth - lw()) / 2;
    if (level.pxHeight < lh()) camera.y = (level.pxHeight - lh()) / 2;
  }

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  function draw() {
    const w = lw();
    const h = lh();
    ctx.clearRect(0, 0, w, h);

    if (!level) return;
    if (!textures) buildTextures();

    // Layered background gradient — deep cavern dusk
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1b1230');
    grad.addColorStop(0.45, '#140d24');
    grad.addColorStop(1, '#070410');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // A soft volumetric glow high in the cavern
    const halo = ctx.createRadialGradient(w * 0.5, h * 0.1, 0, w * 0.5, h * 0.1, h * 0.9);
    halo.addColorStop(0, 'rgba(127,211,255,0.10)');
    halo.addColorStop(1, 'rgba(127,211,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    const shakeX = (Math.random() - 0.5) * screenShake;
    const shakeY = (Math.random() - 0.5) * screenShake;

    // Parallax cavern layers + drifting motes
    drawParallax(shakeX, shakeY);

    ctx.save();
    ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

    // Tiles
    drawTiles();

    // Ambient lantern light radiating from the player
    if (!player.dead) drawPlayerLight();

    // Door
    if (level.door) drawDoor(level.door);

    // Collectibles
    collectibles.forEach(c => { if (!c.taken) drawShard(c); });

    // Power-ups
    powerUps.forEach(p => { if (!p.taken) drawPowerUp(p); });

    // Enemies
    enemies.forEach(drawEnemy);

    // Player
    if (!player.dead) drawPlayer();

    // Particles
    particles.forEach(drawParticle);

    ctx.restore();

    // Foreground atmosphere drawn in screen space
    drawForeground(w, h);
  }

  // Soft warm/cool lantern glow that follows the vessel, lighting the cavern.
  function drawPlayerLight() {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    const pulse = 1 + Math.sin(Date.now() * 0.004) * 0.06;
    const r = 230 * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(150,224,255,0.20)');
    g.addColorStop(0.4, 'rgba(120,180,255,0.08)');
    g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Drifting fog banks and a vignette pulled across the very front of the scene.
  function drawForeground(w, h) {
    // Low rolling fog
    const fog = ctx.createLinearGradient(0, h, 0, h - 160);
    fog.addColorStop(0, 'rgba(40,28,64,0.55)');
    fog.addColorStop(1, 'rgba(40,28,64,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, h - 160, w, 160);

    // Subtle top haze
    const top = ctx.createLinearGradient(0, 0, 0, 120);
    top.addColorStop(0, 'rgba(10,6,18,0.5)');
    top.addColorStop(1, 'rgba(10,6,18,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, 120);
  }

  function drawParallax(sx, sy) {
    const now = Date.now();
    const pf = level.parallax;
    const ph = level.pxHeight;

    // --- Far glowing orbs (deepest layer) ---
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(-camera.x * 0.18 + sx * 0.3, -camera.y * 0.18 + sy * 0.3);
    ambient.orbs.forEach(o => {
      const a = 0.10 + 0.05 * Math.sin(now * 0.001 + o.phase);
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      const col = o.warm ? '240,167,62' : '127,211,255';
      g.addColorStop(0, 'rgba(' + col + ',' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // --- Distant ruined pillars ---
    ctx.save();
    ctx.translate(-camera.x * pf[0] + sx * 0.4, -camera.y * pf[0] * 0.5 + sy * 0.4);
    ambient.pillars.forEach(p => {
      const top = p.top;
      const bottom = ph;
      ctx.fillStyle = 'rgba(38,28,58,0.55)';
      ctx.fillRect(p.x, top, p.w, bottom - top);
      // Capital / broken crown
      ctx.fillStyle = 'rgba(48,36,72,0.55)';
      if (p.broken) {
        ctx.beginPath();
        ctx.moveTo(p.x - 4, top + 14);
        ctx.lineTo(p.x + p.w * 0.5, top - 6);
        ctx.lineTo(p.x + p.w + 4, top + 18);
        ctx.lineTo(p.x + p.w + 4, top + 24);
        ctx.lineTo(p.x - 4, top + 24);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(p.x - 5, top, p.w + 10, 12);
      }
      // Faint vertical fluting highlight
      ctx.fillStyle = 'rgba(127,211,255,0.05)';
      ctx.fillRect(p.x + p.w * 0.5 - 1, top, 2, bottom - top);
    });
    ctx.restore();

    // --- Stalactites above and stalagmites below ---
    ctx.save();
    ctx.translate(-camera.x * pf[1] + sx * 0.5, sy * 0.5);
    ambient.stalactites.forEach(s => {
      ctx.fillStyle = 'rgba(30,22,46,0.7)';
      ctx.beginPath();
      if (s.up) {
        const baseY = ph - camera.y * pf[1];
        ctx.moveTo(s.x, baseY);
        ctx.lineTo(s.x + s.w / 2, baseY - s.h);
        ctx.lineTo(s.x + s.w, baseY);
      } else {
        const topY = -camera.y * pf[1];
        ctx.moveTo(s.x, topY);
        ctx.lineTo(s.x + s.w / 2, topY + s.h);
        ctx.lineTo(s.x + s.w, topY);
      }
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // --- Glittering motes across three depth layers ---
    const layerCol = ['127,211,255', '201,184,154', '240,167,62'];
    pf.forEach((factor, layer) => {
      ctx.save();
      ctx.translate(-camera.x * factor + sx * 0.5, -camera.y * factor + sy * 0.5);
      ctx.fillStyle = 'rgba(' + layerCol[layer] + ',1)';
      stars.forEach(s => {
        if (s.layer !== layer) return;
        const x = s.x % (level.pxWidth + 200) - 100;
        const y = s.y % (level.pxHeight + 200) - 100;
        const blink = 0.5 + 0.5 * Math.sin(now * 0.003 + s.blink);
        ctx.globalAlpha = blink * (0.25 + layer * 0.12);
        ctx.beginPath();
        ctx.arc(x, y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    });

    // --- Near drifting fireflies with soft glow ---
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(-camera.x * 0.7 + sx * 0.7, -camera.y * 0.7 + sy * 0.7);
    ambient.fireflies.forEach(f => {
      const fx = f.x + Math.sin(now * 0.0006 * f.speed + f.phase) * 40;
      const fy = f.y + Math.cos(now * 0.0005 * f.speed + f.phase) * 30;
      const a = 0.35 + 0.35 * Math.sin(now * 0.004 + f.phase);
      const col = f.warm ? '243,179,103' : '143,220,255';
      ctx.fillStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(fx, fy, f.r * 2.5, 0, Math.PI * 2);
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(fx, fy, f.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    ctx.globalAlpha = 1;
  }

  // --- Pre-rendered terrain textures (built once, reused every frame) ---
  function buildTextures() {
    textures = { rock: [], platform: null, spike: null };
    for (let v = 0; v < 4; v++) textures.rock.push(makeRockTexture(v));
    textures.platform = makePlatformTexture();
    textures.spike = makeSpikeTexture();
  }

  function makeRockTexture(variant) {
    const cnv = document.createElement('canvas');
    cnv.width = TILE; cnv.height = TILE;
    const c = cnv.getContext('2d');
    // Base vertical gradient gives each block volume
    const g = c.createLinearGradient(0, 0, 0, TILE);
    g.addColorStop(0, '#352845');
    g.addColorStop(0.5, '#271c3b');
    g.addColorStop(1, '#1a1230');
    c.fillStyle = g;
    c.fillRect(0, 0, TILE, TILE);

    // Mineral speckles
    for (let i = 0; i < 26; i++) {
      const r = hash2(variant * 31 + i, i * 7);
      const r2 = hash2(i * 13, variant * 17 + i);
      const px = r * TILE, py = r2 * TILE;
      const bright = hash2(i, variant) > 0.7;
      c.fillStyle = bright ? 'rgba(143,220,255,0.10)' : 'rgba(0,0,0,0.18)';
      c.fillRect(px, py, 1 + (r > 0.85 ? 1 : 0), 1 + (r2 > 0.85 ? 1 : 0));
    }

    // A couple of crevice cracks
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      let cx = hash2(variant + i, 99) * TILE;
      let cy = hash2(99, variant + i) * 8;
      c.beginPath();
      c.moveTo(cx, cy);
      for (let s = 0; s < 4; s++) {
        cx += (hash2(cx + s, cy) - 0.5) * 10;
        cy += TILE / 4;
        c.lineTo(cx, cy);
      }
      c.stroke();
    }

    // Inner ambient occlusion (darker toward edges)
    const vg = c.createRadialGradient(TILE / 2, TILE / 2, 4, TILE / 2, TILE / 2, TILE);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.4)');
    c.fillStyle = vg;
    c.fillRect(0, 0, TILE, TILE);
    return cnv;
  }

  function makePlatformTexture() {
    const cnv = document.createElement('canvas');
    cnv.width = TILE; cnv.height = TILE;
    const c = cnv.getContext('2d');
    // Floating stone slab in the top portion of the tile
    const g = c.createLinearGradient(0, 0, 0, 12);
    g.addColorStop(0, '#3a2c54');
    g.addColorStop(1, '#231833');
    c.fillStyle = g;
    c.fillRect(0, 0, TILE, 11);
    // Lit top
    c.fillStyle = 'rgba(143,220,255,0.85)';
    c.fillRect(0, 0, TILE, 2);
    c.fillStyle = 'rgba(143,220,255,0.25)';
    c.fillRect(0, 2, TILE, 1);
    // Underside shadow / hanging bits
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(0, 9, TILE, 2);
    for (let i = 0; i < 4; i++) {
      const px = 3 + i * 8 + (hash2(i, 5) * 3);
      c.fillRect(px, 11, 2, 2 + Math.floor(hash2(px, i) * 3));
    }
    return cnv;
  }

  function makeSpikeTexture() {
    const cnv = document.createElement('canvas');
    cnv.width = TILE; cnv.height = TILE;
    const c = cnv.getContext('2d');
    // Dark base
    c.fillStyle = '#1a1020';
    c.fillRect(0, TILE - 5, TILE, 5);
    // Three bone spikes
    const spikes = [[0, TILE / 3], [TILE / 3, TILE * 2 / 3], [TILE * 2 / 3, TILE]];
    spikes.forEach(([x0, x1], i) => {
      const midX = (x0 + x1) / 2;
      const g = c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, '#7a2233');
      g.addColorStop(0.5, '#ff7d7d');
      g.addColorStop(1, '#7a2233');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(midX, 3 + i % 2);
      c.lineTo(x1 - 1, TILE - 3);
      c.lineTo(x0 + 1, TILE - 3);
      c.closePath();
      c.fill();
      // Glint
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(midX, 4 + i % 2);
      c.lineTo(midX - 2, TILE - 6);
      c.stroke();
    });
    return cnv;
  }

  function drawTiles() {
    const startX = Math.floor(camera.x / TILE) - 1;
    const startY = Math.floor(camera.y / TILE) - 1;
    const endX = startX + Math.ceil(lw() / TILE) + 2;
    const endY = startY + Math.ceil(lh() / TILE) + 2;

    for (let ty = startY; ty <= endY; ty++) {
      for (let tx = startX; tx <= endX; tx++) {
        const t = tileAt(tx, ty);
        if (t === 0) continue;
        const x = tx * TILE;
        const y = ty * TILE;

        if (t === 1) {
          // Solid rock — pre-rendered texture, variant chosen by position
          const v = Math.floor(hash2(tx, ty) * textures.rock.length);
          ctx.drawImage(textures.rock[v], x, y);

          const openAbove = !isSolid(tx, ty - 1);
          const openLeft = !isSolid(tx - 1, ty);
          const openRight = !isSolid(tx + 1, ty);

          // Lit, mossy top crust where the rock meets open air
          if (openAbove) {
            ctx.fillStyle = COLORS.tileTop;
            ctx.fillRect(x, y, TILE, 4);
            ctx.fillStyle = COLORS.tileEdge;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(x, y, TILE, 1);
            ctx.globalAlpha = 1;
            drawTileCrust(tx, ty, x, y, openLeft, openRight);
          }
          // Cool rim light on exposed vertical faces
          if (openLeft) {
            ctx.fillStyle = 'rgba(143,220,255,0.22)';
            ctx.fillRect(x, y, 2, TILE);
          }
          if (openRight) {
            ctx.fillStyle = 'rgba(143,220,255,0.22)';
            ctx.fillRect(x + TILE - 2, y, 2, TILE);
          }
        } else if (t === 3) {
          // One-way platform
          ctx.drawImage(textures.platform, x, y);
        } else if (t === 2) {
          ctx.drawImage(textures.spike, x, y);
        }
      }
    }
  }

  // Decorative crust on exposed rock tops: rocky bumps, tufts of moss,
  // and the occasional glowing crystal or mushroom cluster.
  function drawTileCrust(tx, ty, x, y, openLeft, openRight) {
    const now = Date.now();
    // Rocky silhouette bumps
    ctx.fillStyle = COLORS.tileTop;
    for (let i = 0; i < 3; i++) {
      const bx = x + 4 + i * 9 + hash2(tx + i, ty) * 4;
      const bh = 2 + hash2(tx, ty + i) * 3;
      ctx.beginPath();
      ctx.ellipse(bx, y, 4, bh, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    const deco = hash2(tx * 3, ty * 5);
    const dx = x + TILE / 2 + (hash2(tx, ty) - 0.5) * 10;
    if (deco > 0.82) {
      // Glowing crystal cluster
      const sway = Math.sin(now * 0.002 + tx) * 0.5;
      ctx.save();
      ctx.shadowColor = COLORS.crystal;
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS.crystal;
      for (let i = -1; i <= 1; i++) {
        const h = 7 + (i === 0 ? 5 : 0) + hash2(tx + i, ty) * 3;
        const cx = dx + i * 4;
        ctx.beginPath();
        ctx.moveTo(cx, y - h);
        ctx.lineTo(cx + 2.2, y - 1);
        ctx.lineTo(cx - 2.2, y - 1);
        ctx.closePath();
        ctx.globalAlpha = 0.85;
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (deco > 0.62) {
      // Glowing mushroom
      const glow = 0.6 + 0.4 * Math.sin(now * 0.003 + tx);
      const stalkH = 6 + hash2(tx, ty) * 4;
      ctx.fillStyle = '#cdbfa0';
      ctx.fillRect(dx - 1, y - stalkH, 2, stalkH);
      ctx.save();
      ctx.shadowColor = COLORS.mushroom;
      ctx.shadowBlur = 8 * glow;
      ctx.fillStyle = COLORS.mushroom;
      ctx.beginPath();
      ctx.ellipse(dx, y - stalkH, 4, 3, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (deco > 0.4) {
      // Moss tuft
      ctx.strokeStyle = COLORS.moss;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(dx + i * 2, y);
        ctx.lineTo(dx + i * 2 + i, y - 4 - Math.abs(i));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawDoor(d) {
    const now = Date.now();
    const cx = d.x + d.w / 2;
    const flicker = 0.85 + Math.sin(now * 0.008) * 0.1 + Math.sin(now * 0.021) * 0.05;

    // Tall archway carved into the rock, reaching above the tile
    const archTop = d.y - TILE * 1.2;
    const archH = d.y + d.h - archTop;
    ctx.save();

    // Outer glow pool
    ctx.globalCompositeOperation = 'lighter';
    const pool = ctx.createRadialGradient(cx, d.y + d.h / 2, 0, cx, d.y + d.h / 2, 70 * flicker);
    pool.addColorStop(0, 'rgba(243,179,103,0.35)');
    pool.addColorStop(1, 'rgba(243,179,103,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(cx - 80, archTop - 30, 160, archH + 80);
    ctx.globalCompositeOperation = 'source-over';

    // Stone frame
    ctx.fillStyle = '#241a33';
    ctx.beginPath();
    ctx.moveTo(d.x - 6, d.y + d.h);
    ctx.lineTo(d.x - 6, archTop + 16);
    ctx.quadraticCurveTo(cx, archTop - 12, d.x + d.w + 6, archTop + 16);
    ctx.lineTo(d.x + d.w + 6, d.y + d.h);
    ctx.closePath();
    ctx.fill();

    // Glowing portal interior
    const inner = ctx.createLinearGradient(0, archTop, 0, d.y + d.h);
    inner.addColorStop(0, 'rgba(255,224,170,' + (0.9 * flicker).toFixed(3) + ')');
    inner.addColorStop(0.5, 'rgba(240,167,62,' + (0.6 * flicker).toFixed(3) + ')');
    inner.addColorStop(1, 'rgba(120,70,30,0.25)');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y + d.h);
    ctx.lineTo(d.x, archTop + 20);
    ctx.quadraticCurveTo(cx, archTop, d.x + d.w, archTop + 20);
    ctx.lineTo(d.x + d.w, d.y + d.h);
    ctx.closePath();
    ctx.fill();

    // Hanging lantern at the apex
    ctx.shadowColor = COLORS.door;
    ctx.shadowBlur = 14 * flicker;
    ctx.fillStyle = '#ffe6a8';
    ctx.beginPath();
    ctx.arc(cx, archTop + 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#3a2c1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, archTop - 8);
    ctx.lineTo(cx, archTop + 1);
    ctx.stroke();

    // Frame outline runes
    ctx.strokeStyle = 'rgba(243,179,103,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y + d.h);
    ctx.lineTo(d.x, archTop + 20);
    ctx.quadraticCurveTo(cx, archTop, d.x + d.w, archTop + 20);
    ctx.lineTo(d.x + d.w, d.y + d.h);
    ctx.stroke();

    ctx.restore();
  }

  function drawShard(c) {
    const now = Date.now();
    const bob = Math.sin(now * 0.006 + c.x) * 3;
    const cx = c.x;
    const cy = c.y + bob;
    const r = c.r;
    const spin = 0.85 + 0.15 * Math.sin(now * 0.004 + c.x);

    ctx.save();
    // Glow pool
    ctx.shadowColor = COLORS.shard;
    ctx.shadowBlur = 14;

    // Faceted crystal — bright front face + shaded back face
    ctx.fillStyle = '#fff1c2';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.7 * spin, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx, cy - r);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.shard;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx - r * 0.7 * spin, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx, cy - r);
    ctx.closePath();
    ctx.fill();

    // Center seam highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // Sparkle
    const tw = (Math.sin(now * 0.008 + c.x) + 1) * 0.5;
    ctx.globalAlpha = tw;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - r * 0.25, cy - r * 0.45, 2, 2);
    ctx.restore();
  }

  function drawPowerUp(p) {
    const now = Date.now();
    const bob = Math.sin(p.bob) * 5;
    const y = p.y + bob;
    const pulse = 0.8 + 0.2 * Math.sin(now * 0.005);

    ctx.save();
    // Halo
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, y, 0, p.x, y, 26 * pulse);
    g.addColorStop(0, 'rgba(167,139,250,0.5)');
    g.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, y, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Rotating rune ring
    ctx.strokeStyle = 'rgba(196,181,253,0.7)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const a = now * 0.0015 + i * Math.PI / 3;
      const rx = p.x + Math.cos(a) * 15;
      const ry = y + Math.sin(a) * 15;
      ctx.beginPath();
      ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#c4b5fd';
      ctx.fill();
    }

    // Core orb
    ctx.shadowColor = COLORS.power;
    ctx.shadowBlur = 16;
    const core = ctx.createRadialGradient(p.x - 3, y - 3, 1, p.x, y, 11);
    core.addColorStop(0, '#efeaff');
    core.addColorStop(1, COLORS.power);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(p.x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Emblem
    ctx.fillStyle = '#fff';
    ctx.font = '700 13px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.type === 'nail' ? '⚔' : '✦', p.x, y + 1);
    ctx.restore();
  }

  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(Date.now() / 40) % 2 === 0) return;

    const t = player.animTimer;
    const footY = player.y + player.h;
    const cx = player.x + player.w / 2;

    // Blink timing
    if (player.blink > 0) player.blink--;
    if (player.blinkTimer-- <= 0) { player.blink = 7; player.blinkTimer = 120 + Math.random() * 160; }

    const moving = player.anim === 'run' && player.onGround;
    const airborne = !player.onGround;
    const rising = player.vy < -0.5;
    const breathe = (!moving && !airborne) ? Math.sin(t * 0.08) * 1.2 : 0;
    const sway = Math.sin(t * 0.18) * (moving ? 4.5 : airborne ? 6 : 1.6);
    const runBob = moving ? Math.abs(Math.sin(t * 0.4)) * -2.5 : 0;
    const bodyY = -20 + breathe + runBob;
    const headY = bodyY - 19;

    ctx.save();
    ctx.translate(cx, footY);

    // --- Ground shadow (unflipped) ---
    if (!airborne) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, -1, 13, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.scale(player.facing, 1); // draw facing right; +x is forward

    // --- Legs ---
    let legFront, legBack;
    if (airborne) {
      legFront = rising ? -3 : 5;
      legBack = rising ? -6 : 2;
    } else if (moving) {
      const s = Math.sin(t * 0.4) * 6;
      legFront = s; legBack = -s;
    } else {
      legFront = 2; legBack = -2;
    }
    drawVesselLeg(-3, legBack);
    drawVesselLeg(3, legFront);

    // --- Back cloak (sways behind the body) ---
    drawCloak(bodyY, sway * 1.4 + (airborne ? -4 : 0), COLORS.cloak, 15);

    // --- Body / torso ---
    const bodyGrad = ctx.createLinearGradient(-12, 0, 12, 0);
    bodyGrad.addColorStop(0, '#0c0712');
    bodyGrad.addColorStop(0.5, COLORS.cloak);
    bodyGrad.addColorStop(1, '#241a33');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, bodyY, 11, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Front cloak with trim ---
    drawCloak(bodyY, sway, COLORS.cloakLit, 12);

    // Rim light along the shoulders/back
    ctx.strokeStyle = 'rgba(143,220,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-1, bodyY - 1, 11, 14, 0, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();

    // --- Mask / head ---
    drawVesselHead(headY);

    // --- Nail weapon ---
    drawVesselNail(bodyY);

    ctx.restore();
  }

  function drawVesselLeg(hipX, swing) {
    ctx.strokeStyle = '#0a0610';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const kneeX = hipX + swing * 0.5;
    const footX = hipX + swing;
    ctx.beginPath();
    ctx.moveTo(hipX, -9);
    ctx.quadraticCurveTo(kneeX, -5, footX, 0);
    ctx.stroke();
  }

  // Flowing cloak: a bell shape from the shoulders down to a wavy hem.
  function drawCloak(bodyY, sway, color, halfW) {
    const topY = bodyY - 6;
    const hemY = -2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.55, topY);
    // Left side down to hem
    ctx.quadraticCurveTo(-halfW - 2 + sway * 0.3, bodyY + 6, -halfW + sway, hemY);
    // Wavy hem across the bottom
    ctx.quadraticCurveTo(-halfW * 0.4 + sway, hemY + 4, 0, hemY + 1);
    ctx.quadraticCurveTo(halfW * 0.4 + sway, hemY + 4, halfW + sway, hemY);
    // Right side up to shoulder
    ctx.quadraticCurveTo(halfW + 2 + sway * 0.3, bodyY + 6, halfW * 0.55, topY);
    ctx.closePath();
    ctx.fill();

    // Trim glow along the hem
    ctx.strokeStyle = 'rgba(74,58,102,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-halfW + sway, hemY);
    ctx.quadraticCurveTo(-halfW * 0.4 + sway, hemY + 4, 0, hemY + 1);
    ctx.quadraticCurveTo(halfW * 0.4 + sway, hemY + 4, halfW + sway, hemY);
    ctx.stroke();
  }

  function drawVesselHead(headY) {
    // Horns sweeping up and out
    ctx.fillStyle = COLORS.maskPale;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 6, headY - 5);
      ctx.quadraticCurveTo(dir * 15, headY - 13, dir * 11, headY - 22);
      ctx.quadraticCurveTo(dir * 12, headY - 13, dir * 3.5, headY - 8);
      ctx.closePath();
      ctx.fill();
    }

    // Mask base
    const mg = ctx.createLinearGradient(0, headY - 11, 0, headY + 11);
    mg.addColorStop(0, COLORS.maskPale);
    mg.addColorStop(1, COLORS.maskShade);
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.ellipse(0, headY, 10, 11.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lower face shadow
    ctx.fillStyle = 'rgba(13,8,20,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, headY + 3, 8.5, 8, 0, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.fill();

    // Eye sockets (forward-biased)
    ctx.fillStyle = '#0b0612';
    ctx.beginPath();
    ctx.ellipse(-3, headY - 1, 2.8, 4.2, 0.25, 0, Math.PI * 2);
    ctx.ellipse(4, headY - 1, 2.8, 4.2, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Glowing eyes (unless blinking)
    if (player.blink <= 0) {
      ctx.save();
      ctx.shadowColor = COLORS.playerEye;
      ctx.shadowBlur = 9;
      ctx.fillStyle = COLORS.playerEye;
      ctx.beginPath();
      ctx.ellipse(-3, headY - 1, 1.7, 3, 0.25, 0, Math.PI * 2);
      ctx.ellipse(4, headY - 1, 1.7, 3, -0.25, 0, Math.PI * 2);
      ctx.fill();
      // Bright centers
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#eaffff';
      ctx.fillRect(-3.6, headY - 2.5, 1.2, 1.6);
      ctx.fillRect(3.4, headY - 2.5, 1.2, 1.6);
      ctx.restore();
    }
  }

  function drawVesselNail(bodyY) {
    if (!player.hasNail) return;

    if (player.attacking > 0) {
      // Slashing arc in front of the vessel
      const progress = 1 - player.attacking / ATTACK_DURATION;
      const ang = -0.9 + progress * 1.8;
      ctx.save();
      ctx.translate(10, bodyY + 2);
      ctx.rotate(ang);
      // Glowing crescent trail
      ctx.globalCompositeOperation = 'lighter';
      const arcAlpha = Math.sin(progress * Math.PI);
      ctx.strokeStyle = 'rgba(196,181,253,' + (0.6 * arcAlpha).toFixed(3) + ')';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 30, -0.7, 0.7);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      // The nail itself
      ctx.shadowColor = '#c4b5fd';
      ctx.shadowBlur = 12;
      const ng = ctx.createLinearGradient(0, 0, 40, 0);
      ng.addColorStop(0, '#9a8fc0');
      ng.addColorStop(1, '#eae6ff');
      ctx.strokeStyle = ng;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(40, 0);
      ctx.stroke();
      ctx.restore();
    } else {
      // Nail resting at the side
      ctx.save();
      ctx.translate(7, bodyY + 4);
      ctx.rotate(0.5);
      ctx.strokeStyle = '#8f86ad';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 18);
      ctx.stroke();
      // Hilt
      ctx.strokeStyle = '#5b4f7a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemy(e) {
    const flash = e.hitFlash > 0 && Math.floor(Date.now() / 30) % 2 === 0;
    if (e.type === 'crawler') drawCrawler(e, flash);
    else if (e.type === 'wisp') drawWisp(e, flash);
  }

  function drawCrawler(e, flash) {
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    const dir = Math.sign(e.vx) || -1;

    ctx.save();
    // Contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, e.y + e.h - 1, e.w / 2 - 1, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Animated legs (3 per side)
    ctx.strokeStyle = flash ? '#fff' : '#140a18';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const lx = cx + (i - 1) * 8;
      const swing = Math.sin(e.walkPhase + i * 1.4) * 3;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(lx, cy + 4);
        ctx.lineTo(lx + s * 9, cy + 10 + swing * s * 0.4);
        ctx.stroke();
      }
    }

    // Segmented carapace
    const bodyGrad = ctx.createLinearGradient(0, cy - e.h / 2, 0, cy + e.h / 2);
    bodyGrad.addColorStop(0, flash ? '#fff' : '#3a1228');
    bodyGrad.addColorStop(1, flash ? '#fff' : COLORS.enemy);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, e.w / 2, e.h / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shell ridge highlight
    ctx.strokeStyle = 'rgba(255,120,120,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2, e.w / 2 - 3, e.h / 2 - 4, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Glowing cracks along the segments
    if (!flash) {
      ctx.save();
      ctx.shadowColor = COLORS.enemyCore;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = COLORS.enemyCore;
      ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 7, cy - 5);
        ctx.lineTo(cx + i * 7, cy + 5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Head with mandibles and glowing eyes
    const hx = cx + dir * (e.w / 2 - 2);
    ctx.fillStyle = flash ? '#fff' : '#240a16';
    ctx.beginPath();
    ctx.ellipse(hx, cy + 1, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = flash ? '#fff' : '#240a16';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx + dir * 4, cy - 1);
    ctx.lineTo(hx + dir * 9, cy - 3);
    ctx.moveTo(hx + dir * 4, cy + 3);
    ctx.lineTo(hx + dir * 9, cy + 5);
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = COLORS.enemyCore;
    ctx.shadowBlur = 6;
    ctx.fillStyle = flash ? '#fff' : '#ffd0a0';
    ctx.beginPath();
    ctx.arc(hx + dir * 1.5, cy, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawWisp(e, flash) {
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    const now = Date.now();
    const pulse = 0.75 + 0.25 * Math.sin(e.glowPhase);

    ctx.save();

    // Trailing wispy tail
    ctx.globalCompositeOperation = 'lighter';
    for (let i = e.trail.length - 1; i >= 0; i--) {
      const tp = e.trail[i];
      const a = (1 - i / e.trail.length) * 0.25;
      const r = (1 - i / e.trail.length) * 8 + 2;
      ctx.fillStyle = 'rgba(127,211,255,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer glow aura
    const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22 * pulse);
    aura.addColorStop(0, 'rgba(127,211,255,0.45)');
    aura.addColorStop(1, 'rgba(127,211,255,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, 22 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Floating embers
    for (let i = 0; i < 4; i++) {
      const a = now * 0.003 + i * Math.PI / 2 + e.phase;
      const ex = cx + Math.cos(a) * 12;
      const ey = cy + Math.sin(a) * 12;
      ctx.fillStyle = 'rgba(170,230,255,0.6)';
      ctx.beginPath();
      ctx.arc(ex, ey, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ghostly body
    ctx.fillStyle = flash ? '#fff' : COLORS.wisp;
    ctx.beginPath();
    ctx.moveTo(cx, cy - e.h / 2);
    ctx.quadraticCurveTo(cx + e.w / 2, cy, cx + 3, cy + e.h / 2 + 3);
    ctx.quadraticCurveTo(cx, cy + e.h / 2, cx - 3, cy + e.h / 2 + 3);
    ctx.quadraticCurveTo(cx - e.w / 2, cy, cx, cy - e.h / 2);
    ctx.fill();

    // Bright core
    ctx.shadowColor = COLORS.wispCore;
    ctx.shadowBlur = 14;
    const core = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, 6);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(1, flash ? '#fff' : COLORS.wispCore);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Hollow eyes
    ctx.fillStyle = 'rgba(10,20,35,0.8)';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 1, 1.3, 0, Math.PI * 2);
    ctx.arc(cx + 2, cy - 1, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawParticle(p) {
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Soft glow
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 1.6, 0, Math.PI * 2);
    ctx.fill();
    // Bright core
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------
  function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  // --------------------------------------------------------------------------
  // UI / screens
  // --------------------------------------------------------------------------
  function showScreen(id) {
    document.querySelectorAll('.overlay').forEach(el => el.hidden = true);
    document.getElementById('hud').hidden = true;
    document.getElementById('board').hidden = true;
    if (id) {
      document.getElementById(id).hidden = false;
      document.getElementById('board').hidden = false;
    }
  }

  function startGame(idx) {
    ensureAudio();
    loadLevel(idx);
    state = 'playing';
    showScreen(null);
    document.getElementById('hud').hidden = false;
    document.getElementById('level-name').textContent = level.name;
    document.getElementById('level-hint').textContent = level.hint;
    updateHud();
  }

  function restartLevel() {
    startGame(currentLevelIdx);
  }

  function openPause() {
    state = 'paused';
    showScreen('screen-pause');
  }

  function resumeGame() {
    state = 'playing';
    showScreen(null);
    document.getElementById('hud').hidden = false;
  }

  function buildLevelSelect() {
    const grid = document.getElementById('select-grid');
    const progress = getProgress();
    grid.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const btn = document.createElement('button');
      btn.className = 'level-btn' + (progress[i] ? ' cleared' : '');
      btn.textContent = i + 1;
      btn.disabled = i > 0 && !progress[i - 1];
      btn.addEventListener('click', () => startGame(i));
      grid.appendChild(btn);
    });
  }

  function getProgress() {
    try {
      return JSON.parse(localStorage.getItem('shade-progress')) || [];
    } catch (e) { return []; }
  }

  function saveProgress() {
    const progress = getProgress();
    progress[currentLevelIdx] = true;
    try { localStorage.setItem('shade-progress', JSON.stringify(progress)); } catch (e) {}
  }

  function updateHud() {
    document.getElementById('shards').textContent = player.shards;
    document.getElementById('hearts').textContent = '♥'.repeat(Math.max(0, player.health)) + '♡'.repeat(Math.max(0, MAX_HEALTH - player.health));
    const hintEl = document.getElementById('level-hint');
    if (player.hasWing && player.hasNail) hintEl.textContent = 'All powers awakened.';
    else if (player.hasNail && !player.hasWing) hintEl.textContent = 'You wield the Void Nail.';
    else if (!player.hasNail && player.hasWing) hintEl.textContent = 'Moth Wings carry you.';
  }

  function updateMuteButtons() {
    const label = muted ? '🔇 Muted' : '🔊 Sound';
    document.getElementById('btn-mute-menu').textContent = label;
    const hudBtn = document.getElementById('btn-mute');
    if (hudBtn) hudBtn.textContent = muted ? '🔇' : '🔊';
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('shade-muted', muted); } catch (e) {}
    updateMuteButtons();
  }

  // --------------------------------------------------------------------------
  // Event binding
  // --------------------------------------------------------------------------
  document.getElementById('btn-start').addEventListener('click', () => {
    const progress = getProgress();
    const firstLocked = progress.findIndex((v, i) => i > 0 && !progress[i - 1]);
    const idx = firstLocked === -1 ? 0 : firstLocked - 1;
    startGame(idx);
  });

  document.getElementById('btn-select').addEventListener('click', () => {
    buildLevelSelect();
    showScreen('screen-select');
  });

  document.getElementById('btn-howto').addEventListener('click', () => showScreen('screen-howto'));
  document.getElementById('btn-howto-back').addEventListener('click', () => showScreen('screen-menu'));
  document.getElementById('btn-select-back').addEventListener('click', () => showScreen('screen-menu'));
  document.getElementById('btn-win-menu').addEventListener('click', () => {
    buildLevelSelect();
    showScreen('screen-select');
  });
  document.getElementById('btn-death-menu').addEventListener('click', () => {
    buildLevelSelect();
    showScreen('screen-select');
  });
  document.getElementById('btn-replay').addEventListener('click', () => restartLevel());
  document.getElementById('btn-next').addEventListener('click', () => {
    if (currentLevelIdx < LEVELS.length - 1) startGame(currentLevelIdx + 1);
    else showScreen('screen-menu');
  });
  document.getElementById('btn-death-restart').addEventListener('click', () => restartLevel());
  document.getElementById('btn-reset').addEventListener('click', () => restartLevel());
  document.getElementById('btn-mute').addEventListener('click', toggleMute);
  document.getElementById('btn-mute-menu').addEventListener('click', toggleMute);
  document.getElementById('btn-menu').addEventListener('click', () => {
    buildLevelSelect();
    showScreen('screen-select');
  });
  document.getElementById('btn-resume').addEventListener('click', resumeGame);
  document.getElementById('btn-pause-reset').addEventListener('click', restartLevel);
  document.getElementById('btn-pause-menu').addEventListener('click', () => {
    buildLevelSelect();
    showScreen('screen-select');
  });

  // --------------------------------------------------------------------------
  // Resize / loop
  // --------------------------------------------------------------------------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (level) clampCamera();
  }

  window.addEventListener('resize', resize);
  resize();

  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 16.67, 2);
    lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  updateMuteButtons();
  showScreen('screen-menu');
  requestAnimationFrame(loop);
})();
