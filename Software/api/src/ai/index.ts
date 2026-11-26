import { config } from '../config.js';
import { bedrockProvider } from './bedrock.js';
import { rulesProvider } from './rules.js';
import type { RecommendInput, RecommendOutput } from './types.js';

const OFICINA: Record<'es' | 'en', string> = {
  es: 'Si te sientes mal o desbordado, acude a la oficina de bienestar estudiantil de tu universidad.',
  en: 'If you feel unwell or overwhelmed, please visit your university student wellbeing office.',
};

/** Usa el proveedor configurado y cae a `rules` si falla. Solo recibe agregados de KPI, nunca datos personales. */
export async function recommend(input: RecommendInput, provider = config.ai.provider): Promise<RecommendOutput> {
  if (provider === 'bedrock') {
    try {
      const recs = await bedrockProvider.recommend(input);
      const k1 = input.kpis.find((k) => k.id === 'KPI-01');
      if (k1?.estado === 'malo' && !/bienestar|wellbeing/i.test(recs.map((r) => r.text).join(' '))) {
        recs.unshift({ kpi: 'KPI-01', text: OFICINA[input.lang] });
      }
      return { provider: 'bedrock', fallback: false, recommendations: recs.slice(0, 5) };
    } catch {
      return { provider: 'rules', fallback: true, recommendations: await rulesProvider.recommend(input) };
    }
  }
  return { provider: 'rules', fallback: false, recommendations: await rulesProvider.recommend(input) };
}
