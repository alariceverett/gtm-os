# Setup Production Migration Automation

## Option 1: GitHub Actions (Recommended)

### Step 1: Get Supabase Access Token

1. Go to https://app.supabase.com/account/tokens
2. Click "New Token"
3. Name it "GitHub Actions Migration"
4. Copy the token

### Step 2: Add GitHub Secret

1. Go to https://github.com/EJKIV/adzeta-gtmos/settings/secrets/actions
2. Click "New repository secret"
3. Name: `SUPABASE_ACCESS_TOKEN`
4. Value: Paste your token from Step 1
5. Click "Add secret"

### Step 3: Test the Workflow

Push any change to main:
```bash
git add migrations/019_test.sql
git commit -m "Test automated migration"
git push origin main
```

Go to https://github.com/EJKIV/adzeta-gtmos/actions and watch the workflow run.

---

## Option 2: Automated via REST API (No CLI needed)

If GitHub Actions fails, create this script to run migrations automatically:

### Create `scripts/migrate-production.mjs`:

```javascript
// Script to run migrations against production
// Uses SUPABASE_SERVICE_ROLE_KEY from environment

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing environment variables');
  process.exit(1);
}

async function runMigrations() {
  const migrationsDir = './migrations';
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`Running ${file}...`);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`Failed: ${file}`, error);
      process.exit(1);
    }

    console.log(`✅ ${file}`);
  }
}

runMigrations();
```

### Add to package.json scripts:
```json
{
  "scripts": {
    "migrate:prod": "node scripts/migrate-production.mjs"
  }
}
```

### Then run:
```bash
# Add production credentials to .env.production
# Then:
npm run migrate:prod
```

---

## Option 3: Vercel Integration

Vercel can trigger migrations on deploy:

1. Add `vercel.json`:
```json
{
  "buildCommand": "npm run build && npm run migrate:prod"
}
```

2. Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel Environment Variables

⚠️ **Warning**: This runs migrations on every deploy. Use with caution.

---

## Verification

After automation is set up, verify it works:

1. Create test migration: `migrations/999_test.sql`
2. Commit and push
3. Check GitHub Actions → Should show green ✅
4. Verify in Supabase Dashboard → SQL Editor → Run `SELECT * FROM profiles`

---

## Troubleshooting

### "Could not find the function"
- The `exec_sql` RPC function doesn't exist in production
- Create it manually in Supabase Dashboard:
```sql
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### "Permission denied"
- Supabase Access Token doesn't have permissions
- Use Service Role Key instead (more powerful, keep secret!)

### "Authentication failed"
- Check token hasn't expired
- Re-generate token in Supabase dashboard
