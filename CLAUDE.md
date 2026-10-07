# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

QuizLive es una trivia en tiempo real tipo Kahoot, usada sobre todo en una iglesia (p. ej. el "Día de la
Biblia"): de 15 a 100 personas a la vez, **con datos móviles y de todas las edades** (de niños a abuelos).

Hay **tres vistas sincronizadas**:
- la **pantalla TV** (`/tv/PIN`), que solo muestra;
- el **moderador** (`/host/game/PIN`, pensado para el celular), que da "siguiente";
- los **celulares** de los participantes (`/PIN` → `/play`).

Las preguntas se agrupan en **series**. Al final de cada serie se ve el top 5 y al final del juego, el ganador.

Monorepo pnpm:

- `client/`: React 19, Vite, Tailwind 4, React Router y Roboto de Google Fonts.
- `server/`: Express 5, Socket.IO y Prisma 7 sobre Postgres.
- `shared/` (`@quiz/shared`): esquemas zod, tipos de eventos, avatares, reacciones, nombres, CSV y pegado rápido (`paste.ts`). Ambos lados lo consumen como TypeScript sin compilar.

**Idioma:** los comentarios, los textos de la UI, los mensajes de error, la documentación y los commits van en
español. Los textos de la UI se escriben en lenguaje sencillo para todas las edades ("¡Prepárate!", "Elige una respuesta").

**Documentación:**
- [ARCHITECTURE.md](ARCHITECTURE.md): arquitectura completa, tabla de eventos socket, límites y capacidad.
- [docs/](docs/): guía del anfitrión, cómo jugar, crear preguntas, roadmap y `REVISAR-DIA-DE-LA-BIBLIA.md` (respuestas marcadas por Claude, pendientes de revisión por Lina).

Si cambias eventos, límites o el flujo de entrada, actualiza ARCHITECTURE.md.

## Comandos

```bash
cp .env.example .env && pnpm install
pnpm db:up            # Postgres en Docker, puerto 5433
pnpm db:migrate       # prisma migrate dev (también crea migraciones nuevas)
pnpm dev              # servidor :3001 (tsx watch) + cliente :5173 (Vite hace proxy de /api y /socket.io)

pnpm test             # vitest (solo server/: Game, scoring, auth, csv, paste, rateLimit)
pnpm --filter server exec vitest run src/game/Game.test.ts   # un archivo
pnpm --filter server exec vitest run -t "nombre del test"     # un test por nombre
pnpm typecheck        # tsc en todos los paquetes (no hay linter)
pnpm test:e2e         # partida completa por sockets; necesita el servidor corriendo
pnpm bots <PIN> [n]   # bots con avatar, nombre del dado y reacciones
pnpm --filter server test:load 120 --finish   # carga (SERVER_URL=… para producción)
pnpm --filter server seed:biblia              # carga la trivia "Día de la Biblia" por la API (no la duplica)
pnpm --filter server images:biblia            # le pone una foto (Unsplash) a cada pregunta; SERVER_URL=… para producción
pnpm --filter client build
```

CI (`.github/workflows/ci.yml`) ejecuta typecheck, tests, `prisma migrate deploy`, el servidor con `scripts/e2e.ts` y el build del cliente.

- Prisma genera el cliente en `server/src/generated/prisma` (en `postinstall`). Tras editar `schema.prisma`, ejecuta `pnpm --filter server exec prisma generate` y crea la migración.
- `.env` vive en la raíz. Lo leen `server/src/env.ts`, `server/prisma.config.ts` y Vite (`envDir: '..'`).
- `pnpm dev` usa `tsx watch`. Un servidor lanzado con `tsx src/index.ts` (sin watch) **no** recoge cambios: hay que reiniciarlo.

## Arquitectura en corto

- **Datos:** `Quiz` (la trivia, con `pointsCorrect` y `speedBonusMax`) → `Series` (ordenadas) → `Question`.
  - `Question.order` es **global** dentro de la trivia: el historial lo usa como número de pregunta.
  - Guardar reemplaza todas las series y preguntas en una transacción (`routes/quizzes.ts`).
  - Hay `PATCH` para renombrar y `POST /:id/duplicate` para duplicar.
- **Las partidas viven solo en memoria.** `GameManager` asocia el PIN (6 dígitos) a un `Game`, que es una máquina de estados:
  `lobby → countdown → question → reveal → (countdown… | leaderboard al terminar la serie) → … → podium`.
  - `GameQuiz` trae las preguntas aplanadas con `seriesIndex`. Las series vacías se descartan en `routes/games.ts`.
  - El servidor cierra la pregunta por tiempo o cuando han respondido todos; el resto de transiciones las hace el moderador.
  - `reveal → next` va a la tabla solo si la pregunta cerraba la serie (`RevealView.endsSeries`).
  - `leaderboard → next` va a la siguiente serie o al podio (`SeriesEndView.isLast`).
  - Postgres solo se escribe al final (`Game.persist()`).
- **Puntaje** (`game/scoring.ts`):
  - Acierto = `base` (100) + bono lineal por rapidez (hasta 50), configurable por trivia. Fallar o no responder = 0.
  - La racha solo se muestra: no suma puntos.
  - Desempate por **menor tiempo total** (`Player.totalMs`; sin responder cuenta el tiempo completo).
- **Pantalla TV** = rol `screen` (`screen:join`, `Game.attachScreen`): entra en `game:<pin>` y `game:<pin>:host`, recibe lo mismo que el moderador y **no puede controlar** (`hostGame()` exige `role === 'host'`). Puede haber varias, y la ruta `/tv/:pin` es pública.
- **Protocolo:** está tipado en `shared/src/events.ts`.
  - Cliente → servidor lleva ack `AckResponse`, salvo `player:react`, que es fire-and-forget.
  - En `server/src/socket/handlers.ts` se valida con zod; un `GameError` se envía tal cual al cliente.
  - Salas: `game:<pin>` y `game:<pin>:host` (moderador y pantallas TV). Lo del anfitrión se emite a la sala `:host`, no al socket del moderador, para que la TV lo reciba.
- **Lo que va al anfitrión se agrupa** (`queueHostUpdate` con `HOST_UPDATE_MS` = 150 ms): lista de jugadores, progreso y reacciones. Los celulares nunca reciben la lista de jugadores. No emitas por jugador al anfitrión: usa ese mecanismo.
- **Reconexión:** cualquier cliente entra en cualquier fase con un `GameSnapshot` completo. Los jugadores usan `playerToken` (en localStorage) y `player:rejoin`; el anfitrión usa el `hostToken` de la partida. `QuestionView` nunca incluye la respuesta correcta.
- **Auth:**
  - `HOST_PASSWORD` da un token HMAC sin estado (`lib/auth.ts`); `requireHost` protege las rutas del anfitrión.
  - El `hostToken` autoriza a dirigir una partida concreta.
  - `HOST_GRACE_MS` es de 30 min, porque el moderador puede bloquear el celular un rato.
  - Jugar no pide nada.

## Reglas que no son obvias

- **Límites por IP del PIN:** solo cuentan los **fallos** (`createRateLimiter().blocked()` + `take()` cuando el PIN no existe). Con datos móviles hay CGNAT y cientos de celulares comparten IP: **nunca** limites por petición en rutas que usan los jugadores (`GET /api/games/:pin`, `player:join`, `GET /api/images/:id`).
- **Campos nuevos en `player:join`** deben ser opcionales con un valor por defecto en el servidor (como `avatar`). Los scripts `bots.ts`, `e2e.ts` y `load.ts` no los envían.
- **Apodos repetidos:** no se rechazan, se numeran (`Game.uniqueNickname`: "Ana" → "Ana 2", máximo 20 caracteres).
- **Reacciones:** solo en `lobby`, `leaderboard` y `podium`; una cada 1,5 s por jugador. En el proyector (`components/Reactions.tsx`) suben en burbujas grandes **por los bordes** (como mucho 3 por emoji y envío, con "×N"), y en el lobby solo por la derecha para no tapar el QR.
- **Explicación/versículo:** `Question.explanation` (opcional, ≤300 caracteres). Va en `RevealView.explanation`. En el CSV es la 9.ª columna; los CSV de 8 columnas siguen siendo válidos. Al añadir campos a `Question`, actualiza también los `select` de `routes/quizzes.ts`, `routes/games.ts` y `routes/history.ts` (quiz de repaso).
- **Avatares:** son un enum cerrado (`AVATARS` en `shared/src/schemas.ts`). Los nombres del dado (`shared/src/names.ts`) usan adjetivos que valen para masculino y femenino.
- **Tamaño de letra:** en el celular (`max-width: 40rem`) el texto base es 112,5 %, y con el botón "Letra" (`data-big-text` en `<html>`) es 131 %. El proyector no se escala. Usa unidades `rem`.
- **Rutas del cliente:**
  - `/:pin` (solo 6 dígitos) es la entrada corta que lleva el QR.
  - `/tv/:pin` es la TV (`pages/tv/TvScreen.tsx`) y `/host/game/:pin` el moderador (`pages/host/Moderator.tsx`).
  - Las pantallas `/host/*` y `/tv` se cargan con `lazy` para que los jugadores descarguen menos.
- **Pantalla TV:**
  - Sin botones durante el juego: solo en el lobby salen pantalla completa, música y efectos. También funcionan el doble clic y la tecla F, y el cursor se oculta solo.
  - El tamaño del texto depende de la longitud de la pregunta y de las opciones (`questionSize` y `optionSize`).
  - Con la variante `short:` (alto de 800 px o menos, definida en `index.css`) todo cabe en una TV de 1280×720. Pregunta, contador y opciones son `shrink-0`; lo que cede es el hueco de la imagen.
- **Pegado rápido** (`shared/src/paste.ts`):
  - `parsePastedQuestion` recibe 5 líneas (pregunta y 4 opciones) o 4 (solo las opciones).
  - `parsePastedQuestions` recibe bloques del Word.
  - Quita prefijos y marca la correcta con `*`.
  - Si no hay exactamente 4 opciones, devuelve `problem` y el editor no deja usarla.
  - Tiene tests con el texto real del Word del usuario.
- **Sonido** solo en el proyector (WebAudio, `lib/sound.ts`). Los celulares solo vibran (`buzz`). La lectura en voz alta se quitó a pedido del usuario: no la vuelvas a añadir.
- **Tema tipo Kahoot** (`client/src/index.css`):
  - El fondo es el escenario morado (`stage*`): encima, texto blanco y lo secundario en `text-stage-soft`, nunca `text-ink-soft`.
  - Lo que hay que leer va en `.card` blanca, donde sí van `text-ink`/`text-ink-soft`.
  - Botones: `btn-primary` (blanco), `btn-accent` (verde), `btn-dark`, `btn-plain` (sobre morado) y `btn-light` (dentro de tarjetas). Sombras `shadow-3d*`, sin bordes negros.
  - El amarillo de respuesta lleva texto oscuro.
- **Música:** `lib/music.ts` (secuenciador WebAudio, composiciones propias). Solo suena en la **TV** y comparte el `AudioContext` con `sound.ts` (`getAudioContext()`). `TvScreen` decide la canción por fase: `lobby`, `question` o silencio. El moderador no suena.
- **Margen de reacciones:** el lobby de la TV reserva 7,5 rem a cada lado (`max-w-[min(90rem,calc(100%-15rem))]`) para las burbujas de reacciones; no lo quites.
- **Iconos:** usa Bootstrap Icons (`react-bootstrap-icons`) para todo lo que sea interfaz (botones, estados, flechas). Los emojis quedan solo para avatares y reacciones. No uses símbolos unicode como ▸ ✓ ✕.
- **Dirección pública:** los jugadores entran por **quizlivee.vercel.app**. Netlify (quizlivee.netlify.app) sigue como respaldo y su QR también apunta a Vercel. El QR y el link usan `PUBLIC_URL` (`lib/api.ts`) = `VITE_PUBLIC_URL`; en desarrollo, la propia página.
- **Palabras:** en la interfaz se dice **trivia** (no "quiz"), **moderador** y **participantes**. En el código, los modelos siguen llamándose `Quiz`.
- **Render gratis** se duerme: `useServerWakeup` y `WakingBanner` avisan en `Home` y `HostGate`.

## Despliegue

- **Frontend en Vercel** (`vercel.json`: instalar con pnpm, `pnpm --filter client build`, `client/dist` y reescritura SPA).
  - Las variables del cliente están en **`.env.production`** (versionado, sin secretos): `VITE_SERVER_URL` (Render) y `VITE_PUBLIC_URL` (Vercel). Vite solo las lee al compilar para producción.
  - Netlify (`netlify.toml`) sigue configurado como respaldo.
- **Render** (`render.yaml`) levanta el servidor (Socket.IO necesita un proceso siempre encendido, por eso no va en Vercel) y Postgres, con despliegue automático en cada push a `main`.
- `pnpm start` (en `server/`) hace `prisma generate && prisma migrate deploy && tsx src/index.ts`. El `generate` va aquí a propósito: con la caché de instalación de Render, pnpm ve las dependencias "al día", se salta el `postinstall` y el servidor caía con `ERR_MODULE_NOT_FOUND …/generated/prisma/client`. Las migraciones salen con cada deploy.
- `CLIENT_ORIGIN` (`render.yaml`) debe incluir las URL de Vercel y Netlify.
- `/api/health` devuelve el commit desplegado.

## Verificar cambios visuales

Para ver la UI sin un celular real:
1. Arranca `pnpm dev` y lanza una partida (o créala por API).
2. Llénala con `pnpm bots <PIN> 15` (o 100).
3. Haz capturas con Playwright:
   - TV a 1920×1080 **y 1280×720**: es la más ajustada.
   - Moderador y celular a 390×844.
   - Para el moderador, pon `quizlive:session` y `quizlive:host:<pin>` en localStorage.
   - La TV no necesita sesión.
