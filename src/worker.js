/**
 * Web Worker: runs the ENTIRE factory simulation at a fixed 60 UPS.
 *
 * Owns (simulation side only, never rendering):
 *   - ECS World: every machine is an entity (position + machine components)
 *   - beltLines: Map of BeltLine flat-array structures (items are NOT entities)
 *   - chunkMap: terrain + ore deposits (deterministic, worker-local)
 *
 * Every tick, in demo order:
 *   updatePower -> updateMiners -> updateSmelters -> updateAssemblers -> updateBelts
 *
 * Then it packs the render snapshot into the SharedArrayBuffer write half:
 *   machines (state-aware sprite), belt tiles, belt items — one instance per
 *   sprite — plus the float stats header, and atomically swaps buffers so the
 *   main thread's WebGL renderer can draw it.
 *
 * Building commands arrive from the main thread via postMessage
 * ('place' / 'placeBelt' / 'erase') — placement math stays on the main thread;
 * the worker is the only one that mutates sim state.
 */

import { World } from './ecs/world.js';
import { updatePower } from './ecs/systems/power-grid.js';
import { BeltLine, updateBelts, pushToBeltStart } from './ecs/systems/belts.js';
import { updateMiners, updateSmelters, updateAssemblers } from './ecs/systems/machines.js';
import { ChunkMap } from './spatial/chunk-map.js';
import { generateChunkTerrain, tileInfo, consumeResourceAt } from './world/terrain-gen.js';
import {
  TICK_MS, SB_STRIDE, SNAPSHOT_CAP,
  SB_HDR_FLAG, SB_HDR_COUNT,
  SB_HDR_PWR_RATIO, SB_HDR_GEN, SB_HDR_REQ,
  SB_HDR_MACHINES, SB_HDR_BELT_LINES, SB_HDR_BELT_ITEMS, SB_HDR_JAMMED,
  OFF_INST_A, OFF_INST_B, OFF_MACH_TABLE,
  MACH_T_X, MACH_T_Y, MACH_T_TYPE, MACH_T_POWERED, MACH_T_DRAW, MACH_T_GEN,
  MACH_T_IN_REQ, MACH_T_IN_COUNT, MACH_T_IN_TYPE, MACH_T_PROGRESS, MACH_T_STRIDE,
  MACH_TABLE_CAP,
  COMP_POSITION, COMP_SPRITE, COMP_MACHINE,
  MACH_MINER, MACH_SMELTER, MACH_ASSEMBLER, MACH_GENERATOR, MACH_POLE,
  POWER_MINER, POWER_SMELTER, POWER_ASSEMBLER, POWER_GENERATOR,
  ITEM_SPRITES, SPR_ITEM_DOT,
  SPR_MINER, SPR_SMELTER, SPR_ASSEMBLER, SPR_GENERATOR, SPR_POWER_POLE,
  SPR_MINER_ON, SPR_SMELTER_ON, SPR_ASSEMBLER_ON, SPR_GENERATOR_ON,
  SPR_MACH_OFF, SPR_BELT_H, SPR_BELT_V,
  RES_IRON,
} from './constants.js';

const MACHINE_MASK = COMP_POSITION | COMP_SPRITE | COMP_MACHINE;

// ── Sim state (module-scoped; only one world per worker) ──
let world;
let chunkMap;
/** @type {Map<number, BeltLine>} */
let beltLines;
let beltSeq = 0;

let view;    // Int32 view over the SAB (header reads)
let fView;   // Float32 view over the SAB (data + float stats)

// ── env binding: pure systems get their state through this ──
let env = {
  tileRes: (tx, ty) => { const t = tileInfo(chunkMap, tx, ty); return { res: t.res, resType: t.resType }; },
  // The extraction side effect lives here (NOT inside the pure systems module):
  // the tick a miner actually digs ore out of the ground, tell the main thread
  // the tile's new amount so its terrain mirror — and therefore the hover
  // tooltip — shows live depletion instead of the pristine deposit. This fires
  // only on the exact tick an extraction succeeds, never per-frame.
  consumeTile: (tx, ty, amt) => {
    if (consumeResourceAt(chunkMap, tx, ty, amt) === 0) return false;
    postMessage({ type: 'TILE_UPDATE', x: tx, y: ty, amount: tileInfo(chunkMap, tx, ty).res });
    return true;
  },
  pushOutput: (tx, ty, type) => pushToBeltStart(beltLines, tx, ty, type),
};

// ═══════════════════════════════════════════════════════
//  SPAWN HELPERS
// ═══════════════════════════════════════════════════════

function baseSprite(kind) {
  switch (kind) {
    case MACH_MINER:     return SPR_MINER;
    case MACH_SMELTER:   return SPR_SMELTER;
    case MACH_ASSEMBLER: return SPR_ASSEMBLER;
    case MACH_GENERATOR: return SPR_GENERATOR;
    case MACH_POLE:      return SPR_POWER_POLE;
    default:             return SPR_MACH_OFF;
  }
}

