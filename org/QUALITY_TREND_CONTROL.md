# QUALITY_TREND_CONTROL.md

## Purpose
Treat quality score as an operational KPI with trend-based controls.

## Score components
1) UX clarity
2) Enterprise visual consistency
3) Golden-path reliability
4) Actionability clarity
5) Data/truth consistency

## Rules
- Track 7-day trend and slope (up/flat/down)
- Alert if score declines 2 cycles in a row
- Require reason tag on each decline (regression/integration/copy/data/perf)
- Auto-correction on decline:
  1) freeze net-new features for one cycle
  2) run focused fix burst on lowest component
  3) require proof pass before resuming expansion

## Release thresholds
- Interim floor: 7/10
- Target operating floor: 8/10
- If below floor, release blocked
