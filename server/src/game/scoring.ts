export const MAX_POINTS = 1000;
export const STREAK_BONUS = 100; // por cada acierto seguido a partir del segundo
export const MAX_STREAK_BONUS = 500;

/** Bonus por aciertos seguidos: 2 seguidos = +100, 3 = +200… hasta +500. */
export function streakBonus(streak: number): number {
  return Math.min(MAX_STREAK_BONUS, Math.max(0, streak - 1) * STREAK_BONUS);
}

/** Acierto inmediato = 1000 pts; acierto en el último instante = 500 pts; error = 0. */
export function computePoints(correct: boolean, responseMs: number, timeLimitMs: number): number {
  if (!correct) return 0;
  const ratio = Math.min(Math.max(responseMs / timeLimitMs, 0), 1);
  return Math.round(MAX_POINTS * (1 - ratio / 2));
}

/** Ranking de competición: empates comparten puesto (1, 1, 3…). */
export function rankPlayers<T extends { score: number; nickname: string }>(players: T[]) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  let prevScore = Number.NaN;
  let prevRank = 0;
  return sorted.map((p, i) => {
    const rank = p.score === prevScore ? prevRank : i + 1;
    prevScore = p.score;
    prevRank = rank;
    return { player: p, rank };
  });
}
