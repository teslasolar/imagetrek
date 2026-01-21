/**
 * Local Provider - Browser-based generation
 * @module api/local-provider
 */

import { Provider, GenerationResult, GenerateOptions } from './provider';

export class LocalProvider implements Provider {
  name = 'local' as const;

  async isAvailable(): Promise<boolean> {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerationResult> {
    const seed = options?.seed ?? Math.floor(Math.random() * 0xffffffff);
    const width = options?.width ?? 512;
    const height = options?.height ?? 512;

    const image = await this.createProceduralImage(prompt, seed, width, height);

    return { image, seed, model: 'local-procedural' };
  }

  private async createProceduralImage(
    prompt: string,
    seed: number,
    width: number,
    height: number
  ): Promise<ImageBitmap> {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    // Seeded RNG
    let rng = seed;
    const rand = () => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      return rng / 0x7fffffff;
    };

    // Generate based on prompt hash
    const hue = this.hashPrompt(prompt) % 360;
    const data = ctx.createImageData(width, height);

    for (let i = 0; i < data.data.length; i += 4) {
      const noise = rand();
      data.data[i] = Math.floor((Math.sin(hue * 0.01) * 0.5 + 0.5 + noise * 0.2) * 255);
      data.data[i + 1] = Math.floor((Math.cos(hue * 0.01) * 0.5 + 0.5 + noise * 0.2) * 200);
      data.data[i + 2] = Math.floor((noise * 0.7 + 0.3) * 255);
      data.data[i + 3] = 255;
    }

    ctx.putImageData(data, 0, 0);
    return canvas.transferToImageBitmap();
  }

  private hashPrompt(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}
