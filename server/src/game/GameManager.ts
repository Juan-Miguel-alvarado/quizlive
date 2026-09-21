import { randomInt } from 'node:crypto';
import type { TypedServer } from '../socket/types';
import { Game, type GameQuiz } from './Game';

export class GameManager {
  private games = new Map<string, Game>();

  constructor(private readonly io: TypedServer) {}

  create(quiz: GameQuiz): Game {
    let pin: string;
    do pin = String(randomInt(100_000, 1_000_000));
    while (this.games.has(pin));
    const game = new Game(pin, quiz, this.io, (g) => this.games.delete(g.pin));
    this.games.set(pin, game);
    return game;
  }

  get(pin: string | undefined): Game | undefined {
    return pin ? this.games.get(pin) : undefined;
  }
}
