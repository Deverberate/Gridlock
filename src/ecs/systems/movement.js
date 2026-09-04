import { COMP_POSITION, COMP_VELOCITY } from '../../constants.js';

const REQUIRED = COMP_POSITION | COMP_VELOCITY;

/**
 * MovementSystem: applies velocity to position.
 * Runs in the worker at each tick.
 */
export function MovementSystem(world, dt) {
  const { pool, comps } = world;

  pool.query(REQUIRED, (id) => {
    comps.positionX[id] += comps.velocityX[id] * dt;
    comps.positionY[id] += comps.velocityY[id] * dt;
  });
}
