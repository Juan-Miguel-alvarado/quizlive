import { useEffect, useState } from 'react';
import { api } from './api';

const SLOW_MS = 3000;
const RETRY_MS = 4000;

/**
 * El plan gratis de Render duerme el servidor tras ~15 min sin uso y tarda cerca de un minuto en
 * despertar. Al abrir la página se le da un toque a /api/health; si tarda, `waking` avisa en pantalla
 * y se reintenta hasta que conteste.
 */
export function useServerWakeup() {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    let done = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const slow = setTimeout(() => !done && setWaking(true), SLOW_MS);

    const ping = () =>
      api.health().then(
        () => {
          done = true;
          clearTimeout(slow);
          setWaking(false);
        },
        () => {
          if (done) return;
          setWaking(true);
          retry = setTimeout(ping, RETRY_MS);
        },
      );
    void ping();

    return () => {
      done = true;
      clearTimeout(slow);
      clearTimeout(retry);
    };
  }, []);

  return waking;
}
