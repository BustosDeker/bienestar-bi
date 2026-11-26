import { z } from 'zod';

export const recommendSchema = z.object({
  lang: z.enum(['es', 'en']).default('es'),
  kpis: z
    .array(
      z.object({
        id: z.enum(['KPI-01', 'KPI-02', 'KPI-03', 'KPI-04']),
        valor: z.number().nullable(),
        estado: z.enum(['bueno', 'regular', 'malo']).nullable(),
      }),
    )
    .min(1)
    .max(4),
});
export type RecommendInput = z.infer<typeof recommendSchema>;
export interface Recommendation {
  kpi: string;
  text: string;
}
export interface RecommendOutput {
  provider: 'rules' | 'bedrock';
  fallback: boolean;
  recommendations: Recommendation[];
}
export interface RecommendationProvider {
  name: 'rules' | 'bedrock';
  recommend(input: RecommendInput): Promise<Recommendation[]>;
}
