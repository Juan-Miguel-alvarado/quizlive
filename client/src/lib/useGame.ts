import type { AckResponse, CountdownView, GameSnapshot, QuestionView } from '@quiz/shared';
import { useEffect, useReducer, useRef } from 'react';
import { getSocket } from './socket';

export interface GameState {
  snap: GameSnapshot | null;
  clockOffset: number; // relojServidor - relojLocal, en ms
  connected: boolean;
  closedReason: string | null;
}

type Action =
  | { type: 'connection'; connected: boolean }
  | { type: 'snapshot'; snap: GameSnapshot; clockOffset: number }
  | { type: 'closed'; reason: string }
  | { type: 'patch'; fn: (snap: GameSnapshot) => GameSnapshot }
  | { type: 'countdown'; countdown: CountdownView; clockOffset: number }
  | { type: 'question'; question: QuestionView; clockOffset: number };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'connection':
      return { ...state, connected: action.connected };
    case 'snapshot':
      return { ...state, snap: action.snap, clockOffset: action.clockOffset, closedReason: null };
    case 'closed':
      return { ...state, closedReason: action.reason };
    case 'patch':
      return state.snap ? { ...state, snap: action.fn(state.snap) } : state;
    case 'countdown':
      if (!state.snap) return state;
      return {
        ...state,
        clockOffset: action.clockOffset,
        snap: { ...state.snap, phase: 'countdown', countdown: action.countdown, reveal: null, leaderboard: null },
      };
    case 'question':
      if (!state.snap) return state;
      return {
        ...state,
        clockOffset: action.clockOffset,
        snap: {
          ...state.snap,
          phase: 'question',
          countdown: null,
          question: action.question,
          answeredCount: 0,
          reveal: null,
          leaderboard: null,
          me: state.snap.me && { ...state.snap.me, answer: null, lastResult: null },
        },
      };
  }
}

const offsetOf = (v: { serverNow: number } | null) => (v ? v.serverNow - Date.now() : 0);
const snapshotOffset = (s: GameSnapshot) => offsetOf(s.question ?? s.countdown);

/**
 * Mantiene el estado de la partida sincronizado con el servidor. `join` se ejecuta
 * en cada (re)conexión del socket y debe devolver la foto completa del estado.
 */
export function useGame(join: () => Promise<AckResponse<{ state: GameSnapshot }>>) {
  const [state, dispatch] = useReducer(reducer, {
    snap: null,
    clockOffset: 0,
    connected: false,
    closedReason: null,
  });
  const joinRef = useRef(join);
  joinRef.current = join;

  useEffect(() => {
    const socket = getSocket();
    const patch = (fn: (s: GameSnapshot) => GameSnapshot) => dispatch({ type: 'patch', fn });

    const onConnect = async () => {
      dispatch({ type: 'connection', connected: true });
      const res = await joinRef.current();
      if (res.ok) dispatch({ type: 'snapshot', snap: res.state, clockOffset: snapshotOffset(res.state) });
      else dispatch({ type: 'closed', reason: res.error });
    };
    const onDisconnect = () => dispatch({ type: 'connection', connected: false });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('lobby:players', ({ players }) => patch((s) => ({ ...s, players })));
    socket.on('question:countdown', (countdown) =>
      dispatch({ type: 'countdown', countdown, clockOffset: offsetOf(countdown) }),
    );
    socket.on('question:start', (question) =>
      dispatch({ type: 'question', question, clockOffset: offsetOf(question) }),
    );
    socket.on('question:progress', ({ answered }) => patch((s) => ({ ...s, answeredCount: answered })));
    socket.on('question:reveal', (reveal) => patch((s) => ({ ...s, phase: 'reveal', reveal })));
    socket.on('player:result', (r) =>
      patch((s) => ({
        ...s,
        me: s.me && { ...s.me, score: r.totalScore, rank: r.rank, lastResult: r },
      })),
    );
    socket.on('game:leaderboard', ({ top }) => patch((s) => ({ ...s, phase: 'leaderboard', leaderboard: top })));
    socket.on('game:podium', ({ top, me }) =>
      patch((s) => ({
        ...s,
        phase: 'podium',
        podium: top,
        me: s.me && me ? { ...s.me, score: me.score, rank: me.rank } : s.me,
      })),
    );
    socket.on('game:state', (snap) => dispatch({ type: 'snapshot', snap, clockOffset: snapshotOffset(snap) }));
    socket.on('game:closed', ({ reason }) => dispatch({ type: 'closed', reason }));

    if (socket.connected) void onConnect();

    return () => {
      for (const ev of [
        'connect',
        'disconnect',
        'lobby:players',
        'question:countdown',
        'question:start',
        'question:progress',
        'question:reveal',
        'player:result',
        'game:leaderboard',
        'game:podium',
        'game:state',
        'game:closed',
      ] as const) {
        socket.off(ev);
      }
    };
  }, []);

  const markAnswered = (choices: number[] | null) =>
    dispatch({ type: 'patch', fn: (s) => ({ ...s, me: s.me && { ...s.me, answer: choices } }) });

  return { ...state, markAnswered };
}
