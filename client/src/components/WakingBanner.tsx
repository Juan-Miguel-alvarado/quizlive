import { HourglassSplit } from 'react-bootstrap-icons';

/** Aviso mientras el servidor despierta (ver useServerWakeup). */
export function WakingBanner({ waking }: { waking: boolean }) {
  if (!waking) return null;
  return (
    <p role="status" className="mb-4 rounded-xl bg-opt-yellow px-3 py-2 text-center font-bold text-ink shadow-3d-sm">
      <HourglassSplit className="mr-2 inline size-4 animate-pulse" />
      Despertando el servidor… puede tardar hasta un minuto. No cierres la página.
    </p>
  );
}
