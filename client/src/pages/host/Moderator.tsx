import type { AckResponse, GameSnapshot } from '@quiz/shared';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRepeat,
  BoxArrowUpRight,
  CheckCircleFill,
  ChevronRight,
  Clipboard,
  ClipboardCheck,
  PeopleFill,
  PlayFill,
  ShareFill,
  SkipForwardFill,
  StopCircle,
  StopFill,
  Tv,
  TrophyFill,
  XLg,
} from 'react-bootstrap-icons';
import { Link, useParams } from 'react-router';
import { CenteredMessage } from '../../components/CenteredMessage';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { useRemainingMs } from '../../components/Countdown';
import { OptionShape, optionStyle } from '../../components/OptionShape';
import { Wordmark } from '../../components/Wordmark';
import { PUBLIC_URL } from '../../lib/api';
import { hostTokens } from '../../lib/session';
import { gameActions } from '../../lib/socket';
import { useGame, type GameState } from '../../lib/useGame';

type Run = (action: () => Promise<AckResponse>) => void;

/**
 * Panel del moderador: dirige la partida (normalmente desde el celular). Lo que ve el público
 * está en la pantalla TV (/tv/PIN), que se abre en el computador conectado al televisor.
 */
export default function Moderator() {
  const { pin = '' } = useParams();
  const hostToken = hostTokens.get(pin);
  const game = useGame(async () =>
    hostToken ? gameActions.hostJoin({ pin, hostToken }) : { ok: false, error: 'No eres el moderador de esta partida' },
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const runRef = useRef<Run>(() => {});

  const run: Run = async (action) => {
    setBusy(true);
    setActionError(null);
    const res = await action();
    if (!res.ok) setActionError(res.error);
    setBusy(false);
  };
  runRef.current = run;

  // Desde una laptop: espacio o Enter = el botón principal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
          Volver a tus trivias
        </Link>
      </CenteredMessage>
    );
  }
  const snap = game.snap;
  if (!snap) return <CenteredMessage title="Conectando…" />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 pt-3 pb-[calc(1.5rem+var(--badge-space))]">
      <ConnectionBanner connected={game.connected} />
      <header className="flex items-center gap-3">
        <Wordmark />
        <span className="ml-auto rounded-full bg-white px-3 py-1 font-black text-ink tabular-nums">PIN {snap.pin}</span>
      </header>
      <div>
        <p className="eyebrow">Moderador</p>
        <h1 className="text-2xl leading-tight font-black">{snap.quizTitle}</h1>
        <p className="flex items-center gap-1.5 text-stage-soft">
          <PeopleFill /> {snap.players.length} {snap.players.length === 1 ? 'jugador' : 'jugadores'} · {snap.seriesCount}{' '}
          {snap.seriesCount === 1 ? 'serie' : 'series'} · {snap.totalQuestions} {snap.totalQuestions === 1 ? 'pregunta' : 'preguntas'}
        </p>
      </div>

      {snap.phase === 'lobby' && <ShareCard pin={snap.pin} />}
      <PhaseCard game={game} busy={busy} run={run} />
      {actionError && <p className="rounded-xl bg-bad p-3 text-center font-bold text-white shadow-3d-sm">{actionError}</p>}
      {snap.phase !== 'lobby' && <ShareCard pin={snap.pin} compact />}
      <PlayersCard snap={snap} run={run} />

      <div className="mt-auto flex flex-wrap justify-between gap-2 pt-2">
        <Link to="/host" className="btn btn-plain">
          Tus trivias
        </Link>
        {snap.phase !== 'podium' && (
          <button
            disabled={busy}
            onClick={() => confirm('¿Terminar la partida ahora?') && run(gameActions.hostEnd)}
            className="btn btn-plain"
          >
            <StopCircle />
            Terminar partida
          </button>
        )}
      </div>
    </div>
  );
}

