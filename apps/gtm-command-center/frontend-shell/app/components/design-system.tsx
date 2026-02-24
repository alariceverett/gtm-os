/**
 * AdZeta Design System Foundation
 * 
 * A Linear-inspired design system built on these principles:
 * - Intentional whitespace (4px base grid)
 * - Sophisticated grays with semantic meaning
 * - Purposeful shadows that communicate elevation
 * - Rounded corners for friendliness, sharp when needed
 * - Typography that breathes with clear hierarchy
 * 
 * @module app/components/design-system
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

/**
 * Primary Gray Scale - The foundation of the UI
 * Neutral grays with subtle warmth for sophistication
 */
export const colors = {
  // Core grays (based on slate with subtle warmth)
  gray: {
    50: '#f8fafc',   // Background hover, subtle fills
    100: '#f1f5f9',  // Section backgrounds
    200: '#e2e8f0',  // Borders, dividers
    300: '#cbd5e1',  // Disabled states, secondary borders
    400: '#94a3b8',  // Placeholder text
    500: '#64748b',  // Secondary text, icons
    600: '#475569',  // Body text
    700: '#334155',  // Strong text, headings
    800: '#1e293b',  // Dark backgrounds
    900: '#0f172a',  // Deep backgrounds, hero sections
    950: '#020617',  // Deepest blacks
  },

  // Semantic colors - Status indicators
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',  // Primary success (from spec)
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',  // Primary warning (from spec)
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',  // Primary danger (from spec)
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Brand accents
  brand: {
    blue: '#3b82f6',
    violet: '#8b5cf6',
    purple: '#a855f7',
    indigo: '#6366f1',
  },
} as const;

// =============================================================================
// TYPOGRAPHY - Inter font system
// =============================================================================

/**
 * Typography scale using Inter font
 * Strict hierarchy from display to caption
 */
export const typography = {
  fontFamily: {
    sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'monospace'],
  },

  // Font sizes with line height pairs
  sizes: {
    'display-xl': { size: '3rem', lineHeight: '3.5rem', letterSpacing: '-0.02em', fontWeight: 700 },    // 48px
    'display-lg': { size: '2.25rem', lineHeight: '2.75rem', letterSpacing: '-0.02em', fontWeight: 700 }, // 36px
    'display-md': { size: '1.875rem', lineHeight: '2.375rem', letterSpacing: '-0.01em', fontWeight: 600 }, // 30px
    'display-sm': { size: '1.5rem', lineHeight: '2rem', letterSpacing: '-0.01em', fontWeight: 600 },     // 24px
    
    'heading-lg': { size: '1.25rem', lineHeight: '1.75rem', letterSpacing: '-0.01em', fontWeight: 600 }, // 20px
    'heading-md': { size: '1.125rem', lineHeight: '1.5rem', letterSpacing: '0', fontWeight: 600 },       // 18px
    'heading-sm': { size: '1rem', lineHeight: '1.5rem', letterSpacing: '0', fontWeight: 600 },           // 16px
    
    'body-lg': { size: '1rem', lineHeight: '1.75rem', letterSpacing: '0', fontWeight: 400 },             // 16px
    'body-md': { size: '0.875rem', lineHeight: '1.5rem', letterSpacing: '0', fontWeight: 400 },          // 14px
    'body-sm': { size: '0.8125rem', lineHeight: '1.375rem', letterSpacing: '0', fontWeight: 400 },       // 13px
    
    'caption': { size: '0.75rem', lineHeight: '1.25rem', letterSpacing: '0.01em', fontWeight: 500 },    // 12px
    'label': { size: '0.6875rem', lineHeight: '1rem', letterSpacing: '0.02em', fontWeight: 600 },        // 11px
  },
} as const;

// =============================================================================
// SPACING - 4px base scale
// =============================================================================

/**
 * Spacing scale based on 4px increments
 * Use for margins, padding, gaps, and component sizing
 */
