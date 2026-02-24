export const DEMO_TAG = 'monday-demo-top-of-funnel-v1';

export const DEMO_FUNNEL = {
  slug: 'demo-founder-outreach-monday',
  name: 'Demo Founder Outreach (Monday)',
  status: 'active',
  channel: 'email',
  goal: 'Repeatable Monday demo for qualified account intake + reply routing',
  notes: 'Seeded by demo mode script for top-of-funnel runbook',
  steps: [
    [1, 'Intro email', 'email', 0, { template: 'demo_outreach_intro_v1' }],
    [2, 'LinkedIn follow-up', 'linkedin_dm', 2, { template: 'demo_linkedin_followup_v1' }],
    [3, 'Final nudge', 'email', 5, { template: 'demo_breakup_v1' }],
  ],
};

export const DEMO_SEQUENCE_TEMPLATES = [
  {
    slug: 'demo-tof-direct-offer-v1',
    name: 'Demo TOF Direct Offer v1',
    description: 'Direct CTA demo variant',
    metadata: {
      demo_tag: DEMO_TAG,
      variant: 'direct_offer',
      cadence_days: [0, 2, 5],
      primary_cta: 'Book a 15-min strategy call',
    },
  },
  {
    slug: 'demo-tof-proof-first-v1',
    name: 'Demo TOF Proof First v1',
    description: 'Proof-led CTA demo variant',
    metadata: {
      demo_tag: DEMO_TAG,
      variant: 'proof_first',
      cadence_days: [0, 3, 6],
      primary_cta: 'Reply for full case study',
    },
  },
  {
    slug: 'demo-tof-pain-point-v1',
    name: 'Demo TOF Pain Point v1',
    description: 'Pain-led diagnostic demo variant',
    metadata: {
      demo_tag: DEMO_TAG,
      variant: 'pain_point',
      cadence_days: [0, 1, 4],
      primary_cta: 'Reply with your #1 bottleneck',
    },
  },
];

export const DEMO_QUALIFIED_ACCOUNTS = [
  {
    brand: 'Acme Beauty Demo',
    website: 'https://acme-beauty.demo',
    est_spend_tier: '1m-3m',
    channels: ['meta', 'google'],
    contact_role: 'VP Marketing',
    qualification_confidence: 88,
    pipeline_stage: 'qualified',
    lead_key: 'lead:demo:acme-beauty',
    reply_text: 'Interested — can we review scope this week?',
    reply_classification: 'positive',
    next_action: 'enroll_now',
    entry_point: 'cold_email',
  },
  {
    brand: 'Northstar Skincare Demo',
    website: 'https://northstar-skincare.demo',
    est_spend_tier: '500k-1m',
    channels: ['meta'],
    contact_role: 'Founder',
    qualification_confidence: 79,
    pipeline_stage: 'discovery',
    lead_key: 'lead:demo:northstar-skincare',
    reply_text: 'Timing is tight this month, circle back in March.',
    reply_classification: 'not_now',
    next_action: 'nurture',
    entry_point: 'linkedin_dm',
  },
  {
    brand: 'Luma Wellness Demo',
    website: 'https://luma-wellness.demo',
    est_spend_tier: '3m+',
    channels: ['google', 'email'],
    contact_role: 'CMO',
    qualification_confidence: 91,
    pipeline_stage: 'pilot_candidate',
    lead_key: 'lead:demo:luma-wellness',
    reply_text: 'Can you share proof this works for supplements?',
    reply_classification: 'objection',
    next_action: 'send_case_study',
    entry_point: 'cold_email',
  },
];

export const DEMO_WEBSITES = DEMO_QUALIFIED_ACCOUNTS.map((a) => a.website);
export const DEMO_SEQUENCE_SLUGS = DEMO_SEQUENCE_TEMPLATES.map((s) => s.slug);
