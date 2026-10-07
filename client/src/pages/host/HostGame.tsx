import type { AckResponse, GameSnapshot } from '@quiz/shared';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowRepeat,
  CheckCircleFill,
  CheckLg,
  ChevronRight,
  ExclamationTriangleFill,
  HandIndexThumbFill,
  LightbulbFill,
  MusicNoteBeamed,
  PeopleFill,
  PlayFill,
  SkipForwardFill,
  StopCircle,
  StopFill,
  VolumeMuteFill,
  VolumeOffFill,
  VolumeUpFill,
} from 'react-bootstrap-icons';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CenteredMessage } from '../../components/CenteredMessage';
import { Confetti } from '../../components/Confetti';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { CountdownCircle } from '../../components/Countdown';
import { GetReady } from '../../components/GetReady';
import { Leaderboard } from '../../components/Leaderboard';
import { OptionShape, optionStyle, QUESTION_TYPE_HINTS } from '../../components/OptionShape';
import { Podium } from '../../components/Podium';
import { Reactions } from '../../components/Reactions';
import { Wordmark } from '../../components/Wordmark';
import { PUBLIC_URL } from '../../lib/api';
import { imageUrl } from '../../lib/images';
import { music } from '../../lib/music';
import { hostTokens } from '../../lib/session';
import { sound } from '../../lib/sound';
import { gameActions } from '../../lib/socket';
import { useGame, type GameState } from '../../lib/useGame';

type Controls = { busy: boolean; run: (action: () => Promise<AckResponse>) => void };

