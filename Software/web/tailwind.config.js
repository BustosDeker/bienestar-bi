/** Colores de tema con soporte de opacidad (bg-accent/10) usando color-mix sobre variables CSS. */
const v = (name) => ({ opacityValue }) =>
  opacityValue === undefined ? `var(${name})` : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      colors: {
        bg: v('--bg'),
        surface: v('--surface'),
        line: v('--border'),
        fg: v('--text'),
        muted: v('--muted'),
        accent: v('--accent'),
        'accent-strong': v('--accent-strong'),
        'on-accent': v('--on-accent'),
        good: v('--good'),
        warn: v('--warn'),
        bad: v('--bad'),
        'good-t': v('--good-text'),
        'warn-t': v('--warn-text'),
        'bad-t': v('--bad-text'),
      },
      borderRadius: { ctl: '8px', card: '12px', panel: '16px' },
      fontSize: {
        title: ['24px', { lineHeight: '32px', fontWeight: '600' }],
        section: ['16px', { lineHeight: '24px', fontWeight: '500' }],
        body: ['14px', '20px'],
        label: ['12px', '16px'],
        kpi: ['36px', { lineHeight: '40px', fontWeight: '600' }],
      },
      maxWidth: { content: '1280px' },
      boxShadow: { float: '0 4px 16px rgba(0,0,0,0.08)' },
    },
  },
  plugins: [],
};
