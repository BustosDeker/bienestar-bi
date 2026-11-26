import { ChevronDown, LogOut, Settings2, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { logout, useAuth } from '../lib/auth';

/** Menú del perfil: abre «Ajustes» y «Cerrar sesión» para ahorrar espacio en la barra superior. */
export default function UserMenu() {
  const { t } = useTranslation();
  const go = useNavigate();
  const user = useAuth((s) => s.user)!;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const id = useId();
  const name = user.rol === 'estudiante' ? user.username : t(`login.role.${user.rol}`);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); (box.current?.querySelector('button') as HTMLElement | null)?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const item = 'flex min-h-[40px] w-full items-center gap-2 rounded-ctl px-2 text-left text-body text-fg hover:bg-line/50 focus-visible:bg-line/50';
  return (
    <div ref={box} className="relative" data-testid="user-menu">
      <button className="btn" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} aria-label={t('auth.menu', { name })}>
        <UserRound size={16} strokeWidth={1.5} aria-hidden />
        <span className="hidden max-w-[140px] truncate md:inline">{name}</span>
        <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div id={id} role="menu" className="absolute right-0 top-full z-50 mt-1 w-56 rounded-card border border-line bg-surface p-1 shadow-float">
          <div className="px-2 pb-1 pt-1.5">
            <p className="truncate text-body font-medium">{name}</p>
            <p className="text-label text-muted">{t(`login.role.${user.rol}`)}</p>
          </div>
          <div className="my-1 h-px bg-line" role="separator" />
          <button ref={first} role="menuitem" className={item} onClick={() => { setOpen(false); go('/ajustes'); }}>
            <Settings2 size={16} strokeWidth={1.5} aria-hidden /> {t('nav.settings')}
          </button>
          <button role="menuitem" className={item} onClick={() => { setOpen(false); logout(); }}>
            <LogOut size={16} strokeWidth={1.5} aria-hidden /> {t('auth.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
