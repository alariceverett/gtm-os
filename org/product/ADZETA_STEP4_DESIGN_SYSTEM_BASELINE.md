# AdZeta GTM Motion — Step 4 Design System Baseline (Approval-Ready)

**Scope:** Professional presentation baseline for AdZeta Command Center GTM motion pages (funnels, sequences, lifecycle, qualified accounts, operator tasks).  
**Status:** Ready for implementation and design QA.  
**Theme:** Dark-first operations UI.

---

## 1) Foundation Token Set

## 1.1 Typography Tokens

**Font families**
- `font.heading`: `system-ui, -apple-system, "Segoe UI", Inter, sans-serif`
- `font.body`: `system-ui, -apple-system, "Segoe UI", Inter, sans-serif`
- `font.mono`: `"SF Mono", "Fira Code", "Consolas", monospace`

**Type scale**
- `text.xs`: 11px / 16px (captions, micro-metadata)
- `text.sm`: 12px / 18px (labels, secondary values)
- `text.base`: 14px / 21px (default body)
- `text.md`: 16px / 24px (subheads)
- `text.lg`: 20px / 28px (section headers)
- `text.xl`: 24px / 32px (page titles)
- `text.2xl`: 32px / 40px (hero KPI moments)

**Weights**
- `weight.regular`: 400
- `weight.medium`: 500
- `weight.semibold`: 600
- `weight.bold`: 700

**Usage rules**
- Max 3 text sizes per panel to reduce visual noise.
- Numeric KPI values use `weight.semibold` minimum.
- Avoid pure bold body paragraphs; reserve bold for emphasis and headings.

---

## 1.2 Spacing Tokens (8px base)

- `space.0`: 0
- `space.1`: 4px
- `space.2`: 8px
- `space.3`: 12px
- `space.4`: 16px
- `space.5`: 20px
- `space.6`: 24px
- `space.8`: 32px
- `space.10`: 40px
- `space.12`: 48px
- `space.16`: 64px

**Layout rhythm**
- Card internal padding: `space.4`
- Section vertical gap: `space.6`
- Page block separation: `space.8`
- Dense table row Y padding: `space.2`
- Form vertical control gap: `space.3`

---

## 1.3 Color Role Tokens (AdZeta palette)

### Core neutrals (dark operations baseline)
- `color.bg.app`: `#0C0A09`
- `color.bg.surface`: `#1C1917`
- `color.bg.surfaceAlt`: `#292524`
- `color.border.default`: `#44403C`
- `color.text.primary`: `#F5F5F4`
- `color.text.secondary`: `#A8A29E`
- `color.text.muted`: `#78716C`

### Brand/action roles
- `color.action.primary`: `#3B82F6`
- `color.action.primaryHover`: `#2563EB`
- `color.action.primaryPressed`: `#1D4ED8`
- `color.info`: `#06B6D4`

### Semantic states
- `color.success`: `#22C55E`
- `color.warning`: `#F59E0B`
- `color.danger`: `#EF4444`

### GTM domain accents (for tags/rails, not primary CTA)
- `color.gtm.growth`: `#15803D`
- `color.gtm.ops`: `#DC4826`
- `color.gtm.product`: `#B45309`
- `color.gtm.security`: `#57534E`

**Color governance**
- Only `color.action.primary*` used for primary CTAs and active focus indicators.
- Semantic colors cannot be used as decorative accents without semantic meaning.
- Maintain minimum WCAG AA contrast (4.5:1 body, 3:1 large text/UI).

---

## 1.4 Radius Tokens

- `radius.sm`: 6px (inputs, small buttons)
- `radius.md`: 8px (cards, standard buttons)
- `radius.lg`: 12px (modals, large panels)
- `radius.pill`: 999px (badges, pills)

---

## 1.5 Shadow Tokens

Dark-first, restrained elevation:
- `shadow.none`: `none`
- `shadow.sm`: `0 1px 2px rgba(0,0,0,0.30)`
- `shadow.md`: `0 4px 12px rgba(0,0,0,0.35)`
- `shadow.lg`: `0 10px 24px rgba(0,0,0,0.40)`
- `shadow.focus`: `0 0 0 2px rgba(59,130,246,0.50)`

**Rule:** Prefer border + contrast first; use shadow only for layered surfaces (menus, modals, popovers).

---

## 2) Component Standards

## 2.1 Cards (KPI, pipeline, activity)

**Base spec**
- Background: `color.bg.surface`
- Border: `1px solid color.border.default`
- Radius: `radius.md`
- Padding: `space.4`
- Gap inside card: `space.3`

**Hierarchy**
- Header row: title (`text.sm`, `weight.medium`) + utility action
- Primary metric: `text.xl`, `weight.semibold`
- Supporting context: `text.sm`, `color.text.secondary`

**Variants**
- `card.default`: static info
- `card.interactive`: hover lift (`shadow.sm`, bg->surfaceAlt)
- `card.alert`: left accent strip (warning/danger) + semantic icon

---

## 2.2 Tables (qualified accounts, sequence enrollments)

**Structure**
- Header height: 40px
- Row height: 44px min
- Cell padding: `8px 12px`
- Header text: `text.sm`, `weight.medium`, `color.text.secondary`

