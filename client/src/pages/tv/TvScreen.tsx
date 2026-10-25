import { QUESTION_COUNTDOWN_SEC, type GameSnapshot, type ScoreEntry } from '@quiz/shared';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowsFullscreen,
  CaretDownFill,
  CaretUpFill,
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
import { CountdownCircle, useRemainingMs } from '../../components/Countdown';
import { FitText } from '../../components/FitText';
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
      {/* Solo donde se puede reaccionar: al empezar la serie, las burbujas que quedaban se van. */}
      {(snap.phase === 'lobby' || snap.phase === 'leaderboard' || snap.phase === 'podium') && (
        <Reactions rightOnly={snap.phase === 'lobby'} />
      )}
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

      <main className="flex min-h-0 flex-1 flex-col px-[2.5vw] py-[2.5vh]">
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
  const joinHost = new URL(PUBLIC_URL).host;
  // Solo si lo que se anuncia es localhost (en desarrollo, sin VITE_PUBLIC_URL).
  const isLocalhost = /^(localhost|127\.0\.0\.1)(:|$)/.test(joinHost);
  // Los nombres se achican según cuántos hay, para que todos quepan (con muchos, los nuevos primero).
  const n = snap.players.length;
  const compact = n > 40;
  const chip = n <= 10 ? 'px-[1.4vw] py-[0.8vh] text-[4.2vh]' : n <= 20 ? 'px-[1.2vw] py-[0.6vh] text-[3.2vh]' : 'px-[1vw] py-[0.4vh] text-[2.6vh]';
  const players = compact ? [...snap.players].reverse() : snap.players;
  return (
    // Margen a los lados para las burbujas de reacciones (components/Reactions.tsx).
    <div className="mx-auto flex min-h-0 w-[calc(100%-14vw)] flex-1 flex-col gap-[2.5vh]">
      <section className="card flex w-full items-center gap-[3vw] px-[3vw] py-[3vh]">
        <div className="flex min-w-0 flex-1 flex-col">
          <FitText text="Entra desde tu celular en" max={60} align="left" className="h-[4.5vh] font-bold text-ink-soft" />
          <FitText text={joinHost} max={110} align="left" nowrap className="h-[9vh] font-black text-stage" />
          {isLocalhost && (
            <p className="mt-[1vh] flex items-start gap-2 rounded-lg bg-opt-yellow/20 px-2 py-1 text-[1.8vh] text-ink">
              <ExclamationTriangleFill className="mt-0.5 shrink-0 text-opt-yellow" />
              <span>
                Los celulares no abren <code>localhost</code>: abre la TV con la IP de esta computadora.
              </span>
            </p>
          )}
        </div>
        <div className="shrink-0 border-l-2 border-ink/10 pl-[3vw] text-center">
          <p className="text-[3.2vh] font-bold text-ink-soft">PIN del juego</p>
          <p className="text-[16vh] leading-none font-black tracking-tight tabular-nums">
            {snap.pin.slice(0, 3)} {snap.pin.slice(3)}
          </p>
        </div>
      </section>

      <div className="flex items-center justify-between gap-[2vw]">
        <span key={snap.players.length} className="pill animate-[bump_300ms] px-[2vw] py-[1vh] text-[6vh]">
          <PeopleFill className="size-[6vh] text-stage" />
          {snap.players.length}
          <span className="text-[3.5vh] font-bold text-ink-soft">{snap.players.length === 1 ? 'jugador' : 'jugadores'}</span>
        </span>
        <p className="text-[4.5vh] font-black drop-shadow">
          {snap.players.length === 0 ? 'Esperando jugadores…' : 'Esperando a que inicie el juego…'}
        </p>
      </div>

      <ul
        className={`min-h-0 flex-1 overflow-hidden ${
          compact
            ? 'grid content-start gap-[0.8vh] [grid-template-columns:repeat(auto-fill,minmax(14vw,1fr))]'
            : 'flex flex-wrap content-start justify-center gap-[1.4vh]'
        }`}
      >
        {players.map((p) => (
          <li
            key={p.id}
            className={`flex animate-[pop_250ms_both] items-center gap-[0.6vw] rounded-full font-black shadow-3d-sm ${
              compact ? 'px-[1vw] py-[0.3vh] text-[2.3vh]' : chip
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
  const startsSeries = c.inSeries.index === 0;
  return (
    <div className="flex flex-1 animate-[pop_400ms_both] flex-col items-center justify-center gap-[3vh] text-center">
      <p className="pill px-[2vw] py-[1vh] text-[4.5vh]">
        {startsSeries
          ? `Serie ${c.series.index + 1} de ${c.series.total}`
          : `Pregunta ${c.inSeries.index + 1} de ${c.inSeries.total}`}
      </p>
      <FitText
        text={startsSeries ? c.series.title : '¡Prepárate!'}
        max={260}
        className="h-[28vh] w-[88vw] font-black drop-shadow-lg"
      />
      <p className="text-[4vh] font-bold text-stage-soft">
        {startsSeries && `${c.inSeries.total} ${c.inSeries.total === 1 ? 'pregunta' : 'preguntas'} · `}
        {QUESTION_TYPE_HINTS[c.type]}
      </p>
      <CountdownCircle endsAt={c.endsAt} clockOffset={game.clockOffset} totalSec={QUESTION_COUNTDOWN_SEC} size="tv" />
    </div>
  );
}

/**
 * La pregunta ocupa toda la pantalla: la letra de la pregunta y de cada opción se ajusta sola al
 * tamaño más grande que quepa (FitText). Medidas en vh/vw para cualquier televisor.
 */
function TvQuestion({ game }: { game: GameState }) {
  const snap = game.snap!;
  const q = snap.question!;
  const reveal = snap.phase === 'reveal' ? snap.reveal : null;
  const hasImage = !!q.imageId;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[1.8vh]">
      <div className="flex shrink-0 items-center justify-between gap-[2vw] text-[3vh] leading-none font-black text-stage-soft">
        <span className="truncate">
          Serie {q.series.index + 1} · {q.series.title}
        </span>
        <span className="shrink-0">
          Pregunta {q.inSeries.index + 1} de {q.inSeries.total}
        </span>
      </div>

      {/* Sin imagen, la pregunta se queda con todo el espacio libre; con imagen, lo comparte. */}
      <div className={`card flex shrink-0 px-[2.5vw] py-[2vh] ${hasImage ? 'h-[16vh]' : 'min-h-[22vh] flex-1'}`}>
        <FitText text={q.text} max={220} className="h-full w-full font-black tracking-tight" />
      </div>

      {/* Con imagen: el contador grande a la izquierda y la foto con todo el resto del espacio. */}
      {hasImage && (
        <div className="flex min-h-0 flex-1 items-center gap-[2vw]">
          {!reveal && (
            <div className="flex shrink-0 justify-center">
              <TvTimer endsAt={q.endsAt} clockOffset={game.clockOffset} totalSec={q.timeLimitSec} round />
            </div>
          )}
          <div className="relative h-full min-w-0 flex-1">
            <img
              src={imageUrl(q.imageId!)}
              alt=""
              className="absolute inset-0 m-auto max-h-full max-w-full rounded-[2vh] bg-white object-contain shadow-3d-lg"
            />
          </div>
          {/* Hueco del mismo ancho que el contador, para que la foto quede centrada. */}
          {!reveal && <div aria-hidden className="w-[min(13vw,24vh)] shrink-0" />}
        </div>
      )}

      {reveal
        ? reveal.explanation && (
            <div className="card flex h-[11vh] shrink-0 animate-[slide-in_350ms_both] items-center gap-[1.5vw] px-[2vw]">
              <LightbulbFill className="size-[6vh] shrink-0 text-opt-yellow" />
              <FitText text={reveal.explanation} max={80} align="left" className="h-full flex-1 py-[1vh] font-bold" />
            </div>
          )
        : !hasImage && (
            <div className="flex h-[11vh] shrink-0 items-center">
              <TvTimer endsAt={q.endsAt} clockOffset={game.clockOffset} totalSec={q.timeLimitSec} />
            </div>
          )}

      <div className={`grid shrink-0 grid-cols-2 grid-rows-2 gap-[1.6vh] ${hasImage ? 'h-[28vh]' : 'h-[36vh]'}`}>
        {q.options.map((opt, i) => {
          const style = optionStyle(q.type, i);
          const correct = reveal?.correctIndices.includes(i);
          const votes = reveal?.distribution[i] ?? 0;
          // Al revelar: la correcta en verde grande; las demás apagadas (pero su conteo se lee).
          const look = !reveal
            ? `${style.bg} ${style.text}`
            : correct
              ? 'scale-[1.02] bg-good text-white ring-[0.8vh] ring-white'
              : 'bg-black/25 text-white/45 shadow-none';
          return (
            <div
              key={i}
              className={`flex min-h-0 items-center gap-[1.2vw] rounded-[2vh] px-[1.6vw] font-black shadow-3d-lg transition-all duration-300 ${look} ${
                q.options.length === 2 ? 'row-span-2' : ''
              }`}
            >
              <OptionShape shape={style.shape} className="size-[7vh] shrink-0 drop-shadow" />
              {style.letter && <span className="shrink-0 text-[5vh] opacity-70">{style.letter}</span>}
              <FitText text={opt} max={150} align="left" className="h-full flex-1 py-[1.2vh]" />
              {reveal && (
                <span
                  className={`flex shrink-0 items-center gap-[0.6vw] rounded-[1.5vh] px-[1vw] py-[0.5vh] text-[5vh] tabular-nums ${
                    correct ? 'bg-white text-good' : 'bg-white/85 text-ink'
                  }`}
                  title={`${votes} ${votes === 1 ? 'persona' : 'personas'}`}
                >
                  {correct && <CheckCircleFill className="size-[5vh]" />}
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

/** Tiempo restante: número enorme y barra que se vacía; en rojo los últimos 5 s (con tic). */
function TvTimer({
  endsAt,
  clockOffset,
  totalSec,
  round = false,
}: {
  endsAt: number;
  clockOffset: number;
  totalSec: number;
  round?: boolean; // solo el círculo, grande (al lado de la imagen)
}) {
  const remaining = useRemainingMs(endsAt, clockOffset);
  const seconds = Math.ceil(remaining / 1000);
  const lastTick = useRef(0);
  useEffect(() => {
    if (seconds > 5 || seconds <= 0 || lastTick.current === seconds) return;
    lastTick.current = seconds;
    sound.tick();
  }, [seconds]);
  const urgent = remaining <= 5000;
  const circle = `grid aspect-square shrink-0 place-items-center rounded-full font-black tabular-nums shadow-3d-lg ${
    urgent ? 'animate-[pulse-ring_1s_ease-in-out_infinite] bg-bad text-white' : 'bg-white text-stage-dark'
  }`;
  if (round) {
    return (
      <span className={`${circle} size-[min(13vw,24vh)] text-[min(6.5vw,12vh)]`} role="timer" aria-label={`${seconds} segundos`}>
        {seconds}
      </span>
    );
  }
  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-[1.5vw]" role="timer" aria-label={`${seconds} segundos`}>
      <span className={`${circle} h-full text-[7vh]`}>{seconds}</span>
      <div className="h-[3.5vh] flex-1 overflow-hidden rounded-full bg-black/30">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${urgent ? 'bg-bad' : 'bg-white'}`}
          style={{ width: `${(remaining / (totalSec * 1000)) * 100}%` }}
        />
      </div>
    </div>
  );
}

function TvSeriesEnd({ snap }: { snap: GameSnapshot }) {
  const end = snap.seriesEnd;
  const entries = snap.leaderboard ?? [];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[3vh]">
      <div className="text-center">
        {end && (
          <p className="text-[4vh] font-bold text-stage-soft">
            Fin de la Serie {end.series.index + 1}: {end.series.title}
          </p>
        )}
        <h1 className="pill mt-[1.5vh] px-[3vw] py-[1vh] text-[7vh]">
          <TrophyFill className="size-[7vh] text-gold" />
          Top 5
        </h1>
      </div>
      <ol className="w-[min(88vw,150vh)] space-y-[1.6vh]">
        {entries.map((e, i) => (
          <li
            key={e.playerId}
            style={{ animationDelay: `${i * 90}ms` }}
            className={`flex h-[12vh] animate-[slide-in_350ms_both] items-center gap-[1.5vw] rounded-[2vh] bg-white px-[2vw] text-[6vh] font-black text-ink shadow-3d ${
              i === 0 ? 'ring-[0.7vh] ring-gold' : ''
            }`}
          >
            <span className="flex w-[6vh] justify-center tabular-nums">
              {e.rank === 1 ? <TrophyFill className="size-[6vh] text-gold" aria-label="1" /> : e.rank}
            </span>
            <span className="text-[7vh] leading-none" aria-hidden>
              {e.avatar}
            </span>
            <span className="min-w-0 flex-1 truncate">{e.nickname}</span>
            {e.delta !== 0 && (
              <span className={`flex items-center text-[3vh] ${e.delta > 0 ? 'text-good' : 'text-bad'}`}>
                {e.delta > 0 ? <CaretUpFill /> : <CaretDownFill />}
                {Math.abs(e.delta)}
              </span>
            )}
            <span className="tabular-nums">{e.score.toLocaleString('es')}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TvWinner({ top }: { top: ScoreEntry[] }) {
  const winner = top[0];
  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-[2vh]">
      {winner && (
        <div className="animate-[podium-reveal_600ms_both] text-center [animation-delay:2.2s]">
          <p className="pill px-[2.5vw] py-[1vh] text-[6vh]">
            <TrophyFill className="size-[6vh] text-gold" />
            ¡Ganador!
          </p>
          <p className="mt-[1.5vh] text-[11vh] leading-none font-black drop-shadow-lg">
            <span aria-hidden>{winner.avatar} </span>
            {winner.nickname}
          </p>
          <p className="mt-[1vh] text-[4vh] font-bold text-stage-soft">{winner.score.toLocaleString('es')} puntos</p>
        </div>
      )}
      <Podium top={top} />
    </div>
  );
}
