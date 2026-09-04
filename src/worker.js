/**
 * Web Worker: runs the entire ECS simulation at fixed UPS.
 * Communicates with the main thread via SharedArrayBuffer (double-buffered).
 */

import { World } from './ecs/world.js';
import { MovementSystem } from './ecs/systems/movement.js';
import { ChunkMap } from './spatial/chunk-map.js';
import { generateChunkTerrain } from './world/terrain-gen.js';
import { TICK_RATE, TICK_MS, SB_STRIDE, COMP_POSITION, COMP_SPRITE, COMP_VELOCITY } from './constants.js';

let world;
let chunkMap;
let sharedView;   // Int32 view of SharedArrayBuffer
let sharedFView;  // Float32 view of SharedArrayBuffer
let bufferManager; // raw buffer manager API from main thread

const OFF_FLAG  = 0;
const OFF_COUNT = 1;
const OFF_A     = 2;
// B offset computed at runtime based on layout

let totalSizePerHalf; // computed on init
let offB;

let tickCount = 0;
let running = false;
let accumulator = 0;
let lastTime = 0;

// ── Init ────────────────────────────────────────────────
function init(data) {
  const { sharedBuffer, sbLayout } = data;

  world = new World();
  chunkMap = new ChunkMap();

  // Set up shared buffer views
  sharedView = new Int32Array(sharedBuffer);
  sharedFView = new Float32Array(sharedBuffer);

  totalSizePerHalf = sbLayout.totalSizePerHalf;
  offB = sbLayout.offB;

  // Generate initial terrain around origin
  for (let cy = -2; cy <= 2; cy++) {
    for (let cx = -2; cx <= 2; cx++) {
      generateChunkTerrain(chunkMap, cx, cy);
    }
  }

  // Spawn a bunch of test entities to prove the ECS works
  spawnTestEntities(5000);

  running = true;
  lastTime = performance.now();
  postMessage({ type: 'ready' });
}

function spawnTestEntities(count) {
  for (let i = 0; i < count; i++) {
    const mask = COMP_POSITION | COMP_SPRITE | COMP_VELOCITY;
    const id = world.spawn(mask);
    if (id === -1) break;

    const comps = world.comps;
    // Random position in a 200x200 tile area
    comps.positionX[id] = (Math.random() - 0.5) * 200;
    comps.positionY[id] = (Math.random() - 0.5) * 200;

    // Random slow velocity
    comps.velocityX[id] = (Math.random() - 0.5) * 2;
    comps.velocityY[id] = (Math.random() - 0.5) * 2;

    // All same sprite (index 1 = test entity)
    comps.spriteIdx[id] = 1;
    comps.spriteVar[id] = 0;
    comps.spriteZ[id] = 20;
  }
}

// ── Tick ────────────────────────────────────────────────
function tick(dt) {
  // Run systems
  MovementSystem(world, dt);

  // Wrap entities that go too far from origin (soft boundary)
  const { comps, pool } = world;
  pool.query(COMP_POSITION, (id) => {
    const MAX_RANGE = 200;
    if (comps.positionX[id] > MAX_RANGE) comps.positionX[id] = -MAX_RANGE;
    if (comps.positionX[id] < -MAX_RANGE) comps.positionX[id] = MAX_RANGE;
    if (comps.positionY[id] > MAX_RANGE) comps.positionY[id] = -MAX_RANGE;
    if (comps.positionY[id] < -MAX_RANGE) comps.positionY[id] = MAX_RANGE;
  });

  tickCount++;
}

// ── Render data pack ────────────────────────────────────
function packRenderData() {
  const mask = COMP_POSITION | COMP_SPRITE;
  const count = world.packRenderData(mask, sharedFView, offA);
  return count;
}

function packRenderDataTo(offset) {
  const mask = COMP_POSITION | COMP_SPRITE;
  return world.packRenderData(mask, sharedFView, offset);
}

// ── Main loop ───────────────────────────────────────────
function loop(now) {
  if (!running) return;

  const dt = (now - lastTime) / 1000;
  lastTime = now;
  accumulator += dt;

  const fixedDt = 1 / TICK_RATE;

  // Fixed timestep
  while (accumulator >= fixedDt) {
    tick(fixedDt);
    accumulator -= fixedDt;
  }

  // Pack render data into the WRITE half of the shared buffer
  const writeOffset = Atomics.load(sharedView, OFF_FLAG) === 0 ? offB : OFF_A;
  const count = packRenderDataTo(writeOffset);

  // Swap buffers
  Atomics.store(sharedView, OFF_COUNT, count);
  const flag = Atomics.load(sharedView, OFF_FLAG);
  Atomics.store(sharedView, OFF_FLAG, flag === 0 ? 1 : 0);

  // Report stats
  if (tickCount % 30 === 0) {
    postMessage({
      type: 'stats',
      entityCount: world.pool.count,
      tickCount,
    });
  }

  requestAnimationFrame(loop);
}

// ── Message handler ─────────────────────────────────────
self.onmessage = (e) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init':
      init(msg);
      requestAnimationFrame(loop);
      break;

    case 'command':
      // Future: handle building placement, etc.
      break;
  }
};
