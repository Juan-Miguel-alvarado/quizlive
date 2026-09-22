import { beforeEach, describe, expect, it, vi } from 'vitest';

// La partida solo toca la base de datos al terminar, y eso aquí no se prueba.
vi.mock('../lib/prisma', () => ({ prisma: { quiz: { count: vi.fn(async () => 1) }, game: { create: vi.fn(async () => ({})) } } }));

const { Game, GameError } = await import('./Game');
const { streakBonus } = await import('./scoring');
type GameType = InstanceType<typeof Game>;

interface Emitted {
  target: string;
  event: string;
  payload: unknown;
}

/** io y sockets falsos: guardan lo emitido para poder revisarlo. */
function fakeIo() {
  const emitted: Emitted[] = [];
  const sockets = new Map<string, FakeSocket>();
  const io = {
    to: (target: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ target, event, payload }) }),
    in: () => ({ socketsLeave: () => {} }),
    sockets: { sockets },
  };
  return { io: io as never, emitted, sockets };
}

class FakeSocket {
  data: Record<string, unknown> = {};
  rooms: string[] = [];
  constructor(public id: string) {}
  join(room: string | string[]) {
    this.rooms.push(...[room].flat());
  }
  leave(room: string) {
    this.rooms = this.rooms.filter((r) => r !== room);
  }
  emit() {}
}

const quiz = {
  id: 'quiz1',
  title: 'Prueba',
  questions: [
    { type: 'single' as const, text: 'P1', imageId: null, options: ['a', 'b'], correctIndices: [0], timeLimitSec: 10 },
    { type: 'single' as const, text: 'P2', imageId: null, options: ['a', 'b'], correctIndices: [1], timeLimitSec: 10 },
    { type: 'multiple' as const, text: 'P3', imageId: null, options: ['a', 'b', 'c'], correctIndices: [0, 2], timeLimitSec: 10 },
  ],
};

