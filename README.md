# QuizLive

Quizzes en tiempo real tipo Kahoot, pensados para salas grandes (probado con 120 jugadores a la vez) y
para todas las edades. Monorepo con pnpm:

- `client/`: React + Vite + Tailwind (fuente Roboto de Google Fonts)
- `server/`: Express + Socket.IO + Prisma
- `shared/`: tipos de eventos y esquemas zod que usan los dos

## Documentación

| Para quién | Documento |
|---|---|
| Quien dirige el quiz el día del evento | [docs/GUIA-ANFITRION.md](docs/GUIA-ANFITRION.md) |
| Jugadores (hoja imprimible, para niños y mayores) | [docs/COMO-JUGAR.md](docs/COMO-JUGAR.md) |
| Quien escribe las preguntas (incluye el formato CSV) | [docs/CREAR-PREGUNTAS.md](docs/CREAR-PREGUNTAS.md) |
| Desarrolladores | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Ideas pendientes | [docs/ROADMAP.md](docs/ROADMAP.md) |

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
| Jugadores | http://<IP-de-tu-PC>:5173 (misma Wi-Fi), o `/<PIN>` para saltar directo al nombre |
| Base de datos | `pnpm db:studio` |

## Jugar con otros

- **Misma Wi-Fi:** abre `http://<IP-de-tu-PC>:5173/host` y permite el puerto (`sudo ufw allow 5173/tcp`).
- **Desde cualquier red:** con `pnpm dev` corriendo, ejecuta `pnpm tunnel` y abre `https://<algo>.trycloudflare.com/host`.
  El enlace es público y cambia en cada ejecución; ciérralo (Ctrl+C) al terminar.

## Herramientas de prueba

```bash
pnpm test                    # tests unitarios (puntaje, máquina de estados, sesión, CSV)
pnpm bots <PIN> [cantidad]   # llena una partida con bots (avatar, nombre del dado, reacciones, respuestas al azar)
pnpm test:e2e                # partida completa simulada por sockets (con pnpm dev corriendo)
pnpm --filter server test:load 120 --finish   # carga: 120 jugadores (SERVER_URL=… para producción)
pnpm typecheck
```

## Preguntas

| Tipo | Opciones | Correctas | Cómo puntúa |
|---|---|---|---|
| Opción única | 2 a 4 | 1 | acierto = 500 a 1000 pts según rapidez |
| Selección múltiple | 2 a 4 | 1 o más | solo si marca exactamente todas las correctas |
| Verdadero o falso | fijas | 1 | igual que opción única |

Cada pregunta puede llevar una **explicación o versículo** (opcional) que se muestra al revelar la
respuesta, en el proyector y en los celulares.

Cada pregunta puede llevar una imagen. El navegador la reduce (a lo sumo 1600 px, WebP) antes de
subirla y se guarda en Postgres (`Image`), así el despliegue no necesita almacenamiento aparte.
Las imágenes que ya no usa ninguna pregunta se borran solas después de un día.

## Qué más trae

- **Entrada rápida:**
  - El QR lleva a `dominio/<PIN>` y salta directo al nombre.
  - El PIN se valida solo al escribir el 6.º número.
  - En una sola pantalla se elige el dibujo (avatar) y el nombre, o se toca 🎲 para que lo invente.
  - Los nombres repetidos se numeran en vez de dar error.
  - El perfil se recuerda para la próxima vez.
- **Para todas las edades:**
  - Letra más grande en el celular y botón **Letra** para agrandarla más.
  - Opciones con color, figura y letra (A/B/C/D).
  - Textos sencillos y mini tutorial mientras se espera.
  - Resultado con ícono grande ✓ / ✗.
- **Reacciones en vivo** (👏 🙌 🔥 😂 ❤️ 🙏) desde los celulares: suben en burbujas grandes por los bordes
  del proyector, con "×12" cuando muchos mandan la misma, en el lobby, la clasificación y el podio.
- **Diseño tipo Kahoot**: fondo morado, tarjetas blancas, botones 3D, respuestas en rojo/azul/amarillo/verde
  y podio de oro, plata y bronce.
- **Música en el proyector** (alegre en el lobby, de cuenta atrás en cada pregunta), compuesta y sintetizada
  en el navegador: sin archivos ni derechos de autor. Tiene su propio botón para apagarla.
- **Iconos de [Bootstrap Icons](https://icons.getbootstrap.com/)** (`react-bootstrap-icons`) en toda la interfaz.
- **El QR y el enlace corto apuntan a `quizlivee.netlify.app`** en producción (`VITE_PUBLIC_URL` en `netlify.toml`).
- **Confeti** al acertar y en el podio, barra de "ya respondieron" y 🔥 para las rachas.
- **Aviso de "despertando el servidor"** (el plan gratis de Render se duerme).
- **Clave de anfitrión** (`HOST_PASSWORD`): sin ella no se ven ni se tocan los quizzes. Jugar no pide nada.
- **Historial e informe** por partida: aciertos por pregunta, tiempo medio y tabla por jugador. Con un botón
  se crea un quiz de repaso con las preguntas que el grupo falló (menos del 60 % de aciertos).
- **Bonus por racha**: +100 puntos por cada acierto seguido, hasta +500.
- **Flechas** en la clasificación con lo que subió o bajó cada quien.
- **Sonido en la pantalla del anfitrión y vibración en los celulares** (30 teléfonos sonando sería un caos).
- **Teclado**: 1-4 para responder, Enter para enviar en selección múltiple, espacio para avanzar como anfitrión.
- **Importar CSV** en el editor y **jugar otra vez** con los mismos jugadores desde el podio.
- **Límites por IP** contra fuerza bruta de PIN, spam de imágenes e intentos de clave. Para el PIN solo
  cuentan los intentos fallidos: con datos móviles cientos de celulares pueden compartir IP (CGNAT).

## Cómo funciona

(Más detalle en [ARCHITECTURE.md](ARCHITECTURE.md).)

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
