# Security Checklist — New Forge Deployment

Run through this checklist for every new Forge deployment. Every box must be checked before going live.

---

## Credentials & Secrets

- [ ] `DATABASE_URL` is in `.env.supabase`, not hardcoded in any source file
- [ ] All API keys stored in `/home/node/.openclaw/.env.*` files (not workspace files)
- [ ] `.env*` files listed in `.gitignore`
- [ ] No credentials in git history (`git log --all -p | grep -i "password\|secret\|api.key\|token"`)
- [ ] Agent prompts reference env files, never contain actual credential values
- [ ] `db.js` reads from `process.env.DATABASE_URL` only (no fallback to hardcoded string)

## Database

- [ ] RLS enabled on ALL `cc_*` tables (run `org/security/RLS_POLICIES.sql`)
- [ ] `org_id` column exists on all tables (for multi-tenant isolation)
- [ ] Service role used only for admin/setup operations
- [ ] Anonymous role has zero access
- [ ] All queries use parameterized inputs (no string interpolation in SQL)

## Infrastructure

- [ ] Gateway bound to `localhost` (not `0.0.0.0`)
- [ ] SSH keys used for git (not HTTPS with embedded passwords)
- [ ] No SSH private keys in the repository
- [ ] Reverse proxy with TLS if remote access is needed

## Command Center

- [ ] Auth gate enabled (admin-only access)
- [ ] API endpoints validate auth tokens
- [ ] Rate limiting configured on write endpoints
- [ ] Input sanitization on comments, messages, and user inputs
- [ ] CORS restricted to known origins (no wildcard on authenticated routes)

## Agent Permissions

- [ ] Destructive command safety enforced (`trash` > `rm`)
- [ ] External actions (email, social, purchases) require approval
- [ ] Agents cannot access raw credentials — only environment variables
- [ ] Subagents run in sandboxed sessions

## Monitoring & Operations

- [ ] Credential audit script runs during heartbeats (`org/security/CREDENTIAL_AUDIT.sh`)
- [ ] Audit logging enabled for external actions
- [ ] Credential rotation schedule documented and followed
- [ ] Incident response procedure known (see `org/SECURITY.md` §6)

---

## Post-Setup Verification

Run these commands after setup:

```bash
# 1. Check for leaked credentials
chmod +x org/security/CREDENTIAL_AUDIT.sh
./org/security/CREDENTIAL_AUDIT.sh

# 2. Verify RLS is enabled
psql "$DATABASE_URL" -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'cc_%';"

# 3. Verify .gitignore
grep -q '.env' .gitignore && echo "✅ .env in .gitignore" || echo "❌ Missing .env in .gitignore"

# 4. Check db.js for hardcoded URLs
grep -n 'postgresql://' org/engine/db.js && echo "❌ Hardcoded URL found" || echo "✅ No hardcoded URLs"
```
