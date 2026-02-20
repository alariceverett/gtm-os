# Design System — Fill In Your Brand Details

> **This is your design system starter.** It ships with sensible defaults so everything works out of the box. Replace the defaults with your brand as you grow.

---

## Brand Colors

> _Replace these with your actual brand palette._

| Token | Default | Your Brand |
|-------|---------|------------|
| `brand-primary` | `#3B82F6` (blue) | ___________ |
| `brand-secondary` | `#8B5CF6` (purple) | ___________ |
| `brand-accent` | `#06B6D4` (cyan) | ___________ |
| `brand-dark` | `#0C0A09` | ___________ |
| `brand-light` | `#F5F5F4` | ___________ |

### Semantic Colors

| Token | Default | Notes |
|-------|---------|-------|
| `success` | `#22C55E` | Positive states, completions |
| `warning` | `#F59E0B` | Attention needed, pending |
| `danger` | `#EF4444` | Errors, destructive, blocked |
| `info` | `#06B6D4` | Informational highlights |

---

## Typography

> _System fonts by default. Swap in your brand fonts when ready._

| Role | Default | Your Brand |
|------|---------|------------|
| Headings | `system-ui, -apple-system, sans-serif` | ___________ |
| Body | `system-ui, -apple-system, sans-serif` | ___________ |
| Monospace | `'SF Mono', 'Fira Code', monospace` | ___________ |

### Weights

| Weight | Use |
|--------|-----|
| 400 (Regular) | Body text |
| 500 (Medium) | Labels, nav items |
| 600 (Semibold) | Subheadings, emphasis |
| 700 (Bold) | Page titles, headings |

---

## Spacing

**Grid: 8px base unit**

| Token | Value | Use |
|-------|-------|-----|
| `space-1` | 4px | Tight gaps |
| `space-2` | 8px | Default gap, input padding |
| `space-3` | 12px | Compact card padding |
| `space-4` | 16px | Standard card padding |
| `space-6` | 24px | Section spacing |
| `space-8` | 32px | Large spacing |
| `space-12` | 48px | Page-level spacing |

---

## Component Library

> _Document your component conventions as you build them._

### Buttons

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Primary | `brand-primary` | white | none |
| Secondary | transparent | `brand-primary` | 1px `brand-primary` |
| Ghost | transparent | `text-secondary` | none |
| Danger | `danger` | white | none |

### Cards

- Border radius: `8px`
- Shadow: none (border-based) or `0 1px 3px rgba(0,0,0,0.1)`
- Padding: `space-4`

### Inputs

- Height: `36px`
- Border: `1px solid border`
- Focus ring: `2px solid brand-primary`
- Border radius: `6px`

### Modals

- Backdrop: `rgba(0,0,0,0.6)`
- Width: `480px` (sm), `640px` (md), `800px` (lg)
- Border radius: `12px`

---

## Voice & Tone

> _How does your product communicate? Fill in your brand voice._

| Attribute | Default | Your Brand |
|-----------|---------|------------|
| Personality | Professional, competent, calm | ___________ |
| Formality | Semi-formal — contractions OK, no slang | ___________ |
| Humor | Occasional, understated | ___________ |
| Error messages | Helpful, specific, no blame | ___________ |
| Empty states | Encouraging, suggest next action | ___________ |

### Writing Rules

1. Be direct. Say what you mean.
2. Use active voice.
3. Lead with the action ("Create a task" not "A task can be created").
4. Error messages: what happened → what to do about it.
5. No jargon unless your audience expects it.

---

## Icons

> _Pick an icon set and stick with it._

| Option | Package | Style |
|--------|---------|-------|
| **Lucide** (default) | `lucide-react` | Clean, consistent, MIT |
| Heroicons | `@heroicons/react` | Tailwind-adjacent |
| Phosphor | `phosphor-react` | Flexible weight system |

---

## Dark Mode

The Command Center ships dark by default (professional, reduces eye strain for dashboards). If you need light mode:

- Define a `light` color set alongside the defaults
- Toggle via `prefers-color-scheme` or manual switch
- Ensure all semantic colors meet WCAG AA in both modes

---

*This file is meant to evolve. Start with defaults, replace as your brand solidifies. Reference [UI_STANDARDS.md](UI_STANDARDS.md) for the full technical specification.*
