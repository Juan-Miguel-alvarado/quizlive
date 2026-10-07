import type { GameReport } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRepeat } from 'react-bootstrap-icons';
import { Link, useNavigate, useParams } from 'react-router';
import { Wordmark } from '../../components/Wordmark';
import { api } from '../../lib/api';

const RETRY_THRESHOLD = 0.6; // igual que en el servidor

export default function GameReportPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<GameReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getReport(id).then(setReport, (e: Error) => setError(e.message));
  }, [id]);

  async function createRetryQuiz() {
    setBusy(true);
    setError(null);
    try {
      const quiz = await api.retryFailed(id);
      navigate(`/host/quizzes/${quiz.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (error && !report) return <p className="m-8 rounded-xl bg-bad p-3 font-bold text-white">{error}</p>;
  if (!report) return <p className="p-8 text-stage-soft">Cargando…</p>;

  const failed = report.questions.filter((q) => q.correctRatio < RETRY_THRESHOLD);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-[calc(1.5rem+var(--badge-space))] sm:py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Wordmark />
        <Link to="/host/history" className="btn btn-plain">
          <ArrowLeft />
          Partidas
        </Link>
      </header>

      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{report.quizTitle}</h1>
      <p className="mt-1 font-mono text-sm text-stage-soft">
        {new Date(report.finishedAt).toLocaleString('es')} · {report.playerCount} jugadores · PIN {report.pin}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Aciertos del grupo" value={`${Math.round(report.averageCorrectRatio * 100)}%`} />
        <Stat label="Preguntas" value={String(report.questionCount)} />
        <Stat label="Preguntas flojas" value={String(failed.length)} />
      </div>

      {failed.length > 0 && report.canRetry && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 border-l-8 border-accent p-4">
          <p className="font-bold">
            {failed.length} {failed.length === 1 ? 'pregunta se falló' : 'preguntas se fallaron'} mucho. ¿Repasarlas?
          </p>
          <button onClick={createRetryQuiz} disabled={busy} className="btn btn-dark">
            <ArrowRepeat />
            {busy ? 'Creando…' : 'Crear quiz de repaso'}
          </button>
        </div>
      )}
      {error && <p className="mt-3 rounded-xl bg-bad p-3 font-bold text-white">{error}</p>}

      <h2 className="mt-10 mb-3 text-xl font-black">Por pregunta</h2>
      <ol className="card space-y-3 p-4">
        {report.questions.map((q) => {
          const pct = Math.round(q.correctRatio * 100);
          const weak = q.correctRatio < RETRY_THRESHOLD;
          return (
            <li key={q.order} className="flex items-center gap-4">
              <span className="w-6 font-mono text-sm text-ink-soft">{String(q.order + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{q.text}</p>
                <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-paper-2">
                  <div
                    className={`h-full ${weak ? 'bg-bad' : 'bg-good'}`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                    role="img"
                    aria-label={`${pct}% de aciertos`}
                  />
                </div>
              </div>
              <span className="w-12 text-right font-mono font-bold">{pct}%</span>
              <span className="hidden w-20 text-right font-mono text-sm text-ink-soft sm:block">
                {q.averageResponseMs ? `${(q.averageResponseMs / 1000).toFixed(1)} s` : '—'}
              </span>
            </li>
          );
        })}
      </ol>

      <h2 className="mt-10 mb-3 text-xl font-black">Por jugador</h2>
      <div className="card overflow-x-auto px-4 py-2">
        <table className="w-full min-w-96 text-left">
          <thead className="text-xs tracking-wider text-ink-soft uppercase">
            <tr>
              <th className="py-2">#</th>
              <th>Jugador</th>
              <th className="text-right">Aciertos</th>
              <th className="text-right">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {report.players.map((p) => (
              <tr key={p.nickname} className="border-t-2 border-black/5">
                <td className="py-2 font-mono">{p.rank}</td>
                <td className="font-bold">{p.nickname}</td>
                <td className="text-right font-mono">
                  {p.correct}/{report.questionCount}
                </td>
                <td className="text-right font-mono font-bold">{p.score.toLocaleString('es')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="text-3xl font-black tabular-nums">{value}</p>
    </div>
  );
}
