import type { Reaction } from '@quiz/shared';
import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';

interface Floating {
  id: number;
  emoji: Reaction;
  count: number; // cuántos mandaron ese emoji en este envío (se muestra "×12")
  side: 'left' | 'right';
  offset: number; // % desde el borde
  drift: number; // px
  durationMs: number;
  delayMs: number; // las de un mismo envío salen escalonadas, no amontonadas
}

const MAX_ON_SCREEN = 24;
const MAX_PER_EMOJI_BATCH = 3; // 80 aplausos a la vez: 3 burbujas grandes con "×80", no un muro de emojis

/**
 * Capa del proyector: las reacciones de los jugadores suben flotando en burbujas grandes por los
 * bordes de la pantalla. `rightOnly` las deja solo a la derecha (en el lobby).
 */
export function Reactions({ rightOnly = false }: { rightOnly?: boolean }) {
  const [items, setItems] = useState<Floating[]>([]);
  const nextId = useRef(0);
  const rightOnlyRef = useRef(rightOnly);
  rightOnlyRef.current = rightOnly;

  useEffect(() => {
    const socket = getSocket();
    const onReactions = ({ counts }: { counts: Partial<Record<Reaction, number>> }) => {
      const fresh: Floating[] = [];
      for (const [emoji, count] of Object.entries(counts) as [Reaction, number][]) {
        for (let i = 0; i < Math.min(count, MAX_PER_EMOJI_BATCH); i++) {
          fresh.push({
            id: nextId.current++,
            emoji,
            count: i === 0 ? count : 1, // el total va solo en la primera burbuja
            // Solo por los bordes: el centro es para el PIN, los nombres y el podio.
            side: rightOnlyRef.current || Math.random() < 0.5 ? 'right' : 'left',
            // Las burbujas caben en el margen libre a los lados del contenido (el lobby reserva 7,5rem).
            offset: 0.3 + Math.random() * 1.2,
            drift: (Math.random() - 0.5) * 60,
            durationMs: 3200 + Math.random() * 1400,
            delayMs: Math.random() * 1200,
          });
        }
      }
      setItems((cur) => [...cur, ...fresh].slice(-MAX_ON_SCREEN));
    };
    socket.on('host:reactions', onReactions);
    return () => {
      socket.off('host:reactions', onReactions);
    };
  }, []);

  const remove = (id: number) => setItems((cur) => cur.filter((it) => it.id !== id));

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {items.map((it) => (
        <span
          key={it.id}
          onAnimationEnd={() => remove(it.id)}
          className="absolute bottom-0 grid size-24 animate-[float-up_var(--dur)_ease-out_both] place-items-center rounded-full bg-white text-6xl shadow-3d-lg xl:size-28 xl:text-7xl"
          style={
            {
              [it.side]: `${it.offset}%`,
              animationDelay: `${it.delayMs}ms`,
              '--drift': `${it.drift}px`,
              '--dur': `${it.durationMs}ms`,
            } as React.CSSProperties
          }
        >
          {it.emoji}
          {it.count > 1 && (
            // El contador va hacia el centro de la pantalla para que no se salga por el borde.
            <span
              className={`absolute -top-2 ${it.side === 'right' ? '-left-3' : '-right-3'} rounded-full bg-opt-green px-2 font-sans text-xl font-black text-white shadow-3d-sm xl:text-2xl`}
            >
              ×{it.count}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
