import { QUESTION_COUNTDOWN_SEC, type CountdownView } from '@quiz/shared';
import { CountdownCircle } from './Countdown';
import { QUESTION_TYPE_LABELS } from './OptionShape';

/** Pantalla de espera entre preguntas (anfitrión y jugadores). */
export function GetReady({ countdown, clockOffset, size }: {
  countdown: CountdownView;
  clockOffset: number;
  size: 'sm' | 'lg';
}) {
  const big = size === 'lg';
  return (
    <div className="flex flex-1 animate-[pop_300ms_both] flex-col items-center justify-center gap-5 text-center">
      <p className={`font-mono font-bold text-ink-soft ${big ? 'text-lg sm:text-2xl' : 'text-sm'}`}>
        {String(countdown.index + 1).padStart(2, '0')} / {String(countdown.total).padStart(2, '0')}
      </p>
      <p className={`font-extrabold tracking-tight ${big ? 'text-5xl sm:text-7xl xl:text-8xl' : 'text-4xl'}`}>
        Atentos
      </p>
      <p
        className={`rounded-full border-2 border-ink bg-white px-4 py-1 font-semibold ${big ? 'text-lg sm:text-xl' : 'text-sm'}`}
      >
        {QUESTION_TYPE_LABELS[countdown.type]}
      </p>
      <CountdownCircle endsAt={countdown.endsAt} clockOffset={clockOffset} totalSec={QUESTION_COUNTDOWN_SEC} />
    </div>
  );
}
