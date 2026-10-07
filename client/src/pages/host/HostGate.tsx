import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { WakingBanner } from '../../components/WakingBanner';
import { Wordmark } from '../../components/Wordmark';
import { api } from '../../lib/api';
import { hostSession } from '../../lib/session';
import { useServerWakeup } from '../../lib/useServerWakeup';

/** Envuelve todo /host: sin la clave de anfitrión no se ven ni se tocan las trivias. */
export default function HostGate() {
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>(hostSession.get() ? 'checking' : 'out');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const waking = useServerWakeup();

  useEffect(() => {
    if (status !== 'checking') return;
    api.checkSession().then(
      ({ host }) => {
        if (!host) hostSession.clear();
        setStatus(host ? 'in' : 'out');
      },
      () => setStatus('out'),
    );
  }, [status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.login(password);
      hostSession.set(token);
      setStatus('in');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (status === 'checking') {
    return (
      <div className="mx-auto max-w-sm p-8">
        <WakingBanner waking={waking} />
        <p className="text-stage-soft">Comprobando sesión…</p>
      </div>
    );
  }
  if (status === 'in') return <Outlet />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 pb-[calc(1.5rem+var(--badge-space))]">
      <div className="mb-8 text-center">
        <Wordmark size="lg" />
      </div>
      <WakingBanner waking={waking} />
      <form onSubmit={submit} className="card p-4">
        <label htmlFor="host-password" className="eyebrow">
          Clave de anfitrión
        </label>
        <input
          id="host-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          className="field mt-2 text-lg"
        />
        <button disabled={busy} className="btn btn-dark btn-lg mt-3 w-full">
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        {error && (
          <p role="alert" className="mt-3 font-semibold text-bad">
            {error}
          </p>
        )}
        <p className="mt-4 text-sm text-ink-soft">
          Solo hace falta para preparar las trivias y dirigir el juego. Los participantes no necesitan nada.
        </p>
      </form>
    </main>
  );
}
