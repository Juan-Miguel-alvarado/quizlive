import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  // Uno o varios orígenes separados por coma (p. ej. el dominio de Netlify y localhost).
  CLIENT_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  // Clave para entrar como anfitrión (crear quizzes, lanzar partidas, ver el historial).
  HOST_PASSWORD: z.string().min(4).default('anfitrion'),
  // Firma los tokens de sesión. Si falta, se usa uno al azar y las sesiones caducan al reiniciar.
  SESSION_SECRET: z.string().min(16).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Variables de entorno inválidas:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (env.HOST_PASSWORD === 'anfitrion') {
  console.warn('⚠  HOST_PASSWORD no está configurada: se usa la clave por defecto «anfitrion».');
}