/** Dónde se abre la pantalla TV y cómo se comparte el link con los participantes. */
function ShareCard({ pin, compact = false }: { pin: string; compact?: boolean }) {
  const tvUrl = `${window.location.origin}/tv/${pin}`;
  const joinUrl = `${PUBLIC_URL}/${pin}`;
  const [copied, setCopied] = useState<'tv' | 'join' | null>(null);

  async function copy(text: string, which: 'tv' | 'join') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      prompt('Copia el link:', text);
    }
  }

  async function share() {
    const text = `¡Únete a la trivia! Entra aquí: ${joinUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Trivia en vivo', text, url: joinUrl });
        return;
      } catch {
        /* el usuario canceló: no pasa nada */
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    }
  }

  return (
    <section className="card space-y-3 p-4">
      {!compact && (
        <div>
          <p className="flex items-center gap-2 font-black">
            <Tv className="text-stage" /> Pantalla TV
          </p>
          <p className="text-sm text-ink-soft">Ábrela en el computador conectado al televisor.</p>
        </div>
      )}
      <div className="flex gap-2">
        <a href={tvUrl} target="_blank" rel="noopener" className="btn btn-dark min-w-0 flex-1">
          <BoxArrowUpRight />
          Abrir pantalla TV
        </a>
        <button onClick={() => copy(tvUrl, 'tv')} className="btn btn-light shrink-0 px-3" title="Copiar el link de la TV" aria-label="Copiar el link de la TV">
          {copied === 'tv' ? <ClipboardCheck className="size-5 text-good" /> : <Clipboard className="size-5" />}
        </button>
      </div>
      {!compact && (
        <div className="border-t-2 border-black/5 pt-3">
          <p className="font-black">Link para los participantes</p>
          <p className="truncate text-sm text-stage">{joinUrl}</p>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={share} className="btn btn-accent min-w-0 flex-1">
          <ShareFill />
          Compartir link
        </button>
        <button
          onClick={() => copy(joinUrl, 'join')}
          className="btn btn-light shrink-0 px-3"
          title="Copiar el link de los participantes"
          aria-label="Copiar el link de los participantes"
        >
          {copied === 'join' ? <ClipboardCheck className="size-5 text-good" /> : <Clipboard className="size-5" />}
        </button>
      </div>
      {copied && <p className="text-sm font-bold text-good">¡Link copiado!</p>}
    </section>
  );
}

/** Lo que está pasando ahora y el botón para avanzar. */
function PhaseCard({ game, busy, run }: { game: GameState; busy: boolean; run: Run }) {
  const snap = game.snap!;
  const next = () => run(gameActions.hostNext);
  const big = 'btn btn-lg w-full py-5 text-2xl';

  if (snap.phase === 'lobby') {
    const connected = snap.players.filter((p) => p.connected).length;
    return (
      <section className="card p-4 text-center">
        <p className="text-lg font-bold">
          {snap.players.length === 0 ? 'Esperando a que entren los participantes…' : `${connected} conectados. ¿Están todos?`}
        </p>
        <button disabled={busy || connected === 0} onClick={() => run(gameActions.hostStart)} className={`${big} btn-accent mt-3`}>
          <PlayFill className="size-8" />
          Iniciar
        </button>
      </section>
    );
  }

  if (snap.phase === 'countdown' && snap.countdown) {
    const c = snap.countdown;
    return (
      <section className="card p-4">
        <Where series={c.series} inSeries={c.inSeries} />
        <p className="mt-1 text-xl font-black">¡Prepárate! La pregunta aparece en unos segundos…</p>
        <button disabled={busy} onClick={next} className={`${big} btn-dark mt-3`}>
          <SkipForwardFill className="size-7" />
          Mostrar ya
        </button>
      </section>
    );
  }

  if ((snap.phase === 'question' || snap.phase === 'reveal') && snap.question) {
    const q = snap.question;
    const reveal = snap.phase === 'reveal' ? snap.reveal : null;
    const total = snap.players.length;
    const nextLabel = !reveal ? null : !reveal.endsSeries ? 'Siguiente pregunta' : 'Ver tabla';
    return (
      <section className="card p-4">
        <Where series={q.series} inSeries={q.inSeries} />
        <p className="mt-1 text-xl leading-snug font-black">{q.text}</p>
        {!reveal && (
          <div className="mt-3 flex items-center gap-3">
            <Seconds endsAt={q.endsAt} clockOffset={game.clockOffset} />
            <div className="flex-1">
              <p className="font-bold">
                {snap.answeredCount} de {total} respondieron
              </p>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-paper-2">
                <div
                  className="h-full rounded-full bg-stage transition-[width]"
                  style={{ width: `${total ? (snap.answeredCount / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}
        <ul className="mt-3 space-y-1.5">
          {q.options.map((opt, i) => {
            const style = optionStyle(q.type, i);
            const correct = reveal?.correctIndices.includes(i);
            return (
              <li
                key={i}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 font-bold ${
                  correct ? 'bg-good text-white' : reveal ? 'bg-paper text-ink-soft' : 'bg-paper'
                }`}
              >
                <span className={`grid size-7 shrink-0 place-items-center rounded-md ${style.bg} ${style.text}`}>
                  <OptionShape shape={style.shape} className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 break-words">{opt}</span>
                {correct && <CheckCircleFill className="shrink-0" />}
                {reveal && <span className="shrink-0 tabular-nums">{reveal.distribution[i] ?? 0}</span>}
              </li>
            );
          })}
        </ul>
        {reveal ? (
          <button disabled={busy} onClick={next} className={`${big} ${reveal.endsSeries ? 'btn-accent' : 'btn-dark'} mt-4`}>
            {reveal.endsSeries && <TrophyFill className="size-6" />}
            {nextLabel}
            <ChevronRight className="size-6" />
          </button>
        ) : (
          <button disabled={busy} onClick={next} className="btn btn-light mt-4 w-full">
            <StopFill />
            Cerrar pregunta ya
          </button>
        )}
      </section>
    );
  }

  if (snap.phase === 'leaderboard') {
    const end = snap.seriesEnd;
    return (
      <section className="card p-4">
        {end && (
          <p className="text-sm font-bold text-ink-soft">
            Fin de la Serie {end.series.index + 1}: {end.series.title}
          </p>
        )}
        <p className="text-xl font-black">Top 5</p>
        <TopList entries={snap.leaderboard ?? []} />
        <button disabled={busy} onClick={next} className={`${big} btn-accent mt-4`}>
          {end?.isLast ? (
            <>
              <TrophyFill className="size-7" />
              Ver ganador
            </>
          ) : (
            <>
              <PlayFill className="size-7" />
              Iniciar Serie {(end?.series.index ?? 0) + 2}
            </>
          )}
        </button>
      </section>
    );
  }

  if (snap.phase === 'podium') {
    return (
      <section className="card p-4">
        <p className="flex items-center gap-2 text-xl font-black">
          <TrophyFill className="text-gold" /> ¡Terminó! Ganador: {snap.podium?.[0]?.nickname ?? '—'}
        </p>
        <TopList entries={snap.podium ?? []} />
        <button disabled={busy} onClick={() => run(gameActions.hostPlayAgain)} className={`${big} btn-accent mt-4`}>
          <ArrowRepeat className="size-7" />
          Jugar otra vez
        </button>
      </section>
    );
  }
  return null;
}

function Where({ series, inSeries }: { series: { index: number; total: number; title: string }; inSeries: { index: number; total: number } }) {
  return (
    <p className="text-sm font-bold text-ink-soft">
      Serie {series.index + 1} de {series.total} · {series.title} · Pregunta {inSeries.index + 1} de {inSeries.total}
    </p>
  );
}

function Seconds({ endsAt, clockOffset }: { endsAt: number; clockOffset: number }) {
  const remaining = useRemainingMs(endsAt, clockOffset);
  const urgent = remaining <= 5000;
  return (
    <span
      className={`grid size-14 shrink-0 place-items-center rounded-full text-2xl font-black tabular-nums ${
        urgent ? 'bg-bad text-white' : 'bg-stage text-white'
      }`}
    >
      {Math.ceil(remaining / 1000)}
    </span>
  );
}

function TopList({ entries }: { entries: GameSnapshot['podium'] & object }) {
  return (
    <ol className="mt-2 space-y-1">
      {entries.map((e) => (
        <li key={e.playerId} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-1.5">
          <span className="w-6 font-black tabular-nums">{e.rank}</span>
          <span aria-hidden>{e.avatar}</span>
          <span className="min-w-0 flex-1 truncate font-bold">{e.nickname}</span>
          <span className="font-black tabular-nums">{e.score.toLocaleString('es')}</span>
        </li>
      ))}
    </ol>
  );
}

function PlayersCard({ snap, run }: { snap: GameSnapshot; run: Run }) {
  return (
    <details className="card p-4" open={snap.phase === 'lobby'}>
      <summary className="cursor-pointer font-black">
        Participantes ({snap.players.length}) <span className="font-normal text-ink-soft">· toca uno para sacarlo</span>
      </summary>
      {snap.players.length === 0 ? (
        <p className="mt-2 text-ink-soft">Todavía nadie.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {snap.players.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => confirm(`¿Sacar a ${p.nickname} de la partida?`) && run(() => gameActions.hostKick(p.id))}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
                  p.connected ? 'bg-paper text-ink' : 'bg-paper/50 text-ink-soft'
                }`}
              >
                <span aria-hidden>{p.avatar}</span>
                {p.nickname}
                <XLg className="size-3 opacity-50" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
