/**
 * Replicate Provider - Cloud API generation
 * @module api/replicate-provider
 */

import { Provider, GenerationResult, GenerateOptions } from './provider';

export class ReplicateProvider implements Provider {
  name = 'replicate' as const;
  private apiKey: string;
  private proxyUrl?: string;

  constructor(apiKey: string, proxyUrl?: string) {
    this.apiKey = apiKey;
    this.proxyUrl = proxyUrl;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerationResult> {
    const seed = options?.seed ?? Math.floor(Math.random() * 0xffffffff);
    const baseUrl = this.proxyUrl || 'https://api.replicate.com/v1';

    const response = await fetch(`${baseUrl}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'sdxl', // or specific version hash
        input: {
          prompt,
          negative_prompt: options?.negativePrompt || '',
          num_inference_steps: options?.steps || 25,
          guidance_scale: options?.guidance || 7.5,
          seed,
          width: options?.width || 1024,
          height: options?.height || 1024,
        },
      }),
    });

    const data = await response.json();
    const imageUrl = await this.waitForResult(data.id, baseUrl);
    const image = await this.fetchImage(imageUrl);

    return { image, seed, model: 'sdxl' };
  }

  private async waitForResult(id: string, baseUrl: string): Promise<string> {
    while (true) {
      const res = await fetch(`${baseUrl}/predictions/${id}`, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });
      const data = await res.json();

      if (data.status === 'succeeded') return data.output[0];
      if (data.status === 'failed') throw new Error(data.error);

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  private async fetchImage(url: string): Promise<ImageBitmap> {
    const res = await fetch(url);
    const blob = await res.blob();
    return createImageBitmap(blob);
  }
}
