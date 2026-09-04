import { MAX_ENTITIES, SB_STRIDE } from './constants.js';

/**
 * Double-buffer SharedArrayBuffer architecture.
 * 
 * Buffer is split into two halves (A and B).
 * Worker writes to one while main thread reads from the other.
 * An atomic flag (index 0) signals which buffer is current:
 *   0 = buffer A is current (worker just finished writing A, main reads A)
 *   1 = buffer B is current
 * 
 * Layout:
 *   [0]       = swap flag (Int32)
 *   [1]       = entity count (Int32)
 *   [2..N]    = entity render data (SB_STRIDE floats per entity, repeated twice for A and B)
 */

const TOTAL_SIZE_PER_HALF = 2 + (MAX_ENTITIES * SB_STRIDE); // Int32 header + entity data
const TOTAL_SIZE = 2 + (TOTAL_SIZE_PER_HALF * 2); // flag + count + A half + B half

export class SharedBufferManager {
  constructor() {
    this.buffer = new SharedArrayBuffer(TOTAL_SIZE * 4); // 4 bytes per Float32/Int32
    this.view = new Int32Array(this.buffer);
    this.fView = new Float32Array(this.buffer);

    // Layout offsets (in Int32 units)
    this.OFF_FLAG   = 0;
    this.OFF_COUNT  = 1;
    this.OFF_A_DATA = 2;
    this.OFF_B_DATA = 2 + TOTAL_SIZE_PER_HALF;

    // Initialize
    Atomics.store(this.view, this.OFF_FLAG, 0);
    Atomics.store(this.view, this.OFF_COUNT, 0);
  }

  /** Get the write buffer offset for the worker (always writes to the non-current half). */
  getWriteOffset() {
    const flag = Atomics.load(this.view, this.OFF_FLAG);
    return flag === 0 ? this.OFF_B_DATA : this.OFF_A_DATA;
  }

  /** Get the read buffer offset for the main thread (always reads the current half). */
  getReadOffset() {
    const flag = Atomics.load(this.view, this.OFF_FLAG);
    return flag === 0 ? this.OFF_A_DATA : this.OFF_B_DATA;
  }

  /** Worker calls this after writing all entity data to signal a swap. */
  swap(count) {
    Atomics.store(this.view, this.OFF_COUNT, count);
    const flag = Atomics.load(this.view, this.OFF_FLAG);
    Atomics.store(this.view, this.OFF_FLAG, flag === 0 ? 1 : 0);
  }

  /** Main thread reads the current entity count. */
  getCount() {
    return Atomics.load(this.view, this.OFF_COUNT);
  }

  /** Get raw SharedArrayBuffer for posting to worker. */
  getBuffer() {
    return this.buffer;
  }
}
