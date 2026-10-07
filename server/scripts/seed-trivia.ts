/**
 * Carga la trivia "Día de la Biblia" por la API (así sirve igual en local y en producción).
 * Uso: pnpm --filter server seed:biblia
 *      SERVER_URL=https://quizlivee-server.onrender.com HOST_PASSWORD=… pnpm --filter server seed:biblia
 * Si ya existe una trivia con ese nombre no hace nada (para no duplicarla).
 */
import { quizInputSchema } from '@quiz/shared';
import { diaDeLaBiblia } from './data/dia-de-la-biblia';

const URL = process.env.SERVER_URL ?? 'http://localhost:3001';

async function main() {
  // Antes de enviar nada: que pase la misma validación que el panel.
  quizInputSchema.parse(diaDeLaBiblia);

  const login = await fetch(`${URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: process.env.HOST_PASSWORD ?? 'anfitrion' }),
  });
  if (!login.ok) throw new Error(`No se pudo entrar como anfitrión (${login.status}). ¿HOST_PASSWORD correcta?`);
  const { token } = (await login.json()) as { token: string };
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` };

  const existing = (await fetch(`${URL}/api/quizzes`, { headers }).then((r) => r.json())) as { title: string }[];
  if (existing.some((q) => q.title === diaDeLaBiblia.title)) {
    console.log(`Ya existe «${diaDeLaBiblia.title}» en ${URL}: no se carga de nuevo.`);
    return;
  }
  const res = await fetch(`${URL}/api/quizzes`, { method: 'POST', headers, body: JSON.stringify(diaDeLaBiblia) });
  if (!res.ok) throw new Error(`El servidor rechazó la trivia: ${await res.text()}`);
  const quiz = (await res.json()) as { series: { title: string; questions: unknown[] }[] };
  console.log(`Cargada «${diaDeLaBiblia.title}» en ${URL}:`);
  for (const s of quiz.series) console.log(`  · ${s.title}: ${s.questions.length} preguntas`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
