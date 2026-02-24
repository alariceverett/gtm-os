# Minimum Components per View Rule (Business-Facing Pages)

Marker: `min-components-per-view-rule-v1`

## Rule

For business-facing routes (`/`, `/strategy`, `/targeting`, `/actions`, `/relationships`, `/pilot`, `/comms`):

1. **Set a hard cap on primary components per page**
   - Home, Strategy, Actions, Relationships, Pilot, Comms: **max 4 primary blocks**
   - Targeting: **max 3 primary blocks**
2. **One dominant objective per page**
   - The page header must state a single objective in plain language.
3. **One dominant CTA per page**
   - Include exactly one visually dominant CTA in the header (`.dominant-cta`).
4. **Inline purpose sentence required**
   - Header must include a sentence beginning with `Page purpose:`.
5. **Reduce context switching**
   - Remove duplicate cross-links and low-value secondary panels.
   - Keep secondary navigation to one compact set in the final block only when needed.

## PR / Reviewer Checklist

- [ ] Page includes `Page purpose:` sentence in header.
- [ ] Header includes one dominant CTA.
- [ ] Primary block count stays within cap for the route.
- [ ] Removed or merged at least one low-value block when above cap.
- [ ] Added/updated `data-verify` marker for minimum-components pass (e.g., `*-min-components-v1`).
- [ ] Verified route still preserves primary workflow (Targeting → Actions → Relationships → Pilot).