**Behavior**
- Sticky header on scrollable datasets
- Sort state shown with icon + aria label
- Zebra rows optional via subtle alpha overlay only (not heavy contrast)

**Data emphasis**
- Primary entity column left-aligned and semibold
- Numeric columns right-aligned with tabular numerals
- Status columns render as badge tokens (not raw text only)

---

## 2.3 Forms (filters, sequence setup, operator updates)

**Controls**
- Input/select/textarea height: 36px min (textarea auto grows)
- Border: `1px solid color.border.default`
- Background: `color.bg.surface`
- Text: `color.text.primary`
- Placeholder: `color.text.muted`
- Radius: `radius.sm`

**Form layout**
- Label above field (`text.sm`, medium)
- Helper text below field (`text.xs`, secondary)
- Vertical spacing between controls: `space.3`
- Group sections: `space.6`

**Validation**
- Error state uses danger border + inline message (never color-only)
- Required fields marked with `*` + aria-required

---

## 2.4 CTAs (buttons/links)

**Sizes**
- `cta.sm`: 32px height
- `cta.md`: 36px height (default)
- `cta.lg`: 40px height

**Variants**
- `cta.primary`: blue fill, light text
- `cta.secondary`: surfaceAlt fill, border, primary text
- `cta.ghost`: transparent, secondary text, hover surfaceAlt
- `cta.danger`: danger fill, light text (destructive confirmations only)

**Rules**
- One primary CTA per card/section.
- Text should be action-first verbs: “Launch sequence”, “Export summary”, “Resolve alert”.
- Disabled CTA must remain legible and explain unmet requirement nearby.

---

## 2.5 Badges (stage, status, risk)

**Tokenized badge model**
- Shape: `radius.pill`
- Padding: `4px 8px`
- Font: `text.xs`, `weight.medium`

**Semantic mapping**
- `badge.success`: qualified, complete
- `badge.warning`: pending, at risk
- `badge.danger`: blocked, failed
- `badge.info`: in progress, new
- `badge.neutral`: backlog, unknown

**Usage limits**
- Max 2 badges per row cell before collapsing into `+N` overflow.
- Do not mix more than 3 semantic badge colors in a single viewport section.

---

## 3) Interaction States (System-wide)

## 3.1 Empty States

**When:** No records yet or filters remove all results.  
**Pattern:** icon + one-sentence explanation + one primary next step.

- Title: concise (“No qualified accounts yet”)
- Body: reason + action (“Run qualification snapshot to populate this table.”)
- CTA: relevant and immediate (“Run snapshot”)

## 3.2 Loading States

**When:** Initial page fetch, panel refresh, mutation in progress.

- Page load: skeleton blocks matching final layout (not spinner-only)
- Table load: 5–8 skeleton rows
- Button load: preserve width; replace label with progress indicator
- Long task (>2s): add status text (“Syncing lifecycle events…”) 

## 3.3 Error States

**When:** Fetch fail, validation fail, system fail.

- Inline errors near failed component first
- Global toast for cross-page failures
- Copy format: `What happened` + `What to do next`
  - Example: “Couldn’t load sequence enrollments. Retry or check Supabase connectivity.”
- Provide retry action where safe
- Include non-sensitive error code for support traceability

## 3.4 Success States

**When:** Save, publish, import, or batch action completes.

- Use lightweight confirmation toast for low-risk actions
- Use inline success summary for high-impact actions
  - Example: “Sequence launched: 124 contacts enrolled.”
- Auto-dismiss toast in 3–5 seconds unless user focus is inside it

---

## 4) Design QA Checklist (Consistency Gate)

Use this before merge/release for GTM pages.

### A. Token Compliance
- [ ] No hardcoded hex values in components outside token definitions
- [ ] Typography uses approved scale and weights
- [ ] Spacing follows 8px token scale (no arbitrary 13/18/22 values)
- [ ] Radius and shadows use token set only

### B. Visual Hierarchy
- [ ] Every page has one clear primary CTA per major section
- [ ] KPI emphasis is consistent (size/weight/color)
- [ ] Secondary metadata is visually de-emphasized but readable
- [ ] No overuse of semantic colors for decorative styling

### C. Component Fidelity
- [ ] Cards use standard border/radius/padding specs
- [ ] Tables preserve row height, alignment, sticky headers where needed
- [ ] Forms have labels, helper text, and inline validation patterns
- [ ] Badges use semantic mapping and approved density limits

### D. Interaction States
- [ ] Empty states include explicit next action
- [ ] Loading states use skeletons aligned to final UI structure
- [ ] Error states include user guidance and retry path
- [ ] Success feedback appears and clears predictably

### E. Accessibility & UX
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works for all interactive controls
- [ ] Focus ring visible and consistent on all focusable elements
- [ ] Icons/buttons include accessible labels
- [ ] Reduced-motion preference respected

### F. GTM Motion Specific Checks
- [ ] Funnel/sequence/lifecycle statuses map to semantic badge colors consistently
- [ ] Time-based metrics (daily/weekly) use consistent date/time format
- [ ] Critical operational alerts visually outrank informational notices
- [ ] Tables and cards remain readable at `lg` and `xl` dashboard breakpoints

---

## Implementation Note

This baseline should be encoded as design tokens first, then consumed by components. Any exception must be documented as a temporary waiver with owner + expiry date.
