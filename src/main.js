/**
 * Main thread entry point — UI + WebGL only. ZERO simulation logic.
 *
 *   - Input: camera pan/zoom, toolbar tools, click placement, and the
 *     middle-click EYEDROPPER (grab a machine/belt under the cursor and
 *     immediately ghost it for placement).
 *   - Commands: building edits are postMessage'd to the worker; the worker is
 *     the only thread that mutates factory state.
 *   - Render: reads the worker's snapshot from the SharedArrayBuffer
 *     (sprite instances + per-machine metadata table) and draws with
 *     instanced WebGL2 + a translucent ghost layer. Digit keys swap the draw
 *     state to GPU heat-map overlays (1 = Power load, 2 = Belt throughput).
 *   - DOM: math-native tooltips track the cursor and print the exact
 *     consumption/production floats read straight from the SAB.
 */

import { initWebGL } from './render/webgl-init.js';
import { InstancedRenderer } from './render/instanced-renderer.js';
import { OverlayRenderer } from './render/overlay-renderer.js';
import { GhostRenderer } from './render/ghost-renderer.js';
import { ChunkMeshManager } from './render/chunk-mesh.js';
import { Camera } from './render/camera.js';
import { SharedBufferManager } from './shared-buffer.js';
import { Keyboard } from './input/keyboard.js';
import { Mouse } from './input/mouse.js';
import { CameraControls } from './input/camera-controls.js';
import { ChunkMap } from './spatial/chunk-map.js';
import { generateChunkTerrain, ensureChunk, tileInfo } from './world/terrain-gen.js';
import {
  CHUNK_SIZE,
  SB_HDR_PWR_RATIO, SB_HDR_GEN, SB_HDR_REQ,
  SB_HDR_MACHINES, SB_HDR_BELT_LINES, SB_HDR_BELT_ITEMS, SB_HDR_JAMMED,
  OFF_MACH_TABLE, MACH_T_STRIDE,
  MACH_T_X, MACH_T_Y, MACH_T_TYPE, MACH_T_POWERED, MACH_T_DRAW, MACH_T_GEN,
  MACH_T_IN_REQ, MACH_T_IN_COUNT, MACH_T_IN_TYPE, MACH_T_PROGRESS,
  MACH_MINER, MACH_SMELTER, MACH_ASSEMBLER, MACH_GENERATOR, MACH_POLE,
  SPR_MINER, SPR_SMELTER, SPR_ASSEMBLER, SPR_GENERATOR, SPR_POWER_POLE,
  SPR_BELT_H, SPR_BELT_V,
  ITEM_IRON_ORE, ITEM_COPPER_ORE, ITEM_IRON_INGOT, ITEM_COPPER_INGOT, ITEM_GEAR,
} from './constants.js';

// ── DOM refs ────────────────────────────────────────────
const canvas    = document.getElementById('game-canvas');
const hudEl     = document.getElementById('hud');
const tooltipEl = document.getElementById('tooltip');
const hintEl    = document.getElementById('hint');
const pwTxt     = document.getElementById('pwr-txt');
const pwFill    = document.getElementById('pwr-fill');

// ── SAB double buffer (worker writes, we read) ──────────
const sharedBuf = new SharedBufferManager();

if (typeof SharedArrayBuffer === 'undefined') {
  hudEl.innerHTML = '<b>ERROR</b><br>SharedArrayBuffer unavailable — this build needs COOP/COEP headers (npm run dev).';
  throw new Error('SharedArrayBuffer unavailable');
}

// ── Canvas / camera (camera works in CSS pixels) ────────
const camera = new Camera(window.innerWidth, window.innerHeight);
// Doubled baseline (Camera default is 4.0). The starter chain now spans ~13
// tiles (generator 0,0 -> real iron deposit -> smelter), so the initial frame
// pulls back slightly to fit the WHOLE factory on screen; sprites still render
// ~1.5x larger than the old 2.5 zoom. Scroll-wheel zooms in from there.
camera.zoom = 3.6;
camera.x = 6.5;  // center on the production chain, not the origin
camera.y = -2;

let gl = null;
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  camera.resize(window.innerWidth, window.innerHeight);
  if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
}

// ── WebGL + renderers ───────────────────────────────────
gl = initWebGL(canvas);
gl.viewport(0, 0, canvas.width, canvas.height);
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const spriteRenderer = new InstancedRenderer(gl);
const overlayRenderer = new OverlayRenderer(gl);
const ghostRenderer = new GhostRenderer(gl, spriteRenderer.program, spriteRenderer.atlas, spriteRenderer.atlasTexture);
const chunkMeshManager = new ChunkMeshManager(gl);

