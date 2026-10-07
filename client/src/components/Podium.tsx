import type { ScoreEntry } from '@quiz/shared';
import { AwardFill } from 'react-bootstrap-icons';

// Estilo por puesto (índice 0 = primer lugar). Las columnas suben del 3.º al 1.º, y el nombre de
// cada uno aparece cuando su columna ya llegó arriba. Medidas en vh/vw: es para la pantalla TV.
const PLACES = [
  { height: 'h-[30vh]', color: 'bg-gold', delayMs: 1400 },
  { height: 'h-[21vh]', color: 'bg-silver', delayMs: 700 },
  { height: 'h-[14vh]', color: 'bg-bronze', delayMs: 0 },
];

export function Podium({ top }: { top: ScoreEntry[] }) {
  // Orden visual: 2.º, 1.º, 3.º.
  const columns = [1, 0, 2].map((place) => ({ place, entry: top[place], style: PLACES[place]! }));
  return (
    <div className="mx-auto flex w-[min(90vw,150vh)] items-end justify-center gap-[1.2vw]">
      {columns.map(({ place, entry, style }) => (
        <div key={place} className="flex w-1/3 flex-col items-center">
          <div
            style={{ animationDelay: `${style.delayMs + 500}ms` }}
            className="mb-[1.5vh] w-full animate-[podium-reveal_400ms_both] px-1 text-center"
          >
            {entry ? (
              <>
                <p className="text-[8vh] leading-none drop-shadow-lg" aria-hidden>
                  {entry.avatar}
                </p>
                <p className="truncate py-[0.5vh] text-[4.5vh] leading-tight font-black">{entry.nickname}</p>
                <p className="inline-block rounded-lg bg-black/25 px-[1vh] text-[3vh] font-bold tabular-nums">
                  {entry.score.toLocaleString('es')}
                </p>
              </>
            ) : (
              <p className="text-[3vh] text-stage-soft">—</p>
            )}
          </div>
          <div
            style={{ animationDelay: `${style.delayMs}ms` }}
            className={`flex w-full origin-bottom animate-[rise_600ms_both] flex-col items-center rounded-t-[1.5vh] pt-[1.5vh] text-ink shadow-3d-lg ${style.color} ${style.height}`}
          >
            <AwardFill className="size-[6vh] opacity-80" aria-hidden />
            <span className="text-[9vh] leading-none font-black">{place + 1}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
