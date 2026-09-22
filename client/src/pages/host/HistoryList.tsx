import type { GameHistoryItem } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Wordmark } from '../../components/Wordmark';
import { api } from '../../lib/api';

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function HistoryList() {
  const [games, setGames] = useState<GameHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listHistory().then(setGames, (e: Error) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-[calc(1.5rem+var(--badge-space))] sm:py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <Wordmark />
        <Link to="/host" className="btn btn-plain">
          Tus quizzes
        </Link>
      </header>

      <h1 className="mb-4 border-b-2 border-ink pb-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Partidas jugadas
      </h1>

      {error && <p className="rounded-md border-2 border-bad bg-bad/10 p-3 font-semibold text-bad">{error}</p>}
      {games === null && !error && <p className="py-10 text-ink-soft">Cargando…</p>}
      {games?.length === 0 && (
        <p className="py-16 text-center text-ink-soft">Todavía no terminaste ninguna partida.</p>
      )}

      <ul className="divide-y-2 divide-ink/10">
        {games?.map((g) => (
          <li key={g.id}>
            <Link to={`/host/history/${g.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-4 hover:bg-paper-2">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold break-words">{g.quizTitle}</p>
                <p className="font-mono text-xs text-ink-soft">
                  {dateFormat.format(new Date(g.finishedAt))} · PIN {g.pin}
                </p>
              </div>
              <p className="font-mono text-sm">
                {g.playerCount} {g.playerCount === 1 ? 'jugador' : 'jugadores'} · {g.questionCount}{' '}
                {g.questionCount === 1 ? 'pregunta' : 'preguntas'}
              </p>
              <p className="w-20 text-right font-mono text-lg font-bold">{Math.round(g.averageCorrectRatio * 100)}%</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
