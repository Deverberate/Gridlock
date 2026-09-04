/**
 * Chunk mesh builder.
 * Converts chunk tile data into vertex buffers for terrain rendering.
 * Meshes are cached and only rebuilt when the chunk is marked dirty.
 */

import { CHUNK_SIZE, TILE_SIZE, TERRAIN_GRASS, TERRAIN_WATER, TERRAIN_STONE } from '../constants.js';
import { createTerrainProgram } from './webgl-init.js';

export class ChunkMeshManager {
  constructor(gl) {
    this.gl = gl;
    this.program = createTerrainProgram(gl);
    this.meshes = new Map(); // key → { vao, vbo, vertexCount, dirty }

    // Uniforms
    gl.useProgram(this.program);
    this.uProjection = gl.getUniformLocation(this.program, 'u_projection');
    this.uTileSize   = gl.getUniformLocation(this.program, 'u_tileSize');
    gl.useProgram(null);
  }

  /**
   * Build or rebuild the mesh for a chunk at (cx, cy).
   * Returns vertex count for draw call.
   */
  buildChunkMesh(cx, cy, chunkData) {
    const key = `${cx},${cy}`;
    const gl = this.gl;

    // Build vertex data: 6 vertices per tile (2 triangles)
    // Per vertex: x, y (world tile pos), tileType
    const verts = new Float32Array(CHUNK_SIZE * CHUNK_SIZE * 6 * 3);
    let vi = 0;

    const worldOffsetX = cx * CHUNK_SIZE;
    const worldOffsetY = cy * CHUNK_SIZE;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tileType = chunkData.tiles[ly * CHUNK_SIZE + lx];
        const wx = worldOffsetX + lx;
        const wy = worldOffsetY + ly;

        // Two triangles per tile
        // Triangle 1
        verts[vi++] = wx;     verts[vi++] = wy;     verts[vi++] = tileType;
        verts[vi++] = wx + 1; verts[vi++] = wy;     verts[vi++] = tileType;
        verts[vi++] = wx + 1; verts[vi++] = wy + 1; verts[vi++] = tileType;
        // Triangle 2
        verts[vi++] = wx;     verts[vi++] = wy;     verts[vi++] = tileType;
        verts[vi++] = wx + 1; verts[vi++] = wy + 1; verts[vi++] = tileType;
        verts[vi++] = wx;     verts[vi++] = wy + 1; verts[vi++] = tileType;
      }
    }

    // Check if we already have a mesh for this key
    let mesh = this.meshes.get(key);
    if (!mesh) {
      const vao = gl.createVertexArray();
      const vbo = gl.createBuffer();
      mesh = { vao, vbo, vertexCount: 0, dirty: true };
      this.meshes.set(key, mesh);
    }

    gl.bindVertexArray(mesh.vao);

    if (!mesh._vboInit) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      // a_position: vec2
      const locPos = gl.getAttribLocation(this.program, 'a_position');
      gl.enableVertexAttribArray(locPos);
      gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 12, 0);
      // a_tileType: float
      const locType = gl.getAttribLocation(this.program, 'a_tileType');
      gl.enableVertexAttribArray(locType);
      gl.vertexAttribPointer(locType, 1, gl.FLOAT, false, 12, 8);
      mesh._vboInit = true;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
    mesh.vertexCount = vi / 3;
    mesh.dirty = false;

    gl.bindVertexArray(null);
    return mesh.vertexCount;
  }

  /**
   * Render all chunk meshes.
   */
  render(projection) {
    const { gl, program } = this;

    gl.useProgram(program);
    gl.uniformMatrix4fv(this.uProjection, false, projection);
    gl.uniform1f(this.uTileSize, TILE_SIZE);

    for (const [key, mesh] of this.meshes) {
      if (mesh.vertexCount === 0) continue;
      gl.bindVertexArray(mesh.vao);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
    }

    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  /**
   * Remove mesh for a chunk (when it goes out of existence).
   */
  removeMesh(cx, cy) {
    const key = `${cx},${cy}`;
    const mesh = this.meshes.get(key);
    if (mesh) {
      this.gl.deleteVertexArray(mesh.vao);
      this.gl.deleteBuffer(mesh.vbo);
      this.meshes.delete(key);
    }
  }
}
