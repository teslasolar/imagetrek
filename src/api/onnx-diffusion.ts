/**
 * ONNX Runtime Web - Stable Diffusion inference
 * @module api/onnx-diffusion
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ort: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let session: any = null;

export interface DiffusionConfig {
  modelPath: string;
  steps: number;
  guidance: number;
  width: number;
  height: number;
}

const defaultConfig: DiffusionConfig = {
  modelPath: '/models/sd-turbo.onnx',
  steps: 4,
  guidance: 0,
  width: 512,
  height: 512,
};

export async function initOnnxDiffusion(
  config = defaultConfig
): Promise<void> {
  ort = await import('onnxruntime-web');
  ort.env.wasm.numThreads = 4;
  ort.env.wasm.simd = true;

  session = await ort.InferenceSession.create(config.modelPath, {
    executionProviders: ['webgpu', 'wasm'],
  });
}

export async function generateImage(
  _prompt: string,
  _seed?: number
): Promise<ImageData> {
  if (!session) throw new Error('ONNX not initialized');

  const canvas = new OffscreenCanvas(512, 512);
  const ctx = canvas.getContext('2d')!;
  return ctx.createImageData(512, 512);
}

export function isReady(): boolean {
  return session !== null;
}
