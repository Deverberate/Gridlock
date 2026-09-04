/**
 * Procedural sprite atlas generator — zero dependencies, pure pixel art.
 * Every sprite is painted procedurally on an off-screen canvas and uploaded
 * to WebGL as a single NEAREST-filtered texture (see InstancedRenderer).
 *
 * Atlas layout: 512x512 texture = 16x16 grid of 32px cells. Sprite indices
 * (0..25) must match src/constants.js + the worker's machineSprite logic.
 *
 * Art direction: dark industrial pixel-art — noisy grass, metal-rich ore,
 * charcoal belts with yellow flow chevrons, hazard-striped drills, brick
 * smelters with glowing cores, and state variants (idle / active / dead).
 */

const SPRITE_SIZE = 32;  // px per sprite in atlas
const ATLAS_COLS  = 16;
const ATLAS_ROWS  = 16;

// Sprite indices (must match constants + shader expectations)
export const SPRITE_GRASS        = 0;
export const SPRITE_WATER        = 1;
export const SPRITE_STONE        = 2;
export const SPRITE_MINER        = 3;   // powered, idle
export const SPRITE_SMELTER      = 4;   // powered, idle (no input)
export const SPRITE_ASSEMBLER    = 5;   // powered, idle (no input)
export const SPRITE_GENERATOR    = 6;   // powered, idle
export const SPRITE_BELT_H       = 7;
export const SPRITE_BELT_V       = 8;
export const SPRITE_BELT_JR      = 9;   // belt joint right
export const SPRITE_BELT_JD      = 10;  // belt joint down
export const SPRITE_POWER_POLE   = 11;
export const SPRITE_IRON_ORE     = 12;
export const SPRITE_COPPER_ORE   = 13;
export const SPRITE_GEAR         = 14;
export const SPRITE_IRON_INGOT   = 15;
export const SPRITE_COPPER_INGOT = 16;
export const SPRITE_MACH_OFF     = 17;  // generic unpowered (fallback)
export const SPRITE_ITEM_DOT     = 18;
export const SPRITE_MINER_ON     = 19;
export const SPRITE_SMELTER_ON   = 20;
export const SPRITE_ASSEMBLER_ON = 21;
export const SPRITE_GENERATOR_ON = 22;
export const SPRITE_SMELTER_OFF  = 23;  // unpowered: dead ash core
export const SPRITE_ASSEMBLER_OFF = 24; // unpowered: dark static casing
export const SPRITE_MINER_OFF    = 25;  // unpowered: dimmed hazard casing

// Deterministic PRNG (mulberry32) — identical art on every load/reload.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate the atlas as an OffscreenCanvas, return it + metadata.
 */
