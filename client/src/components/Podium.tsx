import type { ScoreEntry } from '@quiz/shared';
import { AwardFill } from 'react-bootstrap-icons';

// Estilo por puesto (índice 0 = primer lugar). Las columnas suben del 3.º al 1.º, y el nombre de
// cada uno aparece cuando su columna ya llegó arriba.
const PLACES = [
  { height: 'h-44 sm:h-60 xl:h-72', color: 'bg-gold', delayMs: 1400 },
  { height: 'h-32 sm:h-44 xl:h-52', color: 'bg-silver', delayMs: 700 },
  { height: 'h-24 sm:h-32 xl:h-40', color: 'bg-bronze', delayMs: 0 },
];

export function Podium({ top }: { top: ScoreEntry[] }) {
  // Orden visual: 2.º, 1.º, 3.º.
  const columns = [1, 0, 2].map((place) => ({ place, entry: top[place], style: PLACES[place]! }));
  return (
    <div className="mx-auto flex w-full max-w-4xl items-end justify-center gap-2 sm:gap-3">
      {columns.map(({ place, entry, style }) => (
        <div key={place} className="flex w-1/3 max-w-64 flex-col items-center">
          <div
            style={{ animationDelay: `${style.delayMs + 500}ms` }}
            className="mb-3 w-full animate-[podium-reveal_400ms_both] px-1 text-center"
          >
            {entry ? (
              <>
                <p className="text-5xl leading-none drop-shadow-lg sm:text-6xl xl:text-7xl" aria-hidden>
                  {entry.avatar}
                </p>
                <p className="truncate py-1 text-lg leading-tight font-black sm:text-2xl xl:text-3xl">{entry.nickname}</p>
                <p className="inline-block rounded-lg bg-black/25 px-2 text-sm font-bold tabular-nums sm:text-base">
                  {entry.score.toLocaleString('es')}
                </p>
              </>
            ) : (
              <p className="text-stage-soft">—</p>
            )}
          </div>
          <div
            style={{ animationDelay: `${style.delayMs}ms` }}
            className={`flex w-full origin-bottom animate-[rise_600ms_both] flex-col items-center rounded-t-xl pt-3 text-ink shadow-3d-lg ${style.color} ${style.height}`}
          >
            <AwardFill className="size-8 opacity-80 sm:size-12" aria-hidden />
            <span className="text-4xl font-black sm:text-6xl">{place + 1}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
