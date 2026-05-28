import { TimeoutError } from './errors';

export async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutP = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        /* swallow */
      }
      reject(new TimeoutError(`执行超时（${timeoutMs / 1000}s）`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeoutP]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
