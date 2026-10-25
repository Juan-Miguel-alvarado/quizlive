import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router';
import './index.css';
import Home from './pages/Home';
import PlayerGame from './pages/play/PlayerGame';

/** Ruta corta para unirse (/482913): es la del link que comparte el moderador y la más fácil de dictar. */
function JoinByPin() {
  const { pin = '' } = useParams();
  return /^\d{6}$/.test(pin) ? <Home key={pin} /> : <Navigate to="/" replace />;
}

// Detecta la etiqueta "Powered by Netlify" para reservarle espacio (ver --badge-space en index.css).
const badgeObserver = new MutationObserver(() => {
  if (!document.getElementById('nl-badge-frame')) return;
  document.documentElement.setAttribute('data-netlify-badge', '');
  badgeObserver.disconnect();
});
badgeObserver.observe(document.body, { childList: true, subtree: true });

// Las pantallas del anfitrión se descargan aparte: los jugadores (con datos móviles) no las bajan.
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  {
    path: '/host',
    lazy: page(() => import('./pages/host/HostGate')),
    children: [
      { index: true, lazy: page(() => import('./pages/host/QuizList')) },
      { path: 'quizzes/new', lazy: page(() => import('./pages/host/QuizEditor')) },
      { path: 'quizzes/:id', lazy: page(() => import('./pages/host/QuizEditor')) },
      { path: 'game/:pin', lazy: page(() => import('./pages/host/Moderator')) },
      { path: 'history', lazy: page(() => import('./pages/host/HistoryList')) },
      { path: 'history/:id', lazy: page(() => import('./pages/host/GameReport')) },
    ],
  },
  { path: '/play', element: <PlayerGame /> },
  // Pantalla TV (solo mira). Pública: no muestra nada que el público no vaya a ver igualmente.
  { path: '/tv/:pin', lazy: page(() => import('./pages/tv/TvScreen')) },
  { path: '/:pin', element: <JoinByPin /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
