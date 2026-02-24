# AdZeta Outreach — Deployment Checklist

## Pre-Launch Requirements

### Infrastructure Setup
- [ ] Sending domain warmed (minimum 30 days, 2+ weeks ideal)
- [ ] SPF, DKIM, DMARC records configured and validated
- [ ] Dedicated IP or warmed shared IP assigned
- [ ] Unsubscribe page + physical address in footer
- [ ] Bounce/complaint handling configured
- [ ] Daily send limits configured (start: 20/day, ramp to 50/day)

### Tech Stack Integration
- [ ] Email platform connected (Apollo, Outreach, Salesloft, etc.)
- [ ] LinkedIn automation tool configured (or manual process defined)
- [ ] CRM integration active (contact sync, activity logging)
- [ ] Calendar integration confirmed (meeting booking, reminders)
- [ ] Slack notifications configured (replies, bookings)
- [ ] Tracking/analytics dashboard accessible

### Data Preparation
- [ ] Target account list imported and tagged (Tier 1/2/3)
- [ ] Contacts enriched (email, LinkedIn, title, phone)
- [ ] Signal data mapped (funding, recent news, tech stack)
- [ ] Personalization fields validated (no missing {tokens})
- [ ] Exclusion list applied (competitors, customers, DNCs)
- [ ] Sample size prepared (50-100 accounts for test phase)

### Content Review
- [ ] All 3 email templates proofread and approved
- [ ] Subject line variants loaded (3 per touch minimum)
- [ ] LinkedIn connection notes approved (all 4 variants)
- [ ] LinkedIn follow-up message approved
- [ ] All personalization tokens mapped to data fields
- [ ] Spintax/variation logic configured (if using)

### Team Readiness
- [ ] Reps trained on sequence flow
- [ ] Response playbook accessible
- [ ] Calendar links tested and working
- [ ] CRM views/dashboards configured for tracking
- [ ] Escalation process defined (complex questions, technical issues)

---

## Phase 1: Soft Launch (Week 1)

### Day 1-3: Controlled Test
- [ ] Enroll 20 Tier 2 accounts (safe middle ground)
- [ ] Send Touch 1 emails only
- [ ] Monitor deliverability (inbox placement, spam rates)
- [ ] Monitor engagement (opens, clicks)
- [ ] Zero technical issues confirmed

### Day 4-7: Monitor & Adjust
- [ ] Review open rates by subject line
- [ ] Review reply quality (qualified vs. unqualified)
- [ ] Adjust subject lines if <35% open rate
- [ ] Adjust messaging if replies are off-target
- [ ] Confirm LinkedIn connection rate (target: 25%+)

### Week 1 Success Criteria
- [ ] >40% email open rate
- [ ] <2% bounce rate
- [ ] <0.1% spam complaint rate
- [ ] >3 relevant replies (indicates messaging resonance)
- [ ] No deliverability flags from email platform

---

## Phase 2: Scale (Week 2-3)

### Week 2: Expand Volume
- [ ] Increase daily sends to 35/day
- [ ] Enroll 50 additional accounts
- [ ] Begin LinkedIn sequence (Day 2 connections)
- [ ] Add Tier 1 accounts (higher personalization)
- [ ] Launch Touch 2 emails for Week 1 cohort

### Week 3: Full Sequence
- [ ] Ramp to 50 emails/day
- [ ] All 4 sequence steps active
- [ ] Full LinkedIn cadence operational
- [ ] A/B test results analyzed
- [ ] Optimize based on Week 1-2 data

### Scale Success Criteria
- [ ] >45% open rate sustained
- [ ] >5% reply rate
- [ ] >2% meeting book rate
- [ ] LinkedIn accept rate >30%
- [ ] Positive sentiment in replies (qualitative)

---

## Phase 3: Optimize (Week 4+)

### Continuous Operations
- [ ] Weekly metrics review (Mondays)
- [ ] Monthly sequence refresh (new subject lines, copy tweaks)
- [ ] Quarterly ICP review (add new signals, remove weak criteria)
- [ ] Ongoing A/B testing (always have 1 test running)

