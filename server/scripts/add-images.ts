/**
 * Pone una foto (de Unsplash) a cada pregunta de "Día de la Biblia", por la API.
 * Uso: pnpm --filter server images:biblia
 *      SERVER_URL=https://quizlivee-server.onrender.com HOST_PASSWORD=… pnpm --filter server images:biblia
 * Las fotos acompañan sin dar pistas: paisajes, luz, objetos. Las preguntas que ya tienen imagen no se tocan.
 */
import { quizInputSchema, type QuizDetail } from '@quiz/shared';
import { diaDeLaBiblia } from './data/dia-de-la-biblia';

const URL = process.env.SERVER_URL ?? 'http://localhost:3001';

// Texto de la pregunta → id de la foto en images.unsplash.com.
const PHOTOS: Record<string, string> = {
  // Expertos en Génesis
  '¿Quién fue el primero del que se dice: «halló gracia»?': 'photo-1514519273132-6a1abd48302c',
  '¿Cuántos años vivió Adán en total?': 'photo-1789656435462-865d7932c4bf',
  '¿Qué señal puso Dios en Caín después de matar a Abel?': 'photo-1529511582893-2d7e684dd128',
  '¿De dónde era Melquisedec?': 'photo-1520629716099-d147346eb224',
  '¿A qué edad recibió Abram el pacto de la circuncisión?': 'photo-1654330352875-1f86a5b011cf',
  '¿Qué nombre recibió Jacob tras luchar con el ángel?': 'photo-1526462407359-b0456df557b3',
  '¿Cómo llamó Jacob al lugar donde vio a Dios cara a cara?': 'photo-1516655543747-2973ac03d580',
  '¿Con cuántas personas entró Jacob en Egipto?': 'photo-1776319967759-2a6484370b94',
  '¿Qué título recibió José bajo Faraón?': 'photo-1600520611035-84157ad4084d',
  // ¿Quién dijo?
  '«¿Soy yo acaso guarda de mi hermano?»': 'photo-1606758297501-92b9786ba83f',
  '«Jehová dio, y Jehová quitó; sea el nombre de Jehová bendito»': 'photo-1500740516770-92bd004b996e',
  '«Nunca he sido hombre de fácil palabra»': 'photo-1663179857170-047f450483d9',
  '«Heme aquí, envíame a mí»': 'photo-1586875401592-64f1d5cb43e4',
  '«¿Qué es el hombre, para que tengas de él memoria?»': 'photo-1514897575457-c4db467cf78e',
  '«Basta ya, oh Jehová, quítame la vida»': 'photo-1617091656678-299f991db87f',
  '«¿Hasta cuándo claudicaréis vosotros entre dos pensamientos?»': 'photo-1789233625350-3b90afb96259',
  '«Es necesario que él crezca, pero que yo mengüe»': 'photo-1617996156260-e9c7e2803f13',
  '«Señor, ¿quieres que mandemos que descienda fuego del cielo?»': 'photo-1559087867-ce4c91325525',
  '«Para mí el vivir es Cristo, y el morir es ganancia»': 'photo-1570460147789-4e2e622bbb25',
  '«He peleado la buena batalla, he acabado la carrera, he guardado la fe»': 'photo-1728532483490-708f6562b738',
  // ¿En qué libro está?
  '«Vanidad de vanidades, todo es vanidad»': 'photo-1557995744-18c7f67f4307',
  '«He aquí que tú eres más sabio que Daniel»': 'photo-1613843351058-1dd06fda7c02',
  '«Por falta de conocimiento mi pueblo fue destruido»': 'photo-1591951425600-d09958978584',
  '«El justo por su fe vivirá»': 'photo-1772048868020-82a5e4554e9d',
  '«Examíname, oh Dios, y conoce mi corazón»': 'photo-1561212856-44e9bae482aa',
  '«El amor es sufrido, es benigno…»': 'photo-1586324304780-c9a5031a3599',
  '«Sin fe es imposible agradar a Dios»': 'photo-1600245892018-3826141b0822',
  '«Sed hacedores de la palabra, y no tan solamente oidores»': 'photo-1642952273588-ed6fa28870ac',
  '«Y conoceréis la verdad, y la verdad os hará libres»': 'photo-1542382156909-9ae37b3f56fd',
  '«He aquí, yo vengo pronto»': 'photo-1529697216570-f48ef8f6b2dd',
  // ¿Antiguo o Nuevo Testamento?
  '«El alma que pecare, esa morirá»': 'photo-1780596071520-c9939c9c20a2',
  '«El obrero es digno de su salario»': 'photo-1635174815612-fd9636f70146',
  '«No con ejército, ni con fuerza, sino con mi Espíritu»': 'photo-1605455021703-13b57dcb9efa',
  '«El que quiera ser el primero será el servidor de todos»': 'photo-1630484179374-4ce10178f939',
  '«Es, pues, la fe la certeza de lo que se espera…»': 'photo-1599600197870-4bfaf17d5f42',
  '«Sed santos, porque yo soy santo»': 'photo-1516037239867-ff3e7ad0d607',
  '«Mi reino no es de este mundo»': 'photo-1690022938365-8dd3b68ae75d',
  '«El justo por la fe vivirá»': 'photo-1536125434175-6c5657605fb0',
  '«Sobre esta roca edificaré mi iglesia»': 'photo-1706842331573-034ffed5d76d',
  '«Las misericordias del Señor son nuevas cada mañana»': 'photo-1470252649378-9c29740c9fa8',
};

