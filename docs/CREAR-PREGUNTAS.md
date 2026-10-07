# Crear preguntas para todas las edades

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
- **Entre 10 y 15 preguntas** dan unos 15–20 minutos de juego.

### Tiempos recomendados

| Pregunta | Tiempo |
|---|---|
| Verdadero o falso | 15 s |
| Opción única, corta | 20 s |
| Con imagen o con opciones largas | 30 s |
| Selección múltiple | 30–60 s |

Con niños pequeños o adultos mayores, sube un escalón: es mejor que sobre tiempo a que falte.

## Importar desde CSV (Excel / Google Sheets)

En el editor del quiz, "Importar CSV". Una fila por pregunta:

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
| `segundos` | De 5 a 120. Si se deja vacío, 20. |
| `explicacion` | **Opcional.** Dato o versículo que se muestra al revelar. Necesita las 8 columnas anteriores (aunque vayan vacías). |

- Se acepta coma o punto y coma como separador (Excel en español suele usar `;`).
- Los archivos viejos de 8 columnas (sin `explicacion`) siguen funcionando.
- Si una fila tiene un error, el editor dice cuál y qué falta. Las demás se importan igual.
