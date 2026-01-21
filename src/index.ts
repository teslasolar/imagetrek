/**
 * VOXGEN - WebGPU Voxel World Generator
 *
 * Browser-native infinite world generation with diffusion model cascades
 * No server required - runs entirely in the browser with WebGPU
 *
 * @module voxgen
 */

// Import for internal use
import { World as WorldClass } from './core/World';
import { Renderer as RendererClass } from './render/Renderer';
import { DiffusionPipeline as DiffusionPipelineClass } from './models/DiffusionPipeline';

// Core classes
export { Gen } from './core/Gen';
export { Block } from './core/Block';
export { World } from './core/World';

// Types
export type {
  ModelType,
  ModelConfig,
  LoRA,
  GenerationParams,
  LatentTensor,
  DecodedOutput,
  Vec3,
  Vec4,
  RayHit,
  VoxelFace,
  Voxel,
  MeshGeometry,
  BlockData,
  CascadeLevel,
  GenerationTask,
  WorldConfig,
} from './core/types';

export {
  MODEL_CONFIGS,
  CASCADE_PIPELINE,
  DEFAULT_WORLD_CONFIG,
} from './core/types';

// Rendering
export { Renderer } from './render/Renderer';
export { rayMarchShader, meshShader, compositeShader } from './render/shaders';

// Models
export { DiffusionPipeline } from './models/DiffusionPipeline';

// Utilities
export { GreedyMesher, LODManager } from './utils/GreedyMesher';
export { IPFSStorage, CollabSync } from './utils/IPFSStorage';

// API Providers
export * from './api';

/**
 * Quick start helper - creates a fully initialized VOXGEN world
 *
 * @example
 * ```typescript
 * import { createWorld } from 'voxgen';
 *
 * const { world, renderer, pipeline } = await createWorld(canvas);
 * world.generate('crystal cave', { x: 0, y: 0, z: 0 });
 * renderer.start();
 * ```
 */
export async function createWorld(canvas: HTMLCanvasElement): Promise<{
  world: WorldClass;
  renderer: RendererClass;
  pipeline: DiffusionPipelineClass;
}> {
  const world = new WorldClass();
  await world.init();

  const renderer = new RendererClass(canvas, world);
  await renderer.init();

  const pipeline = new DiffusionPipelineClass();
  const device = world.getDevice();
  if (device) {
    await pipeline.init(device);
  }

  return { world, renderer, pipeline };
}

/**
 * Version information
 */
export const VERSION = '0.1.0';
export const WEBGPU_REQUIRED = true;

/**
 * Check if WebGPU is available
 */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}