// 1100 px en WebP: nítida en la TV y liviana para 100 celulares con datos (~100 KB de media).
const photoUrl = (id: string) => `https://images.unsplash.com/${id}?w=1100&fm=webp&q=55&fit=max`;

async function main() {
  const login = await fetch(`${URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: process.env.HOST_PASSWORD ?? 'anfitrion' }),
  });
  if (!login.ok) throw new Error(`No se pudo entrar como anfitrión (${login.status}). ¿HOST_PASSWORD correcta?`);
  const { token } = (await login.json()) as { token: string };
  const auth = { authorization: `Bearer ${token}` };

  const list = (await fetch(`${URL}/api/quizzes`, { headers: auth }).then((r) => r.json())) as { id: string; title: string }[];
  const found = list.find((q) => q.title === diaDeLaBiblia.title);
  if (!found) throw new Error(`No existe «${diaDeLaBiblia.title}» en ${URL}. Cárgala antes con seed:biblia.`);
  const quiz = (await fetch(`${URL}/api/quizzes/${found.id}`, { headers: auth }).then((r) => r.json())) as QuizDetail;

  let added = 0;
  for (const series of quiz.series) {
    for (const question of series.questions) {
      const photo = PHOTOS[question.text];
      if (question.imageId || !photo) continue;
      const img = await fetch(photoUrl(photo));
      if (!img.ok) throw new Error(`No se pudo bajar la foto ${photo} (${img.status})`);
      const body = Buffer.from(await img.arrayBuffer());
      const up = await fetch(`${URL}/api/images`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'image/webp' },
        body,
      });
      if (!up.ok) throw new Error(`El servidor rechazó la imagen de «${question.text}»: ${await up.text()}`);
      question.imageId = ((await up.json()) as { id: string }).id;
      added++;
      console.log(`  · ${Math.round(body.length / 1024)} KB  ${question.text}`);
    }
  }
  if (added === 0) {
    console.log('Todas las preguntas ya tenían imagen: no hay nada que hacer.');
    return;
  }

  // Se reenvía la trivia completa (sin ids), como hace el editor al guardar.
  const input = quizInputSchema.parse({
    title: quiz.title,
    pointsCorrect: quiz.pointsCorrect,
    speedBonusMax: quiz.speedBonusMax,
    series: quiz.series.map((s) => ({
      title: s.title,
      questions: s.questions.map(({ id: _id, ...q }) => q),
    })),
  });
  const res = await fetch(`${URL}/api/quizzes/${quiz.id}`, {
    method: 'PUT',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`El servidor rechazó la trivia: ${await res.text()}`);
  console.log(`Listo: ${added} imágenes nuevas en «${quiz.title}» (${URL}).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
