/**
 * Initialize WebGL 2 context and base shader program.
 */
export function initWebGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
  });

  if (!gl) {
    throw new Error('WebGL 2 not supported');
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.05, 0.05, 0.08, 1.0);

  return gl;
}

/**
 * Compile and link the instanced sprite shader program.
 * 
 * Vertex shader receives:
 *   Per-vertex: a_quad (corner offset), a_uv (texture coords)
 *   Per-instance: a_position (world pos), a_spriteIdx, a_variant, a_zOrder
 * 
 * Uniforms: u_projection (orthographic), u_atlas (texture), u_atlasSize
 */
export function createSpriteProgram(gl) {
  const vs = `#version 300 es
    precision highp float;

    // Per-vertex
    in vec2 a_quad;
    in vec2 a_uv;

    // Per-instance
    in vec2 a_position;
    in float a_spriteIdx;
    in float a_variant;
    in float a_zOrder;

    uniform mat4 u_projection;
    uniform float u_tileSize;
    uniform float u_atlasCols;
    uniform float u_spriteSize;

    out vec2 v_uv;
    out float v_spriteIdx;

    void main() {
      // Calculate UV within the atlas
      float col = mod(a_spriteIdx, u_atlasCols);
      float row = floor(a_spriteIdx / u_atlasCols);
      vec2 atlasUV = vec2(col, row) * u_spriteSize + a_uv * u_spriteSize;
      v_uv = atlasUV;
      v_spriteIdx = a_spriteIdx;

      // World position + quad offset
      vec2 worldPos = a_position * u_tileSize + a_quad * u_tileSize * 0.5;
      gl_Position = u_projection * vec4(worldPos, 0.0, 1.0);
    }
  `;

  const fs = `#version 300 es
    precision highp float;

    in vec2 v_uv;
    in float v_spriteIdx;

    uniform sampler2D u_atlas;

    out vec4 fragColor;

    void main() {
      vec4 color = texture(u_atlas, v_uv);
      if (color.a < 0.01) discard;
      fragColor = color;
    }
  `;

  return compileProgram(gl, vs, fs);
}

/**
 * Create the terrain shader program for chunk rendering.
 */
export function createTerrainProgram(gl) {
  const vs = `#version 300 es
    precision highp float;

    in vec2 a_position;  // tile position
    in float a_tileType; // tile type for color lookup

    uniform mat4 u_projection;
    uniform float u_tileSize;

    out float v_tileType;
    out vec2 v_localUV;

    void main() {
      v_tileType = a_tileType;
      v_localUV = fract(a_position);

      vec2 worldPos = floor(a_position) * u_tileSize + fract(a_position) * u_tileSize;
      gl_Position = u_projection * vec4(worldPos, 0.0, 1.0);
    }
  `;

  const fs = `#version 300 es
    precision highp float;

    in float v_tileType;
    in vec2 v_localUV;

    out vec4 fragColor;

    void main() {
      // Simple color per tile type
      vec3 grass = vec3(0.18, 0.35, 0.12);
      vec3 water = vec3(0.1, 0.2, 0.55);
      vec3 stone = vec3(0.4, 0.38, 0.35);

      vec3 color;
      if (v_tileType < 0.5) {
        color = grass;
      } else if (v_tileType < 1.5) {
        color = water;
      } else {
        color = stone;
      }

      // Grid lines
      vec2 grid = smoothstep(0.02, 0.04, v_localUV) * (1.0 - smoothstep(0.96, 0.98, v_localUV));
      float gridFactor = grid.x * grid.y;
      color *= 0.85 + 0.15 * gridFactor;

      fragColor = vec4(color, 1.0);
    }
  `;

  return compileProgram(gl, vs, fs);
}

function compileProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Shader link failed: ' + log);
  }

  return program;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compile failed: ' + log);
  }

  return shader;
}
