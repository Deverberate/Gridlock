/**
 * Procedural sprite atlas generator.
 * Creates a canvas-based texture atlas with all game sprites baked in.
 * No external image files needed for Phase 1.
 *
 * Atlas layout: grid of sprites, e.g. 16x16 grid of 16px sprites = 256x256 texture.
 */

const SPRITE_SIZE = 16;  // px per sprite in atlas
const ATLAS_COLS  = 16;
const ATLAS_ROWS  = 16;

// Sprite indices (must match constants + shader expectations)
export const SPRITE_GRASS   = 0;
export const SPRITE_WATER   = 1;
export const SPRITE_STONE   = 2;
export const SPRITE_MINER   = 3;
export const SPRITE_SMELTER = 4;
export const SPRITE_ASSEMBLER = 5;
export const SPRITE_GENERATOR = 6;
export const SPRITE_BELT_H  = 7;
export const SPRITE_BELT_V  = 8;
export const SPRITE_BELT_JR = 9;  // belt joint right
export const SPRITE_BELT_JD = 10; // belt joint down
export const SPRITE_POWER_POLE = 11;
export const SPRITE_IRON_ORE = 12;
export const SPRITE_COPPER_ORE = 13;
export const SPRITE_GEAR    = 14;
export const SPRITE_IRON_INGOT = 15;

/**
 * Generate the atlas as an OffscreenCanvas, return it + metadata.
 */
