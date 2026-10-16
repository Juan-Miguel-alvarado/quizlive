/**
 * Carga la trivia "Día de la Biblia" por la API (así sirve igual en local y en producción).
 * Uso: pnpm --filter server seed:biblia
 *      SERVER_URL=https://quizlivee-server.onrender.com HOST_PASSWORD=… pnpm --filter server seed:biblia
 * Si ya existe una trivia con ese nombre no hace nada (para no duplicarla).
 * Con `-- --actualizar` la reemplaza por la de data/dia-de-la-biblia.ts y conserva la foto de cada pregunta
 * que sigue igual (se empareja por el texto). Ojo: se pierden los cambios hechos a mano en el panel.
 */
import { quizInputSchema, type QuizDetail } from '@quiz/shared';
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

  const existing = (await fetch(`${URL}/api/quizzes`, { headers }).then((r) => r.json())) as { id: string; title: string }[];
  const found = existing.find((q) => q.title === diaDeLaBiblia.title);
  if (found && !process.argv.includes('--actualizar')) {
    console.log(`Ya existe «${diaDeLaBiblia.title}» en ${URL}: no se carga de nuevo (usa --actualizar para reemplazarla).`);
    return;
  }

  let body = diaDeLaBiblia;
  if (found) {
    const old = (await fetch(`${URL}/api/quizzes/${found.id}`, { headers }).then((r) => r.json())) as QuizDetail;
    const photos = new Map(old.series.flatMap((s) => s.questions.map((q) => [q.text, q.imageId] as const)));
    body = {
      ...diaDeLaBiblia,
      series: diaDeLaBiblia.series.map((s) => ({
        ...s,
        questions: s.questions.map((q) => ({ ...q, imageId: photos.get(q.text) ?? null })),
      })),
    };
  }
  const res = await fetch(found ? `${URL}/api/quizzes/${found.id}` : `${URL}/api/quizzes`, {
    method: found ? 'PUT' : 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`El servidor rechazó la trivia: ${await res.text()}`);
  const quiz = (await res.json()) as { series: { title: string; questions: unknown[] }[] };
  console.log(`${found ? 'Actualizada' : 'Cargada'} «${diaDeLaBiblia.title}» en ${URL}:`);
  for (const s of quiz.series) console.log(`  · ${s.title}: ${s.questions.length} preguntas`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
