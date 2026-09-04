/**
 * Initialize WebGL 2 context and base shader program.
 */
export function initWebGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true, // lets preview/readPixels capture frames
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
 * Per-instance stride is 3 floats (SB_STRIDE): x, y, spriteIdx.
 *   Per-vertex:  a_quad (corner offset), a_uv (texture coords)
 *   Per-instance: a_position (world pos), a_spriteIdx
 *
 * Uniforms: u_projection (orthographic), u_tileSize, u_atlas (texture),
 *           u_atlasCols, u_spriteSize (1 / atlas cell rows)
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

    uniform mat4 u_projection;
    uniform float u_tileSize;
    uniform float u_atlasCols;
    uniform float u_spriteSize;

    out vec2 v_uv;

    void main() {
      // Calculate UV within the atlas grid (square cell grid)
      float col = mod(a_spriteIdx, u_atlasCols);
      float row = floor(a_spriteIdx / u_atlasCols);
      v_uv = vec2(col, row) * u_spriteSize + a_uv * u_spriteSize;

      // World position (tile center) + quad corner offset
      vec2 worldPos = a_position * u_tileSize + a_quad * u_tileSize * 0.5;
      gl_Position = u_projection * vec4(worldPos, 0.0, 1.0);
    }
  `;

  const fs = `#version 300 es
    precision highp float;

    in vec2 v_uv;

    uniform sampler2D u_atlas;
    uniform float u_alphaMul;

    out vec4 fragColor;

    void main() {
      vec4 color = texture(u_atlas, v_uv);
      if (color.a < 0.01) discard;
      fragColor = vec4(color.rgb, color.a * u_alphaMul);
    }
  `;

  return compileProgram(gl, vs, fs);
}

/**
 * Overlay heat-map program: full-tile translucent quads, one instance per
 * highlighted tile, colored entirely on the GPU from per-instance attributes.
 * Used for the Power-load and Belt-throughput overlays toggled by the number
 * keys — no DOM involved.
 *
 *   Per-vertex:  a_quad (corner offset, -1..1)
 *   Per-instance: a_position (world pos), a_color (rgba)
 */
export function createOverlayProgram(gl) {
  const vs = `#version 300 es
    precision highp float;

    in vec2 a_quad;
    in vec2 a_position;
    in vec4 a_color;

    uniform mat4 u_projection;
    uniform float u_tileSize;

    out vec4 v_color;

    void main() {
      v_color = a_color;
      vec2 worldPos = a_position * u_tileSize + a_quad * u_tileSize * 0.5;
      gl_Position = u_projection * vec4(worldPos, 0.0, 1.0);
    }
  `;

  const fs = `#version 300 es
    precision highp float;

    in vec4 v_color;

    out vec4 fragColor;

    void main() {
      fragColor = v_color;
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
