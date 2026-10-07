/**
 * Efectos de sonido generados con WebAudio (sin archivos que descargar).
 * Suenan solo en la pantalla del anfitrión; los celulares vibran (ver `buzz`).
 */
let ctx: AudioContext | null = null;
let muted = false;

/** Contexto de audio compartido con la música (lib/music.ts): un solo desbloqueo para los dos. */
export function getAudioContext(): AudioContext {
  ctx ??= new AudioContext();
  return ctx;
}

try {
  muted = localStorage.getItem('quizlive:muted') === '1';
} catch {
  /* sin localStorage se queda con el sonido activado */
}

export const sound = {
  get muted() {
    return muted;
  },
  toggleMuted() {
    muted = !muted;
    try {
      localStorage.setItem('quizlive:muted', muted ? '1' : '0');
    } catch {
      /* da igual: la preferencia dura lo que la pestaña */
    }
    return muted;
  },
  /**
   * Los navegadores exigen un gesto del usuario antes de dejar sonar nada. Se desbloquea aunque los
   * efectos estén silenciados, porque la música usa el mismo contexto.
   */
  unlock() {
    try {
      void getAudioContext().resume();
    } catch {
      /* navegador sin WebAudio */
    }
  },
  tick: () => beep([{ freq: 880, at: 0, dur: 0.06, gain: 0.12 }]),
  questionStart: () => beep([{ freq: 660, at: 0, dur: 0.12 }, { freq: 990, at: 0.1, dur: 0.16 }]),
  countdown: () => beep([{ freq: 520, at: 0, dur: 0.1 }, { freq: 520, at: 0.18, dur: 0.1 }, { freq: 780, at: 0.36, dur: 0.22 }]),
  correct: () => beep([{ freq: 523, at: 0, dur: 0.1 }, { freq: 659, at: 0.09, dur: 0.1 }, { freq: 784, at: 0.18, dur: 0.24 }]),
  wrong: () => beep([{ freq: 200, at: 0, dur: 0.18, type: 'sawtooth', gain: 0.1 }, { freq: 150, at: 0.16, dur: 0.26, type: 'sawtooth', gain: 0.1 }]),
  fanfare: () =>
    beep([
      { freq: 523, at: 0, dur: 0.14 },
      { freq: 659, at: 0.14, dur: 0.14 },
      { freq: 784, at: 0.28, dur: 0.14 },
      { freq: 1047, at: 0.42, dur: 0.5 },
    ]),
};

interface Note {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

function beep(notes: Note[]) {
  if (muted) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + n.at;
      osc.type = n.type ?? 'triangle';
      osc.frequency.value = n.freq;
      // Subida y bajada suaves: sin esto se oye un chasquido en cada nota.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(n.gain ?? 0.16, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + n.dur + 0.02);
    }
  } catch {
    /* si el navegador no deja sonar, el juego sigue igual */
  }
}

/** Vibración del celular; en escritorio no hace nada. */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignorado */
  }
}
