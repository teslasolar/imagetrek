/**
 * Type declarations for optional dependencies
 */

declare module '@mlc-ai/web-llm' {
  export function CreateMLCEngine(
    model: string,
    options?: { initProgressCallback?: (p: { text: string }) => void }
  ): Promise<unknown>;
}

declare module 'onnxruntime-web' {
  export const env: {
    wasm: { numThreads: number; simd: boolean };
  };

  export const InferenceSession: {
    create(
      path: string,
      options?: { executionProviders: string[] }
    ): Promise<unknown>;
  };
}
