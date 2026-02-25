# NOW item 4 — DONE proof (2026-02-22)

## Final placement pattern enforced
- Pattern: **embedded checklist card in `/ops` Start here panel** (not drawer/modal).
- `/ops` location marker: `data-verify="ops-start-here-panel-v1 ops-review-checklist-placement-v2"`
- Embedded checklist marker: `data-verify="ops-review-checklist-card-v1 ops-review-checklist-embedded-v2 ops-review-checklist-one-click-v1"`

## One-click discoverability
- From `/ops` Start here, full doc is one click via button link to `/ops/reviewer-checklist`.
- Route check: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1981/ops/reviewer-checklist` => `200`

## Checklist constraints
- Quick checklist bullets: `8` (<=8 confirmed).
- Quick checklist links full doc: `apps/gtm-command-center/docs/reviewer-home-ops-checklist-full.md`.

## Command-level smoke check reference
- Embedded in quick in-app checklist and full doc:
  - `curl -s http://127.0.0.1:1981/ops | grep -q "ops-review-checklist-card-v1"`
- Live smoke result: `PASS`.

## Acceptance evidence (captured)
- `quick_bullets=8`
- `quick_full_doc_link=1`
- `server_embedded_marker=1`
- `server_start_here_marker=1`
- `full_has_command_smoke=1`
- `workq_item4_done=Status: DONE`
- `route_status=200`
- `ops_marker_smoke=PASS`
