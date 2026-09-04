import { MAX_ENTITIES } from '../constants.js';

/**
 * Struct-of-Arrays component storage.
 * Each component type lives in its own pre-allocated typed array.
 * Access pattern: arrays[componentName][entityId]
 */
export class ComponentArrays {
  constructor(max = MAX_ENTITIES) {
    this.max = max;

    // Position: x, y (tile coords, entity center at tile+.5)
    this.positionX   = new Float32Array(max);
    this.positionY   = new Float32Array(max);

    // Chunk reference: chunk_id (for rendering lookup only)
    this.chunkRef    = new Uint32Array(max);

    // Sprite: atlas_index, variant, z_order
    this.spriteIdx   = new Uint16Array(max);
    this.spriteVar   = new Uint16Array(max);
    this.spriteZ     = new Uint16Array(max);

    // Velocity: vx, vy (tiles/sec)
    this.velocityX   = new Float32Array(max);
    this.velocityY   = new Float32Array(max);

    // ── Machine state (Phase 2 parity) ───────────────────
    // machineType: MACH_NONE|MACH_MINER|MACH_SMELTER|MACH_ASSEMBLER|MACH_GENERATOR|MACH_POLE
    this.machineType       = new Uint8Array(max);
    // Process timer in SECONDS since recipe start (progress in demo terms)
    this.machineProgress   = new Float32Array(max);
    // Power draw (kW) for consumers / generation (kW) for generators
    this.machinePowerDraw  = new Float32Array(max);
    this.machinePowerGen   = new Float32Array(max);
    // 1 = receiving power this tick (set by PowerGridSystem), 0 = offline
    this.machinePowered    = new Uint8Array(max);
    // Input buffering: last accepted item type, count held, count required
    this.machineInputType  = new Uint8Array(max);
    this.machineInputCount = new Uint8Array(max);
    this.machineInputReq   = new Uint8Array(max);

    // ── Phase-1 scaffolding (unused by Phase 2 logic) ────
    this.machineRecipe = new Uint16Array(max);
    this.machineStatus = new Uint8Array(max);

    // BeltRef: belt_line_id, distance_along_line
    this.beltLineId  = new Uint32Array(max);
    this.beltDist    = new Float32Array(max);

    // Item: resource_type, amount
    this.itemType    = new Uint16Array(max);
    this.itemAmount  = new Float32Array(max);

    // PowerNode: generation_kw, consumption_kw, grid_id
    this.powerGen    = new Float32Array(max);
    this.powerUse    = new Float32Array(max);
    this.powerGrid   = new Uint32Array(max);

    // Miner: mining_rate (items/sec), resource_type, resource_remaining
    this.minerRate     = new Float32Array(max);
    this.minerResType  = new Uint16Array(max);
    this.minerResLeft  = new Float32Array(max);

    // Health: current, max
    this.healthCur   = new Float32Array(max);
    this.healthMax   = new Float32Array(max);
  }

  /** Copy an entity's renderable data into a target Float32Array at the given offset. */
  packRenderData(id, target, offset) {
    target[offset + 0] = this.positionX[id];
    target[offset + 1] = this.positionY[id];
    target[offset + 2] = this.spriteIdx[id];
  }
}
