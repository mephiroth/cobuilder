import OpenAI from 'openai';

let _mimo: OpenAI | null = null;

export function getMimoClient(): OpenAI {
  if (_mimoTestHook) {
    throw new Error('getMimoClient called while test hook active');
  }
  if (!_mimo) {
    _mimo = new OpenAI({
      apiKey: process.env.MIMO_API_KEY,
      baseURL: 'https://token-plan-sgp.xiaomimimo.com/v1',
    });
  }
  return _mimo;
}

export default getMimoClient;

export const MODELS = {
  clarify: 'mimo-v2.5-pro',
  moderate: 'mimo-v2.5-pro',
  fast: 'mimo-v2.5',
  pm: 'mimo-v2.5-pro',
  design: 'mimo-v2.5-pro',
  dev_plan: 'mimo-v2.5-pro',
  code_gen: 'mimo-v2.5-pro',
  test: 'mimo-v2.5-pro',
} as const;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let _mimoTestHook: ((prompt: string, model: string, system?: string) => Promise<string>) | null = null;

export function setMimoTestHook(
  fn: ((prompt: string, model: string, system?: string) => Promise<string>) | null
): void {
  _mimoTestHook = fn;
}

export async function callMimoJson(
  prompt: string,
  model: string = MODELS.pm,
  system?: string
): Promise<string> {
  if (_mimoTestHook) return _mimoTestHook(prompt, model, system);
  if (!process.env.MIMO_API_KEY) {
    throw new Error('MIMO_API_KEY 未配置');
  }
  const res = await getMimoClient().chat.completions.create({
    model,
    messages: [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error('MiMo 返回空内容');
  return content;
}

export async function callMimoWithRetry(opts: {
  prompt: string;
  model?: string;
  system?: string;
  retries?: number;
  backoffMs?: number[];
}): Promise<string> {
  const { prompt, model = MODELS.pm, system, retries = 2, backoffMs = [1000, 3000] } = opts;
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await callMimoJson(prompt, model, system);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) await sleep(backoffMs[attempt] ?? 1000);
    }
  }
  throw lastErr ?? new Error('MiMo 调用失败');
}

export async function callMimoWithTimeout(
  prompt: string,
  timeoutMs: number,
  model: string = MODELS.code_gen,
  system?: string
): Promise<string> {
  return runWithTimeout(() => callMimoJson(prompt, model, system), timeoutMs);
}

async function runWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const p = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`MiMo 超时（${timeoutMs}ms）`)), timeoutMs);
    fn().then(resolve, reject);
  });
  try {
    return await p;
  } finally {
    clearTimeout(timer!);
  }
}
