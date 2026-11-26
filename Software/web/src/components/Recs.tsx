import { useMutation } from '@tanstack/react-query';
import { Copy, Download, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { downloadFile } from '../lib/util';
import { useUI } from '../lib/store';
import { EmptyState, ErrorState, Loading, Warning, toast } from './ui';

export interface RecKpi { id: string; valor: number | null; estado: 'bueno' | 'regular' | 'malo' | null }
interface Out { provider: 'rules' | 'bedrock'; fallback: boolean; recommendations: { kpi: string; text: string }[] }

export function useRecommend() {
  const lang = useUI((s) => s.lang);
  return useMutation({
    mutationFn: (kpis: RecKpi[]) => api<Out>('/api/ai/recommend', { method: 'POST', body: JSON.stringify({ lang, kpis: kpis.filter((k) => k.estado) }) }),
  });
}

export default function Recs({ kpis, auto, title }: { kpis: RecKpi[]; auto?: boolean; title?: string }) {
  const { t } = useTranslation();
  const m = useRecommend();
  const lang = useUI((s) => s.lang);
  const key = JSON.stringify(kpis.map((k) => [k.id, k.estado])) + lang;
  useEffect(() => { if (auto && kpis.some((k) => k.estado)) m.mutate(kpis); /* eslint-disable-next-line */ }, [auto, key]);
  const data = m.data;
  const asText = () => (data?.recommendations ?? []).map((r) => `- [${r.kpi}] ${r.text}`).join('\n');
  return (
    <div>
      {!auto && (
        <button className="btn btn-primary" disabled={m.isPending || !kpis.some((k) => k.estado)} onClick={() => m.mutate(kpis)}>
          <Sparkles size={16} strokeWidth={1.5} aria-hidden /> {t('coach.interpret')}
        </button>
      )}
      <div className="mt-3" aria-live="polite">
        {m.isPending && <Loading rows={3} />}
        {m.error && <ErrorState error={m.error} retry={() => m.mutate(kpis)} />}
        {!m.isPending && !m.error && !data && <EmptyState title={t('coach.emptyTitle')} hint={t('coach.emptyHint')} />}
        {data && (
          <>
            <ul className="space-y-2">
              {data.recommendations.map((r, i) => (
                <li key={i} className="flex gap-3 rounded-card border border-line p-3">
                  <span className="mt-0.5 h-fit shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-label font-medium text-accent-strong">{r.kpi === 'GENERAL' ? t('coach.general') : r.kpi}</span>
                  <p className="text-body">{r.text}</p>
                </li>
              ))}
            </ul>
            <div className="no-print mt-3 flex flex-wrap items-center gap-2 text-label text-muted">
              <span>{t('coach.source')}: <b className="text-fg">{data.provider === 'bedrock' ? 'Amazon Bedrock' : t('coach.rules')}</b></span>
              {data.fallback && <span className="text-warn-t">· {t('coach.fallback')}</span>}
              <button className="btn ml-auto" onClick={() => { navigator.clipboard?.writeText(asText()); toast.ok(t('common.copied')); }}><Copy size={14} /> {t('common.copy')}</button>
              <button className="btn" onClick={() => downloadFile('recomendaciones.md', `# ${title ?? t('coach.title')}\n\n${asText()}\n\n_${t('coach.disclaimer')}_\n`, 'text/markdown;charset=utf-8')}><Download size={14} /> {t('common.export')}</button>
            </div>
            <div className="mt-3"><Warning>{t('coach.disclaimer')}</Warning></div>
          </>
        )}
      </div>
    </div>
  );
}
