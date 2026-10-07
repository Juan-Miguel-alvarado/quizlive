import { useLayoutEffect, useRef } from 'react';

/**
 * Texto que ocupa todo el espacio de su caja con la letra más grande que quepa, sin cortarse ni
 * desbordarse. La caja necesita un tamaño definido (p. ej. `flex-1 min-h-0` o una altura fija).
 * Pensado para la pantalla TV, donde todo debe leerse desde el fondo del salón.
 */
export function FitText({
  text,
  max = 400,
  min = 12,
  className = '',
  align = 'center',
}: {
  text: string;
  max?: number; // px
  min?: number; // px
  className?: string;
  align?: 'center' | 'left';
}) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = inner.current;
    const container = box.current;
    if (!el || !container) return;
    const fits = () => el.scrollHeight <= container.clientHeight && el.scrollWidth <= container.clientWidth;
    const fit = () => {
      // Búsqueda binaria del tamaño de letra más grande que cabe.
      let lo = min;
      let hi = max;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        el.style.fontSize = `${mid}px`;
        if (fits()) lo = mid;
        else hi = mid;
      }
      el.style.fontSize = `${lo}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    // Roboto llega de Google Fonts: al cargar cambia el ancho del texto.
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [text, max, min]);

  return (
    <div
      ref={box}
      className={`flex min-h-0 min-w-0 items-center overflow-hidden ${align === 'center' ? 'justify-center text-center' : 'justify-start text-left'} ${className}`}
    >
      <span ref={inner} className="block w-full leading-[1.12] text-balance break-words">
        {text}
      </span>
    </div>
  );
}
