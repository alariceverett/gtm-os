# AdZeta Design System

A Linear-inspired design system for the GTM Command Center.

## Quick Reference

### Colors

**Semantic Colors:**
- Success: `#22c55e` (green-500)
- Warning: `#f59e0b` (amber-500)
- Danger: `#ef4444` (red-500)

**Gray Scale (Slate-based with subtle warmth):**
- 50: `#f8fafc` - Background hover
- 100: `#f1f5f9` - Section backgrounds
- 200: `#e2e8f0` - Borders
- 300: `#cbd5e1` - Disabled states
- 400: `#94a3b8` - Placeholder text
- 500: `#64748b` - Secondary text
- 600: `#475569` - Body text
- 700: `#334155` - Strong text
- 800: `#1e293b` - Dark backgrounds
- 900: `#0f172a` - Deep backgrounds
- 950: `#020617` - Deepest blacks

### Spacing (4px base)

| Token | Value |
|-------|-------|
| 1 | 4px |
| 2 | 8px |
| 4 | 16px |
| 6 | 24px |
| 8 | 32px |
| 12 | 48px |
| 16 | 64px |

### Shadows

- `card`: Subtle lift for containers
  - `0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)`
- `hover`: Elevated interaction state
  - `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)`
- `modal`: High elevation overlays
  - `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)`

### Border Radius

- `sm`: 4px - Tags, badges
- `md`: 6px - Buttons, inputs
- `lg`: 8px - Cards, panels
- `xl`: 12px - Large cards, modals
- `2xl`: 16px - Hero sections
- `full`: 9999px - Pills, avatars

### Typography (Inter)

| Style | Size | Line Height | Weight |
|-------|------|-------------|--------|
| display-xl | 48px | 56px | 700 |
| display-lg | 36px | 44px | 700 |
| heading-lg | 20px | 28px | 600 |
| heading-md | 18px | 24px | 600 |
| body-lg | 16px | 28px | 400 |
| body-md | 14px | 24px | 400 |
| caption | 12px | 20px | 500 |

## Components

### Hero Status

Located in `app/components/hero-status.tsx`

Features:
- **GTM Health Indicator**: Status pulse with 🟢🟡🔴 states
- **3 KPI Cards**: Trend arrows (↑24%, ↑60%, ↑12%)
- **Time Period Selector**: Today | 7 days | 30 days
- **Quick Actions**: Add Objective, Targeting, Reports, AI Insights

### Design System Foundation

Located in `app/components/design-system.tsx`

Exports:
- `colors` - Complete color palette
- `typography` - Font sizes and styles
- `spacing` - 4px-based spacing scale
- `shadows` - Elevation system
- `borderRadius` - Radius tokens
- `animations` - Timing and easing
- `zIndex` - Layer management
- `componentTokens` - Pre-defined component styles

## Usage

```tsx
import { designSystem } from '@/app/components/design-system';

// Access tokens
const { colors, shadows, spacing } = designSystem;

// Use in styles
<div style={{ 
  backgroundColor: colors.gray[900],
  boxShadow: shadows.card,
  padding: spacing[4]
}}>
```

## Animation

All transitions use `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out) with 200ms duration.

### Health Indicator Pulse
Subtle CSS animation:
```css
@keyframes healthPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### Hover States
Elements lift on hover:
```css
:hover {
  transform: translateY(-2px);
  box-shadow: ...;
}
```

## Quality Standards

- Every pixel intentional
- Consistent 4px grid
- Accessible color contrast
- Reduced motion support
- Mobile-first responsive design