import { config } from '../config.js';
import type { RecommendInput, Recommendation, RecommendationProvider } from './types.js';

const SYSTEM: Record<'es' | 'en', string> = {
  es: 'Eres un asistente de bienestar estudiantil. Recibes indicadores agregados con su estado de semáforo. Redacta de 3 a 5 recomendaciones prácticas, breves y no clínicas, indicando de qué indicador provienen. No diagnostiques, no predigas, no inventes cifras y no afirmes causalidad. Si el indicador de satisfacción con la vida (KPI-01) está en rojo (malo), recomienda acudir a la oficina de bienestar estudiantil. Responde SOLO con un arreglo JSON: [{"kpi":"KPI-01","text":"..."}].',
  en: 'You are a student wellbeing assistant. You receive aggregated indicators with their traffic-light status. Write 3 to 5 practical, brief, non-clinical recommendations, stating which indicator each comes from. Do not diagnose, predict, invent figures or claim causality. If the life-satisfaction indicator (KPI-01) is red (malo), recommend visiting the student wellbeing office. Reply ONLY with a JSON array: [{"kpi":"KPI-01","text":"..."}].',
};

export const bedrockProvider: RecommendationProvider = {
  name: 'bedrock',
  async recommend(input: RecommendInput): Promise<Recommendation[]> {
    if (!config.ai.modelId) throw new Error('BEDROCK_MODEL_ID no configurado');
    const { BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const client = new BedrockRuntimeClient({ region: config.ai.region });
    // Solo valores agregados de KPI: nunca datos personales
    const payload = input.kpis.map((k) => ({
      indicador: k.id,
      valor: k.valor === null ? null : Math.round(k.valor * 100) / 100,
      estado: k.estado,
    }));
    let lastErr: unknown;
    for (let attempt = 0; attempt <= config.ai.retries; attempt++) {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), config.ai.timeoutMs);
      try {
        const res = await client.send(
          new ConverseCommand({
            modelId: config.ai.modelId,
            system: [{ text: SYSTEM[input.lang] }],
            messages: [{ role: 'user', content: [{ text: JSON.stringify(payload) }] }],
            inferenceConfig: { maxTokens: 700, temperature: 0.3 },
          }),
          { abortSignal: ac.signal },
        );
        const text = res.output?.message?.content?.[0]?.text ?? '';
        const m = text.match(/\[[\s\S]*\]/);
        const arr = JSON.parse(m ? m[0] : text) as Recommendation[];
        const clean = arr
          .filter((r) => r && typeof r.text === 'string')
          .slice(0, 5)
          .map((r) => ({ kpi: String(r.kpi ?? 'GENERAL'), text: r.text }));
        if (clean.length < 1) throw new Error('respuesta vacía');
        return clean;
      } catch (e) {
        lastErr = e;
      } finally {
        clearTimeout(t);
      }
    }
    throw lastErr;
  },
};
