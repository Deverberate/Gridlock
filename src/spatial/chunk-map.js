import { CHUNK_SIZE, TILE_SIZE } from '../constants.js';

/**
 * Infinite chunk map: Map<chunkKey, ChunkData>.
 * Only materialized chunks exist in memory.
 * Spatial partitioning for rendering viewport culling and collision lookups.
 */
export class ChunkMap {
  constructor() {
    /** @type {Map<string, { tiles: Uint8Array, resources: Float32Array, resourceType: Uint8Array, dirty: boolean }>} */
    this.chunks = new Map();
  }

  /** Generate a chunk key string from chunk coordinates. */
  static key(cx, cy) {
    return `${cx},${cy}`;
  }

  /** Get or create a chunk at chunk coordinates (cx, cy). */
  getOrCreate(cx, cy) {
    const k = ChunkMap.key(cx, cy);
    let chunk = this.chunks.get(k);
    if (!chunk) {
      chunk = {
        tiles: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
        resources: new Float32Array(CHUNK_SIZE * CHUNK_SIZE),
        resourceType: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
        dirty: true,
      };
      this.chunks.set(k, chunk);
    }
    return chunk;
  }

  /** Get a chunk without creating it. Returns undefined if missing. */
  get(cx, cy) {
    return this.chunks.get(ChunkMap.key(cx, cy));
  }

  /** Convert world position (in tiles) to chunk coords. */
  static worldToChunk(x, y) {
    return [
      Math.floor(x / CHUNK_SIZE),
      Math.floor(y / CHUNK_SIZE),
    ];
  }

  /** Convert world position to local tile index within a chunk. */
  static worldToLocal(x, y) {
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return ly * CHUNK_SIZE + lx;
  }

  /** Get all chunk keys visible in a camera viewport (in tile coords). */
  getVisibleChunks(camX, camY, viewW, viewH) {
    const tileSize = TILE_SIZE;
    const halfW = (viewW / 2) / tileSize;
    const halfH = (viewH / 2) / tileSize;

    const minTX = camX - halfW;
    const maxTX = camX + halfW;
    const minTY = camY - halfH;
    const maxTY = camY + halfH;

    const [minCX, minCY] = ChunkMap.worldToChunk(minTX, minTY);
    const [maxCX, maxCY] = ChunkMap.worldToChunk(maxTX, maxTY);

    const result = [];
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        result.push({ cx, cy, chunk: this.getOrCreate(cx, cy) });
      }
    }
    return result;
  }
}
