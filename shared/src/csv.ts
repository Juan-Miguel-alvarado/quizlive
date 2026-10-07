import { DEFAULT_TIME_LIMIT, MAX_OPTIONS, TRUE_FALSE_OPTIONS } from './schemas';
import type { QuestionInput, QuestionType } from './schemas';

export const CSV_TEMPLATE =
  'tipo,pregunta,opcion1,opcion2,opcion3,opcion4,correctas,segundos,explicacion\n' +
  'unica,¿Quién construyó el arca?,Noé,Moisés,David,Pedro,1,20,Génesis 6:14\n' +
  'multiple,¿Cuáles son evangelios?,Mateo,Hechos,Juan,Salmos,1;3,30,Mateo · Marcos · Lucas · Juan\n' +
  'vf,Jonás estuvo tres días dentro del gran pez,,,,,v,15,Jonás 1:17\n';

const TYPES: Record<string, QuestionType> = {
  unica: 'single',
  única: 'single',
  single: 'single',
  multiple: 'multiple',
  múltiple: 'multiple',
  vf: 'truefalse',
  truefalse: 'truefalse',
  'verdadero/falso': 'truefalse',
};

/** Divide una línea respetando las comillas: "Hola, mundo" es un solo campo. */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      out.push(field);
      field = '';
    } else field += c;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

export interface CsvResult {
  questions: QuestionInput[];
  errors: string[];
}

export function parseQuizCsv(text: string): CsvResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { questions: [], errors: ['El archivo está vacío'] };

  // Separador: coma o punto y coma, el que más aparezca en la primera línea.
  const sep = (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ';' : ',';
  const first = splitLine(lines[0]!, sep);
  const rows = /tipo|pregunta/i.test(first.join(' ')) ? lines.slice(1) : lines;

  const questions: QuestionInput[] = [];
  const errors: string[] = [];

  rows.forEach((line, i) => {
    const fila = i + 1;
    const cells = splitLine(line, sep);
    if (cells.length < 4) return errors.push(`Fila ${fila}: faltan columnas`);

    const type = TYPES[(cells[0] ?? '').toLowerCase()] ?? 'single';
    const text = cells[1] ?? '';
    if (!text) return errors.push(`Fila ${fila}: la pregunta está vacía`);

    // Con 9 columnas la última es la explicación (opcional); sin ella, las dos últimas son
    // correctas y segundos, como en el formato original.
    const hasExplanation = cells.length >= 9;
    const tail = hasExplanation ? cells.slice(6, 8) : cells.slice(-2);
    const rawCorrect = (tail[0] ?? '').toLowerCase();
    const timeLimitSec = Number(tail[1]) || DEFAULT_TIME_LIMIT;
    const explanation = hasExplanation ? cells.slice(8).join(`${sep} `).trim().slice(0, 300) || null : null;
    const options =
      type === 'truefalse' ? [...TRUE_FALSE_OPTIONS] : cells.slice(2, 2 + MAX_OPTIONS).filter(Boolean);

    if (type !== 'truefalse' && options.length < 2) return errors.push(`Fila ${fila}: hacen falta 2 opciones o más`);

    let correctIndices: number[];
    if (type === 'truefalse') {
      correctIndices = [/^(v|verdadero|true|1)$/.test(rawCorrect) ? 0 : 1];
    } else {
      correctIndices = rawCorrect
        .split(/[;| ]+/)
        .map((n) => Number(n) - 1) // en el archivo se numeran desde 1
        .filter((n) => Number.isInteger(n) && n >= 0 && n < options.length);
      if (correctIndices.length === 0) return errors.push(`Fila ${fila}: no se entiende cuál es la respuesta correcta`);
      if (type === 'single') correctIndices = [correctIndices[0]!];
    }

    questions.push({
      type,
      text,
      imageId: null,
      options,
      correctIndices,
      timeLimitSec: Math.min(120, Math.max(5, timeLimitSec)),
      explanation,
    });
  });

  if (questions.length === 0 && errors.length === 0) errors.push('No se encontró ninguna pregunta');
  return { questions, errors };
}
