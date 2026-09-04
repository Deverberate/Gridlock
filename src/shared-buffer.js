import {
  SAB_TOTAL_SLOTS, OFF_INST_A, OFF_INST_B,
  SB_HEADER_SLOTS, SB_HDR_FLAG, SB_HDR_COUNT,
} from './constants.js';

/**
 * Double-buffer SharedArrayBuffer architecture.
 *
 * Layout (every slot is 4 bytes; an Int32Array and Float32Array over the same
 * buffer therefore index identically):
 *
 *   [0]            swap flag  (int)    0 = half A current, 1 = half B current
 *   [1]            instance count (int)
 *   [2..8]         float stats written by the worker each tick:
 *                    pwrRatio, totalGen, totalReq, machines, beltLines,
 *                    beltItems, jammed
 *   [OFF_INST_A ..]        half A: SNAPSHOT_CAP × SB_STRIDE sprite instances
 *   [OFF_INST_B ..]        half B: same
 *   [OFF_MACH_TABLE ..]    machine metadata table (one MACH_T_STRIDE-float row
 *                          per machine, MACH_TABLE_CAP rows) for tooltips,
 *                          the eyedropper, and heat-map overlays
 *
 * The worker writes into the non-current instance half while the main thread
 * reads the current one; Atomics.store on the flag publishes each swap.
 * All offsets come from the shared constants module, so no layout
 * negotiation is needed between threads.
 */
export class SharedBufferManager {
  constructor() {
    this.buffer = new SharedArrayBuffer(SAB_TOTAL_SLOTS * 4);
    this.view = new Int32Array(this.buffer);
    this.fView = new Float32Array(this.buffer);

    this.OFF_A_DATA = OFF_INST_A;
    this.OFF_B_DATA = OFF_INST_B;

    // Initialize header
    Atomics.store(this.view, SB_HDR_FLAG, 0);
    Atomics.store(this.view, SB_HDR_COUNT, 0);
  }

  /** Slot the worker should write into this cycle (the non-current half). */
  getWriteOffset() {
    const flag = Atomics.load(this.view, SB_HDR_FLAG);
    return flag === 0 ? this.OFF_B_DATA : this.OFF_A_DATA;
  }

  /** Slot the main thread should read from (the current half). */
  getReadOffset() {
    const flag = Atomics.load(this.view, SB_HDR_FLAG);
    return flag === 0 ? this.OFF_A_DATA : this.OFF_B_DATA;
  }

  /** Worker publishes a finished half: store count, flip the flag. */
  swap(count) {
    Atomics.store(this.view, SB_HDR_COUNT, count);
    const flag = Atomics.load(this.view, SB_HDR_FLAG);
    Atomics.store(this.view, SB_HDR_FLAG, flag === 0 ? 1 : 0);
  }

  /** Current instance count (main thread). */
  getCount() {
    return Atomics.load(this.view, SB_HDR_COUNT);
  }

  /** Raw SharedArrayBuffer for posting to the worker. */
  getBuffer() {
    return this.buffer;
  }
}
