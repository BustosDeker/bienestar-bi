import clsx from 'clsx';
import { type LucideIcon, Languages, LogOut, Search, SunMoon } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ACCESS, logout, useAuth } from '../lib/auth';
import { isDark, useUI } from '../lib/store';
import { NAV } from './nav';

interface Item { id: string; label: string; group: string; icon: LucideIcon; run: () => void }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Buscador de la barra superior: se escribe directamente y muestra páginas y acciones que coinciden. */
export default function SearchBox({ onShortcuts }: { onShortcuts: () => void }) {
  const { t } = useTranslation();
  const go = useNavigate();
  const user = useAuth((s) => s.user)!;
  const set = useUI((s) => s.set);
  const theme = useUI((s) => s.theme);
  const lang = useUI((s) => s.lang);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const showList = open && q.trim().length > 0;
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const items = useMemo<Item[]>(() => {
    const pages = NAV.filter((n) => ACCESS[user.rol].includes(n.to)).map<Item>((n) => ({ id: n.to, label: t(`nav.${n.key}`), group: t('palette.go'), icon: n.icon, run: () => go(n.to) }));
    const actions: Item[] = [
      { id: 'theme', label: t('palette.theme'), group: t('palette.actions'), icon: SunMoon, run: () => set({ theme: isDark(theme) ? 'light' : 'dark' }) },
      { id: 'lang', label: t('palette.lang'), group: t('palette.actions'), icon: Languages, run: () => set({ lang: lang === 'es' ? 'en' : 'es' }) },
      { id: 'keys', label: t('palette.shortcuts'), group: t('palette.actions'), icon: Search, run: onShortcuts },
      { id: 'logout', label: t('auth.logout'), group: t('palette.actions'), icon: LogOut, run: () => { logout(); } },
    ];
    return [...pages, ...actions];
  }, [t, user.rol, theme, lang, go, set, onShortcuts]);

  const results = useMemo(() => {
    const n = norm(q.trim());
    return n ? items.filter((i) => norm(i.label).includes(n)) : [];
  }, [items, q]);

  useEffect(() => { setActive(0); }, [q, open]);
  useEffect(() => {
    const focus = () => { input.current?.focus(); };
    window.addEventListener('focus-search', focus);
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => { window.removeEventListener('focus-search', focus); document.removeEventListener('mousedown', away); };
  }, []);

  const choose = (i?: Item) => {
    if (!i) return;
    setOpen(false); setQ(''); input.current?.blur();
    i.run();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
  };

  return (
    <div ref={box} className="relative min-w-0 flex-1 md:w-52 md:flex-none">
      <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={input}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${results[active].id}` : undefined}
        aria-label={t('palette.search')}
        placeholder={t('palette.placeholder')}
        className="input !pl-9"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onKeyDown={onKey}
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 top-full z-50 mt-1 max-h-[60vh] w-[min(320px,92vw)] overflow-auto rounded-card border border-line bg-surface p-1 shadow-float sm:right-0 sm:left-auto">
          {results.length === 0 && <li className="p-3 text-center text-muted">{t('palette.empty')}</li>}
          {results.map((r, i) => (
            <li key={r.id} role="presentation">
              <div id={`${listId}-${r.id}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(r); }}
                className={clsx('flex min-h-[40px] cursor-pointer items-center gap-2 rounded-ctl px-2 text-body', i === active ? 'bg-line/50' : '')}>
                <r.icon size={16} strokeWidth={1.5} aria-hidden /> {r.label}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
