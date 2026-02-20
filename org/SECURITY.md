# Security Guide — Project Forge

This document defines the security posture for every Forge deployment. Every agent, every operator, every deployment must follow these rules. No exceptions.

---

## 1. Credential Management

### The Golden Rule

**NEVER store credentials in workspace files.**

This means: not in `AGENTS.md`, `TOOLS.md`, `MEMORY.md`, `SOUL.md`, `USER.md`, daily memory files, or any `.md`/`.js`/`.json` file in the workspace tree. These files get injected into session context and leak to group chats, subagents, and logs.

### Where Secrets Go

All secrets live in `/home/node/.openclaw/.env.*` files:

| File | Contents |
|------|----------|
| `.env.supabase` | `DATABASE_URL`, Supabase keys |
| `.env.email` | SMTP credentials, email API keys |
| `.env.accounts` | Social media tokens, platform credentials |
| `.env.api-keys` | Third-party API keys (Stripe, etc.) |

### How Agents Reference Secrets

Agent prompts should say:
> "Read DATABASE_URL from environment" or "Use the API key from `.env.api-keys`"

Agent prompts must **never** contain:
> `sk-abc123...`, `postgresql://user:pass@host/db`, or any actual credential value

### Loading Pattern

```bash
# In scripts:
source /home/node/.openclaw/.env.supabase
# Or:
export $(grep -v '^#' /home/node/.openclaw/.env.supabase | xargs)
```

```javascript
// In Node.js (db.js already does this):
const DB_URL = process.env.DATABASE_URL;
```

---

## 2. Database Security

### Row Level Security (RLS)

**Enable RLS on ALL tables.** No exceptions. Even if you're single-tenant today, you'll be multi-tenant tomorrow.

- See `org/security/RLS_POLICIES.sql` for ready-to-run policies
- Every `cc_*` table gets RLS enabled
- Policies filter by `org_id` for authenticated users
- Service role bypasses RLS (for admin/setup operations only)
- Anonymous role gets **nothing**

### Connection String

- `DATABASE_URL` comes from environment only (`process.env.DATABASE_URL`)
- Never hardcode connection strings in committed files
- `db.js` must read from `process.env.DATABASE_URL` — the setup script configures this
- If `DATABASE_URL` appears in any file other than `.env.*`, it's a security violation

### SQL Injection Prevention

- **Always use parameterized queries.** The engine scripts already do this:
  ```javascript
  // CORRECT:
  await client.query('SELECT * FROM cc_decisions WHERE decision_id = $1', [id]);
  
  // NEVER:
  await client.query(`SELECT * FROM cc_decisions WHERE decision_id = '${id}'`);
  ```
- Every new engine script must follow this pattern
- The credential audit script checks for string interpolation in SQL

---

## 3. Agent Permission Model

### Credential Isolation

- Agents **do not** have direct access to credentials
- The CEO agent can read org files but must never see raw API keys
- Task agents operate in sandboxed subagent sessions with limited scope
- Credentials are loaded by the runtime environment, not by agent prompts

### External Action Controls

These actions require **explicit human approval** or pre-approved authority defined in `org/DECISION_FRAMEWORK.md`:

| Action | Approval Required |
|--------|-------------------|
| Send email | Human approval or CEO-autonomous authority |
| Post to social media | Human approval |
| Make purchases | Human approval (always) |
| Deploy to production | Human approval or CEO-autonomous authority |
| Delete data | Confirmation required |
| API calls to external services | Pre-approved in decision framework |

### Destructive Operation Safety

- **`trash` over `rm`** — always prefer recoverable deletion
- `DROP TABLE`, `DELETE FROM` (without WHERE), `rm -rf` — require explicit confirmation
- Agents must ask before running destructive commands
- Subagents inherit this restriction

---

## 4. Command Center Security

### Authentication

- CC has an auth gate — admin-only access. Verify it's enabled on every deployment.
- All API endpoints must validate auth tokens before processing requests
- Unauthenticated requests get `401` — no exceptions, no "public" endpoints for write operations