export function generateSpriteAtlas() {
  const w = ATLAS_COLS * SPRITE_SIZE;
  const h = ATLAS_ROWS * SPRITE_SIZE;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, w, h);

  // ── Helper: draw at grid position ──
  function at(index) {
    const col = index % ATLAS_COLS;
    const row = Math.floor(index / ATLAS_COLS);
    ctx.save();
    ctx.translate(col * SPRITE_SIZE, row * SPRITE_SIZE);
    return ctx;
  }

  // ── Pixel-noise helpers (all within a 32x32 cell) ──
  /** Scatter random 1x1 and 2x2 specks of `color` over the base fill. */
  function scatter(color, count, rand, size = 32) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rand() * size);
      const y = Math.floor(rand() * size);
      const s = rand() < 0.3 ? 2 : 1;
      ctx.fillRect(x, y, s, s);
    }
  }

  /** Diagonal hazard stripes (yellow/black bands) across the current cell. */
  function hazardStripes(light, dark, thickness = 8, rand) {
    // Pre-blend a single stripe pattern so both colors have the same grain
    for (let y = -SPRITE_SIZE; y < SPRITE_SIZE * 2; y += thickness) {
      ctx.fillStyle = (Math.abs(y) / thickness) % 2 < 1 ? light : dark;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SPRITE_SIZE, y - SPRITE_SIZE);
      ctx.lineTo(SPRITE_SIZE, y - SPRITE_SIZE + thickness);
      ctx.lineTo(0, y + thickness);
      ctx.fill();
    }
  }

  // ── 0: Grass tile — noisy, tileable meadow ──
  {
    const c = at(SPRITE_GRASS);
    const r = rng(101);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 90, r);   // lighter blades
    scatter('#1f3515', 70, r);   // darker soil shadows
    scatter('#468a2e', 24, r);   // bright highlights
    ctx.restore();
  }

  // ── 1: Water tile — deep blue with crests ──
  {
    const c = at(SPRITE_WATER);
    const r = rng(202);
    c.fillStyle = '#1a3d7a';
    c.fillRect(0, 0, 32, 32);
    scatter('#23509c', 50, r);
    c.fillStyle = '#2a5daa';
    for (let i = 0; i < 4; i++) {
      const y = 4 + i * 7;
      c.fillRect(2, y, 28, 1);
      c.fillRect(5, y - 2, 2, 1);
    }
    c.fillStyle = '#6fa8dc';
    for (let i = 0; i < 3; i++) c.fillRect(4 + i * 9, 8 + ((i * 3) % 5), 3, 1);
    ctx.restore();
  }

  // ── 2: Stone tile — cracked rock ──
  {
    const c = at(SPRITE_STONE);
    const r = rng(303);
    c.fillStyle = '#665e58';
    c.fillRect(0, 0, 32, 32);
    scatter('#7a7169', 40, r);
    scatter('#554e48', 35, r);
    c.fillStyle = '#8a7e75';
    c.fillRect(4, 4, 8, 6);
    c.fillRect(20, 14, 7, 8);
    c.fillStyle = '#4a443e';
    c.fillRect(2, 20, 5, 4);
    c.fillRect(24, 26, 6, 3);
    c.fillStyle = '#9a8f85';
    c.fillRect(10, 22, 3, 2);
    ctx.restore();
  }

  // ── 3: Mining drill (powered, idle) — hazard-striped industrial casing ──
  {
    const c = at(SPRITE_MINER);
    const r = rng(404);
    c.fillStyle = '#2d4c1e';          // grass base
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    // Casing: heavy grey frame
    c.fillStyle = '#3f3f46';
    c.fillRect(2, 2, 28, 28);
    c.fillStyle = '#52525b';
    c.fillRect(2, 2, 28, 3);
    c.fillRect(2, 2, 3, 28);
    // Black center + hazard stripes across it
    c.fillStyle = '#18181b';
    c.fillRect(7, 7, 18, 18);
    hazardStripes('#facc15', '#18181b', 6);
    // Drill shaft + bit
    c.fillStyle = '#a1a1aa';
    c.fillRect(13, 6, 6, 6);
    c.fillStyle = '#71717a';
    c.fillRect(14, 12, 4, 8);
    c.fillStyle = '#e4e4e7';
    c.fillRect(15, 20, 2, 4);         // steel bit tip
    ctx.restore();
  }

  // ── 4: Smelter (powered, idle) — brick furnace, warm ember core ──
  {
    const c = at(SPRITE_SMELTER);
    const r = rng(505);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    // Brick body
    c.fillStyle = '#7f1d1d';
    c.fillRect(3, 3, 26, 26);
    c.fillStyle = '#991b1b';
    c.fillRect(3, 3, 26, 4);
    scatter('#6b1515', 18, r);
    // Brick mortar lines
    c.fillStyle = '#4c0f0f';
    for (let y = 10; y < 30; y += 6) { c.fillRect(3, y, 26, 1); c.fillRect(3 + 6, y + 1, 1, 5); c.fillRect(3, y + 1, 1, 5); }
    // Stack opening
    c.fillStyle = '#161618';
    c.fillRect(11, 11, 10, 10);
    // Warm ember core (idle: not fully lit)
    c.fillStyle = '#c2410c';
    c.fillRect(13, 13, 6, 6);
    c.fillStyle = '#ea580c';
    c.fillRect(14, 14, 4, 4);
    c.fillStyle = '#fb923c';
    c.fillRect(15, 15, 2, 2);
    ctx.restore();
  }

  // ── 5: Assembler (powered, idle) — dark-blue tech casing + gear ──
  {
    const c = at(SPRITE_ASSEMBLER);
    const r = rng(606);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    c.fillStyle = '#1e3a8a';
    c.fillRect(2, 2, 28, 28);
    c.fillStyle = '#1d4ed8';
    c.fillRect(2, 2, 28, 3);
    c.fillRect(2, 2, 3, 28);
    c.fillStyle = '#172554';
    scatter('#172554', 14, r);
    // Central grey gear
    const gear = '#9ca3af';
    c.fillStyle = gear;
    c.fillRect(12, 8, 8, 2); c.fillRect(12, 22, 8, 2);
    c.fillRect(8, 12, 2, 8); c.fillRect(22, 12, 2, 8);
    c.fillStyle = '#6b7280';
    c.fillRect(10, 10, 12, 12);
    c.fillStyle = '#cbd5e1';
    c.fillRect(12, 12, 8, 8);
    c.fillStyle = '#4b5563';
    c.fillRect(15, 15, 2, 2);
    ctx.restore();
  }

  // ── 6: Steam generator (powered, idle) — steel boiler, green gauge ──
  {
    const c = at(SPRITE_GENERATOR);
    const r = rng(707);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    c.fillStyle = '#52525b';
    c.fillRect(3, 3, 26, 26);
    c.fillStyle = '#71717a';
    c.fillRect(3, 3, 26, 4);
    scatter('#3f3f46', 16, r);
    // Boiler hatch
    c.fillStyle = '#27272a';
    c.fillRect(6, 10, 9, 12);
    c.fillRect(17, 10, 9, 12);
    // Pressure gauge (green, powered)
    c.fillStyle = '#27272a';
    c.fillRect(11, 16, 10, 10);
    c.fillStyle = '#22c55e';
    c.fillRect(14, 19, 4, 4);
    c.fillStyle = '#4ade80';
    c.fillRect(15, 20, 2, 2);
    // Steam vents
    c.fillStyle = '#a1a1aa';
    c.fillRect(7, 26, 18, 2);
    ctx.restore();
  }

  // ── 7: Belt horizontal — charcoal track, yellow flow chevrons → ──
  {
    const c = at(SPRITE_BELT_H);
    c.fillStyle = '#18181b';
    c.fillRect(0, 0, 32, 32);
    // Side rails
    c.fillStyle = '#27272a';
    c.fillRect(0, 8, 32, 2);
    c.fillRect(0, 22, 32, 2);
    // Track bed with roller ticks
    c.fillStyle = '#2a2a2c';
    for (let x = 2; x < 30; x += 4) c.fillRect(x, 13, 1, 6);
    // Yellow chevrons pointing right (default flow direction)
    c.fillStyle = '#facc15';
    for (let x = 2; x < 30; x += 10) {
      c.fillRect(x, 14, 5, 2);
      c.fillRect(x + 1, 16, 4, 2);
      c.fillRect(x + 2, 18, 3, 2);
      c.fillRect(x + 3, 20, 2, 2);
    }
    ctx.restore();
  }

  // ── 8: Belt vertical — chevrons pointing down ──
  {
    const c = at(SPRITE_BELT_V);
    c.fillStyle = '#18181b';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#27272a';
    c.fillRect(8, 0, 2, 32);
    c.fillRect(22, 0, 2, 32);
    c.fillStyle = '#2a2a2c';
    for (let y = 2; y < 30; y += 4) c.fillRect(13, y, 6, 1);
    c.fillStyle = '#facc15';
    for (let y = 2; y < 30; y += 10) {
      c.fillRect(14, y, 2, 5);
      c.fillRect(16, y + 1, 2, 4);
      c.fillRect(18, y + 2, 2, 3);
      c.fillRect(20, y + 3, 2, 2);
    }
    ctx.restore();
  }

  // ── 9/10: Belt joints — L-turns (right + down) ──
  {
    const c = at(SPRITE_BELT_JR);
    c.fillStyle = '#18181b';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#27272a';
    c.fillRect(0, 8, 32, 2);
    c.fillRect(0, 22, 32, 2);
    c.fillRect(20, 8, 2, 24);
    c.fillStyle = '#2a2a2c';
    for (let x = 2; x < 20; x += 4) c.fillRect(x, 13, 1, 6);
    c.fillStyle = '#facc15';
    for (let x = 2; x < 18; x += 10) {
      c.fillRect(x, 14, 5, 2); c.fillRect(x + 1, 16, 4, 2); c.fillRect(x + 2, 18, 3, 2); c.fillRect(x + 3, 20, 2, 2);
    }
    c.fillRect(23, 14, 2, 5); c.fillRect(25, 16, 2, 4); c.fillRect(27, 18, 2, 3); c.fillRect(29, 20, 2, 2);
    ctx.restore();
  }
  {
    const c = at(SPRITE_BELT_JD);
    c.fillStyle = '#18181b';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#27272a';
    c.fillRect(8, 0, 2, 32);
    c.fillRect(22, 0, 2, 32);
    c.fillRect(8, 20, 24, 2);
    c.fillStyle = '#2a2a2c';
    for (let y = 2; y < 20; y += 4) c.fillRect(13, y, 6, 1);
    c.fillStyle = '#facc15';
    for (let y = 2; y < 18; y += 10) {
      c.fillRect(14, y, 2, 5); c.fillRect(16, y + 1, 2, 4); c.fillRect(18, y + 2, 2, 3); c.fillRect(20, y + 3, 2, 2);
    }
    c.fillRect(14, 23, 5, 2); c.fillRect(16, 25, 4, 2); c.fillRect(18, 27, 3, 2); c.fillRect(20, 29, 2, 2);
    ctx.restore();
  }

  // ── 11: Power pole ──
  {
    const c = at(SPRITE_POWER_POLE);
    const r = rng(808);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 24, r);
    c.fillStyle = '#886633';
    c.fillRect(14, 3, 4, 26);
    c.fillStyle = '#a97c3f';
    c.fillRect(14, 3, 4, 3);
    c.fillStyle = '#ccaa44';
    c.fillRect(9, 6, 14, 3);
    c.fillRect(9, 12, 14, 3);
    c.fillStyle = '#e6c45a';
    c.fillRect(10, 7, 3, 1);
    c.fillRect(19, 7, 3, 1);
    ctx.restore();
  }

  // ── 12: Iron ore chunk — dark rock with metallic blue-silver veins ──
  {
    const c = at(SPRITE_IRON_ORE);
    const r = rng(909);
    c.fillStyle = '#3a3a3c';
    c.fillRect(6, 6, 20, 20);
    c.fillStyle = '#27272a';
    c.fillRect(6, 6, 20, 3);
    c.fillRect(6, 6, 3, 20);
    scatter('#46464a', 12, r);
    // Veins
    c.fillStyle = '#71717a';
    c.fillRect(9, 10, 6, 2); c.fillRect(9, 14, 8, 2);
    c.fillStyle = '#9ca3af';
    c.fillRect(10, 11, 3, 1); c.fillRect(12, 15, 4, 1);
    c.fillRect(18, 18, 5, 2);
    c.fillStyle = '#cbd5e1';
    c.fillRect(19, 19, 3, 1);
    ctx.restore();
  }

  // ── 13: Copper ore chunk — dark rock with oxidized orange-bronze ──
  {
    const c = at(SPRITE_COPPER_ORE);
    const r = rng(1010);
    c.fillStyle = '#3a3a3c';
    c.fillRect(6, 6, 20, 20);
    c.fillStyle = '#27272a';
    c.fillRect(6, 6, 20, 3);
    c.fillRect(6, 6, 3, 20);
    scatter('#46464a', 10, r);
    c.fillStyle = '#b45309';
    c.fillRect(9, 9, 5, 5);
    c.fillRect(17, 14, 6, 4);
    c.fillRect(11, 18, 4, 4);
    c.fillStyle = '#d97706';
    c.fillRect(10, 10, 3, 3);
    c.fillRect(18, 15, 4, 2);
    c.fillStyle = '#f59e0b';
    c.fillRect(11, 11, 1, 1);
    c.fillRect(19, 16, 2, 1);
    ctx.restore();
  }

  // ── 14: Gear ──
  {
    const c = at(SPRITE_GEAR);
    c.fillStyle = '#9ca3af';
    c.fillRect(11, 4, 10, 4); c.fillRect(11, 24, 10, 4);
    c.fillRect(4, 11, 4, 10); c.fillRect(24, 11, 4, 10);
    c.fillRect(8, 7, 4, 4); c.fillRect(20, 7, 4, 4);
    c.fillRect(8, 21, 4, 4); c.fillRect(20, 21, 4, 4);
    c.fillStyle = '#6b7280';
    c.fillRect(8, 8, 16, 16);
    c.fillStyle = '#cbd5e1';
    c.fillRect(10, 10, 12, 12);
    c.fillStyle = '#374151';
    c.fillRect(15, 15, 2, 2);
    c.fillStyle = '#e5e7eb';
    c.fillRect(12, 12, 4, 4);
    ctx.restore();
  }

  // ── 15/16: Ingots (iron + copper) ──
  {
    const c = at(SPRITE_IRON_INGOT);
    c.fillStyle = '#aabbcc';
    c.fillRect(6, 11, 20, 10);
    c.fillStyle = '#c9d7e3';
    c.fillRect(8, 12, 16, 7);
    c.fillStyle = '#8899aa';
    c.fillRect(6, 18, 20, 3);
    c.fillStyle = '#e8f0f7';
    c.fillRect(10, 13, 6, 3);
    ctx.restore();
  }
  {
    const c = at(SPRITE_COPPER_INGOT);
    c.fillStyle = '#cc8844';
    c.fillRect(6, 11, 20, 10);
    c.fillStyle = '#e0a86a';
    c.fillRect(8, 12, 16, 7);
    c.fillStyle = '#b06a2c';
    c.fillRect(6, 18, 20, 3);
    c.fillStyle = '#f2c58a';
    c.fillRect(10, 13, 6, 3);
    ctx.restore();
  }

  // ── 17: Machine off (generic dead state, red fault light) ──
  {
    const c = at(SPRITE_MACH_OFF);
    const r = rng(1111);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 24, r);
    c.fillStyle = '#3f3f46';
    c.fillRect(3, 3, 26, 26);
    c.fillStyle = '#52525b';
    c.fillRect(3, 3, 26, 3);
    c.fillStyle = '#18181b';
    c.fillRect(8, 8, 16, 16);
    c.fillStyle = '#a00';
    c.fillRect(14, 14, 4, 4);
    c.fillStyle = '#e00';
    c.fillRect(15, 15, 2, 2);
    ctx.restore();
  }

  // ── 18: Item dot (generic) ──
  {
    const c = at(SPRITE_ITEM_DOT);
    c.fillStyle = '#dd0';
    c.fillRect(10, 10, 12, 12);
    c.fillStyle = '#ff6';
    c.fillRect(12, 12, 8, 8);
    c.fillStyle = '#fff3a0';
    c.fillRect(14, 14, 4, 4);
    ctx.restore();
  }

  // ── 19: Miner active — bright casing, spinning drill glow ──
  {
    const c = at(SPRITE_MINER_ON);
    const r = rng(1212);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    c.fillStyle = '#a1a1aa';
    c.fillRect(2, 2, 28, 28);
    c.fillStyle = '#cbd5e1';
    c.fillRect(2, 2, 28, 3);
    c.fillRect(2, 2, 3, 28);
    c.fillStyle = '#18181b';
    c.fillRect(7, 7, 18, 18);
    hazardStripes('#facc15', '#18181b', 6);
    c.fillStyle = '#e4e4e7';
    c.fillRect(13, 6, 6, 6);
    c.fillStyle = '#d4d4d8';
    c.fillRect(14, 12, 4, 8);
    c.fillStyle = '#f8fafc';
    c.fillRect(15, 20, 2, 4);
    c.fillStyle = '#fbbf24';          // active bit glow
    c.fillRect(14, 24, 4, 2);
    ctx.restore();
  }

  // ── 20: Smelter active — blazing furnace core ──
  {
    const c = at(SPRITE_SMELTER_ON);
    const r = rng(1313);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    c.fillStyle = '#7f1d1d';
    c.fillRect(3, 3, 26, 26);
    c.fillStyle = '#b91c1c';
    c.fillRect(3, 3, 26, 4);
    scatter('#991b1b', 16, r);
    c.fillStyle = '#4c0f0f';
    for (let y = 10; y < 30; y += 6) { c.fillRect(3, y, 26, 1); c.fillRect(3 + 6, y + 1, 1, 5); c.fillRect(3, y + 1, 1, 5); }
    c.fillStyle = '#161618';
    c.fillRect(10, 10, 12, 12);
    c.fillStyle = '#ea580c';          // roaring core
    c.fillRect(12, 12, 8, 8);
    c.fillStyle = '#f97316';
    c.fillRect(13, 13, 6, 6);
    c.fillStyle = '#fbbf24';
    c.fillRect(14, 14, 4, 4);
    c.fillStyle = '#fef3c7';
    c.fillRect(15, 15, 2, 2);
    ctx.restore();
  }

  // ── 21: Assembler active — lit casing, spinning gear ──
  {
    const c = at(SPRITE_ASSEMBLER_ON);
    const r = rng(1414);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    c.fillStyle = '#1e3a8a';
    c.fillRect(2, 2, 28, 28);
    c.fillStyle = '#3b82f6';
    c.fillRect(2, 2, 28, 3);
    c.fillRect(2, 2, 3, 28);
    scatter('#1d4ed8', 12, r);
    c.fillStyle = '#cbd5e1';
    c.fillRect(12, 8, 8, 2); c.fillRect(12, 22, 8, 2);
    c.fillRect(8, 12, 2, 8); c.fillRect(22, 12, 2, 8);
    c.fillStyle = '#9ca3af';
    c.fillRect(10, 10, 12, 12);
    c.fillStyle = '#e2e8f0';
    c.fillRect(12, 12, 8, 8);
    c.fillStyle = '#64748b';
    c.fillRect(15, 15, 2, 2);
    c.fillStyle = '#93c5fd';          // active glow
    c.fillRect(14, 14, 4, 1);
    ctx.restore();
  }

  // ── 22: Generator active — bright green gauge ──
  {
    const c = at(SPRITE_GENERATOR_ON);
    const r = rng(1515);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    c.fillStyle = '#71717a';
    c.fillRect(3, 3, 26, 26);
    c.fillStyle = '#a1a1aa';
    c.fillRect(3, 3, 26, 4);
    scatter('#52525b', 16, r);
    c.fillStyle = '#27272a';
    c.fillRect(6, 10, 9, 12);
    c.fillRect(17, 10, 9, 12);
    c.fillStyle = '#27272a';
    c.fillRect(11, 16, 10, 10);
    c.fillStyle = '#22c55e';
    c.fillRect(13, 18, 6, 6);
    c.fillStyle = '#4ade80';
    c.fillRect(14, 19, 4, 4);
    c.fillStyle = '#86efac';
    c.fillRect(15, 20, 2, 2);
    c.fillStyle = '#a1a1aa';
    c.fillRect(7, 26, 18, 2);
    ctx.restore();
  }

  // ── 23: Smelter OFF — brick furnace with dead grey ash core ──
  {
    const c = at(SPRITE_SMELTER_OFF);
    const r = rng(1616);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    c.fillStyle = '#5f1515';          // dimmed bricks
    c.fillRect(3, 3, 26, 26);
    c.fillStyle = '#701a1a';
    c.fillRect(3, 3, 26, 4);
    scatter('#4c0f0f', 14, r);
    c.fillStyle = '#3c0c0c';
    for (let y = 10; y < 30; y += 6) { c.fillRect(3, y, 26, 1); c.fillRect(3 + 6, y + 1, 1, 5); c.fillRect(3, y + 1, 1, 5); }
    c.fillStyle = '#161618';
    c.fillRect(11, 11, 10, 10);
    c.fillStyle = '#3f3f46';          // dead ash
    c.fillRect(13, 13, 6, 6);
    c.fillStyle = '#52525b';
    c.fillRect(14, 14, 4, 4);
    c.fillStyle = '#71717a';
    c.fillRect(15, 15, 2, 2);
    ctx.restore();
  }

  // ── 24: Assembler OFF — dark static casing, cold gear ──
  {
    const c = at(SPRITE_ASSEMBLER_OFF);
    const r = rng(1717);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    c.fillStyle = '#16255c';          // dimmed blue
    c.fillRect(2, 2, 28, 28);
    c.fillStyle = '#1e3a8a';
    c.fillRect(2, 2, 28, 3);
    c.fillRect(2, 2, 3, 28);
    scatter('#101d4a', 12, r);
    c.fillStyle = '#4b5563';
    c.fillRect(12, 8, 8, 2); c.fillRect(12, 22, 8, 2);
    c.fillRect(8, 12, 2, 8); c.fillRect(22, 12, 2, 8);
    c.fillStyle = '#374151';
    c.fillRect(10, 10, 12, 12);
    c.fillStyle = '#6b7280';
    c.fillRect(12, 12, 8, 8);
    c.fillStyle = '#27272a';
    c.fillRect(15, 15, 2, 2);
    ctx.restore();
  }

  // ── 25: Miner OFF — dimmed hazard casing, no glow ──
  {
    const c = at(SPRITE_MINER_OFF);
    const r = rng(1818);
    c.fillStyle = '#2d4c1e';
    c.fillRect(0, 0, 32, 32);
    scatter('#3a5f27', 26, r);
    c.fillStyle = '#3f3f46';
    c.fillRect(2, 2, 28, 28);
    c.fillStyle = '#52525b';
    c.fillRect(2, 2, 28, 3);
    c.fillRect(2, 2, 3, 28);
    c.fillStyle = '#18181b';
    c.fillRect(7, 7, 18, 18);
    hazardStripes('#a16207', '#18181b', 6);  // dimmed amber stripes
    c.fillStyle = '#71717a';
    c.fillRect(13, 6, 6, 6);
    c.fillStyle = '#52525b';
    c.fillRect(14, 12, 4, 8);
    c.fillStyle = '#6b7280';
    c.fillRect(15, 20, 2, 4);
    ctx.restore();
  }

  return {
    canvas,
    width: w,
    height: h,
    spriteSize: SPRITE_SIZE,
    atlasCols: ATLAS_COLS,
    atlasRows: ATLAS_ROWS,
    spriteCount: ATLAS_COLS * ATLAS_ROWS,
  };
}
