import type { ScoreEntry } from '@quiz/shared';

export function Leaderboard({ entries }: { entries: ScoreEntry[] }) {
  return (
    <ol className="mx-auto w-full max-w-3xl">
      {entries.map((e, i) => (
        <li
          key={e.playerId}
          style={{ animationDelay: `${i * 70}ms` }}
          className={`flex animate-[slide-in_350ms_both] items-center gap-4 border-2 border-ink px-4 py-3 not-first:-mt-0.5 sm:px-6 sm:py-4 xl:py-5 ${
            i === 0 ? 'bg-accent' : 'bg-white'
          }`}
        >
          <span className="w-8 text-xl font-extrabold tabular-nums sm:text-3xl">{e.rank}</span>
          <span className="min-w-0 flex-1 truncate text-xl font-bold sm:text-2xl xl:text-3xl">{e.nickname}</span>
          <span className="text-xl font-extrabold tabular-nums sm:text-2xl xl:text-3xl">
            {e.score.toLocaleString('es')}
          </span>
        </li>
      ))}
    </ol>
  );
}
