import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import './index.css';
import Home from './pages/Home';
import GameReportPage from './pages/host/GameReport';
import HistoryList from './pages/host/HistoryList';
import HostGame from './pages/host/HostGame';
import HostGate from './pages/host/HostGate';
import QuizEditor from './pages/host/QuizEditor';
import QuizList from './pages/host/QuizList';
import PlayerGame from './pages/play/PlayerGame';

// Detecta la etiqueta "Powered by Netlify" para reservarle espacio (ver --badge-space en index.css).
const badgeObserver = new MutationObserver(() => {
  if (!document.getElementById('nl-badge-frame')) return;
  document.documentElement.setAttribute('data-netlify-badge', '');
  badgeObserver.disconnect();
});
badgeObserver.observe(document.body, { childList: true, subtree: true });

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  {
    path: '/host',
    element: <HostGate />,
    children: [
      { index: true, element: <QuizList /> },
      { path: 'quizzes/new', element: <QuizEditor /> },
      { path: 'quizzes/:id', element: <QuizEditor /> },
      { path: 'game/:pin', element: <HostGame /> },
      { path: 'history', element: <HistoryList /> },
      { path: 'history/:id', element: <GameReportPage /> },
    ],
  },
  { path: '/play', element: <PlayerGame /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
