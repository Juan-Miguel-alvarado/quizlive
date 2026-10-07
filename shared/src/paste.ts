/**
 * "Pegado rápido": convierte texto copiado de un Word en preguntas de 4 opciones (A, B, C, D).
 *
 * - Una pregunta: 5 líneas (pregunta + 4 opciones) o solo las 4 opciones.
 * - Varias preguntas: bloques de pregunta + 4 opciones, uno tras otro.
 * - Quita prefijos comunes: "a)", "A.", "a-", "(a)", "1.", "1)", viñetas.
 * - Un asterisco ("c) Moisés*") marca la opción correcta.
 */

export const PASTE_OPTIONS = 4;

export interface PastedQuestion {
  text: string | null; // null si solo se pegaron las opciones
  options: string[];
  correctIndex: number | null; // null si ninguna opción venía con asterisco
  problem: string | null; // si no es null, no se puede usar todavía
}

// "a)", "A.", "a-", "(a)", "a:" … y también "1.", "1)", "1-", viñetas.
const OPTION_PREFIX = /^\s*(?:\(?[a-dA-D][).:\-–]|\(?[1-4][).\-–]|[•·▪◦*\-–])\s*/;
const QUESTION_NUMBER = /^\s*\d{1,3}\s*[.)\-–,]\s*/;

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.replace(/ /g, ' ').trim())
    .filter(Boolean);

function cleanOption(raw: string): { text: string; starred: boolean } {
  let text = raw.trim();
  let starred = false;
  // El asterisco puede ir al principio ("*c) Moisés") o al final ("c) Moisés*").
  if (/^\*/.test(text) && !/^\*\s*$/.test(text)) {
    starred = true;
    text = text.slice(1).trim();
  }
  text = text.replace(OPTION_PREFIX, '').trim();
  if (/\*$/.test(text)) {
    starred = true;
    text = text.replace(/\s*\*+$/, '').trim();
  }
  return { text, starred };
}

const cleanQuestion = (raw: string) => raw.replace(QUESTION_NUMBER, '').trim();

function buildQuestion(question: string | null, optionLines: string[]): PastedQuestion {
  const cleaned = optionLines.map(cleanOption);
  const starred = cleaned.flatMap((o, i) => (o.starred ? [i] : []));
  let problem: string | null = null;
  if (cleaned.length !== PASTE_OPTIONS) {
    problem = `Encontré ${cleaned.length} ${cleaned.length === 1 ? 'opción' : 'opciones'}, revisa (deben ser ${PASTE_OPTIONS})`;
  } else if (cleaned.some((o) => !o.text)) {
    problem = 'Hay una opción vacía, revisa';
  } else if (starred.length > 1) {
    problem = 'Hay más de una opción marcada con *, deja solo la correcta';
  }
  return {
    text: question,
    options: cleaned.map((o) => o.text),
    correctIndex: starred.length === 1 ? starred[0]! : null,
    problem,
  };
}

/** Una línea que empieza pregunta: numerada ("3.") o terminada en "?" o en comillas de cierre. */
const looksLikeQuestion = (line: string) => QUESTION_NUMBER.test(line) || /[?”"»]\s*$/.test(line);

/** Una sola pregunta: 5 líneas (pregunta + 4 opciones) o solo las 4 opciones. */
export function parsePastedQuestion(text: string): PastedQuestion {
  const all = lines(text);
  if (all.length === 0) return { text: null, options: [], correctIndex: null, problem: 'Pega la pregunta y sus 4 opciones' };
  // 4 líneas son solo las opciones, salvo que la primera tenga cara de pregunta (entonces falta una).
  // Si todas van numeradas ("1. Noé", "2. Moisés"…) son opciones, no una pregunta numerada.
  const [first, second = ''] = all;
  const firstIsQuestion =
    /[?”"»]\s*$/.test(first!) || (QUESTION_NUMBER.test(first!) && !QUESTION_NUMBER.test(second));
  if (all.length === PASTE_OPTIONS && !firstIsQuestion) return buildQuestion(null, all);
  return buildQuestion(cleanQuestion(all[0]!), all.slice(1));
}

/**
 * Varias preguntas seguidas (por ejemplo, una serie entera copiada del Word). Los títulos sueltos
 * que no sean pregunta ni opción (como "Serie de preguntas: …") se ignoran si van antes de la primera.
 */
export function parsePastedQuestions(text: string): PastedQuestion[] {
  const all = lines(text);
  const result: PastedQuestion[] = [];
  let i = 0;
  // Saltar encabezados hasta la primera línea con cara de pregunta.
  while (i < all.length && !looksLikeQuestion(all[i]!)) i++;
  while (i < all.length) {
    // Dos líneas seguidas con cara de pregunta: la primera es un título ("Dinámica: ¿Quién dijo?").
    while (i + 1 < all.length && looksLikeQuestion(all[i + 1]!)) i++;
    const question = cleanQuestion(all[i]!);
    const options: string[] = [];
    i++;
    // Las opciones siguen hasta la próxima pregunta. Con 4 ya completas, la siguiente línea
    // es pregunta aunque no lleve número ni signo (pasa en el Word: "¿Soy yo acaso…" sin "1.").
    while (i < all.length && options.length < PASTE_OPTIONS && !(options.length > 0 && looksLikeQuestion(all[i]!))) {
      options.push(all[i]!);
      i++;
    }
    result.push(buildQuestion(question, options));
  }
  return result;
}
