# UI Design Token Drift Report

- Files scanned: **1**
- UI roots scanned: server.mjs
- Report path: `.run/design-token-drift-report.md`
- Violations: **3**

## Fail conditions

- CI fails when one or more raw color/spacing/typography literals are found in tracked UI files.
- Any report with `Violations > 0` returns exit code `1` unless override mode is explicitly enabled.

## Override notes

- Temporary one-line bypass: append `design-token-lint: ignore` to a specific line (must include cleanup follow-up).
- Temporary run bypass: set `ALLOW_DESIGN_TOKEN_DRIFT=1` or pass `--allow-drift` to keep CI green while report still records violations.
- Required follow-up for overrides: include owner, expiry date, and replacement-token plan in the related PR/task.

## Summary by category

- color: 1
- spacing: 1
- typography: 1

## Violations

- server.mjs:612 [color] Raw color literal detected
  - match: `#de347f`
  - line: `button,.button-link{background:linear-gradient(135deg,#de347f 0%,#ff5d74 100%);...}`
- server.mjs:615 [spacing] Raw spacing value detected
  - match: `padding:.24rem .62rem`
  - line: `.links a{...padding:.24rem .62rem;...}`
- server.mjs:605 [typography] Raw typography value detected
  - match: `font-size:.95rem`
  - line: `h2{font-size:.95rem;line-height:1.3;...}`
