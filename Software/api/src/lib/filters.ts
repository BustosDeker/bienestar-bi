import { z } from 'zod';
import type { Params } from './db.js';

export const filtersSchema = z.object({
  facultad: z.string().max(100).optional(),
  escuela: z.string().max(100).optional(),
  sexo: z.enum(['F', 'M']).optional(),
  rangoEdad: z.string().max(20).optional(),
  ola: z.coerce.number().int().min(1).max(3).optional(),
  k: z.coerce.number().int().min(1).max(50).default(5),
});
export type Filters = z.infer<typeof filtersSchema>;

/** Condiciones sobre las dimensiones de estudiante (de) y programa (dp). Agrega parametros. */
export function dimConds(f: Filters, p: Params): string[] {
  const c: string[] = [];
  if (f.facultad) { c.push('dp.Facultad = @facultad'); p.facultad = f.facultad; }
  if (f.escuela) { c.push('dp.Escuela = @escuela'); p.escuela = f.escuela; }
  if (f.sexo) { c.push('de.Sexo = @sexo'); p.sexo = f.sexo; }
  if (f.rangoEdad) { c.push('de.RangoEdad = @rangoEdad'); p.rangoEdad = f.rangoEdad; }
  return c;
}
export const where = (c: string[]) => (c.length ? 'WHERE ' + c.join('\n  AND ') : '');
export function parseFilters(q: Record<string, string | undefined>): Filters {
  return filtersSchema.parse(Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')));
}
