# GTM Command Center (MVP data read path)

This app now has a live DB read path for MVP KPI retrieval.

## Run

```bash
cd apps/gtm-command-center
DATABASE_URL="..." npm run kpis
```

## Output

Returns a JSON KPI payload from the connected AdZeta database:
- delegations_24h
- completed_delegations_24h
- active_process_runs
- open_priorities
- avg_quality_7d

This is the first integration step before wiring dashboard UI cards.
