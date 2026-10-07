import { createGameSchema, pinSchema, type CreateGameResponse } from '@quiz/shared';
import { Router } from 'express';
import type { GameManager } from '../game/GameManager';
import { requireHost } from '../lib/auth';
import { prisma } from '../lib/prisma';
import { createRateLimiter } from '../lib/rateLimit';
import { validateBody } from '../lib/validate';

export function gamesRouter(games: GameManager) {
  const router = Router();

  // Lanzar una partida es del anfitrión; consultar un PIN es público (pero con límite).
  router.post('/', requireHost, validateBody(createGameSchema), async (req, res) => {
    const quiz = await prisma.quiz.findUnique({
      where: { id: (req.body as { quizId: string }).quizId },
      select: {
        id: true,
        title: true,
        pointsCorrect: true,
        speedBonusMax: true,
        series: {
          orderBy: { order: 'asc' },
          select: {
            title: true,
            questions: {
              orderBy: { order: 'asc' },
              select: { type: true, text: true, imageId: true, options: true, correctIndices: true, timeLimitSec: true, explanation: true },
            },
          },
        },
      },
    });
    if (!quiz) {
      res.status(404).json({ error: 'Trivia no encontrada' });
      return;
    }
    // Las series vacías (todavía en preparación) se saltan al jugar.
    const series = quiz.series.filter((s) => s.questions.length > 0);
    if (series.length === 0) {
      res.status(400).json({ error: 'La trivia no tiene preguntas' });
      return;
    }
    const game = games.create({
      id: quiz.id,
      title: quiz.title,
      scoring: { base: quiz.pointsCorrect, bonus: quiz.speedBonusMax },
      series: series.map((s) => ({ title: s.title })),
      questions: series.flatMap((s, seriesIndex) => s.questions.map((q) => ({ ...q, seriesIndex }))),
    });
    res.status(201).json({ pin: game.pin, hostToken: game.hostToken } satisfies CreateGameResponse);
  });

  // Permite al jugador comprobar el PIN antes de elegir apodo. Solo cuentan los PIN que no
  // existen: con datos móviles cientos de celulares pueden compartir IP (CGNAT del operador)
  // y un límite por petición dejaría fuera a la mitad de la sala.
  const pinFailures = createRateLimiter({ limit: 60, windowMs: 5 * 60_000 });
  router.get('/:pin', (req, res) => {
    const ip = req.ip ?? 'desconocida';
    if (pinFailures.blocked(ip)) {
      res.status(429).json({ error: 'Demasiados intentos de PIN, espera unos minutos' });
      return;
    }
    const pin = pinSchema.safeParse(req.params.pin);
    const game = pin.success ? games.get(pin.data) : undefined;
    if (!game || game.phase === 'podium') {
      pinFailures.take(ip);
      res.status(404).json({ error: 'No existe una partida activa con ese PIN' });
      return;
    }
    res.json({ pin: game.pin, quizTitle: game.quizTitle });
  });

  return router;
}