### Rate Limiting

- All write endpoints (POST/PUT/DELETE) must be rate-limited
- Suggested defaults: 60 writes/minute per authenticated user
- Burst: 10 requests in 1 second, then throttle
- Read endpoints: 300 requests/minute (prevent scraping)

### Input Sanitization

- All user-facing inputs (comments, messages, form fields) must be sanitized
- Strip or escape HTML/script tags in `cc_comments.content` and `cc_messages.content`
- Validate JSON payloads against expected schemas
- Reject oversized payloads (max 1MB per request)

### CORS Configuration

- API routes should only allow requests from known origins
- Default: same-origin only
- If CC is served separately, whitelist the CC domain explicitly
- Never use `Access-Control-Allow-Origin: *` on authenticated endpoints

---

## 5. Network & Infrastructure

### Gateway Binding

- Gateway should bind to `localhost` (127.0.0.1) only — not `0.0.0.0`
- If remote access is needed, use a reverse proxy (nginx, Caddy) with TLS
- Never expose the gateway directly to the internet without auth

### SSH & Git

- Use SSH keys for git operations (not HTTPS with embedded credentials)
- SSH keys should be passphrase-protected where possible
- Never commit SSH private keys to any repository

### Git Hygiene

- `.gitignore` must include:
  ```
  .env*
  *.env
  .env.local
  .env.*.local
  node_modules/
  ```
- If credentials were ever committed, rotate them immediately — git history is permanent
- Run `git log --all -p | grep -i "password\|secret\|api.key\|token"` periodically

### Audit Logging

Log all external actions:
- Emails sent (to, subject, timestamp)
- API calls to external services (endpoint, timestamp, response code)
- Deployments triggered (what, where, when, by whom)
- Database schema changes
- Credential rotations

Store audit logs in `memory/audit/` or a dedicated database table. Logs should be append-only.

---

## 6. Operational Security

### Credential Rotation

| Credential | Rotation Frequency |
|------------|-------------------|
| Database password | Every 90 days |
| API keys | Every 90 days or on suspected compromise |
| SSH keys | Annually or on personnel change |
| Session tokens | Auto-expire (24h max) |

### Automated Credential Monitoring

- Run `org/security/CREDENTIAL_AUDIT.sh` during heartbeat checks (at least daily)
- The script scans workspace files for leaked secrets
- Any finding = immediate remediation: remove the secret, rotate the credential
- Add to `HEARTBEAT.md`: `- [ ] Run credential audit`

### Agent Self-Audit

Before completing any task, agents should verify:
1. No secrets in output text
2. No credentials in files they created or modified
3. No connection strings, API keys, or tokens in logs they wrote
4. Any `.env` files referenced but never copied into workspace files

### Incident Response

**If credentials are exposed:**

1. **Rotate immediately.** Don't assess first — rotate, then assess.
2. **Identify scope.** Where did the credential appear? Git history? Chat logs? Subagent output?
3. **Revoke old credential.** Ensure the compromised value no longer works.
4. **Audit access.** Check logs for unauthorized usage during the exposure window.
5. **Document.** Write an incident report in `memory/incidents/` with:
   - What was exposed
   - How it was exposed
   - When it was discovered
   - What was done
   - What will prevent recurrence
6. **Fix the root cause.** If it was a code pattern, fix the pattern. If it was a human error, update the checklist.

---

## 7. Security Checklist

See `org/security/SECURITY_CHECKLIST.md` for a deployment-ready checklist.

## 8. Files Reference

| File | Purpose |
|------|---------|
| `org/SECURITY.md` | This document — comprehensive security guide |
| `org/security/SECURITY_CHECKLIST.md` | Deployment checklist |
| `org/security/CREDENTIAL_AUDIT.sh` | Automated secret scanner |
| `org/security/RLS_POLICIES.sql` | Database row-level security policies |