/** Spawn a machine entity at tile (tx, ty) and configure its components. */
function placeMachine(kind, tx, ty) {
  const id = world.spawn(MACHINE_MASK);
  if (id === -1) return;
  const c = world.comps;
  c.positionX[id] = tx + 0.5;
  c.positionY[id] = ty + 0.5;
  c.spriteIdx[id] = baseSprite(kind);
  c.machineType[id] = kind;
  c.machineProgress[id] = 0;
  c.machinePowered[id] = 0;
  c.machineInputType[id] = 0;
  c.machineInputCount[id] = 0;
  c.machineInputReq[id] = 0;
  switch (kind) {
    case MACH_MINER:     c.machinePowerDraw[id] = POWER_MINER;     break;
    case MACH_SMELTER:   c.machinePowerDraw[id] = POWER_SMELTER;   c.machineInputReq[id] = 1; break;
    case MACH_ASSEMBLER: c.machinePowerDraw[id] = POWER_ASSEMBLER; c.machineInputReq[id] = 2; break;
    case MACH_GENERATOR: c.machinePowerGen[id] = POWER_GENERATOR;  break;
    case MACH_POLE:      break;
  }
}

/** Create a BeltLine from an ordered tile path and register it. */
function placeBeltLine(path) {
  if (!path || path.length === 0) return;
  const line = new BeltLine(path);
  line.id = beltSeq++;
  beltLines.set(line.id, line);
}

/** Remove any machine or belt line occupying tile (tx, ty). */
function eraseAt(tx, ty) {
  const c = world.comps;
  world.query(COMP_MACHINE, (id) => {
    if (Math.floor(c.positionX[id]) === tx && Math.floor(c.positionY[id]) === ty) {
      world.despawn(id);
    }
  });
  for (const [id, line] of beltLines) {
    for (const p of line.path) {
      if (p.x === tx && p.y === ty) { beltLines.delete(id); break; }
    }
  }
}

// ═══════════════════════════════════════════════════════
//  STARTING FACTORY (parity with demo.html setup)
// ═══════════════════════════════════════════════════════
function spawnStarterFactory() {
  // Generator at origin
  placeMachine(MACH_GENERATOR, 0, 0);

  // Find the nearest REAL iron deposit in a widening ring. The deposit must
  // hold a meaningful amount: a sub-unit sliver (res > 0 but < 1) can never be
  // dug out — with honest extraction it would stall the starter factory and,
  // before the honesty fix, silently minted phantom ore instead.
  let minerPos = null;
  for (let r = 1; r < 40 && !minerPos; r++) {
    for (let dx = -r; dx <= r && !minerPos; dx++) {
      for (let dy = -r; dy <= r && !minerPos; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const ti = tileInfo(chunkMap, dx, dy);
        if (ti.resType === RES_IRON && ti.res >= 20) minerPos = { x: dx, y: dy };
      }
    }
  }
  if (!minerPos) minerPos = { x: 3, y: 0 }; // fallback (shouldn't happen)

  placeMachine(MACH_MINER, minerPos.x, minerPos.y);

  // Belt from miner output (right side) to the smelter
  const path = [];
  for (let x = minerPos.x + 1; x <= minerPos.x + 4; x++) path.push({ x, y: minerPos.y });
  placeBeltLine(path);

  // Smelter at the end of the belt
  placeMachine(MACH_SMELTER, minerPos.x + 5, minerPos.y);
}

// ═══════════════════════════════════════════════════════
//  SNAPSHOT PACKING (worker -> main via SharedArrayBuffer)
// ═══════════════════════════════════════════════════════

/** Resolve the sprite a machine should show THIS tick (demo state logic). */
function machineSprite(id) {
  const c = world.comps;
  const t = c.machineType[id];
  if (t === MACH_POLE) return SPR_POWER_POLE; // poles never switch sprites
  if (!c.machinePowered[id]) return SPR_MACH_OFF;
  switch (t) {
    case MACH_MINER:     return SPR_MINER_ON;
    case MACH_SMELTER:   return c.machineInputCount[id] > 0 ? SPR_SMELTER_ON : SPR_SMELTER;
    case MACH_ASSEMBLER: return c.machineInputCount[id] >= c.machineInputReq[id] ? SPR_ASSEMBLER_ON : SPR_ASSEMBLER;
    case MACH_GENERATOR: return SPR_GENERATOR_ON;
    default:             return SPR_MACH_OFF;
  }
}

