# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

QuizLive es un quiz en tiempo real tipo Kahoot, usado sobre todo en una iglesia: unas **100 personas a la
vez, con datos móviles, de todas las edades** (de niños a abuelos). Monorepo pnpm:

- `client/`: React 19, Vite, Tailwind 4, React Router y Roboto de Google Fonts.
- `server/`: Express 5, Socket.IO y Prisma 7 sobre Postgres.
- `shared/` (`@quiz/shared`): esquemas zod, tipos de eventos, avatares, reacciones, nombres y CSV. Ambos lados lo consumen como TypeScript sin compilar.

**Idioma:** los comentarios, los textos de la UI, los mensajes de error, la documentación y los commits van en
español. Los textos de la UI se escriben en lenguaje sencillo para todas las edades ("¡Prepárate!", "Elige una respuesta").

**Documentación:**
- [ARCHITECTURE.md](ARCHITECTURE.md): arquitectura completa, tabla de eventos socket, límites y capacidad.
- [docs/](docs/): guía del anfitrión, cómo jugar, crear preguntas y roadmap.

Si cambias eventos, límites o el flujo de entrada, actualiza ARCHITECTURE.md.

## Comandos

```bash
cp .env.example .env && pnpm install
pnpm db:up            # Postgres en Docker, puerto 5433
pnpm db:migrate       # prisma migrate dev (también crea migraciones nuevas)
pnpm dev              # servidor :3001 (tsx watch) + cliente :5173 (Vite hace proxy de /api y /socket.io)

pnpm test             # vitest (solo server/: Game, scoring, auth, csv, rateLimit)
pnpm --filter server exec vitest run src/game/Game.test.ts   # un archivo
pnpm --filter server exec vitest run -t "nombre del test"     # un test por nombre
pnpm typecheck        # tsc en todos los paquetes (no hay linter)
pnpm test:e2e         # partida completa por sockets; necesita el servidor corriendo
pnpm bots <PIN> [n]   # bots con avatar, nombre del dado y reacciones
pnpm --filter server test:load 120 --finish   # carga (SERVER_URL=… para producción)
pnpm --filter client build
```

CI (`.github/workflows/ci.yml`) ejecuta typecheck, tests, `prisma migrate deploy`, el servidor con `scripts/e2e.ts` y el build del cliente.

- Prisma genera el cliente en `server/src/generated/prisma` (en `postinstall`). Tras editar `schema.prisma`, ejecuta `pnpm --filter server exec prisma generate` y crea la migración.
- `.env` vive en la raíz. Lo leen `server/src/env.ts`, `server/prisma.config.ts` y Vite (`envDir: '..'`).
- `pnpm dev` usa `tsx watch`. Un servidor lanzado con `tsx src/index.ts` (sin watch) **no** recoge cambios: hay que reiniciarlo.

## Arquitectura en corto

- **Las partidas viven solo en memoria.** `GameManager` asocia el PIN (6 dígitos) a un `Game`, que es una máquina de estados:
  `lobby → countdown → question → reveal → leaderboard → … → podium`. El servidor cierra la pregunta por tiempo o cuando han respondido todos; el resto de transiciones las hace el anfitrión. Postgres solo se escribe al final (`Game.persist()`).
- **Protocolo:** está tipado en `shared/src/events.ts`.
  - Cliente → servidor lleva ack `AckResponse`, salvo `player:react`, que es fire-and-forget.
  - En `server/src/socket/handlers.ts` se valida con zod; un `GameError` se envía tal cual al cliente.
  - Salas: `game:<pin>` y `game:<pin>:host`.
- **Lo que va al anfitrión se agrupa** (`queueHostUpdate` con `HOST_UPDATE_MS` = 150 ms): lista de jugadores, progreso y reacciones. Los celulares nunca reciben la lista de jugadores. No emitas por jugador al anfitrión: usa ese mecanismo.
- **Reconexión:** cualquier cliente entra en cualquier fase con un `GameSnapshot` completo. Los jugadores usan `playerToken` (en localStorage) y `player:rejoin`; el anfitrión usa el `hostToken` de la partida. `QuestionView` nunca incluye la respuesta correcta.
- **Auth:**
  - `HOST_PASSWORD` da un token HMAC sin estado (`lib/auth.ts`); `requireHost` protege las rutas del anfitrión.
  - El `hostToken` autoriza a dirigir una partida concreta.
  - Jugar no pide nada.

## Reglas que no son obvias

