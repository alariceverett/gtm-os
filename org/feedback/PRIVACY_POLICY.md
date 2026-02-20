# Forge Feedback Agent — Privacy Policy

_Plain language. No legalese. You should be able to read this in 2 minutes and know exactly what happens._

---

## The Short Version

The Forge Feedback Agent collects **anonymous structural patterns** about how your Forge instance uses the framework. It strips all proprietary information before anything leaves your machine. You opt in explicitly, you see everything before it's sent, and you can turn it off at any time.

**What gets sent:** Counts, ratios, categories, file presence. Structural observations only.

**What never gets sent:** Your business name, people's names, decision content, task details, credentials, URLs, IPs, revenue, client info, or anything that could identify you or your organization.

---

## What Gets Collected

| Category | Specific Data | Example Output |
|---|---|---|
| Process usage | Count of runs per process, used vs unused | "5 of 7 processes active, 2 unused" |
| Skill gaps | Category names and counts | "frontend: 3, deployment: 2" |
| Decision engine | Total decisions, delegations, steps; ratios | "2.1 delegations per decision" |
| File structure | Which template files exist vs missing | "DELEGATION_SYSTEM.md: missing" |
| Error patterns | Error type classification and frequency | "ECONNREFUSED: 4 occurrences" |

Every piece of data passes through `privacy_filter.js` which:

1. **Removes** all emails, URLs, IPs, phone numbers, credentials, connection strings, UUIDs
2. **Removes** all quoted strings (treated as potentially proprietary content)
3. **Removes** all numbers above 10 (replaced with bucketed ranges like "[10-50]")
4. **Removes** anything not on a strict allowlist of safe structural terms
5. **Validates** the final output a second time to catch anything the first pass missed

The filter is conservative: **if there's any doubt, it strips it.**

---

## What NEVER Gets Collected

This list is exhaustive and non-negotiable:

- ❌ Business names, organization names, brand names
- ❌ People's names (employees, clients, contacts)
- ❌ Decision content, reasoning, or outcomes
- ❌ Task descriptions, briefs, or deliverables
- ❌ Credentials, API keys, tokens, passwords
- ❌ URLs, IP addresses, hostnames, email addresses
- ❌ Revenue, financial data, pricing, costs
- ❌ Client or customer information of any kind
- ❌ Chat messages, memory files, or daily logs
- ❌ Custom file contents (only presence/absence is noted)
- ❌ Agent prompts, SOUL.md, USER.md, or IDENTITY.md content
- ❌ Anything in quotes (scrubbed as potentially proprietary)

---

## What You Get Back

This isn't just data collection — it's a community exchange.

### 🏆 Community Benchmarks

After each feedback submission, the agent fetches anonymized community averages from the Forge repo and generates a local benchmark report (`org/feedback/BENCHMARKS.md`). You see how your instance compares across:

- Process adoption rate
- Skill gap categories
- Decision engine usage patterns
- Template file retention

This helps you identify underutilized parts of the framework and learn from what works across the community.

### 📦 Priority Skill Packs

When common skill gaps appear across many instances, the Forge team builds skill packs to address them. Feedback contributors receive these **before** they hit the public repo.

### 👤 Forge Contributors

You can optionally be listed in `CONTRIBUTORS.md` on the Forge repo. Completely voluntary — no identifying information required.

### 🚀 Early Access

New Forge features and template updates ship to feedback contributors first. You're shaping the roadmap — you should see the results early.

---

## How Data Flows

```
Your Instance                           GitHub
─────────────                           ──────
                                        
 ┌─────────────┐                        
 │ Raw metrics  │ (process counts,      
 │ from DB +    │  file checks,         
 │ local files) │  skill-gaps.jsonl)    
 └──────┬──────┘                        
        │                               
        ▼                               
 ┌──────────────┐                       
 │ Privacy      │ Strips ALL names,     
 │ Filter       │ content, URLs, IPs,   
 │ (scrub +     │ credentials, numbers  
 │  validate)   │ above 10, quoted text 
 └──────┬──────┘                        
        │                               
        ▼                               
 ┌──────────────┐                       
 │ Dry-run      │ You review exactly    
 │ Preview      │ what would be posted  
 └──────┬──────┘                        
        │ (only if you confirm)         
        ▼                               
 ┌──────────────┐    ┌──────────────┐   
 │ GitHub Issue │───▶│ EJKIV/Forge  │   
 │ (anonymized) │    │ Issues tab   │   
 └──────────────┘    └──────┬───────┘   
                            │           
                            ▼           
                     ┌──────────────┐   
                     │ Community    │   
                     │ Benchmarks   │──▶ Back to you
                     │ (public JSON)│   
                     └──────────────┘   
```

---

## Your Controls

| Control | How |
|---|---|
| **Enable** | `export FORGE_FEEDBACK=true` |
| **Disable** | `export FORGE_FEEDBACK=false` or unset |
| **Preview before sending** | Default behavior — first run is always dry-run |
| **Review the filter** | Read `org/feedback/privacy_filter.js` — it's ~150 lines |
| **Audit past submissions** | Check GitHub Issues at EJKIV/Forge with label `feedback` |
| **Stop permanently** | Delete `/home/node/.openclaw/.env.feedback` |

---

## Questions

**Q: Can you identify my organization from the feedback?**
A: No. The data contains no names, no content, no URLs, no unique identifiers. A report saying "5 of 7 processes used, 3 skill gap categories" could be any Forge instance.

**Q: What if the privacy filter misses something?**
A: The filter runs two passes (scrub + validate). It's conservative — it strips anything it's unsure about. But if you find a gap, please report it: the filter is open source and auditable.

**Q: Is any data stored beyond the GitHub Issue?**
A: No. The agent posts an issue and that's it. No telemetry servers, no analytics databases, no tracking pixels. The GitHub Issue is the only record.

**Q: Can I see what other instances are reporting?**
A: Yes — all feedback issues are public at [github.com/EJKIV/Forge/issues?label=feedback](https://github.com/EJKIV/Forge/issues?q=label%3Afeedback).

**Q: Who has access to the GitHub token I provide?**
A: Only the feedback agent script on your machine. The token is stored in `.env.feedback` (outside the workspace) and is never included in any output or logs.
