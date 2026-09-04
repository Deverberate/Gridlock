import { CHUNK_SIZE, TERRAIN_GRASS, TERRAIN_WATER, TERRAIN_STONE } from '../constants.js';
import { ChunkMap } from '../spatial/chunk-map.js';

// ── Simple seeded noise (value noise with lerp) ─────────

function hash(x, y, seed) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff; // 0..1
}

function smoothNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Smoothstep
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);

  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, seed, octaves = 4) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq, seed + i * 1000);
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

/**
 * Generate terrain for a chunk using seeded simplex-like noise.
 * Tiles: TERRAIN_GRASS (0), TERRAIN_WATER (1), TERRAIN_STONE (2)
 * Resources: float value > 0 means ore present, value = amount
 */
export function generateChunkTerrain(chunkMap, cx, cy, seed = 42) {
  const chunk = chunkMap.getOrCreate(cx, cy);
  const worldOffsetX = cx * CHUNK_SIZE;
  const worldOffsetY = cy * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = worldOffsetX + lx;
      const wy = worldOffsetY + ly;

      // Terrain height
      const height = fbm(wx * 0.02, wy * 0.02, seed);

      // Terrain type
      let tile;
      if (height < 0.3) {
        tile = TERRAIN_WATER;
      } else if (height > 0.7) {
        tile = TERRAIN_STONE;
      } else {
        tile = TERRAIN_GRASS;
      }

      chunk.tiles[ly * CHUNK_SIZE + lx] = tile;

      // Ore patches: use a different noise layer
      const oreNoise = fbm(wx * 0.05 + 500, wy * 0.05 + 500, seed + 999, 3);
      if (oreNoise > 0.65 && tile !== TERRAIN_WATER) {
        // Amount scales with noise intensity
        chunk.resources[ly * CHUNK_SIZE + lx] = (oreNoise - 0.65) * 500;
      }
    }
  }

  chunk.dirty = true;
}
