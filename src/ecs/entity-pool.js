import { MAX_ENTITIES } from '../constants.js';

/**
 * Pre-allocated entity ID pool. Zero GC.
 * Free IDs are stored in a stack; allocation pops, deallocation pushes.
 */
export class EntityPool {
  constructor(max = MAX_ENTITIES) {
    this.max = max;
    this.alive = new Uint32Array(max);   // 1 = alive, 0 = dead
    this.masks = new BigUint64Array(max); // component bitmask per entity
    this.count = 0;

    // Free list: stack of available IDs
    this._freeStack = new Uint32Array(max);
    this._freeTop = 0;

    // Init: all IDs start free
    for (let i = max - 1; i >= 0; i--) {
      this._freeStack[this._freeTop++] = i;
    }
  }

  /** Allocate a new entity ID. Returns -1 if pool is full. */
  create() {
    if (this._freeTop === 0) return -1;
    const id = this._freeStack[--this._freeTop];
    this.alive[id] = 1;
    this.masks[id] = 0n;
    this.count++;
    return id;
  }

  /** Deallocate an entity ID. */
  destroy(id) {
    if (this.alive[id] === 0) return;
    this.alive[id] = 0;
    this.masks[id] = 0n;
    this.count--;
    this._freeStack[this._freeTop++] = id;
  }

  /** Add a component to an entity. */
  addComponent(id, compBit) {
    this.masks[id] |= compBit;
  }

  /** Remove a component from an entity. */
  removeComponent(id, compBit) {
    this.masks[id] &= ~compBit;
  }

  /** Check if entity has all required components. */
  hasAll(id, required) {
    return (this.masks[id] & required) === required;
  }

  /** Iterate all alive entities matching a bitmask. Calls fn(entityId). */
  query(required, fn) {
    for (let i = 0; i < this.max; i++) {
      if (this.alive[i] && this.hasAll(i, required)) {
        fn(i);
      }
    }
  }
}
