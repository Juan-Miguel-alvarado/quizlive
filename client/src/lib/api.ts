import type {
  ApiError,
  CreateGameResponse,
  GameHistoryItem,
  GameReport,
  LoginResponse,
  QuizDetail,
  QuizInput,
  QuizSummary,
} from '@quiz/shared';
import { hostSession } from './session';

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
  const token = hostSession.get();
  try {
    res = await fetch(`${SERVER_URL}/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    // En el plan gratis de Render el servidor se duerme; despertarlo tarda cerca de un minuto.
    throw new ApiRequestError(
      'No se pudo conectar con el servidor. Si nadie lo usó en un rato, está despertando: prueba de nuevo en un minuto.',
      0,
    );
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) hostSession.clear(); // sesión vencida: se vuelve a pedir la clave
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
  login: (password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  checkSession: () => request<{ host: boolean }>('/auth/me'),
  listHistory: () => request<GameHistoryItem[]>('/history'),
  getReport: (id: string) => request<GameReport>(`/history/${id}`),
  retryFailed: (id: string) =>
    request<{ id: string; title: string }>(`/history/${id}/retry`, { method: 'POST' }),
};
