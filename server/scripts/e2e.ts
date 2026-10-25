/**
 * Prueba de humo de una partida completa contra un servidor en marcha (pnpm dev).
 * Uso: pnpm --filter server test:e2e
 */
import { QUESTION_COUNTDOWN_SEC, type ClientToServerEvents, type GameSnapshot, type ServerToClientEvents } from '@quiz/shared';
import { io, type Socket } from 'socket.io-client';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const URL = process.env.SERVER_URL ?? 'http://localhost:3001';

let failures = 0;
function check(cond: unknown, msg: string) {
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
  if (!cond) failures++;
}
const connect = () =>
  new Promise<ClientSocket>((resolve) => {
    const s: ClientSocket = io(URL, { transports: ['websocket'], forceNew: true });
    s.on('connect', () => resolve(s));
  });
const once = <E extends keyof ServerToClientEvents>(s: ClientSocket, event: E, timeoutMs = 8000) =>
  new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout esperando ${event}`)), timeoutMs);
    (s as Socket).once(event as string, (data: any) => {
      clearTimeout(t);
      resolve(data);
    });
  });
const emit = (s: ClientSocket, event: string, ...args: unknown[]) =>
  new Promise<any>((resolve) => (s as Socket).emit(event, ...args, resolve));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Las rutas del anfitrión piden clave. */
async function hostHeaders() {
  const res = await fetch(`${URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: process.env.HOST_PASSWORD ?? 'anfitrion' }),
  });
  if (!res.ok) throw new Error(`No se pudo iniciar sesión como anfitrión (${res.status})`);
  const { token } = (await res.json()) as { token: string };
  return { 'content-type': 'application/json', authorization: `Bearer ${token}` };
}

