/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nova brand palette — deep midnight + electric violet
        nova: {
          50:  '#f0f0ff',
          100: '#e0e0ff',
          200: '#c4c4fe',
          300: '#a3a3fd',
          400: '#8181fa',
          500: '#6366f1', // primary
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        surface: {
          DEFAULT: '#0f0f1a',
          1: '#16162a',
          2: '#1e1e35',
          3: '#252542',
          4: '#2e2e50',
        },
        success: { DEFAULT: '#22c55e', light: '#dcfce7', dark: '#15803d' },
        warning: { DEFAULT: '#f59e0b', light: '#fef3c7', dark: '#b45309' },
        danger:  { DEFAULT: '#ef4444', light: '#fee2e2', dark: '#b91c1c' },
        info:    { DEFAULT: '#3b82f6', light: '#dbeafe', dark: '#1d4ed8' },
        neu: {
          bg: '#1E1F26',
          text: '#A1A5B7',
          accent: '#6366f1',
        }
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'neu-outer': '8px 8px 16px #14151a, -8px -8px 16px #282932',
        'neu-outer-sm': '4px 4px 8px #14151a, -4px -4px 8px #282932',
        'neu-inner': 'inset 6px 6px 12px #14151a, inset -6px -6px 12px #282932',
        'neu-inner-sm': 'inset 3px 3px 6px #14151a, inset -3px -3px 6px #282932',
      },
      backgroundImage: {
        'nova-gradient':    'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        'nova-gradient-r':  'linear-gradient(225deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        'surface-gradient': 'linear-gradient(135deg, #16162a 0%, #1e1e35 100%)',
        'glass':            'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
        'slide-in-l': 'slideInLeft 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':  'spin 3s linear infinite',
        'bounce-subtle': 'bouncSubtle 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        bouncSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
