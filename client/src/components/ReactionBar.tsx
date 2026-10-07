import { REACTIONS, type Reaction } from '@quiz/shared';
import { useState } from 'react';
import { gameActions } from '../lib/socket';
import { buzz } from '../lib/sound';

const COOLDOWN_MS = 1500; // el mismo que aplica el servidor

/** Botones grandes del celular para mandar una reacción a la pantalla grande. */
export function ReactionBar() {
  const [last, setLast] = useState<Reaction | null>(null);
  const [cooling, setCooling] = useState(false);

  function send(emoji: Reaction) {
    if (cooling) return;
    gameActions.playerReact({ emoji });
    buzz(15);
    setLast(emoji);
    setCooling(true);
    setTimeout(() => setCooling(false), COOLDOWN_MS);
  }

  return (
    <div className="mx-auto w-full max-w-xs">
      <p className="mb-3 text-center font-bold text-stage-soft">Toca para mandar a la pantalla grande</p>
      <div className="grid grid-cols-3 gap-3">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => send(emoji)}
            disabled={cooling && last !== emoji}
            aria-label={`Reaccionar con ${emoji}`}
            className={`grid h-20 place-items-center rounded-2xl text-5xl transition-[translate,box-shadow,opacity] active:translate-y-1 active:shadow-none disabled:opacity-40 ${
              cooling && last === emoji ? 'translate-y-1 animate-[bump_300ms] bg-stage-light shadow-none' : 'bg-white shadow-3d-lg'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
