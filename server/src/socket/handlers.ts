import {
  hostJoinSchema,
  hostKickSchema,
  playerAnswerSchema,
  playerJoinSchema,
  playerReactSchema,
  playerRejoinSchema,
  type AckResponse,
} from '@quiz/shared';
import type { z } from 'zod';
import { GameError, type Game } from '../game/Game';
import type { GameManager } from '../game/GameManager';
import { createRateLimiter } from '../lib/rateLimit';
import type { TypedServer, TypedSocket } from './types';

// El PIN son 6 dígitos: sin límite, alguien podría probarlos todos para colarse en partidas ajenas.
// Solo cuentan los PIN que no existen, y el cupo es amplio: con datos móviles muchos celulares
// salen por la misma IP (CGNAT del operador) y varios pueden equivocarse al escribir.
const joinFailures = createRateLimiter({ limit: 100, windowMs: 5 * 60_000 });

type AnyAck = (res: AckResponse<object>) => void;

/** Ejecuta la acción y responde por el ack; los GameError se devuelven como mensaje al cliente. */
function respond(ack: unknown, action: () => object | void) {
  const reply: AnyAck = typeof ack === 'function' ? (ack as AnyAck) : () => {};
  try {
    reply({ ok: true, ...(action() ?? {}) });
  } catch (err) {
    if (err instanceof GameError) reply({ ok: false, error: err.message });
    else {
      console.error(err);
      reply({ ok: false, error: 'Error interno del servidor' });
    }
  }
}

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const result = schema.safeParse(payload);
  if (!result.success) throw new GameError(result.error.issues[0]?.message ?? 'Datos inválidos');
  return result.data;
}

export function registerSocketHandlers(io: TypedServer, games: GameManager) {
  io.on('connection', (socket: TypedSocket) => {
    const clientIp = socket.handshake.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
      ?? socket.handshake.address;
    /** Suelta la partida a la que estuviera asociado este socket (al cambiar de partida o desconectarse). */
    const leaveCurrentGame = () => {
      const { pin, role, playerId } = socket.data;
      const game = games.get(pin);
      if (game) {
        if (role === 'host') game.detachHost(socket.id);
        if (role === 'player' && playerId) game.detachPlayer(playerId, socket.id);
      }
      if (pin) {
        socket.leave(`game:${pin}`);
        socket.leave(`game:${pin}:host`);
      }
      socket.data = {};
    };

    const findGame = (pin: string) => {
      const game = games.get(pin);
      if (!game) {
        if (!joinFailures.take(clientIp)) throw new GameError('Demasiados intentos, espera unos minutos');
        throw new GameError('No existe una partida con ese PIN');
      }
      return game;
    };

    const hostGame = (): Game => {
      const game = games.get(socket.data.pin);
      if (socket.data.role !== 'host' || !game?.isHost(socket.id)) {
        throw new GameError('No estás dirigiendo ninguna partida');
      }
      return game;
    };

    const playerGame = () => {
      const { pin, role, playerId } = socket.data;
      const game = games.get(pin);
      if (role !== 'player' || !playerId || !game?.hasPlayerSocket(playerId, socket.id)) {
        throw new GameError('No estás en ninguna partida');
      }
      return { game, playerId };
    };

    // --- Anfitrión ---
    socket.on('host:join', (payload, ack) =>
      respond(ack, () => {
        const { pin, hostToken } = parse(hostJoinSchema, payload);
        const game = findGame(pin);
        leaveCurrentGame();
        return { state: game.attachHost(socket, hostToken) };
      }),
    );
    socket.on('host:start', (ack) => respond(ack, () => hostGame().start()));
    socket.on('host:next', (ack) => respond(ack, () => hostGame().next()));
    socket.on('host:end', (ack) => respond(ack, () => hostGame().end()));
    socket.on('host:playAgain', (ack) => respond(ack, () => hostGame().playAgain()));
    socket.on('host:kick', (payload, ack) =>
      respond(ack, () => hostGame().kick(parse(hostKickSchema, payload).playerId)),
    );

    // --- Jugadores ---
    socket.on('player:join', (payload, ack) =>
      respond(ack, () => {
        const { pin, nickname, avatar } = parse(playerJoinSchema, payload);
        const game = findGame(pin);
        leaveCurrentGame();
        return game.addPlayer(socket, nickname, avatar);
      }),
    );
    socket.on('player:rejoin', (payload, ack) =>
      respond(ack, () => {
        const { pin, playerToken } = parse(playerRejoinSchema, payload);
        const game = findGame(pin);
        leaveCurrentGame();
        return { state: game.rejoinPlayer(socket, playerToken) };
      }),
    );
    socket.on('player:answer', (payload, ack) =>
      respond(ack, () => {
        const { questionIndex, choices } = parse(playerAnswerSchema, payload);
        const { game, playerId } = playerGame();
        game.answer(playerId, questionIndex, choices);
      }),
    );

    // Sin ack y sin errores: si la reacción no vale o el jugador no está en una partida, se ignora.
    socket.on('player:react', (payload) => {
      const parsed = playerReactSchema.safeParse(payload);
      const { pin, role, playerId } = socket.data;
      const game = games.get(pin);
      if (!parsed.success || role !== 'player' || !playerId || !game?.hasPlayerSocket(playerId, socket.id)) return;
      game.react(playerId, parsed.data.emoji);
    });

    socket.on('disconnect', leaveCurrentGame);
  });
}
