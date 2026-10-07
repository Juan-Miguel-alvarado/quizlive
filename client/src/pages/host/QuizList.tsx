import type { QuizSummary } from '@quiz/shared';
import { useEffect, useState } from 'react';
import {
  BoxArrowLeft,
  CheckLg,
  ClockHistory,
  Copy,
  Pencil,
  PencilSquare,
  PlayFill,
  PlusLg,
  Trash3,
  XLg,
} from 'react-bootstrap-icons';
import { Link, useNavigate } from 'react-router';
import { Wordmark } from '../../components/Wordmark';
import { api } from '../../lib/api';
import { hostSession, hostTokens } from '../../lib/session';

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

export default function QuizList() {
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const navigate = useNavigate();

  const reload = () => api.listQuizzes().then(setQuizzes, (e: Error) => setError(e.message));

  async function handleRename() {
    if (!renaming) return;
    const title = renaming.title.trim();
    if (!title) return setError('El nombre no puede quedar vacío');
    try {
      await api.renameQuiz(renaming.id, title);
      setQuizzes((qs) => qs?.map((q) => (q.id === renaming.id ? { ...q, title } : q)) ?? null);
      setRenaming(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDuplicate(quiz: QuizSummary) {
    try {
      await api.duplicateQuiz(quiz.id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

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
    if (!confirm(`¿Borrar la trivia «${quiz.title}» con todas sus preguntas? No se puede deshacer.`)) return;
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
        <div className="flex flex-wrap gap-2">
          <Link to="/host/history" className="btn btn-plain">
            <ClockHistory />
            Partidas jugadas
          </Link>
          <button
            onClick={() => {
              hostSession.clear();
              location.reload();
            }}
            className="btn btn-plain"
          >
            <BoxArrowLeft />
            Salir
          </button>
          <Link to="/host/quizzes/new" className="btn btn-accent">
            <PlusLg />
            Nueva trivia
          </Link>
        </div>
      </header>

      <div className="mb-4 flex items-baseline justify-between border-b-2 border-white/25 pb-2">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Tus trivias</h1>
        {quizzes && <span className="font-mono text-sm text-stage-soft">{quizzes.length}</span>}
      </div>

      {error && <p className="mb-4 rounded-xl bg-bad p-3 font-bold text-white shadow-3d-sm">{error}</p>}
      {quizzes === null && !error && <p className="py-10 text-stage-soft">Cargando…</p>}
      {quizzes?.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg font-semibold">Todavía no hay nada aquí.</p>
          <p className="mt-1 text-stage-soft">Crea una trivia (por ejemplo «Día de la Biblia») con sus series y preguntas.</p>
        </div>
      )}

      <ul className="space-y-3">
        {quizzes?.map((quiz) => (
          <li key={quiz.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="min-w-0 flex-1">
              {renaming?.id === quiz.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleRename();
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={renaming.title}
                    onChange={(e) => setRenaming({ id: quiz.id, title: e.target.value })}
                    maxLength={120}
                    autoFocus
                    aria-label="Nuevo nombre"
                    className="field py-1 text-lg font-bold"
                  />
                  <button className="btn btn-accent px-3" title="Guardar nombre">
                    <CheckLg />
                  </button>
                  <button type="button" onClick={() => setRenaming(null)} className="btn btn-light px-3" title="Cancelar">
                    <XLg />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1">
                  <Link
                    to={`/host/quizzes/${quiz.id}`}
                    className="text-lg font-bold break-words underline-offset-4 hover:underline sm:text-xl"
                  >
                    {quiz.title}
                  </Link>
                  <button
                    onClick={() => setRenaming({ id: quiz.id, title: quiz.title })}
                    title="Renombrar"
                    className="grid size-8 shrink-0 place-items-center rounded-md text-ink-soft hover:bg-paper hover:text-ink"
                  >
                    <Pencil />
                  </button>
                </div>
              )}
              <p className="font-mono text-xs text-ink-soft">
                {quiz.seriesCount} {quiz.seriesCount === 1 ? 'serie' : 'series'} · {quiz.questionCount}{' '}
                {quiz.questionCount === 1 ? 'pregunta' : 'preguntas'} · {dateFormat.format(new Date(quiz.updatedAt))}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleStart(quiz)}
                disabled={starting !== null || quiz.questionCount === 0}
                className="btn btn-accent flex-1 sm:flex-none"
              >
                {starting === quiz.id ? (
                  'Creando…'
                ) : (
                  <>
                    <PlayFill className="size-5" />
                    Abrir sala
                  </>
                )}
              </button>
              <Link to={`/host/quizzes/${quiz.id}`} className="btn btn-light">
                <PencilSquare />
                Editar
              </Link>
              <button onClick={() => handleDuplicate(quiz)} className="btn btn-light" title="Duplicar para usarla de base">
                <Copy />
                Duplicar
              </button>
              <button
                onClick={() => handleDelete(quiz)}
                aria-label={`Borrar ${quiz.title}`}
                className="btn btn-light text-bad"
              >
                <Trash3 />
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
