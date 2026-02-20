# Model Configuration

Forge uses a 4-tier model system. Pick your provider (Anthropic or OpenAI), and every agent/cron job references a **tier** instead of a specific model name. Change provider once → everything updates.

## Tiers

| Tier | Name | Usage | Anthropic | OpenAI | Approval |
|------|------|-------|-----------|--------|----------|
| 1 | **Routine** | ~80% | claude-haiku-4.5 | gpt-5-mini | None |
| 2 | **Complex** | ~15% | claude-sonnet-4.5 | gpt-5.2 | None |
| 3 | **Strategic** | ~4% | claude-opus-4.6 | o3 | CEO |
| 4 | **Premium** | <1% | claude-opus-4.6 (max thinking) | gpt-5.2-pro | Board |

## When to Use Each Tier

### Tier 1 — Routine
Templates, status reports, simple lookups, formatting, boilerplate generation, daily standups. The workhorse — use this by default.

### Tier 2 — Complex
Creative writing, multi-step reasoning, code generation, skill building, prompt evolution, weekly reviews. When quality matters but it's not mission-critical.

### Tier 3 — Strategic
High-stakes decisions, deep analysis, competitive strategy, architecture decisions. Requires CEO awareness/approval before use.

### Tier 4 — Premium
Board-level decisions, mission-critical analysis, existential risk assessment. Requires explicit board or CEO approval. Use sparingly — costs are 10-100x Tier 1.

## Cost Reference

### Anthropic (per M tokens: input/output)
- claude-haiku-4.5: $1.00 / $5.00
- claude-sonnet-4.5: $3.00 / $15.00
- claude-opus-4.6: $15.00 / $75.00

### OpenAI (per M tokens: input/output)
- gpt-5-mini: $0.25 / $2.00
- gpt-5.2: $1.75 / $14.00
- o3: $2.00 / $8.00
- gpt-5.2-pro: $21.00 / $168.00

## Configuration

Edit `org/models.json` to change provider or customize model names. Run `setup.sh` to set provider interactively.

## In Prompts and Cron Jobs

Reference tiers, not model names:
- ✅ `model: tier:complex` or "Use Tier 2 (Complex) for this task"
- ❌ `model: anthropic/claude-sonnet-4-20250514`

The active model name resolves from `models.json` based on your chosen provider.
