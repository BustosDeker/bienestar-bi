import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { loadSession, useAuth } from '../lib/auth';
import { isDark, useUI } from '../lib/store';

/** Raíz de la app: idioma, tema, densidad y carga de la sesión (también para la pantalla de ingreso). */
export default function Root() {
  const { i18n } = useTranslation();
  const lang = useUI((s) => s.lang);
  const theme = useUI((s) => s.theme);
  const accent = useUI((s) => s.accent);
  const density = useUI((s) => s.density);
  const ready = useAuth((s) => s.ready);

  useEffect(() => { loadSession(); }, []);
  useEffect(() => { i18n.changeLanguage(lang); document.documentElement.lang = lang; }, [lang, i18n]);
  useEffect(() => {
    const apply = () => {
      const d = isDark(theme);
      document.documentElement.classList.add('theme-anim');
      document.documentElement.classList.toggle('dark', d);
      document.documentElement.classList.toggle('density-compact', density === 'compact');
      import('../lib/accent').then((m) => m.applyAccent(accent, d));
      setTimeout(() => document.documentElement.classList.remove('theme-anim'), 250);
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, accent, density]);

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-section text-muted" role="status">Bienestar</div>;
  return <Outlet />;
}
