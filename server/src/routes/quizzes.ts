import { Router } from 'express';
import {
  quizInputSchema,
  quizRenameSchema,
  type QuizDetail,
  type QuizInput,
  type QuizSummary,
} from '@quiz/shared';
import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';
import { validateBody } from '../lib/validate';
import { deleteOrphanImages } from './images';

export const quizzesRouter = Router();

type Tx = Prisma.TransactionClient;

const questionSelect = {
  id: true,
  type: true,
  text: true,
  imageId: true,
  options: true,
  correctIndices: true,
  timeLimitSec: true,
  explanation: true,
} as const;

const detailSelect = {
  id: true,
  title: true,
  pointsCorrect: true,
  speedBonusMax: true,
  series: {
    orderBy: { order: 'asc' },
    select: { id: true, title: true, questions: { orderBy: { order: 'asc' }, select: questionSelect } },
  },
} as const;

/**
 * Crea las series de una trivia con sus preguntas. `order` de la pregunta es global dentro de la
 * trivia (el historial lo usa como número de pregunta), no dentro de la serie.
 */
async function createSeries(tx: Tx, quizId: string, series: QuizInput['series']) {
  let order = 0;
  for (const [index, s] of series.entries()) {
    await tx.series.create({
      data: {
        quizId,
        order: index,
        title: s.title,
        questions: { create: s.questions.map((q) => ({ ...q, quizId, order: order++ })) },
      },
    });
  }
}

/** Devuelve un mensaje de error si alguna pregunta apunta a una imagen que no existe. */
async function checkImages(input: QuizInput): Promise<string | null> {
  const ids = [
    ...new Set(input.series.flatMap((s) => s.questions.map((q) => q.imageId)).filter((id): id is string => id !== null)),
  ];
  if (ids.length === 0) return null;
  const found = await prisma.image.count({ where: { id: { in: ids } } });
  return found === ids.length ? null : 'Alguna imagen ya no existe; vuelve a subirla';
}

const readDetail = (tx: Tx | typeof prisma, id: string) =>
  tx.quiz.findUnique({ where: { id }, select: detailSelect }) as Promise<QuizDetail | null>;

quizzesRouter.get('/', async (_req, res) => {
  const quizzes = await prisma.quiz.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { questions: true, series: true } },
    },
  });
  res.json(
    quizzes.map<QuizSummary>((q) => ({
      id: q.id,
      title: q.title,
      seriesCount: q._count.series,
      questionCount: q._count.questions,
      updatedAt: q.updatedAt.toISOString(),
    })),
  );
});

quizzesRouter.get('/:id', async (req, res) => {
  const quiz = await readDetail(prisma, req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Trivia no encontrada' });
    return;
  }
  res.json(quiz);
});

quizzesRouter.post('/', validateBody(quizInputSchema), async (req, res) => {
  const input = req.body as QuizInput;
  const imageError = await checkImages(input);
  if (imageError) {
    res.status(400).json({ error: imageError });
    return;
  }
  const quiz = await prisma.$transaction(async (tx) => {
    const { id } = await tx.quiz.create({
      data: { title: input.title, pointsCorrect: input.pointsCorrect, speedBonusMax: input.speedBonusMax },
      select: { id: true },
    });
    await createSeries(tx, id, input.series);
    return readDetail(tx, id);
  });
  res.status(201).json(quiz);
});

// Reemplaza todas las series y preguntas: más simple que reconciliar altas/bajas/reordenamientos,
// y el historial de partidas no depende de sus ids.
quizzesRouter.put<{ id: string }>('/:id', validateBody(quizInputSchema), async (req, res) => {
  const input = req.body as QuizInput;
  const id = req.params.id;
  const exists = await prisma.quiz.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: 'Trivia no encontrada' });
    return;
  }
  const imageError = await checkImages(input);
  if (imageError) {
    res.status(400).json({ error: imageError });
    return;
  }
  const quiz = await prisma.$transaction(async (tx) => {
    await tx.series.deleteMany({ where: { quizId: id } }); // borra también sus preguntas (cascada)
    await tx.quiz.update({
      where: { id },
      data: { title: input.title, pointsCorrect: input.pointsCorrect, speedBonusMax: input.speedBonusMax },
    });
    await createSeries(tx, id, input.series);
    return readDetail(tx, id);
  });
  res.json(quiz);
  void deleteOrphanImages().catch(console.error);
});

// Renombrar desde la lista, sin reenviar todas las preguntas.
quizzesRouter.patch<{ id: string }>('/:id', validateBody(quizRenameSchema), async (req, res) => {
  const { title } = req.body as { title: string };
  const { count } = await prisma.quiz.updateMany({ where: { id: req.params.id }, data: { title } });
  if (count === 0) {
    res.status(404).json({ error: 'Trivia no encontrada' });
    return;
  }
  res.status(204).end();
});

// Duplicar: copia series, preguntas e imágenes (las imágenes se comparten, nunca cambian).
quizzesRouter.post<{ id: string }>('/:id/duplicate', async (req, res) => {
  const original = await readDetail(prisma, req.params.id);
  if (!original) {
    res.status(404).json({ error: 'Trivia no encontrada' });
    return;
  }
  const copy = await prisma.$transaction(async (tx) => {
    const { id } = await tx.quiz.create({
      data: {
        title: `${original.title} (copia)`.slice(0, 120),
        pointsCorrect: original.pointsCorrect,
        speedBonusMax: original.speedBonusMax,
      },
      select: { id: true },
    });
    await createSeries(
      tx,
      id,
      original.series.map((s) => ({ title: s.title, questions: s.questions.map(({ id: _id, ...q }) => q) })),
    );
    return readDetail(tx, id);
  });
  res.status(201).json(copy);
});

quizzesRouter.delete('/:id', async (req, res) => {
  const { count } = await prisma.quiz.deleteMany({ where: { id: req.params.id } });
  if (count === 0) {
    res.status(404).json({ error: 'Trivia no encontrada' });
    return;
  }
  res.status(204).end();
  void deleteOrphanImages().catch(console.error);
});
