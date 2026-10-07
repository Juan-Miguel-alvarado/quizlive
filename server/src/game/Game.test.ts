import { beforeEach, describe, expect, it, vi } from 'vitest';

// La partida solo toca la base de datos al terminar, y eso aquí no se prueba.
vi.mock('../lib/prisma', () => ({ prisma: { quiz: { count: vi.fn(async () => 1) }, game: { create: vi.fn(async () => ({})) } } }));

const { Game, GameError } = await import('./Game');
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

// Dos series: "Génesis" (P1, P2) y "¿Quién dijo?" (P3, selección múltiple).
const quiz = {
  id: 'quiz1',
  title: 'Prueba',
  scoring: { base: 100, bonus: 50 },
  series: [{ title: 'Génesis' }, { title: '¿Quién dijo?' }],
  questions: [
    { seriesIndex: 0, type: 'single' as const, text: 'P1', imageId: null, options: ['a', 'b'], correctIndices: [0], timeLimitSec: 10, explanation: 'Génesis 1:1' },
    { seriesIndex: 0, type: 'single' as const, text: 'P2', imageId: null, options: ['a', 'b'], correctIndices: [1], timeLimitSec: 10, explanation: null },
    { seriesIndex: 1, type: 'multiple' as const, text: 'P3', imageId: null, options: ['a', 'b', 'c'], correctIndices: [0, 2], timeLimitSec: 10, explanation: null },
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

  it('numera los apodos repetidos sin importar mayúsculas en vez de rechazarlos', () => {
    addPlayer('Ana');
    addPlayer('ANA');
    addPlayer('ana');
    const largo = 'Hipopótamo Brillante'; // 20 caracteres: el sufijo no debe pasarse del máximo
    addPlayer(largo);
    addPlayer(largo);
    const nombres = game.snapshot(null).players.map((p) => p.nickname);
    expect(nombres).toEqual(['Ana', 'ANA 2', 'ana 3', largo, 'Hipopótamo Brillan 2']);
    expect(nombres.every((n) => n.length <= 20)).toBe(true);
  });

  it('asigna un avatar si el jugador no elige ninguno', () => {
    addPlayer('Ana');
    const socket = new FakeSocket('s-Beto');
    game.addPlayer(socket as never, 'Beto', '🦁');
    const [ana, beto] = game.snapshot(null).players;
    expect(ana!.avatar).toBeTruthy();
    expect(beto!.avatar).toBe('🦁');
  });

  it('agrupa las reacciones hacia el anfitrión e ignora las demasiado seguidas', () => {
    const ana = addPlayer('Ana');
    const beto = addPlayer('Beto');
    game.react(ana.playerId, '👏');
    game.react(ana.playerId, '👏'); // muy seguida: se ignora
    game.react(beto.playerId, '👏');
    game.react('no-existe', '🔥');
    vi.advanceTimersByTime(200);
    const reacciones = io.emitted.filter((e) => e.event === 'host:reactions');
    expect(reacciones).toHaveLength(1);
    expect(reacciones[0]).toMatchObject({ target: 'game:123456:host', payload: { counts: { '👏': 2 } } });

    vi.advanceTimersByTime(1500);
    game.react(ana.playerId, '🙏'); // pasó el tiempo de espera
    vi.advanceTimersByTime(200);
    expect(lastEvent('host:reactions')).toEqual({ counts: { '🙏': 1 } });

    startQuestion();
    vi.advanceTimersByTime(1500);
    game.react(beto.playerId, '🔥'); // durante la pregunta no se aceptan
    vi.advanceTimersByTime(200);
    expect(io.emitted.filter((e) => e.event === 'host:reactions')).toHaveLength(2);
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
    expect(lastEvent('question:reveal')).toMatchObject({
      correctIndices: [0],
      distribution: [1, 1],
      explanation: 'Génesis 1:1',
    });
    const resultados = io.emitted.filter((e) => e.event === 'player:result').map((e) => e.payload as { points: number });
    expect(resultados[0]!.points).toBe(150); // 100 fijos + 50 por responder al instante
    expect(resultados[1]!.points).toBe(0);
  });

  it('la racha se cuenta pero no da puntos extra', () => {
    const ana = addPlayer('Ana');
    startQuestion();
    game.answer(ana.playerId, 0, [0]);
    game.next(); // revelación → cuenta regresiva de la pregunta 2 (misma serie: sin tabla)
    vi.advanceTimersByTime(5000);
    game.answer(ana.playerId, 1, [1]);

    const result = lastEvent('player:result') as { streak: number; points: number; totalScore: number };
    expect(result.streak).toBe(2);
    expect(result.points).toBe(150);
    expect(result.totalScore).toBe(300);
  });

  it('muestra la tabla solo al terminar cada serie y el ganador al final', () => {
    const ana = addPlayer('Ana');
    game.start();
    vi.advanceTimersByTime(5000);
    expect(lastEvent('question:start')).toMatchObject({ series: { index: 0, total: 2, title: 'Génesis' }, inSeries: { index: 0, total: 2 } });
    game.answer(ana.playerId, 0, [0]);
    expect(lastEvent('question:reveal')).toMatchObject({ endsSeries: false });

    game.next(); // P1 no termina la serie: va directo a la cuenta de P2
    expect(game.phase).toBe('countdown');
    vi.advanceTimersByTime(5000);
    game.answer(ana.playerId, 1, [1]);
    expect(lastEvent('question:reveal')).toMatchObject({ endsSeries: true });

    game.next(); // fin de "Génesis": tabla
    expect(game.phase).toBe('leaderboard');
    expect(lastEvent('game:leaderboard')).toMatchObject({
      top: [{ nickname: 'Ana', score: 300 }],
      seriesEnd: { series: { index: 0, title: 'Génesis' }, isLast: false },
    });
    expect(game.snapshot(null).seriesEnd).toMatchObject({ isLast: false });

    game.next(); // "Iniciar Serie 2"
    expect(lastEvent('question:countdown')).toMatchObject({ series: { index: 1, title: '¿Quién dijo?' }, inSeries: { index: 0, total: 1 } });
    vi.advanceTimersByTime(5000);
    game.answer(ana.playerId, 2, [0, 2]);
    game.next(); // última de la última serie: tabla final
    expect(lastEvent('game:leaderboard')).toMatchObject({ seriesEnd: { isLast: true } });
    game.next(); // "Ver ganador"
    expect(game.phase).toBe('podium');
    expect(lastEvent('game:podium')).toMatchObject({ top: [{ nickname: 'Ana' }] });
  });

  it('la pantalla TV recibe lo del anfitrión pero no puede dirigir', () => {
    addPlayer('Ana');
    const tv = new FakeSocket('tv');
    const state = game.attachScreen(tv as never);
    expect(state.players).toHaveLength(1);
    expect(tv.rooms).toEqual(['game:123456', 'game:123456:host']);
    expect(game.isHost(tv.id)).toBe(false);
    expect(game.isHost(host.id)).toBe(true); // la TV no desplaza al moderador
  });

  it('quien entra tarde empieza con 0 y las preguntas perdidas no suman', () => {
    const ana = addPlayer('Ana');
    startQuestion();
    game.answer(ana.playerId, 0, [0]);
    const caro = addPlayer('Caro'); // entra en la revelación de P1
    game.next();
    vi.advanceTimersByTime(5000);
    game.answer(ana.playerId, 1, [1]);
    game.answer(caro.playerId, 1, [1]);
    const ranking = game.snapshot(null);
    expect(ranking.phase).toBe('reveal');
    const scores = Object.fromEntries(
      io.emitted
        .filter((e) => e.event === 'player:result' && e.target === caro.socket.id)
        .map((e) => [e.target, (e.payload as { totalScore: number }).totalScore]),
    );
    expect(scores[caro.socket.id]).toBe(150);
  });

  it('en selección múltiple solo acierta quien marca exactamente las correctas', () => {
    const ana = addPlayer('Ana');
    const beto = addPlayer('Beto');
    startQuestion(); // P1
    vi.advanceTimersByTime(10000);
    game.next(); // → cuenta de P2
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(10000);
    game.next(); // fin de serie → tabla
    game.next(); // → cuenta de P3
    vi.advanceTimersByTime(5000);
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
    expect(state.me?.score).toBe(150);
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
