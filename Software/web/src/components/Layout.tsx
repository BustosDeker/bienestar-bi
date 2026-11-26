import clsx from 'clsx';
import { ChevronsLeft, ChevronsRight, CloudOff, MoreHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ACCESS, canOpen, homeOf, useAuth, type User } from '../lib/auth';
import { isDark, useUI } from '../lib/store';
import FilterBar from './FilterBar';
import { NAV } from './nav';
import { Modal, Sheet, Toaster } from './ui';

export { NAV };

function useGlobalActions() {
  const set = useUI((s) => s.set);
  const lang = useUI((s) => s.lang);
  const theme = useUI((s) => s.theme);
  return {
    toggleTheme: () => set({ theme: isDark(theme) ? 'light' : 'dark' }),
    toggleLang: () => set({ lang: lang === 'es' ? 'en' : 'es' }),
  };
}

export function Shortcuts({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const { t } = useTranslation();
  const rows: [string, string][] = [['Ctrl/⌘ + K', t('palette.focus')], ['T', t('palette.theme')], ['L', t('palette.lang')], ['?', t('palette.shortcuts')]];
  return (
    <Modal open={open} onOpenChange={setOpen} title={t('palette.shortcuts')}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        {rows.map(([k, d]) => (<div key={k} className="contents"><dt><kbd className="rounded border border-line bg-bg px-2 py-0.5 text-label">{k}</kbd></dt><dd>{d}</dd></div>))}
      </dl>
    </Modal>
  );
}

/** Guarda de acceso: exige sesión y que la ruta sea de módulos permitidos para el rol. */
export default function Layout() {
  const user = useAuth((s) => s.user);
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (!canOpen(user.rol, loc.pathname)) return <Navigate to={homeOf(user.rol)} replace />;
  return <Shell user={user} />;
}

function Shell({ user }: { user: User }) {
  const { t } = useTranslation();
  const loc = useLocation();
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const demo = useUI((s) => s.demo);
  const set = useUI((s) => s.set);
  const [more, setMore] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const act = useGlobalActions();

  const nav = NAV.filter((n) => ACCESS[user.rol].includes(n.to) && !n.hidden);
  const mobileMain = nav.slice(0, 4);
  const mobileRest = nav.filter((n) => !mobileMain.some((m) => m.to === n.to));

  useEffect(() => { setMore(false); }, [loc.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); window.dispatchEvent(new Event('focus-search')); return; }
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (e.target as HTMLElement)?.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 't' || e.key === 'T') act.toggleTheme();
      else if (e.key === 'l' || e.key === 'L') act.toggleLang();
      else if (e.key === '?') setShortcuts(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[80] focus:rounded-ctl focus:bg-surface focus:p-2">{t('common.skip')}</a>
      {/* Barra lateral (escritorio) */}
      <aside className={clsx('chrome sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface md:flex', collapsed ? 'w-16' : 'w-[232px]')}>
        <div className="flex h-14 items-center gap-2 px-4">
          <img src="/icon.svg" alt="" className="h-7 w-7 rounded-lg" />
          {!collapsed && <span className="text-section">{t('app.name')}</span>}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2" aria-label={t('nav.main')}>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} title={collapsed ? t(`nav.${n.key}`) : undefined}
              className={({ isActive }) => clsx('flex min-h-[40px] items-center gap-3 rounded-ctl px-3 text-body', isActive ? 'bg-accent/10 font-medium text-accent-strong' : 'text-muted hover:bg-line/50 hover:text-fg')}>
              <n.icon size={18} strokeWidth={1.5} aria-hidden /> {!collapsed && t(`nav.${n.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-2">
          <button className="btn-ghost btn w-full justify-start" onClick={() => set({ sidebarCollapsed: !collapsed })} aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}>
            {collapsed ? <ChevronsRight size={16} strokeWidth={1.5} /> : <><ChevronsLeft size={16} strokeWidth={1.5} /> {t('nav.collapse')}</>}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <FilterBar onShortcuts={() => setShortcuts(true)} />
        {(demo || user.demo) && (
          <div role="status" className="chrome flex items-center gap-2 bg-warn/15 px-4 py-2 text-label text-warn-t">
            <CloudOff size={14} aria-hidden /> {t('demo.banner')}
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-content px-4 pb-24 pt-5 md:px-6 md:pb-10" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (móvil) */}
      <nav className="chrome fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" style={{ gridTemplateColumns: `repeat(${mobileMain.length + (mobileRest.length ? 1 : 0)}, minmax(0, 1fr))` }} aria-label={t('nav.main')}>
        {mobileMain.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => clsx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px]', isActive ? 'text-accent-strong' : 'text-muted')}>
            <n.icon size={20} strokeWidth={1.5} aria-hidden /> <span>{t(`nav.${n.key}`)}</span>
          </NavLink>
        ))}
        {mobileRest.length > 0 && <button className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] text-muted" onClick={() => setMore(true)}>
          <MoreHorizontal size={20} strokeWidth={1.5} aria-hidden /> <span>{t('nav.more')}</span>
        </button>}
      </nav>
      <Sheet open={more} onOpenChange={setMore} title={t('nav.more')} side="bottom">
        <div className="grid grid-cols-2 gap-2">
          {mobileRest.map((n) => (
            <NavLink key={n.to} to={n.to} className="btn justify-start touch"><n.icon size={18} strokeWidth={1.5} aria-hidden /> {t(`nav.${n.key}`)}</NavLink>
          ))}
        </div>
      </Sheet>

      <Shortcuts open={shortcuts} setOpen={setShortcuts} />
      <Toaster />
    </div>
  );
}
