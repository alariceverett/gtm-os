# AdZeta — Target Account Criteria & ICP Definition

## Ideal Customer Profile (ICP)

### Primary Personas

| Role | Priority | Pain Point Focus | Trigger Phrases |
|------|----------|------------------|-----------------|
| **Head of RevOps** | #1 | Data fragmentation, forecast accuracy, manual spreadsheets | "reconciling data," "single source of truth," "pipeline visibility" |
| **VP Sales** | #2 | Forecast confidence, rep productivity, win rates | "forecast calls," "pipeline hygiene," "rep performance" |
| **CMO** | #3 | Attribution accuracy, CAC payback, marketing ROI | "attribution gaps," "CAC visibility," "channel performance" |
| **CRO** | #4 | Cross-functional alignment, revenue predictability | "GTM alignment," "revenue operations," "growth efficiency" |

### Firmographic Criteria

**Core Firmographics:**
- **Company Type:** B2B SaaS (sales-led or hybrid GTM motion)
- **Stage:** Series A-C (validated product, scaling GTM)
- **Employees:** 50-500 (growth phase where RevOps pain emerges)
- **ARR:** $5M+ (signal: they have budget for RevOps tooling)
- **HQ:** US/Canada/UK primarily ( timezone alignment)

**Nice-to-Have:**
- Sales team: 10+ reps (volume creates visibility pain)
- Marketing team: 5+ members
- Recent rapid hiring (RevOps likely under-resourced)
- Multi-channel GTM (outbound + inbound + PLG)

### Intent Signals (Prioritized)

**Tier 1 (High Intent):**
- [ ] Recent funding announcement (Series A/B/C in past 6 months)
- [ ] New RevOps hire posted (LinkedIn jobs, recent)
- [ ] New VP Sales/CMO hired (past 90 days)
- [ ] "GTM" / "Revenue Operations" / "Sales Operations" job postings

**Tier 2 (Medium Intent):**
- [ ] Growing sales team (5+ new sales hires in past 90 days)
- [ ] Marketing spend increase (observable via ads/tools)
- [ ] Expansion signal (new office, new vertical launch)
- [ ] Attending RevOps/Sales conferences

**Tier 3 (Low Intent):**
- [ ] Blog posts about "scaling" or "growth challenges"
- [ ] LinkedIn activity from personas about GTM pain
- [ ] Tool stack additions (CRM, marketing automation)

### Tech Stack Indicators (Pain Likely)

**Fragmentation Signals (higher priority):**
- CRM: Salesforce or HubSpot (enterprise-grade, complex)
- Marketing: Marketo, Pardot, HubSpot, or multiple tools
- Sales: Outreach, Salesloft, Gong, Chorus
- Data: Multiple point solutions (Clearbit, ZoomInfo, etc.)
- BI: Looker, Tableau, Mode (indicates data-sophisticated but potentially fragmented)

**Stack Size:** 8+ GTM tools = high pain probability

### Exclusion Criteria (Don't Target)

**Disqualifiers:**
- Product-led growth (PLG) only (less relevant to our value prop)
- Pre-Series A (likely no RevOps function, no budget)
- Services/consulting heavy (>50% services revenue)
- Acquired/Public (decision-making harder, less urgency)
- Currently using competitor [X] (if we know they just implemented)

**Deprioritize:**
- Series D+ (unless known pain)
- <50 employees (likely no dedicated RevOps)
- >1000 employees (existing RevOps tooling entrenched)

---

## Account Tiering

### Tier 1 (Prioritize — 25% of target list)
**Criteria:**
- Series B-C
- 100-500 employees
- Recent funding (past 6 months)
- Tech stack >= 8 tools
- Head of RevOps OR VP Sales in title

**Approach:**
- Multi-thread: Email + LinkedIn + warm intro attempt
- Personalized research: 10+ mins/account
- Custom video intro optional
- Follow sequence strictly

### Tier 2 (Standard — 50% of target list)
**Criteria:**
- Series A-B
- 50-250 employees
- Growth signals (hiring, funding)
- Clear GTM pain indicators

**Approach:**
- Email + LinkedIn sequence
- Moderate personalization (5 mins/account)
- Template-based with signal insertion

### Tier 3 (Nurture — 25% of target list)
**Criteria:**
- Meets ICP but weak signals
- Larger company but GTM restructure signal
- Borderline firmographics

**Approach:**
- LinkedIn-only or email-only (lighter touch)
- Template-heavy
- Track for signal changes (funding, hires)

---

## Data Sources for Account Build

| Source | Use For | Notes |
|--------|---------|-------|
| **Crunchbase** | Funding data, company stage | Free tier sufficient |
| **LinkedIn Sales Nav** | Persona identification, hiring signals | Required for RevOps search |
| **Apollo.io / ZoomInfo** | Contact data, tech stack | Validate accuracy |
| **BuiltWith** / **Wappalyzer** | Tech stack detection | Chrome extension |
| **G2/Gartner Reviews** | Comp landscape, trigger events | See who reviews competitors |
| **Company blogs/press** | Recent news, signal validation | For personalization |

---

## Sample Target Account List Structure

```csv
Company,Domain,Stage,Employees,ARR_Est,Primary_Persona,Signal,Signal_Date,Tier,Assigned_To
ExampleCorp,example.com,Series B,120,$8M,VP Sales,raised Series B,2024-01-15,1,rep_a
FastGrow,fastgrow.io,Series A,85,$6M,Head of RevOps,hiring RevOps,2024-02-01,1,rep_b
ScaleUp,scaleup.co,Series C,340,$25M,CMO,new CMO hire,2024-01-20,2,rep_a
```

---

## ICP Validation Questions (Discovery)

Use these to validate ICP hypothesis in early conversations:

1. "How long does your pipeline review prep take currently?"
2. "Where do you go for a single source of truth on GTM metrics?"
3. "How confident are you in this quarter's forecast? (0-10)"
4. "What's the biggest data reconciliation headache for your RevOps team?"
5. "How many tools touch your customer journey end-to-end?"

**Strong ICP Score:**
- Pipeline reviews: >2 hours
- No single source of truth (or "spreadsheets")
- Forecast confidence: <7/10
- 8+ tools in GTM stack