// Deterministic terrain mirror (identical seed/noise to the worker sim).
const terrainMirror = new ChunkMap();

// ── Input ───────────────────────────────────────────────
const keyboard = new Keyboard();
const mouse = new Mouse(canvas);
const cameraControls = new CameraControls(camera, keyboard, mouse);

// ── Worker ──────────────────────────────────────────────
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let workerReady = false;

// Patch a single deposit tile in the mirror to match the worker's sim truth.
// The worker sends TILE_UPDATE only on the tick an extraction actually happens,
// so the hover tooltip always shows live amounts — never pristine deposits.
function applyTileUpdate(x, y, amount) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const chunk = ensureChunk(terrainMirror, cx, cy);
  const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  chunk.resources[ly * CHUNK_SIZE + lx] = amount;
}

worker.onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'ready':
      workerReady = true;
      console.log('[Main] Worker ready — sim running off the main thread');
      break;
    case 'TILE_UPDATE':
      applyTileUpdate(msg.x, msg.y, msg.amount);
      break;
    case 'error':
      console.error('[Worker]', msg.error);
      break;
  }
};

worker.postMessage({ type: 'init', sharedBuffer: sharedBuf.getBuffer() });

// ═══════════════════════════════════════════════════════
//  TOOL STATE + EYEDROPPER
// ═══════════════════════════════════════════════════════

const TOOL_KINDS = { miner: MACH_MINER, smelter: MACH_SMELTER, assembler: MACH_ASSEMBLER, generator: MACH_GENERATOR, pole: MACH_POLE };
const KIND_TOOL  = { [MACH_MINER]: 'miner', [MACH_SMELTER]: 'smelter', [MACH_ASSEMBLER]: 'assembler', [MACH_GENERATOR]: 'generator', [MACH_POLE]: 'pole' };
const TOOL_SPRITE = { miner: SPR_MINER, smelter: SPR_SMELTER, assembler: SPR_ASSEMBLER, generator: SPR_GENERATOR, pole: SPR_POWER_POLE };

// Static machine facts for math-native tooltips (exact values come from SAB floats)
const MACH_FACTS = {
  [MACH_MINER]:     { name: 'Mining Drill',     cycle: 1, recipe: 'Extracts ground ore (1.0 s / item)' },
  [MACH_SMELTER]:   { name: 'Smelter',          cycle: 3, recipe: 'Ore → Ingot (3.0 s)' },
  [MACH_ASSEMBLER]: { name: 'Assembler',        cycle: 5, recipe: '2× Iron Ingot → Gear (5.0 s)' },
  [MACH_GENERATOR]: { name: 'Steam Generator',  cycle: 0, recipe: 'Burns nothing — generates power' },
  [MACH_POLE]:      { name: 'Power Pole',       cycle: 0, recipe: 'Routes power' },
};
const ITEM_NAMES = { [ITEM_IRON_ORE]: 'Iron Ore', [ITEM_COPPER_ORE]: 'Copper Ore', [ITEM_IRON_INGOT]: 'Iron Ingot', [ITEM_COPPER_INGOT]: 'Copper Ingot', [ITEM_GEAR]: 'Gear' };

let currentTool = 'select';
let beltStart = null; // {x,y} first click of a two-click belt placement

function setActiveTool(tool) {
  currentTool = tool;
  beltStart = null;
  toolbarBtns.forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  updateHint();
}

const toolbarBtns = document.querySelectorAll('.tool-btn');
toolbarBtns.forEach((btn) => {
  btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
});

function updateHint() {
  if (currentTool === 'belt') {
    hintEl.style.display = 'block';
    hintEl.textContent = beltStart ? 'Click end for belt' : 'Click start for belt';
  } else if (currentTool !== 'select' && currentTool !== 'eraser') {
    hintEl.style.display = 'block';
    hintEl.textContent = 'Click to place ' + currentTool + '  ·  middle-click any machine to copy it';
  } else if (currentTool === 'select') {
    hintEl.style.display = 'block';
    hintEl.textContent = 'Middle-click a machine or belt to copy it';
  } else {
    hintEl.style.display = 'none';
  }
}

/** Send a build/erase command to the worker (the only mutation path). */
function sendCommand(msg) {
  if (workerReady) worker.postMessage(msg);
}

