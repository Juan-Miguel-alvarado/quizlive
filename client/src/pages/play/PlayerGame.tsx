import type { GameSnapshot } from '@quiz/shared';
import { useEffect, useState } from 'react';
import {
  ArrowRepeat,
  CheckCircleFill,
  CheckLg,
  Fire,
  LightbulbFill,
  SendFill,
  StopwatchFill,
  TrophyFill,
  XCircleFill,
  ZoomIn,
  ZoomOut,
} from 'react-bootstrap-icons';
import { Link, Navigate } from 'react-router';
import { CenteredMessage } from '../../components/CenteredMessage';
import { Confetti } from '../../components/Confetti';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { CountdownCircle } from '../../components/Countdown';
import { GetReady } from '../../components/GetReady';
import { OptionShape, optionStyle, QUESTION_TYPE_HINTS } from '../../components/OptionShape';
import { ReactionBar } from '../../components/ReactionBar';
import { imageUrl } from '../../lib/images';
import { playerSession } from '../../lib/session';
import { gameActions } from '../../lib/socket';
import { buzz } from '../../lib/sound';
import { textSize } from '../../lib/textSize';
import { useGame } from '../../lib/useGame';

type Game = ReturnType<typeof useGame>;

export default function PlayerGame() {
  const [session] = useState(playerSession.get);
  const game = useGame(async () =>
    session
      ? gameActions.playerRejoin({ pin: session.pin, playerToken: session.playerToken })
      : { ok: false, error: 'Sin sesión' },
  );

  const [bigText, setBigText] = useState(() => textSize.big);
  const snap = game.snap;
  const result = snap?.phase === 'reveal' ? snap.me?.lastResult : null;
  // El celular vibra en vez de sonar: 30 teléfonos pitando en un salón es un caos.
  useEffect(() => {
    if (!result) return;
    buzz(result.correct ? [40, 60, 40] : 220);
  }, [result]);

  if (!session) return <Navigate to="/" replace />;

  if (game.closedReason) {
    return (
      <CenteredMessage title="Se cortó la partida" message={game.closedReason}>
        <Link to="/" onClick={playerSession.clear} className="btn btn-primary btn-lg">
          Volver al inicio
        </Link>
      </CenteredMessage>
    );
  }

  if (!snap?.me) return <CenteredMessage title="Conectando…" />;
  const resultBg = snap.phase === 'reveal' ? resultStyle(snap).bg : '';
  const questionNumber = (snap.question?.index ?? snap.countdown?.index ?? -1) + 1;

  return (
    // La barra inferior es fija: el padding de abajo deja su espacio (y el de la etiqueta de Netlify).
    <div className={`flex min-h-dvh flex-col pb-[calc(4rem+var(--badge-space))] ${resultBg}`}>
      <ConnectionBanner connected={game.connected} />
      <header className="flex items-center gap-3 bg-white px-4 py-1.5 text-ink shadow-3d-sm">
        <span className="font-bold">PIN {snap.pin}</span>
        {questionNumber > 0 && (
          <span className="text-ink-soft">
            · Pregunta {questionNumber} de {snap.totalQuestions}
          </span>
        )}
        <button
          onClick={() => setBigText(textSize.toggle())}
          aria-pressed={bigText}
          title={bigText ? 'Letra normal' : 'Letra más grande'}
          className={`ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-black ${
            bigText ? 'bg-stage text-white' : 'bg-paper text-ink hover:bg-paper-2'
          }`}
        >
          {bigText ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
          Letra
        </button>
      </header>

      <main className="flex flex-1 flex-col p-4">
        {snap.phase === 'lobby' && (
          <Centered>
            <p className="text-7xl drop-shadow-lg" aria-hidden>
              {snap.me.avatar}
            </p>
            <p className="mt-3 text-4xl font-black tracking-tight">¡Ya estás dentro!</p>
            <p className="mt-2 max-w-xs text-lg text-stage-soft">¿Ves tu nombre en la pantalla grande? Empezamos en un momento.</p>
            <HowToPlay />
            <div className="mt-8 w-full">
              <ReactionBar />
            </div>
          </Centered>
        )}
        {snap.phase === 'countdown' && snap.countdown && (
          <GetReady countdown={snap.countdown} clockOffset={game.clockOffset} size="sm" />
        )}
        {snap.phase === 'question' && <AnswerScreen key={snap.question!.index} game={game} />}
        {snap.phase === 'reveal' && <ResultScreen snap={snap} />}
        {snap.phase === 'leaderboard' && (
          <Centered>
            <RankBadge label="Vas en el puesto" rank={snap.me.rank} />
            {snap.me.rank <= 5 && (
              <p className="pill mt-6 text-lg">
                <TrophyFill className="size-5 text-gold" />
                ¡Estás en el top 5!
              </p>
            )}
            <div className="mt-10 w-full">
              <ReactionBar />
            </div>
          </Centered>
        )}
        {snap.phase === 'podium' && (
          <Centered>
            <RankBadge label="Terminaste en el puesto" rank={snap.me.rank} />
            {snap.me.rank <= 3 && (
              <>
                <Confetti />
                <p className="pill mt-6 text-lg">
                  <TrophyFill className="size-5 text-gold" />
                  ¡Estás en el podio!
                </p>
              </>
            )}
            <p className="mt-4 text-xl font-bold">¡Gracias por jugar!</p>
            <div className="mt-8 w-full">
              <ReactionBar />
            </div>
            <Link to="/" onClick={playerSession.clear} className="btn btn-primary btn-lg mt-8">
              Jugar otra partida
            </Link>
          </Centered>
        )}
      </main>

      {/* Barra inferior, como en Kahoot: quién eres y cuántos puntos llevas. */}
      <footer className="fixed inset-x-0 bottom-(--badge-space) z-30 flex items-center gap-3 bg-black/80 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur">
        <span className="text-3xl leading-none" aria-hidden>
          {snap.me.avatar}
        </span>
        <span className="min-w-0 flex-1 truncate text-lg font-black">{snap.me.nickname}</span>
        <span className="rounded-lg bg-white px-3 py-1 font-black text-ink tabular-nums">
          {snap.me.score.toLocaleString('es')}
        </span>
      </footer>
    </div>
  );
}

function RankBadge({ label, rank }: { label: string; rank: number }) {
  return (
    <>
      <p className="text-xl font-bold text-stage-soft">{label}</p>
      <p className="mt-2 grid size-40 animate-[pop_300ms_both] place-items-center rounded-full bg-white text-8xl font-black text-stage-dark tabular-nums shadow-3d-lg">
        {rank}
      </p>
    </>
  );
}

function AnswerScreen({ game }: { game: Game }) {
  const snap = game.snap!;
  const q = snap.question!;
  const sent = snap.me!.answer;
  const multiple = q.type === 'multiple';
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function send(choices: number[]) {
    if (sent !== null || choices.length === 0) return;
    setError(null);
    buzz(25);
    game.markAnswered(choices); // optimista: el servidor igual valida
    const res = await gameActions.playerAnswer({ questionIndex: q.index, choices });
    if (!res.ok) {
      setError(res.error);
      if (!res.error.startsWith('Ya respondiste')) game.markAnswered(null);
    }
  }

  function tap(i: number) {
    if (!multiple) return send([i]);
    setSelected((cur) => (cur.includes(i) ? cur.filter((c) => c !== i) : [...cur, i]));
  }

  // Teclas 1-4 para quien juegue desde la laptop; Enter envía en selección múltiple.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < q.options.length) tap(index);
      else if (e.key === 'Enter' && multiple) send(selected);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (sent !== null) {
    return (
      <Centered>
        <div className="flex gap-3">
          {sent.map((c) => {
            const style = optionStyle(q.type, c);
            return (
              <span
                key={c}
                className={`grid size-24 animate-[pop_250ms_both] place-items-center rounded-2xl shadow-3d-lg ${style.bg} ${style.text}`}
              >
                <OptionShape shape={style.shape} className="size-12" />
              </span>
            );
          })}
        </div>
        <p className="mt-8 text-4xl font-black">¡Listo!</p>
        <p className="mt-2 flex items-center gap-2 text-lg text-stage-soft">
          <ArrowRepeat className="size-5 animate-spin" />
          ¿Fuiste el más rápido? Esperando a los demás…
        </p>
      </Centered>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3">
      <div className="card flex items-center gap-3 p-3">
        <p className="flex-1 text-xl leading-snug font-black">{q.text}</p>
        <CountdownCircle endsAt={q.endsAt} clockOffset={game.clockOffset} totalSec={q.timeLimitSec} size="sm" />
      </div>
      {q.imageId && (
        <img src={imageUrl(q.imageId)} alt="" className="max-h-[22vh] w-full rounded-xl bg-white object-contain shadow-3d" />
      )}
      <p className="text-center text-lg font-bold">
        {multiple ? 'Toca todas las correctas y luego «Enviar»' : QUESTION_TYPE_HINTS[q.type]}
      </p>
      {error && <p className="rounded-lg bg-bad p-2 text-center font-bold text-white shadow-3d-sm">{error}</p>}

      <div className={`grid flex-1 gap-3 ${q.options.length === 2 ? 'grid-rows-2' : 'grid-cols-2'}`}>
        {q.options.map((opt, i) => {
          const style = optionStyle(q.type, i);
          const isSelected = selected.includes(i);
          return (
            <button
              key={i}
              onClick={() => tap(i)}
              aria-pressed={multiple ? isSelected : undefined}
              className={`relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-[translate,box-shadow] duration-75 active:translate-y-1 active:shadow-none ${style.bg} ${style.text} ${
                isSelected ? 'translate-y-1 shadow-none ring-4 ring-white ring-inset' : 'shadow-3d-lg'
              }`}
            >
              {style.letter && (
                <span className="absolute top-2 left-3 text-lg font-black opacity-80" aria-hidden>
                  {style.letter}
                </span>
              )}
              <OptionShape shape={style.shape} className="size-12 drop-shadow" />
              <span className="line-clamp-3 text-xl leading-tight font-black break-words">{opt}</span>
              {isSelected && (
                <span className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-white text-ink shadow-3d-sm">
                  <CheckLg className="size-5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {multiple && (
        <button onClick={() => send(selected)} disabled={selected.length === 0} className="btn btn-primary btn-lg w-full text-xl">
          <SendFill className="size-5" />
          Enviar respuesta {selected.length > 0 && `(${selected.length})`}
        </button>
      )}
    </div>
  );
}

function resultStyle(snap: GameSnapshot) {
  const r = snap.me!.lastResult;
  if (!r) return { bg: '', title: 'Calculando…', Icon: null };
  if (r.correct) return { bg: 'bg-good', title: '¡Correcto!', Icon: CheckCircleFill };
  if (r.answered) return { bg: 'bg-bad', title: 'Esta vez no', Icon: XCircleFill };
  return { bg: 'bg-stage-dark', title: 'Se acabó el tiempo', Icon: StopwatchFill };
}

function ResultScreen({ snap }: { snap: GameSnapshot }) {
  const r = snap.me!.lastResult;
  const { title, Icon } = resultStyle(snap);
  const explanation = snap.reveal?.explanation;
  return (
    <Centered>
      {r?.correct && <Confetti pieces={80} />}
      {Icon && <Icon aria-hidden className="size-28 animate-[pop_300ms_both] drop-shadow-lg" />}
      <p className="mt-4 animate-[pop_300ms_both] text-5xl font-black tracking-tight drop-shadow">{title}</p>
      {r?.correct && (
        <p className="mt-4 rounded-xl bg-black/30 px-5 py-1.5 text-4xl font-black tabular-nums">+{r.points}</p>
      )}
      {r && r.streak >= 2 && (
        <p className="mt-3 flex items-center gap-1.5 rounded-full bg-accent px-4 py-1 text-lg font-black text-ink shadow-3d-sm">
          <Fire className="size-5" />
          {r.streak} seguidas
          {r.streakBonus > 0 && ` · +${r.streakBonus} extra`}
        </p>
      )}
      {explanation && (
        <p className="card mt-6 flex max-w-sm items-start gap-2 px-4 py-3 text-left text-lg font-medium">
          <LightbulbFill className="mt-1 size-5 shrink-0 text-opt-yellow" />
          <span>{explanation}</span>
        </p>
      )}
      {r && <p className="mt-8 text-xl font-bold text-white/90">Vas en el puesto {r.rank}</p>}
    </Centered>
  );
}

/** Mini tutorial mientras se espera en el lobby: las figuras de colores son las mismas del juego. */
function HowToPlay() {
  const steps = [
    { n: 1, text: 'Lee la pregunta en la pantalla grande' },
    { n: 2, text: 'Toca aquí el color de tu respuesta' },
    { n: 3, text: '¡Más rápido, más puntos!' },
  ];
  return (
    <div className="card mt-8 w-full max-w-xs p-4 text-left">
      <div className="mb-4 grid grid-cols-4 gap-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => {
          const style = optionStyle('single', i);
          return (
            <span key={i} className={`grid h-11 place-items-center rounded-lg shadow-3d-sm ${style.bg} ${style.text}`}>
              <OptionShape shape={style.shape} className="size-5" />
            </span>
          );
        })}
      </div>
      <ol className="space-y-2.5">
        {steps.map((s) => (
          <li key={s.n} className="flex items-center gap-3 font-bold">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stage font-black text-white">{s.n}</span>
            {s.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>;
}
