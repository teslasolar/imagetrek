/**
 * WebLLM Integration - Text understanding for prompts
 * @module api/webllm
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let engine: any = null;

export async function initWebLLM(
  model = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  if (engine) return engine;

  const webllm = await import('@mlc-ai/web-llm');
  engine = await webllm.CreateMLCEngine(model, {
    initProgressCallback: (p: { text: string }) => {
      console.log(`WebLLM: ${p.text}`);
    },
  });

  return engine;
}

export async function enhancePrompt(prompt: string): Promise<string> {
  if (!engine) await initWebLLM();

  const response = await engine.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'Enhance this image prompt. Keep under 50 words.',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 100,
  });

  return response.choices[0].message.content || prompt;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEngine(): any {
  return engine;
}
