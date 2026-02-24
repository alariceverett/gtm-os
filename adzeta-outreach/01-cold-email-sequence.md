# AdZeta — Cold Email Sequence (3-Touch)

## Overview
GTM Command Center for RevOps teams — unify pipeline visibility, reduce chaos, accelerate revenue.

---

## Touch 1: Problem-Aware Opener
**Day 0 | Goal: Interrupt pattern + name the pain**

**Subject Lines (A/B Test):**
- A: "{company}'s pipeline visibility gap"
- B: "Quick question about your GTM stack, {first_name}"
- C: "The RevOps blind spot at {{company}}"

**Body:**

```
Hi {first_name},

Noticed {company} just {recent_news} — congrats on the momentum.

Quick question: As you scale, are you seeing the classic RevOps tension?
- Marketing says "we're generating enough leads"
- Sales says "those leads are garbage"
- RevOps is stuck reconciling conflicting data in 5+ tools

Most Series A-C SaaS teams we speak to have visibility gaps that only get worse with growth. The result: forecast calls feel like guesswork, and pipeline reviews take hours.

Worth a brief conversation to see if this resonates?

Best,
{sender_name}
```

**Delivery Notes:**
- Send Tuesday-Thursday, 8:00-10:00 AM local time
- If opened but not replied, reserve for Touch 2 timing

---

## Touch 2: Social Proof + Value Prop
**Day 4 | Goal: Build credibility + demonstrate outcome**

**Subject Lines:**
- "How {similar_company} fixed their GTM chaos"
- "Fw: {company} pipeline visibility (follow-up)"
- "The 12-minute RevOps win"

**Body:**

```
Hi {first_name},

Following up on my note from earlier this week about {company} and RevOps visibility.

Wanted to share a quick example: {similar_company} (also {employee_range} employees, Series {funding_stage}) was struggling with the same {pain_point} fragmentation you likely see — forecasts that missed by 30%, weekly pipeline reviews eating 6+ hours.

We helped them unify their GTM data in one Command Center view. Result:
- Forecast accuracy improved from 65% → 92%
- Pipeline review prep time: 6 hours → 12 minutes
- CAC payback visibility by channel in real-time

Not a fit for everyone, but given {company}'s recent {recent_news}, wondered if a 12-minute demo might surface something useful.

Worth a look?

{sender_name}
{title} | AdZeta
```

**Social Proof Slots (rotate based on prospect):**
- Similar stage/signal → Case study match
- Similar vertical → Industry-specific win
- Generic → "15 Series B SaaS teams in the past 6 months"

---

## Touch 3: The Breakup (Clear CTA)
**Day 14 | Goal: Respectful close with clear path forward**

**Subject Lines:**
- "Should I close the loop on this, {first_name}?"
- "Permission to close your file?"
- "One last thing on {company}'s GTM stack"

**Body:**

```
Hi {first_name},

I've reached out a couple times about how AdZeta helps RevOps teams like {company}'s unify GTM visibility and reduce pipeline friction.

Haven't heard back — totally fine. You're busy, priorities shift, or this simply isn't a priority right now.

Here's what I'll do:
→ I'm going to step back and give you space
→ But I'll keep an eye on {company} for signals (funding, hiring, expansion)
→ If GTM chaos becomes a burning issue, I'm here: {sender_email}

One favor: If this *is* relevant but I'm just catching you at the wrong time, hit reply with "reach out in {month}" and I'll circle back then.

Either way, best of luck with {company}'s next phase.

{sender_name}
{title} | AdZeta
P.S. — Our GTM OS Playbook is here if useful: {resource_link}
```

**P.S. Alternatives:**
- GTM OS Playbook (top of funnel asset)
- RevOps Benchmark Report
- No P.S. for cleaner breakup

---

## Personalization Tokens Reference

| Token | Source | Example |
|-------|--------|---------|
| `{company}` | Firmographic data | "AcmeCorp" |
| `{first_name}` | Contact enrichment | "Sarah" |
| `{recent_news}` | News/Signals API | "landed Series B" / "hired a new VP Sales" |
| `{pain_point}` | Inferred from tech stack/data | "pipeline visibility" / "forecast accuracy" |
| `{similar_company}` | Case study matching | "Buffer" (if prospect is 100-person SaaS) |
| `{employee_range}` | Firmographic | "100-250" |
| `{funding_stage}` | Crunchbase/similar | "Series B" |

---

## Email Deliverability Checklist
- [ ] SPF/DKIM/DMARC configured
- [ ] Warmed sending domain (30+ days)
- [ ] Max 50 emails/day per sender to start
- [ ] A/B test subject lines (3 variants minimum)
- [ ] Unsubscribe link present
- [ ] No more than 1 link per email (Touch 2 exception)
- [ ] Plain-text fallback configured
