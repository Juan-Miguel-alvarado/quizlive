import { describe, expect, it } from 'vitest';
import { computePoints, rankPlayers, streakBonus } from './scoring';

describe('puntaje', () => {
  it('da 1000 al instante, 500 al límite y 0 si falla', () => {
    expect(computePoints(true, 0, 10_000)).toBe(1000);
    expect(computePoints(true, 5_000, 10_000)).toBe(750);
    expect(computePoints(true, 10_000, 10_000)).toBe(500);
    expect(computePoints(false, 0, 10_000)).toBe(0);
  });

  it('no se pasa de rango con tiempos raros', () => {
    expect(computePoints(true, -50, 10_000)).toBe(1000);
    expect(computePoints(true, 99_000, 10_000)).toBe(500);
  });

  it('la racha suma 100 por acierto seguido hasta 500', () => {
    expect(streakBonus(1)).toBe(0);
    expect(streakBonus(2)).toBe(100);
    expect(streakBonus(6)).toBe(500);
    expect(streakBonus(20)).toBe(500);
  });
});

describe('ranking', () => {
  it('ordena por puntaje y los empates comparten puesto', () => {
    const ranked = rankPlayers([
      { nickname: 'Ana', score: 100 },
      { nickname: 'Beto', score: 300 },
      { nickname: 'Caro', score: 100 },
      { nickname: 'Dani', score: 50 },
    ]);
    expect(ranked.map((r) => [r.player.nickname, r.rank])).toEqual([
      ['Beto', 1],
      ['Ana', 2],
      ['Caro', 2],
      ['Dani', 4],
    ]);
  });
});