function screenTile() {
  const [wx, wy] = camera.screenToWorld(mouse.x, mouse.y);
  return { tx: Math.floor(wx), ty: Math.floor(wy) };
}

// ── EYEDROPPER: middle-click a machine/belt, ghost it, place copies ──
function eyedropAt(tx, ty) {
  const f = sharedBuf.fView;
  const rows = Math.min(f[SB_HDR_MACHINES], 5000);
  for (let r = 0; r < rows; r++) {
    const o = OFF_MACH_TABLE + r * MACH_T_STRIDE;
    if (Math.floor(f[o + MACH_T_X]) === tx && Math.floor(f[o + MACH_T_Y]) === ty) {
      const kind = f[o + MACH_T_TYPE];
      const tool = KIND_TOOL[kind];
      if (tool) {
        setActiveTool(tool);
        console.log(`[Eyedropper] copied ${MACH_FACTS[kind].name} → ${tool}`);
        return true;
      }
    }
  }
  // No machine: grab a belt tile so the belt tool is armed for extensions
  const readOffset = sharedBuf.getReadOffset();
  const count = sharedBuf.getCount();
  for (let i = 0; i < count; i++) {
    const o = readOffset + i * 3;
    const si = f[o + 2];
    if ((si === 7 || si === 8) && Math.floor(f[o]) === tx && Math.floor(f[o + 1]) === ty) {
      setActiveTool('belt');
      console.log('[Eyedropper] grabbed belt');
      return true;
    }
  }
  return false;
}

canvas.addEventListener('mousedown', (e) => {
  // Use the event's own coordinates (robust to fast clicks / synthetic input)
  const [ewx, ewy] = camera.screenToWorld(e.clientX, e.clientY);
  const tx = Math.floor(ewx);
  const ty = Math.floor(ewy);

  // ── EYEDROPPER (middle click) ──
  if (e.button === 1) {
    eyedropAt(tx, ty);
    return;
  }
  if (e.button !== 0) return;
  if (!workerReady) return;

  if (currentTool === 'select') return;

  if (currentTool === 'eraser') {
    sendCommand({ type: 'erase', x: tx, y: ty });
    return;
  }

  if (currentTool === 'belt') {
    if (!beltStart) {
      beltStart = { x: tx, y: ty };
      updateHint();
      return;
    }
    const path = buildBeltPath(beltStart, { x: tx, y: ty });
    if (path.length > 0) sendCommand({ type: 'placeBelt', path });
    beltStart = null;
    updateHint();
    return;
  }

  const kind = TOOL_KINDS[currentTool];
  if (kind !== undefined) sendCommand({ type: 'place', kind, x: tx, y: ty });
});

/** L-shaped tile path between two clicks (demo path math). */
function buildBeltPath(a, b) {
  const path = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const st = dx > 0 ? 1 : -1;
    for (let x = a.x; x !== b.x + st; x += st) path.push({ x, y: a.y });
    if (dy !== 0) {
      const sy = dy > 0 ? 1 : -1;
      for (let y = a.y + sy; y !== b.y + sy; y += sy) path.push({ x: b.x, y });
    }
  } else {
    const st = dy > 0 ? 1 : -1;
    for (let y = a.y; y !== b.y + st; y += st) path.push({ x: a.x, y });
    if (dx !== 0) {
      const sx = dx > 0 ? 1 : -1;
      for (let x = a.x + sx; x !== b.x + sx; x += sx) path.push({ x, y: b.y });
    }
  }
  return path;
}

// ═══════════════════════════════════════════════════════
//  CURSOR GHOST (build preview under the mouse)
// ═══════════════════════════════════════════════════════
function updateGhost() {
  const { tx, ty } = screenTile();

  if (currentTool === 'belt') {
    if (!beltStart) {
      ghostRenderer.set([[tx + 0.5, ty + 0.5, SPR_BELT_H]]);
    } else {
      const path = buildBeltPath(beltStart, { x: tx, y: ty });
      const tiles = [];
      for (let i = 0; i < path.length - 1; i++) {
        const p = path[i];
        const n = path[i + 1];
        tiles.push([p.x + 0.5, p.y + 0.5, n.x !== p.x ? SPR_BELT_H : SPR_BELT_V]);
      }
      ghostRenderer.set(tiles);
    }
    return;
  }

  const sprite = TOOL_SPRITE[currentTool];
  if (sprite !== undefined) {
    ghostRenderer.set([[tx + 0.5, ty + 0.5, sprite]]);
    return;
  }
  ghostRenderer.clear();
}

