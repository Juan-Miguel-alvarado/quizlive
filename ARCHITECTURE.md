# Arquitectura de QuizLive

Este documento explica cómo encajan las piezas. Para usar la app, mira el [README](README.md) y las
guías de [`docs/`](docs/).

## Vista general

```
 Celulares (participantes)     Moderador (celular/laptop)       Pantalla TV (proyecta)
 ─────────────────────────     ──────────────────────────       ──────────────────────
  /  ·  /:pin  ·  /play         /host  ·  /host/game/:pin         /tv/:pin  (solo mira)
          │                              │                                │
          └──────────────────────── React SPA ────────────────────────────┘   Vercel (archivos estáticos)
                          │
            HTTP /api  +  WebSocket /socket.io
                          │
               ┌──────────▼───────────┐
               │  Express + Socket.IO │                Render (proceso siempre encendido)
               │  GameManager         │
               │   └─ Game (en memoria, una por PIN)
               └──────────┬───────────┘
                          │ Prisma
               ┌──────────▼───────────┐
               │      PostgreSQL      │  quizzes, preguntas, imágenes, historial
               └──────────────────────┘
```

Monorepo con pnpm:

| Paquete | Qué hay |
|---|---|
| `shared/` (`@quiz/shared`) | Esquemas zod, tipos de eventos socket, avatares, reacciones, generador de nombres, parser CSV y pegado rápido (`paste.ts`). Se importa como TypeScript sin compilar desde los otros dos. |
| `server/` | Express 5, Socket.IO 4, Prisma 7 (cliente generado en `src/generated/prisma`). |
| `client/` | React 19, React Router, Tailwind 4, Vite. Fuente Roboto desde Google Fonts. |

## La partida: una máquina de estados en memoria

`server/src/game/Game.ts` es el corazón. Cada partida vive **solo en memoria** mientras se juega.
Postgres no se toca hasta el final.

Las preguntas se agrupan en **series** (por ejemplo "¿Quién dijo?"). `GameQuiz` trae las preguntas aplanadas,
cada una con su `seriesIndex`, y sin las series vacías.

```
lobby ──start──▶ countdown ──5 s──▶ question ──tiempo / todos respondieron──▶ reveal
                     ▲   ▲                                                      │ next
                     │   └──────── (quedan preguntas en la serie) ──────────────┤
                     │                                                          │ (era la última de la serie)
                     └──── next ──── leaderboard: top 5 de la serie ◀───────────┘
                                          │ next (era la última serie: "Ver ganador")
                                          ▼
                                       podium
```

- **El servidor es la única fuente de verdad.** Los clientes solo muestran lo que reciben.
- El servidor cierra una pregunta cuando se acaba el tiempo o cuando han respondido **todos** (incluidos
  los desconectados: quien bloquea el celular no debe frenar al resto). Los demás pasos los da el
  moderador (`host:next`).
- `RevealView.endsSeries` le dice al moderador si su botón es "Siguiente pregunta" o "Ver tabla".
  `SeriesEndView.isLast` le dice si es "Iniciar Serie N" o "Ver ganador".
- `GameManager` asigna un PIN de 6 dígitos al azar y borra la partida cuando se cierra.
- Temporizadores de vida: si el moderador no está conectado durante 30 min, la partida se cierra. Es
  generoso porque dirige desde el celular y puede bloquearlo. Al terminar, la partida se queda 10 min en
  memoria para que quien recargue vea el podio.
- `Game.persist()` guarda al final `Game`, `PlayerResult` y `GameAnswer`, con copia del texto de cada
  pregunta para que editar el quiz después no altere el historial.

### Puntaje

`server/src/game/scoring.ts`:
- **Acierto:** `pointsCorrect` (100) + un bono lineal por rapidez de hasta `speedBonusMax` (50). Las dos
  cifras se configuran por trivia. Responder al instante da ~150 y en el último segundo ~100.
- **Error o sin responder:** 0.
- **Selección múltiple:** solo puntúa quien marca **exactamente** las correctas.
- **Racha:** se cuenta y se muestra (🔥), pero no da puntos.
- **Desempate:** gana quien acumuló **menos tiempo total** respondiendo (`Player.totalMs`; las preguntas
  sin responder cuentan su tiempo completo). Solo comparten puesto si empatan en puntos y en tiempo.
- Los puntos se suman al cerrar la pregunta, para que el marcador no delate antes si alguien acertó.

## Protocolo de tiempo real

Todo está tipado en `shared/src/events.ts`. Cada evento cliente → servidor lleva *ack*
(`{ ok: true, … } | { ok: false, error }`), salvo `player:react`, que es de "disparar y olvidar".

