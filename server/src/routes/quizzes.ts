import { Router } from 'express';
import { quizInputSchema, type QuizDetail, type QuizInput, type QuizSummary } from '@quiz/shared';
import { prisma } from '../lib/prisma';
import { validateBody } from '../lib/validate';
import { deleteOrphanImages } from './images';

export const quizzesRouter = Router();

const questionsInclude = {
  questions: {
    orderBy: { order: 'asc' },
    select: {
      id: true,
      type: true,
      text: true,
      imageId: true,
      options: true,
      correctIndices: true,
      timeLimitSec: true,
      explanation: true,
    },
  },
} as const;

function toQuestionRows(questions: QuizInput['questions']) {
  return questions.map((q, order) => ({ ...q, order }));
}

/** Devuelve un mensaje de error si alguna pregunta apunta a una imagen que no existe. */
async function checkImages(input: QuizInput): Promise<string | null> {
  const ids = [...new Set(input.questions.map((q) => q.imageId).filter((id): id is string => id !== null))];
  if (ids.length === 0) return null;
  const found = await prisma.image.count({ where: { id: { in: ids } } });
  return found === ids.length ? null : 'Alguna imagen ya no existe; vuelve a subirla';
}

quizzesRouter.get('/', async (_req, res) => {
  const quizzes = await prisma.quiz.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, updatedAt: true, _count: { select: { questions: true } } },
  });
  res.json(
    quizzes.map<QuizSummary>((q) => ({
      id: q.id,
      title: q.title,
      questionCount: q._count.questions,
      updatedAt: q.updatedAt.toISOString(),
    })),
  );
});

quizzesRouter.get('/:id', async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.id },
    select: { id: true, title: true, ...questionsInclude },
  });
  if (!quiz) {
    res.status(404).json({ error: 'Quiz no encontrado' });
    return;
  }
  res.json(quiz satisfies QuizDetail);
});

quizzesRouter.post('/', validateBody(quizInputSchema), async (req, res) => {
  const input = req.body as QuizInput;
  const imageError = await checkImages(input);
  if (imageError) {
    res.status(400).json({ error: imageError });
    return;
  }
  const quiz = await prisma.quiz.create({
    data: { title: input.title, questions: { create: toQuestionRows(input.questions) } },
    select: { id: true, title: true, ...questionsInclude },
  });
  res.status(201).json(quiz satisfies QuizDetail);
});

// Reemplaza todas las preguntas: más simple que reconciliar altas/bajas/reordenamientos,
// y el historial de partidas no depende de los ids de Question.
quizzesRouter.put<{ id: string }>('/:id', validateBody(quizInputSchema), async (req, res) => {
  const input = req.body as QuizInput;
  const id = req.params.id;
  const exists = await prisma.quiz.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: 'Quiz no encontrado' });
    return;
  }
  const imageError = await checkImages(input);
  if (imageError) {
    res.status(400).json({ error: imageError });
    return;
  }
  const quiz = await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { quizId: id } });
    return tx.quiz.update({
      where: { id },
      data: { title: input.title, questions: { create: toQuestionRows(input.questions) } },
      select: { id: true, title: true, ...questionsInclude },
    });
  });
  res.json(quiz satisfies QuizDetail);
  void deleteOrphanImages().catch(console.error);
});

quizzesRouter.delete('/:id', async (req, res) => {
  const { count } = await prisma.quiz.deleteMany({ where: { id: req.params.id } });
  if (count === 0) {
    res.status(404).json({ error: 'Quiz no encontrado' });
    return;
  }
  res.status(204).end();
  void deleteOrphanImages().catch(console.error);
});
