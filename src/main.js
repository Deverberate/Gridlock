/**
 * Main thread entry point.
 * Initializes WebGL, spawns the simulation worker, and runs the render loop.
 * Reads entity positions from SharedArrayBuffer (double-buffered) — zero copy.
 */

import { initWebGL } from './render/webgl-init.js';
import { InstancedRenderer } from './render/instanced-renderer.js';
import { ChunkMeshManager } from './render/chunk-mesh.js';
import { Camera } from './render/camera.js';
import { SharedBufferManager } from './shared-buffer.js';
import { Keyboard } from './input/keyboard.js';
import { Mouse } from './input/mouse.js';
import { CameraControls } from './input/camera-controls.js';
import { MAX_ENTITIES, SB_STRIDE } from './constants.js';

// ── DOM refs ────────────────────────────────────────────
const canvas    = document.getElementById('game-canvas');
const hudEl     = document.getElementById('hud');
const tooltipEl = document.getElementById('tooltip');

// ── Canvas sizing ───────────────────────────────────────
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
  camera.resize(canvas.width, canvas.height);
  gl.viewport(0, 0, canvas.width, canvas.height);
});

// ── SharedBuffer setup ──────────────────────────────────
const sharedBuf = new SharedBufferManager();
const TOTAL_SIZE_PER_HALF = 2 + (MAX_ENTITIES * SB_STRIDE);

// ── WebGL init ──────────────────────────────────────────
const gl = initWebGL(canvas);
gl.viewport(0, 0, canvas.width, canvas.height);

// ── Renderers ───────────────────────────────────────────
const spriteRenderer = new InstancedRenderer(gl);
const chunkMeshManager = new ChunkMeshManager(gl);

// ── Camera ──────────────────────────────────────────────
const camera = new Camera(canvas.width, canvas.height);

// ── Input ───────────────────────────────────────────────
const keyboard = new Keyboard();
const mouse = new Mouse(canvas);
const cameraControls = new CameraControls(camera, keyboard, mouse);

// ── Worker ──────────────────────────────────────────────
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let workerReady = false;
let lastEntityCount = 0;

worker.onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'ready':
      workerReady = true;
      console.log('[Main] Worker ready — starting render loop');
      requestAnimationFrame(renderLoop);
      break;
    case 'stats':
      lastEntityCount = msg.entityCount;
      break;
  }
};

// Send init message to worker with SharedArrayBuffer + layout info
worker.postMessage({
  type: 'init',
  sharedBuffer: sharedBuf.getBuffer(),
  sbLayout: {
    totalSizePerHalf: TOTAL_SIZE_PER_HALF,
    offB: 2 + TOTAL_SIZE_PER_HALF,
  },
});

// ── Toolbar ─────────────────────────────────────────────
let currentTool = 'select';
const toolbarBtns = document.querySelectorAll('.tool-btn');
toolbarBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    toolbarBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
  });
});

// ── Overlay mode (number keys) ──────────────────────────
let overlayMode = 0; // 0=none, 1=power, 2=pollution, 3=logistics, 4=production

// ── Stats tracking ──────────────────────────────────────
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;
let tickTimeMs = 0;
let renderTimeMs = 0;

// ── Render loop ─────────────────────────────────────────
function renderLoop(now) {
  if (!workerReady) return;

  const frameStart = performance.now();

  // ── Input ─────────────────────────────────────────────
  cameraControls.update(1 / 60);

  // Handle overlay toggle via number keys
  for (let i = 1; i <= 4; i++) {
    if (keyboard.wasPressed('Digit' + i)) {
      overlayMode = overlayMode === i ? 0 : i;
    }
  }
  if (keyboard.wasPressed('Digit0')) overlayMode = 0;

  // ── Read from SharedArrayBuffer (double-buffer safe) ──
  const readOffset = sharedBuf.getReadOffset();
  const entityCount = sharedBuf.getCount();

  // Update instanced renderer with latest entity data
  const readView = new Int32Array(sharedBuf.getBuffer());
  spriteRenderer.updateFromSharedBuffer(readView, readOffset, entityCount);

  // ── Render ────────────────────────────────────────────
  const renderStart = performance.now();

  gl.clear(gl.COLOR_BUFFER_BIT);

  const projection = camera.getProjection();

  // 1. Draw terrain chunks (only visible ones)
  const visibleChunks = getVisibleChunks();
  // TODO: build meshes for newly visible chunks
  chunkMeshManager.render(projection);

  // 2. Draw entities (instanced)
  spriteRenderer.render(projection);

  renderTimeMs = performance.now() - renderStart;

  // ── HUD update ────────────────────────────────────────
  frameCount++;
  if (now - lastFpsTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFpsTime = now;
  }

  hudEl.innerHTML =
    `<b>Factory Sim — Phase 1</b><br>` +
    `FPS: ${fps}<br>` +
    `Entities: ${entityCount.toLocaleString()}<br>` +
    `Render: ${renderTimeMs.toFixed(1)}ms<br>` +
    `Zoom: ${camera.zoom.toFixed(2)}x<br>` +
    `Camera: (${camera.x.toFixed(1)}, ${camera.y.toFixed(1)})<br>` +
    `Tool: ${currentTool}<br>` +
    (overlayMode > 0 ? `Overlay: ${['','Power','Pollution','Logistics','Production'][overlayMode]}<br>` : '');

  // ── Tooltip on hover ──────────────────────────────────
  updateTooltip(now);

  // ── Cleanup ───────────────────────────────────────────
  keyboard.flush();

  renderTimeMs = performance.now() - frameStart;
  requestAnimationFrame(renderLoop);
}

function updateTooltip(now) {
  // Convert mouse position to world coords
  const [wx, wy] = camera.screenToWorld(mouse.x, mouse.y);
  const tileX = Math.floor(wx);
  const tileY = Math.floor(wy);

  // Simple tooltip: show tile info
  if (mouse.x > 0 && mouse.y > 0) {
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = (mouse.x + 16) + 'px';
    tooltipEl.style.top = (mouse.y + 16) + 'px';
    tooltipEl.textContent = `Tile: (${tileX}, ${tileY})\nWorld: (${wx.toFixed(2)}, ${wy.toFixed(2)})`;
  } else {
    tooltipEl.style.display = 'none';
  }
}

function getVisibleChunks() {
  // Will be used for terrain mesh building
  return [];
}

// ── Log ─────────────────────────────────────────────────
console.log('[Main] Initializing Factory Sim...');
console.log('[Main] SharedArrayBuffer:', typeof SharedArrayBuffer !== 'undefined' ? 'OK' : 'UNAVAILABLE');
