import { useTranslation } from 'react-i18next';
import Recs from '../components/Recs';
import { EstadoBadge, ErrorState, Loading, PageHeader, useTitle } from '../components/ui';
import { useKpis } from '../lib/hooks';
import { fmt } from '../lib/util';

export default function Coach() {
  const { t } = useTranslation();
  useTitle(t('nav.coach'));
  const q = useKpis();
  const kpis = q.data?.kpis ?? [];
  return (
    <div className="space-y-4">
      <PageHeader title={t('coach.title')} subtitle={t('coach.subtitle')} />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className="card" aria-labelledby="co-in">
          <h2 id="co-in" className="mb-2 text-section">{t('coach.inputs')}</h2>
          <p className="mb-3 text-label text-muted">{t('coach.inputsHint')}</p>
          {q.isLoading && <Loading />}
          {q.error && <ErrorState error={q.error} retry={() => q.refetch()} />}
          <ul className="divide-y divide-line">
            {kpis.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-2 py-2">
                <span><b>{k.id}</b> <span className="text-muted">· {t(`kpi.${k.id}`)}</span></span>
                <span className="flex items-center gap-2 tnum">{k.suppressed ? '—' : fmt(k.valor, 2)} <EstadoBadge estado={k.estado} /></span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card" aria-labelledby="co-out">
          <h2 id="co-out" className="mb-3 text-section">{t('coach.outputs')}</h2>
          <Recs kpis={kpis.map((k) => ({ id: k.id, valor: k.valor, estado: k.estado }))} />
        </section>
      </div>
    </div>
  );
}
