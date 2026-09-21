import type { ClientToServerEvents, ServerToClientEvents } from '@quiz/shared';
import type { Server, Socket } from 'socket.io';

export interface SocketData {
  pin?: string;
  role?: 'host' | 'player';
  playerId?: string;
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
