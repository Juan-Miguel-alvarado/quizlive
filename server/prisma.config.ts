import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Sin `env()`: `prisma generate` corre en cada install (también en Netlify, sin base de datos).
  // Los comandos que sí se conectan (migrate, studio) fallan con un error claro si falta.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
