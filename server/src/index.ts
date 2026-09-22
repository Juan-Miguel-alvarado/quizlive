import { createServer } from 'node:http';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { Server } from 'socket.io';
import { env } from './env';
import { prisma } from './lib/prisma';
import { GameManager } from './game/GameManager';
import { requireHost } from './lib/auth';
import { rateLimit } from './lib/rateLimit';
import { authRouter } from './routes/auth';
import { historyRouter } from './routes/history';
import { gamesRouter } from './routes/games';
import { imagesRouter } from './routes/images';
import { quizzesRouter } from './routes/quizzes';
import { registerSocketHandlers } from './socket/handlers';
import type { TypedServer } from './socket/types';

const app = express();
app.set('trust proxy', 1); // Render/Netlify van detrás de un proxy: así req.ip es la IP real
const httpServer = createServer(app);
const io: TypedServer = new Server(httpServer, { cors: { origin: env.CLIENT_ORIGIN } });
const games = new GameManager(io);
registerSocketHandlers(io, games);

app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  // RENDER_GIT_COMMIT lo pone Render: sirve para saber qué versión está desplegada.
  res.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local' });
});
const writeLimiter = rateLimit({
  limit: 120,
  windowMs: 60 * 60_000,
  message: 'Demasiadas peticiones seguidas, espera un momento',
});

app.use('/api/auth', authRouter);
// Todo lo del anfitrión va con clave; lo público es unirse a una partida y ver las imágenes.
app.use('/api/quizzes', requireHost, writeLimiter, quizzesRouter);
app.use('/api/history', requireHost, historyRouter);
app.use('/api/images', imagesRouter);
app.use('/api/games', gamesRouter(games));

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'El archivo es demasiado grande' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
};
app.use(errorHandler);

httpServer.listen(env.PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${env.PORT}`);
});

const shutdown = async () => {
  io.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
