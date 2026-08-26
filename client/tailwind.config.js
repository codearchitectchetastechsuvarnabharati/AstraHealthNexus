// codeauthor chetas karnam
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary brand colors - Cyan for high-tech aerospace feel
        'brand-primary': 'rgb(34, 211, 238)', // cyan-400
        'brand-primary-light': 'rgb(165, 243, 252)', // cyan-200
        'brand-primary-dark': 'rgb(6, 182, 212)', // cyan-600
        
        // Status colors
        'status-success': 'rgb(34, 197, 94)', // green-500
        'status-warning': 'rgb(234, 179, 8)', // yellow-500
        'status-error': 'rgb(239, 68, 68)', // red-500
        'status-info': 'rgb(59, 130, 246)', // blue-500
        
        // Neutral palette - high contrast for readability
        'neutral-bg-primary': 'rgb(2, 6, 23)', // slate-950
        'neutral-bg-secondary': 'rgb(15, 23, 42)', // slate-900
        'neutral-bg-tertiary': 'rgb(30, 41, 59)', // slate-800
        'neutral-border': 'rgba(203, 213, 225, 0.1)', // slate-400/10
        'neutral-text-primary': 'rgb(248, 250, 252)', // slate-50
        'neutral-text-secondary': 'rgb(203, 213, 225)', // slate-400
        'neutral-text-tertiary': 'rgb(148, 163, 184)', // slate-400
      },
      
      spacing: {
        'xs': '0.25rem',  // 4px
        'sm': '0.5rem',   // 8px
        'md': '1rem',     // 16px
        'lg': '1.5rem',   // 24px
        'xl': '2rem',     // 32px
        'xxl': '3rem',    // 48px
      },
      
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],      // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],     // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px
        '5xl': ['3rem', { lineHeight: '3.5rem' }],      // 48px
        '6xl': ['3.75rem', { lineHeight: '4rem' }],     // 60px
      },
      
      fontWeight: {
        'light': 300,
        'normal': 400,
        'medium': 500,
        'semibold': 600,
        'bold': 700,
      },
      
      borderRadius: {
        'none': '0',
        'sm': '0.25rem',    // 4px
        'base': '0.375rem', // 6px
        'md': '0.5rem',     // 8px
        'lg': '0.75rem',    // 12px
        'xl': '1rem',       // 16px
        '2xl': '1.5rem',    // 24px
        '3xl': '2rem',      // 32px
        'full': '9999px',
      },
      
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'glow': '0 0 20px rgba(34, 211, 238, 0.25)',
        'glow-lg': '0 0 40px rgba(34, 211, 238, 0.35)',
      },
      
      transitionDuration: {
        'fast': '150ms',
        'base': '200ms',
        'slow': '300ms',
      },
      
      zIndex: {
        'base': 0,
        'dropdown': 1000,
        'sticky': 1020,
        'fixed': 1030,
        'modal-backdrop': 1040,
        'modal': 1050,
        'toast': 1060,
      },
    }
  },
  plugins: []
};