/** Pack machines + belt tiles + belt items into the SAB half at `offset` (float index). */
function packSnapshot(offset) {
  const c = world.comps;
  const out = fView;
  let n = 0;

  // 1. Machines (instanced, one per entity)
  world.query(MACHINE_MASK, (id) => {
    if (n >= SNAPSHOT_CAP) return;
    const o = offset + n * SB_STRIDE;
    out[o] = c.positionX[id];
    out[o + 1] = c.positionY[id];
    out[o + 2] = machineSprite(id);
    n++;
  });

  // 2. Belt tiles (one sprite per segment)
  for (const [bid, line] of beltLines) {
    for (let i = 0; i < line.path.length - 1; i++) {
      if (n >= SNAPSHOT_CAP) break;
      const p = line.path[i];
      const nx = line.path[i + 1];
      const o = offset + n * SB_STRIDE;
      out[o] = p.x + 0.5;
      out[o + 1] = p.y + 0.5;
      out[o + 2] = nx.x !== p.x ? SPR_BELT_H : SPR_BELT_V;
      n++;
    }
  }

  // 3. Belt items (positions sampled from flat-array progress — no entities)
  for (const [bid, line] of beltLines) {
    for (const it of line.items) {
      if (n >= SNAPSHOT_CAP) break;
      const pos = line.getPos(it.progress);
      const o = offset + n * SB_STRIDE;
      out[o] = pos.x;
      out[o + 1] = pos.y;
      out[o + 2] = ITEM_SPRITES[it.type] !== undefined ? ITEM_SPRITES[it.type] : SPR_ITEM_DOT;
      n++;
    }
  }

  return n;
}

/**
 * Write one metadata row per machine into the SAB machine table. The main
 * thread reads these exact floats (draw/gen/recipe/progress) for tooltips,
 * the eyedropper, and heat-map overlays — no message round-trip.
 */
function writeMachineTable() {
  const c = world.comps;
  const base = OFF_MACH_TABLE;
  const cap = Math.min(world.pool.count, MACH_TABLE_CAP);
  let r = 0;
  world.query(COMP_MACHINE, (id) => {
    if (r >= cap) return;
    const o = base + r * MACH_T_STRIDE;
    fView[o + MACH_T_X]        = c.positionX[id];
    fView[o + MACH_T_Y]        = c.positionY[id];
    fView[o + MACH_T_TYPE]     = c.machineType[id];
    fView[o + MACH_T_POWERED]  = c.machinePowered[id];
    fView[o + MACH_T_DRAW]     = c.machinePowerDraw[id];
    fView[o + MACH_T_GEN]      = c.machinePowerGen[id];
    fView[o + MACH_T_IN_REQ]   = c.machineInputReq[id];
    fView[o + MACH_T_IN_COUNT] = c.machineInputCount[id];
    fView[o + MACH_T_IN_TYPE]  = c.machineInputType[id];
    fView[o + MACH_T_PROGRESS] = c.machineProgress[id];
    r++;
  });
}

// ═══════════════════════════════════════════════════════
//  FIXED-TIMESTEP TICK
// ═══════════════════════════════════════════════════════
function tick() {
  const dt = TICK_MS / 1000;

  // ── Global simulation — NO viewport culling; the whole factory ticks ──
  const pwr = updatePower(world);
  updateMiners(world, dt, pwr.ratio, env);
  updateSmelters(world, dt, pwr.ratio, env);
  updateAssemblers(world, dt, pwr.ratio, env);
  updateBelts(beltLines, world, dt, pwr.ratio);

  // ── Stats header (floats read by the main-thread HUD) ──
  let beltItems = 0;
  let jammed = 0;
  for (const [id, line] of beltLines) {
    beltItems += line.items.length;
    if (line.jammed) jammed++;
  }
  fView[SB_HDR_PWR_RATIO] = pwr.ratio;
  fView[SB_HDR_GEN] = pwr.gen;
  fView[SB_HDR_REQ] = pwr.req;
  fView[SB_HDR_MACHINES] = world.pool.count;
  fView[SB_HDR_BELT_LINES] = beltLines.size;
  fView[SB_HDR_BELT_ITEMS] = beltItems;
  fView[SB_HDR_JAMMED] = jammed;

  // ── Machine metadata table for the UI layer ──
  writeMachineTable();

  // ── Pack into the write half, then publish the swap ──
  const flag = Atomics.load(view, SB_HDR_FLAG);
  const writeOffset = flag === 0 ? OFF_INST_B : OFF_INST_A;
  const count = packSnapshot(writeOffset);
  Atomics.store(view, SB_HDR_COUNT, count);
  Atomics.store(view, SB_HDR_FLAG, flag === 0 ? 1 : 0);
}

// ═══════════════════════════════════════════════════════
//  INIT + MESSAGE HANDLING
// ═══════════════════════════════════════════════════════
function init(data) {
  world = new World();
  chunkMap = new ChunkMap();
  beltLines = new Map();
  beltSeq = 0;

  view = new Int32Array(data.sharedBuffer);
  fView = new Float32Array(data.sharedBuffer);

  // Pre-generate the terrain around the origin (demo generated 9x9 chunks)
  for (let cy = -4; cy <= 4; cy++) {
    for (let cx = -4; cx <= 4; cx++) {
      generateChunkTerrain(chunkMap, cx, cy);
    }
  }

  spawnStarterFactory();

  postMessage({ type: 'ready' });
  setInterval(tick, TICK_MS);
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    init(msg);
    return;
  }
  if (!world) return; // ignore commands before init
  switch (msg.type) {
    case 'place':
      placeMachine(msg.kind, msg.x, msg.y);
      break;
    case 'placeBelt':
      placeBeltLine(msg.path);
      break;
    case 'erase':
      eraseAt(msg.x, msg.y);
      break;
  }
};
