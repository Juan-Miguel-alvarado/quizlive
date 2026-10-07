import { z } from 'zod';

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
export const TIME_LIMITS = [5, 10, 15, 20, 30, 60, 90, 120] as const;
export const DEFAULT_TIME_LIMIT = 15;
export const DEFAULT_POINTS_CORRECT = 100;
export const DEFAULT_SPEED_BONUS = 50;
export const MAX_SERIES = 20;
export const MAX_QUESTIONS = 100;
export const TRUE_FALSE_OPTIONS = ['Verdadero', 'Falso'];

export const QUESTION_TYPES = ['single', 'multiple', 'truefalse'] as const;
export const questionTypeSchema = z.enum(QUESTION_TYPES);
export type QuestionType = z.infer<typeof questionTypeSchema>;

// Verdadero/falso siempre tiene las mismas dos opciones, las mande quien las mande
// (se fijan antes de validar para que no haga falta enviarlas).
const withFixedOptions = (value: unknown) =>
  value && typeof value === 'object' && (value as { type?: unknown }).type === 'truefalse'
    ? { ...value, options: [...TRUE_FALSE_OPTIONS] }
    : value;

const questionObjectSchema = z.object({
  type: questionTypeSchema,
  text: z.string().trim().min(1, 'La pregunta no puede estar vacía').max(300),
  imageId: z.string().min(1).max(100).nullable().default(null),
  options: z
    .array(z.string().trim().min(1, 'Completa todas las opciones').max(120))
    .min(MIN_OPTIONS, `Mínimo ${MIN_OPTIONS} opciones`)
    .max(MAX_OPTIONS, `Máximo ${MAX_OPTIONS} opciones`),
  correctIndices: z.array(z.number().int().min(0).max(MAX_OPTIONS - 1)),
  timeLimitSec: z.number().int().min(5).max(120),
  // Se muestra al revelar la respuesta: un dato curioso, una aclaración o un versículo.
  explanation: z
    .string()
    .trim()
    .max(300, 'La explicación tiene como máximo 300 caracteres')
    .nullish()
    .transform((s) => s || null),
});

export const questionInputSchema = z
  .preprocess(withFixedOptions, questionObjectSchema)
  .superRefine((q, ctx) => {
    const correct = new Set(q.correctIndices);
    const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['correctIndices'], message });
    if (correct.size !== q.correctIndices.length) issue('Hay respuestas correctas repetidas');
    if (q.correctIndices.some((i) => i >= q.options.length)) issue('Respuesta correcta fuera de rango');
    if (correct.size === 0) issue('Marca al menos una respuesta correcta');
    else if (q.type !== 'multiple' && correct.size > 1) issue('Este tipo de pregunta tiene una sola respuesta correcta');
  });

// Una serie puede quedar vacía mientras se prepara (al jugar se salta).
export const seriesInputSchema = z.object({
  title: z.string().trim().min(1, 'Ponle nombre a la serie').max(80),
  questions: z.array(questionInputSchema).max(MAX_QUESTIONS),
});

const quizTitleSchema = z.string().trim().min(1, 'El título no puede estar vacío').max(120);

export const quizInputSchema = z
  .object({
    title: quizTitleSchema,
    pointsCorrect: z.number().int().min(10, 'Mínimo 10 puntos').max(1000).default(DEFAULT_POINTS_CORRECT),
    speedBonusMax: z.number().int().min(0).max(500, 'Máximo 500 puntos').default(DEFAULT_SPEED_BONUS),
    series: z.array(seriesInputSchema).min(1, 'Agrega al menos una serie').max(MAX_SERIES, `Máximo ${MAX_SERIES} series`),
  })
  .superRefine((quiz, ctx) => {
    const total = quiz.series.reduce((n, s) => n + s.questions.length, 0);
    if (total === 0) ctx.addIssue({ code: 'custom', path: ['series'], message: 'Agrega al menos una pregunta' });
    if (total > MAX_QUESTIONS) ctx.addIssue({ code: 'custom', path: ['series'], message: `Máximo ${MAX_QUESTIONS} preguntas` });
  });

