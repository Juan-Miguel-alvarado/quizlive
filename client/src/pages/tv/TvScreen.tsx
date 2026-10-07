import { QUESTION_COUNTDOWN_SEC, type GameSnapshot, type ScoreEntry } from '@quiz/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowsFullscreen,
  CheckCircleFill,
  ExclamationTriangleFill,
  LightbulbFill,
  MusicNoteBeamed,
  PeopleFill,
  TrophyFill,
  VolumeMuteFill,
  VolumeOffFill,
  VolumeUpFill,
} from 'react-bootstrap-icons';
import { useParams } from 'react-router';
import { CenteredMessage } from '../../components/CenteredMessage';
import { Confetti } from '../../components/Confetti';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { CountdownCircle, TimerBar } from '../../components/Countdown';
import { GetReady } from '../../components/GetReady';
import { Leaderboard } from '../../components/Leaderboard';
import { OptionShape, optionStyle, QUESTION_TYPE_HINTS } from '../../components/OptionShape';
import { Podium } from '../../components/Podium';
import { Reactions } from '../../components/Reactions';
import { Wordmark } from '../../components/Wordmark';
import { PUBLIC_URL } from '../../lib/api';
import { imageUrl } from '../../lib/images';
import { music } from '../../lib/music';
import { gameActions } from '../../lib/socket';
import { sound } from '../../lib/sound';
import { useGame, type GameState } from '../../lib/useGame';

/**
 * Pantalla TV: el computador conectado al televisor. Solo muestra (se une como "pantalla", sin
 * poder controlar nada); el moderador dirige desde su panel. Durante el juego no hay botones.
 */
export default function TvScreen() {
  const { pin = '' } = useParams();
  const game = useGame(() => gameActions.screenJoin({ pin }));
  const [muted, setMuted] = useState(sound.muted);
  const [musicOn, setMusicOn] = useState(music.enabled);
  const [needsGesture, setNeedsGesture] = useState(music.needsGesture);
  const [fullscreen, setFullscreen] = useState(false);
  const idleCursor = useIdleCursor();
  const phase = game.snap?.phase;

  function unlockAudio() {
    sound.unlock();
    setTimeout(() => setNeedsGesture(music.needsGesture()), 50);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    const onKey = (e: KeyboardEvent) => {
      unlockAudio();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Efectos por fase y música: alegre en el lobby, de tensión en la pregunta.
  useEffect(() => {
    if (phase === 'countdown') sound.countdown();
    else if (phase === 'question') sound.questionStart();
    else if (phase === 'reveal') sound.correct();
    else if (phase === 'podium') sound.fanfare();
    music.play(phase === 'lobby' ? 'lobby' : phase === 'question' ? 'question' : null);
  }, [phase]);
  useEffect(() => () => music.stop(), []);

  if (game.closedReason) return <CenteredMessage title="La partida terminó" message={game.closedReason} />;
  const snap = game.snap;
  if (!snap) return <CenteredMessage title="Conectando con la partida…" />;

  const inQuestion = snap.phase === 'question' || snap.phase === 'reveal';

  return (
    <div
      onPointerDown={unlockAudio}
      onDoubleClick={toggleFullscreen}
      className={`flex h-dvh flex-col overflow-hidden ${idleCursor ? 'cursor-none' : ''}`}
    >
      <ConnectionBanner connected={game.connected} />
      <Reactions rightOnly={snap.phase === 'lobby'} />
      {snap.phase === 'podium' && <Confetti pieces={260} />}

      {/* Los únicos controles: solo en el lobby y fuera de pantalla completa. */}
      {snap.phase === 'lobby' && (
        <header className="flex items-center gap-3 px-6 py-3">
          <Wordmark />
          <span className="min-w-0 truncate text-stage-soft">{snap.quizTitle}</span>
          {!fullscreen && (
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-sm text-stage-soft lg:inline">Doble clic o tecla F: pantalla completa</span>
              <button onClick={toggleFullscreen} title="Pantalla completa" className="btn btn-plain px-2.5 py-1.5">
                <ArrowsFullscreen className="size-5" />
              </button>
              <button
                onClick={() => setMusicOn(music.toggle())}
                title={musicOn ? 'Apagar la música' : 'Encender la música'}
                className="btn btn-plain px-2.5 py-1.5"
              >
                {musicOn ? <MusicNoteBeamed className="size-5" /> : <VolumeOffFill className="size-5" />}
              </button>
              <button
                onClick={() => setMuted(sound.toggleMuted())}
                title={muted ? 'Activar efectos de sonido' : 'Silenciar efectos de sonido'}
                className="btn btn-plain px-2.5 py-1.5"
              >
                {muted ? <VolumeMuteFill className="size-5" /> : <VolumeUpFill className="size-5" />}
              </button>
            </div>
          )}
        </header>
      )}
      {needsGesture && musicOn && snap.phase === 'lobby' && (
        <p className="pill fixed bottom-6 left-1/2 z-40 -translate-x-1/2 text-lg">Haz clic en la pantalla para activar el sonido</p>
      )}

      <main className="flex min-h-0 flex-1 flex-col px-6 py-5 xl:px-12 xl:py-8 short:py-4">
        {snap.phase === 'lobby' && <TvLobby snap={snap} />}
        {snap.phase === 'countdown' && snap.countdown && <TvCountdown game={game} />}
        {inQuestion && <TvQuestion game={game} />}
        {snap.phase === 'leaderboard' && <TvSeriesEnd snap={snap} />}
        {snap.phase === 'podium' && <TvWinner top={snap.podium ?? []} />}
      </main>
    </div>
  );
}

/** Oculta el cursor tras 3 s sin mover el ratón (en la TV estorba). */
function useIdleCursor() {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setIdle(true), 3000);
    };
    wake();
    window.addEventListener('pointermove', wake);
    return () => {
      window.removeEventListener('pointermove', wake);
      clearTimeout(timer.current);
    };
  }, []);
  return idle;
}

