import type {
  AckResponse,
  ClientToServerEvents,
  HostJoinPayload,
  ScreenJoinPayload,
  PlayerAnswerPayload,
  PlayerJoinPayload,
  PlayerReactPayload,
  PlayerRejoinPayload,
  ServerToClientEvents,
} from '@quiz/shared';
import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from './api';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ClientSocket | null = null;

/** Un único socket para toda la app; se conecta al primer uso. */
export function getSocket(): ClientSocket {
  socket ??= SERVER_URL ? io(SERVER_URL, { autoConnect: false }) : io({ autoConnect: false });
  if (!socket.connected && !socket.active) socket.connect();
  return socket;
}

const ACK_TIMEOUT_MS = 5000;

async function call<T>(send: (s: ClientSocket) => Promise<AckResponse<T>>): Promise<AckResponse<T>> {
  try {
    return await send(getSocket());
  } catch {
    return { ok: false, error: 'El servidor no respondió. Revisa tu conexión.' };
  }
}

export const gameActions = {
  hostJoin: (p: HostJoinPayload) => call((s) => s.timeout(ACK_TIMEOUT_MS).emitWithAck('host:join', p)),
  /** Pantalla TV: solo mira. */
  screenJoin: (p: ScreenJoinPayload) => call((s) => s.timeout(ACK_TIMEOUT_MS).emitWithAck('screen:join', p)),
  hostStart: () => call((s) => s.timeout(ACK_TIMEOUT_MS).emitWithAck('host:start')),
  hostNext: () => call((s) => s.timeout(ACK_TIMEOUT_MS).emitWithAck('host:next')),
  hostEnd: () => call((s) => s.timeout(ACK_TIMEOUT_MS).emitWithAck('host:end')),
  hostPlayAgain: () => call((s) => s.timeout(ACK_TIMEOUT_MS).emitWithAck('host:playAgain')),
  hostKick: (playerId: string) => call((s) => s.timeout(ACK_TIMEOUT_MS).emitWithAck('host:kick', { playerId })),
  playerJoin: (p: PlayerJoinPayload) => call((s) => s.timeout(ACK_TIMEOUT_MS).emitWithAck('player:join', p)),
  playerRejoin: (p: PlayerRejoinPayload) => call((s) => s.timeout(ACK_TIMEOUT_MS).emitWithAck('player:rejoin', p)),
  playerAnswer: (p: PlayerAnswerPayload) => call((s) => s.timeout(ACK_TIMEOUT_MS).emitWithAck('player:answer', p)),
  /** Sin ack: si se pierde una reacción no pasa nada. */
  playerReact: (p: PlayerReactPayload) => void getSocket().emit('player:react', p),
};
