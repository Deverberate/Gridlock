/**
 * OverlayRenderer — GPU heat-map pass for factory data overlays.
 *
 * One translucent full-tile quad per highlighted tile, colored per-instance
 * on the GPU (no DOM, no per-pixel CPU work). The main thread computes the
 * colored tile list each frame from the SAB machine table / belt item
 * instances and swaps the draw state between:
 *   1 = Power load   2 = Belt throughput   0 = off
 */

import { TILE_SIZE } from '../constants.js';
import { createOverlayProgram } from './webgl-init.js';

const MAX_OVERLAY = 131_072; // one quad per highlighted tile
const STRIDE = 6;            // x, y, r, g, b, a

export class OverlayRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = createOverlayProgram(gl);

    // Quad geometry (a_quad corners only, 2 triangles)
    this.quadVerts = new Float32Array([
      -1, -1,  1, -1,  1,  1,
      -1, -1,  1,  1, -1,  1,
    ]);

    this.tileData = new Float32Array(MAX_OVERLAY * STRIDE);
    this.count = 0;

    this._initBuffers(gl);
    this._initUniforms(gl);
  }

  _initBuffers(gl) {
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.quadVerts, gl.STATIC_DRAW);

    const locQuad = gl.getAttribLocation(this.program, 'a_quad');
    gl.enableVertexAttribArray(locQuad);
    gl.vertexAttribPointer(locQuad, 2, gl.FLOAT, false, 8, 0);

    this.instanceVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.tileData.byteLength, gl.DYNAMIC_DRAW);

    const instStride = STRIDE * 4;
    const locPos = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, instStride, 0);
    gl.vertexAttribDivisor(locPos, 1);

    const locColor = gl.getAttribLocation(this.program, 'a_color');
    gl.enableVertexAttribArray(locColor);
    gl.vertexAttribPointer(locColor, 4, gl.FLOAT, false, instStride, 8);
    gl.vertexAttribDivisor(locColor, 1);

    gl.bindVertexArray(null);
  }

  _initUniforms(gl) {
    gl.useProgram(this.program);
    this.uProjection = gl.getUniformLocation(this.program, 'u_projection');
    this.uTileSize   = gl.getUniformLocation(this.program, 'u_tileSize');
    gl.useProgram(null);
  }

  /** Reset the overlay tile list. */
  clear() {
    this.count = 0;
  }

  /** Add a colored tile: (x, y) world tile center, rgba 0..1. */
  add(x, y, r, g, b, a) {
    if (this.count >= MAX_OVERLAY) return;
    const o = this.count * STRIDE;
    this.tileData[o + 0] = x;
    this.tileData[o + 1] = y;
    this.tileData[o + 2] = r;
    this.tileData[o + 3] = g;
    this.tileData[o + 4] = b;
    this.tileData[o + 5] = a;
    this.count++;
  }

  /** Upload and draw all overlay tiles. */
  render(projection) {
    const { gl, program } = this;
    if (this.count === 0) return;

    gl.useProgram(program);
    gl.uniformMatrix4fv(this.uProjection, false, projection);
    gl.uniform1f(this.uTileSize, TILE_SIZE);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.tileData.subarray(0, this.count * STRIDE));

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }
}
