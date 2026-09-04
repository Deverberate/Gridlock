// ── World ──────────────────────────────────────────────
export const CHUNK_SIZE       = 32;       // tiles per chunk axis
export const TILE_SIZE        = 16;       // pixels per tile at zoom=1

// ── Simulation ─────────────────────────────────────────
export const TICK_RATE        = 60;       // UPS in the worker
export const TICK_MS          = 1000 / TICK_RATE;
export const BELT_SPEED       = 2.0;      // tiles/sec (matches demo)
export const MINER_CYCLE      = 1.0;      // seconds per mined item
export const SMELT_TIME       = 3.0;      // seconds to smelt one ore
export const ASSEMBLE_TIME    = 5.0;      // seconds to craft one gear
export const ITEM_SPACING     = 0.8;      // min tiles between belt items
export const INSERT_GAP       = 0.6;      // belt start must be this clear

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

// ── Terrain ────────────────────────────────────────────
export const TERRAIN_GRASS    = 0;
export const TERRAIN_WATER    = 1;
export const TERRAIN_STONE    = 2;

// ── Resources / items (flat ids, NOT ECS entities) ─────
export const RES_NONE         = 0;
export const RES_IRON         = 1;
export const RES_COPPER       = 2;

export const ITEM_IRON_ORE    = 0;
export const ITEM_COPPER_ORE  = 1;
export const ITEM_IRON_INGOT  = 2;
export const ITEM_COPPER_INGOT= 3;
export const ITEM_GEAR        = 4;
export const ITEM_CIRCUIT     = 5;

// ── Machines ───────────────────────────────────────────
export const MACH_NONE        = 0;
export const MACH_MINER       = 1;
export const MACH_SMELTER     = 2;
export const MACH_ASSEMBLER   = 3;
export const MACH_GENERATOR   = 4;
export const MACH_POLE        = 5;

// ── Machine tuning (parity with demo) ──────────────────
export const POWER_MINER      = 5;    // kW draw
export const POWER_SMELTER    = 10;   // kW draw
export const POWER_ASSEMBLER  = 20;   // kW draw
export const POWER_GENERATOR  = 50;   // kW generation

// ── Sprite atlas indices (cells drawn in sprite-atlas.js) ─
export const SPR_GRASS        = 0;
export const SPR_WATER        = 1;
export const SPR_STONE        = 2;
export const SPR_MINER        = 3;
export const SPR_SMELTER      = 4;
export const SPR_ASSEMBLER    = 5;
export const SPR_GENERATOR    = 6;
export const SPR_BELT_H       = 7;
export const SPR_BELT_V       = 8;
export const SPR_POWER_POLE   = 11;
export const SPR_IRON_ORE     = 12;
export const SPR_COPPER_ORE   = 13;
export const SPR_GEAR         = 14;
export const SPR_IRON_INGOT   = 15;
export const SPR_COPPER_INGOT = 16;
export const SPR_MACH_OFF     = 17;
export const SPR_ITEM_DOT     = 18;
export const SPR_MINER_ON     = 19;
export const SPR_SMELTER_ON   = 20;
export const SPR_ASSEMBLER_ON = 21;
export const SPR_GENERATOR_ON = 22;

// Item type -> atlas sprite index (matches demo itemSpr table)
export const ITEM_SPRITES = [
  SPR_IRON_ORE, SPR_COPPER_ORE, SPR_IRON_INGOT, SPR_COPPER_INGOT, SPR_GEAR, SPR_ITEM_DOT,
];

// ── SharedBuffer layout (all in Int32 slots; data is Float32) ─
// Header:  flag, count, then 7 float stats
export const SB_HDR_FLAG       = 0;   // 0 = buffer A current, 1 = buffer B current
export const SB_HDR_COUNT      = 1;   // instances in the current half
export const SB_HDR_PWR_RATIO  = 2;   // float
export const SB_HDR_GEN        = 3;   // float
export const SB_HDR_REQ        = 4;   // float
export const SB_HDR_MACHINES   = 5;   // float (int)
export const SB_HDR_BELT_LINES = 6;   // float (int)
export const SB_HDR_BELT_ITEMS = 7;   // float (int)
export const SB_HDR_JAMMED     = 8;   // float (int)
export const SB_HEADER_SLOTS   = 9;

// Per-instance render data: x, y, spriteIdx (3 floats)
export const SB_STRIDE         = 3;
export const SB_POS_X          = 0;
export const SB_POS_Y          = 1;
export const SB_SPRITE_IDX     = 2;

// Max sprites packed per snapshot: machines + belt segments + belt items
export const SNAPSHOT_CAP      = 400_000;

// ── SAB machine metadata table (worker -> main, one row per machine) ─
// Fixed-size single region after the double-buffered instance halves.
// The main thread scans it for hover tooltips, the eyedropper, and overlays,
// reading the exact draw/gen/recipe floats straight from shared memory.
export const MACH_T_X         = 0;
export const MACH_T_Y         = 1;
export const MACH_T_TYPE      = 2;   // MACH_* type
export const MACH_T_POWERED   = 3;   // 1 = receiving power
export const MACH_T_DRAW      = 4;   // kW consumed (exact float)
export const MACH_T_GEN       = 5;   // kW generated (exact float)
export const MACH_T_IN_REQ    = 6;   // input buffer required
export const MACH_T_IN_COUNT  = 7;   // items currently buffered
export const MACH_T_IN_TYPE   = 8;   // ITEM_* of last accepted input
export const MACH_T_PROGRESS  = 9;   // seconds into the recipe
export const MACH_T_STRIDE    = 10;
export const MACH_TABLE_CAP   = MAX_ENTITIES;

// ── Full SAB layout (slots == Float32 indices on shared views) ─
export const INST_HALF_FLOATS = SNAPSHOT_CAP * SB_STRIDE;
export const OFF_INST_A       = SB_HEADER_SLOTS;
export const OFF_INST_B       = OFF_INST_A + INST_HALF_FLOATS;
export const OFF_MACH_TABLE   = OFF_INST_B + INST_HALF_FLOATS;
export const SAB_TOTAL_SLOTS  = OFF_MACH_TABLE + MACH_TABLE_CAP * MACH_T_STRIDE;
