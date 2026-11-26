import * as Dialog from '@radix-ui/react-dialog';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, CircleAlert, CircleDashed, Inbox, X } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { ApiError } from '../lib/api';
import { ESTADO_CLASS, type Estado } from '../lib/util';

export function EstadoBadge({ estado, className }: { estado: Estado; className?: string }) {
  const { t } = useTranslation();
  if (!estado) return <span className="text-muted">—</span>;
  const c = ESTADO_CLASS[estado];
  const Icon = estado === 'bueno' ? CheckCircle2 : estado === 'regular' ? CircleAlert : AlertTriangle;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label font-medium', c.bg, c.text, className)}>
      <Icon size={12} strokeWidth={2} aria-hidden /> {t(`estado.${estado}`)}
    </span>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={clsx('skeleton', className)} aria-hidden />;

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-title">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-body text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-muted">
      <Inbox size={28} strokeWidth={1.5} aria-hidden />
      <p className="text-body font-medium text-fg">{title}</p>
      {hint && <p className="max-w-sm text-label">{hint}</p>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useTranslation();
  const msg = error instanceof ApiError ? (error.status === 0 ? t('error.offline') : error.message) : String((error as Error)?.message ?? error);
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
      <AlertTriangle size={28} strokeWidth={1.5} className="text-bad-t" aria-hidden />
      <p className="max-w-md text-body">{msg}</p>
      {retry && <button className="btn" onClick={retry}>{t('common.retry')}</button>}
    </div>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('common.loading')} className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

export function Modal({ open, onOpenChange, title, description, children, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className={clsx('fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-panel border border-line bg-surface p-5 shadow-float', wide ? 'max-w-4xl' : 'max-w-lg')}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-section">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-label text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="btn-ghost touch inline-flex items-center justify-center rounded-ctl" aria-label={t('common.close')}><X size={18} strokeWidth={1.5} /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Sheet({ open, onOpenChange, title, children, side = 'right' }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; side?: 'right' | 'bottom' }) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className={clsx('fixed z-50 overflow-auto border border-line bg-surface p-5 shadow-float', side === 'right' ? 'right-0 top-0 h-full w-[min(360px,92vw)]' : 'bottom-0 left-0 max-h-[80vh] w-full rounded-t-panel')}>
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-section">{title}</Dialog.Title>
            <Dialog.Close className="btn-ghost touch inline-flex items-center justify-center rounded-ctl" aria-label={t('common.close')}><X size={18} strokeWidth={1.5} /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* Toasts */
interface Toast { id: number; kind: 'ok' | 'error'; text: string }
export const useToasts = create<{ list: Toast[]; push: (kind: Toast['kind'], text: string) => void; drop: (id: number) => void }>((set) => ({
  list: [],
  push: (kind, text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ list: [...s.list, { id, kind, text }] }));
    setTimeout(() => set((s) => ({ list: s.list.filter((x) => x.id !== id) })), 5000);
  },
  drop: (id) => set((s) => ({ list: s.list.filter((x) => x.id !== id) })),
}));
export const toast = { ok: (t: string) => useToasts.getState().push('ok', t), error: (t: string) => useToasts.getState().push('error', t) };

export function Toaster() {
  const list = useToasts((s) => s.list);
  const drop = useToasts((s) => s.drop);
  return (
    <div className="chrome pointer-events-none fixed bottom-20 right-3 z-[60] flex w-[min(360px,92vw)] flex-col gap-2 md:bottom-4" aria-live="polite">
      {list.map((x) => (
        <div key={x.id} role={x.kind === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex items-start gap-2 rounded-card border border-line bg-surface p-3 text-body shadow-float">
          {x.kind === 'ok' ? <CheckCircle2 size={18} className="mt-0.5 text-good-t" aria-hidden /> : <AlertTriangle size={18} className="mt-0.5 text-bad-t" aria-hidden />}
          <span className="flex-1">{x.text}</span>
          <button onClick={() => drop(x.id)} aria-label="close" className="text-muted"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-label text-muted">{hint}</span>}
    </label>
  );
}

export function Warning({ children, icon }: { children: ReactNode; icon?: boolean }) {
  return (
    <div role="note" className="flex items-start gap-2 rounded-card border border-warn/40 bg-warn/10 p-3 text-label text-fg">
      {icon !== false && <CircleDashed size={16} className="mt-0.5 shrink-0 text-warn-t" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}

export function useTitle(t: string) {
  useEffect(() => { document.title = `${t} · Bienestar BI`; }, [t]);
}
