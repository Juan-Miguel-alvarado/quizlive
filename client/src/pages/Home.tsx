import { nicknameSchema, pinSchema, randomAvatar, randomNickname, type Avatar } from '@quiz/shared';
import { useEffect, useRef, useState } from 'react';
import { ArrowCounterclockwise, ArrowRight, BoxArrowInRight, Dice5Fill, PlayFill } from 'react-bootstrap-icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AvatarPicker } from '../components/AvatarPicker';
import { WakingBanner } from '../components/WakingBanner';
import { Wordmark } from '../components/Wordmark';
import { api } from '../lib/api';
import { playerProfile, playerSession } from '../lib/session';
import { gameActions } from '../lib/socket';
import { useServerWakeup } from '../lib/useServerWakeup';

export default function Home() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // El PIN puede venir en la ruta corta (/482913, la del QR) o como ?pin= (enlaces viejos).
  const initialPin = useParams().pin ?? params.get('pin');
  const [pin, setPin] = useState(initialPin ?? '');
  const [quizTitle, setQuizTitle] = useState<string | null>(null);
  const [profile] = useState(playerProfile.get);
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [avatar, setAvatar] = useState<Avatar>(profile?.avatar ?? randomAvatar);
  // Si el nombre lo puso el dado, cambiar de dibujo lo cambia también (🦁 → "León …").
  const [diceName, setDiceName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previous] = useState(playerSession.get);
  const waking = useServerWakeup();

  // Si se llegó escaneando el QR, se valida el PIN solo y se pasa directo al nombre.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (autoChecked.current || !initialPin) return;
    autoChecked.current = true;
    void checkPin(initialPin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changePin(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setPin(digits);
    setError(null);
    // Al escribir el sexto número se busca la partida sin tener que tocar «Entrar».
    if (digits.length === 6 && !loading) void checkPin(digits);
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

  function chooseAvatar(a: Avatar) {
    setAvatar(a);
    if (diceName) setNickname(randomNickname(a));
  }

  function rollName() {
    setNickname(randomNickname(avatar));
    setDiceName(true);
    setError(null);
  }

  async function submitNickname(e: React.FormEvent) {
    e.preventDefault();
    const parsed = nicknameSchema.safeParse(nickname);
    if (!parsed.success) return setError('Escribe tu nombre o toca el dado');
    setLoading(true);
    setError(null);
    const res = await gameActions.playerJoin({ pin, nickname: parsed.data, avatar });
    setLoading(false);
    if (!res.ok) return setError(res.error);
    // El servidor puede haber añadido un número si el nombre ya estaba ("Ana" → "Ana 2").
    playerSession.set({ pin, playerToken: res.playerToken, nickname: res.state.me?.nickname ?? parsed.data });
    playerProfile.set({ nickname: parsed.data, avatar });
    navigate('/play');
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-6 pb-[calc(1.5rem+var(--badge-space))]">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-8 text-center">
          <Wordmark size="lg" />
          <p className="mt-3 text-lg text-stage-soft">Juega desde tu celular. ¡Es muy fácil!</p>
        </div>

        <WakingBanner waking={waking} />

        {quizTitle === null ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void checkPin(pin);
            }}
            className="card p-4"
          >
            <label htmlFor="pin" className="block text-center text-lg font-bold">
              Escribe el número que ves en la pantalla
            </label>
            <input
              id="pin"
              value={pin}
              onChange={(e) => changePin(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoFocus={!initialPin}
              placeholder="PIN del juego"
              aria-describedby="pin-help"
              className="field mt-3 text-center text-3xl font-black tracking-[0.2em] placeholder:text-xl placeholder:font-bold placeholder:tracking-normal"
            />
            <p id="pin-help" className="mt-2 text-center text-sm text-ink-soft">
              Son 6 números. Al escribir el último entras solo.
            </p>
            <button disabled={loading} className="btn btn-dark btn-lg mt-3 w-full">
              {loading ? 'Buscando…' : (
                <>
                  <BoxArrowInRight className="size-5" />
                  Entrar
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={submitNickname} className="card p-4">
            <p className="eyebrow">Partida {pin}</p>
            <p className="mb-4 text-lg font-bold">{quizTitle}</p>

            <p className="mb-2 font-bold">Elige tu dibujo</p>
            <AvatarPicker value={avatar} onChange={chooseAvatar} />

            <label htmlFor="nickname" className="mt-5 mb-2 block font-bold">
              ¿Cómo te llamas?
            </label>
            <div className="flex gap-2">
              <span className="grid size-13 shrink-0 place-items-center rounded-lg bg-paper text-3xl" aria-hidden>
                {avatar}
              </span>
              <input
                id="nickname"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setDiceName(false);
                }}
                maxLength={20}
                autoComplete="off"
                enterKeyHint="go"
                placeholder="Tu nombre"
                className="field min-w-0 text-xl font-bold"
              />
            </div>
            <button type="button" onClick={rollName} className="btn btn-light mt-2 w-full">
              <Dice5Fill className="size-5" />
              Elegir un nombre por mí
            </button>

            <button disabled={loading} className="btn btn-accent btn-lg mt-4 w-full text-2xl">
              {loading ? 'Entrando…' : (
                <>
                  <PlayFill className="size-8" />
                  ¡Jugar!
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuizTitle(null);
                setPin('');
              }}
              className="mt-3 w-full text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Cambiar de partida
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-bad px-3 py-2 text-center font-bold text-white shadow-3d-sm">
            {error}
          </p>
        )}

        {previous && (
          <Link to="/play" className="btn btn-plain mt-6">
            <ArrowCounterclockwise className="size-5" />
            Volver a mi partida · {previous.nickname}
          </Link>
        )}
      </main>

      <footer className="mx-auto w-full max-w-sm pt-8 text-sm">
        <Link to="/host" className="inline-flex items-center gap-1 text-stage-soft underline-offset-4 hover:text-white hover:underline">
          ¿Vas a dirigir la partida? Crea un quiz
          <ArrowRight />
        </Link>
      </footer>
    </div>
  );
}
