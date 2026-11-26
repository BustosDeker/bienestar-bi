import { useTranslation } from 'react-i18next';
import { Field, PageHeader, useTitle } from '../components/ui';
import { logout, useAuth } from '../lib/auth';
import { ACCENTS, useUI, type Accent, type Theme } from '../lib/store';

export default function Settings() {
  const { t } = useTranslation();
  useTitle(t('nav.settings'));
  const s = useUI();
  const user = useAuth((x) => x.user);
  const seg = <T extends string>(value: T, opts: T[], onChange: (v: T) => void, label: (v: T) => string, name: string) => (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1">
      {opts.map((o) => <button key={o} role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={`btn ${value === o ? 'btn-primary' : ''}`}>{label(o)}</button>)}
    </div>
  );
  return (
    <div className="space-y-4">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-4">
          <h2 className="text-section">{t('settings.appearance')}</h2>
          <Field label={t('settings.language')}>{seg(s.lang, ['es', 'en'], (v) => s.set({ lang: v }), (v) => (v === 'es' ? 'Español' : 'English'), t('settings.language'))}</Field>
          <Field label={t('settings.themeLabel')}>{seg<Theme>(s.theme, ['light', 'dark', 'system'], (v) => s.set({ theme: v }), (v) => t(`settings.theme.${v}`), t('settings.themeLabel'))}</Field>
          <Field label={t('settings.accentLabel')}>
            <div role="radiogroup" aria-label={t('settings.accentLabel')} className="flex gap-2">
              {(Object.keys(ACCENTS) as Accent[]).map((a) => (
                <button key={a} role="radio" aria-checked={s.accent === a} aria-label={t(`settings.accent.${a}`)} title={t(`settings.accent.${a}`)} onClick={() => s.set({ accent: a })}
                  className={`touch rounded-full border-2 ${s.accent === a ? 'border-fg' : 'border-transparent'}`}><span className="block h-7 w-7 rounded-full" style={{ background: ACCENTS[a].light }} /></button>
              ))}
            </div>
          </Field>
          <Field label={t('settings.densityLabel')}>{seg(s.density, ['comfortable', 'compact'], (v) => s.set({ density: v }), (v) => t(`settings.density.${v}`), t('settings.densityLabel'))}</Field>
        </section>
        <section className="card space-y-4">
          <h2 className="text-section">{t('settings.demo')}</h2>
          <Field label={t('settings.k', { k: s.k })} hint={t('settings.kHint')}>
            <input type="range" min={1} max={20} value={s.k} onChange={(e) => s.set({ k: Number(e.target.value) })} className="w-full accent-[var(--accent-strong)]" aria-valuetext={`k = ${s.k}`} />
          </Field>
          <div className="flex flex-wrap gap-2">
          </div>
        </section>
        <section className="card md:col-span-2">
          <h2 className="mb-2 text-section">{t('auth.account')}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-body">{t('auth.signedAs')} <b>{user?.rol === 'estudiante' ? user.username : user ? t(`login.role.${user.rol}`) : ''}</b> · {user ? t(`login.role.${user.rol}`) : ''}</p>
            <button className="btn" onClick={logout}>{t('auth.logout')}</button>
          </div>
        </section>
        <section className="card md:col-span-2">
          <h2 className="mb-2 text-section">{t('palette.shortcuts')}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr_auto_1fr]">
            {[['Ctrl/⌘ + K', t('palette.title')], ['T', t('palette.theme')], ['L', t('palette.lang')], ['?', t('palette.shortcuts')]].map(([k, d]) => (
              <div className="contents" key={k}><dt><kbd className="rounded border border-line bg-bg px-2 py-0.5 text-label">{k}</kbd></dt><dd>{d}</dd></div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
