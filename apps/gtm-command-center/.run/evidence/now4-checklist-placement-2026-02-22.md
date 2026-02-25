# NOW item 4 blocker closure — checklist placement

Decision: **embedded card in `/ops` Start here panel** (details toggle), with optional link to full doc. No drawer/modal detour.

## `/ops` marker
- `data-verify="ops-start-here-panel-v1 ops-review-checklist-placement-v2"`
- Embedded checklist marker: `data-verify="ops-review-checklist-card-v1 ops-review-checklist-embedded-v1"`

## Acceptance evidence (local render on port 1991)
Command:

```bash
PORT=1991 node server.mjs
python3 verify snippet -> /ops
```

Observed:
- `start_here=True`
- `placement_v2=True`
- `embedded_v1=True`
- `found_checklist=True`
- `bullets=8` (meets <=8 requirement)
- `checklist_after_start_here=True` (one-click discoverability from Start here)
