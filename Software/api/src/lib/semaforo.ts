export type Estado = 'bueno' | 'regular' | 'malo';
export interface Umbral { umbral_bueno: number; umbral_regular: number }

/** >= bueno -> bueno; >= regular y < bueno -> regular; < regular -> malo. */
export function estado(valor: number | null | undefined, u: Umbral): Estado | null {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return null;
  if (valor >= u.umbral_bueno) return 'bueno';
  if (valor >= u.umbral_regular) return 'regular';
  return 'malo';
}
