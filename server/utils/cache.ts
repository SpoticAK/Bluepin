import { createHash } from "crypto";

export function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function createLruCache<T>(maxSize = 100) {
  const cache = new Map<string, T>();
  return {
    get: (key: string): T | undefined => {
      const val = cache.get(key);
      if (val !== undefined) {
        cache.delete(key);
        cache.set(key, val);
      }
      return val;
    },
    set: (key: string, val: T): void => {
      if (cache.has(key)) cache.delete(key);
      else if (cache.size >= maxSize) {
        cache.delete(cache.keys().next().value!);
      }
      cache.set(key, val);
    },
    size: () => cache.size,
  };
}
