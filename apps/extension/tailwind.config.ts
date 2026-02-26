import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}', './entrypoints/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          300: '#a5bbfc',
          400: '#8098f9',
          500: '#6172f3',
          600: '#4e55e8',
          700: '#4040cd',
          800: '#3636a5',
          900: '#313183',
          950: '#1e1d4c',
        },
        win: '#22c55e',
        loss: '#ef4444',
        jackpot: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      keyframes: {
        'hud-slide-in': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-jackpot': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(245, 158, 11, 0)' },
        },
      },
      animation: {
        'hud-slide-in': 'hud-slide-in 0.3s ease-out',
        'pulse-jackpot': 'pulse-jackpot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