- **Límites por IP del PIN:** solo cuentan los **fallos** (`createRateLimiter().blocked()` + `take()` cuando el PIN no existe). Con datos móviles hay CGNAT y cientos de celulares comparten IP: **nunca** limites por petición en rutas que usan los jugadores (`GET /api/games/:pin`, `player:join`, `GET /api/images/:id`).
- **Campos nuevos en `player:join`** deben ser opcionales con un valor por defecto en el servidor (como `avatar`). Los scripts `bots.ts`, `e2e.ts` y `load.ts` no los envían.
- **Apodos repetidos:** no se rechazan, se numeran (`Game.uniqueNickname`: "Ana" → "Ana 2", máximo 20 caracteres).
- **Reacciones:** solo en `lobby`, `leaderboard` y `podium`; una cada 1,5 s por jugador. En el proyector (`components/Reactions.tsx`) suben en burbujas grandes **por los bordes** (como mucho 3 por emoji y envío, con "×N"), y en el lobby solo por la derecha para no tapar el QR.
- **Explicación/versículo:** `Question.explanation` (opcional, ≤300 caracteres). Va en `RevealView.explanation`. En el CSV es la 9.ª columna; los CSV de 8 columnas siguen siendo válidos. Al añadir campos a `Question`, actualiza también los `select` de `routes/quizzes.ts`, `routes/games.ts` y `routes/history.ts` (quiz de repaso).
- **Avatares:** son un enum cerrado (`AVATARS` en `shared/src/schemas.ts`). Los nombres del dado (`shared/src/names.ts`) usan adjetivos que valen para masculino y femenino.
- **Tamaño de letra:** en el celular (`max-width: 40rem`) el texto base es 112,5 %, y con el botón "Letra" (`data-big-text` en `<html>`) es 131 %. El proyector no se escala. Usa unidades `rem`.
- **Rutas del cliente:** `/:pin` (solo 6 dígitos) es la entrada corta que lleva el QR. Las pantallas `/host/*` se cargan con `lazy` para que los jugadores descarguen menos.
- **Sonido** solo en el proyector (WebAudio, `lib/sound.ts`). Los celulares solo vibran (`buzz`). La lectura en voz alta se quitó a pedido del usuario: no la vuelvas a añadir.
- **Tema tipo Kahoot** (`client/src/index.css`):
  - El fondo es el escenario morado (`stage*`): encima, texto blanco y lo secundario en `text-stage-soft`, nunca `text-ink-soft`.
  - Lo que hay que leer va en `.card` blanca, donde sí van `text-ink`/`text-ink-soft`.
  - Botones: `btn-primary` (blanco), `btn-accent` (verde), `btn-dark`, `btn-plain` (sobre morado) y `btn-light` (dentro de tarjetas). Sombras `shadow-3d*`, sin bordes negros.
  - El amarillo de respuesta lleva texto oscuro.
- **Música:** `lib/music.ts` (secuenciador WebAudio, composiciones propias). Solo en el proyector y comparte el `AudioContext` con `sound.ts` (`getAudioContext()`). `HostGame` decide la canción por fase: `lobby`, `question` o silencio.
- **Margen de reacciones:** el lobby del proyector reserva 7,5 rem a cada lado (`lg:max-w-[min(80rem,calc(100%-15rem))]`) para las burbujas de reacciones; no lo quites.
- **Iconos:** usa Bootstrap Icons (`react-bootstrap-icons`) para todo lo que sea interfaz (botones, estados, flechas). Los emojis quedan solo para avatares y reacciones. No uses símbolos unicode como ▸ ✓ ✕.
- **Dirección pública:** los jugadores entran por **quizlivee.netlify.app**. El QR y el enlace del lobby usan `PUBLIC_URL` (`lib/api.ts`) = `VITE_PUBLIC_URL` de `netlify.toml`; en desarrollo, la propia página.
- **Render gratis** se duerme: `useServerWakeup` y `WakingBanner` avisan en `Home` y `HostGate`.

## Despliegue

- Netlify (`netlify.toml`) sirve `client/dist` como SPA, con `VITE_SERVER_URL` apuntando a Render.
- Render (`render.yaml`) levanta el servidor y Postgres, con despliegue automático en cada push a `main`.
- `pnpm start` aplica `prisma migrate deploy` antes de arrancar, así las migraciones salen con cada deploy.
- `CLIENT_ORIGIN` debe incluir la URL de Netlify.
- `/api/health` devuelve el commit desplegado.

## Verificar cambios visuales

Para ver la UI sin un celular real:
1. Arranca `pnpm dev` y lanza una partida (o créala por API).
2. Llénala con `pnpm bots <PIN> 100`.
3. Haz capturas con Playwright a 1600×900 (proyector) y 390×844 (celular). Para el anfitrión, pon `quizlive:session` y `quizlive:host:<pin>` en localStorage.
