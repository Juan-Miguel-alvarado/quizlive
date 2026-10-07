/**
 * Música de fondo de la pantalla TV: la canción que eligió el usuario (`public/music/fondo.mp3`),
 * en bucle en el lobby y durante las preguntas. Al pausarse (revelar, tabla…) recuerda por dónde iba
 * y sigue desde ahí. Solo la TV la descarga (~2 MB): los celulares nunca la piden.
 */
import { getAudioContext } from './sound';

export type SongName = 'lobby' | 'question';

const KEY = 'quizlive:music';
const SRC = '/music/fondo.mp3';
const MASTER_GAIN = 0.45; // no debe tapar a quien dirige el juego
const FADE_S = 0.4;

let enabled = true;
try {
  enabled = localStorage.getItem(KEY) !== '0';
} catch {
  /* sin localStorage queda encendida */
}

let wanted: SongName | null = null; // lo que pide la fase actual, suene o no
let playing = false;
let buffer: AudioBuffer | null = null;
let loading: Promise<AudioBuffer> | null = null;
let source: AudioBufferSourceNode | null = null;
let master: GainNode | null = null;
let offset = 0; // segundos ya sonados de la canción
let startedAt = 0; // ctx.currentTime al empezar el tramo actual

function load(ctx: AudioContext) {
  loading ??= fetch(SRC)
    .then((r) => r.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .then((b) => (buffer = b))
    .catch((err) => {
      loading = null; // se reintenta la próxima vez
      throw err;
    });
  return loading;
}

async function start() {
  const ctx = getAudioContext();
  playing = true;
  const song = buffer ?? (await load(ctx).catch(() => null));
  // Mientras bajaba, la fase pudo cambiar a silencio.
  if (!song || !playing || source) return;
  master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(MASTER_GAIN, ctx.currentTime + FADE_S);
  master.connect(ctx.destination);
  source = ctx.createBufferSource();
  source.buffer = song;
  source.loop = true;
  source.connect(master);
  // Sin gesto todavía, el contexto está suspendido: currentTime no avanza y empieza al desbloquearse.
  source.start(0, offset % song.duration);
  startedAt = ctx.currentTime;
}

/** Fundido corto y pausa, guardando por dónde iba. */
function stopNow() {
  playing = false;
  const oldSource = source;
  const oldMaster = master;
  source = null;
  master = null;
  if (!oldSource || !oldMaster) return;
  try {
    const ctx = getAudioContext();
    offset += ctx.currentTime - startedAt;
    if (buffer) offset %= buffer.duration;
    oldMaster.gain.cancelScheduledValues(ctx.currentTime);
    oldMaster.gain.setValueAtTime(Math.max(oldMaster.gain.value, 0.0001), ctx.currentTime);
    oldMaster.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + FADE_S);
    oldSource.stop(ctx.currentTime + FADE_S + 0.05);
    setTimeout(() => oldMaster.disconnect(), FADE_S * 1000 + 200);
  } catch {
    /* sin WebAudio no hay nada que parar */
  }
}

export const music = {
  get enabled() {
    return enabled;
  },
  /** Pide música (o silencio). Si la música está apagada, se recuerda para cuando se encienda. */
  play(name: SongName | null) {
    wanted = name;
    if (!enabled || !!name === playing) return;
    try {
      if (name) void start();
      else stopNow();
    } catch {
      /* navegador sin WebAudio: el juego sigue igual */
    }
  },
  stop() {
    this.play(null);
  },
  toggle(): boolean {
    enabled = !enabled;
    try {
      localStorage.setItem(KEY, enabled ? '1' : '0');
    } catch {
      /* dura lo que la pestaña */
    }
    if (enabled) {
      const name = wanted;
      wanted = null;
      this.play(name);
    } else {
      stopNow();
    }
    return enabled;
  },
  /** true mientras el navegador no deje sonar nada porque todavía no hubo un clic o una tecla. */
  needsGesture(): boolean {
    try {
      return getAudioContext().state !== 'running';
    } catch {
      return false;
    }
  },
};
