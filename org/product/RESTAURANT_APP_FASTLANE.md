# Restaurant App Fastlane (Top 3 Speed Improvements)

Goal: reduce time-to-working-slice and tighten delegation handoffs for the restaurant app stream.

## 1) One-command local execution
Use root-level scripts so anyone can run the app without directory hopping.

- `npm run restaurant:dev`
- `npm run restaurant:build`
- `npm run restaurant:lint`

**Expected gain:** faster start/restart loop and fewer command mistakes.

## 2) Vertical-slice-first scope lock
Lock MVP to one complete flow only:
1. Browse menu items
2. Add items to order
3. Submit order
4. Show order on kitchen board

Any work outside this flow goes to backlog unless it blocks MVP.

**Expected gain:** avoids parallel scope creep and gets a demoable artifact quickly.

## 3) Delegation-ready task packets
Every restaurant task must include:
- outcome (WHAT)
- urgency/business reason (WHY)
- acceptance checks
- owner + fallback owner
- report-back format

Use Forge delegation chain (CEO → Head of Product/Operations → agents).

**Expected gain:** lower rework from ambiguous tasks and faster completion reports.

---

## 72-hour execution target
- Day 1: schema + menu + order form shell
- Day 2: submit order + kitchen status board
- Day 3: staging deploy + verification + after-action