export function generateSpriteAtlas() {
  const w = ATLAS_COLS * SPRITE_SIZE;
  const h = ATLAS_ROWS * SPRITE_SIZE;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, w, h);

  // ── Helper: draw at grid position ──
  function at(index) {
    const col = index % ATLAS_COLS;
    const row = Math.floor(index / ATLAS_COLS);
    ctx.save();
    ctx.translate(col * SPRITE_SIZE, row * SPRITE_SIZE);
    return ctx;
  }

  // ── 0: Grass tile ──
  {
    const c = at(SPRITE_GRASS);
    c.fillStyle = '#2d5a1e';
    c.fillRect(0, 0, 16, 16);
    // Grass blades
    c.fillStyle = '#3a7a28';
    for (let i = 0; i < 6; i++) {
      const bx = 2 + (i * 13) % 14;
      const by = 3 + (i * 7) % 10;
      c.fillRect(bx, by, 1, 3);
    }
    ctx.restore();
  }

  // ── 1: Water tile ──
  {
    const c = at(SPRITE_WATER);
    c.fillStyle = '#1a3d7a';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#2a5daa';
    for (let i = 0; i < 3; i++) {
      const y = 3 + i * 5;
      c.fillRect(1, y, 14, 1);
      c.fillRect(3, y - 1, 2, 1);
    }
    ctx.restore();
  }

  // ── 2: Stone tile ──
  {
    const c = at(SPRITE_STONE);
    c.fillStyle = '#665e58';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#8a7e75';
    c.fillRect(3, 3, 5, 4);
    c.fillRect(9, 8, 4, 5);
    c.fillStyle = '#554e48';
    c.fillRect(1, 10, 3, 3);
    ctx.restore();
  }

  // ── 3: Mining drill ──
  {
    const c = at(SPRITE_MINER);
    c.fillStyle = '#2d5a1e'; // grass bg
    c.fillRect(0, 0, 16, 16);
    // Drill body
    c.fillStyle = '#888';
    c.fillRect(4, 3, 8, 10);
    c.fillStyle = '#aa6633';
    c.fillRect(6, 5, 4, 4);
    // Drill bit
    c.fillStyle = '#ccc';
    c.fillRect(7, 9, 2, 3);
    ctx.restore();
  }

  // ── 4: Smelter ──
  {
    const c = at(SPRITE_SMELTER);
    c.fillStyle = '#2d5a1e';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#774422';
    c.fillRect(3, 4, 10, 8);
    c.fillStyle = '#cc4400';
    c.fillRect(5, 6, 6, 4);
    c.fillStyle = '#ff8800';
    c.fillRect(6, 7, 4, 2);
    ctx.restore();
  }

  // ── 5: Assembler ──
  {
    const c = at(SPRITE_ASSEMBLER);
    c.fillStyle = '#2d5a1e';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#555';
    c.fillRect(2, 3, 12, 10);
    c.fillStyle = '#4488cc';
    c.fillRect(4, 5, 8, 6);
    c.fillStyle = '#66aaff';
    c.fillRect(6, 7, 4, 2);
    ctx.restore();
  }

  // ── 6: Steam generator ──
  {
    const c = at(SPRITE_GENERATOR);
    c.fillStyle = '#2d5a1e';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#666';
    c.fillRect(3, 2, 10, 12);
    c.fillStyle = '#44aa44';
    c.fillRect(5, 4, 6, 3);
    c.fillStyle = '#aaa';
    c.fillRect(6, 8, 4, 4);
    ctx.restore();
  }

  // ── 7: Belt horizontal ──
  {
    const c = at(SPRITE_BELT_H);
    c.fillStyle = '#2d5a1e';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#556';
    c.fillRect(0, 5, 16, 6);
    c.fillStyle = '#889';
    for (let i = 0; i < 4; i++) {
      c.fillRect(1 + i * 4, 7, 2, 2);
    }
    // Arrows
    c.fillStyle = '#aabbcc';
    c.fillRect(3, 8, 1, 1);
    c.fillRect(7, 8, 1, 1);
    c.fillRect(11, 8, 1, 1);
    ctx.restore();
  }

  // ── 8: Belt vertical ──
  {
    const c = at(SPRITE_BELT_V);
    c.fillStyle = '#2d5a1e';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#556';
    c.fillRect(5, 0, 6, 16);
    c.fillStyle = '#889';
    for (let i = 0; i < 4; i++) {
      c.fillRect(7, 1 + i * 4, 2, 2);
    }
    ctx.restore();
  }

  // ── 9-10: Belt joints (right + down) ──
  {
    const c = at(SPRITE_BELT_JR);
    c.fillStyle = '#2d5a1e';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#556';
    c.fillRect(0, 5, 16, 6);
    c.fillRect(8, 5, 6, 6);
    ctx.restore();
  }
  {
    const c = at(SPRITE_BELT_JD);
    c.fillStyle = '#2d5a1e';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#556';
    c.fillRect(5, 0, 6, 16);
    c.fillRect(5, 8, 6, 6);
    ctx.restore();
  }

  // ── 11: Power pole ──
  {
    const c = at(SPRITE_POWER_POLE);
    c.fillStyle = '#2d5a1e';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#886633';
    c.fillRect(7, 2, 2, 12);
    c.fillStyle = '#ccaa44';
    c.fillRect(5, 2, 6, 2);
    c.fillRect(5, 5, 6, 2);
    ctx.restore();
  }

  // ── 12: Iron ore ──
  {
    const c = at(SPRITE_IRON_ORE);
    c.fillStyle = '#8899aa';
    c.fillRect(4, 4, 8, 8);
    c.fillStyle = '#aabbcc';
    c.fillRect(5, 5, 3, 3);
    c.fillRect(9, 7, 2, 2);
    ctx.restore();
  }

  // ── 13: Copper ore ──
  {
    const c = at(SPRITE_COPPER_ORE);
    c.fillStyle = '#886633';
    c.fillRect(4, 4, 8, 8);
    c.fillStyle = '#cc8844';
    c.fillRect(5, 5, 3, 3);
    c.fillRect(8, 8, 3, 2);
    ctx.restore();
  }

  // ── 14: Gear ──
  {
    const c = at(SPRITE_GEAR);
    c.fillStyle = '#999';
    c.fillRect(5, 5, 6, 6);
    c.fillStyle = '#bbb';
    c.fillRect(6, 6, 4, 4);
    c.fillStyle = '#777';
    c.fillRect(7, 7, 2, 2);
    // Teeth
    c.fillStyle = '#999';
    c.fillRect(7, 3, 2, 2);
    c.fillRect(7, 11, 2, 2);
    c.fillRect(3, 7, 2, 2);
    c.fillRect(11, 7, 2, 2);
    ctx.restore();
  }

  // ── 15: Iron ingot ──
  {
    const c = at(SPRITE_IRON_INGOT);
    c.fillStyle = '#aabbcc';
    c.fillRect(3, 6, 10, 5);
    c.fillStyle = '#ccddee';
    c.fillRect(4, 7, 8, 3);
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
