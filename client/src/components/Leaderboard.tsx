import type { ScoreEntry } from '@quiz/shared';
import { CaretDownFill, CaretUpFill, Fire, TrophyFill } from 'react-bootstrap-icons';

export function Leaderboard({ entries }: { entries: ScoreEntry[] }) {
  return (
    <ol className="mx-auto w-full max-w-3xl space-y-3">
      {entries.map((e, i) => (
        <li
          key={e.playerId}
          style={{ animationDelay: `${i * 70}ms` }}
          className={`flex animate-[slide-in_350ms_both] items-center gap-4 rounded-xl bg-white px-4 py-3 text-ink shadow-3d sm:px-6 sm:py-4 xl:py-5 ${
            i === 0 ? 'ring-4 ring-gold' : ''
          }`}
        >
          <span className="flex w-10 items-center justify-center text-xl font-black tabular-nums sm:text-3xl">
            {e.rank === 1 ? <TrophyFill className="size-7 text-gold xl:size-9" aria-label="1" /> : e.rank}
          </span>
          <span className="text-3xl leading-none xl:text-4xl" aria-hidden>
            {e.avatar}
          </span>
          <span className="min-w-0 flex-1 truncate text-xl font-black sm:text-2xl xl:text-3xl">{e.nickname}</span>
          {e.streak >= 2 && (
            <span className="flex shrink-0 items-center gap-0.5 font-bold sm:text-lg" title={`${e.streak} aciertos seguidos`}>
              <Fire className="size-5 text-opt-red" />
              {e.streak}
            </span>
          )}
          {e.delta !== 0 && (
            <span
              className={`flex items-center font-mono text-sm font-bold sm:text-base ${e.delta > 0 ? 'text-good' : 'text-bad'}`}
              title={e.delta > 0 ? `Subió ${e.delta}` : `Bajó ${-e.delta}`}
            >
              {e.delta > 0 ? <CaretUpFill /> : <CaretDownFill />}
              {Math.abs(e.delta)}
            </span>
          )}
          <span className="text-xl font-black tabular-nums sm:text-2xl xl:text-3xl">
            {e.score.toLocaleString('es')}
          </span>
        </li>
      ))}
    </ol>
  );
}
