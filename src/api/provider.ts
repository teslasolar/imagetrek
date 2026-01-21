/**
 * API Provider - Unified interface for generation backends
 * @module api/provider
 */

export type ProviderType = 'local' | 'replicate' | 'huggingface' | 'custom';

export interface GenerationResult {
  image: ImageBitmap;
  seed: number;
  model: string;
}

export interface Provider {
  name: ProviderType;
  generate(prompt: string, options?: GenerateOptions): Promise<GenerationResult>;
  isAvailable(): Promise<boolean>;
}

export interface GenerateOptions {
  seed?: number;
  steps?: number;
  guidance?: number;
  width?: number;
  height?: number;
  negativePrompt?: string;
}

let activeProvider: Provider | null = null;

export function setProvider(provider: Provider): void {
  activeProvider = provider;
}

export function getProvider(): Provider | null {
  return activeProvider;
}

export async function generate(
  prompt: string,
  options?: GenerateOptions
): Promise<GenerationResult> {
  if (!activeProvider) {
    throw new Error('No provider set');
  }
  return activeProvider.generate(prompt, options);
}
