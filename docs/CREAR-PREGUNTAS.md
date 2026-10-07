# Crear preguntas para todas las edades

## Cómo se organiza una trivia

- **Trivia:** el juego completo (por ejemplo «Día de la Biblia»). Queda guardada para editarla o volver a
  jugarla. Se puede **renombrar**, **duplicar** (para usarla de base) o **borrar** desde «Tus trivias».
- **Series:** grupos de preguntas dentro de la trivia (por ejemplo «¿Quién dijo?»). Al terminar cada serie,
  todos ven el **top 5**; al terminar la última, el **ganador**. Se ordenan con las flechas. Una serie
  vacía se salta al jugar, así que se puede dejar preparada.
- **Preguntas:** texto, 4 opciones (A, B, C, D) con la correcta marcada, imagen opcional, tiempo (**15 s por
  defecto**) y explicación o versículo opcional.
- **Puntaje** (arriba del editor): **100 puntos** por acertar más un **bono de hasta 50** por rapidez,
  completo al instante y casi nada en el último segundo. Fallar o no responder da 0. Los dos valores se
  pueden cambiar.

## Pegado rápido (desde el Word)

En vez de llenar campo por campo:

- **Una pregunta:** en la tarjeta de la pregunta, el botón del portapapeles (**«Pegado rápido»**). Pega:
  - la **pregunta y sus 4 respuestas**, una por línea: la primera línea es la pregunta; o
  - **solo las 4 respuestas**: se reparten en A, B, C y D.
- **Varias preguntas:** al final de cada serie, **«Pegar varias preguntas»**. Copia del Word la serie
  entera: cada pregunta seguida de sus 4 respuestas. Los títulos sueltos («Serie de preguntas: …») se ignoran.

Se reconoce solo:
- Los prefijos `a)`, `A.`, `a-`, `(a)`, `1.`, `1)` y las viñetas, que se quitan.
- Un **asterisco** junto a una respuesta (`c) Moisés*`), que la marca como **correcta**. Sin asterisco,
  después hay que marcarla a mano.
- Las preguntas numeradas («3. ¿Qué señal…?») o que terminan en `?` o en comillas («“Mi reino no es de
  este mundo”»).

Antes de agregar se ve una **vista previa**. Si una pregunta no tiene exactamente 4 respuestas, avisa
(«Encontré 3 opciones, revisa») y no deja agregarla hasta corregirla en el texto pegado.

## Consejos

- **Preguntas cortas.** Deben poder leerse en voz alta en menos de 10 segundos. Si hace falta contexto,
  ponlo en la *explicación* (sale después).
- **Opciones de pocas palabras.** En el celular se ven grandes, pero 4 frases largas no caben bien.
- **Mezcla tipos:**
  - *Verdadero o falso* es ideal para niños pequeños y para abrir el juego.
  - *Opción única* es la más común.
  - *Selección múltiple* es la más difícil. Úsala poco: solo puntúa si se marcan **todas** las
    correctas.
- **Una imagen ayuda** a quien todavía no lee (por ejemplo, "¿Qué animal es este?"). Se ve en el
  proyector y en el celular.
- **Explicación o versículo:** escribe la cita ("Génesis 6:14") y, si quieres, una frase. Aparece al
  revelar la respuesta, en el proyector y en los celulares.
- **Entre 10 y 15 preguntas por serie**, y 3 o 4 series, dan unos 30–40 minutos de juego.

### Tiempos recomendados

| Pregunta | Tiempo |
|---|---|
| Verdadero o falso | 15 s |
| Opción única, corta | 15 s (lo que viene por defecto) |
| Citas largas («¿Quién dijo?», «¿En qué libro está?») | 20 s |
| Con imagen o con opciones largas | 30 s |
| Selección múltiple | 30–60 s |

Con niños pequeños o adultos mayores, sube un escalón: es mejor que sobre tiempo a que falte.

## Importar desde CSV (Excel / Google Sheets)

En el editor, al final de cada serie, "Importar CSV": las preguntas se agregan a esa serie. Una fila por pregunta:

```csv
tipo,pregunta,opcion1,opcion2,opcion3,opcion4,correctas,segundos,explicacion
unica,¿Quién construyó el arca?,Noé,Moisés,David,Pedro,1,20,Génesis 6:14
multiple,¿Cuáles son evangelios?,Mateo,Hechos,Juan,Salmos,1;3,30,Mateo · Marcos · Lucas · Juan
vf,Jonás estuvo tres días dentro del gran pez,,,,,v,15,Jonás 1:17
```

| Columna | Valores |
|---|---|
| `tipo` | `unica`, `multiple` o `vf` (verdadero/falso). |
| `pregunta` | El texto (máximo 300 caracteres). Si lleva comas, ponlo "entre comillas". |
| `opcion1`…`opcion4` | De 2 a 4 opciones. En `vf` se dejan vacías. |
| `correctas` | El número de la opción correcta (desde 1). En `multiple`, varias separadas por `;`. En `vf`, `v` o `f`. |
| `segundos` | De 5 a 120. Si se deja vacío, 15. |
| `explicacion` | **Opcional.** Dato o versículo que se muestra al revelar. Necesita las 8 columnas anteriores (aunque vayan vacías). |

- Se acepta coma o punto y coma como separador (Excel en español suele usar `;`).
- Los archivos viejos de 8 columnas (sin `explicacion`) siguen funcionando.
- Si una fila tiene un error, el editor dice cuál y qué falta. Las demás se importan igual.
