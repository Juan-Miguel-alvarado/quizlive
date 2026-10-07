import {
  CSV_TEMPLATE,
  DEFAULT_POINTS_CORRECT,
  DEFAULT_SPEED_BONUS,
  DEFAULT_TIME_LIMIT,
  MAX_OPTIONS,
  MIN_OPTIONS,
  QUESTION_TYPES,
  parsePastedQuestion,
  parsePastedQuestions,
  parseQuizCsv,
  quizInputSchema,
  TIME_LIMITS,
  TRUE_FALSE_OPTIONS,
  type PastedQuestion,
  type QuestionInput,
  type QuestionType,
} from '@quiz/shared';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircleFill,
  CheckLg,
  ClipboardPlus,
  Copy,
  ExclamationTriangleFill,
  FiletypeCsv,
  ImageFill,
  PlusLg,
  Save,
  Trash3,
  XLg,
} from 'react-bootstrap-icons';
import { Link, useNavigate, useParams } from 'react-router';
import {
  OptionShape,
  optionStyle,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_SHORT_LABELS,
} from '../../components/OptionShape';
import { api, ApiRequestError } from '../../lib/api';
import { imageUrl, uploadImage } from '../../lib/images';

/** En el editor cada pregunta y serie lleva una clave estable para que React no mezcle inputs al reordenar. */
type DraftQuestion = QuestionInput & { key: string };
type DraftSeries = { key: string; title: string; questions: DraftQuestion[] };
type Errors = Record<string, string>;

// crypto.randomUUID no existe en http://<IP-local> (contexto no seguro); basta con algo único en memoria.
let keySeq = 0;
const newKey = () => `k${++keySeq}`;

const emptyQuestion = (): DraftQuestion => ({
  key: newKey(),
  type: 'single',
  text: '',
  imageId: null,
  options: ['', '', '', ''],
  correctIndices: [0],
  timeLimitSec: DEFAULT_TIME_LIMIT,
  explanation: null,
});

const emptySeries = (n: number): DraftSeries => ({ key: newKey(), title: `Serie ${n}`, questions: [emptyQuestion()] });

/** Una pregunta sin tocar (la que trae una serie nueva): el pegado de varias la reemplaza. */
const isBlank = (q: DraftQuestion) => !q.text && q.options.every((o) => !o) && !q.imageId;

/** Pregunta del pegado rápido → pregunta del editor (4 opciones; sin asterisco queda sin marcar). */
function fromPasted(p: PastedQuestion, base: DraftQuestion = emptyQuestion()): DraftQuestion {
  return {
    ...base,
    type: base.type === 'truefalse' ? 'single' : base.type,
    text: p.text ?? base.text,
    options: p.options,
    correctIndices: p.correctIndex === null ? [] : [p.correctIndex],
  };
}

/** Adapta opciones y respuestas correctas al cambiar de tipo, conservando lo que se pueda. */
function changeType(q: DraftQuestion, type: QuestionType): DraftQuestion {
  if (type === q.type) return q;
  if (type === 'truefalse') {
    return { ...q, type, options: [...TRUE_FALSE_OPTIONS], correctIndices: [q.correctIndices[0] === 1 ? 1 : 0] };
  }
  const options = q.type === 'truefalse' ? ['', '', '', ''] : q.options;
  const correctIndices = type === 'single' ? (q.correctIndices[0] === undefined ? [] : [q.correctIndices[0]]) : q.correctIndices;
  return { ...q, type, options, correctIndices };
}

