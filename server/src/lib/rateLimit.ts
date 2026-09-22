import type { RequestHandler } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Límite por clave (IP) con ventana fija, en memoria. Suficiente para un solo proceso;
 * con varias instancias habría que moverlo a Redis.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const buckets = new Map<string, Bucket>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }, windowMs).unref();

  /** Devuelve false cuando se pasó del límite. */
  return function take(key: string): boolean {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    bucket.count++;
    return bucket.count <= limit;
  };
}

export function rateLimit(options: { limit: number; windowMs: number; message: string }): RequestHandler {
  const take = createRateLimiter(options);
  return (req, res, next) => {
    if (take(req.ip ?? 'desconocida')) return next();
    res.status(429).json({ error: options.message });
  };
}