// ═══════════════════════════════════════════════════════
//  OVERLAY STATE (Digit keys swap the WebGL draw state)
// ═══════════════════════════════════════════════════════
let overlayMode = 0; // 0 off, 1 power load, 2 belt throughput
const overlayLabels = ['', 'Power load [1]', 'Belt throughput [2]'];

// Belt-density smoothing across frames (per tile, persistent while overlay on)
const beltDensity = new Map();

function buildOverlay() {
  overlayRenderer.clear();
  if (overlayMode === 1) buildPowerOverlay();
  else if (overlayMode === 2) buildBeltOverlay();
}

function buildPowerOverlay() {
  const f = sharedBuf.fView;
  const ratio = f[SB_HDR_PWR_RATIO];
  const rows = Math.min(f[SB_HDR_MACHINES], 5000);
  for (let r = 0; r < rows; r++) {
    const o = OFF_MACH_TABLE + r * MACH_T_STRIDE;
    const x = f[o + MACH_T_X];
    const y = f[o + MACH_T_Y];
    const type = f[o + MACH_T_TYPE];
    const powered = f[o + MACH_T_POWERED];
    const draw = f[o + MACH_T_DRAW];
    const gen = f[o + MACH_T_GEN];

    if (type === MACH_GENERATOR) {
      overlayRenderer.add(x, y, 0, 1, 0, 0.62); // generators green
    } else if (type === MACH_POLE) {
      continue; // poles carry nothing
    } else if (!powered || ratio <= 0) {
      overlayRenderer.add(x, y, 0.85, 0.05, 0.05, 0.72); // offline / blackout
    } else if (ratio < 1) {
      overlayRenderer.add(x, y, 1, 0.55, 0, 0.65);       // brownout (proportional slowdown)
    } else {
      // Load heat: brightness scales with exact kW draw
      const t = Math.min(1, draw / 25);
      overlayRenderer.add(x, y, 0.1 + 0.9 * t, 0.9 * (1 - t), 0, 0.6);
    }
  }
}

function buildBeltOverlay() {
  const f = sharedBuf.fView;
  const readOffset = sharedBuf.getReadOffset();
  const count = sharedBuf.getCount();

  // Bucket item instances by tile; collect belt segment tiles
  const beltTiles = new Map(); // key tx*100000+ty -> index into density arrays
  const itemCounts = new Map();
  const keys = [];
  for (let i = 0; i < count; i++) {
    const o = readOffset + i * 3;
    const x = f[o];
    const y = f[o + 1];
    const si = f[o + 2];
    if (si === 7 || si === 8) { // belt segment (H/V)
      const key = Math.floor(x) * 100000 + Math.floor(y);
      if (!beltTiles.has(key)) {
        beltTiles.set(key, keys.length);
        keys.push(key);
      }
    } else if (si === 12 || si === 13 || si === 14 || si === 15 || si === 16 || si === 18) {
      const key = Math.floor(x) * 100000 + Math.floor(y);
      itemCounts.set(key, (itemCounts.get(key) || 0) + 1);
    }
  }

  // Smooth + draw one quad per belt tile
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const live = itemCounts.get(key) || 0;
    const prev = beltDensity.get(key) || 0;
    const d = prev * 0.55 + live * 0.45; // exponential smoothing (flow visible, flicker damped)
    beltDensity.set(key, d);
    const tx = Math.floor(key / 100000) + 0.5;
    const ty = (key - Math.floor(key / 100000) * 100000) + 0.5;

    // Color ramp: empty blue -> flowing teal/green -> jammed red
    let r, g, b;
    if (d < 0.5)      { r = 0.15; g = 0.35; b = 1; }    // belt idle
    else if (d < 1.5) { r = 0.1;  g = 0.9;  b = 0.3; }  // light flow
    else if (d < 2.5) { r = 1;    g = 0.75; b = 0.05; } // busy
    else              { r = 1;    g = 0.1;  b = 0.02; } // backed up
    overlayRenderer.add(tx, ty, r, g, b, 0.6);
  }
  // Drop density for tiles no longer on belts (belt got erased)
  for (const key of beltDensity.keys()) {
    if (!beltTiles.has(key)) beltDensity.delete(key);
  }
}

// ═══════════════════════════════════════════════════════
//  MATH-NATIVE DOM TOOLTIP (exact floats from the SAB)
// ═══════════════════════════════════════════════════════
const TERRAIN_NAMES = ['Grass', 'Water', 'Stone'];
const RES_NAMES = ['None', 'Iron', 'Copper'];

