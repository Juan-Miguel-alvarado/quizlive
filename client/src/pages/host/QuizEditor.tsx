import {
  CSV_TEMPLATE,
  MAX_OPTIONS,
  MIN_OPTIONS,
  QUESTION_TYPES,
  parseQuizCsv,
  quizInputSchema,
  TIME_LIMITS,
  TRUE_FALSE_OPTIONS,
  type QuestionInput,
  type QuestionType,
} from '@quiz/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  OptionShape,
  optionStyle,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_SHORT_LABELS,
} from '../../components/OptionShape';
import { api, ApiRequestError } from '../../lib/api';
import { imageUrl, uploadImage } from '../../lib/images';

/** En el editor cada pregunta lleva una clave estable para que React no mezcle inputs al reordenar. */
type DraftQuestion = QuestionInput & { key: string };
type Errors = Record<string, string>;

// crypto.randomUUID no existe en http://<IP-local> (contexto no seguro); basta con algo único en memoria.
let keySeq = 0;
const newKey = () => `q${++keySeq}`;

const emptyQuestion = (): DraftQuestion => ({
  key: newKey(),
  type: 'single',
  text: '',
  imageId: null,
  options: ['', '', '', ''],
  correctIndices: [0],
  timeLimitSec: 20,
});

/** Adapta opciones y respuestas correctas al cambiar de tipo, conservando lo que se pueda. */
function changeType(q: DraftQuestion, type: QuestionType): DraftQuestion {
  if (type === q.type) return q;
  if (type === 'truefalse') {
    return { ...q, type, options: [...TRUE_FALSE_OPTIONS], correctIndices: [q.correctIndices[0] === 1 ? 1 : 0] };
  }
  const options = q.type === 'truefalse' ? ['', '', '', ''] : q.options;
  const correctIndices = type === 'single' ? [q.correctIndices[0] ?? 0] : q.correctIndices;
  return { ...q, type, options, correctIndices };
}

export default function QuizEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[] | null>(id ? null : [emptyQuestion()]);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getQuiz(id).then(
      (quiz) => {
        setTitle(quiz.title);
        setQuestions(quiz.questions.map(({ id: _id, ...q }) => ({ ...q, key: newKey() })));
      },
      (e: Error) => setFormError(e.message),
    );
  }, [id]);

  if (!questions) {
    return <p className="p-8 text-ink-soft">{formError ?? 'Cargando…'}</p>;
  }

  const update = (index: number, fn: (q: DraftQuestion) => DraftQuestion) =>
    setQuestions(questions.map((q, i) => (i === index ? fn(q) : q)));

  const move = (index: number, delta: -1 | 1) => {
    const next = [...questions];
    [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
    setQuestions(next);
    setErrors({}); // los errores están indexados por posición
  };

  const remove = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
    setErrors({});
  };

  const duplicate = (index: number) => {
    const next = [...questions];
    next.splice(index + 1, 0, { ...questions[index]!, key: newKey() });
    setQuestions(next);
    setErrors({});
  };

  async function handleSave() {
    setFormError(null);
    const parsed = quizInputSchema.safeParse({ title, questions: questions!.map(({ key: _k, ...q }) => q) });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      setFormError('Hay campos por corregir');
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (id) await api.updateQuiz(id, parsed.data);
      else await api.createQuiz(parsed.data);
      navigate('/host');
    } catch (e) {
      if (e instanceof ApiRequestError && e.issues?.length) {
        setErrors(Object.fromEntries(e.issues.map((i) => [i.path, i.message])));
      }
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const questionHasError = (i: number) => Object.keys(errors).some((k) => k.startsWith(`questions.${i}.`));

  return (
    <div className="min-h-dvh pb-[calc(7rem+var(--badge-space))]">
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/host" className="btn btn-plain px-3" aria-label="Volver a mis quizzes">
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Título del quiz"
              aria-label="Título del quiz"
              className={`w-full rounded-md bg-transparent px-2 py-1 text-xl font-extrabold tracking-tight outline-none placeholder:text-ink-soft/50 focus:bg-white sm:text-2xl ${
                errors.title ? 'ring-2 ring-bad' : ''
              }`}
            />
          </div>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent hidden sm:inline-flex">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl gap-8 px-4 pt-6 lg:grid lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Preguntas" className="hidden lg:block">
          <ol className="sticky top-24 space-y-1">
            {questions.map((q, i) => (
              <li key={q.key}>
                <a
                  href={`#q-${q.key}`}
                  className="flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-paper-2"
                >
                  <span className="font-mono text-xs text-ink-soft">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`truncate ${questionHasError(i) ? 'text-bad' : ''}`}>
                    {q.text || <em className="text-ink-soft">Sin texto</em>}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="min-w-0">
          <FieldError message={errors.title} />
          <ol className="space-y-6">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.key}
                q={q}
                index={i}
                count={questions.length}
                errors={errors}
                onChange={(fn) => update(i, fn)}
                onMove={(d) => move(i, d)}
                onRemove={() => remove(i)}
                onDuplicate={() => duplicate(i)}
              />
            ))}
          </ol>

          <ImportCsv
            onImport={(imported) => {
              setQuestions([...questions, ...imported.map((q) => ({ ...q, key: newKey() }))]);
              setErrors({});
            }}
          />

          <button
            onClick={() => setQuestions([...questions, emptyQuestion()])}
            disabled={questions.length >= 50}
            className="mt-6 w-full rounded-lg border-2 border-dashed border-ink/40 py-5 font-bold text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
          >
            + Añadir pregunta
          </button>
          <FieldError message={errors.questions} />
        </main>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-ink bg-paper px-4 pt-3 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+var(--badge-space))]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="text-sm font-semibold text-bad" role="status">
            {formError}
          </p>
          <p className="hidden text-sm text-ink-soft sm:block">
            {questions.length} {questions.length === 1 ? 'pregunta' : 'preguntas'}
          </p>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent sm:hidden">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </footer>
    </div>
  );
}

