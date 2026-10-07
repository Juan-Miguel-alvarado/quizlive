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

  const current = (key: string) => {
    const bucket = buckets.get(key);
    return bucket && bucket.resetAt > Date.now() ? bucket : undefined;
  };

  return {
    /** Suma un intento; devuelve false cuando se pasó del límite. */
    take(key: string): boolean {
      const bucket = current(key);
      if (!bucket) {
        buckets.set(key, { count: 1, resetAt: Date.now() + windowMs });
        return true;
      }
      bucket.count++;
      return bucket.count <= limit;
    },
    /** Consulta sin sumar: sirve para limitar solo los fallos (p. ej. PIN inexistentes). */
    blocked(key: string): boolean {
      return (current(key)?.count ?? 0) >= limit;
    },
  };
}

export function rateLimit(options: { limit: number; windowMs: number; message: string }): RequestHandler {
  const { take } = createRateLimiter(options);
  return (req, res, next) => {
    if (take(req.ip ?? 'desconocida')) return next();
    res.status(429).json({ error: options.message });
  };
}
