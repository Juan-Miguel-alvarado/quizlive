import { CSV_TEMPLATE, parseQuizCsv } from '@quiz/shared';
import { describe, expect, it } from 'vitest';

describe('importar CSV', () => {
  it('lee los tres tipos de pregunta con cabecera', () => {
    const { questions, errors } = parseQuizCsv(
      'tipo,pregunta,opcion1,opcion2,opcion3,opcion4,correctas,segundos\n' +
        'unica,¿Capital?,París,Roma,,,1,20\n' +
        'multiple,¿Lenguajes?,TypeScript,HTML,Rust,CSS,1;3,30\n' +
        'vf,Es relacional,,,,,v,10\n',
    );
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(3);
    expect(questions[0]).toMatchObject({ type: 'single', options: ['París', 'Roma'], correctIndices: [0], timeLimitSec: 20 });
    expect(questions[1]).toMatchObject({ type: 'multiple', correctIndices: [0, 2] });
    expect(questions[2]).toMatchObject({ type: 'truefalse', options: ['Verdadero', 'Falso'], correctIndices: [0] });
  });

  it('respeta las comas dentro de comillas y acepta punto y coma como separador', () => {
    const { questions } = parseQuizCsv('unica,"Hola, mundo",a,b,,,1,20\n');
    expect(questions[0]!.text).toBe('Hola, mundo');
    const conPuntoYComa = parseQuizCsv('unica;¿Dos?;a;b;;;2;15\n');
    expect(conPuntoYComa.questions[0]).toMatchObject({ correctIndices: [1], timeLimitSec: 15 });
  });

  it('avisa fila por fila de lo que está mal', () => {
    const { questions, errors } = parseQuizCsv('unica,Buena,a,b,,,1,20\nunica,Sin correcta,a,b,,,9,20\nunica,,a,b,,,1,20\n');
    expect(questions).toHaveLength(1);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/Fila 2/);
  });

  it('acota el tiempo a los valores permitidos', () => {
    const { questions } = parseQuizCsv('unica,Larga,a,b,,,1,9999\n');
    expect(questions[0]!.timeLimitSec).toBe(120);
  });

  it('lee la explicación opcional de la 9.ª columna (con comas sin comillas)', () => {
    const { questions, errors } = parseQuizCsv(
      'tipo,pregunta,opcion1,opcion2,opcion3,opcion4,correctas,segundos,explicacion\n' +
        'unica,¿Quién construyó el arca?,Noé,Moisés,,,1,20,Génesis 6, 14\n' +
        'vf,Sin explicación,,,,,f,10,\n' +
        'unica,Formato viejo,a,b,,,2,15\n',
    );
    expect(errors).toEqual([]);
    expect(questions[0]).toMatchObject({ correctIndices: [0], timeLimitSec: 20, explanation: 'Génesis 6, 14' });
    expect(questions[1]).toMatchObject({ correctIndices: [1], timeLimitSec: 10, explanation: null });
    expect(questions[2]).toMatchObject({ correctIndices: [1], timeLimitSec: 15, explanation: null });
  });

  it('la plantilla de ejemplo se importa sin errores', () => {
    const { questions, errors } = parseQuizCsv(CSV_TEMPLATE);
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(3);
    expect(questions.every((q) => q.explanation)).toBe(true);
  });
});
