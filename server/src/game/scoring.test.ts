import { describe, expect, it } from 'vitest';
import { computePoints, rankPlayers } from './scoring';

describe('puntaje', () => {
  it('acierto: 100 fijos + hasta 50 de bono según la rapidez; error: 0', () => {
    expect(computePoints(true, 0, 10_000)).toBe(150);
    expect(computePoints(true, 5_000, 10_000)).toBe(125);
    expect(computePoints(true, 10_000, 10_000)).toBe(100);
    expect(computePoints(false, 0, 10_000)).toBe(0);
  });

  it('respeta los valores configurados en la trivia', () => {
    expect(computePoints(true, 0, 10_000, { base: 200, bonus: 0 })).toBe(200);
    expect(computePoints(true, 2_500, 10_000, { base: 10, bonus: 100 })).toBe(85);
  });

  it('no se pasa de rango con tiempos raros', () => {
    expect(computePoints(true, -50, 10_000)).toBe(150);
    expect(computePoints(true, 99_000, 10_000)).toBe(100);
  });
});

describe('ranking', () => {
  it('ordena por puntaje y desempata por menos tiempo total', () => {
    const ranked = rankPlayers([
      { nickname: 'Ana', score: 250, totalMs: 9_000 },
      { nickname: 'Beto', score: 300, totalMs: 20_000 },
      { nickname: 'Caro', score: 250, totalMs: 4_000 },
      { nickname: 'Dani', score: 50, totalMs: 1_000 },
    ]);
    expect(ranked.map((r) => [r.player.nickname, r.rank])).toEqual([
      ['Beto', 1],
      ['Caro', 2], // mismo puntaje que Ana, pero tardó menos
      ['Ana', 3],
      ['Dani', 4],
    ]);
  });

  it('solo comparten puesto si empatan en puntos y en tiempo', () => {
    const ranked = rankPlayers([
      { nickname: 'Ana', score: 100, totalMs: 5_000 },
      { nickname: 'Beto', score: 100, totalMs: 5_000 },
      { nickname: 'Caro', score: 90, totalMs: 1_000 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});
