import type {
  Avatar,
  PlayerReactPayload,
  QuestionType,
  Reaction,
  HostJoinPayload,
  HostKickPayload,
  PlayerAnswerPayload,
  PlayerJoinPayload,
  PlayerRejoinPayload,
  ScreenJoinPayload,
} from './schemas';

export type GamePhase = 'lobby' | 'countdown' | 'question' | 'reveal' | 'leaderboard' | 'podium';

/** Segundos de "¡Prepárate!" antes de mostrar cada pregunta. */
export const QUESTION_COUNTDOWN_SEC = 3;

/** Serie actual: "Serie 2 de 4 · ¿Quién dijo?". */
export interface SeriesInfo {
  index: number; // desde 0
  total: number;
  title: string;
}

/** Posición de la pregunta dentro de su serie: "Pregunta 3 de 12". */
export interface InSeries {
  index: number; // desde 0
  total: number;
}

export interface CountdownView {
  index: number; // pregunta que viene (global)
  total: number;
  type: QuestionType;
  series: SeriesInfo;
  inSeries: InSeries;
  endsAt: number;
  serverNow: number;
}

/** Tabla al final de una serie; `isLast` = era la última y lo siguiente es el ganador. */
export interface SeriesEndView {
  series: SeriesInfo;
  isLast: boolean;
}

export interface PlayerPublic {
  id: string;
  nickname: string;
  avatar: Avatar;
  connected: boolean;
}

export interface ScoreEntry {
  playerId: string;
  nickname: string;
  avatar: Avatar;
  score: number;
  rank: number;
  /** Aciertos seguidos hasta ahora (para mostrar la racha 🔥 en la clasificación). */
  streak: number;
  /** Puestos que subió (positivo) o bajó (negativo) desde la tabla de la serie anterior. */
  delta: number;
}

/** Pregunta tal como la ven los clientes: nunca incluye la respuesta correcta. */
export interface QuestionView {
  index: number;
  total: number;
  type: QuestionType;
  series: SeriesInfo;
  inSeries: InSeries;
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
  explanation: string | null; // dato o versículo que el anfitrión escribió para esta pregunta
  endsSeries: boolean; // era la última de su serie: lo siguiente es la tabla
}

export interface AnswerResult {
  answered: boolean;
  correct: boolean;
  points: number;
  streak: number; // aciertos seguidos (solo se muestra; no da puntos extra)
  totalScore: number;
  rank: number;
}

export interface PlayerSelf {
  id: string;
  nickname: string;
  avatar: Avatar;
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
  seriesCount: number;
  phase: GamePhase;
  players: PlayerPublic[];
  countdown: CountdownView | null;
  question: QuestionView | null;
  answeredCount: number;
  reveal: RevealView | null;
  leaderboard: ScoreEntry[] | null;
  seriesEnd: SeriesEndView | null; // con la tabla de fin de serie
  podium: ScoreEntry[] | null;
  me: PlayerSelf | null; // null para el anfitrión y la pantalla TV
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
  /** Pantalla TV: solo mira (recibe lo mismo que el anfitrión) y no controla nada. */
  'screen:join': (p: ScreenJoinPayload, ack: Ack<{ state: GameSnapshot }>) => void;
  'player:join': (
    p: PlayerJoinPayload,
    ack: Ack<{ playerId: string; playerToken: string; state: GameSnapshot }>,
  ) => void;
  'player:rejoin': (p: PlayerRejoinPayload, ack: Ack<{ state: GameSnapshot }>) => void;
  'player:answer': (p: PlayerAnswerPayload, ack: Ack) => void;
  'player:react': (p: PlayerReactPayload) => void; // sin ack: puede llegar muy seguido
}

export interface ServerToClientEvents {
  'lobby:players': (p: { players: PlayerPublic[] }) => void;
  'question:countdown': (c: CountdownView) => void;
  'question:start': (q: QuestionView) => void;
  'question:progress': (p: { answered: number; total: number }) => void;
  'question:reveal': (r: RevealView) => void;
  'player:result': (r: AnswerResult) => void;
  'game:leaderboard': (p: { top: ScoreEntry[]; seriesEnd: SeriesEndView }) => void;
  'game:podium': (p: { top: ScoreEntry[]; me: { score: number; rank: number } | null }) => void;
  'game:state': (s: GameSnapshot) => void;
  'game:closed': (p: { reason: string }) => void;
  /** Solo al anfitrión: reacciones acumuladas desde el último envío. */
  'host:reactions': (p: { counts: Partial<Record<Reaction, number>> }) => void;
}

export interface CreateGameResponse {
  pin: string;
  hostToken: string;
}
