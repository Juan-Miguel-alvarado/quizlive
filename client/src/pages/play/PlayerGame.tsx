import type { GameSnapshot } from '@quiz/shared';
import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { CenteredMessage } from '../../components/CenteredMessage';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { CountdownCircle } from '../../components/Countdown';
import { GetReady } from '../../components/GetReady';
import { OptionShape, optionStyle } from '../../components/OptionShape';
import { imageUrl } from '../../lib/images';
import { playerSession } from '../../lib/session';
import { gameActions } from '../../lib/socket';
import { useGame } from '../../lib/useGame';

type Game = ReturnType<typeof useGame>;

export default function PlayerGame() {
  const [session] = useState(playerSession.get);
  const game = useGame(async () =>
    session
      ? gameActions.playerRejoin({ pin: session.pin, playerToken: session.playerToken })
      : { ok: false, error: 'Sin sesión' },
  );

  if (!session) return <Navigate to="/" replace />;

  if (game.closedReason) {
    return (
      <CenteredMessage title="Se cortó la partida" message={game.closedReason}>
        <Link to="/" onClick={playerSession.clear} className="btn btn-primary">
          Volver al inicio
        </Link>
      </CenteredMessage>
    );
  }

  const snap = game.snap;
  if (!snap?.me) return <CenteredMessage title="Conectando…" />;
  const resultBg = snap.phase === 'reveal' ? resultStyle(snap).bg : '';

  return (
    <div className={`flex min-h-dvh flex-col ${resultBg}`}>
      <ConnectionBanner connected={game.connected} />
      <header className="flex items-center justify-between gap-3 border-b-2 border-ink bg-ink px-4 py-2.5 text-paper">
        <span className="truncate font-bold">{snap.me.nickname}</span>
        <span className="font-mono text-sm font-bold tabular-nums">{snap.me.score.toLocaleString('es')} pts</span>
      </header>
      <main className="flex flex-1 flex-col p-4">
        {snap.phase === 'lobby' && (
          <Centered>
            <p className="eyebrow">Partida {snap.pin}</p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight">Ya estás dentro</p>
            <p className="mt-3 max-w-xs text-ink-soft">
              Busca tu nombre en la pantalla. La partida empieza cuando el anfitrión lo decida.
            </p>
          </Centered>
        )}
        {snap.phase === 'countdown' && snap.countdown && (
          <GetReady countdown={snap.countdown} clockOffset={game.clockOffset} size="sm" />
        )}
        {snap.phase === 'question' && <AnswerScreen key={snap.question!.index} game={game} />}
        {snap.phase === 'reveal' && <ResultScreen snap={snap} />}
        {snap.phase === 'leaderboard' && (
          <Centered>
            <p className="eyebrow">Vas en el puesto</p>
            <p className="text-9xl font-extrabold tabular-nums">{snap.me.rank}</p>
            <p className="mt-1 font-mono text-lg">{snap.me.score.toLocaleString('es')} pts</p>
            {snap.me.rank <= 5 && (
              <p className="mt-6 rounded-full border-2 border-ink bg-accent px-4 py-1 font-bold">Estás en el top 5</p>
            )}
          </Centered>
        )}
        {snap.phase === 'podium' && (
          <Centered>
            <p className="eyebrow">Terminaste en el puesto</p>
            <p className="text-9xl font-extrabold tabular-nums">{snap.me.rank}</p>
            <p className="mt-1 font-mono text-lg">{snap.me.score.toLocaleString('es')} pts</p>
            {snap.me.rank <= 3 && (
              <p className="mt-6 rounded-full border-2 border-ink bg-accent px-4 py-1 font-bold">Estás en el podio</p>
            )}
            <Link to="/" onClick={playerSession.clear} className="btn btn-primary mt-10">
              Jugar otra partida
            </Link>
          </Centered>
        )}
      </main>
    </div>
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

  if (sent !== null) {
    return (
      <Centered>
        <div className="flex gap-2">
          {sent.map((c) => {
            const style = optionStyle(q.type, c);
            return (
              <span
                key={c}
                className={`grid size-20 animate-[pop_250ms_both] place-items-center rounded-md border-2 border-ink shadow-hard ${style.bg} ${style.text}`}
              >
                <OptionShape shape={style.shape} className="size-10" />
              </span>
            );
          })}
        </div>
        <p className="mt-6 text-2xl font-extrabold">Respuesta enviada</p>
        <p className="mt-1 text-ink-soft">Esperando al resto…</p>
      </Centered>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-lg leading-snug font-bold">{q.text}</p>
        <CountdownCircle endsAt={q.endsAt} clockOffset={game.clockOffset} totalSec={q.timeLimitSec} size="sm" />
      </div>
      {q.imageId && (
        <img
          src={imageUrl(q.imageId)}
          alt=""
          className="max-h-[22vh] w-full rounded-md border-2 border-ink bg-white object-contain"
        />
      )}
      {multiple && <p className="eyebrow">Marca todas las correctas</p>}
      {error && <p className="rounded-md border-2 border-ink bg-bad p-2 text-center font-semibold text-white">{error}</p>}

      <div className={`grid flex-1 gap-2 ${q.options.length === 2 ? 'grid-rows-2' : 'grid-cols-2'}`}>
        {q.options.map((opt, i) => {
          const style = optionStyle(q.type, i);
          const isSelected = selected.includes(i);
          return (
            <button
              key={i}
              onClick={() => tap(i)}
              aria-pressed={multiple ? isSelected : undefined}
              className={`relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border-2 border-ink p-3 transition-[translate,box-shadow] duration-75 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${style.bg} ${style.text} ${
                isSelected ? 'shadow-none ring-4 ring-ink ring-inset' : 'shadow-hard'
              }`}
            >
              <OptionShape shape={style.shape} className="size-9" />
              <span className="line-clamp-3 text-base font-bold break-words">{opt}</span>
              {isSelected && (
                <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full border-2 border-ink bg-white text-sm font-black text-ink">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {multiple && (
        <button
          onClick={() => send(selected)}
          disabled={selected.length === 0}
          className="btn btn-primary btn-lg mb-[env(safe-area-inset-bottom)] w-full"
        >
          Enviar {selected.length > 0 && `(${selected.length})`}
        </button>
      )}
    </div>
  );
}

function resultStyle(snap: GameSnapshot) {
  const r = snap.me!.lastResult;
  if (!r) return { bg: '', title: 'Calculando…' };
  if (r.correct) return { bg: 'bg-good text-white', title: 'Correcto' };
  if (r.answered) return { bg: 'bg-bad text-white', title: 'Incorrecto' };
  return { bg: 'bg-paper-2', title: 'Sin respuesta' };
}

function ResultScreen({ snap }: { snap: GameSnapshot }) {
  const r = snap.me!.lastResult;
  const { title } = resultStyle(snap);
  return (
    <Centered>
      <p className="animate-[pop_300ms_both] text-5xl font-extrabold tracking-tight">{title}</p>
      {r?.correct && <p className="mt-2 text-5xl font-extrabold tabular-nums">+{r.points}</p>}
      {r && (
        <p className="mt-10 rounded-md border-2 border-ink bg-white px-4 py-2 text-ink">
          Puesto <span className="font-mono font-bold">{r.rank}</span> ·{' '}
          <span className="font-mono font-bold">{r.totalScore.toLocaleString('es')}</span> pts
        </p>
      )}
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>;
}
