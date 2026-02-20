# UI Standards — Customize This For Your Brand

> **This is your canonical UI standards file.** Every Forge component references these values. Change them once here, and the entire UI follows.

## Philosophy

Forge ships with a minimal, clean, professional baseline. It's designed to get out of the way and let your AI org's output speak for itself. Customize aggressively — this is *your* product.

---

## Typography

| Role | Default | Customize |
|------|---------|-----------|
| **Headings** | `system-ui, -apple-system, 'Segoe UI', sans-serif` | _Your brand font_ |
| **Body** | `system-ui, -apple-system, 'Segoe UI', sans-serif` | _Your brand font_ |
| **Mono/Code** | `'SF Mono', 'Fira Code', 'Consolas', monospace` | _Your mono font_ |
| **Base size** | `14px` | |
| **Scale** | `1.25` (Major Third) | |
| **Line height** | `1.5` (body), `1.2` (headings) | |

### Type Scale

```
xs:   11px    — captions, metadata
sm:   12px    — secondary text, labels
base: 14px    — body text, inputs
md:   16px    — subheadings, emphasis
lg:   20px    — section headers
xl:   24px    — page titles
2xl:  32px    — hero text
```

---

## Color Palette

### Neutrals (default: warm stone)

```
background:    #0C0A09    — app background
surface:       #1C1917    — cards, panels, rails
surface-alt:   #292524    — hover states, secondary surfaces
border:        #44403C    — dividers, outlines
text-primary:  #F5F5F4    — headings, primary content
text-secondary:#A8A29E    — labels, metadata
text-muted:    #78716C    — placeholders, disabled
```

### Accent Colors

```
primary:       #3B82F6    — actions, links, focus rings
success:       #22C55E    — completed, positive
warning:       #F59E0B    — attention, pending
danger:        #EF4444    — errors, destructive actions
info:          #06B6D4    — informational, neutral highlights
```

### Division Colors (for Office Floor zones)

```
CEO:           #1C1917
Growth:        #15803D
Operations:    #DC4826
Product:       #B45309
Security:      #57534E
```

> **Customize:** Replace these with your brand palette. The Command Center and Office Floor both read from these tokens.

---

## Spacing

Based on an **8px grid**:

```
0:   0px
1:   4px     — tight gaps, icon padding
2:   8px     — default gap, input padding
3:   12px    — card padding (compact)
4:   16px    — card padding (standard), section gaps
5:   20px    — panel padding
6:   24px    — section spacing
8:   32px    — large spacing
10:  40px    — page margins
12:  48px    — hero spacing
16:  64px    — major sections
```

---

## Component Patterns

### Cards
- Background: `surface`
- Border: `1px solid border`
- Border radius: `8px`
- Padding: `16px`
- Hover: `surface-alt` background

### Buttons
- Primary: `primary` background, white text, `8px 16px` padding
- Secondary: `surface-alt` background, `text-primary`
- Ghost: transparent, `text-secondary`, hover → `surface-alt`
- Border radius: `6px`
- Height: `32px` (sm), `36px` (md), `40px` (lg)

### Inputs
- Background: `surface`
- Border: `1px solid border`
- Focus: `2px solid primary` ring
- Height: `36px`
- Padding: `8px 12px`

### Status Indicators
- Dot: `8px` circle with status color
- Badge: rounded pill, `4px 8px` padding
- States: idle (muted), working (primary), blocked (danger), complete (success)

---

## Responsive Breakpoints

```
sm:    640px    — mobile landscape
md:    768px    — tablet
lg:    1024px   — desktop (collapse right panel below this)
xl:    1280px   — wide desktop (full 3-zone layout)
2xl:   1536px   — ultra-wide
```

### Layout Behavior

| Breakpoint | Left Rail | Main Workspace | Right Panel |
|------------|-----------|----------------|-------------|
| < 768px | Hidden (hamburger) | Full width | Hidden (drawer) |
| 768–1023px | Collapsed (icons only) | Full width | Hidden (drawer) |
| 1024–1279px | Collapsed (icons only) | Flex | Collapsed (icons) |
| ≥ 1280px | Full (240px) | Flex | Full (320px) |

---

## Animations & Motion

- **Duration:** `150ms` (micro), `250ms` (standard), `400ms` (emphasis)
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` (default)
- **Reduce motion:** Respect `prefers-reduced-motion` — disable Office Floor animations, collapse transitions to instant

---

## Accessibility

- Minimum contrast: WCAG AA (4.5:1 body text, 3:1 large text)
- Focus rings visible on all interactive elements
- Keyboard navigable: all views support Tab, Enter, Escape
- Screen reader labels on all icons and interactive elements

---

*Last updated: Template v1.0 — Customize everything above this line for your brand.*
