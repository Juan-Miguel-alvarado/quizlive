/**
 * Prueba de carga: una partida con N jugadores simulados.
 * Uso: pnpm --filter server exec tsx scripts/load.ts [jugadores=200] [--finish]
 *   SERVER_URL=https://... para probar contra producción.
 *   Sin --finish la partida no llega al podio (no guarda resultados en la base de datos).
 */
import type { ClientToServerEvents, ServerToClientEvents } from '@quiz/shared';
import { io, type Socket } from 'socket.io-client';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const URL = process.env.SERVER_URL ?? 'http://localhost:3001';
const N = Number(process.argv[2] ?? 200);
const FINISH = process.argv.includes('--finish');
const QUESTIONS = 3;

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
const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN;
  return `p50 ${q(0.5)} ms · p95 ${q(0.95)} ms · máx ${s.at(-1)} ms`;
};
const connect = () =>
  new Promise<ClientSocket>((resolve, reject) => {
    const s: ClientSocket = io(URL, { transports: ['websocket'], forceNew: true, timeout: 20000 });
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
/** Espera a que TODOS los sockets reciban el evento; devuelve cuándo lo recibió cada uno. */
const allReceive = (sockets: ClientSocket[], event: keyof ServerToClientEvents, timeoutMs = 60000) =>
  Promise.all(
    sockets.map(
      (s) =>
        new Promise<number>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error(`timeout esperando ${event}`)), timeoutMs);
          (s as Socket).once(event, () => {
            clearTimeout(t);
            resolve(Date.now());
          });
        }),
    ),
  );

async function main() {
  console.log(`Servidor: ${URL} · ${N} jugadores\n`);
  const auth = await hostHeaders();
  const t0 = Date.now();
  await fetch(`${URL}/api/health`); // despierta Render si estaba dormido
  console.log(`servidor responde en ${Date.now() - t0} ms`);

  const quiz = await fetch(`${URL}/api/quizzes`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      title: `Carga ${N}`,
      // Una serie por pregunta: así la tabla (el momento más pesado) sale después de cada una.
      series: Array.from({ length: QUESTIONS }, (_, i) => ({
        title: `Serie ${i + 1}`,
        questions: [
          { type: 'single', text: `Pregunta ${i + 1}`, options: ['a', 'b', 'c', 'd'], correctIndices: [i % 4], timeLimitSec: 20 },
        ],
      })),
    }),
  }).then((r) => r.json());

  try {
    const { pin, hostToken } = await fetch(`${URL}/api/games`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ quizId: quiz.id }),
    }).then((r) => r.json());
    const host = await connect();
    await host.emitWithAck('host:join', { pin, hostToken });

    // --- Entrada: todos a la vez, como cuando se proyecta el PIN ---
    let lobbyEvents = 0;
    host.on('lobby:players', () => lobbyEvents++);
    const hostSeesAll = new Promise<void>((resolve) =>
      host.on('lobby:players', ({ players }) => players.length >= N && resolve()),
    );
    const tJoin = Date.now();
    const players: ClientSocket[] = [];
    const joinTimes: number[] = [];
    let rejected = 0;
    await Promise.all(
      Array.from({ length: N }, async (_, i) => {
        const s = await connect();
        const t = Date.now();
        const res = await s.timeout(30000).emitWithAck('player:join', { pin, nickname: `bot${i}` });
        joinTimes.push(Date.now() - t);
        if (res.ok) players.push(s);
        else {
          rejected++;
          s.disconnect();
        }
      }),
    );
    if (rejected === 0) await hostSeesAll;
    console.log(`entrada: ${players.length} dentro, ${rejected} rechazados · total ${Date.now() - tJoin} ms`);
    console.log(`  respuesta a cada unión: ${stats(joinTimes)}`);
    console.log(`  actualizaciones de la lista recibidas por el anfitrión: ${lobbyEvents}`);

    // --- Preguntas ---
    const everyone = [host, ...players];
    for (let q = 0; q < QUESTIONS; q++) {
      const starts = allReceive(everyone, 'question:start');
      const tNext = Date.now();
      await (q === 0 ? host.emitWithAck('host:start') : host.emitWithAck('host:next'));
      await host.emitWithAck('host:next'); // saltar la cuenta regresiva
      const startTimes = await starts;
      console.log(`\npregunta ${q + 1}: llega a los ${everyone.length} en ${Math.max(...startTimes) - tNext} ms (diferencia entre el primero y el último: ${Math.max(...startTimes) - Math.min(...startTimes)} ms)`);

      // Todos responden en ráfaga (los peores 2 segundos para el servidor)
      const results = allReceive(players, 'player:result');
      const ackTimes: number[] = [];
      const tAnswers = Date.now();
      await Promise.all(
        players.map(async (s) => {
          await sleep(Math.random() * 2000);
          const t = Date.now();
          const res = await s.timeout(30000).emitWithAck('player:answer', {
            questionIndex: q,
            choices: [Math.floor(Math.random() * 4)],
          });
          if (!res.ok) throw new Error(res.error);
          ackTimes.push(Date.now() - t);
        }),
      );
      const resultTimes = await results;
      console.log(`  confirmación de cada respuesta: ${stats(ackTimes)}`);
      console.log(`  resultado a todos: ${Math.max(...resultTimes) - tAnswers} ms desde la primera respuesta`);

      if (q < QUESTIONS - 1) {
        const lb = allReceive(everyone, 'game:leaderboard');
        const tLb = Date.now();
        await host.emitWithAck('host:next');
        console.log(`  ranking a todos: ${Math.max(...(await lb)) - tLb} ms`);
      }
    }

    if (FINISH) {
      await host.emitWithAck('host:next'); // tabla de la última serie
      const podium = allReceive(everyone, 'game:podium');
      const tP = Date.now();
      await host.emitWithAck('host:next');
      console.log(`\nganador a todos: ${Math.max(...(await podium)) - tP} ms (resultados guardados en la base de datos)`);
    }
    for (const s of everyone) s.disconnect();
  } finally {
    await fetch(`${URL}/api/quizzes/${quiz.id}`, { method: 'DELETE', headers: auth });
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('FALLÓ:', err.message);
  process.exit(1);
});
