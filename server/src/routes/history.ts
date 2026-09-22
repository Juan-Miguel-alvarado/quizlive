import type { GameHistoryItem, GameReport, PlayerReport, QuestionReport } from '@quiz/shared';
import { Router } from 'express';
import { prisma } from '../lib/prisma';

/** Se consideran «falladas» las preguntas que acertó menos de esta parte del grupo. */
export const RETRY_THRESHOLD = 0.6;

const gameWithAnswers = {
  players: {
    orderBy: { rank: 'asc' },
    select: {
      nickname: true,
      rank: true,
      score: true,
      answers: {
        select: { questionOrder: true, questionText: true, correct: true, choices: true, responseMs: true },
      },
    },
  },
} as const;

type GameRow = {
  id: string;
  quizId: string | null;
  quizTitle: string;
  pin: string;
  startedAt: Date;
  finishedAt: Date;
  players: {
    nickname: string;
    rank: number;
    score: number;
    answers: { questionOrder: number; questionText: string; correct: boolean; choices: number[]; responseMs: number | null }[];
  }[];
};

function buildReport(game: GameRow) {
  const byQuestion = new Map<number, QuestionReport & { times: number[] }>();
  for (const player of game.players) {
    for (const a of player.answers) {
      const q = byQuestion.get(a.questionOrder) ?? {
        order: a.questionOrder,
        text: a.questionText,
        answered: 0,
        correct: 0,
        correctRatio: 0,
        averageResponseMs: null,
        times: [],
      };
      if (a.choices.length > 0) q.answered++;
      if (a.correct) q.correct++;
      if (a.responseMs !== null) q.times.push(a.responseMs);
      byQuestion.set(a.questionOrder, q);
    }
  }
  const questions: QuestionReport[] = [...byQuestion.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ times, ...q }) => ({
      ...q,
      correctRatio: game.players.length ? q.correct / game.players.length : 0,
      averageResponseMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    }));

  const players: PlayerReport[] = game.players.map((p) => ({
    nickname: p.nickname,
    rank: p.rank,
    score: p.score,
    correct: p.answers.filter((a) => a.correct).length,
    answered: p.answers.filter((a) => a.choices.length > 0).length,
  }));

  const summary: GameHistoryItem = {
    id: game.id,
    quizId: game.quizId,
    quizTitle: game.quizTitle,
    pin: game.pin,
    startedAt: game.startedAt.toISOString(),
    finishedAt: game.finishedAt.toISOString(),
    playerCount: game.players.length,
    questionCount: questions.length,
    averageCorrectRatio: questions.length
      ? questions.reduce((sum, q) => sum + q.correctRatio, 0) / questions.length
      : 0,
  };
  return { summary, questions, players };
}

export const historyRouter = Router();

historyRouter.get('/', async (_req, res) => {
  const games = await prisma.game.findMany({
    orderBy: { finishedAt: 'desc' },
    take: 50,
    select: { id: true, quizId: true, quizTitle: true, pin: true, startedAt: true, finishedAt: true, ...gameWithAnswers },
  });
  res.json(games.map((g) => buildReport(g).summary) satisfies GameHistoryItem[]);
});

historyRouter.get('/:id', async (req, res) => {
  const game = await prisma.game.findUnique({
    where: { id: req.params.id },
    select: { id: true, quizId: true, quizTitle: true, pin: true, startedAt: true, finishedAt: true, ...gameWithAnswers },
  });
  if (!game) {
    res.status(404).json({ error: 'Partida no encontrada' });
    return;
  }
  const { summary, questions, players } = buildReport(game);
  const quizExists = game.quizId ? (await prisma.quiz.count({ where: { id: game.quizId } })) > 0 : false;
  res.json({ ...summary, questions, players, canRetry: quizExists } satisfies GameReport);
});

/** Crea un quiz nuevo solo con las preguntas que más falló el grupo. */
historyRouter.post('/:id/retry', async (req, res) => {
  const game = await prisma.game.findUnique({
    where: { id: req.params.id },
    select: { id: true, quizId: true, quizTitle: true, pin: true, startedAt: true, finishedAt: true, ...gameWithAnswers },
  });
  if (!game?.quizId) {
    res.status(404).json({ error: 'El quiz original ya no existe' });
    return;
  }
  const { questions } = buildReport(game);
  const failedOrders = new Set(questions.filter((q) => q.correctRatio < RETRY_THRESHOLD).map((q) => q.order));
  if (failedOrders.size === 0) {
    res.status(400).json({ error: 'No hubo preguntas falladas: el grupo acertó todo' });
    return;
  }
  const original = await prisma.quiz.findUnique({
    where: { id: game.quizId },
    select: {
      questions: {
        orderBy: { order: 'asc' },
        select: { order: true, type: true, text: true, imageId: true, options: true, correctIndices: true, timeLimitSec: true },
      },
    },
  });
  const failed = (original?.questions ?? []).filter((q) => failedOrders.has(q.order));
  if (failed.length === 0) {
    res.status(400).json({ error: 'El quiz original cambió y ya no tiene esas preguntas' });
    return;
  }
  const quiz = await prisma.quiz.create({
    data: {
      title: `${game.quizTitle} — repaso`,
      questions: { create: failed.map(({ order: _order, ...q }, i) => ({ ...q, order: i })) },
    },
    select: { id: true, title: true },
  });
  res.status(201).json(quiz);
});
