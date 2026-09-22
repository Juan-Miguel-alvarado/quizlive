import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { Wordmark } from '../../components/Wordmark';
import { api } from '../../lib/api';
import { hostSession } from '../../lib/session';

/** Envuelve todo /host: sin la clave de anfitrión no se ven ni se tocan los quizzes. */
export default function HostGate() {
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>(hostSession.get() ? 'checking' : 'out');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  if (status === 'checking') return <p className="p-8 text-ink-soft">Comprobando sesión…</p>;
  if (status === 'in') return <Outlet />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 pb-[calc(1.5rem+var(--badge-space))]">
      <div className="mb-8">
        <Wordmark size="lg" />
      </div>
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
        <button disabled={busy} className="btn btn-primary btn-lg mt-3 w-full">
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        {error && (
          <p role="alert" className="mt-3 font-semibold text-bad">
            {error}
          </p>
        )}
        <p className="mt-4 text-sm text-ink-soft">
          Solo hace falta para crear quizzes y dirigir partidas. Para jugar, tus compañeros no necesitan nada.
        </p>
      </form>
    </main>
  );
}
