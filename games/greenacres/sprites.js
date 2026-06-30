// sprites.js — Procedural inline-SVG art for GreenAcres.
// No external image assets: every plant, crop and piece of scenery is drawn
// with vanilla SVG so the game still runs from file:// with nothing to load.
// Crop art is parameterised by a continuous growth fraction (0..1) so plants
// visibly sprout, fill out and fruit as the weeks pass.

const Sprites = {
  // Per-crop palettes + which "archetype" drawer to use.
  palette: {
    wheat:      { type: 'grain',  stem: '#b7a23c', head: '#e6c64f', dark: '#8f7d2a' },
    rice:       { type: 'grain',  stem: '#8aa84f', head: '#dcdf9a', dark: '#6f8a3f' },
    corn:       { type: 'corn',   stem: '#4f8a35', leaf: '#67a83c', cob: '#f1cb45', dark: '#3c6b29' },
    carrot:     { type: 'leafy',  leaf: '#3f9a44', dark: '#2c7330', accent: '#e8772a' },
    potato:     { type: 'leafy',  leaf: '#4f8a3a', dark: '#39682a', accent: '#dcd2ef' },
    lettuce:    { type: 'leafy',  leaf: '#8ed257', dark: '#6cae3c', accent: null },
    beans:      { type: 'leafy',  leaf: '#4f9a3f', dark: '#367029', accent: '#bcd86a' },
    soybean:    { type: 'leafy',  leaf: '#5f9a45', dark: '#427030', accent: '#cdd884' },
    tomato:     { type: 'bush',   leaf: '#3f8a3a', dark: '#2c6329', fruit: '#e23c28' },
    strawberry: { type: 'berry',  leaf: '#3f8a3a', dark: '#2c6329', fruit: '#e22937' },
    pumpkin:    { type: 'pumpkin',leaf: '#3f7a36', dark: '#2c5827', fruit: '#e87f23' },
    sunflower:  { type: 'sun',    stem: '#4f8a35', leaf: '#5f9a3c', petal: '#f3c220', center: '#7a4a22' },
  },

  // deterministic per-index "random" so tiles don't flicker between renders
  _j(i, salt) {
    const x = Math.sin((i + 1) * 12.9898 + (salt || 0) * 78.233) * 43758.5453;
    return x - Math.floor(x);
  },

  // ---- low-level helpers -------------------------------------------------

  _blade(x, y, len, ang, w, color, curve) {
    const rad = (ang - 90) * Math.PI / 180;
    const tx = x + Math.cos(rad) * len;
    const ty = y + Math.sin(rad) * len;
    const cx = x + Math.cos(rad) * len * 0.5 + (curve || 0);
    const cy = y + Math.sin(rad) * len * 0.5;
    return `<path d="M${x} ${y} Q${cx} ${cy} ${tx} ${ty}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  },

  _leaf(x, y, len, ang, color) {
    const rad = (ang - 90) * Math.PI / 180;
    const tx = x + Math.cos(rad) * len;
    const ty = y + Math.sin(rad) * len;
    const nx = Math.cos(rad + Math.PI / 2);
    const ny = Math.sin(rad + Math.PI / 2);
    const w = len * 0.34;
    const mx = x + Math.cos(rad) * len * 0.5;
    const my = y + Math.sin(rad) * len * 0.5;
    return `<path d="M${x} ${y} Q${mx + nx * w} ${my + ny * w} ${tx} ${ty} Q${mx - nx * w} ${my - ny * w} ${x} ${y} Z" fill="${color}"/>`;
  },

  // ---- archetype drawers (one plant clump) -------------------------------

  _grain(cx, baseY, s, ready, p, seed) {
    const H = 12 + s * 34;
    let out = '';
    const n = 5;
    for (let k = 0; k < n; k++) {
      const j = this._j(seed, k);
      const ang = -22 + (k / (n - 1)) * 44 + (j - 0.5) * 6;
      const len = H * (0.8 + j * 0.35);
      const col = k % 2 ? p.stem : p.dark;
      out += this._blade(cx + (k - 2) * 1.5, baseY, len, ang, 1.6, col, (ang) * 0.05);
      if (s > 0.5) {
        const rad = (ang - 90) * Math.PI / 180;
        const tx = cx + (k - 2) * 1.5 + Math.cos(rad) * len;
        const ty = baseY + Math.sin(rad) * len;
        // seed head
        out += `<ellipse cx="${tx.toFixed(1)}" cy="${(ty - 3).toFixed(1)}" rx="2.1" ry="5" fill="${p.head}" transform="rotate(${ang} ${tx.toFixed(1)} ${ty.toFixed(1)})"/>`;
        if (ready) out += `<line x1="${tx.toFixed(1)}" y1="${(ty - 8).toFixed(1)}" x2="${tx.toFixed(1)}" y2="${(ty - 13).toFixed(1)}" stroke="${p.head}" stroke-width="0.8"/>`;
      }
    }
    return out;
  },

  _corn(cx, baseY, s, ready, p, seed) {
    const H = 16 + s * 44;
    let out = '';
    // stalk
    out += `<path d="M${cx} ${baseY} Q${cx + 2} ${baseY - H * 0.5} ${cx} ${baseY - H}" stroke="${p.stem}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    // arching leaves
    const lv = Math.max(2, Math.round(s * 5));
    for (let k = 0; k < lv; k++) {
      const y = baseY - (k + 0.6) * (H / (lv + 1));
      const side = k % 2 ? 1 : -1;
      out += this._leaf(cx, y, 10 + s * 14, 90 + side * 58, k % 2 ? p.leaf : p.dark);
    }
    // tassel
    if (s > 0.45) {
      const ty = baseY - H;
      for (let t = -2; t <= 2; t++) out += this._blade(cx, ty, 6 + s * 4, t * 12, 1, p.head || '#d8c45a');
    }
    // cob
    if (s > 0.6) {
      const cy = baseY - H * 0.5;
      out += `<ellipse cx="${cx + 4}" cy="${cy}" rx="3" ry="${6 + s * 2}" fill="${ready ? p.cob : p.leaf}" transform="rotate(20 ${cx + 4} ${cy})"/>`;
      if (ready) out += `<ellipse cx="${cx + 4.5}" cy="${cy - 1}" rx="1.3" ry="4" fill="#fff7c8" opacity="0.5" transform="rotate(20 ${cx + 4} ${cy})"/>`;
    }
    return out;
  },

  _leafy(cx, baseY, s, ready, p, seed) {
    const H = 8 + s * 20;
    let out = '';
    const n = 7;
    for (let k = 0; k < n; k++) {
      const j = this._j(seed, k);
      const ang = -52 + (k / (n - 1)) * 104 + (j - 0.5) * 8;
      const len = H * (0.7 + j * 0.5);
      out += this._leaf(cx, baseY, len, ang, k % 2 ? p.leaf : p.dark);
    }
    // accents
    if (p.accent && s > 0.4) {
      if (p.accent === '#e8772a') { // carrot shoulder peeking from soil
        out += `<path d="M${cx - 3} ${baseY + 1} Q${cx} ${baseY + 6} ${cx + 3} ${baseY + 1} Z" fill="${p.accent}"/>`;
      } else if (p.accent === '#dcd2ef') { // potato flowers
        for (let f = 0; f < 3; f++) out += `<circle cx="${cx + (f - 1) * 5}" cy="${baseY - H + 2}" r="1.8" fill="${p.accent}"/>`;
      } else { // bean / soy pods
        for (let f = 0; f < 3; f++) out += `<ellipse cx="${cx + (f - 1) * 4}" cy="${baseY - 3}" rx="1.4" ry="4" fill="${p.accent}" transform="rotate(${(f - 1) * 20} ${cx + (f - 1) * 4} ${baseY - 3})"/>`;
      }
    }
    return out;
  },

  _bush(cx, baseY, s, ready, p, seed) {
    const H = 8 + s * 22;
    let out = '';
    // foliage mound
    const blobs = 6;
    for (let k = 0; k < blobs; k++) {
      const j = this._j(seed, k);
      const a = (k / blobs) * Math.PI * 2;
      const r = 4 + s * 6 + j * 2;
      const bx = cx + Math.cos(a) * (3 + s * 5);
      const by = baseY - H * 0.5 + Math.sin(a) * (3 + s * 4);
      out += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r.toFixed(1)}" fill="${k % 2 ? p.leaf : p.dark}"/>`;
    }
    // fruit
    if (s > 0.55) {
      const nf = ready ? 4 : 2;
      for (let f = 0; f < nf; f++) {
        const j = this._j(seed, f + 10);
        const fx = cx + (j - 0.5) * (8 + s * 6);
        const fy = baseY - H * 0.4 - (this._j(seed, f + 3) - 0.5) * 8;
        out += `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="${ready ? 3 : 2.2}" fill="${ready ? p.fruit : '#8fb44a'}"/>`;
        if (ready) out += `<circle cx="${(fx - 0.8).toFixed(1)}" cy="${(fy - 0.8).toFixed(1)}" r="0.9" fill="#fff" opacity="0.6"/>`;
      }
    }
    return out;
  },

  _berry(cx, baseY, s, ready, p, seed) {
    const H = 6 + s * 14;
    let out = '';
    const n = 6;
    for (let k = 0; k < n; k++) {
      const ang = -50 + (k / (n - 1)) * 100;
      out += this._leaf(cx, baseY, H * (0.8 + this._j(seed, k) * 0.4), ang, k % 2 ? p.leaf : p.dark);
    }
    if (s > 0.5) {
      const nf = ready ? 3 : 2;
      for (let f = 0; f < nf; f++) {
        const fx = cx + (f - (nf - 1) / 2) * 6;
        const fy = baseY - 1;
        const col = ready ? p.fruit : '#cfe06a';
        out += `<path d="M${fx - 2.4} ${fy - 3} Q${fx} ${fy + 3} ${fx + 2.4} ${fy - 3} Q${fx} ${fy - 4.5} ${fx - 2.4} ${fy - 3} Z" fill="${col}"/>`;
        if (ready) {
          out += `<circle cx="${fx}" cy="${fy - 2}" r="0.5" fill="#ffe2a0"/>`;
          out += `<circle cx="${fx - 1}" cy="${fy - 0.5}" r="0.5" fill="#ffe2a0"/>`;
          out += `<circle cx="${fx + 1}" cy="${fy - 0.5}" r="0.5" fill="#ffe2a0"/>`;
        }
      }
    }
    return out;
  },

  _pumpkin(cx, baseY, s, ready, p, seed) {
    let out = '';
    // sprawling leaves
    const n = 5;
    for (let k = 0; k < n; k++) {
      const ang = -70 + (k / (n - 1)) * 140;
      out += this._leaf(cx, baseY, 8 + s * 14, ang, k % 2 ? p.leaf : p.dark);
    }
    // gourd on the ground
    if (s > 0.5) {
      const r = 4 + s * 6;
      const col = ready ? p.fruit : '#7fb04a';
      const gx = cx + 5, gy = baseY - r * 0.5;
      out += `<ellipse cx="${gx}" cy="${gy}" rx="${r + 1.5}" ry="${r}" fill="${col}"/>`;
      out += `<path d="M${gx} ${gy - r} Q${gx - r} ${gy} ${gx} ${gy + r}" stroke="${ready ? '#c96714' : '#5f8a36'}" stroke-width="0.8" fill="none"/>`;
      out += `<path d="M${gx} ${gy - r} Q${gx + r} ${gy} ${gx} ${gy + r}" stroke="${ready ? '#c96714' : '#5f8a36'}" stroke-width="0.8" fill="none"/>`;
      out += `<rect x="${gx - 0.8}" y="${gy - r - 3}" width="1.6" height="4" fill="${p.dark}"/>`;
    }
    return out;
  },

  _sun(cx, baseY, s, ready, p, seed) {
    const H = 14 + s * 42;
    let out = '';
    out += `<path d="M${cx} ${baseY} Q${cx - 2} ${baseY - H * 0.5} ${cx} ${baseY - H}" stroke="${p.stem}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    out += this._leaf(cx, baseY - H * 0.45, 11 + s * 6, 130, p.leaf);
    out += this._leaf(cx, baseY - H * 0.62, 10 + s * 6, 50, p.leaf);
    const hy = baseY - H;
    if (s > 0.4) {
      const R = 4 + s * 5;
      if (s > 0.55 || ready) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          out += `<ellipse cx="${(cx + Math.cos(a) * R * 1.5).toFixed(1)}" cy="${(hy + Math.sin(a) * R * 1.5).toFixed(1)}" rx="${R * 0.7}" ry="2.4" fill="${p.petal}" transform="rotate(${(a * 180 / Math.PI)} ${(cx + Math.cos(a) * R * 1.5).toFixed(1)} ${(hy + Math.sin(a) * R * 1.5).toFixed(1)})"/>`;
        }
      }
      out += `<circle cx="${cx}" cy="${hy}" r="${R}" fill="${p.center}"/>`;
      out += `<circle cx="${cx - R * 0.3}" cy="${hy - R * 0.3}" r="${R * 0.4}" fill="#9a6a32" opacity="0.6"/>`;
    } else {
      out += `<circle cx="${cx}" cy="${hy}" r="3" fill="${p.leaf}"/>`; // bud
    }
    return out;
  },

  _sprout(cx, baseY, s) {
    // very early seedling, used for all crops before they take their form
    const h = 4 + s * 8;
    let out = '';
    out += this._blade(cx - 1, baseY, h, -16, 1.4, '#6cae3c', -1);
    out += this._blade(cx + 1, baseY, h, 16, 1.4, '#7cc24a', 1);
    out += `<path d="M${cx - 4} ${baseY - h * 0.6} Q${cx} ${baseY - h} ${cx + 4} ${baseY - h * 0.6}" stroke="#8ed257" stroke-width="1.2" fill="none"/>`;
    return out;
  },

  // ---- public: a whole field of one crop on a tile ----------------------

  crop(cropId, g, ready) {
    const p = this.palette[cropId];
    if (!p) return '';
    g = Math.max(0, Math.min(1, g));
    // two rows for depth: back (smaller, higher) then front (larger)
    const rows = [
      { y: 60, s: g * 0.72, xs: [34, 60, 86], salt: 1, op: 0.82 },
      { y: 84, s: g,        xs: [20, 44, 70, 100], salt: 2, op: 1 },
    ];
    let body = '';
    for (const row of rows) {
      let layer = '';
      row.xs.forEach((x, i) => {
        const jitter = (this._j(x, row.salt) - 0.5) * 3;
        const cx = x + jitter;
        const s = Math.min(1, row.s * (0.82 + this._j(x, row.salt + 5) * 0.36));
        if (g < 0.16) { layer += this._sprout(cx, row.y, g / 0.16); return; }
        switch (p.type) {
          case 'grain':  layer += this._grain(cx, row.y, s, ready, p, x + row.salt); break;
          case 'corn':   layer += this._corn(cx, row.y, s, ready, p, x + row.salt); break;
          case 'leafy':  layer += this._leafy(cx, row.y, s, ready, p, x + row.salt); break;
          case 'bush':   layer += this._bush(cx, row.y, s, ready, p, x + row.salt); break;
          case 'berry':  layer += this._berry(cx, row.y, s, ready, p, x + row.salt); break;
          case 'pumpkin':layer += this._pumpkin(cx, row.y, s, ready, p, x + row.salt); break;
          case 'sun':    layer += this._sun(cx, row.y, s, ready, p, x + row.salt); break;
        }
        // ground shadow
        layer = `<ellipse cx="${cx}" cy="${row.y + 2}" rx="${6 + s * 4}" ry="2.2" fill="#000" opacity="0.12"/>` + layer;
      });
      body += `<g opacity="${row.op}">${layer}</g>`;
    }
    return `<svg class="crop-svg" viewBox="0 0 120 92" preserveAspectRatio="xMidYMax meet">${body}</svg>`;
  },

  withered() {
    let out = '';
    const xs = [28, 52, 78, 100];
    xs.forEach((x, i) => {
      const lean = (this._j(x, 9) - 0.5) * 40;
      out += `<path d="M${x} 84 Q${x + lean * 0.4} 70 ${x + lean} 60" stroke="#7a6a44" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      out += `<path d="M${x} 78 l${lean > 0 ? 5 : -5} -3" stroke="#5e5436" stroke-width="1.4" stroke-linecap="round"/>`;
    });
    out += `<ellipse cx="60" cy="86" rx="40" ry="4" fill="#000" opacity="0.12"/>`;
    return `<svg class="crop-svg withered-svg" viewBox="0 0 120 92" preserveAspectRatio="xMidYMax meet">${out}</svg>`;
  },

  // ---- scenery backdrop (hills, barn, silo, trees, fence, birds) ---------

  scene() {
    return `
<svg id="scene-svg" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <!-- far rolling hills -->
  <path class="hill-far" d="M0 210 Q150 150 320 185 T640 180 T960 175 T1200 195 L1200 300 L0 300 Z"/>
  <!-- mid hills -->
  <path class="hill-mid" d="M0 240 Q220 185 460 225 T900 220 T1200 235 L1200 300 L0 300 Z"/>
  <!-- trees on the left -->
  <g class="tree" transform="translate(120 232)">
    <rect class="trunk" x="-6" y="-2" width="12" height="44"/>
    <circle class="foliage" cx="0" cy="-26" r="34"/>
    <circle class="foliage" cx="-26" cy="-8" r="24"/>
    <circle class="foliage" cx="26" cy="-8" r="24"/>
  </g>
  <g class="tree" transform="translate(48 250) scale(0.72)">
    <rect class="trunk" x="-6" y="-2" width="12" height="44"/>
    <circle class="foliage" cx="0" cy="-26" r="32"/>
    <circle class="foliage" cx="-24" cy="-6" r="22"/>
    <circle class="foliage" cx="24" cy="-6" r="22"/>
  </g>
  <!-- barn + silo on the right -->
  <g transform="translate(960 150)">
    <rect class="silo" x="150" y="20" width="44" height="120"/>
    <ellipse class="silo-top" cx="172" cy="20" rx="22" ry="12"/>
    <rect class="barn-body" x="0" y="40" width="150" height="100"/>
    <polygon class="barn-roof" points="-10,42 75,2 160,42"/>
    <rect class="barn-door" x="56" y="92" width="38" height="48"/>
    <line class="barn-trim" x1="56" y1="92" x2="94" y2="140" />
    <line class="barn-trim" x1="94" y1="92" x2="56" y2="140" />
    <circle class="barn-window" cx="75" cy="60" r="9"/>
  </g>
  <!-- fence across the horizon -->
  <g class="fence">
    ${Array.from({ length: 40 }, (_, i) => `<rect x="${i * 31}" y="252" width="5" height="26" rx="1.5"/>`).join('')}
    <rect x="0" y="258" width="1200" height="4"/>
    <rect x="0" y="268" width="1200" height="4"/>
  </g>
  <!-- distant birds -->
  <g class="birds">
    <path d="M520 70 q8 -7 16 0 q8 -7 16 0" /><path d="M580 90 q6 -5 12 0 q6 -5 12 0"/>
  </g>
</svg>`;
  },
};

if (typeof module !== 'undefined') module.exports = Sprites;
