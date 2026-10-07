import { Link } from 'react-router';
import { OptionShape } from './OptionShape';

export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const big = size === 'lg';
  return (
    <Link to="/" className="inline-flex items-center gap-2" aria-label="QuizLive, inicio">
      <span className={`grid grid-cols-2 gap-0.5 ${big ? 'size-12' : 'size-6'}`} aria-hidden="true">
        <OptionShape shape="triangle" className="size-full text-opt-red" />
        <OptionShape shape="diamond" className="size-full text-opt-blue" />
        <OptionShape shape="circle" className="size-full text-opt-yellow" />
        <OptionShape shape="square" className="size-full text-opt-green" />
      </span>
      <span className={`font-black tracking-tight text-white ${big ? 'text-5xl sm:text-6xl' : 'text-xl'}`}>QuizLive</span>
    </Link>
  );
}
