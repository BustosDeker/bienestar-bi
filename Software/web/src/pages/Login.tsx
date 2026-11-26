import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { Field, useTitle } from '../components/ui';
import { homeOf, login, useAuth } from '../lib/auth';
import { useUI } from '../lib/store';

const SHOW_HINT = import.meta.env.VITE_DEMO_HINT !== 'false';

export default function Login() {
  const { t } = useTranslation();
  useTitle(t('login.title'));
  const user = useAuth((s) => s.user);
  const lang = useUI((s) => s.lang);
  const set = useUI((s) => s.set);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeOf(user.rol)} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await login(u.trim(), p);
    setBusy(false);
    if (r) setErr(r === 'offline' ? t('error.offline') : r);
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/icon.svg" alt="" className="h-12 w-12 rounded-xl" />
          <h1 className="text-title">{t('login.title')}</h1>
          <p className="text-body text-muted">{t('login.subtitle')}</p>
        </div>
        <form onSubmit={submit} className="card space-y-4" aria-describedby={err ? 'login-err' : undefined}>
          <Field label={t('login.user')}>
            <input className="input" autoComplete="username" autoFocus value={u} onChange={(e) => setU(e.target.value)} required aria-invalid={!!err} />
          </Field>
          <Field label={t('login.password')}>
            <div className="relative">
              <input className="input !pr-11" type={show ? 'text' : 'password'} autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required aria-invalid={!!err} />
              <button type="button" className="absolute right-0 top-0 inline-flex h-full w-11 items-center justify-center text-muted hover:text-fg" onClick={() => setShow((x) => !x)} aria-label={show ? t('login.hide') : t('login.show')}>
                {show ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </div>
          </Field>
          {err && <p id="login-err" role="alert" className="text-label text-bad-t">{err}</p>}
          <button className="btn btn-primary w-full" disabled={busy || !u || !p}><LogIn size={16} strokeWidth={1.5} /> {busy ? t('login.signing') : t('login.submit')}</button>
        </form>
        {SHOW_HINT && (
          <div className="mt-4 rounded-card border border-line bg-surface p-3 text-label text-muted" aria-label={t('login.demoTitle')}>
            <p className="mb-1 font-medium text-fg">{t('login.demoTitle')}</p>
            <ul className="space-y-0.5 tnum">
              <li><b className="text-fg">{t('login.roleBienestar')}:</b> <button type="button" className="underline" onClick={() => { setU('bienestar'); setP('Bienestar2026!'); }}>bienestar / Bienestar2026!</button></li>
              <li><b className="text-fg">{t('login.roleStudent')}:</b> <button type="button" className="underline" onClick={() => { setU('202600002'); setP('Estudiante2026!'); }}>202600002 / Estudiante2026!</button></li>
            </ul>
          </div>
        )}
        <div className="mt-4 flex justify-center">
          <button className="btn-ghost btn" onClick={() => set({ lang: lang === 'es' ? 'en' : 'es' })}>{lang === 'es' ? 'English' : 'Español'}</button>
        </div>
      </div>
    </div>
  );
}