| Evento | Quién lo manda | Para qué |
|---|---|---|
| `host:join` | anfitrión | Conectarse con el `hostToken` de la partida; recibe la foto completa del estado. |
| `host:start` · `host:next` · `host:end` · `host:playAgain` · `host:kick` | moderador | Controlar la partida. |
| `screen:join` | pantalla TV | Unirse solo para mirar: recibe lo mismo que el moderador y no puede controlar nada. |
| `player:join` | jugador | Entrar con `{ pin, nickname, avatar? }`; recibe `playerToken` y el estado. |
| `player:rejoin` | jugador | Volver tras recargar o perder la red. |
| `player:answer` | jugador | Responder `{ questionIndex, choices }`. |
| `player:react` | jugador | Mandar 👏 🙌 🔥 😂 ❤️ 🙏 a la pantalla grande (sin ack). |

| Evento | A quién llega | Contenido |
|---|---|---|
| `lobby:players` | moderador y TV | Lista de jugadores (con avatar). |
| `question:countdown` · `question:start` | todos | "¡Prepárate!" y la pregunta, con `series` y `inSeries` ("Serie 2 de 4 · Pregunta 3 de 12"). **Nunca** incluye la respuesta correcta. |
| `question:progress` | moderador y TV | Cuántos respondieron. |
| `question:reveal` | todos | Respuestas correctas, reparto de votos, `explanation` (dato o versículo) y `endsSeries`. |
| `player:result` | cada jugador | Su resultado: puntos, racha y puesto. |
| `game:leaderboard` | todos | Top 5 al terminar una serie, con `seriesEnd: { series, isLast }`. |
| `game:podium` | todos | Top 3 final (el ganador) y, a cada jugador, su puesto. |
| `game:state` | uno | Foto completa del estado (al reiniciar con "Jugar otra vez"). |
| `game:closed` | todos o uno | La partida terminó, o te expulsaron. |
| `host:reactions` | moderador y TV | Reacciones acumuladas `{ counts: { '👏': 12, … } }`. |

Validación: los *payloads* pasan por los esquemas zod de `shared/src/schemas.ts` en
`server/src/socket/handlers.ts`. Lanzar `GameError` envía el mensaje tal cual al cliente. Cualquier otro
error se convierte en "Error interno del servidor".

Salas de Socket.IO: `game:<pin>` (todos) y `game:<pin>:host` (el moderador y las pantallas TV). Lo que es
"del anfitrión" se emite siempre a esa sala, nunca al socket del moderador, para que la TV también lo reciba.

### Pensado para 100–200 personas a la vez

- **Lo que recibe el anfitrión se agrupa.** Las listas de jugadores, el contador de respuestas y las
  reacciones se juntan y se envían como mucho cada `HOST_UPDATE_MS` (150 ms). Con 100 personas entrando
  a la vez, el anfitrión recibe un puñado de mensajes en vez de cientos.
- **Los celulares no reciben la lista de jugadores** (serían 100 × 100 mensajes).
- **Reacciones:** una por jugador cada 1,5 s y solo en lobby, clasificación y podio. Durante la pregunta
  taparían lo importante. En el proyector suben en burbujas grandes por los bordes (como mucho 3 por emoji en cada
  envío, con "×N"), nunca encima del QR.
- **Imágenes:** caché en memoria de las últimas 40, porque al aparecer una pregunta con imagen la piden
  100 celulares a la vez.
- **Prueba de carga:** `pnpm --filter server test:load 120 --finish`. En local entran 120 jugadores en
  ~0,3 s, y cada pregunta y cada tabla llegan a todos en ~20 ms. El spec pide menos de 1 s de diferencia
  entre la TV, el moderador y los celulares.
- Límite duro: `MAX_PLAYERS = 200` por partida.

## Reconexión

Cualquier cliente puede entrar en **cualquier fase** porque recibe una foto completa (`GameSnapshot`).

- El jugador guarda `{ pin, playerToken, nickname }` en `localStorage` (`quizlive:player`). Al recargar,
  `/play` hace `player:rejoin` y recupera su puntaje.
- El anfitrión guarda el `hostToken` de cada partida (`quizlive:host:<pin>`).
- El reloj se sincroniza con `serverNow` y `endsAt` (milisegundos del servidor). El cliente calcula
  el desfase en `client/src/lib/useGame.ts`, un *reducer* que aplica la foto completa y los eventos
  sueltos.
- Si alguien abre la partida en otra pestaña, la anterior queda fuera con un aviso.

## Entrada rápida (lo que hace que 100 personas entren en un minuto)

