import { QUESTION_COUNTDOWN_SEC, type CountdownView } from '@quiz/shared';
import { CountdownCircle } from './Countdown';
import { QUESTION_TYPE_HINTS } from './OptionShape';

/** Pantalla de espera entre preguntas (anfitrión y jugadores). */
export function GetReady({ countdown, clockOffset, size }: {
  countdown: CountdownView;
  clockOffset: number;
  size: 'sm' | 'lg';
}) {
  const big = size === 'lg';
  return (
    <div className="flex flex-1 animate-[pop_300ms_both] flex-col items-center justify-center gap-5 text-center">
      <div className={`w-full ${big ? 'max-w-xl' : 'max-w-xs'}`}>
        <p className={`font-bold text-stage-soft ${big ? 'text-lg sm:text-2xl' : 'text-base'}`}>
          Pregunta {countdown.index + 1} de {countdown.total}
        </p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/25">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${((countdown.index + 1) / countdown.total) * 100}%` }}
          />
        </div>
      </div>
      <p className={`font-black tracking-tight drop-shadow ${big ? 'text-5xl sm:text-7xl xl:text-8xl' : 'text-5xl'}`}>
        ¡Prepárate!
      </p>
      <p className={`pill ${big ? 'text-lg sm:text-2xl' : 'text-base'}`}>{QUESTION_TYPE_HINTS[countdown.type]}</p>
      <CountdownCircle endsAt={countdown.endsAt} clockOffset={clockOffset} totalSec={QUESTION_COUNTDOWN_SEC} />
    </div>
  );
}
