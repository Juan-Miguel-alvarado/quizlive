/**
 * Música de fondo para la pantalla del anfitrión, al estilo Kahoot: una alegre en el lobby y otra
 * de tensión durante la pregunta. Composición propia, sintetizada con WebAudio (sin archivos ni
 * derechos de autor). Los celulares nunca la reproducen.
 */
import { getAudioContext } from './sound';

export type SongName = 'lobby' | 'question';

const KEY = 'quizlive:music';
const MASTER_GAIN = 0.32; // bajo: no debe tapar a quien dirige el juego
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const FADE_S = 0.3;
const STEPS_PER_BAR = 16; // semicorcheas

interface Song {
  bpm: number;
  /** Un acorde por compás (notas MIDI); el primero es la fundamental del bajo. */
  chords: number[][];
  kick: number[];
  snare: number[];
  hat: number[];
  hatGain: number;
  bass: number[];
  /** Pasos donde suena el arpegio; recorre las notas del acorde una octava arriba. */
  arp: number[];
}

const SONGS: Record<SongName, Song> = {
  // Do mayor, I–V–vi–IV: alegre y fácil de escuchar en bucle mientras la gente entra.
  lobby: {
    bpm: 118,
    chords: [
      [48, 64, 67, 72],
      [43, 62, 67, 71],
      [45, 64, 69, 72],
      [41, 65, 69, 72],
    ],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
    hatGain: 0.25,
    bass: [0, 3, 6, 8, 11, 14],
    arp: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  // La menor, más rápida y con hi-hat constante: la cuenta atrás de la pregunta.
  question: {
    bpm: 150,
    chords: [
      [45, 69, 72, 76],
      [45, 69, 72, 76],
      [41, 69, 72, 77],
      [40, 68, 71, 76],
    ],
    kick: [0, 8],
    snare: [4, 12],
    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    hatGain: 0.12,
    bass: [0, 2, 4, 6, 8, 10, 12, 14],
    arp: [0, 3, 6, 9, 12],
  },
};

let enabled = true;
try {
  enabled = localStorage.getItem(KEY) !== '0';
} catch {
  /* sin localStorage queda encendida */
}

let wanted: SongName | null = null; // lo que pide la fase actual, suene o no
let playing: SongName | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let nextStepTime = 0;
let step = 0;
let noise: AudioBuffer | null = null;

const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

function noiseBuffer(ctx: AudioContext) {
  if (noise) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

function envelope(ctx: AudioContext, out: AudioNode, at: number, peak: number, decay: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  gain.connect(out);
  return gain;
}

function tone(ctx: AudioContext, out: AudioNode, type: OscillatorType, freq: number, at: number, peak: number, decay: number) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(envelope(ctx, out, at, peak, decay));
  osc.start(at);
  osc.stop(at + decay + 0.02);
}

function kick(ctx: AudioContext, out: AudioNode, at: number) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
  osc.connect(envelope(ctx, out, at, 1, 0.25));
  osc.start(at);
  osc.stop(at + 0.27);
}

function noiseHit(ctx: AudioContext, out: AudioNode, at: number, cutoff: number, peak: number, decay: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = cutoff;
  src.connect(filter).connect(envelope(ctx, out, at, peak, decay));
  src.start(at);
  src.stop(at + decay + 0.02);
}

function scheduleStep(ctx: AudioContext, out: AudioNode, song: Song, index: number, at: number) {
  const s = index % STEPS_PER_BAR;
  const chord = song.chords[Math.floor(index / STEPS_PER_BAR) % song.chords.length]!;
  const stepLen = 60 / song.bpm / 4;
  if (song.kick.includes(s)) kick(ctx, out, at);
  if (song.snare.includes(s)) noiseHit(ctx, out, at, 1500, 0.35, 0.14);
  if (song.hat.includes(s)) noiseHit(ctx, out, at, 7000, song.hatGain, 0.04);
  if (song.bass.includes(s)) tone(ctx, out, 'triangle', midiToFreq(chord[0]!), at, 0.55, stepLen * 1.6);
  const arpIndex = song.arp.indexOf(s);
  if (arpIndex >= 0) {
    const notes = chord.slice(1);
    tone(ctx, out, 'square', midiToFreq(notes[arpIndex % notes.length]!), at, 0.09, stepLen * 1.2);
  }
}

function start(name: SongName) {
  const ctx = getAudioContext();
  stopNow();
  const song = SONGS[name];
  master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(MASTER_GAIN, ctx.currentTime + FADE_S);
  master.connect(ctx.destination);
  const out = master;
  playing = name;
  step = 0;
  nextStepTime = ctx.currentTime + 0.05;
  timer = setInterval(() => {
    // Mientras el navegador no deje sonar (sin gesto todavía) no se acumulan notas atrasadas.
    if (ctx.state !== 'running') {
      nextStepTime = ctx.currentTime + 0.05;
      return;
    }
    while (nextStepTime < ctx.currentTime + LOOKAHEAD_S) {
      scheduleStep(ctx, out, song, step, nextStepTime);
      nextStepTime += 60 / song.bpm / 4;
      step = (step + 1) % (STEPS_PER_BAR * song.chords.length);
    }
  }, TICK_MS);
}

/** Corta con un fundido corto; las notas ya programadas se apagan con el volumen. */
function stopNow() {
  clearInterval(timer);
  timer = undefined;
  playing = null;
  const old = master;
  master = null;
  if (!old) return;
  try {
    const ctx = getAudioContext();
    old.gain.cancelScheduledValues(ctx.currentTime);
    old.gain.setValueAtTime(Math.max(old.gain.value, 0.0001), ctx.currentTime);
    old.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + FADE_S);
    setTimeout(() => old.disconnect(), FADE_S * 1000 + 100);
  } catch {
    /* sin WebAudio no hay nada que parar */
  }
}

export const music = {
  get enabled() {
    return enabled;
  },
  /** Pide una canción (o silencio). Si la música está apagada, se recuerda para cuando se encienda. */
  play(name: SongName | null) {
    wanted = name;
    if (!enabled || name === playing) return;
    try {
      if (name) start(name);
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