export const spacing = {
  0: '0px',
  0.5: '2px',    // 0.5 units
  1: '4px',      // Base unit
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
} as const;

// =============================================================================
// SHADOWS - Elevation system
// =============================================================================

/**
 * Shadow scale for elevation
 * - card: Subtle lift for content containers
 * - hover: Elevated state for interactive elements
 * - modal: High elevation for overlays
 */
export const shadows = {
  // Subtle card shadow - minimal elevation
  card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  
  // Hover state - noticeable lift
  hover: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  
  // Focus/active state
  active: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  
  // Modals/dropdowns
  modal: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  
  // Glow effects for emphasis
  glow: {
    success: '0 0 20px rgba(34, 197, 94, 0.3)',
    warning: '0 0 20px rgba(245, 158, 11, 0.3)',
    danger: '0 0 20px rgba(239, 68, 68, 0.3)',
    brand: '0 0 20px rgba(139, 92, 246, 0.3)',
  },
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

/**
 * Border radius system
 * Consistent rounding across all UI elements
 */
export const borderRadius = {
  none: '0px',
  sm: '4px',     // Small elements (tags, badges)
  md: '6px',     // Buttons, inputs
  lg: '8px',     // Cards, panels
  xl: '12px',    // Large cards, modals
  '2xl': '16px', // Hero sections, feature cards
  full: '9999px', // Pills, avatars
} as const;

// =============================================================================
// ANIMATIONS
// =============================================================================

/**
 * Animation timing and easing functions
 */
export const animations = {
  // Duration
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  
  // Easing
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',      // ease-out
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',  // slight overshoot
    smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',   // very smooth
  },
  
  // Keyframes (for Tailwind config reference)
  keyframes: {
    pulse: `{
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }`,
    ping: `{
      75%, 100% {
        transform: scale(2);
        opacity: 0;
      }
    }`,
    fadeIn: `{
      from { opacity: 0; }
      to { opacity: 1; }
    }`,
    slideUp: `{
      from { 
        opacity: 0; 
        transform: translateY(10px); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0); 
      }
    }`,
  },
} as const;

// =============================================================================
// Z-INDEX SCALE
// =============================================================================

/**
 * Z-index management
 * Prevent z-index wars with a clear scale
 */
export const zIndex = {
  hide: -1,
  base: 0,
  docked: 10,
  dropdown: 100,
  sticky: 200,
  banner: 250,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
  tooltip: 700,
} as const;

// =============================================================================
// COMPONENT TOKENS
// =============================================================================

/**
 * Pre-defined tokens for common component patterns
 */
export const componentTokens = {
  // Button variants
  button: {
    primary: {
      bg: colors.brand.violet,
      bgHover: '#7c3aed',
      text: '#ffffff',
      shadow: shadows.hover,
    },
    secondary: {
      bg: colors.gray[800],
      bgHover: colors.gray[700],
      text: colors.gray[200],
      border: colors.gray[700],
    },
    ghost: {
      bg: 'transparent',
      bgHover: colors.gray[800],
      text: colors.gray[300],
    },
  },
  
  // Card variants
  card: {
    default: {
      bg: colors.gray[50],
      border: colors.gray[200],
      shadow: shadows.card,
    },
    dark: {
      bg: colors.gray[900],
      border: colors.gray[800],
      shadow: 'none',
    },
    elevated: {
      bg: colors.gray[50],
      border: colors.gray[200],
      shadow: shadows.hover,
    },
  },
  
  // Input states
  input: {
    bg: colors.gray[50],
    border: colors.gray[200],
    borderFocus: colors.brand.violet,
    text: colors.gray[900],
    placeholder: colors.gray[400],
  },
} as const;

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Design System Summary Object
 * Use for documentation or theme generation
 */
export const designSystem = {
  colors,
  typography,
  spacing,
  shadows,
  borderRadius,
  animations,
  zIndex,
  componentTokens,
} as const;

export default designSystem;