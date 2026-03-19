/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef5ff',
          100: '#d9e8ff',
          200: '#bcd4ff',
          300: '#8eb5ff',
          400: '#598aff',
          500: '#3361ff',
          600: '#1a3ef7',
          700: '#132de3',
          800: '#1628b8',
          900: '#182591',
          950: '#111660',
        },
        surface: {
          900: '#080c14',
          800: '#0d1220',
          750: '#101828',
          700: '#141e2e',
          600: '#1a2540',
          500: '#1e2d4a',
          400: '#253456',
          300: '#2e3f66',
        },
        accent: {
          cyan:   '#00d4ff',
          purple: '#8b5cf6',
          pink:   '#ec4899',
          green:  '#10b981',
          orange: '#f59e0b',
          red:    '#ef4444',
        }
      },
      fontFamily: {
        sans:    ['Plus Jakarta Sans', 'sans-serif'],
        display: ['"Syne"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        'dot-pattern': "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
        'glow-brand': 'radial-gradient(ellipse at center, rgba(51,97,255,0.15) 0%, transparent 70%)',
        'glow-cyan': 'radial-gradient(ellipse at center, rgba(0,212,255,0.12) 0%, transparent 70%)',
      },
      backgroundSize: {
        'dot-sm': '20px 20px',
        'dot-md': '30px 30px',
      },
      boxShadow: {
        'glow-brand': '0 0 30px rgba(51,97,255,0.3)',
        'glow-cyan':  '0 0 30px rgba(0,212,255,0.2)',
        'glow-sm':    '0 0 10px rgba(51,97,255,0.2)',
        'card':       '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6)',
        'inner-top':  'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'pulse-slow':    'pulse 3s ease-in-out infinite',
        'spin-slow':     'spin 8s linear infinite',
        'shimmer':       'shimmer 2s linear infinite',
        'fade-in':       'fadeIn 0.4s ease-out',
        'slide-in-up':   'slideInUp 0.4s ease-out',
        'slide-in-right':'slideInRight 0.3s ease-out',
        'bounce-in':     'bounceIn 0.5s cubic-bezier(0.36,0.07,0.19,0.97)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideInUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.9)', opacity: '0' },
          '70%':  { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
