/**
 * Gen - Generation Entity Class
 * Represents a diffusion model generation with seed as key, steps as stake
 * Handles encoding/decoding, diffusion steps, upscaling, and merging
 */

import {
  ModelType,
  LoRA,
  LatentTensor,
  DecodedOutput,
  GenerationParams,
  MODEL_CONFIGS,
} from './types';

export class Gen {
  readonly seed: number;
  readonly id: string;
  steps: number;
  cfg: number;
  denoise: number;
  model: ModelType;
  loras: LoRA[];
  negativePrompt: string;

  private latent: LatentTensor | null = null;
  private noise: Float32Array | null = null;
  private prediction: Float32Array | null = null;
  private image: ImageBitmap | null = null;
  private clipScore: number = 0;

  constructor(params: GenerationParams) {
    this.seed = params.seed ?? Gen.randomSeed();
    this.id = Gen.hashSeed(this.seed);
    this.steps = params.steps ?? 20;
    this.cfg = params.cfg ?? 7.5;
    this.denoise = params.denoise ?? 1.0;
    this.model = params.model ?? 'sd15';
    this.loras = params.loras ?? [];
    this.negativePrompt = params.negativePrompt ?? '';
  }

  /**
   * Generate a random 32-bit seed
   */
  static randomSeed(): number {
    return Math.floor(Math.random() * 0xFFFFFFFF);
  }

  /**
   * Create deterministic hash from seed
   */
  static hashSeed(seed: number): string {
    let hash = seed;
    hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
    hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
    hash = (hash >> 16) ^ hash;
    return hash.toString(16).padStart(8, '0');
  }

  /**
   * Decode latent space representation
   */
  decode(): DecodedOutput {
    if (!this.latent || !this.noise || !this.prediction) {
      throw new Error('No generation data available');
    }
    return {
      latent: this.latent,
      noise: this.noise,
      prediction: this.prediction,
    };
  }

  /**
   * Perform single diffusion step
   * pred = unet(latent, t, prompt)
   * latent -= noise * sigma
   */
  async diffuse(
    t: number,
    prompt: string,
    unetCallback: (latent: LatentTensor, t: number, prompt: string) => Promise<Float32Array>
  ): Promise<Float32Array> {
    if (!this.latent) {
      this.initializeLatent();
    }

    const pred = await unetCallback(this.latent!, t, prompt);
    this.prediction = pred;

    // Calculate sigma for timestep
    const sigma = this.calculateSigma(t);

    // Update latent: latent -= noise * sigma
    if (this.latent && this.noise) {
      for (let i = 0; i < this.latent.data.length; i++) {
        this.latent.data[i] -= this.noise[i] * sigma;
      }
    }

    return pred;
  }

  /**
   * Initialize latent tensor with noise from seed
   */
  private initializeLatent(): void {
    const config = MODEL_CONFIGS[this.model];
    const latentSize = config.size / 8; // VAE compression ratio
    const channels = 4; // Latent channels

    const shape: [number, number, number, number] = [1, channels, latentSize, latentSize];
    const size = channels * latentSize * latentSize;

    const data = new Float32Array(size);
    const noise = new Float32Array(size);

    // Seeded random number generator
    let rngState = this.seed;
    const nextRandom = () => {
      rngState = (rngState * 1103515245 + 12345) & 0x7FFFFFFF;
      return (rngState / 0x7FFFFFFF) * 2 - 1;
    };

    // Box-Muller transform for Gaussian noise
    for (let i = 0; i < size; i += 2) {
      const u1 = (nextRandom() + 1) / 2;
      const u2 = (nextRandom() + 1) / 2;
      const r = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10)));
      const theta = 2 * Math.PI * u2;

      data[i] = r * Math.cos(theta);
      noise[i] = data[i];

      if (i + 1 < size) {
        data[i + 1] = r * Math.sin(theta);
        noise[i + 1] = data[i + 1];
      }
    }

    this.latent = { data, shape };
    this.noise = noise;
  }

  /**
   * Calculate noise schedule sigma for timestep
   */
  private calculateSigma(t: number): number {
    // Linear noise schedule (simplified)
    const betaStart = 0.00085;
    const betaEnd = 0.012;
    const beta = betaStart + (betaEnd - betaStart) * t;
    return Math.sqrt(beta);
  }

  /**
   * Upscale image using ESRGAN 4x
   */
  async upscale(esrganCallback: (img: ImageBitmap) => Promise<ImageBitmap>): Promise<ImageBitmap> {
    if (!this.image) {
      throw new Error('No image to upscale');
    }
    this.image = await esrganCallback(this.image);
    return this.image;
  }

  /**
   * Merge with another generation using latent blending
   */
  merge(other: Gen, blend: number = 0.5): void {
    if (!this.latent || !other.latent) {
      throw new Error('Both generations must have latent data');
    }

    // Linear interpolation of latents
    for (let i = 0; i < this.latent.data.length; i++) {
      this.latent.data[i] =
        this.latent.data[i] * (1 - blend) +
        other.latent.data[i] * blend;
    }
  }

  /**
   * Validate generation quality
   * Returns true if steps >= 20 and CLIP score > 0.23
   */
  valid(): boolean {
    return this.steps >= 20 && this.clipScore > 0.23;
  }

  /**
   * Set the generated image
   */
  setImage(image: ImageBitmap): void {
    this.image = image;
  }

  /**
   * Get the generated image
   */
  getImage(): ImageBitmap | null {
    return this.image;
  }

  /**
   * Set CLIP score for quality validation
   */
  setClipScore(score: number): void {
    this.clipScore = score;
  }

  /**
   * Get CLIP score
   */
  getClipScore(): number {
    return this.clipScore;
  }

  /**
   * Get current latent tensor
   */
  getLatent(): LatentTensor | null {
    return this.latent;
  }

  /**
   * Set latent tensor (for img2img or refinement)
   */
  setLatent(latent: LatentTensor): void {
    this.latent = latent;
  }

  /**
   * Clone this generation entity
   */
  clone(): Gen {
    const gen = new Gen({
      seed: this.seed,
      steps: this.steps,
      cfg: this.cfg,
      denoise: this.denoise,
      model: this.model,
      loras: [...this.loras],
      negativePrompt: this.negativePrompt,
    });

    if (this.latent) {
      gen.setLatent({
        data: new Float32Array(this.latent.data),
        shape: [...this.latent.shape] as [number, number, number, number],
      });
    }

    return gen;
  }

  /**
   * Serialize to JSON-compatible object
   */
  toJSON(): Record<string, unknown> {
    return {
      seed: this.seed,
      id: this.id,
      steps: this.steps,
      cfg: this.cfg,
      denoise: this.denoise,
      model: this.model,
      loras: this.loras,
      negativePrompt: this.negativePrompt,
      clipScore: this.clipScore,
    };
  }

  /**
   * Create from JSON object
   */
  static fromJSON(json: Record<string, unknown>): Gen {
    const gen = new Gen({
      seed: json.seed as number,
      steps: json.steps as number,
      cfg: json.cfg as number,
      denoise: json.denoise as number,
      model: json.model as ModelType,
      loras: json.loras as LoRA[],
      negativePrompt: json.negativePrompt as string,
    });

    if (json.clipScore) {
      gen.setClipScore(json.clipScore as number);
    }

    return gen;
  }
}
