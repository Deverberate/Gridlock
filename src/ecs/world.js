import { EntityPool } from './entity-pool.js';
import { ComponentArrays } from './component-arrays.js';
import { MAX_ENTITIES, SB_STRIDE } from '../constants.js';

/**
 * ECS World: owns the entity pool and all component arrays.
 * Provides convenience methods for creating/archetypes.
 */
export class World {
  constructor(max = MAX_ENTITIES) {
    this.pool = new EntityPool(max);
    this.comps = new ComponentArrays(max);
    this.max = max;
  }

  /** Create an entity with the given component bitmask and return its ID. */
  spawn(mask) {
    const id = this.pool.create();
    if (id === -1) return -1;
    this.pool.masks[id] = mask;
    return id;
  }

  /** Destroy an entity. */
  despawn(id) {
    this.pool.destroy(id);
  }

  /** Run a query: call fn(id) for every alive entity matching the bitmask. */
  query(required, fn) {
    this.pool.query(required, fn);
  }

  /** Pack all alive entities matching a mask into a Float32Array for rendering. */
  packRenderData(mask, outArray, outOffset = 0) {
    let count = 0;
    this.pool.query(mask, (id) => {
      const off = outOffset + count * SB_STRIDE;
      outArray[off + 0] = this.comps.positionX[id];
      outArray[off + 1] = this.comps.positionY[id];
      outArray[off + 2] = this.comps.spriteIdx[id];
      count++;
    });
    return count;
  }
}
