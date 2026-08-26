// Design System Tokens for AstraHealth Nexus
// Centralized color, spacing, and typography definitions

export const colors = {
  // Primary Brand - Cyan for high-tech aerospace feel
  brand: {
    primary: '#22d3ee',      // cyan-400
    primaryLight: '#a5f3fc', // cyan-200
    primaryDark: '#06b6d4',  // cyan-600
  },

  // Status Colors
  status: {
    success: '#22c55e', // green-500
    warning: '#eab308', // yellow-500
    error: '#ef4444',   // red-500
    info: '#3b82f6',    // blue-500
  },

  // Neutral Palette
  neutral: {
    bg: {
      primary: '#020617',   // slate-950
      secondary: '#0f172a', // slate-900
      tertiary: '#1e293b',  // slate-800
    },
    border: 'rgba(203, 213, 225, 0.1)', // slate-400/10
    text: {
      primary: '#f8fafc',   // slate-50
      secondary: '#cbd5e1', // slate-400
      tertiary: '#94a3b8',  // slate-400
    },
  },

  // Semantic Aliases
  background: '#020617',
  surface: '#0f172a',
  border: 'rgba(34, 211, 238, 0.2)', // cyan with opacity
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  info: '#3b82f6',
} as const;

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  xxl: '3rem',     // 48px
} as const;

export const typography = {
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
    '6xl': '3.75rem',   // 60px
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.25rem',    // 4px
  base: '0.375rem', // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  '3xl': '2rem',    // 32px
  full: '9999px',
} as const;

export const shadows = {
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  glow: '0 0 20px rgba(34, 211, 238, 0.25)',
  glowLg: '0 0 40px rgba(34, 211, 238, 0.35)',
} as const;

export const transitions = {
  fast: '150ms',
  base: '200ms',
  slow: '300ms',
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  toast: 1060,
} as const;
