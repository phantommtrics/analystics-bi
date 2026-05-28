/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        border: 'var(--border-color)',
        sidebar: 'var(--sidebar-bg)',
        brand: {
          navy: 'var(--brand-navy)',
          blue: 'var(--brand-blue)',
          gold: 'var(--brand-gold)',
        },
        semantic: {
          green: 'var(--semantic-green)',
          red: 'var(--semantic-red)',
          amber: 'var(--semantic-amber)',
          purple: 'var(--semantic-purple)',
          gray: 'var(--semantic-gray)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        micro: ['10px', { lineHeight: '12px', letterSpacing: '0.08em' }],
        xs: ['11px', { lineHeight: '14px' }],
        sm: ['12px', { lineHeight: '16px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['15px', { lineHeight: '22px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['26px', { lineHeight: '32px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
        kpi: ['36px', { lineHeight: '40px' }],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '12px',
        lg: '20px',
      },
      spacing: {
        base: '4px',
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        'pulse-dot': 'pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'login-bg-shift': 'login-bg-shift 18s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        'login-bg-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
}
