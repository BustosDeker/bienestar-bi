import { ACCENTS, type Accent } from './store';

export function applyAccent(a: Accent, dark: boolean) {
  const c = ACCENTS[a];
  const r = document.documentElement.style;
  r.setProperty('--accent', dark ? c.dark : c.light);
  r.setProperty('--accent-strong', dark ? c.dark : c.strong);
}
