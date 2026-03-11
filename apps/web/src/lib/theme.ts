/**
 * Design tokens and theme configuration
 */

// Color palette
export const colors = {
  brand: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
    950: '#2e1065',
  },
  semantic: {
    win: '#22c55e',
    loss: '#ef4444',
    neutral: '#64748b',
    jackpot: '#f59e0b',
  },
  dark: {
    bg: '#09090b',
    card: '#18181b',
    border: '#3f3f46',
    text: '#e4e4e7',
  },
} as const

// Spacing scale
export const spacing = {
  xs: '0.25rem',
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.25rem',
  '3xl': '1.5rem',
  '4xl': '2rem',
  '5xl': '3rem',
  '6xl': '4rem',
} as const

// Border radius
export const radius = {
  xs: '0.25rem',
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.25rem',
  '3xl': '1.5rem',
  full: '9999px',
} as const

// Font configuration
export const fonts = {
  sans: '"Inter var", "Inter", ui-sans-serif, system-ui, sans-serif',
  mono: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
} as const

// Font sizes
export const fontSizes = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
  '7xl': '4.5rem',
} as const

// Z-index scale
export const zIndex = {
  hide: '-1',
  base: '0',
  docked: '10',
  dropdown: '1000',
  sticky: '1020',
  fixed: '1030',
  modalBackdrop: '1040',
  modal: '1050',
  popover: '1060',
  tooltip: '1070',
} as const

// Transition durations
export const transitions = {
  fast: '150ms',
  base: '300ms',
  slow: '500ms',
  slower: '700ms',
} as const

// Easing functions
export const easing = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  brand: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

// Shadow system
export const shadows = {
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.1)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
} as const

// Breakpoints for responsive design
export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// Utilities
export const utilities = {
  focusRing:
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
  truncate: 'overflow-hidden text-ellipsis whitespace-nowrap',
  visuallyHidden:
    'absolute w-1 h-1 p-0 -m-1 overflow-hidden clip-rect(0,0,0,0) border-0',
} as const
