import type { QuestionInput, QuizInput } from './schemas';

export interface QuizSummary {
  id: string;
  title: string;
  seriesCount: number;
  questionCount: number;
  updatedAt: string;
}

export interface QuizDetail extends Pick<QuizInput, 'title' | 'pointsCorrect' | 'speedBonusMax'> {
  id: string;
  series: { id: string; title: string; questions: (QuestionInput & { id: string })[] }[];
}

export interface LoginResponse {
  token: string;
}

/** Resumen de una partida terminada (para el historial). */
export interface GameHistoryItem {
  id: string;
  quizId: string | null;
  quizTitle: string;
  pin: string;
  startedAt: string;
  finishedAt: string;
  playerCount: number;
  questionCount: number;
  averageCorrectRatio: number; // 0..1
}

export interface QuestionReport {
  order: number;
  text: string;
  answered: number;
  correct: number; // cuántos acertaron
  correctRatio: number; // 0..1
  averageResponseMs: number | null;
}

export interface PlayerReport {
  nickname: string;
  rank: number;
  score: number;
  correct: number;
  answered: number;
}

export interface GameReport extends GameHistoryItem {
  questions: QuestionReport[];
  players: PlayerReport[];
  /** Solo si el quiz original sigue existiendo: se puede crear un repaso con las falladas. */
  canRetry: boolean;
}

export interface UploadImageResponse {
  id: string;
}

export interface ApiError {
  error: string;
  issues?: { path: string; message: string }[];
}
