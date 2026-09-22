import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../env';

const TOKEN_TTL_MS = 30 * 24 * 3600_000;
// Sin SESSION_SECRET se genera uno al azar: las sesiones duran lo que dure el proceso.
const secret = env.SESSION_SECRET ?? randomBytes(32).toString('hex');

const sign = (data: string) => createHmac('sha256', secret).update(data).digest('base64url');

/** Token propio (payload.firma); no hace falta guardar sesiones en la base de datos. */
export function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number };
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

/** Compara sin filtrar el largo ni el contenido por el tiempo de respuesta. */
export function isHostPassword(candidate: string): boolean {
  const a = createHmac('sha256', secret).update(candidate).digest();
  const b = createHmac('sha256', secret).update(env.HOST_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

/** Protege lo que solo puede hacer el anfitrión: crear quizzes, lanzar partidas, ver el historial. */
export const requireHost: RequestHandler = (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer /i, '');
  if (!isValidSessionToken(token)) {
    res.status(401).json({ error: 'Necesitas la clave de anfitrión' });
    return;
  }
  next();
};
