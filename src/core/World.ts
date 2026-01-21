/**
 * World - Main World Manager Class
 * root=B(0,0,0,0), octree{}, models{sd15,sdxl,flux}, queue[], workers
 * Handles initialization, generation, cascade, rendering, evolution
 */

import { Block } from './Block';
import { Gen } from './Gen';
import {
  Vec3,
  ModelType,
  GenerationTask,
  WorldConfig,
  DEFAULT_WORLD_CONFIG,
  CASCADE_PIPELINE,
  LatentTensor,
} from './types';

interface ModelInstance {
  name: ModelType;
  loaded: boolean;
  vram: number;
}

export class World {
  readonly root: Block;
  readonly config: WorldConfig;

  private octree: Map<string, Block>;
  private models: Map<ModelType, ModelInstance>;
  private queue: GenerationTask[];
  private workers: number;
  private device: GPUDevice | null;
  private adapter: GPUAdapter | null;
  private processing: boolean;
  private eventListeners: Map<string, Set<(data: unknown) => void>>;

  constructor(config: Partial<WorldConfig> = {}) {
    this.config = { ...DEFAULT_WORLD_CONFIG, ...config };
    this.root = new Block(0, 0, 0, 0);
    this.octree = new Map();
    this.octree.set(this.root.hash, this.root);

    this.models = new Map();
    this.queue = [];
    this.workers = typeof navigator !== 'undefined'
      ? navigator.hardwareConcurrency || 4
      : 4;
    this.device = null;
    this.adapter = null;
    this.processing = false;
    this.eventListeners = new Map();
  }

