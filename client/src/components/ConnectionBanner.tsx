import { WifiOff } from 'react-bootstrap-icons';

export function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-black/85 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-center text-sm font-bold text-white"
    >
      <WifiOff className="mr-2 inline size-4 animate-pulse text-accent" />
      Sin conexión, reconectando…
    </div>
  );
}
