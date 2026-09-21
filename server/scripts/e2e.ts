/**
 * Prueba de humo de una partida completa contra un servidor en marcha (pnpm dev).
 * Uso: pnpm --filter server test:e2e
 */
import type { ClientToServerEvents, GameSnapshot, ServerToClientEvents } from '@quiz/shared';
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

async function main() {
  const quiz = await fetch(`${URL}/api/quizzes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'E2E',
      questions: [
        { type: 'single', text: 'P1', options: ['a', 'b', 'c', 'd'], correctIndices: [1], timeLimitSec: 5 },
        { type: 'multiple', text: 'P2', options: ['a', 'b', 'c'], correctIndices: [0, 2], timeLimitSec: 5 },
        { type: 'truefalse', text: 'P3', options: ['x', 'y'], correctIndices: [0], timeLimitSec: 5 },
      ],
    }),
  }).then((r) => r.json());
  const bad = await fetch(`${URL}/api/quizzes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Malo',
      questions: [{ type: 'single', text: 'x', options: ['a', 'b'], correctIndices: [0, 1], timeLimitSec: 5 }],
    }),
  });
  check(bad.status === 400, 'opción única con dos correctas rechazada al guardar');
  const { pin, hostToken } = await fetch(`${URL}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quizId: quiz.id }),
  }).then((r) => r.json());
  check(/^\d{6}$/.test(pin), `PIN creado: ${pin}`);
  try {
    await playGame(pin, hostToken);
  } finally {
    await fetch(`${URL}/api/quizzes/${quiz.id}`, { method: 'DELETE' });
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
  const j1 = await emit(p1, 'player:join', { pin, nickname: '  Ana  ' });
  check(j1.ok && j1.state.me.nickname === 'Ana', 'Ana se une (apodo recortado)');
  check((await lobby).players.length === 1, 'anfitrión recibe lobby:players');
  const j2 = await emit(p2, 'player:join', { pin, nickname: 'Beto' });
  check(j2.ok, 'Beto se une');
  check(!(await emit(p3, 'player:join', { pin, nickname: 'ANA' })).ok, 'apodo duplicado rechazado');
  check(!(await emit(p3, 'player:join', { pin: '12', nickname: 'X' })).ok, 'PIN mal formado rechazado (zod)');
  check(!(await emit(p1, 'host:start')).ok, 'un jugador no puede usar eventos de anfitrión');

  // --- Pregunta 1 ---
  const cd = once(p1, 'question:countdown');
  const q1 = once(p1, 'question:start');
  const tStart = Date.now();
  check((await emit(host, 'host:start')).ok, 'partida iniciada');
  check((await cd).index === 0, 'cuenta regresiva antes de la primera pregunta');
  const question = await q1;
  check(Date.now() - tStart >= 4500, 'la pregunta aparece al terminar la cuenta regresiva');
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
  check(res1.correct && res1.points > 900 && res1.rank === 1, `Ana acierta: +${res1.points}`);
  check(!res2.correct && res2.points === 0 && res2.rank === 2, 'Beto falla: 0 pts');

  const lb = once(host, 'game:leaderboard');
  await emit(host, 'host:next');
  check((await lb).top[0]?.nickname === 'Ana', 'ranking entre preguntas');

  // --- Pregunta 2: Beto no responde, se cierra por tiempo ---
  const q2 = once(p1, 'question:start');
  await emit(host, 'host:next');
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

  // --- Pregunta 3: verdadero/falso ---
  const q3 = once(p1, 'question:start');
  await emit(host, 'host:next'); // ranking
  await emit(host, 'host:next'); // cuenta regresiva
  await emit(host, 'host:next'); // saltar cuenta
  const question3 = await q3;
  check(question3.type === 'truefalse' && question3.options.join() === 'Verdadero,Falso', 'V/F con opciones fijas');
  check(!(await emit(p1, 'player:answer', { questionIndex: 2, choices: [2] })).ok, 'V/F rechaza una tercera opción');
  const r3 = once(p2b, 'player:result');
  await emit(p1, 'player:answer', { questionIndex: 2, choices: [1] });
  await emit(p2b, 'player:answer', { questionIndex: 2, choices: [0] });
  check((await r3).correct, 'Beto acierta el V/F');

  const podium = once(p2b, 'game:podium');
  await emit(host, 'host:next');
  const pd = await podium;
  check(pd.top.length === 2 && pd.me?.rank === 2, 'podio final con puesto propio');

  await sleep(500);
  const late = await connect();
  check(!(await emit(late, 'player:join', { pin, nickname: 'Tarde' })).ok, 'no se puede unir a una partida terminada');

  for (const s of [host, p1, p2b, p3, late]) s.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
