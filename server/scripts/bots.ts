/**
 * Llena una partida con bots que responden al azar, para probar sin compañeros.
 * Uso: pnpm bots <PIN> [cantidad=5]
 */
import type { ClientToServerEvents, ServerToClientEvents } from '@quiz/shared';
import { io, type Socket } from 'socket.io-client';

const [pin, countArg] = process.argv.slice(2);
const URL = process.env.SERVER_URL ?? 'http://localhost:3001';
if (!pin) {
  console.error('Uso: pnpm bots <PIN> [cantidad]');
  process.exit(1);
}

const NAMES = ['Ada', 'Alan', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Guido'];

for (let i = 0; i < Number(countArg ?? 5); i++) {
  const nickname = `${NAMES[i % NAMES.length]}${i >= NAMES.length ? i : ''}🤖`;
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, { transports: ['websocket'] });
  socket.on('connect', () =>
    socket.emit('player:join', { pin, nickname }, (res) => console.log(nickname, res.ok ? 'dentro' : res.error)),
  );
  socket.on('question:start', (q) => {
    const delay = Math.random() * q.timeLimitSec * 800;
    const shuffled = q.options.map((_, i) => i).sort(() => Math.random() - 0.5);
    const count = q.type === 'multiple' ? 1 + Math.floor(Math.random() * q.options.length) : 1;
    setTimeout(
      () => socket.emit('player:answer', { questionIndex: q.index, choices: shuffled.slice(0, count) }, () => {}),
      delay,
    );
  });
  socket.on('game:closed', ({ reason }) => {
    console.log(nickname, 'fuera:', reason);
    socket.disconnect();
  });
}
