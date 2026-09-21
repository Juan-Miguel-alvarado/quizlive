import type { AckResponse, GameSnapshot } from '@quiz/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CenteredMessage } from '../../components/CenteredMessage';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { CountdownCircle } from '../../components/Countdown';
import { GetReady } from '../../components/GetReady';
import { Leaderboard } from '../../components/Leaderboard';
import { OptionShape, optionStyle, QUESTION_TYPE_LABELS } from '../../components/OptionShape';
import { Podium } from '../../components/Podium';
import { Wordmark } from '../../components/Wordmark';
import { imageUrl } from '../../lib/images';
import { hostTokens } from '../../lib/session';
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

  async function run(action: () => Promise<AckResponse>) {
    setBusy(true);
    setActionError(null);
    const res = await action();
    if (!res.ok) setActionError(res.error);
    setBusy(false);
  }

  if (game.closedReason) {
    return (
      <CenteredMessage title="Partida cerrada" message={game.closedReason}>
        <Link to="/host" className="btn btn-primary">
          Volver a tus quizzes
        </Link>
      </CenteredMessage>
    );
  }

  const snap = game.snap;
  if (!snap) return <CenteredMessage title="Conectando…" />;

  const controls: Controls = { busy, run };
  const inQuestion = snap.phase === 'question' || snap.phase === 'reveal';
  const showProgress = snap.question && inQuestion;

  return (
    // En pantallas grandes la pregunta ocupa exactamente la altura visible (nada queda bajo el pliegue del proyector).
    <div className={`flex min-h-dvh flex-col pb-(--badge-space) ${inQuestion ? 'lg:h-dvh' : ''}`}>
      <ConnectionBanner connected={game.connected} />
      <header className="flex items-center gap-3 border-b-2 border-ink px-4 py-2.5 sm:px-6">
        <Wordmark />
        <span className="hidden min-w-0 truncate text-ink-soft md:block">/ {snap.quizTitle}</span>
        <div className="ml-auto flex shrink-0 items-center gap-3 font-mono text-sm">
          {showProgress && (
            <span className="font-bold">
              {snap.question!.index + 1}/{snap.question!.total}
            </span>
          )}
          {snap.phase !== 'lobby' && <span className="hidden text-ink-soft sm:inline">PIN {snap.pin}</span>}
          {snap.phase !== 'podium' && (
            <button
              disabled={busy}
              onClick={() => confirm('¿Terminar la partida ahora?') && run(gameActions.hostEnd)}
              className="btn btn-plain px-3 py-1 font-sans text-sm"
            >
              Terminar
            </button>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6 xl:px-10">
        {snap.phase === 'lobby' && <Lobby snap={snap} {...controls} />}
        {snap.phase === 'countdown' && snap.countdown && (
          <div className="flex flex-1 flex-col items-center">
            <GetReady countdown={snap.countdown} clockOffset={game.clockOffset} size="lg" />
            <button disabled={busy} onClick={() => run(gameActions.hostNext)} className="btn btn-plain">
              Mostrar ya
            </button>
          </div>
        )}
        {(snap.phase === 'question' || snap.phase === 'reveal') && <QuestionScreen game={game} {...controls} />}
        {snap.phase === 'leaderboard' && (
          <PhaseLayout title="Clasificación" action={<NextButton {...controls} label="Siguiente pregunta" />}>
            <Leaderboard entries={snap.leaderboard ?? []} />
          </PhaseLayout>
        )}
        {snap.phase === 'podium' && (
          <PhaseLayout
            title="Resultado final"
            action={
              <Link to="/host" className="btn btn-primary btn-lg">
                Volver a tus quizzes
              </Link>
            }
          >
            <Podium top={snap.podium ?? []} />
          </PhaseLayout>
        )}
      </main>

      {actionError && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-[calc(1rem+var(--badge-space))] mx-auto max-w-md rounded-md border-2 border-ink bg-bad p-3 text-center font-semibold text-white shadow-hard"
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
  // El QR lleva el PIN: al escanearlo se salta el paso de escribirlo.
  const joinUrl = `${window.location.origin}/?pin=${snap.pin}`;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
      <section className="lg:w-[34rem] lg:shrink-0">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-6">
          <div>
            <p className="eyebrow">Entra en</p>
            <p className="text-2xl font-bold break-all sm:text-3xl">{window.location.host}</p>
            <p className="eyebrow mt-6">con el PIN</p>
            <p className="font-mono text-6xl font-bold tracking-tight tabular-nums sm:text-7xl xl:text-8xl">
              {snap.pin.slice(0, 3)}
              <span className="text-ink-soft/40">·</span>
              {snap.pin.slice(3)}
            </p>
          </div>
          <figure className="shrink-0">
            <div className="rounded-md border-2 border-ink bg-white p-2 shadow-hard">
              <QRCodeSVG
                value={joinUrl}
                marginSize={1}
                fgColor="#17150f"
                bgColor="#ffffff"
                title={`Unirse a la partida ${snap.pin}`}
                className="size-36 sm:size-44 xl:size-56"
              />
            </div>
            <figcaption className="eyebrow mt-2 text-center">o escanea</figcaption>
          </figure>
        </div>
        {isLocalhost && (
          <p className="mt-4 rounded-md border-2 border-dashed border-ink/40 p-3 text-sm text-ink-soft">
            Los celulares no pueden abrir <code>localhost</code>. Abre esta pantalla con la IP de tu PC (Vite la muestra
            como <em>Network</em>).
          </p>
        )}
        <button
          disabled={busy || connectedCount === 0}
          onClick={() => run(gameActions.hostStart)}
          className="btn btn-accent btn-lg mt-8 w-full text-xl sm:w-auto"
        >
          Empezar partida ▸
        </button>
      </section>

      <section className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
          <h2 className="text-xl font-extrabold">Jugadores</h2>
          <span className="font-mono text-2xl font-bold tabular-nums">{snap.players.length}</span>
        </div>
        {snap.players.length === 0 ? (
          <p className="py-10 text-center text-ink-soft">
            Esperando a que alguien entre<span className="animate-pulse">…</span>
          </p>
        ) : (
          <>
            <ul className="mt-4 flex flex-wrap gap-2">
              {snap.players.map((p) => (
                <li key={p.id} className="animate-[pop_250ms_both]">
                  <button
                    title="Clic para expulsar"
                    onClick={() => confirm(`¿Expulsar a ${p.nickname}?`) && run(() => gameActions.hostKick(p.id))}
                    className={`rounded-md border-2 border-ink px-3 py-1.5 text-lg font-bold hover:line-through xl:text-xl ${
                      p.connected ? 'bg-white' : 'border-dashed bg-transparent text-ink-soft'
                    }`}
                  >
                    {p.nickname}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-soft">Haz clic en un nombre para expulsarlo.</p>
          </>
        )}
      </section>
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
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{QUESTION_TYPE_LABELS[q.type]}</p>
          <h1 className="mt-1 text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl xl:text-5xl">
            {q.text}
          </h1>
        </div>
        {!reveal && <CountdownCircle endsAt={q.endsAt} clockOffset={game.clockOffset} totalSec={q.timeLimitSec} />}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center gap-4 sm:flex-row">
        {q.imageId && (
          // absolute + m-auto + max-*: la imagen se ajusta al espacio libre sin deformarse y el borde la abraza.
          <div className="relative h-[32vh] min-h-0 flex-1 lg:h-auto">
            <img
              src={imageUrl(q.imageId)}
              alt=""
              className="absolute inset-0 m-auto max-h-full max-w-full rounded-md border-2 border-ink"
            />
          </div>
        )}
        <div className={`flex items-center justify-center ${q.imageId ? 'sm:w-64' : 'flex-1'}`}>
          {reveal ? (
            <div className="flex h-40 items-end gap-2 sm:h-52 lg:h-full lg:max-h-64" aria-label="Respuestas por opción">
              {reveal.distribution.map((count, i) => {
                const style = optionStyle(q.type, i);
                const correct = reveal.correctIndices.includes(i);
                return (
                  <div
                    key={i}
                    className={`flex h-full w-12 flex-col items-center justify-end xl:w-16 ${correct ? '' : 'opacity-35'}`}
                  >
                    <span className="text-xl font-extrabold tabular-nums xl:text-3xl">{count}</span>
                    <div
                      className={`w-full origin-bottom animate-[rise_500ms_both] border-2 border-ink ${style.bg}`}
                      style={{ height: `${Math.max(3, (count / maxVotes) * 75)}%` }}
                    />
                    <span className={`mt-1 grid w-full place-items-center rounded-sm py-1 ${style.bg} ${style.text}`}>
                      <OptionShape shape={style.shape} className="size-4" />
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-7xl font-extrabold tabular-nums xl:text-9xl">{snap.answeredCount}</p>
              <p className="text-ink-soft xl:text-lg">de {snap.players.length} han respondido</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        {q.options.map((opt, i) => {
          const style = optionStyle(q.type, i);
          const correct = reveal?.correctIndices.includes(i);
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-md border-2 border-ink px-4 py-3 text-lg font-bold transition-opacity sm:py-4 sm:text-2xl xl:py-5 xl:text-3xl ${style.bg} ${style.text} ${
                reveal && !correct ? 'opacity-30' : ''
              } ${correct ? 'shadow-hard-lg' : ''}`}
            >
              <OptionShape shape={style.shape} className="size-6 shrink-0 xl:size-8" />
              <span className="min-w-0 flex-1 break-words">{opt}</span>
              {correct && (
                <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-base text-ink xl:size-10">
                  ✓
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        {reveal ? (
          <NextButton busy={busy} run={run} label={isLast ? 'Ver resultado final' : 'Siguiente'} />
        ) : (
          <button disabled={busy} onClick={() => run(gameActions.hostNext)} className="btn btn-plain">
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
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl">{title}</h1>
      <div className="flex w-full flex-1 items-center">{children}</div>
      {action}
    </div>
  );
}

function NextButton({ busy, run, label }: Controls & { label: string }) {
  return (
    <button disabled={busy} onClick={() => run(gameActions.hostNext)} className="btn btn-primary btn-lg">
      {label} ▸
    </button>
  );
}
