/**
 * VOXGEN Core Types
 * WebGPU-based infinite voxel world generator with diffusion model cascades
 */

export type ModelType = 'sd15' | 'sdxl' | 'flux' | 'cascade';

export interface ModelConfig {
  size: number;
  speed?: 'fast' | 'medium' | 'slow';
  quality?: 'low' | 'medium' | 'high';
  vram: string;
  photorealistic?: boolean;
}

export const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  sd15: { size: 512, speed: 'fast', vram: '4gb' },
  sdxl: { size: 1024, quality: 'high', vram: '8gb' },
  flux: { size: 1024, photorealistic: true, vram: '12gb' },
  cascade: { size: 1024, quality: 'high', vram: '10gb' },
};

export interface LoRA {
  name: string;
  weight: number;
  path?: string;
}

export interface GenerationParams {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  denoise?: number;
  model?: ModelType;
  loras?: LoRA[];
  width?: number;
  height?: number;
}

export interface LatentTensor {
  data: Float32Array;
  shape: [number, number, number, number]; // [batch, channels, height, width]
}

export interface DecodedOutput {
  latent: LatentTensor;
  noise: Float32Array;
  prediction: Float32Array;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec4 extends Vec3 {
  t: number; // temporal dimension
}

export interface RayHit {
  position: Vec3;
  normal: Vec3;
  textureId: string;
  distance: number;
  voxelIndex: number;
}

export interface VoxelFace {
  textureId: string;
  ao: number; // ambient occlusion
  normal: Vec3;
}

export interface Voxel {
  faces: VoxelFace[];
  solid: boolean;
  materialId?: string;
}

export interface MeshGeometry {
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export interface BlockData {
  position: Vec4;
  hash: string;
  voxels: (Voxel | null)[];
  textures: Map<string, ImageBitmap | GPUTexture>;
  lod: number;
}

export interface CascadeLevel {
  model: ModelType;
  strength: number;
  steps: number;
}

export const CASCADE_PIPELINE: CascadeLevel[] = [
  { model: 'sd15', strength: 1.0, steps: 15 },
  { model: 'sdxl', strength: 0.7, steps: 20 },
  { model: 'flux', strength: 0.3, steps: 10 },
];

export interface GenerationTask {
  id: string;
  prompt: string;
  position: Vec3;
  cascade: ModelType[];
  priority: number;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  result?: ImageBitmap;
}

export interface WorldConfig {
  chunkSize: number;
  voxelSize: number;
  renderDistance: number;
  maxLod: number;
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  chunkSize: 8,
  voxelSize: 1.0,
  renderDistance: 256,
  maxLod: 5,
};
