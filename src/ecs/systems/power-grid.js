import { COMP_MACHINE, MACH_NONE, MACH_POLE, MACH_GENERATOR } from '../../constants.js';

/**
 * PowerGridSystem — proportional power scaling (O(n), zero sorting).
 *
 * Demo semantics, ported 1:1:
 *   ratio = min(1, totalGenerated / totalRequested)
 *   every consumer runs at baseSpeed × ratio simultaneously.
 *   ratio = 0  -> blackout, everything off.
 *   0 < r < 1  -> brownout, all machines proportionally slowed.
 *   r = 1      -> full power.
 *
 * No dynamic sorting of consumers; a single O(n) pass over machines.
 *
 * @param {import('../world.js').World} world
 * @returns {{ gen: number, req: number, ratio: number }}
 */
export function updatePower(world) {
  const { comps } = world;
  let gen = 0;
  let req = 0;

  // Pass 1: sum producers and consumers
  world.query(COMP_MACHINE, (id) => {
    const t = comps.machineType[id];
    if (t === MACH_GENERATOR) {
      gen += comps.machinePowerGen[id];
    } else if (t !== MACH_NONE && t !== MACH_POLE) {
      req += comps.machinePowerDraw[id];
    }
  });

  const ratio = req === 0 ? 1 : Math.min(1, gen / req);

  // Pass 2: stamp the powered flag on every machine (renderer reads it for on/off sprites)
  world.query(COMP_MACHINE, (id) => {
    const t = comps.machineType[id];
    if (t !== MACH_NONE && t !== MACH_POLE) {
      comps.machinePowered[id] = ratio > 0 ? 1 : 0;
    }
  });

  return { gen, req, ratio };
}
