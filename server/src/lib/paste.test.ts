import { parsePastedQuestion, parsePastedQuestions } from '@quiz/shared';
import { describe, expect, it } from 'vitest';

describe('pegado rápido de una pregunta', () => {
  it('reparte 4 respuestas sueltas en A, B, C y D', () => {
    const q = parsePastedQuestion('Noé\nMoisés\nDavid\nPedro');
    expect(q).toMatchObject({ text: null, options: ['Noé', 'Moisés', 'David', 'Pedro'], problem: null });
  });

  it('con la pregunta delante: la primera línea es la pregunta (sin su número)', () => {
    const q = parsePastedQuestion('3. ¿Quién construyó el arca?\nNoé\nMoisés\nDavid\nPedro\n');
    expect(q.text).toBe('¿Quién construyó el arca?');
    expect(q.options).toEqual(['Noé', 'Moisés', 'David', 'Pedro']);
  });

  it.each([
    ['a) Noé\nb) Moisés\nc) David\nd) Pedro'],
    ['A. Noé\nB. Moisés\nC. David\nD. Pedro'],
    ['a- Noé\nb- Moisés\nc- David\nd- Pedro'],
    ['(a) Noé\n(b) Moisés\n(c) David\n(d) Pedro'],
    ['1. Noé\n2. Moisés\n3. David\n4. Pedro'],
    ['• Noé\n• Moisés\n• David\n• Pedro'],
  ])('quita los prefijos del Word: %j', (text) => {
    expect(parsePastedQuestion(text).options).toEqual(['Noé', 'Moisés', 'David', 'Pedro']);
  });

  it('el asterisco marca la correcta (al final o al principio) y se quita', () => {
    expect(parsePastedQuestion('a) Noé\nb) Moisés*\nc) David\nd) Pedro')).toMatchObject({
      correctIndex: 1,
      options: ['Noé', 'Moisés', 'David', 'Pedro'],
    });
    expect(parsePastedQuestion('a) Noé\nb) Moisés\n*c) David\nd) Pedro').correctIndex).toBe(2);
    expect(parsePastedQuestion('Noé\nMoisés\nDavid\nPedro').correctIndex).toBeNull();
  });

  it('avisa si no hay exactamente 4 opciones o si hay dos marcadas', () => {
    expect(parsePastedQuestion('¿Pregunta?\nNoé\nMoisés\nDavid').problem).toMatch(/Encontré 3 opciones/);
    expect(parsePastedQuestion('¿Pregunta?\na\nb\nc\nd\ne').problem).toMatch(/Encontré 5 opciones/);
    expect(parsePastedQuestion('a*\nb*\nc\nd').problem).toMatch(/más de una/);
    expect(parsePastedQuestion('').problem).toBeTruthy();
  });
});

describe('pegado de varias preguntas (una serie del Word)', () => {
  it('separa la serie de Génesis tal como viene del documento', () => {
    const word = `serie de preguntas: Expertos en Génesis
¿Quién fue el primero del que se dice: “halló Gracia”?
Enoc 
 Abel 
 Noé 
 Abraham 
¿Cuánto años vivió Adán en total?
900
912
930
969
3. ¿Qué señal puso Dios en Caín después de matar a Abel?
una marca para protegerlo
una cicatriz visible
un castigo público
una vestidura especial`;
    const qs = parsePastedQuestions(word);
    expect(qs).toHaveLength(3);
    expect(qs.every((q) => q.problem === null)).toBe(true);
    expect(qs[0]).toMatchObject({ text: '¿Quién fue el primero del que se dice: “halló Gracia”?', options: ['Enoc', 'Abel', 'Noé', 'Abraham'] });
    expect(qs[1]!.options).toEqual(['900', '912', '930', '969']);
    expect(qs[2]!.text).toBe('¿Qué señal puso Dios en Caín después de matar a Abel?');
  });

  it('ignora el título "Dinámica: ¿Quién dijo?" y acepta citas entre comillas sin signo de pregunta', () => {
    const word = `Serie de preguntas. Dinámica: ¿Quién dijo?
¿Soy yo acaso guarda de mi hermano?
Esaú
Caín
Rubén
Saúl
2. “Jehová dio, y Jehová quitó; sea el nombre de Jehová bendito”
David
Abraham
Job
Jeremias
4, “El que quiera ser el primero será el servidor de todos”
At
NT
Ambos
No aparece`;
    const qs = parsePastedQuestions(word);
    expect(qs.map((q) => q.text)).toEqual([
      '¿Soy yo acaso guarda de mi hermano?',
      '“Jehová dio, y Jehová quitó; sea el nombre de Jehová bendito”',
      '“El que quiera ser el primero será el servidor de todos”',
    ]);
    expect(qs[2]!.options).toEqual(['At', 'NT', 'Ambos', 'No aparece']);
  });

  it('marca el problema en la pregunta a la que le falta una opción', () => {
    const qs = parsePastedQuestions('1. ¿Uno?\na\nb\nc\nd\n2. ¿Dos?\na\nb\nc');
    expect(qs[0]!.problem).toBeNull();
    expect(qs[1]!.problem).toMatch(/Encontré 3/);
  });
});
