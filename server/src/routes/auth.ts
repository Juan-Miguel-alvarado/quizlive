import { hostLoginSchema, type LoginResponse } from '@quiz/shared';
import { Router } from 'express';
import { createSessionToken, isHostPassword, isValidSessionToken } from '../lib/auth';
import { rateLimit } from '../lib/rateLimit';
import { validateBody } from '../lib/validate';

export const authRouter = Router();

authRouter.post(
  '/login',
  rateLimit({ limit: 10, windowMs: 10 * 60_000, message: 'Demasiados intentos, espera unos minutos' }),
  validateBody(hostLoginSchema),
  (req, res) => {
    if (!isHostPassword((req.body as { password: string }).password)) {
      res.status(401).json({ error: 'Clave incorrecta' });
      return;
    }
    res.json({ token: createSessionToken() } satisfies LoginResponse);
  },
);

// El cliente la usa al arrancar para saber si su sesión guardada sigue sirviendo.
authRouter.get('/me', (req, res) => {
  const token = req.get('authorization')?.replace(/^Bearer /i, '');
  res.json({ host: isValidSessionToken(token) });
});
