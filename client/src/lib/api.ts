import type { ApiError, CreateGameResponse, QuizDetail, QuizInput, QuizSummary } from '@quiz/shared';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues: ApiError['issues'] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiRequestError('No se pudo conectar con el servidor', 0);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body as Partial<ApiError>;
    throw new ApiRequestError(err.error ?? `Error ${res.status}`, res.status, err.issues);
  }
  return body as T;
}

export const api = {
  listQuizzes: () => request<QuizSummary[]>('/quizzes'),
  getQuiz: (id: string) => request<QuizDetail>(`/quizzes/${id}`),
  createQuiz: (input: QuizInput) =>
    request<QuizDetail>('/quizzes', { method: 'POST', body: JSON.stringify(input) }),
  updateQuiz: (id: string, input: QuizInput) =>
    request<QuizDetail>(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteQuiz: (id: string) => request<void>(`/quizzes/${id}`, { method: 'DELETE' }),
  createGame: (quizId: string) =>
    request<CreateGameResponse>('/games', { method: 'POST', body: JSON.stringify({ quizId }) }),
  getGame: (pin: string) => request<{ pin: string; quizTitle: string }>(`/games/${pin}`),
};
