export async function fetchWithTimeout(resource: string, options: any = {}, timeoutMs = 8000): Promise<any> {
  const f: any = (globalThis as any).fetch;
  return await Promise.race([
    f(resource, options || {}),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
  ]);
}

export function pLimit(concurrency: number) {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    activeCount--;
    if (queue.length > 0) queue.shift()!();
  };

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (activeCount >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    activeCount++;
    try {
      return await fn();
    } finally {
      next();
    }
  };

  return run;
}