export const quizRenameSchema = z.object({ title: quizTitleSchema });

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type SeriesInput = z.infer<typeof seriesInputSchema>;
export type QuizInput = z.infer<typeof quizInputSchema>;

// --- Partidas ---

export const pinSchema = z.string().regex(/^\d{6}$/, 'El PIN tiene 6 dígitos');
export const nicknameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, 'Escribe un apodo').max(20, 'Máximo 20 caracteres'));

export const AVATARS = [
  { emoji: '🦁', name: 'León' },
  { emoji: '🐑', name: 'Oveja' },
  { emoji: '🕊️', name: 'Paloma' },
  { emoji: '🐻', name: 'Oso' },
  { emoji: '🐘', name: 'Elefante' },
  { emoji: '🦒', name: 'Jirafa' },
  { emoji: '🐬', name: 'Delfín' },
  { emoji: '🐢', name: 'Tortuga' },
  { emoji: '🦊', name: 'Zorro' },
  { emoji: '🐰', name: 'Conejo' },
  { emoji: '🐼', name: 'Panda' },
  { emoji: '🐯', name: 'Tigre' },
  { emoji: '🦉', name: 'Búho' },
  { emoji: '🐧', name: 'Pingüino' },
  { emoji: '🐳', name: 'Ballena' },
  { emoji: '🦋', name: 'Mariposa' },
  { emoji: '🐝', name: 'Abeja' },
  { emoji: '🐞', name: 'Mariquita' },
  { emoji: '🐿️', name: 'Ardilla' },
  { emoji: '🦜', name: 'Loro' },
  { emoji: '🐴', name: 'Caballo' },
  { emoji: '🐫', name: 'Camello' },
  { emoji: '🐟', name: 'Pez' },
  { emoji: '🦅', name: 'Águila' },
] as const;
export type Avatar = (typeof AVATARS)[number]['emoji'];
export const avatarSchema = z.enum(AVATARS.map((a) => a.emoji) as [Avatar, ...Avatar[]]);

/** Reacciones que los jugadores mandan a la pantalla grande. */
export const REACTIONS = ['👏', '🙌', '🔥', '😂', '❤️', '🙏'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const playerReactSchema = z.object({ emoji: z.enum(REACTIONS) });

export const createGameSchema = z.object({ quizId: z.string().min(1) });
export const hostLoginSchema = z.object({ password: z.string().min(1).max(200) });
export const hostJoinSchema = z.object({ pin: pinSchema, hostToken: z.string().min(1).max(100) });
export const screenJoinSchema = z.object({ pin: pinSchema });
export const hostKickSchema = z.object({ playerId: z.string().min(1).max(100) });
// Opcional: los scripts (bots, e2e, carga) no lo mandan y el servidor elige uno al azar.
export const playerJoinSchema = z.object({ pin: pinSchema, nickname: nicknameSchema, avatar: avatarSchema.optional() });
export const playerRejoinSchema = z.object({ pin: pinSchema, playerToken: z.string().min(1).max(100) });
export const playerAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  choices: z
    .array(z.number().int().min(0).max(MAX_OPTIONS - 1))
    .min(1, 'Elige al menos una opción')
    .max(MAX_OPTIONS)
    .refine((c) => new Set(c).size === c.length, 'Opciones repetidas'),
});

export type HostJoinPayload = z.infer<typeof hostJoinSchema>;
export type ScreenJoinPayload = z.infer<typeof screenJoinSchema>;
export type HostKickPayload = z.infer<typeof hostKickSchema>;
export type PlayerJoinPayload = z.input<typeof playerJoinSchema>;
export type PlayerRejoinPayload = z.infer<typeof playerRejoinSchema>;
export type PlayerAnswerPayload = z.infer<typeof playerAnswerSchema>;
export type PlayerReactPayload = z.infer<typeof playerReactSchema>;
