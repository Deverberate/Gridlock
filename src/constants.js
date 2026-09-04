// ── World ──────────────────────────────────────────────
export const CHUNK_SIZE       = 32;       // tiles per chunk axis
export const TILE_SIZE        = 16;       // pixels per tile at zoom=1

// ── Simulation ─────────────────────────────────────────
export const TICK_RATE        = 60;       // UPS in the worker
export const TICK_MS          = 1000 / TICK_RATE;

// ── ECS Limits ─────────────────────────────────────────
export const MAX_ENTITIES     = 100_000;
export const MAX_COMPONENTS   = 64;       // bitset width

// ── Rendering ──────────────────────────────────────────
export const LAYER_GROUND     = 0;
export const LAYER_MACHINE    = 10;
export const LAYER_BELT_ITEM  = 20;
export const LAYER_EFFECT     = 30;
export const LAYER_OVERLAY    = 40;

// ── Component IDs (bitmask positions) ──────────────────
export const COMP_POSITION    = 1n << 0n;
export const COMP_CHUNK_REF   = 1n << 1n;
export const COMP_SPRITE      = 1n << 2n;
export const COMP_VELOCITY    = 1n << 3n;
export const COMP_MACHINE     = 1n << 4n;
export const COMP_BELT_REF    = 1n << 5n;
export const COMP_ITEM        = 1n << 6n;
export const COMP_POWER_NODE  = 1n << 7n;
export const COMP_MINER       = 1n << 8n;
export const COMP_HEALTH      = 1n << 9n;

// ── Belt ───────────────────────────────────────────────
export const BELT_SPEED       = 4.0;      // tiles/sec
export const BELT_ITEM_SIZE   = 0.5;      // visual size of an item on belt

// ── Power ──────────────────────────────────────────────
export const POWER_POLE_RANGE = 8;        // tiles
export const GRID_NONE        = 0;

// ── Terrain ────────────────────────────────────────────
export const TERRAIN_GRASS    = 0;
export const TERRAIN_WATER    = 1;
export const TERRAIN_STONE    = 2;

// ── Resources ──────────────────────────────────────────
export const RES_IRON_ORE     = 0;
export const RES_COPPER_ORE   = 1;
export const RES_COAL         = 2;
export const RES_STONE        = 3;
export const RES_IRON_INGOT   = 10;
export const RES_COPPER_INGOT = 11;
export const RES_GEAR         = 20;

// ── Machines ───────────────────────────────────────────
export const MINE_TYPE_MINER      = 0;
export const MINE_TYPE_SMELTER    = 1;
export const MINE_TYPE_ASSEMBLER  = 2;
export const MINE_TYPE_GENERATOR  = 3;

// ── SharedBuffer layout (per-entity stride in Float32s) ─
// Position (x,y) + Sprite (atlas_idx, variant, z_order, pad)
export const SB_STRIDE        = 6;
export const SB_POS_X         = 0;
export const SB_POS_Y         = 1;
export const SB_SPRITE_IDX    = 2;
export const SB_SPRITE_VAR    = 3;
export const SB_SPRITE_Z      = 4;
export const SB_PAD           = 5;
