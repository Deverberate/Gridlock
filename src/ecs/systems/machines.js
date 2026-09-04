import {
  COMP_MACHINE,
  MACH_MINER, MACH_SMELTER, MACH_ASSEMBLER,
  ITEM_IRON_ORE, ITEM_COPPER_ORE, ITEM_IRON_INGOT, ITEM_COPPER_INGOT, ITEM_GEAR,
  RES_IRON, RES_COPPER,
  MINER_CYCLE, SMELT_TIME, ASSEMBLE_TIME,
} from '../../constants.js';

/**
 * Machine logic — ported 1:1 from demo.html (updateMiners/updateSmelters/
 * updateAssemblers/machineAccepts/machineFeed).
 *
 * env is the worker's state binding (kept out of the pure functions):
 *   env.tileRes(tx, ty)            -> { res, resType } for the tile under a miner
 *   env.consumeTile(tx, ty, amt)   -> true when a mined item was consumed from the ground
 *   env.pushOutput(tx, ty, type)   -> true when a machine output landed on an adjacent belt start
 *   env.feedMachine(id, type)      -> increments a machine's input buffer (see machineFeed)
 *
 * All speed math uses dt × ratio (proportional power scaling) — identical to demo.
 */

/** Smelter recipe map: input item type -> output item type. */
export const SMELT_RECIPES = {
  [ITEM_IRON_ORE]:   ITEM_IRON_INGOT,
  [ITEM_COPPER_ORE]: ITEM_COPPER_INGOT,
};

/** Does a machine accept an incoming item from a belt? */
export function machineAccepts(world, id, type) {
  const t = world.comps.machineType[id];
  if (t === MACH_SMELTER) return SMELT_RECIPES[type] !== undefined;
  if (t === MACH_ASSEMBLER) return type === ITEM_IRON_INGOT; // gear recipe: iron ingots
  return false;
}

/** Feed an item into a machine's input buffer (no-op when full — demo parity). */
export function machineFeed(world, id, type) {
  const c = world.comps;
  if ((c.machineType[id] === MACH_SMELTER || c.machineType[id] === MACH_ASSEMBLER)
      && c.machineInputCount[id] < c.machineInputReq[id]) {
    c.machineInputType[id] = type;
    c.machineInputCount[id]++;
  }
}

/** MinerSystem: extract ore from the ground at 1 item / MINER_CYCLE × ratio. */
export function updateMiners(world, dt, ratio, env) {
  const { comps } = world;
  world.query(COMP_MACHINE, (id) => {
    if (comps.machineType[id] !== MACH_MINER || !comps.machinePowered[id]) return;
    const wx = Math.floor(comps.positionX[id]);
    const wy = Math.floor(comps.positionY[id]);
    const tile = env.tileRes(wx, wy);
    if (tile.res <= 0 || tile.resType === 0) return; // 0 = RES_NONE

    // A full unit must exist to dig out — a stranded fraction (< 1) can never
    // fill an item, so stall instead of minting phantom ore forever.
    if (tile.res >= 1) {
      comps.machineProgress[id] += dt * ratio;
      if (comps.machineProgress[id] >= MINER_CYCLE) {
        comps.machineProgress[id] = 0;
        const itemType = tile.resType === RES_IRON ? ITEM_IRON_ORE : ITEM_COPPER_ORE;
        // Only dig the ore out when the output belt actually took it (demo behavior).
        if (env.pushOutput(wx, wy, itemType)) env.consumeTile(wx, wy, 1);
      }
    }
  });
}

/** SmelterSystem: consume 1 ore from the input buffer, produce 1 ingot after SMELT_TIME. */
export function updateSmelters(world, dt, ratio, env) {
  const { comps } = world;
  world.query(COMP_MACHINE, (id) => {
    if (comps.machineType[id] !== MACH_SMELTER || !comps.machinePowered[id]) return;
    if (comps.machineInputCount[id] > 0) {
      comps.machineProgress[id] += dt * ratio;
      if (comps.machineProgress[id] >= SMELT_TIME) {
        comps.machineProgress[id] = 0;
        comps.machineInputCount[id]--;
        const outType = SMELT_RECIPES[comps.machineInputType[id]];
        if (outType !== undefined) {
          const wx = Math.floor(comps.positionX[id]);
          const wy = Math.floor(comps.positionY[id]);
          env.pushOutput(wx, wy, outType);
        }
      }
    }
  });
}

/** AssemblerSystem: consume inr inputs, produce 1 gear after ASSEMBLE_TIME. */
export function updateAssemblers(world, dt, ratio, env) {
  const { comps } = world;
  world.query(COMP_MACHINE, (id) => {
    if (comps.machineType[id] !== MACH_ASSEMBLER || !comps.machinePowered[id]) return;
    if (comps.machineInputCount[id] >= comps.machineInputReq[id]) {
      comps.machineProgress[id] += dt * ratio;
      if (comps.machineProgress[id] >= ASSEMBLE_TIME) {
        comps.machineProgress[id] = 0;
        comps.machineInputCount[id] = 0;
        const wx = Math.floor(comps.positionX[id]);
        const wy = Math.floor(comps.positionY[id]);
        env.pushOutput(wx, wy, ITEM_GEAR);
      }
    }
  });
}
