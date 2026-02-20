# App Bootstrap Assumptions (v1, guess-first)

## Operating Mode
- Use intelligent defaults and propose editable assumptions.
- Ask for confirmation only on high-impact decisions.

## Assumed Product Direction
- **Working app name:** AdZeta GTM Command Center
- **Core problem guess:** GTM leaders lack one tight operating surface for forecast confidence, pipeline health, deal risk, and weekly actions.
- **Primary users guess:** CRO/Revenue leaders first; RevOps and frontline managers second.

## Default Decisions for This Setup
1. **Auth:** Supabase Auth (email/password + magic link; Google OAuth optional)
2. **Data sensitivity:** Proprietary/high by default
3. **Integrations:** Deferred to phase 2 unless blocking v1
4. **Deployment:** Vercel (staging first)
5. **v1 success bar:** "Impress" in first demo and support weekly GTM operating rhythm

## Initial v1 Surface (inferred, not rigid)
- Executive overview dashboard
- Pipeline health view
- Deal risk board
- Weekly GTM brief generator

## User Confirmation Policy
Only interrupt user for:
- legal/compliance constraints
- identity provider constraints
- integration blockers
- deployment/provider constraints

All other fields proceed with defaults and editable outputs.