export default function HostGame() {
  const { pin = '' } = useParams();
  const hostToken = hostTokens.get(pin);
  const game = useGame(async () =>
    hostToken ? gameActions.hostJoin({ pin, hostToken }) : { ok: false, error: 'No eres el anfitrión de esta partida' },
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(sound.muted);
  const [musicOn, setMusicOn] = useState(music.enabled);
  const [needsGesture, setNeedsGesture] = useState(music.needsGesture);
  const phase = game.snap?.phase;
  const runRef = useRef<(action: () => Promise<AckResponse>) => void>(() => {});

  async function run(action: () => Promise<AckResponse>) {
    setBusy(true);
    setActionError(null);
    const res = await action();
    if (!res.ok) setActionError(res.error);
    setBusy(false);
  }
  runRef.current = run;

  /** El navegador no deja sonar nada hasta el primer clic o tecla en la página. */
  function unlockAudio() {
    sound.unlock();
    setTimeout(() => setNeedsGesture(music.needsGesture()), 50);
  }

  // Sonido por fase: esta pantalla es la que se proyecta, los celulares solo vibran.
  useEffect(() => {
    if (phase === 'countdown') sound.countdown();
    else if (phase === 'question') sound.questionStart();
    else if (phase === 'reveal') sound.correct();
    else if (phase === 'podium') sound.fanfare();
  }, [phase]);

  // Música: alegre en el lobby, de tensión durante la pregunta; silencio en el resto (suenan los efectos).
  useEffect(() => {
    music.play(phase === 'lobby' ? 'lobby' : phase === 'question' ? 'question' : null);
  }, [phase]);
  useEffect(() => () => music.stop(), []);

  // Barra espaciadora o Enter para avanzar, sin tener que apuntar al botón.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      unlockAudio();
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName)) return;
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      e.preventDefault();
      runRef.current(gameActions.hostNext);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (game.closedReason) {
    return (
      <CenteredMessage title="Partida cerrada" message={game.closedReason}>
        <Link to="/host" className="btn btn-primary btn-lg">
          Volver a tus quizzes
        </Link>
      </CenteredMessage>
    );
  }

  const snap = game.snap;
  if (!snap) return <CenteredMessage title="Conectando…" />;

  const controls: Controls = { busy, run };
  const inQuestion = snap.phase === 'question' || snap.phase === 'reveal';

  return (
    // En pantallas grandes la pregunta ocupa exactamente la altura visible (nada queda bajo el pliegue del proyector).
    <div onPointerDown={unlockAudio} className={`flex min-h-dvh flex-col pb-(--badge-space) ${inQuestion ? 'lg:h-dvh' : ''}`}>
      <ConnectionBanner connected={game.connected} />
      <Reactions rightOnly={snap.phase === 'lobby'} />
      {snap.phase === 'podium' && <Confetti pieces={220} />}
      <header className="flex items-center gap-3 bg-black/20 px-4 py-2 sm:px-6">
        <Wordmark />
        <span className="hidden min-w-0 truncate text-stage-soft md:block">{snap.quizTitle}</span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {inQuestion && snap.question && (
            <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-ink">
              {snap.question.index + 1} / {snap.question.total}
            </span>
          )}
          {snap.phase !== 'lobby' && <span className="hidden px-2 font-bold text-stage-soft sm:inline">PIN {snap.pin}</span>}
          <button
            onClick={() => setMusicOn(music.toggle())}
            aria-pressed={musicOn}
            title={musicOn ? 'Apagar la música' : 'Encender la música'}
            className="btn btn-plain px-2.5 py-1.5"
          >
            {musicOn ? <MusicNoteBeamed className="size-5" /> : <VolumeOffFill className="size-5" />}
          </button>
          <button
            onClick={() => setMuted(sound.toggleMuted())}
            aria-pressed={muted}
            title={muted ? 'Activar efectos de sonido' : 'Silenciar efectos de sonido'}
            className="btn btn-plain px-2.5 py-1.5"
          >
            {muted ? <VolumeMuteFill className="size-5" /> : <VolumeUpFill className="size-5" />}
          </button>
          {snap.phase !== 'podium' && (
            <button
              disabled={busy}
              onClick={() => confirm('¿Terminar la partida ahora?') && run(gameActions.hostEnd)}
              className="btn btn-plain px-3 py-1.5 text-sm"
            >
              <StopCircle className="size-4" />
              Terminar
            </button>
          )}
        </div>
      </header>

      {needsGesture && musicOn && snap.phase === 'lobby' && (
        <button
          onClick={unlockAudio}
          className="pill fixed top-16 left-1/2 z-40 -translate-x-1/2 animate-[bump_1.2s_ease-in-out_infinite]"
        >
          <HandIndexThumbFill className="size-5 text-stage" />
          Toca la pantalla para activar la música
        </button>
      )}

      <main className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6 xl:px-10">
        {snap.phase === 'lobby' && <Lobby snap={snap} {...controls} />}
        {snap.phase === 'countdown' && snap.countdown && (
          <div className="flex flex-1 flex-col items-center">
            <GetReady countdown={snap.countdown} clockOffset={game.clockOffset} size="lg" />
            <button disabled={busy} onClick={() => run(gameActions.hostNext)} className="btn btn-plain">
              <SkipForwardFill className="size-5" />
              Mostrar ya
            </button>
          </div>
        )}
        {inQuestion && <QuestionScreen game={game} {...controls} />}
        {snap.phase === 'leaderboard' && (
          <PhaseLayout title="Clasificación" action={<NextButton {...controls} label="Siguiente pregunta" />}>
            <Leaderboard entries={snap.leaderboard ?? []} />
          </PhaseLayout>
        )}
        {snap.phase === 'podium' && (
          <PhaseLayout
            title="¡Resultado final!"
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <button disabled={busy} onClick={() => run(gameActions.hostPlayAgain)} className="btn btn-accent btn-lg">
                  <ArrowRepeat className="size-5" />
                  Jugar otra vez
                </button>
                <Link to="/host" className="btn btn-primary btn-lg">
                  Volver a tus quizzes
                </Link>
              </div>
            }
          >
            <Podium top={snap.podium ?? []} />
          </PhaseLayout>
        )}
      </main>

      {actionError && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-[calc(1rem+var(--badge-space))] mx-auto max-w-md rounded-xl bg-bad p-3 text-center font-bold text-white shadow-3d"
        >
          {actionError}
        </div>
      )}
    </div>
  );
}