describe('Game', () => {
  let io: ReturnType<typeof fakeIo>;
  let game: GameType;
  let host: FakeSocket;

  const addPlayer = (nickname: string) => {
    const socket = new FakeSocket(`s-${nickname}`);
    io.sockets.set(socket.id, socket);
    const { playerId } = game.addPlayer(socket as never, nickname);
    return { socket, playerId };
  };
  const startQuestion = () => {
    game.next(); // lobby → cuenta regresiva
    vi.advanceTimersByTime(5000); // termina la cuenta regresiva
  };
  const lastEvent = (event: string) => [...io.emitted].reverse().find((e) => e.event === event)?.payload as never;

  beforeEach(() => {
    vi.useFakeTimers();
    io = fakeIo();
    game = new Game('123456', quiz, io.io, () => {});
    host = new FakeSocket('host');
    io.sockets.set(host.id, host);
    game.attachHost(host as never, game.hostToken);
  });

  it('no deja dirigir la partida sin el token correcto', () => {
    expect(() => game.attachHost(new FakeSocket('otro') as never, 'falso')).toThrow(GameError);
  });

  it('no empieza sin jugadores', () => {
    expect(() => game.start()).toThrow(/al menos un jugador/);
  });

  it('rechaza apodos repetidos sin importar mayúsculas', () => {
    addPlayer('Ana');
    expect(() => addPlayer('ANA')).toThrow(/ya está en uso/);
  });

  it('da más puntos a quien responde antes y ninguno a quien falla', () => {
    const ana = addPlayer('Ana');
    const beto = addPlayer('Beto');
    startQuestion();

    game.answer(ana.playerId, 0, [0]); // acierta al instante
    vi.advanceTimersByTime(5000);
    game.answer(beto.playerId, 0, [1]); // falla
    vi.advanceTimersByTime(5000); // se acaba el tiempo

    const ranking = game.snapshot(null);
    expect(ranking.phase).toBe('reveal');
    expect(lastEvent('question:reveal')).toMatchObject({ correctIndices: [0], distribution: [1, 1] });
    const resultados = io.emitted.filter((e) => e.event === 'player:result').map((e) => e.payload as { points: number });
    expect(resultados[0]!.points).toBe(1000);
    expect(resultados[1]!.points).toBe(0);
  });

  it('suma bonus por racha al segundo acierto seguido', () => {
    const ana = addPlayer('Ana');
    startQuestion();
    game.answer(ana.playerId, 0, [0]);
    vi.advanceTimersByTime(10000); // cierra la pregunta 1

    game.next(); // reveal → ranking
    startQuestion(); // ranking → pregunta 2
    game.answer(ana.playerId, 1, [1]);
    vi.advanceTimersByTime(10000);

    const result = lastEvent('player:result') as { streak: number; streakBonus: number; points: number };
    expect(result.streak).toBe(2);
    expect(result.streakBonus).toBe(streakBonus(2));
    expect(result.points).toBe(1000 + streakBonus(2));
  });

  it('en selección múltiple solo acierta quien marca exactamente las correctas', () => {
    const ana = addPlayer('Ana');
    const beto = addPlayer('Beto');
    game.start();
    vi.advanceTimersByTime(5000);
    for (const i of [0, 1]) {
      // avanza hasta la pregunta 3 (selección múltiple)
      vi.advanceTimersByTime(10000);
      game.next();
      if (i === 0) startQuestion();
      else {
        game.next();
        vi.advanceTimersByTime(5000);
      }
    }
    game.answer(ana.playerId, 2, [2, 0]); // las dos correctas, en otro orden
    game.answer(beto.playerId, 2, [0]); // solo una
    vi.advanceTimersByTime(10000);

    const resultados = io.emitted.filter((e) => e.event === 'player:result').map((e) => e.payload as { correct: boolean });
    expect(resultados.at(-2)!.correct).toBe(true);
    expect(resultados.at(-1)!.correct).toBe(false);
  });

  it('no acepta dos respuestas del mismo jugador ni fuera de tiempo', () => {
    const ana = addPlayer('Ana');
    addPlayer('Beto'); // si Ana fuera la única, su respuesta cerraría la pregunta
    startQuestion();
    game.answer(ana.playerId, 0, [0]);
    expect(() => game.answer(ana.playerId, 0, [1])).toThrow(/Ya respondiste/);
    vi.advanceTimersByTime(10000);
    expect(() => game.answer(ana.playerId, 0, [1])).toThrow(/tiempo/);
  });

  it('cierra la pregunta apenas responden todos', () => {
    const ana = addPlayer('Ana');
    const beto = addPlayer('Beto');
    startQuestion();
    game.answer(ana.playerId, 0, [0]);
    expect(game.phase).toBe('question');
    game.answer(beto.playerId, 0, [0]);
    expect(game.phase).toBe('reveal'); // sin esperar los 10 segundos
  });

  it('conserva al jugador y su puntaje al desconectarse', () => {
    const ana = addPlayer('Ana');
    startQuestion();
    game.answer(ana.playerId, 0, [0]);
    vi.advanceTimersByTime(10000);

    game.detachPlayer(ana.playerId, ana.socket.id);
    const nuevo = new FakeSocket('s-Ana-2');
    io.sockets.set(nuevo.id, nuevo);
    const state = game.rejoinPlayer(nuevo as never, (game.snapshot(null) as never) && tokenOf(game, 'Ana'));
    expect(state.me?.score).toBe(1000);
  });

  it('vuelve a empezar con los mismos jugadores y el puntaje en cero', () => {
    const ana = addPlayer('Ana');
    game.start();
    vi.advanceTimersByTime(5000);
    game.answer(ana.playerId, 0, [0]);
    vi.advanceTimersByTime(10000);
    game.end(); // termina la partida → podio

    expect(game.phase).toBe('podium');
    game.playAgain();
    expect(game.phase).toBe('lobby');
    const state = game.snapshot(null);
    expect(state.players).toHaveLength(1);
    expect(lastEvent('game:state')).toMatchObject({ phase: 'lobby' });
  });
});

/** El token del jugador es privado; en el test se recupera del estado interno. */
function tokenOf(game: InstanceType<typeof Game>, nickname: string): string {
  const players = (game as unknown as { players: Map<string, { nickname: string; token: string }> }).players;
  return [...players.values()].find((p) => p.nickname === nickname)!.token;
}
