/**
 * "Día de la Biblia" (actividad del grupo de intermedios). Preguntas tomadas del documento Word;
 * la respuesta correcta y la cita (RVR1960) las marcó Claude y están para revisión en
 * docs/REVISAR-DIA-DE-LA-BIBLIA.md.
 */
import type { QuizInput } from '@quiz/shared';

type Q = { text: string; options: [string, string, string, string]; correct: number; explanation: string; time?: number };

const q = ({ text, options, correct, explanation, time = 15 }: Q) => ({
  type: 'single' as const,
  text,
  imageId: null,
  options,
  correctIndices: [correct],
  timeLimitSec: time,
  explanation,
});

const AT_NT: [string, string, string, string] = ['Antiguo Testamento', 'Nuevo Testamento', 'Ambos', 'No aparece en la Biblia'];
const AT = 0;
const NT = 1;
const AMBOS = 2;

export const diaDeLaBiblia: QuizInput = {
  title: 'Día de la Biblia',
  pointsCorrect: 100,
  speedBonusMax: 50,
  series: [
    {
      title: 'Expertos en Génesis',
      questions: [
        q({ text: '¿Quién fue el primero del que se dice: «halló gracia»?', options: ['Enoc', 'Abel', 'Noé', 'Abraham'], correct: 2, explanation: 'Génesis 6:8 — «Pero Noé halló gracia ante los ojos de Jehová».' }),
        q({ text: '¿Cuántos años vivió Adán en total?', options: ['900', '912', '930', '969'], correct: 2, explanation: 'Génesis 5:5 — 930 años. (912 vivió Set y 969 Matusalén).' }),
        q({ text: '¿Qué señal puso Dios en Caín después de matar a Abel?', options: ['Una marca para protegerlo', 'Una cicatriz visible', 'Un castigo público', 'Una vestidura especial'], correct: 0, explanation: 'Génesis 4:15 — «Jehová puso señal en Caín, para que no lo matase cualquiera que le hallara».' }),
        q({ text: '¿De dónde era Melquisedec?', options: ['Hebrón', 'Salem', 'Betel', 'Damasco'], correct: 1, explanation: 'Génesis 14:18 — Melquisedec, rey de Salem, sacerdote del Dios Altísimo.' }),
        q({ text: '¿A qué edad recibió Abram el pacto de la circuncisión?', options: ['75', '86', '99', '120'], correct: 2, explanation: 'Génesis 17:1, 24 — tenía 99 años. (A los 75 salió de Harán y a los 86 nació Ismael).' }),
        q({ text: '¿Qué nombre recibió Jacob tras luchar con el ángel?', options: ['Peniel', 'Israel', 'Betel', 'Emanuel'], correct: 1, explanation: 'Génesis 32:28 — «No se dirá más tu nombre Jacob, sino Israel».' }),
        q({ text: '¿Cómo llamó Jacob al lugar donde vio a Dios cara a cara?', options: ['Betel', 'Salem', 'Peniel', 'Siquem'], correct: 2, explanation: 'Génesis 32:30 — «Vi a Dios cara a cara»: lo llamó Peniel. (Betel fue el lugar del sueño de la escalera, Génesis 28:19).' }),
        q({ text: '¿Con cuántas personas entró Jacob en Egipto?', options: ['66', '70', '72', '75'], correct: 1, explanation: 'Génesis 46:27 — setenta personas. (66 sin contar a José y sus hijos, v. 26; Hechos 7:14 dice 75).' }),
        q({ text: '¿Qué título recibió José bajo Faraón?', options: ['Gobernador de Egipto', 'Padre de Faraón', 'Príncipe del Nilo', 'Heredero de Ra'], correct: 0, explanation: 'Génesis 42:6 y 45:8 — «gobernador en toda la tierra de Egipto».' }),
      ],
    },
    {
      title: '¿Quién dijo?',
      questions: [
        q({ time: 20, text: '«¿Soy yo acaso guarda de mi hermano?»', options: ['Esaú', 'Caín', 'Rubén', 'Saúl'], correct: 1, explanation: 'Génesis 4:9 — Caín, cuando Dios le preguntó por Abel.' }),
        q({ time: 20, text: '«Jehová dio, y Jehová quitó; sea el nombre de Jehová bendito»', options: ['David', 'Abraham', 'Job', 'Jeremías'], correct: 2, explanation: 'Job 1:21 — Job, después de perderlo todo.' }),
        q({ time: 20, text: '«Nunca he sido hombre de fácil palabra»', options: ['Jeremías', 'Moisés', 'Gedeón', 'Jonás'], correct: 1, explanation: 'Éxodo 4:10 — Moisés, ante la zarza que ardía.' }),
        q({ time: 20, text: '«Heme aquí, envíame a mí»', options: ['Jeremías', 'Isaías', 'Samuel', 'Ezequiel'], correct: 1, explanation: 'Isaías 6:8 — en la visión del trono de Dios.' }),
        q({ time: 20, text: '«¿Qué es el hombre, para que tengas de él memoria?»', options: ['Salomón', 'David', 'Asaf', 'Moisés'], correct: 1, explanation: 'Salmo 8:4 — salmo de David.' }),
        q({ time: 20, text: '«Basta ya, oh Jehová, quítame la vida»', options: ['Elías', 'Jonás', 'Job', 'Jeremías'], correct: 0, explanation: '1 Reyes 19:4 — Elías, debajo de un enebro.' }),
        q({ time: 20, text: '«¿Hasta cuándo claudicaréis vosotros entre dos pensamientos?»', options: ['Samuel', 'Elías', 'Eliseo', 'Juan el Bautista'], correct: 1, explanation: '1 Reyes 18:21 — Elías, en el monte Carmelo.' }),
        q({ time: 20, text: '«Es necesario que él crezca, pero que yo mengüe»', options: ['Pedro', 'Pablo', 'Juan el Bautista', 'Juan el apóstol'], correct: 2, explanation: 'Juan 3:30 — Juan el Bautista, hablando de Jesús.' }),
        q({ time: 20, text: '«Señor, ¿quieres que mandemos que descienda fuego del cielo?»', options: ['Pedro', 'Juan', 'Andrés', 'Tomás'], correct: 1, explanation: 'Lucas 9:54 — lo dijeron Jacobo (Santiago) y Juan.' }),
        q({ time: 20, text: '«Para mí el vivir es Cristo, y el morir es ganancia»', options: ['Pedro', 'Pablo', 'Lucas', 'Esteban'], correct: 1, explanation: 'Filipenses 1:21 — Pablo.' }),
        q({ time: 20, text: '«He peleado la buena batalla, he acabado la carrera, he guardado la fe»', options: ['Pablo', 'Pedro', 'Timoteo', 'Juan'], correct: 0, explanation: '2 Timoteo 4:7 — Pablo, al final de su vida.' }),
      ],
    },
    {
      title: '¿En qué libro está?',
      questions: [
        q({ time: 20, text: '«Vanidad de vanidades, todo es vanidad»', options: ['Proverbios', 'Eclesiastés', 'Job', 'Cantares'], correct: 1, explanation: 'Eclesiastés 1:2.' }),
        q({ time: 20, text: '«He aquí que tú eres más sabio que Daniel»', options: ['Isaías', 'Jeremías', 'Ezequiel', 'Daniel'], correct: 2, explanation: 'Ezequiel 28:3.' }),
        q({ time: 20, text: '«Por falta de conocimiento mi pueblo fue destruido»', options: ['Oseas', 'Amós', 'Miqueas', 'Jeremías'], correct: 0, explanation: 'Oseas 4:6 — «Mi pueblo fue destruido, porque le faltó conocimiento».' }),
        q({ time: 20, text: '«El justo por su fe vivirá»', options: ['Romanos', 'Gálatas', 'Hebreos', 'Habacuc'], correct: 3, explanation: 'Habacuc 2:4 — «por su fe». Romanos 1:17, Gálatas 3:11 y Hebreos 10:38 lo citan como «por la fe».' }),
        q({ time: 20, text: '«Examíname, oh Dios, y conoce mi corazón»', options: ['Salmos', 'Proverbios', 'Job', 'Lamentaciones'], correct: 0, explanation: 'Salmo 139:23.' }),
        q({ time: 20, text: '«El amor es sufrido, es benigno…»', options: ['Efesios', '1 Corintios', 'Romanos', 'Colosenses'], correct: 1, explanation: '1 Corintios 13:4.' }),
        q({ time: 20, text: '«Sin fe es imposible agradar a Dios»', options: ['Santiago', 'Hebreos', 'Romanos', 'Judas'], correct: 1, explanation: 'Hebreos 11:6.' }),
        q({ time: 20, text: '«Sed hacedores de la palabra, y no tan solamente oidores»', options: ['2 Pedro', 'Santiago', 'Juan', 'Hebreos'], correct: 1, explanation: 'Santiago 1:22.' }),
        q({ time: 20, text: '«Y conoceréis la verdad, y la verdad os hará libres»', options: ['Mateo', 'Lucas', 'Juan', 'Hechos'], correct: 2, explanation: 'Juan 8:32.' }),
        q({ time: 20, text: '«He aquí, yo vengo pronto»', options: ['1 Tesalonicenses', '2 Pedro', 'Judas', 'Apocalipsis'], correct: 3, explanation: 'Apocalipsis 22:7.' }),
      ],
    },
    {
      title: '¿Antiguo o Nuevo Testamento?',
      questions: [
        q({ text: '«El alma que pecare, esa morirá»', options: AT_NT, correct: AT, explanation: 'Ezequiel 18:4.' }),
        q({ text: '«El obrero es digno de su salario»', options: AT_NT, correct: NT, explanation: 'Lucas 10:7 y 1 Timoteo 5:18.' }),
        q({ text: '«No con ejército, ni con fuerza, sino con mi Espíritu»', options: AT_NT, correct: AT, explanation: 'Zacarías 4:6.' }),
        q({ text: '«El que quiera ser el primero será el servidor de todos»', options: AT_NT, correct: NT, explanation: 'Marcos 9:35.' }),
        q({ text: '«Es, pues, la fe la certeza de lo que se espera…»', options: AT_NT, correct: NT, explanation: 'Hebreos 11:1.' }),
        q({ text: '«Sed santos, porque yo soy santo»', options: AT_NT, correct: AMBOS, explanation: 'Levítico 11:44 y 1 Pedro 1:16.' }),
        q({ text: '«Mi reino no es de este mundo»', options: AT_NT, correct: NT, explanation: 'Juan 18:36 — Jesús ante Pilato.' }),
        q({ text: '«El justo por la fe vivirá»', options: AT_NT, correct: AMBOS, explanation: 'Habacuc 2:4 y Romanos 1:17.' }),
        q({ text: '«Sobre esta roca edificaré mi iglesia»', options: AT_NT, correct: NT, explanation: 'Mateo 16:18.' }),
        q({ text: '«Las misericordias del Señor son nuevas cada mañana»', options: AT_NT, correct: AT, explanation: 'Lamentaciones 3:22-23.' }),
      ],
    },
  ],
};
