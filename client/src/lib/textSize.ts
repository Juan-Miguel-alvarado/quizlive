/** Letra grande para el celular (botón «Letra»): se guarda y se aplica como atributo en <html>. */
const KEY = 'quizlive:big-text';

function apply(big: boolean) {
  document.documentElement.toggleAttribute('data-big-text', big);
}

export const textSize = {
  get big() {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  },
  /** Se llama al arrancar la app para respetar la preferencia guardada. */
  init() {
    apply(this.big);
  },
  toggle(): boolean {
    const big = !document.documentElement.hasAttribute('data-big-text');
    apply(big);
    try {
      localStorage.setItem(KEY, big ? '1' : '0');
    } catch {
      /* dura lo que la pestaña */
    }
    return big;
  },
};
