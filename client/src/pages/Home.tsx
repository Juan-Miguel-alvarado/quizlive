import { nicknameSchema, pinSchema } from '@quiz/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Wordmark } from '../components/Wordmark';
import { api } from '../lib/api';
import { playerSession } from '../lib/session';
import { gameActions } from '../lib/socket';

export default function Home() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [pin, setPin] = useState(params.get('pin') ?? '');
  const [quizTitle, setQuizTitle] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previous] = useState(playerSession.get);

  // Si se llegó escaneando el QR (/?pin=123456), se valida el PIN solo y se pasa directo al apodo.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (autoChecked.current || !params.get('pin')) return;
    autoChecked.current = true;
    void checkPin(params.get('pin')!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    await checkPin(pin);
  }

  async function checkPin(raw: string) {
    const parsed = pinSchema.safeParse(raw.replace(/\s/g, ''));
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setLoading(true);
    setError(null);
    try {
      const game = await api.getGame(parsed.data);
      setPin(parsed.data);
      setQuizTitle(game.quizTitle);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submitNickname(e: React.FormEvent) {
    e.preventDefault();
    const parsed = nicknameSchema.safeParse(nickname);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setLoading(true);
    setError(null);
    const res = await gameActions.playerJoin({ pin, nickname: parsed.data });
    setLoading(false);
    if (!res.ok) return setError(res.error);
    playerSession.set({ pin, playerToken: res.playerToken, nickname: parsed.data });
    navigate('/play');
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-6 pb-[calc(1.5rem+var(--badge-space))]">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-10">
          <Wordmark size="lg" />
          <p className="mt-3 text-lg text-ink-soft">Quizzes en vivo para la clase.</p>
        </div>

        {quizTitle === null ? (
          <form onSubmit={submitPin} className="card p-4">
            <label htmlFor="pin" className="eyebrow">
              PIN de la partida
            </label>
            <input
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              maxLength={7}
              placeholder="000000"
              className="field mt-2 text-center font-mono text-3xl font-bold tracking-[0.3em] placeholder:tracking-[0.3em]"
            />
            <button disabled={loading} className="btn btn-primary btn-lg mt-3 w-full">
              {loading ? 'Buscando…' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitNickname} className="card p-4">
            <p className="eyebrow">Partida {pin}</p>
            <p className="mb-4 text-lg font-bold">{quizTitle}</p>
            <label htmlFor="nickname" className="eyebrow">
              Tu apodo
            </label>
            <input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              autoFocus
              autoComplete="off"
              placeholder="Cómo te verán los demás"
              className="field mt-2 text-xl font-bold"
            />
            <button disabled={loading} className="btn btn-primary btn-lg mt-3 w-full">
              {loading ? 'Entrando…' : 'Jugar'}
            </button>
            <button
              type="button"
              onClick={() => setQuizTitle(null)}
              className="mt-3 w-full text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Cambiar PIN
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-3 font-semibold text-bad">
            {error}
          </p>
        )}

        {previous && (
          <Link to="/play" className="btn btn-plain mt-6">
            Volver a mi partida · {previous.nickname}
          </Link>
        )}
      </main>

      <footer className="mx-auto w-full max-w-sm pt-8 text-sm">
        <Link to="/host" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          ¿Vas a dirigir la partida? Crea un quiz →
        </Link>
      </footer>
    </div>
  );
}
