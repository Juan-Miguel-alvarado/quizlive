# QuizLive

Quizzes en tiempo real tipo Kahoot. Monorepo con pnpm:

- `client/`: React + Vite + Tailwind
- `server/`: Express + Socket.IO + Prisma
- `shared/`: tipos de eventos y esquemas zod que usan los dos

## Puesta en marcha

```bash
cp .env.example .env
pnpm install
pnpm db:up        # Postgres en Docker (puerto 5433)
pnpm db:migrate   # aplica las migraciones
pnpm dev          # servidor :3001 + cliente :5173
```

| Qué | Dónde |
|---|---|
| Anfitrión (crear quizzes, iniciar partida) | http://localhost:5173/host (clave: `HOST_PASSWORD`) |
| Jugadores | http://<IP-de-tu-PC>:5173 (misma Wi-Fi) |
| Base de datos | `pnpm db:studio` |

## Jugar con otros

- **Misma Wi-Fi:** abre `http://<IP-de-tu-PC>:5173/host` y permite el puerto (`sudo ufw allow 5173/tcp`).
- **Desde cualquier red:** con `pnpm dev` corriendo, ejecuta `pnpm tunnel` y abre `https://<algo>.trycloudflare.com/host`.
  El enlace es público y cambia en cada ejecución; ciérralo (Ctrl+C) al terminar.

## Herramientas de prueba

```bash
pnpm test                    # tests unitarios (puntaje, máquina de estados, sesión, CSV)
pnpm bots <PIN> [cantidad]   # llena una partida con bots que responden al azar
pnpm test:e2e                # partida completa simulada por sockets (con pnpm dev corriendo)
pnpm --filter server test:load 200   # carga: 200 jugadores (SERVER_URL=… para producción)
pnpm typecheck
```

## Preguntas

| Tipo | Opciones | Correctas | Cómo puntúa |
|---|---|---|---|
| Opción única | 2 a 4 | 1 | acierto = 500 a 1000 pts según rapidez |
| Selección múltiple | 2 a 4 | 1 o más | solo si marca exactamente todas las correctas |
| Verdadero o falso | fijas | 1 | igual que opción única |

Cada pregunta puede llevar una imagen. El navegador la reduce (a lo sumo 1600 px, WebP) antes de
subirla y se guarda en Postgres (`Image`), así el despliegue no necesita almacenamiento aparte.
Las imágenes que ya no usa ninguna pregunta se borran solas después de un día.

## Qué más trae

- **Clave de anfitrión** (`HOST_PASSWORD`): sin ella no se ven ni se tocan los quizzes. Jugar no pide nada.
- **Historial e informe** por partida: aciertos por pregunta, tiempo medio y tabla por jugador. Con un botón
  se crea un quiz de repaso con las preguntas que el grupo falló (menos del 60 % de aciertos).
- **Bonus por racha**: +100 puntos por cada acierto seguido, hasta +500.
- **Flechas** en la clasificación con lo que subió o bajó cada quien.
- **Sonido en la pantalla del anfitrión y vibración en los celulares** (30 teléfonos sonando sería un caos).
- **Teclado**: 1-4 para responder, Enter para enviar en selección múltiple, espacio para avanzar como anfitrión.
- **Importar CSV** en el editor y **jugar otra vez** con los mismos jugadores desde el podio.
- **Límites por IP** contra fuerza bruta de PIN, spam de imágenes e intentos de clave.

## Cómo funciona

El servidor es la única fuente de verdad. Cada partida es una máquina de estados en memoria
(`server/src/game/Game.ts`):

```
lobby → countdown → question → reveal → leaderboard → countdown → … → podium
```

- El servidor cierra la pregunta al agotarse el tiempo o cuando respondieron todos. Los demás cambios de fase los hace el anfitrión.
- Puntaje: acierto = 500 a 1000 pts según la rapidez; error = 0.
- Los jugadores guardan un token en `localStorage`: si recargan la página o pierden la conexión, vuelven con su puntaje.
- Al terminar, los resultados y cada respuesta se guardan en Postgres (`Game`, `PlayerResult`, `GameAnswer`).

## Despliegue

El frontend y el backend se despliegan por separado: Netlify solo sirve archivos estáticos y el
backend necesita un proceso siempre encendido (Socket.IO) y Postgres.

**1. Backend + base de datos (Railway o Render)**

- Servicio desde este repo con *root directory* `server`.
- Base de datos Postgres del mismo proveedor.
- Variables:
  - `DATABASE_URL`: la de ese Postgres.
  - `CLIENT_ORIGIN`: la URL de Netlify (se aceptan varias separadas por coma).
  - `HOST_PASSWORD`: la clave para entrar a `/host`. Render la pide al aplicar el blueprint.
  - `SESSION_SECRET`: la genera Render sola.
  - `PORT`: la pone el proveedor.
- Comando de arranque: `pnpm start`. Aplica las migraciones y levanta el servidor.

**2. Frontend (Netlify)**

- Importa el repo; `netlify.toml` ya define el build (`client/dist`).
- Variable `VITE_SERVER_URL`: la URL pública del backend del paso 1.
