import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import Root from './components/Root';
import { Loading } from './components/ui';
import './i18n';
import './index.css';
import Login from './pages/Login';
import Overview from './pages/Overview';

const lz = (f: () => Promise<{ default: React.ComponentType }>) => { const C = lazy(f); return <Suspense fallback={<Loading rows={4} />}><C /></Suspense>; };

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/login', element: <Login /> },
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Overview /> },
          { path: '/reportes', element: lz(() => import('./pages/Reports')) },
          { path: '/explorador', element: lz(() => import('./pages/Explorer')) },
          { path: '/drivers', element: lz(() => import('./pages/Drivers')) },
          { path: '/mi-bienestar', element: lz(() => import('./pages/Student')) },
          { path: '/coach', element: lz(() => import('./pages/Coach')) },
          { path: '/etl', element: lz(() => import('./pages/Etl')) },
          { path: '/ajustes', element: lz(() => import('./pages/Settings')) },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>,
);
