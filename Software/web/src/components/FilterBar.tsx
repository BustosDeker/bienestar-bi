import { Filter, RotateCcw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { useMeta } from '../lib/hooks';
import { useUI } from '../lib/store';
import SearchBox from './SearchBox';
import UserMenu from './UserMenu';
import { Sheet } from './ui';

function Selects({ stacked }: { stacked?: boolean }) {
  const { t } = useTranslation();
  const { data: meta } = useMeta();
  const f = useUI((s) => s.filters);
  const setFilters = useUI((s) => s.setFilters);
  const sel = (id: string, label: string, value: string | undefined, onChange: (v: string) => void, opts: [string, string][]) => (
    <label className={stacked ? 'block' : 'flex items-center gap-2'}>
      <span className={stacked ? 'label mb-1 block' : 'sr-only'}>{label}</span>
      <select id={id} className="input !min-h-[36px] !w-auto min-w-[112px] max-w-[180px] truncate" value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{label}</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  const escuelas = f.facultad ? meta?.escuelas[f.facultad] ?? [] : Object.values(meta?.escuelas ?? {}).flat();
  return (
    <div className={stacked ? 'space-y-3' : 'flex flex-wrap items-center gap-2'}>
      {sel('f-facultad', t('filters.faculty'), f.facultad, (v) => setFilters({ facultad: v || undefined }), (meta?.facultades ?? []).map((x) => [x, x]))}
      {sel('f-escuela', t('filters.school'), f.escuela, (v) => setFilters({ escuela: v || undefined }), escuelas.map((x) => [x, x]))}
      {sel('f-sexo', t('filters.sex'), f.sexo, (v) => setFilters({ sexo: (v || undefined) as 'F' | 'M' | undefined }), [['F', t('common.female')], ['M', t('common.male')]])}
      {sel('f-edad', t('filters.age'), f.rangoEdad, (v) => setFilters({ rangoEdad: v || undefined }), (meta?.rangosEdad ?? []).map((x) => [x, x]))}
      {sel('f-ola', t('filters.wave'), f.ola ? String(f.ola) : undefined, (v) => setFilters({ ola: v ? Number(v) : undefined }), (meta?.olas ?? []).map((o) => [String(o.numero), `${t('common.wave')} ${o.numero}`]))}
    </div>
  );
}

export default function FilterBar({ onShortcuts }: { onShortcuts: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const user = useAuth((s) => s.user)!;
  const f = useUI((s) => s.filters);
  const k = useUI((s) => s.k);
  const reset = useUI((s) => s.resetFilters);
  const active = Object.keys(f).length;
  const showFilters = user.rol === 'bienestar';
  return (
    <div data-testid="topbar" className="chrome sticky top-0 z-30 flex min-h-14 flex-nowrap items-center gap-2 md:flex-wrap border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
      {showFilters && <div className="hidden min-w-0 flex-1 md:block"><Selects /></div>}
      {showFilters && (
        <button className="btn md:hidden" onClick={() => setOpen(true)} aria-label={t('filters.title')}>
          <Filter size={16} strokeWidth={1.5} /> <span className="hidden min-[420px]:inline">{t('filters.title')}</span>{active ? ` (${active})` : ''}
        </button>
      )}
      {!showFilters && <div className="hidden flex-1 md:block" />}
      {showFilters && active > 0 && (
        <button className="btn-ghost btn" onClick={reset}><RotateCcw size={14} strokeWidth={1.5} /> <span className="hidden sm:inline">{t('filters.reset')}</span></button>
      )}
      <SearchBox onShortcuts={onShortcuts} />
      {showFilters && (
        <span className="hidden items-center gap-1 rounded-full border border-line px-2 py-1 text-label text-muted 2xl:inline-flex" title={t('filters.kHint', { k })}>
          <ShieldCheck size={14} strokeWidth={1.5} aria-hidden /> k={k}
        </span>
      )}
      <UserMenu />
      <Sheet open={open} onOpenChange={setOpen} title={t('filters.title')} side="bottom">
        <Selects stacked />
        <div className="mt-4 flex gap-2"><button className="btn btn-primary flex-1" onClick={() => setOpen(false)}>{t('common.apply')}</button><button className="btn" onClick={reset}>{t('filters.reset')}</button></div>
      </Sheet>
    </div>
  );
}
