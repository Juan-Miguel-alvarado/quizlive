/**
 * Llena una partida con bots que responden al azar, para probar sin compañeros.
 * Uso: pnpm bots <PIN> [cantidad=5]
 */
import {
  randomAvatar,
  randomNickname,
  REACTIONS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@quiz/shared';
import { io, type Socket } from 'socket.io-client';

const [pin, countArg] = process.argv.slice(2);
const URL = process.env.SERVER_URL ?? 'http://localhost:3001';
if (!pin) {
  console.error('Uso: pnpm bots <PIN> [cantidad]');
  process.exit(1);
}

for (let i = 0; i < Number(countArg ?? 5); i++) {
  // Como los jugadores reales: avatar al azar y el nombre del dado (los repetidos los numera el servidor).
  const avatar = randomAvatar();
  const nickname = randomNickname(avatar);
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, { transports: ['websocket'] });
  let answering = false;
  socket.on('connect', () =>
    socket.emit('player:join', { pin, nickname, avatar }, (res) =>
      console.log(res.ok ? res.state.me?.nickname : nickname, res.ok ? 'dentro' : res.error),
    ),
  );
  // De vez en cuando mandan una reacción (nunca mientras hay una pregunta abierta).
  const reactions = setInterval(() => {
    if (!answering && Math.random() < 0.15) {
      socket.emit('player:react', { emoji: REACTIONS[Math.floor(Math.random() * REACTIONS.length)]! });
    }
  }, 2000);
  socket.on('question:reveal', () => (answering = false));
  socket.on('question:start', (q) => {
    answering = true;
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
    clearInterval(reactions);
    socket.disconnect();
  });
}
