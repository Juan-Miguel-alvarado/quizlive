import type { QuestionType } from '@quiz/shared';

type Shape = 'triangle' | 'diamond' | 'circle' | 'square';

export interface OptionStyle {
  shape: Shape;
  label: string;
  bg: string;
  text: string; // color de texto con contraste suficiente sobre bg
}

const STYLES: OptionStyle[] = [
  { shape: 'triangle', label: 'Triángulo', bg: 'bg-opt-red', text: 'text-white' },
  { shape: 'diamond', label: 'Rombo', bg: 'bg-opt-blue', text: 'text-white' },
  { shape: 'circle', label: 'Círculo', bg: 'bg-opt-yellow', text: 'text-ink' },
  { shape: 'square', label: 'Cuadrado', bg: 'bg-opt-green', text: 'text-white' },
];

/** Verdadero = rombo azul, Falso = triángulo rojo; el resto por posición. */
export function optionStyle(type: QuestionType, index: number): OptionStyle {
  if (type === 'truefalse') return STYLES[index === 0 ? 1 : 0]!;
  return STYLES[index]!;
}

export function OptionShape({ shape, className = 'size-6' }: { shape: Shape; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      {shape === 'triangle' && <path d="M12 3 22.5 21h-21z" />}
      {shape === 'diamond' && <path d="M12 1.5 22.5 12 12 22.5 1.5 12z" />}
      {shape === 'circle' && <circle cx="12" cy="12" r="10" />}
      {shape === 'square' && <rect x="3" y="3" width="18" height="18" rx="1.5" />}
    </svg>
  );
}

export const QUESTION_TYPE_SHORT_LABELS: Record<QuestionType, string> = {
  single: 'Única',
  multiple: 'Múltiple',
  truefalse: 'V / F',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: 'Opción única',
  multiple: 'Selección múltiple',
  truefalse: 'Verdadero o falso',
};