function TvLobby({ snap }: { snap: GameSnapshot }) {
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const joinUrl = `${PUBLIC_URL}/${snap.pin}`;
  const joinHost = new URL(PUBLIC_URL).host;
  const compact = snap.players.length > 40;
  const players = compact ? [...snap.players].reverse() : snap.players;
  return (
    // Margen a los lados para las burbujas de reacciones (components/Reactions.tsx).
    <div className="mx-auto flex min-h-0 w-full max-w-[min(90rem,calc(100%-15rem))] flex-1 flex-col gap-6">
      <section className="card flex w-full items-center gap-8 p-6">
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-ink-soft xl:text-2xl">Entra desde tu celular en</p>
          <p className="text-3xl font-black text-stage xl:text-5xl">
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
                Los celulares no abren <code>localhost</code>: abre la TV con la IP de esta computadora.
              </span>
            </p>
          )}
        </div>
        <div className="shrink-0 border-l-2 border-ink/10 pl-8 text-center">
          <p className="text-xl font-bold text-ink-soft xl:text-2xl">PIN del juego</p>
          <p className="text-7xl font-black tracking-tight tabular-nums xl:text-9xl">
            {snap.pin.slice(0, 3)} {snap.pin.slice(3)}
          </p>
        </div>
        <QRCodeSVG value={joinUrl} marginSize={1} fgColor="#1f1f1f" className="size-40 shrink-0 xl:size-56" />
      </section>

      <div className="flex items-center justify-between gap-4">
        <span key={snap.players.length} className="pill animate-[bump_300ms] text-3xl xl:text-5xl">
          <PeopleFill className="size-8 text-stage xl:size-11" />
          {snap.players.length}
          <span className="text-xl font-bold text-ink-soft xl:text-3xl">{snap.players.length === 1 ? 'jugador' : 'jugadores'}</span>
        </span>
        <p className="text-3xl font-black drop-shadow xl:text-4xl">
          {snap.players.length === 0 ? 'Esperando jugadores…' : 'Esperando a que inicie el juego…'}
        </p>
      </div>

      <ul
        className={`min-h-0 flex-1 overflow-hidden ${
          compact ? 'grid content-start gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]' : 'flex flex-wrap content-start justify-center gap-3'
        }`}
      >
        {players.map((p) => (
          <li
            key={p.id}
            className={`flex animate-[pop_250ms_both] items-center gap-2 rounded-full font-black shadow-3d-sm ${
              compact ? 'px-3 py-0.5 text-base' : 'px-5 py-2 text-2xl xl:text-3xl'
            } ${p.connected ? 'bg-white text-ink' : 'bg-white/30 text-white'}`}
          >
            <span aria-hidden>{p.avatar}</span>
            <span className="truncate">{p.nickname}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "¡Prepárate!" — y si empieza una serie, su nombre en grande. */
function TvCountdown({ game }: { game: GameState }) {
  const c = game.snap!.countdown!;
  if (c.inSeries.index > 0) return <GetReady countdown={c} clockOffset={game.clockOffset} size="lg" />;
  return (
    <div className="flex flex-1 animate-[pop_400ms_both] flex-col items-center justify-center gap-6 text-center">
      <p className="pill text-2xl xl:text-4xl">
        Serie {c.series.index + 1} de {c.series.total}
      </p>
      <h1 className="max-w-6xl text-6xl leading-tight font-black text-balance drop-shadow-lg xl:text-8xl">{c.series.title}</h1>
      <p className="text-2xl font-bold text-stage-soft xl:text-3xl">
        {c.inSeries.total} {c.inSeries.total === 1 ? 'pregunta' : 'preguntas'} · {QUESTION_TYPE_HINTS[c.type]}
      </p>
      <CountdownCircle endsAt={c.endsAt} clockOffset={game.clockOffset} totalSec={QUESTION_COUNTDOWN_SEC} />
    </div>
  );
}

/** Tamaño de la pregunta según su largo: siempre entera, sin cortes ni scroll. */
function questionSize(text: string) {
  if (text.length <= 50) return 'text-5xl xl:text-7xl short:text-6xl';
  if (text.length <= 100) return 'text-4xl xl:text-6xl short:text-5xl';
  if (text.length <= 180) return 'text-3xl xl:text-5xl short:text-4xl';
  return 'text-2xl xl:text-4xl short:text-3xl';
}

function optionSize(longest: number) {
  if (longest <= 25) return 'text-3xl xl:text-5xl short:text-4xl';
  if (longest <= 50) return 'text-2xl xl:text-4xl short:text-3xl';
  return 'text-xl xl:text-3xl short:text-2xl';
}

function TvQuestion({ game }: { game: GameState }) {
  const snap = game.snap!;
  const q = snap.question!;
  const reveal = snap.phase === 'reveal' ? snap.reveal : null;
  const longest = Math.max(...q.options.map((o) => o.length));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 xl:gap-6 short:gap-3">
      <div className="flex shrink-0 items-center justify-between gap-4 text-xl font-black text-stage-soft xl:text-3xl short:text-xl">
        <span className="truncate">
          Serie {q.series.index + 1} · {q.series.title}
        </span>
        <span className="shrink-0">
          Pregunta {q.inSeries.index + 1} de {q.inSeries.total}
        </span>
      </div>

      {/* Nada de lo de abajo se encoge: si falta espacio, cede el hueco de la imagen. */}
      <div className="card flex min-h-[18%] shrink-0 items-center justify-center px-8 py-5 text-center short:py-3">
        <h1 className={`leading-tight font-black tracking-tight text-balance ${questionSize(q.text)}`}>{q.text}</h1>
      </div>

      <div className="relative min-h-0 flex-1">
        {q.imageId && (
          <img
            src={imageUrl(q.imageId)}
            alt=""
            className="absolute inset-0 m-auto max-h-full max-w-full rounded-2xl bg-white shadow-3d-lg"
          />
        )}
      </div>
      {reveal?.explanation && (
        <div className="shrink-0">
          <Explanation text={reveal.explanation} />
        </div>
      )}

      {!reveal && (
        <div className="flex shrink-0 items-center gap-6">
          <div className="min-w-0 flex-1">
            <TimerBar endsAt={q.endsAt} clockOffset={game.clockOffset} totalSec={q.timeLimitSec} />
          </div>
          <p className="shrink-0 text-right leading-none">
            <span className="text-6xl font-black tabular-nums drop-shadow xl:text-8xl short:text-5xl">{snap.answeredCount}</span>
            <span className="text-3xl font-black text-stage-soft xl:text-5xl short:text-3xl"> de {snap.players.length}</span>
            <span className="block text-xl font-bold text-stage-soft xl:text-2xl short:text-lg">respondieron</span>
          </p>
        </div>
      )}

      <div className="grid shrink-0 grid-cols-2 gap-4 xl:gap-5 short:gap-3">
        {q.options.map((opt, i) => {
          const style = optionStyle(q.type, i);
          const correct = reveal?.correctIndices.includes(i);
          const votes = reveal?.distribution[i] ?? 0;
          // Al revelar: la correcta en verde grande; las demás apagadas (pero su conteo se lee).
          const look = !reveal
            ? `${style.bg} ${style.text}`
            : correct
              ? 'scale-[1.02] bg-good text-white ring-8 ring-white'
              : 'bg-black/25 text-white/45 shadow-none';
          return (
            <div
              key={i}
              className={`flex min-h-24 items-center gap-4 rounded-2xl px-6 py-4 font-black shadow-3d-lg transition-all duration-300 xl:min-h-32 xl:px-8 short:min-h-20 short:py-3 ${look} ${optionSize(longest)}`}
            >
              <OptionShape shape={style.shape} className="size-10 shrink-0 drop-shadow xl:size-14 short:size-11" />
              {style.letter && <span className="shrink-0 opacity-70">{style.letter}</span>}
              <span className="min-w-0 flex-1 leading-tight break-words">{opt}</span>
              {reveal && (
                <span
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-1 text-2xl tabular-nums xl:text-4xl ${
                    correct ? 'bg-white text-good' : 'bg-white/85 text-ink'
                  }`}
                  title={`${votes} ${votes === 1 ? 'persona' : 'personas'}`}
                >
                  {correct && <CheckCircleFill className="size-7 xl:size-10" />}
                  {votes}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Explanation({ text }: { text: string }) {
  return (
    <p className="card flex animate-[slide-in_350ms_both] items-start gap-4 px-6 py-4 text-2xl font-bold xl:text-4xl">
      <LightbulbFill className="mt-1 size-8 shrink-0 text-opt-yellow xl:size-10" />
      <span>{text}</span>
    </p>
  );
}

function TvSeriesEnd({ snap }: { snap: GameSnapshot }) {
  const end = snap.seriesEnd;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div className="text-center">
        {end && (
          <p className="text-2xl font-bold text-stage-soft xl:text-4xl">
            Fin de la Serie {end.series.index + 1}: {end.series.title}
          </p>
        )}
        <h1 className="pill mt-3 px-10 py-3 text-4xl xl:text-6xl">
          <TrophyFill className="size-9 text-gold xl:size-12" />
          Top 5
        </h1>
      </div>
      <div className="w-full max-w-4xl [&_li]:xl:py-6 [&_li]:xl:text-4xl">
        <Leaderboard entries={snap.leaderboard ?? []} />
      </div>
    </div>
  );
}

function TvWinner({ top }: { top: ScoreEntry[] }) {
  const winner = top[0];
  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-6">
      {winner && (
        <div className="animate-[podium-reveal_600ms_both] text-center [animation-delay:2.2s]">
          <p className="pill text-3xl xl:text-5xl">
            <TrophyFill className="size-9 text-gold xl:size-12" />
            ¡Ganador!
          </p>
          <p className="mt-4 text-6xl font-black drop-shadow-lg xl:text-8xl">
            <span aria-hidden>{winner.avatar} </span>
            {winner.nickname}
          </p>
          <p className="mt-1 text-3xl font-bold text-stage-soft xl:text-4xl">{winner.score.toLocaleString('es')} puntos</p>
        </div>
      )}
      <Podium top={top} />
    </div>
  );
}
