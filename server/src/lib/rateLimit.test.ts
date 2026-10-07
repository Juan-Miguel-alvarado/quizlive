import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

describe('límite por IP', () => {
  it('bloquea al pasarse del cupo y solo para esa clave', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b')).toBe(true);
  });

  it('blocked consulta sin gastar cupo (los aciertos no cuentan)', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    for (let i = 0; i < 50; i++) expect(limiter.blocked('a')).toBe(false);
    limiter.take('a');
    expect(limiter.blocked('a')).toBe(false);
    limiter.take('a');
    expect(limiter.blocked('a')).toBe(true);
  });
});
