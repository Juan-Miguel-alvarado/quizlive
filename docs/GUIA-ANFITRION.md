# Guía del anfitrión: el día del quiz

Lista de pasos para dirigir un quiz con unas 100 personas (por ejemplo, en la iglesia) sin sustos.

## Una semana antes

- [ ] **Crea el quiz** en `/host` → "+ Nuevo quiz", o impórtalo desde un CSV ("Importar CSV" en el editor).
      Consejos en [Crear preguntas](CREAR-PREGUNTAS.md).
- [ ] Añade una **explicación o versículo** a cada pregunta. Aparece al revelar la respuesta, en el
      proyector y en los celulares.
- [ ] **Prueba la partida con bots** (si tienes el proyecto en tu computadora):
      lanza la partida y ejecuta `pnpm bots <PIN> 100`. Verás 100 jugadores, reacciones y respuestas.
- [ ] **Prueba de carga contra el servidor real** (opcional, para tener calma):
      ```bash
      SERVER_URL=https://quizlivee-server.onrender.com pnpm --filter server test:load 120 --finish
      ```
- [ ] Si usas el plan gratis de Render, revisa en su panel que la **base de datos no haya caducado**
      (las gratis duran 30 días).
- [ ] Imprime o comparte la hoja [Cómo jugar](COMO-JUGAR.md) si crees que ayudará a los mayores.

## El mismo día, 15 minutos antes

1. **Despierta el servidor.** Abre `/host` en la computadora del proyector. Si aparece
   "Despertando el servidor…", espera (hasta un minuto). Después de eso todo va rápido.
2. **Conecta el proyector** y pon el navegador en pantalla completa (F11).
3. **Sonido y música:** conecta los parlantes y **haz clic en cualquier parte de la página**: el navegador
   no deja sonar nada hasta entonces (verás el aviso "Toca la pantalla para activar la música").
   En el lobby suena una música alegre y durante cada pregunta una de cuenta atrás.
   En la cabecera, el botón de la **nota musical** apaga la música y el del **altavoz** los efectos.
   Los dos se recuerdan para la próxima vez.
   Con muchos niños pequeños, conviene que alguien **lea en voz alta** cada pregunta.
4. **Lanza la partida** desde la lista de quizzes ("Lanzar"). Aparecen el QR, la dirección corta y el
   número (PIN).

## Mientras la gente entra

- Di en voz alta: **"Abran la cámara del celular y escaneen el código"**.
  Quien no pueda escanear, que entre en **quizlivee.netlify.app** (sale en grande en la pantalla) y
  escriba el **PIN del juego** de 6 cifras.
- Cada persona elige un **dibujo** (animal) y su **nombre**, o toca 🎲 para que se lo invente. Si dos
  eligen el mismo nombre, el sistema numera el segundo ("Ana 2"). Nadie se queda fuera por eso.
- El contador grande muestra cuántos han entrado. Los nombres nuevos aparecen arriba de la lista.
- Mientras esperan pueden mandar **reacciones** (👏 🙏 ❤️…), que suben por el borde de la pantalla.
- **Para expulsar** a alguien (un nombre inapropiado), haz clic en su nombre.
- Pulsa **"Empezar partida"** cuando estén todos. Quien llegue tarde todavía puede entrar.

## Durante el juego

| Tecla o botón | Qué hace |
|---|---|
| **Espacio** o **Enter** | Avanzar al siguiente paso (como el botón grande). |
| "Mostrar ya" | Salta la cuenta regresiva de 5 segundos. |
| "Cerrar pregunta" | Termina la pregunta antes de tiempo (si ya respondieron casi todos). |
| Botón de la nota musical | Apaga o enciende la música. |
| Botón del altavoz | Silencia los efectos de sonido. |
| Terminar | Corta la partida y va al podio con lo jugado. |

- La pregunta se cierra sola cuando se acaba el tiempo o cuando respondieron **todos**.
- Al revelar, aprovecha la **explicación o versículo** para comentar la respuesta antes de avanzar.
- Entre preguntas sale la **clasificación** (top 5, con 🔥 para las rachas).

## Si algo falla

| Problema | Solución |
|---|---|
| "No carga" en los celulares al principio | El servidor estaba dormido: espera un minuto y que recarguen. |
| A alguien le dice "Demasiados intentos" | Escribió mal el PIN muchas veces seguidas. Que espere unos minutos o, mejor, que escanee el QR. |
| Un celular se quedó "Sin conexión, reconectando…" | Se reconecta solo. Si no, que recargue la página: vuelve con su puntaje. |
| Alguien cerró la página sin querer | Que vuelva a abrir la página: aparece "Volver a mi partida". |
| La computadora del proyector se reinició | Vuelve a abrir `/host` en el mismo navegador. La partida sigue viva 5 minutos esperando al anfitrión. |

## Al terminar

- **"Jugar otra vez ↻"** reinicia la partida con las mismas personas (puntaje a cero).
- En **Partidas jugadas** (`/host/history`) está el informe de cada partida: aciertos por pregunta, tiempo
  medio y tabla por jugador.
- Con un botón puedes crear un **quiz de repaso** con las preguntas que menos de 60 % acertó.