function hoverMachineRow(tx, ty) {
  const f = sharedBuf.fView;
  const rows = Math.min(f[SB_HDR_MACHINES], 5000);
  for (let r = 0; r < rows; r++) {
    const o = OFF_MACH_TABLE + r * MACH_T_STRIDE;
    if (Math.floor(f[o + MACH_T_X]) === tx && Math.floor(f[o + MACH_T_Y]) === ty) return o;
  }
  return -1;
}

function hoverBeltInfo(tx, ty) {
  const f = sharedBuf.fView;
  const readOffset = sharedBuf.getReadOffset();
  const count = sharedBuf.getCount();
  let isBelt = false;
  let items = 0;
  for (let i = 0; i < count; i++) {
    const o = readOffset + i * 3;
    const x = Math.floor(f[o]);
    const y = Math.floor(f[o + 1]);
    if (x !== tx || y !== ty) continue;
    const si = f[o + 2];
    if (si === 7 || si === 8) isBelt = true;
    else if (si === 12 || si === 13 || si === 14 || si === 15 || si === 16 || si === 18) items++;
  }
  return isBelt ? { items } : null;
}

function updateTooltip() {
  const { tx, ty } = screenTile();
  const row = hoverMachineRow(tx, ty);

  if (row >= 0) {
    const f = sharedBuf.fView;
    const type = f[row + MACH_T_TYPE];
    const fact = MACH_FACTS[type] || { name: 'Machine', recipe: '' };
    const powered = f[row + MACH_T_POWERED] === 1;
    const draw = f[row + MACH_T_DRAW];
    const gen = f[row + MACH_T_GEN];
    const inCount = f[row + MACH_T_IN_COUNT];
    const inReq = f[row + MACH_T_IN_REQ];
    const inType = f[row + MACH_T_IN_TYPE];
    const progress = f[row + MACH_T_PROGRESS];

    const lines = [`${fact.name} @ (${tx}, ${ty})`];
    if (type === MACH_MINER) {
      // Live deposit read: the mirror is patched by TILE_UPDATE the instant the
      // worker digs ore out, so this number ticks down while the drill works.
      const dep = tileInfo(terrainMirror, tx, ty);
      lines.push(dep.res > 0
        ? `Deposit left: ${RES_NAMES[dep.resType]} ${dep.res.toFixed(1)}`
        : 'Deposit depleted — move the drill');
    }
    if (type === MACH_GENERATOR) {
      lines.push(powered ? `Online — generates ${gen.toFixed(1)} kW` : 'Offline');
    } else if (type === MACH_POLE) {
      lines.push('Passive');
    } else {
      lines.push(powered
        ? `Powered — draws ${draw.toFixed(1)} kW`
        : `OFFLINE — no power (draws ${draw.toFixed(1)} kW when live)`);
      if (inReq > 0) {
        const it = ITEM_NAMES[inType] || '?';
        lines.push(`Input: ${inCount}/${inReq}${inCount > 0 ? ' · ' + it : ''}`);
      }
      if (fact.cycle > 0) {
        lines.push(`Recipe: ${fact.recipe}`);
        if (progress > 0) lines.push(`Progress: ${Math.min(100, (progress / fact.cycle) * 100).toFixed(0)}%`);
      }
    }
    tooltipEl.textContent = lines.join('\n');
  } else {
    const belt = hoverBeltInfo(tx, ty);
    const ti = tileInfo(terrainMirror, tx, ty);
    if (belt) {
      tooltipEl.textContent = `Conveyor belt @ (${tx}, ${ty})\nItems here: ${belt.items}`;
    } else {
      tooltipEl.textContent =
        `(${tx}, ${ty})\n${TERRAIN_NAMES[ti.tile]}\n${RES_NAMES[ti.resType]} ${ti.res > 0 ? ti.res.toFixed(1) : ''}`;
    }
  }
  tooltipEl.style.display = 'block';
  tooltipEl.style.left = (mouse.x + 16) + 'px';
  tooltipEl.style.top = (mouse.y + 16) + 'px';
}

