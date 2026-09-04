import { CHUNK_SIZE, TERRAIN_GRASS, TERRAIN_WATER, TERRAIN_STONE, RES_IRON, RES_COPPER } from '../constants.js';
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
 * Generate terrain for a chunk using seeded value noise.
 * Tile thresholds + ore deposit rules are EXACTLY the demo.html values so the
 * worker sim and the main-thread render mirror produce identical worlds:
 *   ore noise > 0.45  -> deposit, amount = (ore - 0.45) * 500
 *   ore noise > 0.60  -> copper, otherwise iron
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

      // Ore deposits: same noise field + thresholds as demo.html
      const ore = fbm(wx * 0.05 + 500, wy * 0.05 + 500, 1041, 3);
      if (ore > 0.45 && tile !== TERRAIN_WATER) {
        chunk.resources[ly * CHUNK_SIZE + lx] = (ore - 0.45) * 500; // amount
        chunk.resourceType[ly * CHUNK_SIZE + lx] = ore > 0.6 ? RES_COPPER : RES_IRON;
      }
    }
  }

  chunk.dirty = true;
}

/** Ensure the chunk at (cx, cy) exists (generated on demand). */
export function ensureChunk(chunkMap, cx, cy) {
  let chunk = chunkMap.get(cx, cy);
  if (!chunk) {
    generateChunkTerrain(chunkMap, cx, cy);
    chunk = chunkMap.get(cx, cy);
  }
  return chunk;
}

/**
 * Read terrain + deposit info for a world tile, generating the chunk on demand.
 * Returns { tile, res, resType }.
 */
export function tileInfo(chunkMap, wx, wy) {
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cy = Math.floor(wy / CHUNK_SIZE);
  const chunk = ensureChunk(chunkMap, cx, cy);
  const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const i = ly * CHUNK_SIZE + lx;
  return { tile: chunk.tiles[i], res: chunk.resources[i], resType: chunk.resourceType[i] };
}

/**
 * Consume `amt` ore from a deposit at a world tile.
 * Returns the deposit's resource type when enough was present (RES_IRON/RES_COPPER),
 * or RES_NONE otherwise. Used by the miner system.
 */
export function consumeResourceAt(chunkMap, wx, wy, amt) {
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cy = Math.floor(wy / CHUNK_SIZE);
  const chunk = ensureChunk(chunkMap, cx, cy);
  const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const i = ly * CHUNK_SIZE + lx;
  if (chunk.resources[i] >= amt) {
    chunk.resources[i] -= amt;
    return chunk.resourceType[i];
  }
  return 0; // RES_NONE
}