function Lobby({ snap, busy, run }: { snap: GameSnapshot } & Controls) {
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const connectedCount = snap.players.filter((p) => p.connected).length;
  // El QR lleva el PIN en la ruta corta: al escanearlo se salta el paso de escribirlo.
  // PUBLIC_URL: quizlivee.netlify.app en producción, aunque se proyecte desde otro dominio.
  const joinUrl = `${PUBLIC_URL}/${snap.pin}`;
  const joinHost = new URL(PUBLIC_URL).host;
  // Con mucha gente las fichas se achican para que quepan ~100 nombres en el proyector, y los
  // recién llegados van primero: es justo cuando cada uno busca su nombre en la pantalla.
  const compact = snap.players.length > 40;
  const players = compact ? [...snap.players].reverse() : snap.players;
  return (
    // En el proyector se deja un margen a cada lado para las burbujas de reacciones (components/Reactions.tsx).
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 lg:max-w-[min(80rem,calc(100%-15rem))]">
      {/* La franja blanca de Kahoot: dónde entrar y con qué número. */}
      <section className="card mx-auto flex w-full max-w-5xl flex-col items-center gap-6 p-4 sm:flex-row sm:p-5">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-lg font-bold text-ink-soft xl:text-xl">Entra desde tu celular en</p>
          {/* Solo el dominio, como Kahoot: el PIN va al lado en grande (el QR ya lleva los dos). */}
          <p data-join-host className="text-2xl font-black text-stage xl:text-3xl 2xl:text-4xl">
            {/* Si no cabe, que corte en un punto ("quizlivee.netlify / .app"), nunca a mitad de palabra. */}
            {joinHost.split('.').map((part, i) => (
              <span key={i}>
                {i > 0 && <wbr />}
                {i > 0 && '.'}
                {part}
              </span>
            ))}
          </p>
          {isLocalhost && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-opt-yellow/20 px-2 py-1 text-sm text-ink">
              <ExclamationTriangleFill className="mt-0.5 shrink-0 text-opt-yellow" />
              <span>
                Los celulares no abren <code>localhost</code>: abre esta pantalla con la IP de tu PC.
              </span>
            </p>
          )}
        </div>
        <div className="shrink-0 border-ink/10 text-center sm:border-l-2 sm:pl-6">
          <p className="text-lg font-bold text-ink-soft xl:text-xl">PIN del juego</p>
          <p className="text-6xl font-black tracking-tight tabular-nums xl:text-8xl">
            {snap.pin.slice(0, 3)} {snap.pin.slice(3)}
          </p>
        </div>
        <figure className="shrink-0 text-center">
          <QRCodeSVG
            value={joinUrl}
            marginSize={1}
            fgColor="#1f1f1f"
            bgColor="#ffffff"
            title={`Unirse a la partida ${snap.pin}`}
            className="size-36 xl:size-52"
          />
          <figcaption className="text-sm font-bold text-ink-soft">Escanea con la cámara</figcaption>
        </figure>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <span key={snap.players.length} className="pill animate-[bump_300ms] text-2xl xl:text-4xl">
          <PeopleFill className="size-7 text-stage xl:size-9" />
          {snap.players.length}
          <span className="text-lg font-bold text-ink-soft xl:text-2xl">{snap.players.length === 1 ? 'persona' : 'personas'}</span>
        </span>
        <p className="hidden text-2xl font-black drop-shadow sm:block xl:text-3xl">
          {snap.players.length === 0 ? 'Esperando jugadores…' : '¡Ya casi! ¿Están todos?'}
        </p>
        <button
          disabled={busy || connectedCount === 0}
          onClick={() => run(gameActions.hostStart)}
          className="btn btn-accent btn-lg text-xl xl:text-2xl"
        >
          <PlayFill className="size-7" />
          Empezar
        </button>
      </div>

      {snap.players.length > 0 && (
        <section className="min-w-0 flex-1">
          <ul
            className={
              compact
                ? 'grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1.5 lg:max-h-[calc(100dvh-26rem)] lg:overflow-y-auto xl:max-h-[calc(100dvh-30rem)]'
                : 'flex flex-wrap justify-center gap-3'
            }
          >
            {players.map((p) => (
              <li key={p.id} className="animate-[pop_250ms_both]">
                <button
                  title="Clic para expulsar"
                  onClick={() => confirm(`¿Expulsar a ${p.nickname}?`) && run(() => gameActions.hostKick(p.id))}
                  className={`flex items-center gap-1.5 rounded-full font-black shadow-3d-sm hover:line-through ${
                    compact ? 'w-full px-2.5 py-0.5 text-sm leading-6' : 'px-4 py-2 text-lg xl:text-2xl'
                  } ${p.connected ? 'bg-white text-ink' : 'bg-white/30 text-white'}`}
                >
                  <span aria-hidden>{p.avatar}</span>
                  <span className="truncate">{p.nickname}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-sm text-stage-soft">Haz clic en un nombre para expulsarlo.</p>
        </section>
      )}
    </div>
  );
}

function QuestionScreen({ game, busy, run }: { game: GameState } & Controls) {
  const snap = game.snap!;
  const q = snap.question!;
  const reveal = snap.phase === 'reveal' ? snap.reveal : null;
  const isLast = q.index === q.total - 1;
  const maxVotes = Math.max(1, ...(reveal?.distribution ?? [0]));

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 xl:gap-6">
      <div className="card px-6 py-4 text-center xl:py-6">
        <p className="eyebrow text-stage">{QUESTION_TYPE_HINTS[q.type]}</p>
        <h1 className="mt-1 text-2xl leading-tight font-black tracking-tight text-balance sm:text-4xl xl:text-5xl">{q.text}</h1>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-between gap-4">
        <div className="flex w-28 shrink-0 justify-center sm:w-40 xl:w-48">
          {!reveal && <CountdownCircle endsAt={q.endsAt} clockOffset={game.clockOffset} totalSec={q.timeLimitSec} audible />}
        </div>

        <div className="relative flex h-full min-h-40 flex-1 items-center justify-center">
          {reveal ? (
            <div className="flex h-44 items-end gap-3 sm:h-56 lg:h-full lg:max-h-72" aria-label="Respuestas por opción">
              {reveal.distribution.map((count, i) => {
                const style = optionStyle(q.type, i);
                const correct = reveal.correctIndices.includes(i);
                return (
                  <div key={i} className={`flex h-full w-14 flex-col items-center justify-end xl:w-20 ${correct ? '' : 'opacity-40'}`}>
                    <span className="flex items-center gap-1 text-2xl font-black tabular-nums xl:text-4xl">
                      {correct && <CheckLg className="size-6 xl:size-8" />}
                      {count}
                    </span>
                    <div
                      className={`w-full origin-bottom animate-[rise_500ms_both] rounded-t-lg shadow-3d ${style.bg}`}
                      style={{ height: `${Math.max(4, (count / maxVotes) * 75)}%` }}
                    />
                    <span className={`mt-1.5 grid w-full place-items-center rounded-lg py-1.5 ${style.bg} ${style.text}`}>
                      <OptionShape shape={style.shape} className="size-5 xl:size-6" />
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            q.imageId && (
              // absolute + m-auto + max-*: la imagen se ajusta al espacio libre sin deformarse.
              <img
                src={imageUrl(q.imageId)}
                alt=""
                className="absolute inset-0 m-auto max-h-full max-w-full rounded-2xl bg-white shadow-3d-lg"
              />
            )
          )}
        </div>

        <div className="flex w-28 shrink-0 flex-col items-center text-center sm:w-40 xl:w-48">
          {!reveal && (
            <>
              <p className="text-6xl font-black tabular-nums drop-shadow xl:text-8xl">{snap.answeredCount}</p>
              <p className="font-bold text-stage-soft xl:text-xl">
                {snap.answeredCount === 1 ? 'respuesta' : 'respuestas'} de {snap.players.length}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const style = optionStyle(q.type, i);
          const correct = reveal?.correctIndices.includes(i);
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl px-5 py-3 text-lg font-black shadow-3d transition-opacity sm:py-4 sm:text-2xl xl:py-6 xl:text-3xl ${style.bg} ${style.text} ${
                reveal && !correct ? 'opacity-30' : ''
              }`}
            >
              <OptionShape shape={style.shape} className="size-7 shrink-0 drop-shadow xl:size-10" />
              {style.letter && <span className="shrink-0 opacity-70">{style.letter}</span>}
              <span className="min-w-0 flex-1 break-words">{opt}</span>
              {correct && <CheckCircleFill className="size-8 shrink-0 xl:size-10" />}
            </div>
          );
        })}
      </div>

      {reveal?.explanation && (
        <p className="card flex animate-[slide-in_350ms_both] items-start gap-3 px-5 py-3 text-xl font-bold sm:text-2xl xl:text-3xl">
          <LightbulbFill className="mt-1 size-6 shrink-0 text-opt-yellow xl:size-8" />
          <span>{reveal.explanation}</span>
        </p>
      )}

      <div className="flex justify-end">
        {reveal ? (
          <NextButton busy={busy} run={run} label={isLast ? 'Ver resultado final' : 'Siguiente'} />
        ) : (
          <button disabled={busy} onClick={() => run(gameActions.hostNext)} className="btn btn-plain">
            <StopFill className="size-5" />
            Cerrar pregunta
          </button>
        )}
      </div>
    </div>
  );
}

function PhaseLayout({ title, action, children }: { title: string; action: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      <h1 className="pill px-8 py-3 text-3xl sm:text-4xl xl:text-5xl">{title}</h1>
      <div className="flex w-full flex-1 items-center">{children}</div>
      {action}
    </div>
  );
}

function NextButton({ busy, run, label }: Controls & { label: string }) {
  return (
    <button disabled={busy} onClick={() => run(gameActions.hostNext)} className="btn btn-primary btn-lg text-xl">
      {label}
      <ChevronRight className="size-6" />
    </button>
  );
}
