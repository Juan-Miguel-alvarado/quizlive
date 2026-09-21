import { z } from 'zod';

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
export const TIME_LIMITS = [5, 10, 20, 30, 60, 90, 120] as const;
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

export const quizInputSchema = z.object({
  title: z.string().trim().min(1, 'El título no puede estar vacío').max(120),
  questions: z
    .array(questionInputSchema)
    .min(1, 'Agrega al menos una pregunta')
    .max(50, 'Máximo 50 preguntas'),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type QuizInput = z.infer<typeof quizInputSchema>;

// --- Partidas ---

export const pinSchema = z.string().regex(/^\d{6}$/, 'El PIN tiene 6 dígitos');
export const nicknameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, 'Escribe un apodo').max(20, 'Máximo 20 caracteres'));

export const createGameSchema = z.object({ quizId: z.string().min(1) });
export const hostJoinSchema = z.object({ pin: pinSchema, hostToken: z.string().min(1).max(100) });
export const hostKickSchema = z.object({ playerId: z.string().min(1).max(100) });
export const playerJoinSchema = z.object({ pin: pinSchema, nickname: nicknameSchema });
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
export type HostKickPayload = z.infer<typeof hostKickSchema>;
export type PlayerJoinPayload = z.input<typeof playerJoinSchema>;
export type PlayerRejoinPayload = z.infer<typeof playerRejoinSchema>;
export type PlayerAnswerPayload = z.infer<typeof playerAnswerSchema>;