function swap<T>(list: T[], i: number, j: number): T[] {
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export default function QuizEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [pointsCorrect, setPointsCorrect] = useState(DEFAULT_POINTS_CORRECT);
  const [speedBonusMax, setSpeedBonusMax] = useState(DEFAULT_SPEED_BONUS);
  const [series, setSeries] = useState<DraftSeries[] | null>(id ? null : [emptySeries(1)]);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getQuiz(id).then(
      (quiz) => {
        setTitle(quiz.title);
        setPointsCorrect(quiz.pointsCorrect);
        setSpeedBonusMax(quiz.speedBonusMax);
        setSeries(
          quiz.series.map((s) => ({
            key: newKey(),
            title: s.title,
            questions: s.questions.map(({ id: _id, ...q }) => ({ ...q, key: newKey() })),
          })),
        );
      },
      (e: Error) => setFormError(e.message),
    );
  }, [id]);

  if (!series) {
    return <p className="p-8 text-stage-soft">{formError ?? 'Cargando…'}</p>;
  }

  // Los errores están indexados por posición: al mover o borrar se limpian.
  const change = (next: DraftSeries[]) => {
    setSeries(next);
    setErrors({});
  };
  const updateSeries = (si: number, fn: (s: DraftSeries) => DraftSeries) =>
    setSeries(series.map((s, i) => (i === si ? fn(s) : s)));

  const totalQuestions = series.reduce((n, s) => n + s.questions.length, 0);

  async function handleSave() {
    setFormError(null);
    const parsed = quizInputSchema.safeParse({
      title,
      pointsCorrect,
      speedBonusMax,
      series: series!.map((s) => ({ title: s.title, questions: s.questions.map(({ key: _k, ...q }) => q) })),
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      setFormError('Hay campos por corregir (marcados en rojo)');
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

  const hasError = (prefix: string) => Object.keys(errors).some((k) => k.startsWith(prefix));

  return (
    <div className="min-h-dvh pb-[calc(7rem+var(--badge-space))]">
      <header className="sticky top-0 z-20 bg-stage-dark/95 shadow-3d backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/host" className="btn btn-plain px-3" aria-label="Volver a mis trivias">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Nombre de la trivia (ej. Día de la Biblia)"
              aria-label="Nombre de la trivia"
              className={`w-full rounded-lg bg-transparent px-2 py-1 text-xl font-black tracking-tight text-white outline-none placeholder:text-white/50 focus:bg-white/10 sm:text-2xl ${
                errors.title ? 'ring-2 ring-bad' : ''
              }`}
            />
          </div>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent hidden sm:inline-flex">
            <Save />
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl gap-8 px-4 pt-6 lg:grid lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Series y preguntas" className="hidden lg:block">
          <ol className="sticky top-24 max-h-[calc(100dvh-8rem)] space-y-3 overflow-y-auto pr-1">
            {series.map((s, si) => (
              <li key={s.key}>
                <a href={`#s-${s.key}`} className={`block truncate px-2 text-sm font-black ${hasError(`series.${si}.`) ? 'text-[#ffb3c0]' : ''}`}>
                  {si + 1}. {s.title || 'Serie sin nombre'}
                </a>
                <ol className="mt-1 space-y-0.5">
                  {s.questions.map((q, qi) => (
                    <li key={q.key}>
                      <a href={`#q-${q.key}`} className="flex items-baseline gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white/10">
                        <span className="font-mono text-xs text-stage-soft">{String(qi + 1).padStart(2, '0')}</span>
                        <span className={`truncate ${hasError(`series.${si}.questions.${qi}.`) ? 'rounded bg-bad px-1 font-bold' : ''}`}>
                          {q.text || <em className="text-stage-soft">Sin texto</em>}
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </nav>

        <main className="min-w-0 space-y-6">
          <FieldError message={errors.title} />
          <ScoringCard
            pointsCorrect={pointsCorrect}
            speedBonusMax={speedBonusMax}
            onChange={(p, b) => {
              setPointsCorrect(p);
              setSpeedBonusMax(b);
            }}
            errors={errors}
          />

          {series.map((s, si) => (
            <SeriesSection
              key={s.key}
              series={s}
              index={si}
              count={series.length}
              errors={errors}
              onChange={(fn) => updateSeries(si, fn)}
              onReplace={(next) => change(series.map((x, i) => (i === si ? next : x)))}
              onMove={(d) => change(swap(series, si, si + d))}
              onRemove={() => {
                if (s.questions.some((q) => !isBlank(q)) && !confirm(`¿Borrar la serie "${s.title}" con sus ${s.questions.length} preguntas?`)) return;
                change(series.filter((_, i) => i !== si));
              }}
            />
          ))}

          <button
            onClick={() => change([...series, emptySeries(series.length + 1)])}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/40 py-5 text-lg font-black text-stage-soft transition-colors hover:border-white hover:bg-white/5 hover:text-white"
          >
            <PlusLg />
            Añadir serie
          </button>
          <FieldError message={errors.series} />
        </main>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 bg-stage-dark/95 px-4 backdrop-blur pt-3 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+var(--badge-space))]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="text-sm font-bold text-[#ffb3c0]" role="status">
            {formError}
          </p>
          <p className="hidden text-sm text-stage-soft sm:block">
            {series.length} {series.length === 1 ? 'serie' : 'series'} · {totalQuestions}{' '}
            {totalQuestions === 1 ? 'pregunta' : 'preguntas'}
          </p>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent sm:hidden">
            <Save />
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </footer>
    </div>
  );
}

/** Puntaje de la trivia: puntos fijos por acertar + bono por rapidez. */
function ScoringCard(props: {
  pointsCorrect: number;
  speedBonusMax: number;
  onChange: (pointsCorrect: number, speedBonusMax: number) => void;
  errors: Errors;
}) {
  const num = (v: string) => (v === '' ? 0 : Math.round(Number(v)));
  return (
    <section className="card p-4 sm:p-5">
      <p className="font-black">Puntaje</p>
      <p className="text-sm text-ink-soft">
        Quien acierta gana los puntos fijos más un bono: completo si responde al instante y casi nada en el último segundo.
        Equivocarse o no responder da 0.
      </p>
      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 font-bold">
          Puntos por acertar
          <input
            type="number"
            min={10}
            max={1000}
            value={props.pointsCorrect}
            onChange={(e) => props.onChange(num(e.target.value), props.speedBonusMax)}
            className="field w-24 py-1"
          />
        </label>
        <label className="flex items-center gap-2 font-bold">
          Bono máximo por rapidez
          <input
            type="number"
            min={0}
            max={500}
            value={props.speedBonusMax}
            onChange={(e) => props.onChange(props.pointsCorrect, num(e.target.value))}
            className="field w-24 py-1"
          />
        </label>
      </div>
      <FieldError message={props.errors.pointsCorrect ?? props.errors.speedBonusMax} />
    </section>
  );
}

function SeriesSection(props: {
  series: DraftSeries;
  index: number;
  count: number;
  errors: Errors;
  onChange: (fn: (s: DraftSeries) => DraftSeries) => void;
  /** Cambios que reordenan o reemplazan preguntas (limpian los errores por posición). */
  onReplace: (next: DraftSeries) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { series: s, index: si, errors } = props;
  const [pasting, setPasting] = useState(false);
  const setQuestions = (questions: DraftQuestion[]) => props.onReplace({ ...s, questions });
  /** Si la serie solo tiene la pregunta vacía del principio, lo nuevo la reemplaza. */
  const append = (added: DraftQuestion[]) =>
    setQuestions([...(s.questions.length === 1 && isBlank(s.questions[0]!) ? [] : s.questions), ...added]);

  return (
    <section id={`s-${s.key}`} className="scroll-mt-24 rounded-3xl bg-black/15 p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-stage-dark">Serie {si + 1}</span>
        <input
          value={s.title}
          onChange={(e) => props.onChange((cur) => ({ ...cur, title: e.target.value }))}
          maxLength={80}
          placeholder="Nombre de la serie (ej. ¿Quién dijo?)"
          aria-label={`Nombre de la serie ${si + 1}`}
          className={`min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-xl font-black text-white outline-none placeholder:text-white/50 focus:bg-white/10 ${
            errors[`series.${si}.title`] ? 'ring-2 ring-bad' : ''
          }`}
        />
        <div className="flex gap-1">
          <button className="btn btn-plain px-2" title="Subir serie" disabled={si === 0} onClick={() => props.onMove(-1)}>
            <ArrowUp />
          </button>
          <button className="btn btn-plain px-2" title="Bajar serie" disabled={si === props.count - 1} onClick={() => props.onMove(1)}>
            <ArrowDown />
          </button>
          <button className="btn btn-plain px-2" title="Borrar serie" disabled={props.count === 1} onClick={props.onRemove}>
            <Trash3 />
          </button>
        </div>
      </div>
      <FieldError message={errors[`series.${si}.title`]} onDark />

      {s.questions.length === 0 && (
        <p className="mb-4 rounded-xl bg-white/10 p-4 text-center text-stage-soft">
          Esta serie todavía no tiene preguntas. Mientras esté vacía, se salta al jugar.
        </p>
      )}

      <ol className="space-y-5">
        {s.questions.map((q, qi) => (
          <QuestionCard
            key={q.key}
            q={q}
            index={qi}
            count={s.questions.length}
            errPrefix={`series.${si}.questions.${qi}`}
            errors={errors}
            onChange={(fn) => props.onChange((cur) => ({ ...cur, questions: cur.questions.map((x, i) => (i === qi ? fn(x) : x)) }))}
            onMove={(d) => setQuestions(swap(s.questions, qi, qi + d))}
            onRemove={() => setQuestions(s.questions.filter((_, i) => i !== qi))}
            onDuplicate={() => {
              const next = [...s.questions];
              next.splice(qi + 1, 0, { ...q, key: newKey() });
              setQuestions(next);
            }}
          />
        ))}
      </ol>

      {pasting && (
        <BulkPaste
          onCancel={() => setPasting(false)}
          onUse={(pasted) => {
            append(pasted.map((p) => fromPasted(p)));
            setPasting(false);
          }}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={() => append([emptyQuestion()])} className="btn btn-primary">
          <PlusLg />
          Añadir pregunta
        </button>
        <button onClick={() => setPasting((p) => !p)} className="btn btn-plain">
          <ClipboardPlus />
          Pegar varias preguntas
        </button>
        <ImportCsv onImport={(imported) => append(imported.map((q) => ({ ...q, key: newKey() })))} />
      </div>
    </section>
  );
}

/** Vista previa de una pregunta pegada: lo que se va a guardar, con la correcta marcada. */
function PastePreview({ p, n }: { p: PastedQuestion; n?: number }) {
  return (
    <div className={`rounded-xl border-2 p-3 ${p.problem ? 'border-bad bg-bad/5' : 'border-black/10 bg-paper'}`}>
      {p.text !== null && (
        <p className="mb-2 font-black">
          {n !== undefined && <span className="text-ink-soft">{n}. </span>}
          {p.text}
        </p>
      )}
      <ul className="grid gap-1 sm:grid-cols-2">
        {p.options.map((o, i) => {
          const style = optionStyle('single', i);
          const correct = p.correctIndex === i;
          return (
            <li key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1 font-semibold ${correct ? 'bg-good/15' : ''}`}>
              <span className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-black ${style.bg} ${style.text}`}>
                {style.letter}
              </span>
              <span className="min-w-0 flex-1 break-words">{o}</span>
              {correct && <CheckCircleFill className="shrink-0 text-good" />}
            </li>
          );
        })}
      </ul>
      {p.problem ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-bad">
          <ExclamationTriangleFill /> {p.problem}
        </p>
      ) : (
        p.correctIndex === null && (
          <p className="mt-2 text-sm font-semibold text-ink-soft">Sin asterisco: marca la correcta después de agregarla.</p>
        )
      )}
    </div>
  );
}

const PASTE_HELP =
  'Pega la pregunta y sus 4 respuestas, una por línea (o solo las 4 respuestas). Se quitan solos los "a)", "A.", "1." y viñetas. Pon un * junto a la correcta para marcarla.';

/** Pegado rápido dentro de una pregunta. */
function QuickPaste({ onUse, onCancel }: { onUse: (p: PastedQuestion) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const parsed = text.trim() ? parsePastedQuestion(text) : null;
  return (
    <div className="mb-4 rounded-2xl border-2 border-stage-light/40 bg-stage-light/5 p-3">
      <p className="text-sm text-ink-soft">{PASTE_HELP}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        autoFocus
        placeholder={'¿Quién construyó el arca?\na) Noé*\nb) Moisés\nc) David\nd) Pedro'}
        className="field mt-2 font-mono text-sm"
      />
      {parsed && (
        <div className="mt-2">
          <PastePreview p={parsed} />
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onCancel} className="btn btn-light">
          Cancelar
        </button>
        <button disabled={!parsed || !!parsed.problem} onClick={() => parsed && onUse(parsed)} className="btn btn-accent">
          <CheckLg />
          Usar
        </button>
      </div>
    </div>
  );
}

/** Pegar una serie entera del Word: bloques de pregunta + 4 respuestas. */
function BulkPaste({ onUse, onCancel }: { onUse: (p: PastedQuestion[]) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const parsed = text.trim() ? parsePastedQuestions(text) : [];
  const problems = parsed.filter((p) => p.problem).length;
  return (
    <div className="card mt-4 p-4">
      <p className="font-black">Pegar varias preguntas</p>
      <p className="text-sm text-ink-soft">
        Copia del Word una serie entera: cada pregunta seguida de sus 4 respuestas. Los títulos sueltos se ignoran. Revisa
        la vista previa antes de agregarlas.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        autoFocus
        placeholder={'1. ¿Quién construyó el arca?\nNoé*\nMoisés\nDavid\nPedro\n2. ¿Cuántos años vivió Adán?\n900\n912\n930*\n969'}
        className="field mt-2 font-mono text-sm"
      />
      {parsed.length > 0 && (
        <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
          {parsed.map((p, i) => (
            <PastePreview key={i} p={p} n={i + 1} />
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {problems > 0 && (
          <p className="mr-auto text-sm font-bold text-bad">
            {problems} {problems === 1 ? 'pregunta necesita' : 'preguntas necesitan'} revisión
          </p>
        )}
        <button onClick={onCancel} className="btn btn-light">
          Cancelar
        </button>
        <button disabled={parsed.length === 0 || problems > 0} onClick={() => onUse(parsed)} className="btn btn-accent">
          <CheckLg />
          Agregar {parsed.length || ''} {parsed.length === 1 ? 'pregunta' : 'preguntas'}
        </button>
      </div>
    </div>
  );
}

function QuestionCard(props: {
  q: DraftQuestion;
  /** Posición dentro de su serie (desde 0). */
  index: number;
  count: number;
  /** Prefijo de los errores de esta pregunta: "series.1.questions.3". */
  errPrefix: string;
  errors: Errors;
  onChange: (fn: (q: DraftQuestion) => DraftQuestion) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { q, index, errors, onChange } = props;
  const err = (field: string) => errors[`${props.errPrefix}.${field}`];
  const [pasting, setPasting] = useState(false);
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
          className="order-last grid w-full grid-cols-3 overflow-hidden rounded-lg border-2 border-black/15 sm:order-none sm:flex sm:w-auto"
        >
          {QUESTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={q.type === t}
              onClick={() => onChange((cur) => changeType(cur, t))}
              className={`px-3 py-1.5 text-sm font-bold not-last:border-r-2 not-last:border-black/15 sm:py-1 ${
                q.type === t ? 'bg-stage text-white' : 'hover:bg-paper'
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
            <ArrowUp />
          </IconButton>
          <IconButton label="Bajar" disabled={index === props.count - 1} onClick={() => props.onMove(1)}>
            <ArrowDown />
          </IconButton>
          <IconButton label="Pegado rápido" onClick={() => setPasting((p) => !p)}>
            <ClipboardPlus />
          </IconButton>
          <IconButton label="Duplicar" onClick={props.onDuplicate}>
            <Copy />
          </IconButton>
          <IconButton label="Eliminar" onClick={props.onRemove}>
            <Trash3 />
          </IconButton>
        </div>
      </div>

      {pasting && (
        <QuickPaste
          onCancel={() => setPasting(false)}
          onUse={(pasted) => {
            onChange((cur) => fromPasted(pasted, cur));
            setPasting(false);
          }}
        />
      )}

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
              className={`flex items-center gap-2 rounded-lg border-2 border-black/15 bg-white p-1.5 ${
                correct ? 'shadow-hard-sm outline-2 outline-offset-1 outline-good' : ''
              }`}
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-md ${style.bg} ${style.text}`}>
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
                className={`grid size-8 shrink-0 place-items-center border-2 border-black/25 text-sm font-black ${
                  q.type === 'multiple' ? 'rounded' : 'rounded-full'
                } ${correct ? 'bg-good text-white' : 'bg-white text-transparent hover:text-ink/30'}`}
              >
                <CheckLg />
              </button>
              {q.type !== 'truefalse' && q.options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  aria-label={`Quitar opción ${oi + 1}`}
                  onClick={() => removeOption(oi)}
                  className="px-1 text-ink-soft hover:text-bad"
                >
                  <XLg />
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
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          <PlusLg />
          Añadir opción
        </button>
      )}
      <FieldError message={optionError} />

      <label className="mt-5 block">
        <span className="eyebrow">Explicación o versículo (opcional)</span>
        <span className="block text-sm text-ink-soft">Se muestra en la pantalla y en los celulares al revelar la respuesta.</span>
        <textarea
          value={q.explanation ?? ''}
          onChange={(e) => onChange((cur) => ({ ...cur, explanation: e.target.value || null }))}
          maxLength={300}
          rows={2}
          placeholder="Ej.: Génesis 6:14 — Dios le pidió a Noé construir el arca."
          className="field mt-2 resize-none"
        />
      </label>
      <FieldError message={err('explanation')} />
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
        <div className="relative overflow-hidden rounded-lg border-2 border-black/15 bg-paper">
          <img src={imageUrl(imageId)} alt="" className="aspect-video w-full object-contain" />
          <div className="absolute inset-x-1 bottom-1 flex gap-1">
            <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-light flex-1 px-2 py-0.5 text-xs">
              Cambiar
            </button>
            <button type="button" onClick={() => onChange(null)} className="btn btn-light px-2 py-0.5 text-xs">
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
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-ink/40 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:animate-pulse md:aspect-video md:h-auto"
        >
          {!uploading && <ImageFill />}
          {uploading ? 'Subiendo…' : 'Imagen (opcional)'}
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
    <div className="contents">
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-plain">
        <FiletypeCsv className="size-5" />
        Importar CSV
      </button>
      <button
        type="button"
        onClick={() => setHelp((h) => !h)}
        className="text-sm text-stage-soft underline-offset-4 hover:text-white hover:underline"
      >
        {help ? 'Ocultar formato' : '¿Qué formato tiene?'}
      </button>
      {help && (
        <pre className="w-full overflow-x-auto rounded-lg bg-white p-3 text-xs text-ink shadow-3d-sm">{CSV_TEMPLATE}</pre>
      )}
      {error && <p className="w-full rounded-lg bg-bad px-3 py-2 text-sm font-bold text-white">{error}</p>}
    </div>
  );
}

function FieldError({ message, onDark = false }: { message?: string; onDark?: boolean }) {
  if (!message) return null;
  return onDark ? (
    <p className="mt-1 mb-3 inline-block rounded-lg bg-bad px-2 py-1 text-sm font-bold text-white">{message}</p>
  ) : (
    <p className="mt-1 text-sm font-semibold text-bad">{message}</p>
  );
}

function IconButton(props: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="grid size-8 place-items-center rounded-md border-2 border-transparent font-bold text-ink-soft hover:border-ink/30 hover:text-ink disabled:opacity-25 disabled:hover:border-transparent"
    >
      {props.children}
    </button>
  );
}
