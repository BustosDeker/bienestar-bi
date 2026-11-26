import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type Accent = 'teal' | 'blue' | 'violet' | 'rose';

export interface Filters {
  facultad?: string;
  escuela?: string;
  sexo?: 'F' | 'M';
  rangoEdad?: string;
  ola?: number;
}

export const ACCENTS: Record<Accent, { light: string; strong: string; dark: string }> = {
  teal: { light: '#0F9D8A', strong: '#0B7A6B', dark: '#2DD4BF' },
  blue: { light: '#3B82F6', strong: '#1D4ED8', dark: '#60A5FA' },
  violet: { light: '#A855F7', strong: '#7E22CE', dark: '#C084FC' },
  rose: { light: '#EC4899', strong: '#BE185D', dark: '#F472B6' },
};

interface UI {
  theme: Theme;
  accent: Accent;
  density: 'comfortable' | 'compact';
  lang: 'es' | 'en';
  k: number;
  filters: Filters;
  sidebarCollapsed: boolean;
  demo: boolean;
  set: (p: Partial<Omit<UI, 'set' | 'setFilters' | 'resetFilters'>>) => void;
  setFilters: (f: Partial<Filters>) => void;
  resetFilters: () => void;
}

export const useUI = create<UI>()(
  persist(
    (set) => ({
      theme: 'system',
      accent: 'teal',
      density: 'comfortable',
      lang: (navigator.language ?? 'es').startsWith('en') ? 'en' : 'es',
      k: 5,
      filters: {},
      sidebarCollapsed: false,
      demo: false,
      set: (p) => set(p),
      setFilters: (f) =>
        set((s) => {
          const next = { ...s.filters, ...f };
          if (f.facultad !== undefined && f.facultad !== s.filters.facultad) delete next.escuela;
          for (const k of Object.keys(next) as (keyof Filters)[]) if (next[k] === undefined || next[k] === '') delete next[k];
          return { filters: next };
        }),
      resetFilters: () => set({ filters: {} }),
    }),
    {
      name: 'bienestar-ui',
      partialize: (s) => ({ theme: s.theme, accent: s.accent, density: s.density, lang: s.lang, k: s.k, filters: s.filters, sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);

export const isDark = (theme: Theme) => theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
