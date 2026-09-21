import type { ScoreEntry } from '@quiz/shared';

// Estilo por puesto (índice 0 = primer lugar).
const PLACES = [
  { height: 'h-40 sm:h-56 xl:h-72', color: 'bg-accent', delayMs: 1000 },
  { height: 'h-28 sm:h-40 xl:h-52', color: 'bg-white', delayMs: 500 },
  { height: 'h-20 sm:h-28 xl:h-36', color: 'bg-paper-2', delayMs: 0 },
];

export function Podium({ top }: { top: ScoreEntry[] }) {
  // Orden visual: 2.º, 1.º, 3.º; se levantan del 3.º al 1.º.
  const columns = [1, 0, 2].map((place) => ({ place, entry: top[place], style: PLACES[place]! }));
  return (
    <div className="mx-auto flex w-full max-w-4xl items-end justify-center">
      {columns.map(({ place, entry, style }) => (
        <div key={place} className="flex w-1/3 max-w-64 flex-col items-center not-first:-ml-0.5">
          <div
            style={{ animationDelay: `${style.delayMs + 400}ms` }}
            className="mb-2 w-full animate-[pop_300ms_both] px-1 text-center"
          >
            {entry ? (
              <>
                <p className="truncate py-1 text-lg leading-tight font-extrabold sm:text-2xl xl:text-3xl">{entry.nickname}</p>
                <p className="font-mono text-sm text-ink-soft sm:text-base">{entry.score.toLocaleString('es')}</p>
              </>
            ) : (
              <p className="text-ink-soft">—</p>
            )}
          </div>
          <div
            style={{ animationDelay: `${style.delayMs}ms` }}
            className={`w-full origin-bottom animate-[rise_500ms_both] border-2 border-ink ${style.color} ${style.height} pt-2 text-center text-4xl font-extrabold sm:text-6xl`}
          >
            {place + 1}
          </div>
        </div>
      ))}
    </div>
  );
}
