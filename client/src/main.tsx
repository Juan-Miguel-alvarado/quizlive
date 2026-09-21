import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import './index.css';
import Home from './pages/Home';
import HostGame from './pages/host/HostGame';
import QuizEditor from './pages/host/QuizEditor';
import QuizList from './pages/host/QuizList';
import PlayerGame from './pages/play/PlayerGame';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/host', element: <QuizList /> },
  { path: '/host/quizzes/new', element: <QuizEditor /> },
  { path: '/host/quizzes/:id', element: <QuizEditor /> },
  { path: '/host/game/:pin', element: <HostGame /> },
  { path: '/play', element: <PlayerGame /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
