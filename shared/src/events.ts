import type {
  QuestionType,
  HostJoinPayload,
  HostKickPayload,
  PlayerAnswerPayload,
  PlayerJoinPayload,
  PlayerRejoinPayload,
} from './schemas';

export type GamePhase = 'lobby' | 'countdown' | 'question' | 'reveal' | 'leaderboard' | 'podium';

/** Segundos de "¡Prepárate!" antes de mostrar cada pregunta. */
export const QUESTION_COUNTDOWN_SEC = 5;

export interface CountdownView {
  index: number; // pregunta que viene
  total: number;
  type: QuestionType;
  endsAt: number;
  serverNow: number;
}

export interface PlayerPublic {
  id: string;
  nickname: string;
  connected: boolean;
}

export interface ScoreEntry {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
  /** Puestos que subió (positivo) o bajó (negativo) desde la pregunta anterior. */
  delta: number;
}

/** Pregunta tal como la ven los clientes: nunca incluye la respuesta correcta. */
export interface QuestionView {
  index: number;
  total: number;
  type: QuestionType;
  text: string;
  imageId: string | null;
  options: string[];
  timeLimitSec: number;
  endsAt: number; // epoch ms del servidor
  serverNow: number; // epoch ms del servidor al emitir, para calcular el desfase de reloj
}

export interface RevealView {
  index: number;
  correctIndices: number[];
  distribution: number[]; // cuántos marcaron cada opción
}

export interface AnswerResult {
  answered: boolean;
  correct: boolean;
  points: number;
  streak: number; // aciertos seguidos
  streakBonus: number; // parte de `points` que vino por la racha
  totalScore: number;
  rank: number;
}

export interface PlayerSelf {
  id: string;
  nickname: string;
  score: number;
  rank: number;
  answer: number[] | null; // opciones elegidas en la pregunta actual
  lastResult: AnswerResult | null;
}

/** Foto completa del estado, para entrar o reconectarse en cualquier fase. */
export interface GameSnapshot {
  pin: string;
  quizTitle: string;
  totalQuestions: number;
  phase: GamePhase;
  players: PlayerPublic[];
  countdown: CountdownView | null;
  question: QuestionView | null;
  answeredCount: number;
  reveal: RevealView | null;
  leaderboard: ScoreEntry[] | null;
  podium: ScoreEntry[] | null;
  me: PlayerSelf | null; // null para el anfitrión
}

export type AckResponse<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Ack<T = object> = (res: AckResponse<T>) => void;

export interface ClientToServerEvents {
  'host:join': (p: HostJoinPayload, ack: Ack<{ state: GameSnapshot }>) => void;
  'host:start': (ack: Ack) => void;
  'host:next': (ack: Ack) => void;
  'host:kick': (p: HostKickPayload, ack: Ack) => void;
  'host:playAgain': (ack: Ack) => void; // reinicia la misma partida con los mismos jugadores
  'host:end': (ack: Ack) => void;
  'player:join': (
    p: PlayerJoinPayload,
    ack: Ack<{ playerId: string; playerToken: string; state: GameSnapshot }>,
  ) => void;
  'player:rejoin': (p: PlayerRejoinPayload, ack: Ack<{ state: GameSnapshot }>) => void;
  'player:answer': (p: PlayerAnswerPayload, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'lobby:players': (p: { players: PlayerPublic[] }) => void;
  'question:countdown': (c: CountdownView) => void;
  'question:start': (q: QuestionView) => void;
  'question:progress': (p: { answered: number; total: number }) => void;
  'question:reveal': (r: RevealView) => void;
  'player:result': (r: AnswerResult) => void;
  'game:leaderboard': (p: { top: ScoreEntry[] }) => void;
  'game:podium': (p: { top: ScoreEntry[]; me: { score: number; rank: number } | null }) => void;
  'game:state': (s: GameSnapshot) => void;
  'game:closed': (p: { reason: string }) => void;
}

export interface CreateGameResponse {
  pin: string;
  hostToken: string;
}