// ═══════════════════════════════════════════════════════
//  TERRAIN MESHES + RENDER LOOP
// ═══════════════════════════════════════════════════════
function ensureVisibleChunkMeshes() {
  const scale = camera.scale;
  const halfW = (camera.width / 2) / scale;
  const halfH = (camera.height / 2) / scale;
  const x0 = Math.floor((camera.x - halfW) / CHUNK_SIZE);
  const x1 = Math.floor((camera.x + halfW) / CHUNK_SIZE);
  const y0 = Math.floor((camera.y - halfH) / CHUNK_SIZE);
  const y1 = Math.floor((camera.y + halfH) / CHUNK_SIZE);

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const key = `${cx},${cy}`;
      if (chunkMeshManager.meshes.has(key)) continue;
      if (!terrainMirror.get(cx, cy)) generateChunkTerrain(terrainMirror, cx, cy);
      chunkMeshManager.buildChunkMesh(cx, cy, terrainMirror.get(cx, cy));
    }
  }
}

let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;
let renderTimeMs = 0;
let lastNow = performance.now();

function renderLoop(now) {
  if (!workerReady) {
    requestAnimationFrame(renderLoop);
    return;
  }
  try {
    renderFrame(now);
  } catch (err) {
    console.error('[Render error]', err);
  }
  requestAnimationFrame(renderLoop);
}

function renderFrame(now) {
  const frameStart = performance.now();
  const dt = Math.min((now - lastNow) / 1000, 0.05);
  lastNow = now;

  // Overlay toggle via number keys — swaps WebGL draw state, no DOM
  if (keyboard.wasPressed('Digit1')) overlayMode = overlayMode === 1 ? 0 : 1;
  if (keyboard.wasPressed('Digit2')) overlayMode = overlayMode === 2 ? 0 : 2;
  if (keyboard.wasPressed('Digit0')) overlayMode = 0;

  cameraControls.update(dt);
  ensureVisibleChunkMeshes();

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const projection = camera.getProjection();

  chunkMeshManager.render(projection);

  // Worker snapshot (instances) -> sprites
  const readOffset = sharedBuf.getReadOffset();
  const instanceCount = sharedBuf.getCount();
  spriteRenderer.updateFromSharedBuffer(sharedBuf.view, readOffset, instanceCount);
  spriteRenderer.render(projection);

  // Heat-map overlay pass
  if (overlayMode !== 0) {
    buildOverlay();
    overlayRenderer.render(projection);
  }

  // Build-preview ghost on top
  updateGhost();
  ghostRenderer.render(projection, 0.55);

  renderTimeMs = performance.now() - frameStart;

  frameCount++;
  if (now - lastFpsTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFpsTime = now;
  }
  updateHUD(instanceCount);
  updateTooltip();

  keyboard.flush();
}

function updateHUD(instanceCount) {
  const f = sharedBuf.fView;
  const ratio    = f[SB_HDR_PWR_RATIO];
  const gen      = f[SB_HDR_GEN];
  const req      = f[SB_HDR_REQ];
  const machines = f[SB_HDR_MACHINES];
  const beltLines = f[SB_HDR_BELT_LINES];
  const beltItems = f[SB_HDR_BELT_ITEMS];
  const jammed   = f[SB_HDR_JAMMED];

  const [mxw, myw] = camera.screenToWorld(mouse.x, mouse.y);

  hudEl.innerHTML =
    `<b>Factory Sim — Worker Build</b><br>` +
    `FPS: ${fps}<br>` +
    `Machines: ${machines}<br>` +
    `Belt Lines: ${beltLines}<br>` +
    `Belt Items: ${beltItems.toLocaleString()}<br>` +
    `Jammed: ${jammed}<br>` +
    `Instances: ${instanceCount.toLocaleString()}<br>` +
    `Render: ${renderTimeMs.toFixed(1)}ms<br>` +
    `Zoom: ${camera.zoom.toFixed(2)}x<br>` +
    `Tool: ${currentTool}${beltStart ? ' \u2192' : ''}<br>` +
    `Tile: (${Math.floor(mxw)}, ${Math.floor(myw)})` +
    (overlayMode > 0 ? `<br>Overlay: ${overlayLabels[overlayMode]}` : '');

  const color = ratio > 0.5 ? '#0f0' : ratio > 0 ? '#ff0' : '#f00';
  pwTxt.textContent = `Power: ${(ratio * 100).toFixed(0)}% (${gen.toFixed(0)}/${req.toFixed(0)} kW)`;
  pwTxt.style.color = color;
  pwFill.style.width = (ratio * 100) + '%';
  pwFill.style.background = color;
}


console.log('[Main] Initializing Factory Sim (multi-threaded build + Phase 3 UI)...');
requestAnimationFrame(renderLoop);
