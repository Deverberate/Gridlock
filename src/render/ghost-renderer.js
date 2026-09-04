/**
 * GhostRenderer — translucent build preview sprites that follow the cursor.
 *
 * Shares the sprite program + atlas texture with the main InstancedRenderer
 * (no second atlas, no second shader) but owns a tiny VAO/VBO. Rendered with
 * u_alphaMul < 1 so the player sees exactly what will be placed, including
 * full L-shaped belt path previews.
 */

import { TILE_SIZE, SB_STRIDE } from '../constants.js';

const MAX_GHOSTS = 4096;

export class GhostRenderer {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {WebGLProgram} spriteProgram shared instanced-sprite program
   * @param {object} atlas { atlasCols, atlasRows } metadata
   * @param {WebGLTexture} atlasTexture shared atlas
   */
  constructor(gl, spriteProgram, atlas, atlasTexture) {
    this.gl = gl;
    this.program = spriteProgram;
    this.atlas = atlas;
    this.atlasTexture = atlasTexture;

    this.quadVerts = new Float32Array([
      -1, -1,  0, 1,
       1, -1,  1, 1,
       1,  1,  1, 0,
      -1, -1,  0, 1,
       1,  1,  1, 0,
      -1,  1,  0, 0,
    ]);
    this.ghostData = new Float32Array(MAX_GHOSTS * SB_STRIDE);
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
    gl.vertexAttribPointer(locQuad, 2, gl.FLOAT, false, 16, 0);
    const locUV = gl.getAttribLocation(this.program, 'a_uv');
    gl.enableVertexAttribArray(locUV);
    gl.vertexAttribPointer(locUV, 2, gl.FLOAT, false, 16, 8);

    this.instanceVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.ghostData.byteLength, gl.DYNAMIC_DRAW);

    const stride = SB_STRIDE * 4;
    const locPos = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(locPos, 1);
    const locIdx = gl.getAttribLocation(this.program, 'a_spriteIdx');
    gl.enableVertexAttribArray(locIdx);
    gl.vertexAttribPointer(locIdx, 1, gl.FLOAT, false, stride, 8);
    gl.vertexAttribDivisor(locIdx, 1);

    gl.bindVertexArray(null);
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

  /** Hide all ghosts. */
  clear() {
    this.count = 0;
  }

  /**
   * Set ghost sprites: array of [x, y, spriteIdx] tile-center positions.
   * @param {number[][]} items
   */
  set(items) {
    this.count = 0;
    if (!items || items.length === 0) return;
    const n = Math.min(items.length, MAX_GHOSTS);
    for (let i = 0; i < n; i++) {
      const o = i * SB_STRIDE;
      this.ghostData[o]     = items[i][0];
      this.ghostData[o + 1] = items[i][1];
      this.ghostData[o + 2] = items[i][2];
    }
    this.count = n;
  }

  /** Draw ghosts translucent (alpha < 1), on top of the world. */
  render(projection, alpha = 0.55) {
    const { gl, program } = this;
    if (this.count === 0) return;

    gl.useProgram(program);
    gl.uniformMatrix4fv(this.uProjection, false, projection);
    gl.uniform1f(this.uTileSize, TILE_SIZE);
    gl.uniform1f(this.uAtlasCols, this.atlas.atlasCols);
    gl.uniform1f(this.uSpriteSize, 1.0 / this.atlas.atlasRows);
    gl.uniform1f(this.uAlphaMul, alpha);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.uniform1i(this.uAtlas, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.ghostData.subarray(0, this.count * SB_STRIDE));

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }
}