  /**
   * Initialize WebGPU and load models
   */
  async init(): Promise<boolean> {
    if (!navigator.gpu) {
      console.error('WebGPU not supported');
      return false;
    }

    try {
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!this.adapter) {
        console.error('No GPU adapter found');
        return false;
      }

      this.device = await this.adapter.requestDevice();

      await this.loadModels();
      this.emit('init', { success: true });
      return true;
    } catch (error) {
      console.error('WebGPU initialization failed:', error);
      return false;
    }
  }

  /**
   * Load diffusion model configurations
   */
  private async loadModels(): Promise<void> {
    const modelConfigs: [ModelType, number][] = [
      ['sd15', 4],
      ['sdxl', 8],
      ['flux', 12],
    ];

    for (const [name, vram] of modelConfigs) {
      this.models.set(name, {
        name,
        loaded: false,
        vram,
      });
    }

    // Models are loaded on-demand during generation
    this.emit('modelsReady', { models: Array.from(this.models.keys()) });
  }

  /**
   * Get block at world coordinates
   */
  get(x: number, y: number, z: number): Block | null {
    const blockX = Math.floor(x / this.config.chunkSize);
    const blockY = Math.floor(y / this.config.chunkSize);
    const blockZ = Math.floor(z / this.config.chunkSize);

    const hash = Block.computeHash(blockX, blockY, blockZ, 0);
    return this.octree.get(hash) || null;
  }

  /**
   * Set/create block at world coordinates
   */
  set(x: number, y: number, z: number, block?: Block): Block {
    const blockX = Math.floor(x / this.config.chunkSize);
    const blockY = Math.floor(y / this.config.chunkSize);
    const blockZ = Math.floor(z / this.config.chunkSize);

    const newBlock = block || new Block(blockX, blockY, blockZ, 0);
    this.octree.set(newBlock.hash, newBlock);
    return newBlock;
  }

  /**
   * Queue a generation task
   */
  generate(
    prompt: string,
    position: Vec3,
    cascade: ModelType[] = ['sd15', 'sdxl']
  ): string {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const task: GenerationTask = {
      id: taskId,
      prompt,
      position,
      cascade,
      priority: 0,
      status: 'pending',
    };

    this.queue.push(task);
    this.processQueue();

    return taskId;
  }

  /**
   * Process generation queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      task.status = 'processing';
      this.emit('taskStart', { taskId: task.id });

      try {
        const result = await this.executeCascade(task.prompt, task.cascade);
        task.result = result;
        task.status = 'complete';

        // Place result in world
        const block = this.set(task.position.x, task.position.y, task.position.z);
        const gen = new Gen({ prompt: task.prompt });
        gen.setImage(result);

        const localX = task.position.x % this.config.chunkSize;
        const localY = task.position.y % this.config.chunkSize;
        const localZ = task.position.z % this.config.chunkSize;
        block.place(gen, localX, localY, localZ);

        this.emit('taskComplete', { taskId: task.id, result });
      } catch (error) {
        task.status = 'failed';
        this.emit('taskFailed', { taskId: task.id, error });
      }
    }

    this.processing = false;
  }

  /**
   * Execute cascade generation pipeline
   * sd15(prompt, steps=15) → sdxl(img2img, .6) → flux(refine, .3)
   */
  async cascade(prompt: string): Promise<ImageBitmap> {
    return this.executeCascade(prompt, ['sd15', 'sdxl', 'flux']);
  }

  /**
   * Execute generation cascade with specified models
   */
  private async executeCascade(
    prompt: string,
    models: ModelType[]
  ): Promise<ImageBitmap> {
    let currentGen: Gen | null = null;
    let currentImage: ImageBitmap | null = null;

    for (let i = 0; i < models.length; i++) {
      const modelType = models[i];
      const cascadeLevel = CASCADE_PIPELINE.find(c => c.model === modelType);
      const strength = cascadeLevel?.strength ?? 1.0;
      const steps = cascadeLevel?.steps ?? 20;

      const gen = new Gen({
        prompt,
        model: modelType,
        steps,
        denoise: i === 0 ? 1.0 : strength,
      });

      // If we have a previous result, use it for img2img
      if (currentGen && currentImage) {
        const latent = await this.imageToLatent(currentImage, modelType);
        gen.setLatent(latent);
      }

      // Simulate diffusion process
      currentImage = await this.runDiffusion(gen, prompt);
      gen.setImage(currentImage);
      currentGen = gen;

      this.emit('cascadeStep', {
        model: modelType,
        step: i + 1,
        total: models.length,
      });
    }

    if (!currentImage) {
      throw new Error('Cascade generation failed');
    }

    return currentImage;
  }

  /**
   * Run diffusion process for a generation
   */
  private async runDiffusion(gen: Gen, prompt: string): Promise<ImageBitmap> {
    // Create a placeholder image for simulation
    // In production, this would call actual diffusion model inference
    const canvas = new OffscreenCanvas(512, 512);
    const ctx = canvas.getContext('2d')!;

    // Generate procedural pattern based on seed
    const seed = gen.seed;
    let rng = seed;
    const nextRandom = () => {
      rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF;
      return rng / 0x7FFFFFFF;
    };

    // Create gradient-like procedural texture
    const imageData = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const noise = nextRandom();
        const gradient = (x + y) / 1024;

        imageData.data[idx] = Math.floor((noise * 0.3 + gradient * 0.7) * 255);
        imageData.data[idx + 1] = Math.floor((noise * 0.4 + (1 - gradient) * 0.6) * 200);
        imageData.data[idx + 2] = Math.floor((noise * 0.5 + gradient * 0.5) * 255);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Add some variation based on prompt hash
    ctx.fillStyle = `hsl(${this.hashString(prompt) % 360}, 50%, 30%)`;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 5; i++) {
      const cx = nextRandom() * 512;
      const cy = nextRandom() * 512;
      const r = nextRandom() * 100 + 50;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas.transferToImageBitmap();
  }

  /**
   * Convert image to latent tensor
   */
  private async imageToLatent(
    image: ImageBitmap,
    _model: ModelType
  ): Promise<LatentTensor> {
    // Simplified VAE encoding simulation
    const latentSize = 64; // 512 / 8
    const channels = 4;
    const data = new Float32Array(channels * latentSize * latentSize);

    // Create canvas to read image data
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, image.width, image.height);

    // Downsample and convert to latent space (simplified)
    const scaleX = image.width / latentSize;
    const scaleY = image.height / latentSize;

    for (let y = 0; y < latentSize; y++) {
      for (let x = 0; x < latentSize; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);
        const srcIdx = (srcY * image.width + srcX) * 4;

        const r = imageData.data[srcIdx] / 255;
        const g = imageData.data[srcIdx + 1] / 255;
        const b = imageData.data[srcIdx + 2] / 255;

        // Simple color to latent mapping
        const idx = y * latentSize + x;
        data[idx] = (r - 0.5) * 2;
        data[idx + latentSize * latentSize] = (g - 0.5) * 2;
        data[idx + latentSize * latentSize * 2] = (b - 0.5) * 2;
        data[idx + latentSize * latentSize * 3] = ((r + g + b) / 3 - 0.5) * 2;
      }
    }

    return {
      data,
      shape: [1, channels, latentSize, latentSize],
    };
  }

  /**
   * Hash string to number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  /**
   * Interlace multiple generations with blending
   */
  interlace(a: Gen, b: Gen, c: Gen, weights: [number, number, number] = [0.4, 0.4, 0.2]): Gen {
    const result = a.clone();
    const latentA = a.getLatent();
    const latentB = b.getLatent();
    const latentC = c.getLatent();

    if (!latentA || !latentB || !latentC) {
      throw new Error('All generations must have latent data');
    }

    const blended = new Float32Array(latentA.data.length);
    for (let i = 0; i < blended.length; i++) {
      blended[i] =
        latentA.data[i] * weights[0] +
        latentB.data[i] * weights[1] +
        latentC.data[i] * weights[2];
    }

    result.setLatent({
      data: blended,
      shape: latentA.shape,
    });

    return result;
  }

  /**
   * Evolve world by mutating seeds and propagating high-scoring blocks
   */
  evolve(): void {
    const blocks = Array.from(this.octree.values());

    for (const block of blocks) {
      if (block.isEmpty()) continue;

      // Check block quality score
      const score = this.evaluateBlock(block);

      if (score < 0.3) {
        // Low score: regenerate with mutated seed
        this.emit('evolve', { hash: block.hash, action: 'mutate', score });
      } else if (score > 0.7) {
        // High score: propagate to neighbors
        this.emit('evolve', { hash: block.hash, action: 'propagate', score });
      }
    }
  }

  /**
   * Evaluate block quality (placeholder)
   */
  private evaluateBlock(block: Block): number {
    // Placeholder: return random score based on hash
    return (this.hashString(block.hash) % 100) / 100;
  }

  /**
   * Get all blocks within render distance
   */
  getVisibleBlocks(cameraPos: Vec3): Block[] {
    const visible: Block[] = [];
    const renderDist = this.config.renderDistance / this.config.chunkSize;

    for (const block of this.octree.values()) {
      const dx = block.position.x - cameraPos.x / this.config.chunkSize;
      const dy = block.position.y - cameraPos.y / this.config.chunkSize;
      const dz = block.position.z - cameraPos.z / this.config.chunkSize;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= renderDist) {
        visible.push(block);
      }
    }

    return visible;
  }

  /**
   * Get WebGPU device
   */
  getDevice(): GPUDevice | null {
    return this.device;
  }

  /**
   * Get octree
   */
  getOctree(): Map<string, Block> {
    return this.octree;
  }

  /**
   * Event emitter helpers
   */
  on(event: string, callback: (data: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: unknown) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: unknown): void {
    this.eventListeners.get(event)?.forEach(cb => cb(data));
  }

  /**
   * Serialize world state
   */
  serialize(): Record<string, unknown> {
    const blocks: Record<string, unknown>[] = [];
    for (const block of this.octree.values()) {
      blocks.push(block.serialize());
    }

    return {
      config: this.config,
      rootHash: this.root.hash,
      blocks,
    };
  }

  /**
   * Get world statistics
   */
  getStats(): Record<string, number> {
    let totalVoxels = 0;
    let totalBlocks = this.octree.size;

    for (const block of this.octree.values()) {
      totalVoxels += block.getSolidCount();
    }

    return {
      blocks: totalBlocks,
      voxels: totalVoxels,
      queueLength: this.queue.length,
      workers: this.workers,
    };
  }
}