### Optimization Targets
| Metric | Current | Target | Action if Gap |
|--------|---------|--------|---------------|
| Open Rate | _ | >50% | Subject line refresh |
| Reply Rate | _ | >8% | Value prop clarity |
| Meeting Rate | _ | >3% | CTA strength |
| LinkedIn Accept | _ | >35% | Connection note personalization |

---

## Handoff to GTM OS

### Data Export for GTM OS
Once sequences are running and validated, export the following for GTM OS integration:

**File 1: Active Sequence Data**
```csv
contact_id,company,email,sequence_step,enrolled_date,last_touch_date,status,tier,assigned_rep
```

**File 2: Attribution Data**
```csv
contact_id,source_channel,touch_number,content_variant,date_sent,opened,replied,meeting_booked
```

**File 3: ICP Feedback**
```csv
company,tier,sequence_result,meeting_held,qualified,icp_validation_notes
```

### GTM OS Feed Requirements
- [ ] Contact data formatted to GTM OS schema
- [ ] Activity data mapped to GTM OS touchpoints
- [ ] Status sync configured (two-way if possible)
- [ ] Sequence enrollment/de-enrollment API connected

---

## Post-Launch Maintenance

### Daily Checks (5 minutes)
- [ ] Bounce rate acceptable (<3%)
- [ ] No deliverability issues flagged
- [ ] Replies responded to within SLA
- [ ] No stuck sequences (automation working)

### Weekly Reviews (30 minutes)
- [ ] Sequence metrics dashboard review
- [ ] Reply sentiment analysis
- [ ] A/B test results review
- [ ] Content refresh decisions

### Monthly Audits (2 hours)
- [ ] Full data hygiene check
- [ ] ICP criteria review
- [ ] Competitor messaging review
- [ ] Sequence copy refresh
- [ ] Tech stack integration audit

---

## Emergency Procedures

### Deliverability Drop (>5% bounce or spam rate)
1. **Immediately:** Pause all sequences
2. **Investigate:** Check for list import errors, bad data
3. **Clean:** Remove bounced contacts, verify remaining data
4. **Warm down:** Reduce daily volume by 50%
5. **Resume:** Only after root cause identified and resolved

### Reply Volume Spike (rep capacity exceeded)
1. **Pause:** New sequence enrollments
2. **Prioritize:** Existing replies (oldest first)
3. **Triage:** Quick qualify vs. nurture decisions
4. **Scale:** Bring in backup rep if needed
5. **Resume:** Enrollment once caught up

### LinkedIn Restriction Warning
1. **Stop:** All LinkedIn automation immediately
2. **Manual mode:** Switch to manual connection requests
3. **Review:** Connection note compliance (no salesy language)
4. **Resume:** Gradual ramp after 48 hours, manual only

---

## Success Definition

### Week 4 Targets (Mature Sequence)
- **Accounts Enrolled:** 200-300
- **Emails Sent:** 800-1000
- **LinkedIn Connections:** 100-150
- **Meetings Booked:** 8-12 (2-3% conversion)
- **Pipeline Generated:** $200K-$400K (based on ACV assumptions)

### Sequence Health Score
Calculate weekly: `(Email Open Rate + Reply Rate*10 + Meeting Rate*33) / 3`
- **Healthy:** >25
- **Warning:** 15-25
- **Critical:** <15 (requires immediate attention)

---

## Files Ready for Deployment

1. ✅ `01-cold-email-sequence.md` — 3-touch email templates with personalization
2. ✅ `02-linkedin-sequence.md` — 2-touch LinkedIn playbook
3. ✅ `03-target-account-criteria.md` — ICP, firmographics, signals
4. ✅ `04-cadence-rules.md` — Timing, response handling, automation logic
5. ✅ `05-deployment-checklist.md` — This file: launch and operational guide

**Status:** Sequences ready for immediate deployment.
**Next Action:** Complete Phase 1 Soft Launch checklist.
