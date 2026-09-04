/**
 * Instanced sprite renderer.
 * Batches thousands of identical sprites into single draw calls via WebGL 2 instanced arrays.
 *
 * Reads entity positions from the SharedArrayBuffer (double-buffered).
 * Instance stride = SB_STRIDE floats: x, y, spriteIdx.
 */

import { TILE_SIZE, SB_STRIDE, SNAPSHOT_CAP } from '../constants.js';
import { createSpriteProgram } from './webgl-init.js';
import { generateSpriteAtlas } from './sprite-atlas.js';

export class InstancedRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = createSpriteProgram(gl);
    this.atlas = null;
    this.atlasTexture = null;

    // Quad geometry (4 vertices, 2 triangles)
    this.quadVerts = new Float32Array([
      // a_quad (corner offset), a_uv (texture coord)
      -1, -1,  0, 1,
       1, -1,  1, 1,
       1,  1,  1, 0,
      -1, -1,  0, 1,
       1,  1,  1, 0,
      -1,  1,  0, 0,
    ]);

    // Per-instance data buffer (x, y, spriteIdx) * capacity
    this.instanceData = new Float32Array(SNAPSHOT_CAP * SB_STRIDE);
    this.instanceCount = 0;

    this._initBuffers(gl);
    this._initAtlas(gl);
    this._initUniforms(gl);
  }

  _initBuffers(gl) {
    // ── Per-vertex buffer (quad corners + UVs) ──
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.quadVerts, gl.STATIC_DRAW);

    // a_quad: vec2
    const locQuad = gl.getAttribLocation(this.program, 'a_quad');
    gl.enableVertexAttribArray(locQuad);
    gl.vertexAttribPointer(locQuad, 2, gl.FLOAT, false, 16, 0);

    // a_uv: vec2
    const locUV = gl.getAttribLocation(this.program, 'a_uv');
    gl.enableVertexAttribArray(locUV);
    gl.vertexAttribPointer(locUV, 2, gl.FLOAT, false, 16, 8);

    // ── Per-instance buffer ──
    this.instanceVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);

    const stride = SB_STRIDE * 4; // bytes

    // a_position: vec2
    const locPos = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(locPos, 1);

    // a_spriteIdx: float
    const locIdx = gl.getAttribLocation(this.program, 'a_spriteIdx');
    gl.enableVertexAttribArray(locIdx);
    gl.vertexAttribPointer(locIdx, 1, gl.FLOAT, false, stride, 8);
    gl.vertexAttribDivisor(locIdx, 1);

    gl.bindVertexArray(null);
  }

  _initAtlas(gl) {
    const atlasData = generateSpriteAtlas();
    this.atlas = atlasData;

    this.atlasTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasData.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  _initUniforms(gl) {
    gl.useProgram(this.program);
    this.uProjection = gl.getUniformLocation(this.program, 'u_projection');
    this.uTileSize   = gl.getUniformLocation(this.program, 'u_tileSize');
    this.uAtlasCols  = gl.getUniformLocation(this.program, 'u_atlasCols');
    this.uSpriteSize = gl.getUniformLocation(this.program, 'u_spriteSize');
    this.uAtlas      = gl.getUniformLocation(this.program, 'u_atlas');
    this.uAlphaMul   = gl.getUniformLocation(this.program, 'u_alphaMul');
    gl.useProgram(null);
  }

  /**
   * Update instance data from the SharedArrayBuffer read half.
   * @param {Int32Array} sharedView - Int32 view over the whole SAB
   * @param {number} readOffset - Start slot of the read half (Int32 units)
   * @param {number} count - Number of instances in that half
   */
  updateFromSharedBuffer(sharedView, readOffset, count) {
    const capped = Math.min(count, SNAPSHOT_CAP);
    this.instanceCount = capped;
    if (capped === 0) return;

    const srcByteOffset = readOffset * 4; // Int32 slot -> byte
    const fSrc = new Float32Array(sharedView.buffer, srcByteOffset, capped * SB_STRIDE);
    this.instanceData.set(fSrc);
  }

  /**
   * Render all instances.
   * @param {Float32Array} projection - orthographic projection matrix
   */
  render(projection) {
    const { gl, program } = this;
    if (this.instanceCount === 0) return;

    gl.useProgram(program);

    // Set uniforms
    gl.uniformMatrix4fv(this.uProjection, false, projection);
    gl.uniform1f(this.uTileSize, TILE_SIZE);
    gl.uniform1f(this.uAtlasCols, this.atlas.atlasCols);
    gl.uniform1f(this.uSpriteSize, 1.0 / this.atlas.atlasRows);
    gl.uniform1f(this.uAlphaMul, 1.0); // opaque main pass

    // Bind atlas texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.uniform1i(this.uAtlas, 0);

    // Upload instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData.subarray(0, this.instanceCount * SB_STRIDE));

    // Draw
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instanceCount);
    gl.bindVertexArray(null);

    gl.useProgram(null);
  }
}
