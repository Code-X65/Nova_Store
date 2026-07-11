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
          50:  '#fff4ed',
          100: '#ffe6d4',
          200: '#ffcca3',
          300: '#ffaa66',
          400: '#ff8544',
          500: '#FF6A1C', // primary
          600: '#e55b14',
          700: '#cc4a0c',
          800: '#a3390a',
          900: '#802f0a',
          950: '#4a1704',
        },
        surface: {
          DEFAULT: '#000000',
          1: '#000000',
          2: '#0a0a0a',
          3: '#141414',
          4: '#1f1f1f',
        },
        success: { DEFAULT: '#22c55e', light: '#dcfce7', dark: '#15803d' },
        warning: { DEFAULT: '#f59e0b', light: '#fef3c7', dark: '#b45309' },
        danger:  { DEFAULT: '#ef4444', light: '#fee2e2', dark: '#b91c1c' },
        info:    { DEFAULT: '#3b82f6', light: '#dbeafe', dark: '#1d4ed8' },
        neu: {
          bg: '#000000',
          text: '#A1A5B7',
          accent: '#FF6A1C',
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
        'neu-outer': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'neu-outer-sm': '0 2px 8px rgba(0, 0, 0, 0.5)',
        'neu-inner': 'inset 0 2px 4px rgba(0, 0, 0, 0.5)',
        'neu-inner-sm': 'inset 0 1px 2px rgba(0, 0, 0, 0.5)',
      },
      backgroundImage: {
        'nova-gradient':    'linear-gradient(135deg, #FF6A1C 0%, #ff8544 50%, #ffaa66 100%)',
        'nova-gradient-r':  'linear-gradient(225deg, #FF6A1C 0%, #ff8544 50%, #ffaa66 100%)',
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
  plugins: [
    require('tailwindcss-animate')
  ],
};