1. **QR con la ruta corta** `quizlivee.vercel.app/482913`, que salta directo al paso del nombre. La TV
   muestra, como Kahoot, el dominio y el PIN en grande. El moderador puede **compartir el link por
   WhatsApp** (`navigator.share`, o `wa.me` si no está disponible).
   La dirección sale de `PUBLIC_URL` (`client/src/lib/api.ts`): `VITE_PUBLIC_URL` en producción
   (`.env.production`), o la de la propia página en desarrollo.
2. **El PIN se valida solo** al escribir el 6.º dígito, con teclado numérico (`inputMode="numeric"`).
3. **Una sola pantalla** para el dibujo (avatar), el nombre y el botón "¡Jugar!". El dado 🎲 propone un
   nombre amable a partir del avatar ("León Valiente").
4. **Los nombres repetidos no dan error:** el servidor los numera ("Ana" → "Ana 2").
5. **El perfil se recuerda** (`quizlive:profile`): la próxima vez basta un toque.
6. **Despertar el servidor:** Render gratis se duerme. `useServerWakeup` hace ping a `/api/health` al
   abrir la página y avisa si tarda.
7. **Las pantallas del moderador y de la TV se descargan aparte** (`lazy` en `main.tsx`), así el celular baja menos.

## Seguridad y límites

- **Anfitrión:** `HOST_PASSWORD`. `POST /api/auth/login` devuelve un token firmado con HMAC sin estado
  (`server/src/lib/auth.ts`), firmado con `SESSION_SECRET`. Si falta `SESSION_SECRET`, se usa uno al azar
  y las sesiones mueren al reiniciar. `requireHost` protege `/api/quizzes`, `/api/history`,
  `POST /api/games` y `POST /api/images`.
- **Partida:** el `hostToken` de cada partida autoriza a dirigirla por socket. Jugar no pide nada.
- **Pantalla TV:** pública (`/tv/:pin`) y de solo lectura. No muestra nada que el público no vaya a ver
  igualmente, y nunca recibe la respuesta antes de la revelación, igual que los celulares.
- **Límites por IP** (`server/src/lib/rateLimit.ts`, en memoria, ventana fija):
  - `GET /api/games/:pin` y `player:join` **solo cuentan los PIN que no existen** (60 y 100 cada
    5 min). Con datos móviles, los operadores usan **CGNAT**: cientos de celulares salen por la misma
    IP. Si se contara cada petición, la mitad de la iglesia quedaría fuera.
  - Login: 10 cada 10 min. Escrituras de quizzes: 120 por hora. Subida de imágenes: 60 por hora.
- `app.set('trust proxy', 1)` hace que `req.ip` sea la IP real detrás del proxy de Render.

## Persistencia (Postgres)

`server/prisma/schema.prisma`:

| Modelo | Qué guarda |
|---|---|
| `Quiz` | La trivia: título, `pointsCorrect` y `speedBonusMax`. |
| `Series` | Grupos ordenados de preguntas dentro de una trivia (`order`, `title`). |
| `Question` | `type`, `options`, `correctIndices`, `timeLimitSec` (15 por defecto), `imageId` y `explanation` (opcional). `order` es global en la trivia; `seriesId` la ubica en su serie. |
| `Image` | Bytes de la imagen (WebP de ≤1600 px, reducida en el navegador). Las huérfanas se borran tras un día. |
| `Game`, `PlayerResult`, `GameAnswer` | Historial e informe por partida. |

Las migraciones están en `server/prisma/migrations/` y se aplican solas al arrancar en producción
(`pnpm start` = `prisma migrate deploy && tsx src/index.ts`).

## Cliente

- `client/src/main.tsx`: rutas (`/`, `/:pin`, `/play`, `/tv/:pin` y `/host/*` con carga diferida).
- **Pantalla TV** (`pages/tv/TvScreen.tsx`):
  - **Sin botones durante el juego:** solo en el lobby salen pantalla completa, música y efectos. También
    funcionan el doble clic y la tecla F, y el cursor se oculta tras 3 s.
  - **Texto:** la pregunta y las opciones ajustan su tamaño a su longitud. Con la variante `short:`
    (alto de 800 px o menos) todo cabe en una TV de 1280×720.
  - **Tiempo:** número grande y barra (`TimerBar`), que se ponen en rojo los últimos 5 s.
  - **Revelación:** la correcta en verde y las demás apagadas, siempre con su conteo legible.
  - **Inicio de serie:** "Serie 2 de 4" con el título.
  - **Final de serie:** top 5. **Final del juego:** ganador y podio.
