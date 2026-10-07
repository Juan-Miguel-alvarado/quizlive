import { AVATARS, type Avatar } from '@quiz/shared';

export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (a: Avatar) => void }) {
  return (
    <div role="radiogroup" aria-label="Elige tu dibujo" className="grid grid-cols-6 gap-1.5">
      {AVATARS.map((a) => {
        const selected = a.emoji === value;
        return (
          <button
            key={a.emoji}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={a.name}
            title={a.name}
            onClick={() => onChange(a.emoji)}
            className={`grid aspect-square place-items-center rounded-xl border-2 text-2xl transition-transform duration-75 active:scale-90 sm:text-3xl ${
              selected ? 'scale-105 border-stage-dark bg-stage-light shadow-3d-sm' : 'border-transparent bg-paper hover:border-stage-light/40'
            }`}
          >
            {a.emoji}
          </button>
        );
      })}
    </div>
  );
}
