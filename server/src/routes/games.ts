import { createGameSchema, pinSchema, type CreateGameResponse } from '@quiz/shared';
import { Router } from 'express';
import type { GameManager } from '../game/GameManager';
import { requireHost } from '../lib/auth';
import { prisma } from '../lib/prisma';
import { rateLimit } from '../lib/rateLimit';
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
        questions: {
          orderBy: { order: 'asc' },
          select: { type: true, text: true, imageId: true, options: true, correctIndices: true, timeLimitSec: true },
        },
      },
    });
    if (!quiz) {
      res.status(404).json({ error: 'Quiz no encontrado' });
      return;
    }
    if (quiz.questions.length === 0) {
      res.status(400).json({ error: 'El quiz no tiene preguntas' });
      return;
    }
    const game = games.create(quiz);
    res.status(201).json({ pin: game.pin, hostToken: game.hostToken } satisfies CreateGameResponse);
  });

  // Permite al jugador comprobar el PIN antes de elegir apodo.
  router.get(
    '/:pin',
    rateLimit({ limit: 60, windowMs: 5 * 60_000, message: 'Demasiados intentos de PIN, espera unos minutos' }),
    (req, res) => {
      const pin = pinSchema.safeParse(req.params.pin);
      const game = pin.success ? games.get(pin.data) : undefined;
      if (!game || game.phase === 'podium') {
        res.status(404).json({ error: 'No existe una partida activa con ese PIN' });
        return;
      }
      res.json({ pin: game.pin, quizTitle: game.quizTitle });
    },
  );

  return router;
}
