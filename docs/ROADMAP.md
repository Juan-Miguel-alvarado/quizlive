# Ideas para más adelante

Cosas que se pensaron y quedaron fuera, ordenadas de más a menos útil para el uso en la iglesia.

Del spec de la trivia (v2) ya están hechos la música y las animaciones (el QR en la TV se hizo y luego se
quitó a pedido, para que solo entre el grupo elegido). Quedan:
imágenes en las opciones, importar directo desde Word/Excel (hoy se pega el texto), exportar resultados
y varias partidas en paralelo (técnicamente ya se puede: cada partida tiene su PIN).

## Modo equipos / familias
Que el anfitrión defina de 2 a 6 equipos (por ejemplo "Jóvenes", "Adultos", "Familia Pérez") y cada
jugador elija uno al entrar. La clasificación sumaría el promedio del equipo, no la suma, para que un
equipo grande no gane solo por ser grande.
Toca `Game` (equipo por jugador y ranking por equipo), `playerJoinSchema` (campo opcional
`team`), el editor de la trivia o la pantalla de abrir sala, y `Leaderboard`/`Podium`.

## Servidor que no se duerma
El plan gratis de Render duerme el servidor. Para uso semanal conviene su plan *Starter*. (La base de
datos ya está en Neon gratis, que no caduca).

## Avance automático
Opción "modo automático": revelar, mostrar la clasificación y pasar a la siguiente pregunta sin tocar
nada, con pausas fijas. Útil si quien dirige también está hablando.

## Más tipos de pregunta
- **Ordenar** (poner 4 eventos en orden cronológico).
- **Escribir la respuesta** (comparación sin mayúsculas ni tildes).
- **Encuesta sin respuesta correcta** ("¿Qué historia te gusta más?"), sin puntos.

## Pantalla de "jugador destacado"
Al final, además del podio: la persona más rápida, la racha más larga, el mejor de los que entraron
tarde… Da protagonismo a más gente que solo el top 3.

## Varias instancias del servidor
Hoy todo vive en un proceso (partidas y límites por IP en memoria). Para escalar a varias instancias
haría falta Redis (adaptador de Socket.IO y límites compartidos). Con 200 jugadores por partida no hace
falta.
