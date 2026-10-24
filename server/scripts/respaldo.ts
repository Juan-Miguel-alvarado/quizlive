/**
 * Copia de seguridad de toda la base (trivias, series, preguntas, fotos e historial) en un archivo JSON,
 * y restauración en otra base. Sirve para cambiar de Postgres (p. ej. de Render a Neon) sin perder nada.
 * No necesita pg_dump: funciona igual en Windows.
 *
 * Uso:
 *   pnpm --filter server db:respaldar "postgresql://…"                         → respaldos/quizlive-AAAA-MM-DD.json
 *   pnpm --filter server db:restaurar respaldos/quizlive-….json "postgresql://…"
 * Sin URL usa DATABASE_URL del .env. La restauración aplica las migraciones y exige una base vacía
 * (no mezcla datos). Los ids se conservan, así que el historial sigue apuntando a sus trivias.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient, type Game, type GameAnswer, type Image, type PlayerResult, type Question, type Quiz, type Series } from '../src/generated/prisma/client';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

// Las fechas viajan como texto ISO (Prisma las acepta así al crear) y las fotos, en base64.
type Respaldo = {
  app: 'quizlive';
  version: 1;
  creado: string;
  image: (Omit<Image, 'data'> & { data: string })[];
  quiz: Quiz[];
  series: Series[];
  question: Question[];
  game: Game[];
  playerResult: PlayerResult[];
  gameAnswer: GameAnswer[];
};

// Fuera de este equipo Postgres pide TLS (Render lo exige en la URL externa).
function conTls(url: string) {
  const u = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require');
  return u.toString();
}

const conectar = (url: string) => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const resumen = (r: Respaldo) =>
  `${r.quiz.length} trivias, ${r.question.length} preguntas, ${r.image.length} fotos, ` +
  `${r.game.length} partidas en el historial (${r.playerResult.length} participantes)`;

// createMany por tandas: Postgres admite como mucho 65 535 parámetros por consulta.
async function enTandas<T>(filas: T[], tam: number, crear: (tanda: T[]) => Promise<unknown>) {
  for (let i = 0; i < filas.length; i += tam) await crear(filas.slice(i, i + tam));
}

async function respaldar(url: string) {
  const prisma = conectar(url);
  const orden = { orderBy: { id: 'asc' } } as const;
  const [image, quiz, series, question, game, playerResult, gameAnswer] = await Promise.all([
    prisma.image.findMany(orden),
    prisma.quiz.findMany(orden),
    prisma.series.findMany(orden),
    prisma.question.findMany(orden),
    prisma.game.findMany(orden),
    prisma.playerResult.findMany(orden),
    prisma.gameAnswer.findMany(orden),
  ]);
  await prisma.$disconnect();

  const r: Respaldo = {
    app: 'quizlive',
    version: 1,
    creado: new Date().toISOString(),
    image: image.map((i) => ({ ...i, data: Buffer.from(i.data).toString('base64') })),
    quiz,
    series,
    question,
    game,
    playerResult,
    gameAnswer,
  };
  const carpeta = fileURLToPath(new URL('../../respaldos/', import.meta.url));
  mkdirSync(carpeta, { recursive: true });
  const archivo = resolve(carpeta, `quizlive-${r.creado.slice(0, 10)}.json`);
  writeFileSync(archivo, JSON.stringify(r));
  console.log(`Respaldo guardado en ${archivo}`);
  console.log(`  ${resumen(r)}`);
}

async function restaurar(archivo: string, url: string) {
  // pnpm --filter cambia la carpeta de trabajo a server/: la ruta se toma desde donde se lanzó el comando.
  const ruta = resolve(process.env.INIT_CWD ?? process.cwd(), archivo);
  const r = JSON.parse(readFileSync(ruta, 'utf8')) as Respaldo;
  if (r.app !== 'quizlive' || r.version !== 1) throw new Error(`${ruta} no es un respaldo de QuizLive.`);

  console.log('Aplicando las migraciones en la base de destino…');
  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  const prisma = conectar(url);
  const ocupada = (await prisma.quiz.count()) + (await prisma.image.count()) + (await prisma.game.count());
  if (ocupada > 0) {
    await prisma.$disconnect();
    throw new Error('La base de destino ya tiene datos: restaura en una base vacía para no mezclar ni duplicar.');
  }

  // Todo o nada: si algo falla, la base queda vacía y se puede repetir.
  await prisma.$transaction(
    async (tx) => {
      await enTandas(r.image, 20, (data) =>
        tx.image.createMany({ data: data.map((i) => ({ ...i, data: new Uint8Array(Buffer.from(i.data, 'base64')) })) }),
      );
      await enTandas(r.quiz, 1000, (data) => tx.quiz.createMany({ data }));
      await enTandas(r.series, 1000, (data) => tx.series.createMany({ data }));
      await enTandas(r.question, 1000, (data) => tx.question.createMany({ data }));
      await enTandas(r.game, 1000, (data) => tx.game.createMany({ data }));
      await enTandas(r.playerResult, 1000, (data) => tx.playerResult.createMany({ data }));
      await enTandas(r.gameAnswer, 1000, (data) => tx.gameAnswer.createMany({ data }));
    },
    { timeout: 5 * 60_000 },
  );
  await prisma.$disconnect();
  console.log(`Restaurado ${ruta} (respaldo del ${r.creado.slice(0, 10)}):`);
  console.log(`  ${resumen(r)}`);
}

async function main() {
  const [accion, ...args] = process.argv.slice(2);
  const urlDe = (arg: string | undefined) => {
    const url = arg ?? process.env.DATABASE_URL;
    if (!url) throw new Error('Falta la URL de la base (pásala entre comillas o define DATABASE_URL en .env).');
    return conTls(url);
  };
  if (accion === 'respaldar') return respaldar(urlDe(args[0]));
  if (accion === 'restaurar' && args[0]) return restaurar(args[0], urlDe(args[1]));
  throw new Error('Uso: db:respaldar ["URL"]  |  db:restaurar <archivo.json> ["URL"]');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