async function main() {
  const auth = await hostHeaders();
  const quiz = await fetch(`${URL}/api/quizzes`, {
    method: 'POST',
    headers: auth,
    // Serie 1 (P1, P2), una serie vacía (se salta al jugar) y Serie 2 (P3).
    body: JSON.stringify({
      title: 'E2E',
      series: [
        {
          title: 'Serie uno',
          questions: [
            { type: 'single', text: 'P1', options: ['a', 'b', 'c', 'd'], correctIndices: [1], timeLimitSec: 5 },
            { type: 'multiple', text: 'P2', options: ['a', 'b', 'c'], correctIndices: [0, 2], timeLimitSec: 5 },
          ],
        },
        { title: 'Todavía vacía', questions: [] },
        { title: 'Serie dos', questions: [{ type: 'truefalse', text: 'P3', options: ['x', 'y'], correctIndices: [0], timeLimitSec: 5 }] },
      ],
    }),
  }).then((r) => r.json());
  const bad = await fetch(`${URL}/api/quizzes`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      title: 'Malo',
      series: [{ title: 'S', questions: [{ type: 'single', text: 'x', options: ['a', 'b'], correctIndices: [0, 1], timeLimitSec: 5 }] }],
    }),
  });
  check(bad.status === 400, 'opción única con dos correctas rechazada al guardar');
  check(quiz.series?.length === 3 && quiz.pointsCorrect === 100 && quiz.speedBonusMax === 50, 'trivia con 3 series y puntaje por defecto');
  const copy = await fetch(`${URL}/api/quizzes/${quiz.id}/duplicate`, { method: 'POST', headers: auth }).then((r) => r.json());
  check(copy.title === 'E2E (copia)' && copy.series.length === 3, 'duplicar copia series y preguntas');
  await fetch(`${URL}/api/quizzes/${copy.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ title: 'Renombrada' }) });
  const renamed = await fetch(`${URL}/api/quizzes/${copy.id}`, { headers: auth }).then((r) => r.json());
  check(renamed.title === 'Renombrada', 'renombrar desde la lista');
  await fetch(`${URL}/api/quizzes/${copy.id}`, { method: 'DELETE', headers: auth });

  // Sin clave de anfitrión no se puede tocar nada del anfitrión
  for (const [ruta, init] of [
    ['/api/quizzes', {}],
    ['/api/history', {}],
    ['/api/games', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"quizId":"x"}' }],
    ['/api/images', { method: 'POST', headers: { 'content-type': 'image/png' }, body: 'x' }],
  ] as [string, RequestInit][]) {
    const res = await fetch(`${URL}${ruta}`, init);
    check(res.status === 401, `${ruta} exige clave de anfitrión (${res.status})`);
  }
  const { pin, hostToken } = await fetch(`${URL}/api/games`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ quizId: quiz.id }),
  }).then((r) => r.json());
  check(/^\d{6}$/.test(pin), `PIN creado: ${pin}`);
  try {
    await playGame(pin, hostToken);
  } finally {
    await fetch(`${URL}/api/quizzes/${quiz.id}`, { method: 'DELETE', headers: auth });
  }
  console.log(failures ? `\n${failures} verificaciones fallaron` : '\nTodo OK');
  process.exit(failures ? 1 : 0);
}

async function playGame(pin: string, hostToken: string) {

  const host = await connect();
  check(!(await emit(host, 'host:join', { pin, hostToken: 'falso' })).ok, 'token de anfitrión falso rechazado');
  check((await emit(host, 'host:join', { pin, hostToken })).ok, 'anfitrión conectado');
  check(!(await emit(host, 'host:start')).ok, 'no se puede comenzar sin jugadores');

  const [p1, p2, p3] = await Promise.all([connect(), connect(), connect()]);
  const lobby = once(host, 'lobby:players');
  const j1 = await emit(p1, 'player:join', { pin, nickname: '  Ana  ', avatar: '🦁' });
  check(j1.ok && j1.state.me.nickname === 'Ana', 'Ana se une (apodo recortado)');
  check(j1.ok && j1.state.me.avatar === '🦁', 'Ana conserva el avatar que eligió');
  const lobbyPlayers = (await lobby).players;
  check(lobbyPlayers.length === 1 && lobbyPlayers[0]!.avatar === '🦁', 'anfitrión recibe lobby:players con avatar');
  check(!(await emit(p1, 'player:join', { pin, nickname: 'X', avatar: '🚀' })).ok, 'avatar fuera de la lista rechazado');
  const reacted = once(host, 'host:reactions');
  p1.emit('player:react', { emoji: '🙏' });
  check((await reacted).counts['🙏'] === 1, 'la reacción del jugador llega al anfitrión');
  const j2 = await emit(p2, 'player:join', { pin, nickname: 'Beto' });
  check(j2.ok, 'Beto se une');
  const dup = await emit(p3, 'player:join', { pin, nickname: 'ANA' });
  check(dup.ok && dup.state.me.nickname === 'ANA 2', 'apodo duplicado numerado en vez de rechazado');
  check(dup.ok && (await emit(host, 'host:kick', { playerId: dup.playerId })).ok, 'el anfitrión expulsa al duplicado');
  check(!(await emit(p3, 'player:join', { pin: '12', nickname: 'X' })).ok, 'PIN mal formado rechazado (zod)');
  check(!(await emit(p1, 'host:start')).ok, 'un jugador no puede usar eventos de anfitrión');

  // --- Pregunta 1 ---
  const cd = once(p1, 'question:countdown');
  const q1 = once(p1, 'question:start');
  const tStart = Date.now();
  check((await emit(host, 'host:start')).ok, 'partida iniciada');
  const countdown1 = await cd;
  check(countdown1.index === 0 && countdown1.series.title === 'Serie uno' && countdown1.series.total === 2, 'la cuenta muestra la serie (la vacía no cuenta)');
  const question = await q1;
  check(Date.now() - tStart >= QUESTION_COUNTDOWN_SEC * 1000 - 500, 'la pregunta aparece al terminar la cuenta regresiva');
  check(!('correctIndices' in question), 'la pregunta NO incluye la respuesta correcta');
  check(!(await emit(p1, 'player:answer', { questionIndex: 0, choices: [9] })).ok, 'opción fuera de rango rechazada');
  check(!(await emit(p1, 'player:answer', { questionIndex: 0, choices: [0, 1] })).ok, 'opción única no acepta varias');
  check((await emit(p1, 'player:answer', { questionIndex: 0, choices: [1] })).ok, 'Ana responde');
  check(!(await emit(p1, 'player:answer', { questionIndex: 0, choices: [0] })).ok, 'segunda respuesta rechazada');

  // Beto se desconecta y vuelve con su token
  p2.disconnect();
  await sleep(200);
  const p2b = await connect();
  const rj = await emit(p2b, 'player:rejoin', { pin, playerToken: j2.playerToken });
  const snap = rj.state as GameSnapshot;
  check(rj.ok && snap.phase === 'question' && snap.question?.index === 0, 'Beto se reconecta en plena pregunta');

  const reveal = once(host, 'question:reveal');
  const r1 = once(p1, 'player:result');
  const r2 = once(p2b, 'player:result');
  await emit(p2b, 'player:answer', { questionIndex: 0, choices: [3] });
  const rv = await reveal;
  check(rv.correctIndices.join() === '1' && rv.distribution.join() === '0,1,0,1', 'revelación antes de tiempo al responder todos');
  const [res1, res2] = await Promise.all([r1, r2]);
  check(res1.correct && res1.points > 100 && res1.points <= 150 && res1.rank === 1, `Ana acierta: +${res1.points} (100 + bono)`);
  check(!res2.correct && res2.points === 0 && res2.rank === 2, 'Beto falla: 0 pts');

  // Pantalla TV: recibe lo del anfitrión pero no puede dirigir
  const tv = await connect();
  const tvJoin = await emit(tv, 'screen:join', { pin });
  check(tvJoin.ok && tvJoin.state.phase === 'reveal' && tvJoin.state.me === null, 'la pantalla TV se une y ve la partida');
  check(!(await emit(tv, 'host:next')).ok, 'la pantalla TV no puede pasar preguntas');

  // P1 no termina la serie: sin tabla, directo a la cuenta de P2
  const cd2 = once(p1, 'question:countdown');
  await emit(host, 'host:next');
  check((await cd2).inSeries.index === 1, 'sin tabla entre preguntas de la misma serie');

  // --- Pregunta 2: Beto no responde, se cierra por tiempo ---
  const q2 = once(p1, 'question:start');
  check((await emit(host, 'host:next')).ok, 'el anfitrión puede saltarse la cuenta regresiva');
  await q2;
  await emit(p1, 'player:answer', { questionIndex: 0, choices: [2] }).then((r) =>
    check(!r.ok, 'respuesta a pregunta anterior rechazada'),
  );
  const t0 = Date.now();
  const reveal2 = once(host, 'question:reveal', 8000);
  const r2p1 = once(p1, 'player:result', 8000);
  check(!(await emit(p1, 'player:answer', { questionIndex: 1, choices: [1, 1] })).ok, 'opciones repetidas rechazadas');
  await emit(p1, 'player:answer', { questionIndex: 1, choices: [2, 0] });
  const rv2 = await reveal2;
  check(Date.now() - t0 > 4000, 'el temporizador del servidor cierra la pregunta');
  check((await r2p1).correct && rv2.distribution.join() === '1,0,1', 'selección múltiple: acierta marcando todas las correctas');
  check(rv2.endsSeries === true, 'la revelación avisa que terminó la serie');

  // Fin de la Serie 1: tabla (también en la TV)
  const lb = once(p1, 'game:leaderboard');
  const lbTv = once(tv, 'game:leaderboard');
  await emit(host, 'host:next');
  const table = await lb;
  check(table.top[0]?.nickname === 'Ana' && table.seriesEnd.series.index === 0 && !table.seriesEnd.isLast, 'tabla al final de la serie 1');
  check((await lbTv).top.length === 2, 'la TV recibe la tabla');

  // --- Pregunta 3 (Serie 2): verdadero/falso ---
  const q3 = once(p1, 'question:start');
  const cd3 = once(p1, 'question:countdown');
  await emit(host, 'host:next'); // "Iniciar Serie 2" → cuenta regresiva
  check((await cd3).series.title === 'Serie dos', 'la Serie 2 empieza (la vacía se saltó)');
  await emit(host, 'host:next'); // saltar cuenta
  const question3 = await q3;
  check(question3.type === 'truefalse' && question3.options.join() === 'Verdadero,Falso', 'V/F con opciones fijas');
  check(!(await emit(p1, 'player:answer', { questionIndex: 2, choices: [2] })).ok, 'V/F rechaza una tercera opción');
  const r3 = once(p2b, 'player:result');
  await emit(p1, 'player:answer', { questionIndex: 2, choices: [1] });
  await emit(p2b, 'player:answer', { questionIndex: 2, choices: [0] });
  check((await r3).correct, 'Beto acierta el V/F');

  const lbFinal = once(host, 'game:leaderboard');
  await emit(host, 'host:next');
  check((await lbFinal).seriesEnd.isLast, 'tabla de la última serie antes del ganador');

  const podium = once(p2b, 'game:podium');
  const podiumTv = once(tv, 'game:podium');
  await emit(host, 'host:next'); // "Ver ganador"
  const pd = await podium;
  check((await podiumTv).top[0]?.nickname === 'Ana', 'la TV muestra el ganador');
  check(pd.top.length === 2 && pd.me?.rank === 2, 'podio final con puesto propio');

  await sleep(500);
  const late = await connect();
  check(!(await emit(late, 'player:join', { pin, nickname: 'Tarde' })).ok, 'no se puede unir a una partida terminada');

  for (const s of [host, p1, p2b, p3, late, tv]) s.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
