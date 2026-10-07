import type { Avatar } from '@quiz/shared';

// localStorage puede fallar (modo privado, almacenamiento bloqueado): nunca debe romper la app.
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin persistencia: la reconexión tras recargar no funcionará, pero el juego sí */
  }
}

export interface PlayerSession {
  pin: string;
  playerToken: string;
  nickname: string;
}

export const playerSession = {
  get: () => read<PlayerSession>('quizlive:player'),
  set: (s: PlayerSession) => write('quizlive:player', s),
  clear: () => write('quizlive:player', null),
};

/** Apodo y avatar de la última partida: la próxima vez se entra con un solo toque. */
export interface PlayerProfile {
  nickname: string;
  avatar: Avatar;
}

export const playerProfile = {
  get: () => read<PlayerProfile>('quizlive:profile'),
  set: (p: PlayerProfile) => write('quizlive:profile', p),
};

export const hostSession = {
  get: () => read<string>('quizlive:session'),
  set: (token: string) => write('quizlive:session', token),
  clear: () => write('quizlive:session', null),
};

export const hostTokens = {
  get: (pin: string) => read<string>(`quizlive:host:${pin}`),
  set: (pin: string, token: string) => write(`quizlive:host:${pin}`, token),
};
