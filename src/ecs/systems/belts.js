import { BELT_SPEED, ITEM_SPACING, INSERT_GAP, COMP_MACHINE } from '../../constants.js';
import { machineAccepts, machineFeed } from './machines.js';

/**
 * BeltLine — one connected run of belt segments stored as a single flat data
 * structure, NOT individual item entities. Items live in this array with a
 * single scalar progress (distance in tiles from the line start); the whole
 * line advances via one speed value per tick.
 *
 * Belt items are never ECS entities — that would blow memory bandwidth at
 * 50k+ items. Ported 1:1 from demo.html.
 */
export class BeltLine {
  constructor(path) {
    this.id = 0;               // assigned by the owning Map (beltLines)
    this.path = path;          // [{x,y}, ...] ordered tiles, start -> end
    this.items = [];           // [{type, progress}] progress in tiles along path
    this.len = path.length;
    this.jammed = false;
  }

  /** World position (tile center) at a distance along the path. */
  getPos(p) {
    const i = Math.min(Math.floor(p), this.len - 1);
    const f = p - i;
    const n = Math.min(i + 1, this.len - 1);
    return {
      x: this.path[i].x + (this.path[n].x - this.path[i].x) * f + 0.5,
      y: this.path[i].y + (this.path[n].y - this.path[i].y) * f + 0.5,
    };
  }

  /** True when there is room to insert a new item at the line start. */
  canInsert() {
    if (this.items.length === 0) return true;
    return this.items[0].progress > INSERT_GAP;
  }

  /** Push a new item at the line start. Returns false when blocked. */
  insert(type) {
    if (!this.canInsert()) return false;
    this.items.unshift({ type, progress: 0 });
    return true;
  }
}

/**
 * Find the belt line whose START tile is a given neighbor of `tile`.
 * Returns null when none exists.
 */
export function findNextBelt(beltLines, tile, cur) {
  const ds = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of ds) {
    const nx = tile.x + dx;
    const ny = tile.y + dy;
    for (const [id, line] of beltLines) {
      if (line === cur) continue;
      if (line.path[0].x === nx && line.path[0].y === ny) return line;
    }
  }
  return null;
}

/** Find the first machine entity occupying a tile adjacent to `tile` (direction scan order). */
export function findAdjMachine(world, tile) {
  const ds = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let found = -1;
  for (const [dx, dy] of ds) {
    const mx = tile.x + dx;
    const my = tile.y + dy;
    world.query(COMP_MACHINE, (id) => {
      if (found >= 0) return;
      if (Math.floor(world.comps.positionX[id]) === mx
          && Math.floor(world.comps.positionY[id]) === my) found = id;
    });
    if (found >= 0) return found;
  }
  return -1;
}

/**
 * Push an item from a machine at (wx, wy) onto the start of an adjacent belt
 * line. Machine outputs only ever land on a line START (demo behavior).
 */
export function pushToBeltStart(beltLines, wx, wy, type) {
  const ds = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of ds) {
    for (const [id, line] of beltLines) {
      if (line.path[0].x === wx + dx && line.path[0].y === wy + dy && line.canInsert()) {
        line.insert(type);
        return true;
      }
    }
  }
  return false;
}

/**
 * BeltLineSystem — advance every line. Demo semantics, ported 1:1:
 *  - back-pressure: an item won't move if the item ahead is closer than
 *    ITEM_SPACING; a jammed head propagates upstream until the line stalls.
 *  - items are stored newest (index 0, progress 0) -> oldest (high index,
 *    near the end); "ahead" therefore means i+1.
 *  - at the line end the head item hands off to the next belt line, or is fed
 *    into an adjacent accepting machine. If neither is possible: jammed.
 *
 * @param {Map<number, BeltLine>} beltLines
 * @param {import('../world.js').World} world
 * @param {number} ratio proportional power ratio (belts slow during brownout)
 */
export function updateBelts(beltLines, world, dt, ratio) {
  for (const [id, line] of beltLines) {
    line.jammed = false;
    const spd = BELT_SPEED * ratio;
    for (let i = line.items.length - 1; i >= 0; i--) {
      const it = line.items[i];
      const maxP = line.len - 0.5;

      // Back-pressure: item ahead (i+1, closer to the end) within ITEM_SPACING
      let blocked = false;
      if (i < line.items.length - 1 && line.items[i + 1].progress - it.progress < ITEM_SPACING) {
        blocked = true;
      }
      if (!blocked && it.progress < maxP) {
        it.progress += spd * dt;
        if (it.progress > maxP) it.progress = maxP;
      }

      // Head of the line: attempt handoff to next belt or adjacent machine
      if (it.progress >= maxP && i === line.items.length - 1) {
        const end = line.path[line.path.length - 1];
        const next = findNextBelt(beltLines, end, line);
        if (next && next.canInsert()) {
          next.insert(it.type);
          line.items.splice(i, 1);
        } else {
          const mac = findAdjMachine(world, end);
          if (mac >= 0 && machineAccepts(world, mac, it.type)) {
            machineFeed(world, mac, it.type);
            line.items.splice(i, 1); // demo parity: feed even if the buffer was full
          } else {
            line.jammed = true;
          }
        }
      }
    }
  }
}
