import type { Config } from 'tailwindcss';

// Every value below points at a CSS variable defined once in styles/tokens.css.
export default {
  content: ['./index.html', './*.{ts,tsx}', './pages/**/*.tsx', './components/**/*.tsx', './lib/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--allov-ink)',
        muted: 'var(--allov-muted)',
        canvas: 'var(--allov-bg)',
        surface: 'var(--allov-surface)',
        line: 'var(--allov-border)',
        'line-strong': 'var(--allov-border-strong)',
        brand: 'var(--allov-green)',
        'brand-deep': 'var(--allov-green-deep)',
        'brand-text': 'var(--allov-green-text)',
        accent: 'var(--allov-blue)',
        link: 'var(--allov-blue-text)',
        tech: 'var(--allov-cyan-text)',
        ok: 'var(--allov-success-text)',
        warn: 'var(--allov-warning)',
        danger: 'var(--allov-danger)',
        'soft-info': 'var(--allov-info-bg)',
        'soft-warn': 'var(--allov-warning-bg)',
        'soft-danger': 'var(--allov-danger-bg)',
        'soft-ok': 'var(--allov-success-bg)',
      },
      fontFamily: {
        display: ['var(--allov-font-display)'],
        sans: ['var(--allov-font-sans)'],
        mono: ['var(--allov-font-mono)'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.375rem', { lineHeight: '1.875rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.25rem' }],
        '3xl': ['2.25rem', { lineHeight: '2.75rem' }],
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px' },
      boxShadow: { card: 'var(--allov-shadow-card)', pop: 'var(--allov-shadow-pop)' },
    },
  },
} satisfies Config;
