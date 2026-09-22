import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/sound';

/** Cuenta regresiva basada en la hora de fin que dicta el servidor (corrigiendo el desfase de reloj). */
export function useRemainingMs(endsAt: number, clockOffset: number) {
  const calc = () => Math.max(0, endsAt - (Date.now() + clockOffset));
  const [remaining, setRemaining] = useState(calc);
  useEffect(() => {
    setRemaining(calc());
    const id = setInterval(() => setRemaining(calc()), 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, clockOffset]);
  return remaining;
}

export function CountdownCircle({ endsAt, clockOffset, totalSec, size = 'lg', audible = false }: {
  endsAt: number;
  clockOffset: number;
  totalSec: number;
  size?: 'sm' | 'lg';
  audible?: boolean; // un tic por segundo en los últimos 5 (pantalla del anfitrión)
}) {
  const remaining = useRemainingMs(endsAt, clockOffset);
  const lastTick = useRef(0);
  const seconds = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (!audible || seconds > 5 || seconds <= 0 || lastTick.current === seconds) return;
    lastTick.current = seconds;
    sound.tick();
  }, [audible, seconds]);
  const fraction = remaining / (totalSec * 1000);
  const r = 44;
  const urgent = remaining <= 5000 && totalSec > 5;
  return (
    <div
      className={`relative shrink-0 ${size === 'lg' ? 'size-24 sm:size-32 xl:size-40' : 'size-12'}`}
      role="timer"
      aria-label={`${Math.ceil(remaining / 1000)} segundos`}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} className="fill-white stroke-ink" strokeWidth="4" />
        <circle
          cx="50"
          cy="50"
          r={r - 8}
          fill="none"
          strokeWidth={size === 'lg' ? 10 : 14}
          className={`transition-[stroke-dashoffset] duration-100 ease-linear ${urgent ? 'stroke-bad' : 'stroke-accent'}`}
          strokeDasharray={2 * Math.PI * (r - 8)}
          strokeDashoffset={2 * Math.PI * (r - 8) * (1 - fraction)}
        />
      </svg>
      <span
        className={`absolute inset-0 grid place-items-center font-extrabold tabular-nums ${
          size === 'lg' ? 'text-3xl sm:text-5xl xl:text-6xl' : 'text-lg'
        } ${urgent ? 'text-bad' : ''}`}
      >
        {seconds}
      </span>
    </div>
  );
}
