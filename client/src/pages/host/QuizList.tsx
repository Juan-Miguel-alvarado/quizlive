import type { QuizSummary } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Wordmark } from '../../components/Wordmark';
import { api } from '../../lib/api';
import { hostTokens } from '../../lib/session';

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

export default function QuizList() {
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listQuizzes().then(setQuizzes, (e: Error) => setError(e.message));
  }, []);

  async function handleStart(quiz: QuizSummary) {
    setStarting(quiz.id);
    try {
      const { pin, hostToken } = await api.createGame(quiz.id);
      hostTokens.set(pin, hostToken);
      navigate(`/host/game/${pin}`);
    } catch (e) {
      setError((e as Error).message);
      setStarting(null);
    }
  }

  async function handleDelete(quiz: QuizSummary) {
    if (!confirm(`¿Borrar «${quiz.title}»? No se puede deshacer.`)) return;
    try {
      await api.deleteQuiz(quiz.id);
      setQuizzes((qs) => qs?.filter((q) => q.id !== quiz.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <Wordmark />
        <Link to="/host/quizzes/new" className="btn btn-accent">
          + Nuevo quiz
        </Link>
      </header>

      <div className="mb-4 flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Tus quizzes</h1>
        {quizzes && <span className="font-mono text-sm text-ink-soft">{quizzes.length}</span>}
      </div>

      {error && <p className="mb-4 rounded-md border-2 border-bad bg-bad/10 p-3 font-semibold text-bad">{error}</p>}
      {quizzes === null && !error && <p className="py-10 text-ink-soft">Cargando…</p>}
      {quizzes?.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg font-semibold">Todavía no hay nada aquí.</p>
          <p className="mt-1 text-ink-soft">Crea un quiz y lánzalo en clase.</p>
        </div>
      )}

      <ul className="divide-y-2 divide-ink/10">
        {quizzes?.map((quiz) => (
          <li key={quiz.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="min-w-0 flex-1">
              <Link
                to={`/host/quizzes/${quiz.id}`}
                className="text-lg font-bold break-words underline-offset-4 hover:underline sm:text-xl"
              >
                {quiz.title}
              </Link>
              <p className="font-mono text-xs text-ink-soft">
                {quiz.questionCount} {quiz.questionCount === 1 ? 'pregunta' : 'preguntas'} · {dateFormat.format(new Date(quiz.updatedAt))}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleStart(quiz)}
                disabled={starting !== null || quiz.questionCount === 0}
                className="btn btn-primary flex-1 sm:flex-none"
              >
                {starting === quiz.id ? 'Creando…' : 'Lanzar ▸'}
              </button>
              <Link to={`/host/quizzes/${quiz.id}`} className="btn btn-plain">
                Editar
              </Link>
              <button
                onClick={() => handleDelete(quiz)}
                aria-label={`Borrar ${quiz.title}`}
                className="btn btn-plain text-bad"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