function QuestionCard(props: {
  q: DraftQuestion;
  index: number;
  count: number;
  errors: Errors;
  onChange: (fn: (q: DraftQuestion) => DraftQuestion) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { q, index, errors, onChange } = props;
  const err = (field: string) => errors[`questions.${index}.${field}`];
  const optionError =
    err('options') ?? q.options.map((_, oi) => err(`options.${oi}`)).find(Boolean) ?? err('correctIndices');

  const toggleCorrect = (oi: number) =>
    onChange((cur) => {
      if (cur.type !== 'multiple') return { ...cur, correctIndices: [oi] };
      const has = cur.correctIndices.includes(oi);
      return {
        ...cur,
        correctIndices: has ? cur.correctIndices.filter((c) => c !== oi) : [...cur.correctIndices, oi].sort(),
      };
    });

  const removeOption = (oi: number) =>
    onChange((cur) => ({
      ...cur,
      options: cur.options.filter((_, i) => i !== oi),
      // Reajusta los índices correctos a la nueva numeración.
      correctIndices: cur.correctIndices.filter((c) => c !== oi).map((c) => (c > oi ? c - 1 : c)),
    }));

  return (
    <li id={`q-${q.key}`} className="card scroll-mt-24 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm font-bold">{String(index + 1).padStart(2, '0')}</span>
        <div
          role="radiogroup"
          aria-label="Tipo de pregunta"
          className="order-last grid w-full grid-cols-3 rounded-md border-2 border-ink sm:order-none sm:flex sm:w-auto"
        >
          {QUESTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={q.type === t}
              onClick={() => onChange((cur) => changeType(cur, t))}
              className={`px-3 py-1.5 text-sm font-semibold not-last:border-r-2 not-last:border-ink sm:py-1 ${
                q.type === t ? 'bg-ink text-paper' : 'hover:bg-paper-2'
              }`}
            >
              <span className="sm:hidden">{QUESTION_TYPE_SHORT_LABELS[t]}</span>
              <span className="hidden sm:inline">{QUESTION_TYPE_LABELS[t]}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <span className="sr-only sm:not-sr-only">Tiempo</span>
          <select
            value={q.timeLimitSec}
            onChange={(e) => onChange((cur) => ({ ...cur, timeLimitSec: Number(e.target.value) }))}
            className="field w-auto py-1 font-mono"
          >
            {TIME_LIMITS.map((t) => (
              <option key={t} value={t}>
                {t} s
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-1">
          <IconButton label="Subir" disabled={index === 0} onClick={() => props.onMove(-1)}>
            ↑
          </IconButton>
          <IconButton label="Bajar" disabled={index === props.count - 1} onClick={() => props.onMove(1)}>
            ↓
          </IconButton>
          <IconButton label="Duplicar" disabled={props.count >= 50} onClick={props.onDuplicate}>
            ⧉
          </IconButton>
          <IconButton label="Eliminar" disabled={props.count === 1} onClick={props.onRemove}>
            ✕
          </IconButton>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
        <div>
          <textarea
            value={q.text}
            onChange={(e) => onChange((cur) => ({ ...cur, text: e.target.value }))}
            maxLength={300}
            rows={3}
            placeholder="Escribe la pregunta"
            aria-label={`Texto de la pregunta ${index + 1}`}
            className="field resize-none text-lg font-semibold"
          />
          <FieldError message={err('text')} />
        </div>
        <ImagePicker imageId={q.imageId} onChange={(imageId) => onChange((cur) => ({ ...cur, imageId }))} />
      </div>

      <p className="eyebrow mt-5 mb-2">
        {q.type === 'multiple' ? 'Opciones · marca todas las correctas' : 'Opciones · marca la correcta'}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((opt, oi) => {
          const style = optionStyle(q.type, oi);
          const correct = q.correctIndices.includes(oi);
          return (
            <div
              key={oi}
              className={`flex items-center gap-2 rounded-md border-2 border-ink bg-white p-1.5 ${
                correct ? 'shadow-hard-sm outline-2 outline-offset-1 outline-good' : ''
              }`}
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded ${style.bg} ${style.text}`}>
                <OptionShape shape={style.shape} className="size-4" />
              </span>
              {q.type === 'truefalse' ? (
                <span className="flex-1 px-1 font-semibold">{opt}</span>
              ) : (
                <input
                  value={opt}
                  onChange={(e) =>
                    onChange((cur) => ({
                      ...cur,
                      options: cur.options.map((o, i) => (i === oi ? e.target.value : o)),
                    }))
                  }
                  maxLength={120}
                  placeholder={`Opción ${oi + 1}`}
                  aria-label={`Opción ${oi + 1}`}
                  className="min-w-0 flex-1 px-1 py-1 font-semibold outline-none placeholder:font-normal placeholder:text-ink-soft/60"
                />
              )}
              <button
                type="button"
                role={q.type === 'multiple' ? 'checkbox' : 'radio'}
                aria-checked={correct}
                aria-label={`Marcar opción ${oi + 1} como correcta`}
                onClick={() => toggleCorrect(oi)}
                className={`grid size-8 shrink-0 place-items-center border-2 border-ink text-sm font-black ${
                  q.type === 'multiple' ? 'rounded' : 'rounded-full'
                } ${correct ? 'bg-good text-white' : 'bg-white text-transparent hover:text-ink/30'}`}
              >
                ✓
              </button>
              {q.type !== 'truefalse' && q.options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  aria-label={`Quitar opción ${oi + 1}`}
                  onClick={() => removeOption(oi)}
                  className="px-1 text-ink-soft hover:text-bad"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
      {q.type !== 'truefalse' && q.options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={() => onChange((cur) => ({ ...cur, options: [...cur.options, ''] }))}
          className="mt-2 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          + Añadir opción
        </button>
      )}
      <FieldError message={optionError} />
    </li>
  );
}

function ImagePicker({ imageId, onChange }: { imageId: string | null; onChange: (id: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {imageId ? (
        <div className="relative overflow-hidden rounded-md border-2 border-ink bg-paper-2">
          <img src={imageUrl(imageId)} alt="" className="aspect-video w-full object-contain" />
          <div className="absolute inset-x-1 bottom-1 flex gap-1">
            <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-plain flex-1 px-2 py-0.5 text-xs">
              Cambiar
            </button>
            <button type="button" onClick={() => onChange(null)} className="btn btn-plain px-2 py-0.5 text-xs">
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files[0]);
          }}
          className="grid h-11 w-full place-items-center rounded-md border-2 border-dashed border-ink/40 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:animate-pulse md:aspect-video md:h-auto"
        >
          {uploading ? 'Subiendo…' : '+ Imagen (opcional)'}
        </button>
      )}
      <FieldError message={error ?? undefined} />
    </div>
  );
}

function ImportCsv({ onImport }: { onImport: (questions: QuestionInput[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const { questions, errors } = parseQuizCsv(await file.text());
    setError(errors.length ? errors.slice(0, 3).join(' · ') : null);
    if (questions.length) onImport(questions);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="mt-6">
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-plain">
          Importar CSV
        </button>
        <button
          type="button"
          onClick={() => setHelp((h) => !h)}
          className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          {help ? 'Ocultar formato' : '¿Qué formato tiene?'}
        </button>
      </div>
      {help && (
        <pre className="mt-2 overflow-x-auto rounded-md border-2 border-ink bg-white p-3 text-xs">{CSV_TEMPLATE}</pre>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-sm font-semibold text-bad">{message}</p> : null;
}

function IconButton(props: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="grid size-8 place-items-center rounded-md border-2 border-transparent font-bold text-ink-soft hover:border-ink hover:text-ink disabled:opacity-25 disabled:hover:border-transparent"
    >
      {props.children}
    </button>
  );
}
