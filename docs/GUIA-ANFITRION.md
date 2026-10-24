# Guía del moderador: el día de la trivia

Pasos para dirigir una trivia (por ejemplo, el **Día de la Biblia**) con 15 a 100 personas, sin sustos.

Se usan **tres pantallas**:

| Quién | Qué abre | Dónde |
|---|---|---|
| **Pantalla TV** | El computador conectado al televisor | `quizlivee.vercel.app/tv/PIN` (lo abre el botón «Abrir pantalla TV») |
| **Moderador** | Tu celular (o una laptop) | `quizlivee.vercel.app/host`, con la clave de anfitrión |
| **Participantes** | Su celular | `quizlivee.vercel.app` y el PIN, o el link que compartes por WhatsApp |

> Si solo tienes una computadora: abre el panel del moderador en una ventana y la TV en otra, arrastrada
> al televisor (pantalla extendida).

## Antes del evento (Lina / quien prepara las preguntas)

- [ ] Entra en `/host` → **Tus trivias**. Crea una con **«Nueva trivia»**, o duplica una que ya exista
      (**«Duplicar»**) para usarla de base.
- [ ] Dentro de la trivia, crea las **series** (por ejemplo «Expertos en Génesis», «¿Quién dijo?») y ordénalas.
- [ ] Agrega las preguntas. Lo más rápido es **«Pegar varias preguntas»**: copias del Word una serie entera
      (cada pregunta con sus 4 respuestas) y revisas la vista previa. Detalles en
      [Crear preguntas](CREAR-PREGUNTAS.md).
- [ ] Revisa que cada pregunta tenga **marcada la correcta** (el panel no deja guardar si falta).
- [ ] Opcional: una **explicación o versículo** en cada pregunta. Aparece al revelar la respuesta.
- [ ] Para el Día de la Biblia: revisa [las respuestas marcadas](REVISAR-DIA-DE-LA-BIBLIA.md), sobre todo
      las 6 con ⚠️.
- [ ] Todo queda guardado en línea: puedes cerrar la página y seguir otro día.

## Una semana antes (prueba)

- [ ] **Ensayo con bots** (si tienes el proyecto en tu computadora): abre la sala y ejecuta
      `pnpm bots <PIN> 15`. Verás 15 jugadores, reacciones y respuestas, y puedes recorrer todas las series.
- [ ] **Prueba de carga contra el servidor real** (opcional):
      ```bash
      SERVER_URL=https://quizlivee-server.onrender.com pnpm --filter server test:load 120 --finish
      ```
- [ ] Haz una copia de seguridad de la base (trivias, fotos e historial):
      `pnpm --filter server db:respaldar "URL de Neon"`.
- [ ] Imprime o comparte la hoja [Cómo jugar](COMO-JUGAR.md) si crees que ayudará a los mayores.

## El mismo día, 15 minutos antes

1. **Despierta el servidor:** abre `quizlivee.vercel.app/host` en tu celular. Si aparece «Despertando el
   servidor…», espera (hasta un minuto).
2. **Abre la sala:** en «Tus trivias», pulsa **«Abrir sala»** en la trivia del día.
3. **Abre la pantalla TV** en el computador del televisor. Desde tu panel, pulsa **«Abrir pantalla TV»** si
   estás en ese computador, o copia el link con el botón del portapapeles y ábrelo allí.
   - **Pantalla completa:** doble clic o tecla **F**.
   - **Sonido:** haz **un clic** en la TV. El navegador no deja sonar nada hasta entonces. La música suena
     en el lobby y durante cada pregunta. Los botones de música y efectos
     solo se ven en el lobby.
4. **Comparte el link** con **«Compartir link»** (abre WhatsApp u otra app). También pueden escanear el
   QR de la TV.

## Mientras la gente entra

- Di en voz alta: **«Abran la cámara y escaneen el código»**, o **«entren en quizlivee.vercel.app y
  escriban el número de la pantalla»**.
- Cada persona elige un **dibujo** y su **nombre** (o toca el dado). Si dos eligen el mismo nombre, el
  segundo queda como «Ana 2»: nadie se queda fuera.
- En la TV y en tu panel ves cuántos entraron y sus nombres. **Para sacar a alguien**, tócalo en tu panel.
- Pulsa **«Iniciar»** cuando estén todos. Quien llegue tarde puede entrar igual y empieza con 0.

## Durante el juego

Tu panel tiene **un botón grande** que cambia según el momento:

| En pantalla | Tu botón | Qué pasa |
|---|---|---|
| «Serie 1 de 4: Expertos en Génesis» / «¡Prepárate!» | **Mostrar ya** | Salta la cuenta de 5 segundos. |
| La pregunta, con el tiempo | **Cerrar pregunta ya** (pequeño) | Se cierra sola al acabarse el tiempo o cuando respondieron todos. |
| La respuesta correcta en verde | **Siguiente pregunta** | Pasa a la siguiente de la misma serie. |
| La última respuesta de la serie | **Ver tabla** | La TV y los celulares muestran el **top 5**; cada uno ve también su puesto. |
| Top 5 de la serie | **Iniciar Serie N** | Empieza la siguiente serie. |
| Top 5 de la última serie | **Ver ganador** | El ganador destacado y el podio, en la TV y en los celulares. |

- Desde una laptop también funcionan **Espacio** o **Enter** como el botón grande.
- Al revelar, aprovecha la **explicación o versículo** para comentar la respuesta.
- **Puntaje:** 100 puntos por acertar más hasta 50 por rapidez (se cambian en el editor). En empate gana
  quien tardó menos en total.

## Si algo falla

| Problema | Solución |
|---|---|
| «No carga» en los celulares al principio | El servidor estaba dormido: espera un minuto y que recarguen. |
| A alguien le dice «Demasiados intentos» | Escribió mal el PIN muchas veces. Que espere unos minutos o, mejor, que use el link o el QR. |
| Un celular dice «Sin conexión, reconectando…» | Se reconecta solo. Si no, que recargue: vuelve con su nombre y sus puntos. Las preguntas que se perdió cuentan 0. |
| Se cerró la TV o el computador se reinició | Vuelve a abrir el link de la TV: se pone al día sola. |
| Se te bloqueó o apagó el celular | Desbloquéalo: el panel se reconecta solo. Si cerraste la pestaña, vuelve a abrir el panel **en el mismo celular** (está en el historial del navegador: `…/host/game/PIN`). La partida te espera hasta 30 minutos. |
| La música no suena | Haz un clic en la TV. Si el botón de la nota musical está tachado, actívalo (solo se ve en el lobby). |

## Al terminar

- **«Jugar otra vez»** reinicia la partida con las mismas personas (puntaje a cero).
- El informe de cada partida sigue guardándose (ya no hay botón; se abre escribiendo `/host/history`): aciertos por pregunta, tiempo medio y tabla
  por jugador. Con un botón se crea una **trivia de repaso** con las preguntas que menos del 60 % acertó.
