import { TILE_SIZE } from '../constants.js';

/**
 * Orthographic camera with smooth pan and zoom.
 * Transforms world coordinates to clip space.
 */
export class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.x = 0;       // center in tile coords
    this.y = 0;
    this.zoom = 2.0;   // pixels per tile = TILE_SIZE * zoom
    this.width = canvasWidth;
    this.height = canvasHeight;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  /** Pan the camera by delta pixels. */
  pan(dx, dy) {
    const scale = TILE_SIZE * this.zoom;
    this.x -= dx / scale;
    this.y -= dy / scale;
  }

  /** Zoom toward a screen point. */
  zoomAt(screenX, screenY, factor) {
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.25, Math.min(8.0, this.zoom * factor));

    // Adjust position so the point under the cursor stays fixed
    const scale = TILE_SIZE * this.zoom;
    const oldScale = TILE_SIZE * oldZoom;
    const worldBeforeX = this.x + (screenX - this.width / 2) / oldScale;
    const worldBeforeY = this.y + (screenY - this.height / 2) / oldScale;
    const worldAfterX = this.x + (screenX - this.width / 2) / scale;
    const worldAfterY = this.y + (screenY - this.height / 2) / scale;
    this.x += worldBeforeX - worldAfterX;
    this.y += worldBeforeY - worldAfterY;
  }

  /** Get pixels-per-tile at current zoom. */
  get scale() {
    return TILE_SIZE * this.zoom;
  }

  /** Build a 4x4 orthographic projection matrix (column-major Float32Array). */
  getProjection() {
    const s = this.scale;
    const hw = this.width / 2;
    const hh = this.height / 2;

    // Orthographic: maps [left, right] → [-1, 1], [bottom, top] → [-1, 1]
    const left   = this.x * s - hw;
    const right  = this.x * s + hw;
    const bottom = this.y * s + hh;  // Y flipped
    const top    = this.y * s - hh;

    return new Float32Array([
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, -1, 0,
      -(right + left) / (right - left), -(top + bottom) / (top - bottom), 0, 1,
    ]);
  }

  /** Convert screen pixel to world tile coordinates. */
  screenToWorld(sx, sy) {
    const s = this.scale;
    return [
      this.x + (sx - this.width / 2) / s,
      this.y + (sy - this.height / 2) / s,
    ];
  }
}
