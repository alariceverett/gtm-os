# Monday Demo: Known Limitations + Workarounds

## 1) Local-first auth is basic (not enterprise identity)

**Limitation**
- Write actions use static HTTP Basic auth (`operator` / `admin`), not SSO/OIDC/MFA.

**Workaround for demo**
- Pre-export credentials in shell and use authenticated `curl` examples.
- Keep demo scoped to operator flows; avoid identity architecture deep dive unless asked.

---

## 2) Supabase KPI SQL parity is partial

**Limitation**
- In some Supabase runtime cases, KPI values can be placeholder or not fully parity-matched to direct PG mode.

**Workaround for demo**
- Prefer known-good local/direct-DB demo environment.
- Anchor on API outputs (`/api/command-center/kpis`, `/api/workflows/completeness`) and discuss this as an active follow-on.

---

## 3) Alert engine is config-first, state engine not fully wired

**Limitation**
- Alert panel currently reflects rule configuration and placeholders more than real-time alert firing history.

**Workaround for demo**
- Position alerts as “policy and ownership visibility now; live state engine next.”
- Use `lib/alert-rules.json` edits as proof of tunable rules/owners/SLA.

---

## 4) Deployment health integrations are baseline placeholders

**Limitation**
- GitHub/Vercel health indicators are not fully live-integrated in this local-first pass.

**Workaround for demo**
- Use local health + readiness endpoints as operational source of truth:
  - `/health`
  - `/api/readiness/monday`
  - `/api/metrics/snapshot`

---

## 5) Trigger automation has evaluate/apply split

**Limitation**
- Trigger evaluation can run without write, but applying actions (`apply:true`) requires authenticated write path and mapped sequence context.

**Workaround for demo**
- Run `apply:false` first to show deterministic decisioning.
- Then run `apply:true` with operator auth only if you want to demonstrate commit behavior.

---

## 6) Data freshness depends on seeded/demo data

**Limitation**
- Empty tables or sparse sample rows can make panels look inactive.

**Workaround for demo**
- Pre-seed or pre-ingest one sample lifecycle thread:
  1. sequence enrollment
  2. trigger evaluation
  3. meeting transcript ingest
  4. follow-up advance
- Keep one “clean” lead key (`lead:acme:123`) for repeatable replay.

---

## 7) Voice-note ingestion is parser placeholder quality

**Limitation**
- Voice ingestion currently parses transcript text with lightweight extraction; accuracy is baseline.

**Workaround for demo**
- Use clean, structured transcript text samples.
- Emphasize that this proves ingestion and routing, not final NLP quality.

---

## Suggested demo phrasing for limitations

“We’re showing an operator-ready local-first loop with explicit verification markers and API-backed transitions. The remaining gaps are mostly integration hardening (identity, live alert state, external deploy telemetry), not workflow design uncertainty.”