- **Moderador** (`pages/host/Moderator.tsx`), pensado para el celular:
  - Abrir o copiar el link de la TV, y compartir el link de los participantes.
  - Un **botón principal enorme** según la fase: Iniciar, Mostrar ya, Siguiente pregunta, Ver tabla,
    Iniciar Serie N, Ver ganador.
  - La pregunta actual con su contador y "N de M respondieron". Al revelar, la correcta y los votos.
  - Lista de participantes para sacar a alguien.
- **Editor** (`pages/host/QuizEditor.tsx`):
  - Ajustes de puntaje.
  - Series con título, reordenables y borrables.
  - En cada pregunta, "Pegado rápido"; en cada serie, "Pegar varias preguntas" e "Importar CSV".
  - Antes de agregar lo pegado se ve una vista previa, con los problemas marcados.
- `client/src/lib/`: `socket.ts` (un único socket y acciones con ack), `useGame.ts`, `api.ts` (REST),
  `session.ts` (localStorage), `sound.ts` (efectos WebAudio, solo en la TV), `music.ts`
  (música de la TV), `useServerWakeup.ts`.
- Iconos de interfaz: Bootstrap Icons vía `react-bootstrap-icons` (solo se empaquetan los que se usan).
  Los emojis se reservan para avatares y reacciones.
- Accesibilidad para todas las edades:
  - En el celular el texto base es 112,5 %.
  - Cada opción tiene color, figura y letra (A/B/C/D).
  - Textos claros ("¡Prepárate!", "Elige una respuesta").
  - Resultado con ícono ✓ / ✗ / ⏱ y vibración.
  - Se respeta `prefers-reduced-motion`.
- **Diseño tipo Kahoot** (tokens en `@theme` de `client/src/index.css`):
  - **Escenario:** fondo morado con degradado y figuras tenues (`stage`, `stage-dark`, `stage-light`). Sobre él, texto blanco; lo secundario va en `text-stage-soft`.
  - **Contenido para leer:** va en `.card` blanca (`text-ink`, `text-ink-soft`); `.pill` es la píldora blanca de títulos y contadores.
  - **Botones 3D** (`shadow-3d*`): `btn-primary` (blanco), `btn-accent` (verde), `btn-dark`, `btn-plain` (translúcido, sobre morado) y `btn-light` (gris, dentro de tarjetas).
  - **Respuestas** con los colores de Kahoot (`opt-red/blue/yellow/green`). El amarillo lleva texto oscuro por contraste.
  - **Podio** en `gold`, `silver` y `bronze`.
- **Música** (`lib/music.ts`):
  - Reproduce `client/public/music/fondo.mp3` (la canción que eligió el usuario: ~2 min, 128 kbps, ~2 MB) en bucle durante `lobby` y `question`, con fundidos. En las demás fases se pausa y luego sigue por donde iba.
  - Solo la TV la descarga, la primera vez que suena; los celulares nunca la piden.
  - Comparte el `AudioContext` con `sound.ts` (`getAudioContext()`), que se desbloquea con el primer clic o tecla en la TV. Mientras tanto aparece "Haz clic en la pantalla para activar el sonido".
  - Tiene su propio botón, recordado en `quizlive:music`. Nunca suena en los celulares.

## Despliegue

| Pieza | Dónde | Configuración |
|---|---|---|
| Frontend | **Vercel** (quizlivee.vercel.app) | `vercel.json`: instala con pnpm, `pnpm --filter client build`, publica `client/dist` y reescribe las rutas a `index.html` (SPA). Las variables del cliente (`VITE_SERVER_URL`, `VITE_PUBLIC_URL`) están en `.env.production`, versionado y sin secretos. |
| Frontend (respaldo) | Netlify (quizlivee.netlify.app) | `netlify.toml`. Su QR también apunta a Vercel. |
| Backend + Postgres | Render | `render.yaml` (blueprint). Despliegue automático en cada push a `main`. `CLIENT_ORIGIN` incluye las URL de Vercel y Netlify. Socket.IO necesita un proceso siempre encendido, así que no puede ir en Vercel. |

`GET /api/health` responde `{ ok, commit }` para saber qué versión está desplegada.

**Ojo con el plan gratis de Render:**
- El servicio se duerme tras ~15 min sin uso y tarda cerca de un minuto en despertar.
- La base de datos gratis caduca a los 30 días. Desde ese momento hay 14 días para pasarla a un plan de pago;
  si no, Render la borra con todo (trivias, fotos e historial).
- `pnpm --filter server db:respaldar` / `db:restaurar` (`server/scripts/respaldo.ts`) copian la base entera a un
  JSON y de vuelta a cualquier Postgres vacío, conservando los ids.

La [guía del anfitrión](docs/GUIA-ANFITRION.md) explica cómo prepararse.
