export interface ScoringRules {
  /** Puntos fijos por acertar. */
  base: number;
  /** Bono máximo por rapidez: completo si responde al instante, 0 en el último instante. */
  bonus: number;
}

export const DEFAULT_SCORING: ScoringRules = { base: 100, bonus: 50 };

/** Acierto = puntos fijos + bono lineal según la rapidez; error o sin responder = 0. */
export function computePoints(correct: boolean, responseMs: number, timeLimitMs: number, rules = DEFAULT_SCORING): number {
  if (!correct) return 0;
  const ratio = Math.min(Math.max(responseMs / timeLimitMs, 0), 1);
  return rules.base + Math.round(rules.bonus * (1 - ratio));
}

/**
 * Ranking de competición: más puntos primero y, si empatan, quien tardó menos en total. Solo
 * comparten puesto si empatan en las dos cosas (1, 1, 3…).
 */
export function rankPlayers<T extends { score: number; totalMs: number; nickname: string }>(players: T[]) {
  const sorted = [...players].sort(
    (a, b) => b.score - a.score || a.totalMs - b.totalMs || a.nickname.localeCompare(b.nickname),
  );
  let prev: T | null = null;
  let prevRank = 0;
  return sorted.map((p, i) => {
    const rank = prev && p.score === prev.score && p.totalMs === prev.totalMs ? prevRank : i + 1;
    prev = p;
    prevRank = rank;
    return { player: p, rank };
  });
}
