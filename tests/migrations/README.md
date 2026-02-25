# Migration Testing Guide

This directory contains tests for database migrations to ensure data integrity and schema correctness.

## Quick Start

1. **Create a migration** in your migrations directory (e.g., `migrations/001_feature_name.sql`)

2. **Create a corresponding test file**:
   ```bash
   cp migration.test.template.ts 001_feature_name.test.ts
   ```

3. **Customize the test** for your specific migration requirements

4. **Run the tests**:
   ```bash
   npm test
   # or
   npx vitest run tests/migrations/
   ```

## Test File Naming Convention

For a migration file at:
- `migrations/001_feature_name.sql` → Test: `tests/migrations/001_feature_name.test.ts`
- `supabase/migrations/002_update.sql` → Test: `tests/migrations/002_update.test.ts`

## Supported Migration Directories

The pre-commit hook checks for migrations in:
1. `migrations/` (root level)
2. `supabase/migrations/`
3. `db/migrations/`
4. `apps/*/migrations/`
5. `apps/*/supabase/migrations/`

## Pre-commit Hook

The pre-commit hook (`.husky/pre-commit`) automatically:
1. Detects staged migration files
2. Verifies corresponding test files exist
3. Blocks commits if tests are missing
4. Runs lint-staged for code formatting

### Bypassing the Hook (Emergency Only)

```bash
git commit --no-verify -m "Your message"
```

**Note:** Use `--no-verify` only in emergencies. Always add tests later!

## Test Coverage Checklist

Each migration test should verify:

- [ ] Tables created/modified exist
- [ ] Columns have correct names and types
- [ ] Primary keys are defined
- [ ] Foreign keys reference correct tables
- [ ] Indexes are created for performance
- [ ] Constraints (unique, check, not null) are correct
- [ ] RLS policies are created if applicable
- [ ] Triggers/functions are created if applicable
- [ ] Data migrations ran successfully (if applicable)
- [ ] Rollback works (if down migration exists)

## Example Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Migration: 001_feature_name', () => {
  beforeAll(async () => {
    // Setup test database connection
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should create the feature table', async () => {
    // Verify table exists
  });

  it('should have correct columns', async () => {
    // Verify column names and types
  });
});
```

## Troubleshooting

### Commit blocked due to missing test

```bash
# Create test from template
cp tests/migrations/migration.test.template.ts tests/migrations/YOUR_MIGRATION_NAME.test.ts

# Edit and customize the test
# Then commit again
git add tests/migrations/YOUR_MIGRATION_NAME.test.ts
git commit -m "Add migration with tests"
```

### Test fails but migration is correct

1. Check your test database connection
2. Verify the migration was applied to the test database
3. Review the test assertions for accuracy

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)
- [PostgreSQL Information Schema](https://www.postgresql.org/docs/current/information-schema.html)
