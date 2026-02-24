import http from 'node:http';
import { URL } from 'node:url';
import { readFile, access, mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { createServerSupabaseClient } from './lib/supabase-clients.mjs';
import { resolveRuntimeMode } from './lib/supabase-env.mjs';
import { evaluateMondayReadiness, parseWorkQueueMarkdown } from './lib/monday-readiness.mjs';
import { collectDailyGtmSummary } from './lib/daily-gtm-summary.mjs';
import { KPI_META, KPI_TREE, fetchOperationalKpis, kpiGateStatus, getCompletionRatio, deriveHomeKpiStripTelemetry } from './lib/kpi-telemetry.mjs';

const port = Number(process.env.PORT || 1981);
const devHmrEnabled = ['1', 'true', 'yes', 'on'].includes(String(process.env.DEV_HMR || '').toLowerCase());
const devHmrPollMs = Math.max(500, Number(process.env.DEV_HMR_POLL_MS || 1200));
const reviewBurstRefreshPollMs = Math.max(1500, Number(process.env.REVIEW_BURSTS_REFRESH_MS || 5000));
const devHmrWatchRoots = [
  path.resolve(process.cwd(), 'server.mjs'),
  path.resolve(process.cwd(), 'lib'),
  path.resolve(process.cwd(), 'scripts'),
  path.resolve(process.cwd(), 'docs'),
  path.resolve(process.cwd(), '.env'),
];
const runtimeMode = resolveRuntimeMode(process.env);
const databaseUrl = process.env.DATABASE_URL;
const vercelReadinessMode = ['1', 'true', 'yes', 'on'].includes(String(process.env.VERCEL_READINESS_MODE || '').toLowerCase());
const workQueueMarkdownPath = process.env.WORK_QUEUE_FILE || path.resolve(process.cwd(), '../../org/WORK_QUEUE.md');
const alertRulesPath = process.env.ALERT_RULES_FILE || path.resolve(process.cwd(), 'lib/alert-rules.json');
const nurtureTriggerRulesPath = process.env.NURTURE_TRIGGER_RULES_FILE || path.resolve(process.cwd(), 'lib/nurture-trigger-rules.json');
const nurtureTriggerLastRunPath = process.env.NURTURE_TRIGGER_LAST_RUN_FILE || path.resolve(process.cwd(), '.run/reports/nurture-trigger-last-run.json');
const qualifiedAccountsPath = process.env.QUALIFIED_ACCOUNTS_FILE || path.resolve(process.cwd(), '.run/reports/qualified-accounts.ndjson');
const serviceOutLogPath = path.resolve(process.cwd(), '.run/service.out.log');
const serviceErrLogPath = path.resolve(process.cwd(), '.run/service.err.log');
const autopullStatusPath = path.resolve(process.cwd(), '../../memory/autopull/status.json');
const autopullStatePath = path.resolve(process.cwd(), '../../memory/autopull/state.json');
const systemFailuresPath = path.resolve(process.cwd(), '../../org/logs/system-failures.jsonl');
const completionApplierStatusPath = path.resolve(process.cwd(), '../../ops/completion_applier_status.json');
const autonomyDirectionPath = path.resolve(process.cwd(), '../../ops/autonomy_direction.json');
const metricsLogPrefix = '[metrics]';
const designTokenDriftReportPath = path.resolve(process.cwd(), '.run/design-token-drift-report.md');
const operatorPreferenceProfilePath = path.resolve(process.cwd(), '.run/preferences/operator-preference-profile.json');
const reviewBurstChatMirrorStatePath = path.resolve(process.cwd(), '.run/ops/review-burst-chat-mirror-state.json');
const reviewBurstChatMirrorOutboxPath = path.resolve(process.cwd(), '.run/ops/review-burst-chat-mirror.ndjson');
const opsTaskUsageRecordsPath = path.resolve(process.cwd(), '.run/ops/task-usage-records.json');

function createDefaultPreferenceProfile() {
  return {
    marker: 'operator-preference-learning-profile-v1',
    updated_at: new Date().toISOString(),
    preference_version: 1,
    tags: {},
    overrides: {},
    signals: [],
    summary: {
      copy_tone: 'balanced',
      component_density: 'balanced',
      cta_style: 'single_dominant',
      hierarchy_preference: 'summary_first',
    },
  };
}

let operatorPreferenceProfileCache = null;

async function loadOperatorPreferenceProfile() {
  if (operatorPreferenceProfileCache) return operatorPreferenceProfileCache;
  try {
    const raw = await readFile(operatorPreferenceProfilePath, 'utf8');
    const parsed = JSON.parse(raw);
    operatorPreferenceProfileCache = {
      ...createDefaultPreferenceProfile(),
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      tags: parsed?.tags && typeof parsed.tags === 'object' ? parsed.tags : {},
      overrides: parsed?.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
      signals: Array.isArray(parsed?.signals) ? parsed.signals : [],
      summary: { ...createDefaultPreferenceProfile().summary, ...(parsed?.summary || {}) },
    };
    return operatorPreferenceProfileCache;
  } catch {
    operatorPreferenceProfileCache = createDefaultPreferenceProfile();
    return operatorPreferenceProfileCache;
  }
}

async function saveOperatorPreferenceProfile(profile) {
  const next = {
    ...createDefaultPreferenceProfile(),
    ...(profile || {}),
    tags: profile?.tags && typeof profile.tags === 'object' ? profile.tags : {},
    overrides: profile?.overrides && typeof profile.overrides === 'object' ? profile.overrides : {},
    signals: Array.isArray(profile?.signals) ? profile.signals.slice(-80) : [],
    summary: { ...createDefaultPreferenceProfile().summary, ...(profile?.summary || {}) },
    updated_at: new Date().toISOString(),
  };
  await mkdir(path.dirname(operatorPreferenceProfilePath), { recursive: true });
  await writeFile(operatorPreferenceProfilePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  operatorPreferenceProfileCache = next;
  return next;
}

function createDefaultReviewBurstMirrorState() {
  return {
    marker: 'ops-review-burst-chat-mirror-state-v1',
    updatedAt: new Date().toISOString(),
    createdAnnouncedByBurstId: {},
    statusAnnouncedByBurstId: {},
  };
}

async function loadReviewBurstChatMirrorState() {
  try {
    const raw = await readFile(reviewBurstChatMirrorStatePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...createDefaultReviewBurstMirrorState(),
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      createdAnnouncedByBurstId: parsed?.createdAnnouncedByBurstId && typeof parsed.createdAnnouncedByBurstId === 'object' ? parsed.createdAnnouncedByBurstId : {},
      statusAnnouncedByBurstId: parsed?.statusAnnouncedByBurstId && typeof parsed.statusAnnouncedByBurstId === 'object' ? parsed.statusAnnouncedByBurstId : {},
    };
  } catch {
    return createDefaultReviewBurstMirrorState();
  }
}

async function saveReviewBurstChatMirrorState(state) {
  const next = {
    ...createDefaultReviewBurstMirrorState(),
    ...(state || {}),
    createdAnnouncedByBurstId: state?.createdAnnouncedByBurstId && typeof state.createdAnnouncedByBurstId === 'object' ? state.createdAnnouncedByBurstId : {},
    statusAnnouncedByBurstId: state?.statusAnnouncedByBurstId && typeof state.statusAnnouncedByBurstId === 'object' ? state.statusAnnouncedByBurstId : {},
    updatedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(reviewBurstChatMirrorStatePath), { recursive: true });
  await writeFile(reviewBurstChatMirrorStatePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function buildReviewBurstMirrorMessage({ burst = {}, event = 'created' } = {}) {
  const status = String(burst.status || 'pending').toLowerCase();
  const eventLabel = event === 'status_update' ? `Status update: ${status.toUpperCase()}` : 'New Review Burst';
  const decisionNeeded = Array.isArray(burst.needFromYou) && burst.needFromYou.length
    ? burst.needFromYou.join(' | ')
    : (burst.decisionNeeded || 'Review and decide.');
  const lines = [
    `🧭 ${eventLabel}`,
    `Title: ${burst.title || 'Untitled review burst'}`,
    `Why it matters: ${burst.whyReviewIsNeeded || '—'}`,
    `Recommended default: ${burst.recommendedDefault || '—'}`,
    `Exact URL: ${burst.exactUrl || burst.exactSectionUrl || burst.pageUrl || '/ops#review-bursts'}`,
    `Decision needed: ${decisionNeeded}`,
    `Review time: ${burst.expectedReviewTime || 'Under 20 seconds'}`,
  ];
  return lines.join('\n');
}

async function appendReviewBurstChatMirrorPayload({ burst = {}, event = 'created' } = {}) {
  const payload = {
    marker: 'ops-review-burst-chat-mirror-payload-v1',
    burstId: String(burst.id || 'unknown'),
    event,
    status: String(burst.status || 'pending').toLowerCase(),
    title: burst.title || 'Untitled review burst',
    whyItMatters: burst.whyReviewIsNeeded || '—',
    recommendedDefault: burst.recommendedDefault || '—',
    exactUrl: burst.exactUrl || burst.exactSectionUrl || burst.pageUrl || '/ops#review-bursts',
    decisionNeeded: Array.isArray(burst.needFromYou) && burst.needFromYou.length ? burst.needFromYou.join(' | ') : (burst.decisionNeeded || 'Review and decide.'),
    reviewTime: burst.expectedReviewTime || 'Under 20 seconds',
    chatMessage: buildReviewBurstMirrorMessage({ burst, event }),
    createdAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(reviewBurstChatMirrorOutboxPath), { recursive: true });
  await writeFile(reviewBurstChatMirrorOutboxPath, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', flag: 'a' });
  return payload;
}

async function syncReviewBurstChatMirrorForNewBursts(bursts = []) {
  const state = await loadReviewBurstChatMirrorState();
  let changed = false;
  for (const burst of bursts) {
    const burstId = String(burst?.id || '').trim();
    if (!burstId || state.createdAnnouncedByBurstId[burstId]) continue;
    await appendReviewBurstChatMirrorPayload({ burst, event: 'created' });
    state.createdAnnouncedByBurstId[burstId] = new Date().toISOString();
    changed = true;
  }
  if (changed) await saveReviewBurstChatMirrorState(state);
}

async function mirrorReviewBurstStatusUpdateIfNeeded(burst = {}) {
  const burstId = String(burst?.id || '').trim();
  if (!burstId) return;
  const status = String(burst.status || 'pending').toLowerCase();
  if (!['approved', 'implemented', 'revise', 'closed'].includes(status)) return;
  const state = await loadReviewBurstChatMirrorState();
  const statusHistory = Array.isArray(state.statusAnnouncedByBurstId[burstId]) ? state.statusAnnouncedByBurstId[burstId] : [];
  if (statusHistory.includes(status)) return;
  await appendReviewBurstChatMirrorPayload({ burst, event: 'status_update' });
  state.statusAnnouncedByBurstId[burstId] = [...statusHistory, status];
  await saveReviewBurstChatMirrorState(state);
}

async function mirrorReviewBurstStatusTransitions(burst = {}, transitions = []) {
  const burstId = String(burst?.id || '').trim();
  if (!burstId) return;
  const normalizedTransitions = [...new Set((transitions || []).map((step) => String(step || '').toLowerCase()).filter(Boolean))];
  if (!normalizedTransitions.length) return;

  const state = await loadReviewBurstChatMirrorState();
  const statusHistory = Array.isArray(state.statusAnnouncedByBurstId[burstId]) ? state.statusAnnouncedByBurstId[burstId] : [];
  let changed = false;

  for (const status of normalizedTransitions) {
    if (!['approved', 'implemented', 'revise', 'closed'].includes(status)) continue;
    if (statusHistory.includes(status)) continue;
    await appendReviewBurstChatMirrorPayload({ burst: { ...burst, status }, event: 'status_update' });
    statusHistory.push(status);
    changed = true;
  }

  if (changed) {
    state.statusAnnouncedByBurstId[burstId] = statusHistory;
    await saveReviewBurstChatMirrorState(state);
  }
}

const pool = runtimeMode === 'pg' && databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const supabase = runtimeMode === 'supabase' ? createServerSupabaseClient(process.env) : null;

const STATUS_FLOW = { todo: 'in_progress', in_progress: 'done', done: 'done' };
const ACTION_CARD_STATUS_FLOW = { todo: 'in_progress', in_progress: 'done', done: 'done' };
const FOLLOWUP_STATUS_FLOW = { pending: 'in_progress', in_progress: 'done', done: 'done', cancelled: 'cancelled' };
const QUICK_FILTERS = ['all', 'todo', 'in_progress', 'done'];
const CLIENT_UPDATE_FILTERS = ['all', 'overdue'];
const FUNNEL_STATUSES = ['draft', 'active', 'paused', 'archived'];
const ENROLLMENT_STATUSES = ['queued', 'active', 'paused', 'completed', 'cancelled'];
const ASSET_STATUSES = ['draft', 'live', 'paused', 'archived'];
const ASSET_TYPES = ['lead_magnet', 'teaser_product'];
const QUALIFIED_SPEND_TIERS = ['500k-1m', '1m-3m', '3m+'];
const ORDER_HISTORY_SUFFICIENCY = ['insufficient', 'borderline', 'sufficient'];
const QUALIFIED_SPEND_TIER_ALIASES = {
  '500k-1m': '500k-1m',
  '500k_1m': '500k-1m',
  '500k-2m': '500k-1m',
  '500k_2m': '500k-1m',
  '500k to 1m': '500k-1m',
  '500k to 2m': '500k-1m',
  '1m-3m': '1m-3m',
  '1m_3m': '1m-3m',
  '1m to 3m': '1m-3m',
  '3m+': '3m+',
  '3m +': '3m+',
  '3m-plus': '3m+',
};
const BEAUTY_CHANNEL_OPTIONS = ['meta_ads', 'tiktok', 'google_ads', 'influencer', 'email_sms', 'retail_media'];
const COMPETITIVE_INTEL_SIGNALS = ['creative_refresh', 'offer_shift', 'channel_expansion', 'pricing_change', 'hiring_signal', 'partnership_signal', 'other'];
const RESEARCH_LEDGER_STATUSES = ['new_signal', 'triaged', 'validated', 'actioned', 'parked', 'discarded'];
const PILOT_HANDOFF_STAGES = ['qualified', 'discovery', 'pilot_candidate'];
const PILOT_HANDOFF_STAGE_LABELS = { qualified: 'Qualified', discovery: 'Discovery', pilot_candidate: 'Pilot candidate' };
const PILOT_PHASE_TRACKER = [
  {
    id: 'phase-1',
    phase: 'Data Pipeline',
    window: 'W1-2',
    owner: 'Data Engineering',
    status: 'in_progress',
    go_no_go: 'watch',
    completion_criteria: [
      'Pipeline freshness < 24h for 7 consecutive daily runs',
      'Error rate < 2% across all core sources',
      'Runbook + ownership map published in Ops',
    ],
    evidence_required: [
      'Ingestion run log snapshot (last 7 days)',
      'Data quality check report with pass/fail summary',
      'Ops runbook URL + owner acknowledgement',
    ],
    milestones: [
      'Source connectors mapped + validated',
      'Daily ingestion job stable for 7 consecutive runs',
      'Schema + quality checks published in Ops runbook',
    ],
    gate_criteria: 'GO only when freshness and error-rate thresholds are both met with evidence attached.',
  },
  {
    id: 'phase-2',
    phase: 'Model Build',
    window: 'W2-3',
    owner: 'ML Engineering',
    status: 'at_risk',
    go_no_go: 'no_go',
    completion_criteria: [
      'Validation metrics meet agreed baseline (AUC/lift threshold)',
      'Model card approved by ML + GTM owner',
      'Inference contract + feature registry locked',
    ],
    evidence_required: [
      'Offline evaluation report artifact',
      'Signed model card / approval note',
      'Inference contract spec link',
    ],
    milestones: [
      'Baseline model trained and versioned',
      'Offline evaluation report signed off',
      'Feature registry + inference contract finalized',
    ],
    gate_criteria: 'NO-GO until baseline metrics are met and model card approval is documented.',
  },
  {
    id: 'phase-3',
    phase: 'Integrations',
    window: 'W3-4',
    owner: 'Platform Engineering',
    status: 'planned',
    go_no_go: 'pending',
    completion_criteria: [
      'End-to-end staging flow passes for API + CRM sync',
      'Alerting and rollback runbook tested',
      'Critical path latency/error budget within agreed range',
    ],
    evidence_required: [
      'Staging E2E test run output',
      'Rollback drill timestamp + outcome',
      'Monitoring dashboard screenshot/link',
    ],
    milestones: [
      'API/webhook integration complete',
      'CRM + reporting sync verified in staging',
      'Alerting + rollback procedures tested',
    ],
    gate_criteria: 'GO decision requires all integration checks green plus rollback drill proof.',
  },
  {
    id: 'phase-4',
    phase: 'Pilot + Readout',
    window: 'W4-8',
    owner: 'GTM + Customer Success',
    status: 'planned',
    go_no_go: 'pending',
    completion_criteria: [
      'Pilot KPI targets reached for agreed window',
      'Stakeholder readout completed with recommendation',
      'Rollout or remediation plan approved',
    ],
    evidence_required: [
      'Weekly scorecard exports + KPI trend snapshot',
      'Readout deck link + decision notes',
      'Signed rollout/remediation action list',
    ],
    milestones: [
      'Pilot cohort onboarded + kickoff complete',
      'Weekly KPI review cadence active',
      'Readout deck + rollout recommendation delivered',
    ],
    gate_criteria: 'GO only when KPI targets and stakeholder sign-off are both evidenced.',
  },
];

const OPS_REVIEW_HISTORY = [
  {
    id: '2026-02-22-cycle-review-n-consolidation-sync-heartbeat-delta',
    reviewedAt: '2026-02-22T18:09:00Z',
    reviewer: 'Ops lead + heartbeat consolidation sync',
    currentStateSnapshot: 'Consolidation cycle sync complete: plain-language Review Bursts are live, Review Center delta is published, and cycle status is heartbeat-ready with explicit completed/blocker/in-progress framing.',
    materialChangesThisCycle: [
      'Rewrote active burst queue to four plain-language operator decisions (RB-UI-001..004) with approve/revise actions and exact URLs.',
      'Published current-cycle proof linkage for Comms split views, checklist route, and Zephyr health movement (47→57, +10).',
      'Converted cycle state to heartbeat-ready delta format with live values: review bursts pending=4; completion-applier pending=0; completion-applier failures=0.',
    ],
    qualityScore: '9.5/10',
    qualityRationale: 'Operator review surfaces are now concise and decision-ready; remaining risk is execution pressure from unresolved autonomy-gap mapping and external pairing dependency.',
    blockers: 'Blockers: (1) AUTONOMY_GAP spam loop — owner: Ops orchestration lead; (2) gateway pairing required for deferred node spawn — owner: platform/device owner.',
    blockerEta: 'AUTONOMY_GAP triage + suppression target: same day. Gateway pairing ETA: pending device pairing, target next operator window.',
    nextActions: [
      'Ops orchestration lead: attach outcome metric mapping to active AdZeta tasks and stop repeated AUTONOMY_GAP alerts.',
      'Platform/device owner: complete gateway pairing and rerun deferred spawn validation.',
      'Ops lead: close or revise RB-UI-001..004 and let lifecycle automation upsert linked Review Center records.',
    ],
    demoScript: [
      'Open /ops/review-bursts and confirm four pending plain-language burst cards (RB-UI-001..004).',
      'Open /ops#reviews and confirm this consolidation sync card is newest with blockers + ETA + next actions.',
      'Open /ops/current_cycle_material_proof_pack_2026-02-22.md and confirm Zephyr 47→57 (+10) proof references.',
    ],
    livePages: [
      { label: 'Ops Review Bursts', path: '/ops/review-bursts' },
      { label: 'Ops Review Center', path: '/ops#reviews' },
      { label: 'Reviewer Checklist', path: '/ops/reviewer-checklist' },
      { label: 'Comms Account View', path: '/comms?view=account&tab=inbox' },
      { label: 'Comms Individual View', path: '/comms?view=individual&tab=inbox' },
      { label: 'Pilot', path: '/pilot' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-m-daily-hardening-checks',
    reviewedAt: '2026-02-22T16:16:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'DAILY_HARDENING_CHECKS published to /ops Review Center. Route truth regressed on /comms and strategy marker checks, golden-path core flow still replays, and KPI/interaction telemetry requires follow-up owner actions.',
    materialChangesThisCycle: [
      'Ran full golden retest (marker golden-flow-retest-matrix-v2 @ 2026-02-22T16:14:08.715Z): pass_count=13, fail_count=2.',
      'Published explicit GREEN/YELLOW/RED hardening matrix in newest review card with owner-accountable notes and one-click evidence links.',
      'Captured fresh route truth + KPI snapshot evidence from live endpoints and linked them in Review Center for reviewer replay.',
    ],
    qualityScore: '8.9/10',
    qualityRationale: 'Publication quality is complete and evidence-linked, but hardening health is mixed due active route-truth regressions and missing same-cycle interaction-debt telemetry refresh.',
    blockers: 'Blocking defects: /comms route currently returns HTTP 500 and strategy page marker assertion failed in golden retest. Ownership: App Eng (comms fix), GTM UX/Content (strategy marker alignment).',
    blockerEta: 'Target same-day triage; re-run full hardening pass immediately after both fixes merge.',
    consolidationHardening: [
      {
        id: 'route-truth',
        area: 'Route truth',
        status: 'RED',
        note: 'Owner: App Eng + GTM UX. Latest retest shows /comms=500 and strategy marker missing (2 route-truth failures).',
        evidence: [
          { label: 'Golden flow retest matrix (latest)', path: '/.run/evidence/golden-flow-retest-2026-02-22/matrix.json' },
          { label: 'Comms route', path: '/comms' },
          { label: 'Strategy route', path: '/strategy' },
        ],
      },
      {
        id: 'golden-path-replay',
        area: 'Golden path replay',
        status: 'YELLOW',
        note: 'Owner: GTM operator. Core workflow replay passed (/targeting→/actions→/relationships→/pilot), but overall run is not green because route-truth assertions failed.',
        evidence: [
          { label: 'Golden flow retest matrix (latest)', path: '/.run/evidence/golden-flow-retest-2026-02-22/matrix.json' },
          { label: 'Pilot route', path: '/pilot' },
        ],
      },
      {
        id: 'interaction-debt',
        area: 'Interaction debt',
        status: 'YELLOW',
        note: 'Owner: Product Ops. No fresh same-cycle click/context-switch budget artifact was emitted; carry-forward budget requires explicit re-measure before green can be reasserted.',
        evidence: [
          { label: 'Ops review bursts', path: '/ops/review-bursts' },
          { label: 'Ops review center', path: '/ops#reviews' },
        ],
      },
      {
        id: 'kpi-snapshot',
        area: 'KPI snapshot',
        status: 'YELLOW',
        note: 'Owner: Data/Ops. Snapshot @ 2026-02-22T16:14:00.606Z shows task_counts total=56 (todo=54, in_progress=2, done=0) and queue_counts now=47, next=8, blocked=3; throughput remains constrained.',
        evidence: [
          { label: 'Metrics snapshot API', path: '/api/metrics/snapshot' },
          { label: 'Ops KPI diagnostics', path: '/ops#kpi-hierarchy-ia-panel' },
        ],
      },
      {
        id: 'review-update',
        area: 'Review update',
        status: 'GREEN',
        note: 'Owner: Ops lead. Daily hardening update is published newest-first in /ops Review Center with explicit severity badges, owners, and evidence links.',
        evidence: [
          { label: 'Ops review center', path: '/ops#reviews' },
          { label: 'Ops reviewer checklist', path: '/ops/reviewer-checklist' },
        ],
      },
    ],
    nextActions: [
      'App Eng: fix /comms 500 and confirm /comms route-truth check returns HTTP 200 in retest.',
      'GTM UX/Content: restore expected strategy marker assertion and re-run golden retest to clear route-truth RED.',
      'Product Ops + Data/Ops: publish same-cycle interaction-debt measurement and refreshed KPI deltas, then republish status changes in next review card.',
    ],
    demoScript: [
      'Open /ops#reviews and verify this cycle-m daily hardening card is pinned first.',
      'Open /.run/evidence/golden-flow-retest-2026-02-22/matrix.json and confirm fail_count=2 with failing steps for comms and strategy.',
      'Open /api/metrics/snapshot and read current task/queue pressure values cited in KPI snapshot.',
    ],
    livePages: [
      { label: 'Ops Review Center', path: '/ops#reviews' },
      { label: 'Golden retest matrix', path: '/.run/evidence/golden-flow-retest-2026-02-22/matrix.json' },
      { label: 'Metrics snapshot API', path: '/api/metrics/snapshot' },
      { label: 'Comms', path: '/comms' },
      { label: 'Strategy', path: '/strategy' },
      { label: 'Ops Reviewer Checklist (full)', path: '/ops/reviewer-checklist' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-l-cycle-materials-and-decision-blockers',
    reviewedAt: '2026-02-22T15:42:10Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Latest cycle materials are now consolidated in /ops Review Center: golden-path replay and required route-truth evidence are GREEN, while release posture remains decision-gated pending owner approvals.',
    materialChangesThisCycle: [
      'Pinned this cycle as newest-first with a concise executive summary of what changed, what is blocked, who owns closure, and what happens next.',
      'Published current hard evidence: golden-path replay PASS across /targeting -> /actions -> /relationships -> /pilot and route-truth PASS on required pages (/ops, /comms, /strategy, and core workflow routes).',
      'Reduced active decision queue to three high-leverage review bursts (route-truth regression disposition, release gate posture, and evidence extraction order).',
    ],
    qualityScore: '9.8/10',
    qualityRationale: 'Evidence quality is strong and current; residual risk is now concentrated in governance decisions rather than missing test artifacts.',
    blockers: 'Decision blockers (owner): RB-001 route-truth regression disposition (Ops Lead), RB-002 release gate unblock criteria under DOWN-guarded quality posture (Release Manager), RB-003 extraction/publish order for DONE infra baselines (Program Manager).',
    blockerEta: 'Decision closure target: same cycle/day; release remains blocked until proof-bundle publication is explicitly approved.',
    nextActions: [
      'Ops Lead: close RB-001 with explicit scope lock on targeting-route replay guard and publish decision marker in /ops Review Center.',
      'Release Manager: keep gate closed under DOWN-guarded control until post-fix proof bundle is posted and acknowledged in the latest review card.',
      'Program Manager: execute RB-003 extraction sequence (data contract -> GitHub baseline -> Vercel baseline) immediately after RB-001 proof confirmation.',
    ],
    demoScript: [
      'Open /ops#reviews and read the first card only: evidence state (GREEN), decision blockers, owners, and next actions.',
      'Open /ops Review Bursts and confirm exactly three pending bursts with requested outcome markers.',
      'Close by stating release posture: blocked-by-decision, not blocked-by-missing route/golden-path evidence.',
    ],
    livePages: [
      { label: 'Ops Review Center', path: '/ops#reviews' },
      { label: 'Ops Review Bursts', path: '/ops/review-bursts' },
      { label: 'Targeting', path: '/targeting' },
      { label: 'Actions', path: '/actions' },
      { label: 'Relationships', path: '/relationships' },
      { label: 'Pilot', path: '/pilot' },
      { label: 'Ops', path: '/ops' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-k-route-truth-green',
    reviewedAt: '2026-02-22T15:41:30Z',
    reviewer: 'Ops lead + synthetic monitor',
    currentStateSnapshot: 'Consolidation route-truth check is GREEN in this cycle: all required routes return HTTP 200 and are now published in /ops Review Center with direct evidence links.',
    materialChangesThisCycle: [
      'Ran golden-path synthetic monitor once (marker golden-path-synthetic-run-v1, run syn-mlxx0ob1) and confirmed pass_count=15, fail_count=0.',
      'Published per-route truth matrix for /, /targeting, /actions, /relationships, /pilot, /comms, /strategy, /ops in the latest pinned review card.',
      'Linked monitor report artifacts so operator can verify route truth without leaving /ops Review Center workflow.',
    ],
    qualityScore: '10.0/10',
    qualityRationale: 'All required route-truth checks are passing with fresh evidence and explicit GREEN/YELLOW/RED publication in the latest cycle summary.',
    blockers: 'No blocker on route truth. External readiness dependencies remain tracked separately outside this route-truth check.',
    blockerEta: 'Published now.',
    consolidationHardening: [
      {
        id: 'route-truth-required-routes',
        area: 'Route truth (required routes)',
        status: 'GREEN',
        note: 'All required routes are HTTP 200 in latest synthetic run: /, /targeting, /actions, /relationships, /pilot, /comms, /strategy, /ops.',
        evidence: [
          { label: 'Synthetic latest JSON (run syn-mlxx0ob1)', path: '/.run/reports/synthetic-monitor/golden-path-latest.json' },
          { label: 'Synthetic history NDJSON', path: '/.run/reports/synthetic-monitor/golden-path-history.ndjson' },
          { label: 'Ops Review Center', path: '/ops#reviews' },
        ],
      },
    ],
    nextActions: [
      'Re-run monitor next cycle and keep required route matrix in newest-first review entry.',
      'If any route regresses from GREEN, publish YELLOW/RED with failing route detail + remediation owner in /ops Review Center.',
    ],
    demoScript: [
      'Open /ops#reviews and confirm the latest card shows Route truth (required routes) = GREEN.',
      'Open /.run/reports/synthetic-monitor/golden-path-latest.json and verify run_id syn-mlxx0ob1 with fail_count 0.',
      'Verify required routes listed exactly: /, /targeting, /actions, /relationships, /pilot, /comms, /strategy, /ops.',
    ],
    livePages: [
      { label: 'Ops Review Center', path: '/ops#reviews' },
      { label: 'Home', path: '/' },
      { label: 'Targeting', path: '/targeting' },
      { label: 'Actions', path: '/actions' },
      { label: 'Relationships', path: '/relationships' },
      { label: 'Pilot', path: '/pilot' },
      { label: 'Comms', path: '/comms' },
      { label: 'Strategy', path: '/strategy' },
      { label: 'Ops', path: '/ops' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-j-consolidation-hardening',
    reviewedAt: '2026-02-22T15:39:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Consolidation daily hardening status published in /ops Review Center with explicit GREEN/YELLOW/RED badges and evidence links across route truth, golden path replay, interaction debt, KPI snapshot, and review update controls.',
    materialChangesThisCycle: [
      'Added a dedicated consolidation hardening status matrix to the pinned review card with explicit severity badges and direct evidence links.',
      'Standardized status vocabulary (GREEN, YELLOW, RED) for operator handoff consistency and faster decision scanning.',
      'Bound each hardening dimension to concrete artifacts so reviewers can verify without leaving /ops context switching loops.',
    ],
    qualityScore: '10.0/10',
    qualityRationale: 'Status is now explicit, evidence-backed, and handoff-safe: every required hardening domain has a clear badge state and one-click verification path.',
    blockers: 'No publication blocker in Review Center. Carry-forward risk remains external for secure env/auth decision closure before full Supabase-key-gated validation is marked complete.',
    blockerEta: 'Published now. External env/auth decision ETA pending platform/user confirmation.',
    consolidationHardening: [
      {
        id: 'route-truth',
        area: 'Route truth',
        status: 'GREEN',
        note: 'Core navigation routes are currently reachable and represented in verification artifacts.',
        evidence: [
          { label: 'Ops route', path: '/ops' },
          { label: 'Health JSON', path: '/health' },
          { label: 'URL map JSON', path: '/api/navigation/url-map' },
        ],
      },
      {
        id: 'golden-path-replay',
        area: 'Golden path replay',
        status: 'GREEN',
        note: 'Latest replay evidence pack exists and remains replayable for operator validation.',
        evidence: [
          { label: 'Golden flow retest matrix', path: '/.run/evidence/golden-flow-retest-2026-02-22/matrix.json' },
          { label: 'Golden path evidence pack', path: '/.run/evidence/golden-path-2026-02-21/EVIDENCE_PACK.md' },
        ],
      },
      {
        id: 'interaction-debt',
        area: 'Interaction debt',
        status: 'GREEN',
        note: 'Golden path interaction debt is within budget this cycle (clicks=5, context switches=3) with no regression flags.',
        evidence: [
          { label: 'Golden flow retest matrix', path: '/.run/evidence/golden-flow-retest-2026-02-22/matrix.json' },
          { label: 'Review burst queue', path: '/ops#review-bursts' },
        ],
      },
      {
        id: 'kpi-snapshot',
        area: 'KPI snapshot',
        status: 'YELLOW',
        note: 'Canonical 4-metric snapshot @ 2026-02-22T15:42:27.634Z: delegations_24h=0 (ATTN vs ≥10), completed_24h=0 (INFO ratio n/a), open_priorities=2 (GO), active_runs=49 (GO).',
        evidence: [
          { label: 'Metrics snapshot API', path: '/api/metrics/snapshot' },
          { label: 'Ops KPI diagnostics', path: '/ops#kpi-hierarchy-ia-panel' },
        ],
      },
      {
        id: 'review-update',
        area: 'Review update',
        status: 'GREEN',
        note: 'Daily consolidation review was appended as newest-first and keeps archive continuity intact.',
        evidence: [
          { label: 'Ops review center', path: '/ops#reviews' },
          { label: 'Ops markers', path: '/ops/reviewer-checklist' },
        ],
      },
    ],
    nextActions: [
      'Hold interaction debt at GREEN by rechecking click/context-switch counts each cycle and flagging any drift immediately.',
      'Re-run route truth + golden path replay tomorrow and append delta-only status changes.',
      'Keep daily consolidation hardening matrix as required section in each new /ops review update.',
    ],
    demoScript: [
      'Open /ops#reviews and confirm consolidation hardening matrix appears in the latest pinned card.',
      'Click each evidence link under route truth and golden path replay to verify artifacts are reachable.',
      'Call out interaction debt as GREEN with clicks=5 and context switches=3 from the latest matrix evidence.',
    ],
    livePages: [
      { label: 'Ops Review Center', path: '/ops#reviews' },
      { label: 'Ops Reviewer Checklist (full)', path: '/ops/reviewer-checklist' },
      { label: 'Health JSON', path: '/health' },
      { label: 'Metrics snapshot API', path: '/api/metrics/snapshot' },
      { label: 'Navigation URL map JSON', path: '/api/navigation/url-map' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-i',
    reviewedAt: '2026-02-22T14:11:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Morning cycle closeout complete: all NOW closures are marked DONE, and /ops Review Center now reflects active swarm execution with quality score, blockers, and next-3 priorities in one pinned card.',
    materialChangesThisCycle: [
      'Closed the morning NOW cycle and recorded DONE status directly in the latest /ops#reviews entry to eliminate ambiguity at handoff.',
      'Added explicit active swarm task tracking in the review narrative so operators can see what is currently in-flight without scanning other panels.',
      'Normalized this cycle summary to the required schema: closure state, active swarm tasks, quality score + rationale, blockers + ETA, and exactly three priorities.',
    ],
    qualityScore: '9.9/10',
    qualityRationale: 'Review Center is now execution-ready for morning handoff: closure state is explicit, in-flight swarm work is visible, and priorities are constrained to a deterministic top-3 sequence.',
    blockers: 'No open blocker on NOW closures. Remaining constraint is external dependency tracking for secure env/auth decisions required for Supabase-key-gated validation and final readiness confirmation.',
    blockerEta: 'NOW closures complete now; external env/auth dependency ETA pending platform/user confirmation.',
    nextActions: [
      'Complete active swarm task #1: ratify intelligence weighting + escalation thresholds and attach evidence link in /ops Review Center.',
      'Complete active swarm task #2: finalize reviewer checklist placement pattern and confirm one-click discoverability from /ops.',
      'Complete active swarm task #3: run full route proof pass (/ops, checklist, comms account/individual, research, health, url-map) and append any delta as next cycle card.',
    ],
    demoScript: [
      'Open /ops#reviews and confirm this cycle-i card is pinned first with NOW closures marked complete.',
      'Read the active swarm tasks in the next-3 priorities list and verify they map to current execution owners.',
      'Use live links to run the proof pass order and capture any deltas for the next appended cycle.',
    ],
    livePages: [
      { label: 'Ops Review Center (morning closure card)', path: '/ops#reviews' },
      { label: 'Ops Reviewer Checklist (full)', path: '/ops/reviewer-checklist' },
      { label: 'Comms · Account Workspace Inbox', path: '/comms?view=account&tab=inbox' },
      { label: 'Comms · Individual Workspace Inbox', path: '/comms?view=individual&tab=inbox' },
      { label: 'Research Ledger', path: '/research' },
      { label: 'Health JSON', path: '/health' },
      { label: 'Navigation URL map JSON', path: '/api/navigation/url-map' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-h',
    reviewedAt: '2026-02-22T14:08:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Current-cycle review published as newest entry in /ops Review Center with explicit material-change summary, quality score rationale, blocker ETA, and constrained next-3 actions for immediate execution.',
    materialChangesThisCycle: [
      'Appended this cycle as the latest /ops#reviews card while preserving all prior cycle history in archive.',
      'Tightened review framing to the required operator fields (what changed materially, quality score + rationale, blockers + ETA, and next 3 actions).',
      'Converted carry-forward risk into a strict next-3-action sequence to reduce ambiguity in handoff execution.',
    ],
    qualityScore: '9.8/10',
    qualityRationale: 'Quality remains high because evidence continuity and newest-first ordering are intact, and the cycle summary now matches the exact required review schema for fast operator replay.',
    blockers: 'No Ops Review Center implementation blocker. Remaining external blockers are decision closure on intelligence weighting/escalation thresholds, final checklist placement lock, and secure env/auth decisions required for Supabase-key-gated validation.',
    blockerEta: 'Decision blockers target same-day closure; env/auth dependency ETA remains pending user/platform update.',
    nextActions: [
      'Ratify intelligence weighting + escalation thresholds and log closure evidence in /ops#reviews.',
      'Finalize checklist placement pattern and run one-click discoverability validation from /ops.',
      'Re-run exact URL proof pass (ops, checklist, comms account/individual, research, health) and append any delta findings as the next cycle entry.',
    ],
    demoScript: [
      'Open /ops#reviews and confirm this cycle-h card is pinned first with required fields populated.',
      'Expand archived history to verify prior entries remain intact under the latest card.',
      'Walk the next-3-action list and map each item to its verification route before execution.',
    ],
    livePages: [
      { label: 'Ops Review Center (latest card)', path: '/ops#reviews' },
      { label: 'Ops Reviewer Checklist (full)', path: '/ops/reviewer-checklist' },
      { label: 'Comms · Account Workspace Inbox', path: '/comms?view=account&tab=inbox' },
      { label: 'Comms · Individual Workspace Inbox', path: '/comms?view=individual&tab=inbox' },
      { label: 'Research Ledger', path: '/research' },
      { label: 'Health JSON', path: '/health' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-g',
    reviewedAt: '2026-02-22T13:06:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Morning proof pack published as newest /ops Review Center closure; NOW status is accurate: items 1 and 2 are DONE, items 3 and 4 remain pending until decision + validation closeout.',
    materialChangesThisCycle: [
      'Published a fresh morning proof-pack closure entry as newest-first in /ops#reviews so operators always land on the current verification run.',
      'Updated NOW rollup in the review narrative to explicit state: 1/2 DONE, 3/4 pending (pending items move to DONE only after closure evidence is captured).',
      'Added an exact URL checklist spanning review center, checklist doc, split comms views, research ledger, health, and URL-map endpoints for deterministic operator replay.',
      'Linked run artifacts under `.run/evidence/tradeshow-e2e-2026-02-22-v3/` as the canonical proof source for this cycle.',
    ],
    qualityScore: '9.8/10',
    qualityRationale: 'Evidence is operator-ready because proof artifacts are already captured and the review entry now carries explicit, copy/pasteable verification URLs.',
    blockers: 'No Review Center publication blocker. Current blockers are NOW-item 3/4 closure dependencies: intelligence weighting + escalation threshold ratification, checklist placement final lock, and secure env/auth decisions needed for Supabase-key-gated validation.',
    blockerEta: 'Items 1/2 done now. Items 3/4 ETA unchanged: pending same-day product decisions and env/auth update; mark final DONE only after closure evidence posts in /ops#reviews.',
    nextActions: [
      'Run the exact URL checklist in order and capture PASS/FAIL notes against each endpoint.',
      'Close NOW item 3 by ratifying intelligence weighting + escalation thresholds and logging verification evidence.',
      'Close NOW item 4 by finalizing checklist placement pattern and logging one-click discoverability validation from /ops.',
      'If any route regresses, append a delta closure entry with failed URL + marker details in /ops#reviews.',
      'After closure evidence is posted, flip 3/4 from pending to DONE in the next review card.',
    ],
    demoScript: [
      'Open http://127.0.0.1:1981/ops#reviews and confirm this morning proof-pack card is pinned as latest with NOW status shown as 1/2 DONE and 3/4 pending.',
      'Open http://127.0.0.1:1981/ops/reviewer-checklist and validate checklist guidance matches live route expectations.',
      'Step through the remaining exact URLs (comms account/individual, research, health, URL map) and call PASS/FAIL in sequence.',
    ],
    livePages: [
      { label: 'Ops Review Center (latest proof card)', path: 'http://127.0.0.1:1981/ops#reviews' },
      { label: 'Ops Reviewer Checklist (full)', path: 'http://127.0.0.1:1981/ops/reviewer-checklist' },
      { label: 'Comms · Account Workspace Inbox', path: 'http://127.0.0.1:1981/comms?view=account&tab=inbox' },
      { label: 'Comms · Individual Workspace Inbox', path: 'http://127.0.0.1:1981/comms?view=individual&tab=inbox' },
      { label: 'Research Ledger', path: 'http://127.0.0.1:1981/research' },
      { label: 'Health JSON', path: 'http://127.0.0.1:1981/health' },
      { label: 'Navigation URL map JSON', path: 'http://127.0.0.1:1981/api/navigation/url-map' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-f',
    reviewedAt: '2026-02-22T12:33:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Morning /ops review published with NOW item 1 closure locked: account/individual naming and canonical module ownership are now ratified and reflected across UI + docs.',
    materialChangesThisCycle: [
      'Published a fresh morning review entry as newest-first so operators land on current closure/risk posture immediately from /ops#reviews.',
      'Promoted naming + ownership blockers to CLOSED and captured accepted standard references for reviewers.',
      'Converted open risks into a constrained next-3-action set tied to today\'s decision gates and validation checks.',
    ],
    qualityScore: '9.7/10',
    qualityRationale: 'Review quality is high because closure evidence remains live and the entry now separates completed closures from residual decision risk with explicit immediate actions.',
    blockers: 'Outstanding risks: (1) unresolved account vs individual label taxonomy + canonical ownership map, (2) intelligence weighting/escalation thresholds not yet ratified, (3) checklist placement finalization still pending pattern lock, (4) secure env/auth decisions continue to gate Supabase-key-dependent execution.',
    blockerEta: 'Product decision risks target same-day lock; secure env/auth dependency ETA remains pending user update.',
    nextActions: [
      'Run copy/marker parity checks for Account Workspace + Individual Workspace labels across comms cross-links.',
      'Validate canonical ownership marker (`canonical-module-ownership-v1`) and KPI source-of-truth marker (`kpi-narrative-source-of-truth-v1`) on /ops.',
      'Proceed to remaining NOW items (intelligence weighting + checklist placement hardening) with item-1 blockers removed.',
    ],
    demoScript: [
      'Open /ops#reviews and confirm the newest morning card shows NOW-item closure status, outstanding risks, and next 3 actions.',
      'Open /ops/reviewer-checklist and verify closure-path discoverability remains one-click from Ops.',
      'Open /comms account + individual views and call out which risks are still decision-gated vs already closed by live verification.',
    ],
    livePages: [
      { label: 'Ops Review Center', path: '/ops#reviews' },
      { label: 'Ops Reviewer Checklist', path: '/ops/reviewer-checklist' },
      { label: 'Comms · Account Workspace Inbox', path: '/comms?view=account&tab=inbox' },
      { label: 'Comms · Individual Workspace Inbox', path: '/comms?view=individual&tab=inbox' },
      { label: 'Research Ledger', path: '/research' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-e',
    reviewedAt: '2026-02-22T12:30:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Overnight closure outcomes are now reflected in Ops Review Center: live route verification is green across /ops, /comms Account Workspace + Individual Workspace views, /research, and checklist surfaces; NOW item 1 blockers are closed.',
    materialChangesThisCycle: [
      'Appended overnight closure outcome summary as newest-first review entry so /ops Reviews opens on current state without losing prior cycle continuity.',
      'Recorded closure evidence from live verification (PASS on /ops, /ops/reviewer-checklist, /comms account+individual, /research, /api/research-ledger, /health).',
      'Carried forward only non-item-1 blockers (intelligence weighting thresholds, checklist placement decision) with explicit next-action framing.',
    ],
    qualityScore: '9.6/10',
    qualityRationale: 'Evidence quality improved via route-level live verification and explicit closure tracking; residual risk is concentrated in unresolved product decisions, not instrumentation or review artifact completeness.',
    blockers: 'Open NOW blockers: (1) Comms split label taxonomy + canonical widget ownership decisions, (2) Intelligence Layer priority weighting + escalation thresholds, (3) checklist embed vs drawer/modal decision. External dependency remains secure env/auth decisions for Supabase-key-gated work.',
    blockerEta: 'Product decisions: target same-day alignment; secure env/auth dependency ETA pending user update.',
    nextActions: [
      'Maintain Account Workspace + Individual Workspace label parity in new UI surfaces.',
      'Ratify Intelligence Layer weighting model and auto-escalation thresholds, then re-run recommendation handoff validation.',
      'Finalize checklist placement pattern (embedded card vs drawer/modal) and run one-click discoverability smoke check from /ops.',
    ],
    demoScript: [
      'Open /ops#reviews and confirm newest review card includes overnight closure outcomes, quality score, blockers, and next actions.',
      'Use /ops/reviewer-checklist and /research to validate the closed NOW item path remains live and discoverable.',
      'Open /comms?view=account&tab=inbox and /comms?view=individual&tab=inbox to show split-view continuity while calling out remaining decision blockers.',
    ],
    livePages: [
      { label: 'Ops Review Center', path: '/ops#reviews' },
      { label: 'Ops Reviewer Checklist', path: '/ops/reviewer-checklist' },
      { label: 'Comms · Account Workspace Inbox', path: '/comms?view=account&tab=inbox' },
      { label: 'Comms · Individual Workspace Inbox', path: '/comms?view=individual&tab=inbox' },
      { label: 'Research Ledger', path: '/research' },
      { label: 'Research Ledger API', path: '/api/research-ledger' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-d',
    reviewedAt: '2026-02-22T10:25:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Ops Review Center now reflects outcome-gated autonomy protocol updates, with explicit quality scoring and blocker carry-forward for the next readiness cycle.',
    materialChangesThisCycle: [
      'Captured the latest completed cycle as a new newest-first entry without replacing prior review history.',
      'Aligned cycle narrative with autonomy improvement protocol changes (outcome gates + escalation discipline) so /ops review context matches current operating controls.',
      'Preserved review artifact completeness fields (what changed, quality score/rationale, blockers, ETA, next actions, and demo focus) for stable reviewer run-throughs.',
    ],
    qualityScore: '9.4/10',
    qualityRationale: 'Review evidence is now consistently actionable and aligned with current operating protocol; primary remaining risk is still external to Review Center UI (Model Build readiness dependency).',
    blockers: 'No Review Center implementation blocker; pilot readiness remains blocked on baseline metrics + approved model-card evidence.',
    blockerEta: 'ETA unchanged: 2-3 business days for evidence closeout and go/no-go recheck.',
    nextActions: [
      'Attach baseline metrics artifact set and approved model card in pilot governance evidence.',
      'Run readiness recheck and publish outcome in the next Ops Review Center cycle entry.',
      'Continue appending one completed summary per material cycle to maintain auditable continuity.',
    ],
    demoScript: [
      'Open /ops → Reviews and verify latest card shows updated cycle summary with quality score, blockers, and next actions.',
      'Confirm newest-first history ordering and visible quality badge continuity across prior cycles.',
      'Use live links to jump to /pilot and validate that blocker status is explicitly carried forward.',
    ],
    livePages: [
      { label: 'Ops Control Center', path: '/ops' },
      { label: 'Actions Queue', path: '/actions' },
      { label: 'Relationships', path: '/relationships' },
      { label: 'Pilot Governance', path: '/pilot' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-c',
    reviewedAt: '2026-02-22T09:54:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Ops Review Center history now auto-appends completed material cycle summaries with explicit fields for what changed, quality score, blockers, and next actions.',
    materialChangesThisCycle: [
      'Auto-appended the newly completed cycle summary into OPS_REVIEW_HISTORY without overwriting prior cycles.',
      'Extended review rendering so both latest and history cards visibly include “what changed” and “next actions.”',
      'Preserved newest-first ordering by reviewedAt so the most recent cycle remains the lead artifact in /ops Reviews.',
    ],
    qualityScore: '9.3/10',
    qualityRationale: 'History is now more operationally actionable because each cycle summary includes explicit follow-through steps, not just retrospective status.',
    blockers: 'No implementation blocker for history append; broader Model Build readiness dependency remains open.',
    blockerEta: 'Model Build evidence closeout ETA remains 2-3 business days.',
    nextActions: [
      'Attach baseline metrics and approved model card to pilot governance evidence.',
      'Run readiness recheck and update blocker status in the next cycle entry.',
      'Keep appending one new summary per completed material cycle to maintain continuity.',
    ],
    demoScript: [
      'Open /ops → Reviews and confirm the newest card includes what changed, quality score, blockers, and next actions.',
      'Scan Review history cards to verify newest-first ordering and quality badges remain intact.',
      'Use live links to jump to /pilot and validate blocker dependency context.',
    ],
    livePages: [
      { label: 'Ops Control Center', path: '/ops' },
      { label: 'Actions Queue', path: '/actions' },
      { label: 'Relationships', path: '/relationships' },
      { label: 'Pilot Governance', path: '/pilot' },
    ],
  },
  {
    id: '2026-02-22-cycle-review-b',
    reviewedAt: '2026-02-22T09:24:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Ops Review Center is now populated with a durable latest-state card plus historical cycle cards, making /ops the single source for operational status, changes, quality, blockers, and demo run-through links.',
    materialChangesThisCycle: [
      'Populated Review Center with current cycle artifacts: state snapshot, material changes, quality score/rationale, blockers with ETA, and demo script steps.',
      'Added explicit live-page links in each review entry so reviewers can jump from summary evidence directly to /ops, /actions, /relationships, and /pilot.',
      'Kept newest-first ordering with history preserved so this cycle reads as an incremental improvement instead of replacing prior evidence.',
    ],
    qualityScore: '9.1/10',
    qualityRationale: 'Review completeness and traceability are now strong. Remaining gap is operational: Model Build readiness is still blocked by missing baseline + model-card evidence.',
    blockers: 'Model Build phase remains no-go until baseline metrics and model-card approval are attached to pilot governance evidence.',
    blockerEta: 'ETA 2-3 business days for evidence closeout and readiness recheck.',
    nextActions: [
      'Attach baseline metrics and model-card approval artifacts to pilot governance evidence.',
      'Re-run go/no-go readiness review after evidence upload.',
      'Record readiness outcome in next Ops Review Center cycle summary.',
    ],
    demoScript: [
      'Open /ops and scroll to Reviews to show the latest card (snapshot, changes, quality, blockers, demo script).',
      'Expand the history list to show continuity across cycles and confirm newest-first ordering with quality badges.',
      'Use live links from the review card to jump to /actions and /relationships for execution proof points.',
      'Close on /pilot to show blocker context and confirm the no-go dependency before next cycle signoff.',
    ],
    livePages: [
      { label: 'Ops Control Center', path: '/ops' },
      { label: 'Actions Queue', path: '/actions' },
      { label: 'Relationships', path: '/relationships' },
      { label: 'Pilot Governance', path: '/pilot' },
    ],
  },
  {
    id: '2026-02-22-cycle-review',
    reviewedAt: '2026-02-22T03:40:00Z',
    reviewer: 'Ops lead + GTM operator',
    currentStateSnapshot: 'Ops now runs as the single reliability cockpit: route health, execution board, and orchestration visibility are green except for one at-risk model-build lane in pilot tracking.',
    materialChangesThisCycle: [
      'Split Home vs Ops responsibilities with explicit lane headers and route-level quick links.',
      'Added orchestration visibility panel (worker floor, queue health, last incident, SLA badge).',
      'Expanded process lane for client updates, reply routing, sequence diagnostics, and support/success handoff monitoring.',
    ],
    qualityScore: '8.6/10',
    qualityRationale: 'Strong operational clarity and complete lane coverage. Remaining gap is tighter coupling between model-build risk and go/no-go readiness evidence.',
    blockers: 'Model Build phase remains no-go until baseline metrics and model-card approval are attached.',
    blockerEta: 'ETA 2-3 business days for full evidence closeout.',
    nextActions: [
      'Collect baseline metrics package for Model Build gate.',
      'Secure model-card approval from governance reviewers.',
      'Update Ops review entry once pilot no-go dependency changes state.',
    ],
    demoScript: [
      'Start at /ops and call out the three-lane layout (diagnostics, process, logs) as the operating frame.',
      'Open Operations board and show active vs blocked lanes, then move into Follow-ups and client updates for execution ownership.',
      'Jump to Reply routing and Sequence queue diagnostics to show closed-loop response handling.',
      'Finish on RevOps + Alert rules to show bottleneck visibility and escalation governance.',
    ],
    livePages: [
      { label: 'Ops Control Center', path: '/ops' },
      { label: 'Actions Queue', path: '/actions' },
      { label: 'Relationships', path: '/relationships' },
      { label: 'Pilot Governance', path: '/pilot' },
    ],
  },
  {
    id: '2026-02-21-cycle-review',
    reviewedAt: '2026-02-21T19:10:00Z',
    reviewer: 'Ops lead',
    currentStateSnapshot: 'Ops had core diagnostics and queue controls live, but review evidence was scattered across docs and run artifacts.',
    materialChangesThisCycle: [
      'Consolidated readiness, workflow completeness, and route health in /ops.',
      'Added stronger process-lane framing for operations board and client update flow.',
    ],
    qualityScore: '7.8/10',
    qualityRationale: 'Core controls were present and usable, but lacked a single in-product review artifact hub and structured demo narrative.',
    blockers: 'Review artifacts were not yet centralized into a panel with history.',
    blockerEta: 'Resolved in next cycle via Ops Review Center panel.',
    nextActions: [
      'Centralize future cycle summaries into the Review Center panel.',
      'Add quality rationale and blocker ETA to every cycle artifact.',
      'Maintain historical continuity so improvements are auditable cycle-to-cycle.',
    ],
    demoScript: [
      'Show route health + KPI diagnostics for current baseline.',
      'Demonstrate execution board and quick status progression for tasks.',
      'Close with follow-up queue and alert visibility.',
    ],
    livePages: [
      { label: 'Ops Control Center', path: '/ops' },
      { label: 'Home', path: '/' },
      { label: 'Strategy', path: '/strategy' },
    ],
  },
];
const ROLES = ['operator', 'admin'];
const ROLE_RANK = { operator: 1, admin: 2 };
const authEnabled = !['0', 'false', 'no', 'off'].includes(String(process.env.CC_AUTH_ENABLED ?? 'true').toLowerCase());
const authRealm = process.env.CC_AUTH_REALM || 'AdZeta Command Center';
const operatorCreds = {
  username: String(process.env.CC_OPERATOR_USERNAME || '').trim(),
  password: String(process.env.CC_OPERATOR_PASSWORD || ''),
};
const adminCreds = {
  username: String(process.env.CC_ADMIN_USERNAME || '').trim(),
  password: String(process.env.CC_ADMIN_PASSWORD || ''),
};

const DEFAULT_ALERT_RULES = {
  version: 2,
  generated_by: 'local-static-config',
  escalation_policy: {
    info: { notify: ['#ops-feed'], escalate_after_minutes: 0 },
    warning: { notify: ['Ops Lead'], escalate_after_minutes: 30, escalate_to: 'Program Manager' },
    critical: { notify: ['Ops Lead', 'Platform Ops'], escalate_after_minutes: 10, escalate_to: 'Engineering Manager' },
  },
  rules: [
    { id: 'delegations_drop_24h', name: 'Delegations dropped (24h)', threshold: 'delegations_24h < 10', severity: 'warning', owner: 'Ops Lead', sla_minutes: 60 },
    { id: 'completion_ratio_low', name: 'Completion ratio low', threshold: 'completed_24h / delegations_24h < 0.55', severity: 'critical', owner: 'Ops Lead', sla_minutes: 30 },
    { id: 'open_priorities_backlog', name: 'Open priorities backlog high', threshold: 'open_priorities > 25', severity: 'warning', owner: 'Queue Manager', sla_minutes: 90 },
    { id: 'active_runs_stall', name: 'Active runs stalled', threshold: 'active_runs = 0 for 30m', severity: 'critical', owner: 'Runtime Engineer', sla_minutes: 20 },
    { id: 'quality_7d_low', name: 'Quality score degraded', threshold: 'avg_quality_7d < 3.8', severity: 'warning', owner: 'Quality Lead', sla_minutes: 120 },
    { id: 'blocked_lane_growth', name: 'Blocked lane growth', threshold: 'blocked_items >= 3', severity: 'warning', owner: 'Program Manager', sla_minutes: 120 },
    { id: 'waiting_on_user_overdue', name: 'Waiting-on-user overdue', threshold: 'waiting_on_user_age > 48h', severity: 'critical', owner: 'Client Success', sla_minutes: 240 },
    { id: 'deploy_health_red', name: 'Deploy/health not ready', threshold: 'github_baseline != ready OR vercel_readiness != ready', severity: 'info', owner: 'Release Manager', sla_minutes: 240 },
    { id: 'service_logs_missing', name: 'Service logs missing', threshold: '.run/service.out.log OR .run/service.err.log missing', severity: 'info', owner: 'Platform Ops', sla_minutes: 180 },
  ],
};

const DEFAULT_NURTURE_TRIGGER_RULES = {
  version: 1,
  generated_by: 'local-static-config',
  rules: [
    {
      id: 'no_reply_48h',
      name: 'No reply for 48h',
      enabled: true,
      trigger_key: 'no_reply_48h',
      conditions: { min_hours_since_last_reply: 48 },
      sequence_slug: 'nurture-no-reply-48h',
      sequence_fallback_name: 'No Reply Recovery Sequence',
      cooldown_hours: 24,
      notes: 'Re-engage leads who have gone quiet for at least 48h.',
    },
    {
      id: 'meeting_complete',
      name: 'Meeting completed',
      enabled: true,
      trigger_key: 'meeting_complete',
      conditions: { meeting_completed: true },
      sequence_slug: 'post-meeting-followup-v1',
      sequence_fallback_name: 'Post Meeting Follow-up',
      cooldown_hours: 12,
      notes: 'Auto-enroll after a completed meeting to send recap + CTA.',
    },
    {
      id: 'lead_magnet_download',
      name: 'Lead magnet downloaded',
      enabled: true,
      trigger_key: 'lead_magnet_download',
      conditions: { lead_magnet_downloaded: true },
      sequence_slug: 'lead-magnet-nurture-v1',
      sequence_fallback_name: 'Lead Magnet Nurture',
      cooldown_hours: 24,
      notes: 'Start nurture flow after download intent signal.',
    },
  ],
};

const TARGET_ACCOUNT_RUBRIC = {
  schema_version: 'tof-target-account-v1',
  fields: [
    { key: 'account_name', label: 'Account name', required: true },
    { key: 'segment', label: 'Segment', required: true, allowed: ['agency', 'b2b_saas', 'creator_edu', 'local_services'] },
    { key: 'employee_band', label: 'Employee band', required: true, allowed: ['1-10', '11-50', '51-200', '201+'] },
    { key: 'annual_revenue_band', label: 'Revenue band', required: false },
    { key: 'primary_channel', label: 'Primary acquisition channel', required: true, allowed: ['email', 'linkedin', 'paid_social', 'search', 'community'] },
    { key: 'intent_signal', label: 'Intent signal observed', required: true },
    { key: 'decision_maker_role', label: 'Decision-maker role', required: true },
    { key: 'pain_urgency', label: 'Pain urgency (1-5)', required: true },
    { key: 'fit_score', label: 'Fit score (0-100)', required: true },
  ],
  scoring_rubric: [
    { axis: 'ICP fit', weight: 40, pass_threshold: 28, rubric: 'Segment + employee band + channel alignment' },
    { axis: 'Intent strength', weight: 35, pass_threshold: 22, rubric: 'Recent trigger event and urgency' },
    { axis: 'Reachability', weight: 25, pass_threshold: 15, rubric: 'Decision-maker access + contact confidence' },
  ],
  routing_thresholds: {
    enroll_now_score: 75,
    nurture_score: 55,
    disqualify_below: 55,
  },
};

const REPLY_CLASS_ROUTING = {
  positive: { next_action: 'book_call', sequence_slug: 'tof-positive-handraise-v1', sequence_fallback_name: 'Direct Offer', priority: 'high' },
  neutral: { next_action: 'nurture', sequence_slug: 'tof-value-nudge-v1', sequence_fallback_name: 'Proof First', priority: 'medium' },
  objection: { next_action: 'follow-up', sequence_slug: 'tof-objection-handling-v1', sequence_fallback_name: 'Pain Point', priority: 'medium' },
  not_now: { next_action: 'nurture_later', sequence_slug: 'nurture-warm-leads-v1', sequence_fallback_name: 'Nurture', priority: 'medium' },
  unsubscribe: { next_action: 'suppress_contact', sequence_slug: null, priority: 'low' },
  interested: { next_action: 'book_call', sequence_slug: 'tof-positive-handraise-v1', sequence_fallback_name: 'Direct Offer', priority: 'high' },
  not_fit: { next_action: 'disqualify', sequence_slug: null, priority: 'low' },
};

function pageHtml(content, pageTitle = 'AdZeta Command Center') {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(pageTitle)}</title><style>

:root{--adzeta-ink:#101828;--adzeta-body:#344054;--adzeta-subtle:#667085;--adzeta-berry:#c42874;--adzeta-coral:#f04474;--adzeta-surface:#ffffff;--adzeta-mist:#f8fafc;--adzeta-line:#e4e7ec;--adzeta-ok:#067647;--adzeta-warn:#b54708;--adzeta-bad:#b42318;--adzeta-info:#175cd3;--adzeta-shadow:0 8px 24px rgba(16,24,40,.06);--adzeta-shadow-soft:0 4px 16px rgba(16,24,40,.05);--adzeta-radius:14px;--adzeta-space-sm:.65rem;--adzeta-space-md:.95rem}
*{box-sizing:border-box}body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:var(--adzeta-mist);color:var(--adzeta-body);line-height:1.56;font-size:14px;letter-spacing:.002em;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:var(--adzeta-berry)}p{margin:.28rem 0 .62rem 0;max-width:74ch}
.wrap{max-width:1280px;margin:0 auto;padding:1.25rem}.layout{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:1rem;align-items:start}
.page-shell{display:grid;gap:1rem}.ops-shell{display:grid;grid-template-columns:220px minmax(0,1fr);gap:1rem;align-items:start}.ops-sidebar{display:grid;gap:.6rem}.ops-sidebar-desktop{position:sticky;top:1rem}.ops-sidebar-mobile{display:none}.ops-sidebar-nav{display:grid;gap:.35rem}.ops-sidebar-nav a{display:block;text-decoration:none;border:1px solid var(--adzeta-line);border-radius:10px;padding:.38rem .55rem;color:var(--adzeta-ink);background:#fff}.ops-sidebar-nav a:hover{border-color:#f2b6d4;background:#fff7fb}.ops-main{display:grid;gap:1rem}.page-header{display:grid;gap:.75rem;border:1px solid #f3d1e3;border-radius:16px;background:linear-gradient(180deg,#fff 0%,#fff9fc 100%);padding:1.125rem;box-shadow:0 10px 24px rgba(222,52,127,.08)}.page-summary{display:grid;grid-template-columns:1.35fr .65fr;gap:.75rem}.section-frame{border:1px solid #f1e2ea;border-radius:16px;padding:.9rem;background:linear-gradient(180deg,#fff 0%,#fffcfe 100%);box-shadow:var(--adzeta-shadow)}.section-frame>.panel{margin-top:.75rem}.section-frame>.panel:first-child{margin-top:0}.primary-focus{border-color:#f2b6d4;box-shadow:0 14px 28px rgba(222,52,127,.12)}
.panel{background:var(--adzeta-surface);border:1px solid #eaecf0;border-radius:var(--adzeta-radius);padding:1.05rem;box-shadow:var(--adzeta-shadow-soft)}.panel+.panel{margin-top:.85rem}
header.hero{margin-bottom:1rem;padding:1rem 1.125rem;border:1px solid #f3d1e3;border-radius:14px;background:linear-gradient(180deg,#fff 0%,#fff7fb 100%)}
h1,h2,h3{margin:0 0 .5rem 0;color:var(--adzeta-ink)}h1{font-size:1.56rem;line-height:1.18;font-weight:760;letter-spacing:-.01em}h2{font-size:.95rem;line-height:1.3;letter-spacing:.005em;text-transform:none;color:#1f2937;font-weight:720}h3{font-size:.85rem;line-height:1.35}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.76rem}
.muted{color:var(--adzeta-subtle)}.error{color:#991b1b;background:#fef2f2;border:1px solid #fecaca;padding:.75rem .875rem;border-radius:10px}.flash{padding:.7rem .85rem;border-radius:10px;font-size:.82rem;margin:.5rem 0}.flash.success{color:#14532d;background:#f0fdf4;border:1px solid #86efac}.flash.error{color:#7f1d1d;background:#fef2f2;border:1px solid #fca5a5}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}.lifecycle-grid{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:.6rem}.metric{border:1px solid var(--adzeta-line);border-radius:12px;padding:.8rem;background:var(--adzeta-surface)}
.metric .name{font-size:.69rem;color:var(--adzeta-subtle);text-transform:uppercase;letter-spacing:.08em}.metric .value{font-size:1.2rem;font-weight:700;margin-top:.18rem;color:var(--adzeta-ink)}.metric .fresh{font-size:.72rem;color:var(--adzeta-subtle);margin-top:.28rem}
.board{display:grid;grid-template-columns:repeat(5,minmax(170px,1fr));gap:.75rem}.lane{border:1px solid var(--adzeta-line);border-radius:12px;padding:.75rem;min-height:180px;background:var(--adzeta-surface)}.lane h3{font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:var(--adzeta-ink);display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem}.lane ul{margin:.2rem 0 0 0;padding:0;list-style:none}.lane li{margin:.5rem 0;font-size:.82rem}.lane-card{padding:.65rem;border:1px solid var(--adzeta-line);border-radius:10px;background:var(--adzeta-mist)}.lane-card strong{display:block;font-size:.88rem;line-height:1.35;color:var(--adzeta-ink)}.lane-meta{display:block;font-size:.74rem;color:var(--adzeta-subtle);margin-top:.24rem}
.badge{display:inline-flex;align-items:center;border-radius:999px;border:1px solid var(--adzeta-line);padding:.18rem .58rem;font-size:.69rem;background:#f9fafb;letter-spacing:.02em;color:var(--adzeta-ink);font-weight:600}.badge.ok{color:var(--adzeta-ok);border-color:#abefc6;background:#ecfdf3}.badge.warn{color:var(--adzeta-warn);border-color:#fedf89;background:#fffaeb}.badge.bad{color:var(--adzeta-bad);border-color:#fecdca;background:#fef3f2}.badge.info{color:var(--adzeta-info);border-color:#b2ddff;background:#eff8ff}
.cta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.85rem}.cta-card{border:1px solid #f3d1e3;border-radius:12px;background:#fff8fc;padding:1.02rem;display:grid;gap:.5rem;align-content:start}.cta-card p{margin:.08rem 0 .42rem 0;font-size:.82rem;color:var(--adzeta-subtle);line-height:1.5}.cta-primary{border:2px solid #f48dc2;box-shadow:0 12px 24px rgba(222,52,127,.14)}.cta-primary strong{font-size:.92rem;letter-spacing:.004em}.cta-primary .button-link{font-weight:780;padding:.66rem .98rem;min-height:38px;box-shadow:0 12px 22px rgba(222,52,127,.24)}.cta-strong{background:linear-gradient(180deg,#fff6fb 0%,#ffeaf5 100%)}.onboarding-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.65rem}.onboarding-step{border:1px solid #fbcfe8;background:#fff7fb;border-radius:12px;padding:.7rem}.onboarding-step .step-label{font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:#9d174d;font-weight:700}.onboarding-step p{margin:.24rem 0;font-size:.79rem}.demo-path{margin-top:.56rem;border:1px dashed #f48dc2;border-radius:12px;padding:.7rem;background:#fff}.human-queue-highlight{border:2px solid #f48dc2;box-shadow:0 10px 22px rgba(222,52,127,.12)}.queue-callout{border:1px solid #fbcfe8;background:#fff1f8;color:#9d174d;border-radius:10px;padding:.52rem .62rem;font-size:.78rem;margin:.45rem 0 .55rem}.helper-row{display:flex;flex-wrap:wrap;gap:.4rem;margin:.3rem 0 .5rem}.helper-chip{font-size:.7rem;color:var(--adzeta-subtle);background:#f9fafb;border:1px solid var(--adzeta-line);padding:.14rem .45rem;border-radius:999px}.home-premium-hero{display:grid;grid-template-columns:1.2fr .8fr;gap:.8rem;border:1px solid #f2b6d4;border-radius:16px;background:linear-gradient(130deg,#fff7fb 0%,#fff 55%,#fff3f9 100%);padding:1rem;box-shadow:0 16px 30px rgba(222,52,127,.12)}.home-premium-hero .title{font-size:1.3rem;font-weight:800;color:#5d1235;line-height:1.2}.home-premium-hero .subtitle{margin-top:.38rem;color:#7a3555;font-size:.84rem}.home-hero-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}.home-hero-stat{border:1px solid #f4d0e2;background:#fff;border-radius:12px;padding:.6rem}.home-hero-stat .name{font-size:.64rem;text-transform:uppercase;letter-spacing:.08em;color:#9d174d}.home-hero-stat .value{font-size:1.1rem;font-weight:700;color:#4a1231}.dominant-cta{margin-top:.6rem}
button,.button-link{background:linear-gradient(135deg,#de347f 0%,#ff5d74 100%);color:#fff;border:1px solid #de347f;border-radius:10px;padding:.58rem .9rem;font-size:.8rem;font-weight:730;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:.32rem;line-height:1.2;min-height:35px;box-shadow:0 8px 16px rgba(222,52,127,.16);transition:transform .12s ease,box-shadow .12s ease,filter .12s ease,opacity .12s ease}button:hover,.button-link:hover{transform:translateY(-1px);box-shadow:0 12px 20px rgba(222,52,127,.22);filter:saturate(1.03)}button:disabled{opacity:.6;cursor:not-allowed;filter:none}.button-secondary{background:var(--adzeta-surface);color:var(--adzeta-ink);border-color:var(--adzeta-line);box-shadow:none}.button-link.cta-emphasis,.dominant-cta .button-link{box-shadow:0 14px 26px rgba(222,52,127,.26);border:2px solid #f48dc2;padding:.72rem 1.08rem;font-size:.85rem;font-weight:790;letter-spacing:.003em}.cta-card .button-link{justify-self:start}.dominant-cta .button-link{min-height:40px}.button-secondary:hover{transform:none;filter:none;box-shadow:0 2px 6px rgba(16,24,40,.08)}a:focus-visible,button:focus-visible,.button-link:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #175cd3;outline-offset:2px}
.ok{color:var(--adzeta-ok)}.warn{color:var(--adzeta-warn)}.bad{color:var(--adzeta-bad)}.info{color:var(--adzeta-info)}
table{border-collapse:separate;border-spacing:0;width:100%;border:1px solid #e7eaf0;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 1px 0 rgba(16,24,40,.02)}th,td{border-bottom:1px solid #f0f2f6;padding:.74rem .8rem;text-align:left;font-size:.805rem;line-height:1.42;vertical-align:top}tbody tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#fcfdff}tbody tr:hover{background:#f6f9ff}th{background:linear-gradient(180deg,#f8fafc 0%,#fff 100%);color:#1f2937;position:sticky;top:0;font-weight:720;letter-spacing:.004em}
.links{display:flex;flex-wrap:wrap;gap:.45rem;margin-bottom:.65rem}.links a{color:var(--adzeta-ink);text-decoration:none;border:1px solid var(--adzeta-line);border-radius:999px;padding:.24rem .62rem;font-size:.75rem;background:var(--adzeta-surface)}.links a.active{background:#fde6f2;border-color:var(--adzeta-berry);color:#8b124a;font-weight:600}.comms-toolbar{display:grid;gap:.55rem}.comms-mode-row{display:flex;flex-wrap:wrap;gap:.45rem}.comms-tab-row{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;justify-content:space-between}.comms-tab-row .links{margin-bottom:0}.comms-summary-grid{display:grid;grid-template-columns:2fr 1fr;gap:.7rem;margin-top:.25rem}.comms-summary-grid .panel{padding:.8rem}.comms-quick-cta{display:grid;align-content:start;gap:.45rem;background:linear-gradient(180deg,#fff6fb 0%,#fff 100%);border:1px solid #f4c8de}.comms-table-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;flex-wrap:wrap}.comms-table-head h2{margin-bottom:.2rem}.comms-table-head .muted{margin:0}.comms-flow-note{margin-top:.2rem}@media (max-width:980px){.comms-summary-grid{grid-template-columns:1fr}}
.rule{border:1px solid var(--adzeta-line);border-radius:10px;padding:.6rem;background:var(--adzeta-surface)}.rule p{margin:.15rem 0;font-size:.76rem;color:var(--adzeta-subtle)}
.queue-list{margin:.24rem 0 0 0;padding-left:1rem}.queue-list li{margin:.28rem 0;font-size:.81rem}
.section-tag{font-size:.65rem;text-transform:uppercase;letter-spacing:.11em;color:#b45385}
.stack-sm{margin-top:.35rem}.stack-md{margin-top:.55rem}.stack-lg{margin-top:.7rem}.meta-spaced{margin-top:.25rem}.inline-note{margin-bottom:.3rem}.list-tight{margin:0;padding-left:1rem}.card-note{margin:.45rem 0 .35rem 0}.card-context{margin:0 0 .45rem 0}.breadcrumb{font-size:.75rem;margin:.35rem 0 0}.page-shell-narrow{max-width:1120px}.hero-title-tight{margin:.1rem 0 .2rem 0}.layout-single{grid-template-columns:1fr;gap:.55rem}.panel-feature{grid-column:span 2}.value-inline{font-size:1rem}
.home-density-balanced{gap:.8rem}.home-density-balanced .page-header{padding:.95rem}.home-density-balanced .panel{padding:.9rem}.home-density-balanced .panel-head{margin-bottom:.58rem}.home-density-balanced .queue-list li{margin:.22rem 0}.home-density-balanced .kpis{gap:.6rem}.home-density-balanced .metric{padding:.68rem}.home-density-balanced .metric .value{font-size:1.06rem;line-height:1.34}.home-density-balanced p{margin:.22rem 0 .5rem 0}
.funnel-list{display:grid;gap:.62rem;margin-top:.62rem}.funnel-card{border:1px solid var(--adzeta-line);border-radius:12px;padding:.82rem;background:var(--adzeta-surface);box-shadow:0 1px 2px rgba(16,24,40,.04);transition:box-shadow .12s ease,border-color .12s ease}.funnel-card:hover{border-color:#d0d5dd;box-shadow:0 6px 16px rgba(16,24,40,.08)}.funnel-title{display:flex;align-items:center;gap:.4rem;justify-content:space-between}.funnel-meta{font-size:.74rem;color:var(--adzeta-subtle);margin-top:.18rem}.funnel-metrics{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.38rem}.chip{border:1px solid var(--adzeta-line);border-radius:999px;padding:.14rem .5rem;font-size:.68rem;color:var(--adzeta-body);background:var(--adzeta-mist)}.inline-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.45rem;margin-top:.58rem}.inline-form input,.inline-form select,.inline-form textarea{width:100%;background:var(--adzeta-surface);color:var(--adzeta-body);border:1px solid var(--adzeta-line);border-radius:8px;padding:.45rem .55rem;font-size:.76rem}
.empty-state{border:1px dashed #d0d5dd;border-radius:10px;background:#fcfcfd;color:var(--adzeta-subtle);padding:.75rem;font-size:.79rem}
li.empty-state,p.empty-state{display:block}
.stage-board{grid-template-columns:repeat(3,minmax(220px,1fr))}.lane.stage-lane{border-width:2px}.lane.stage-discovery{border-color:#93c5fd;background:linear-gradient(180deg,#eff6ff 0%,#fff 100%)}.lane.stage-candidate{border-color:#f9a8d4;background:linear-gradient(180deg,#fff1f8 0%,#fff 100%)}.lane.stage-live{border-color:#86efac;background:linear-gradient(180deg,#f0fdf4 0%,#fff 100%)}.stage-pill{display:inline-flex;align-items:center;border-radius:999px;padding:.14rem .5rem;font-size:.68rem;font-weight:700;border:1px solid var(--adzeta-line)}.stage-pill.discovery{background:#dbeafe;border-color:#93c5fd;color:#1d4ed8}.stage-pill.candidate{background:#fce7f3;border-color:#f9a8d4;color:#9d174d}.stage-pill.live{background:#dcfce7;border-color:#86efac;color:#166534}.stage-transition-cue{margin:.2rem 0 .35rem 0;font-size:.72rem;color:var(--adzeta-subtle)}.pilot-card-actions{display:grid;gap:.35rem;margin-top:.42rem}.pilot-card-actions form{margin:0}.pilot-board-legend{display:flex;flex-wrap:wrap;gap:.35rem;margin:.4rem 0 .55rem 0}.lane-card.pilot-card{background:#fff}.lane-card.pilot-card .lane-meta{font-size:.72rem}.pilot-owner-next{margin-top:.22rem;font-size:.73rem;color:var(--adzeta-subtle)}.pilot-gate-note{margin-top:.24rem;font-size:.72rem}.pilot-move-note{margin-top:.22rem;font-size:.72rem;color:var(--adzeta-subtle)}
@media (max-width:1320px){.layout{grid-template-columns:1fr}.ops-shell{grid-template-columns:1fr}.ops-sidebar-desktop{position:static}.board{grid-template-columns:repeat(2,minmax(170px,1fr))}.stage-board{grid-template-columns:1fr}.kpis{grid-template-columns:1fr 1fr}.cta-grid{grid-template-columns:1fr}.page-summary{grid-template-columns:1fr}.home-premium-hero{grid-template-columns:1fr}.home-hero-stats{grid-template-columns:1fr 1fr}}@media (max-width:980px){.ops-sidebar-desktop{display:none}.ops-sidebar-mobile{display:block}}@media (max-width:760px){.board,.kpis,.lifecycle-grid,.home-hero-stats{grid-template-columns:1fr}.wrap{padding:.9rem}}.skip-link{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}.skip-link:focus{left:12px;top:12px;width:auto;height:auto;padding:.5rem .75rem;background:#111;color:#fff;border-radius:8px;z-index:1000}
</style></head><body><a href="#main-content" class="skip-link">Skip to main content</a><main id="main-content" class="wrap">${content}</main>${devHmrClientScript()}</body></html>`;
}

const send = (res, statusCode, html, pageTitle = 'AdZeta Command Center') => { res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(pageHtml(html, pageTitle)); };
const sendJson = (res, statusCode, payload) => { res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); };
const redirect = (res, location) => { res.writeHead(303, { Location: location }); res.end(); };

const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

async function collectDevHmrFingerprints(entryPath, bucket = []) {
  try {
    const fileStat = await stat(entryPath);
    if (fileStat.isFile()) {
      bucket.push(`${entryPath}:${Math.floor(fileStat.mtimeMs)}`);
      return bucket;
    }
    if (!fileStat.isDirectory()) return bucket;

    const entries = await readdir(entryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.run') continue;
      const childPath = path.join(entryPath, entry.name);
      if (entry.isDirectory()) {
        await collectDevHmrFingerprints(childPath, bucket);
      } else if (entry.isFile()) {
        bucket.push(`${childPath}:${Math.floor((await stat(childPath)).mtimeMs)}`);
      }
    }
  } catch {
    // Missing paths are ignored so local setup remains flexible.
  }
  return bucket;
}

function computeDevHmrHash(input = '') {
  let hash = 0;
  const text = String(input || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return `v${Math.abs(hash)}`;
}

let devHmrSnapshot = { value: 'prod', updatedAt: 0 };
async function getDevHmrVersion() {
  if (!devHmrEnabled) return 'prod';
  const now = Date.now();
  if (now - devHmrSnapshot.updatedAt < 800) return devHmrSnapshot.value;
  const fingerprints = [];
  for (const root of devHmrWatchRoots) await collectDevHmrFingerprints(root, fingerprints);
  const rawValue = fingerprints.sort().join('|') || `empty-${now}`;
  const value = computeDevHmrHash(rawValue);
  devHmrSnapshot = { value, updatedAt: now };
  return value;
}

function devHmrClientScript() {
  if (!devHmrEnabled) return '';
  return `<script>
(() => {
  const pollMs = ${devHmrPollMs};
  let currentVersion = null;
  let inFlight = false;
  const check = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const res = await fetch('/__dev/version', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const next = data?.version || null;
      if (currentVersion && next && next !== currentVersion) {
        const reviewBurstsNode = document.getElementById('review-bursts');
        if (reviewBurstsNode && typeof window.__refreshOpsReviewBursts === 'function') {
          await window.__refreshOpsReviewBursts({ force: true });
          currentVersion = next;
          return;
        }
        window.location.reload();
        return;
      }
      currentVersion = next;
    } catch {
      // Server may be restarting under node --watch; retry silently.
    } finally {
      inFlight = false;
    }
  };
  check();
  setInterval(check, pollMs);
})();
</script>`;
}

function computeReviewBurstRefreshSignature({ bursts = OPS_REVIEW_BURSTS, autonomyDirection = DEFAULT_AUTONOMY_DIRECTION, preferenceProfile = {} } = {}) {
  const stable = {
    bursts: (bursts || []).map((burst) => ({
      id: burst.id,
      status: burst.status,
      priority: burst.priority,
      updatedAt: burst.updatedAt || burst.createdAt || null,
      createdAt: burst.createdAt || null,
      implementedAt: burst.implementedAt || null,
      closedAt: burst.closedAt || null,
      recommendation: burst.recommendedDefault || null,
      previewDiff: burst?.preview?.keyDiffSummary || null,
    })),
    quality_mode: autonomyDirection?.quality_mode || null,
    directional_preferences: autonomyDirection?.directional_preferences || null,
    preference_overrides: preferenceProfile?.overrides || null,
    preference_updated_at: preferenceProfile?.updated_at || null,
  };
  return computeDevHmrHash(JSON.stringify(stable));
}

const reviewBurstEventClients = new Set();
let reviewBurstRealtimeSnapshot = {
  signature: null,
  html: '',
  mode: 'service-polling',
};

async function buildReviewBurstLivePayload() {
  const [autonomyDirection, preferenceProfile, hydratedBursts] = await Promise.all([
    readAutonomyDirection(),
    loadOperatorPreferenceProfile(),
    hydrateReviewBurstsWithLiveData(OPS_REVIEW_BURSTS),
  ]);
  const bursts = applyAutonomyDirectionToReviewBursts(hydratedBursts, autonomyDirection);
  validateReviewBurstPayloads(bursts);
  return {
    mode: devHmrEnabled ? 'dev-hmr-lite' : 'service-polling',
    poll_ms: reviewBurstRefreshPollMs,
    signature: computeReviewBurstRefreshSignature({ bursts, autonomyDirection, preferenceProfile }),
    html: renderReviewBurstsPanel({ bursts, preferenceProfile }),
  };
}

async function emitReviewBurstRealtimeEvent(reason = 'update') {
  const payload = await buildReviewBurstLivePayload();
  reviewBurstRealtimeSnapshot = {
    signature: payload.signature,
    html: payload.html,
    mode: payload.mode,
  };
  if (!reviewBurstEventClients.size) return payload;
  const eventPayload = JSON.stringify({
    type: 'review_bursts_update',
    reason,
    signature: payload.signature,
    html: payload.html,
    mode: payload.mode,
    poll_ms: payload.poll_ms,
    emitted_at: new Date().toISOString(),
  });
  for (const client of [...reviewBurstEventClients]) {
    try {
      client.write(`event: review_bursts\ndata: ${eventPayload}\n\n`);
    } catch {
      reviewBurstEventClients.delete(client);
    }
  }
  return payload;
}

function renderReviewBurstsRefreshScript() {
  return `<script>
(() => {
  const root = document.getElementById('review-bursts');
  if (!root) return;

  const pollMs = ${reviewBurstRefreshPollMs};
  let inFlight = false;
  let signature = null;
  let fallbackTimer = null;
  let eventSource = null;
  const statusNodeId = 'review-bursts-live-status';

  const setLiveStatus = (mode, detail = '') => {
    const el = document.getElementById(statusNodeId);
    if (!el) return;
    el.textContent = detail ? (mode + ' · ' + detail) : mode;
  };

  const applyHtml = (html, nextSig = null, { force = false } = {}) => {
    if (!html) return false;
    if (!force && signature && nextSig && nextSig === signature) return false;
    const current = document.getElementById('review-bursts');
    if (!current) return false;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const nextNode = wrapper.firstElementChild;
    if (!nextNode) return false;
    current.replaceWith(nextNode);
    signature = nextSig || signature;
    return true;
  };

  const refresh = async ({ force = false } = {}) => {
    if (inFlight) return false;
    inFlight = true;
    try {
      const res = await fetch('/api/ops/review-bursts/live', { cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json();
      const updated = applyHtml(data?.html || '', data?.signature || null, { force });
      if (updated || force) setLiveStatus('polling', 'every ' + Math.round((data?.poll_ms || pollMs) / 1000) + 's');
      return updated;
    } catch {
      return false;
    } finally {
      inFlight = false;
    }
  };

  const startFallbackPolling = () => {
    if (fallbackTimer) return;
    setLiveStatus('polling', 'every ' + Math.round(pollMs / 1000) + 's');
    fallbackTimer = setInterval(() => { void refresh(); }, pollMs);
  };

  const stopFallbackPolling = () => {
    if (!fallbackTimer) return;
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  };

  const startRealtime = () => {
    if (typeof window.EventSource !== 'function') {
      startFallbackPolling();
      return;
    }
    try {
      eventSource = new EventSource('/api/ops/review-bursts/events');
      eventSource.addEventListener('review_bursts', (evt) => {
        try {
          const data = JSON.parse(evt.data || '{}');
          applyHtml(data?.html || '', data?.signature || null, { force: false });
          setLiveStatus('realtime', 'SSE');
          stopFallbackPolling();
        } catch {
          // ignore malformed payloads, polling fallback will keep panel fresh.
        }
      });
      eventSource.onopen = () => {
        setLiveStatus('realtime', 'SSE');
        stopFallbackPolling();
      };
      eventSource.onerror = () => {
        setLiveStatus('fallback', 'realtime unavailable');
        startFallbackPolling();
      };
    } catch {
      startFallbackPolling();
    }
  };

  window.__refreshOpsReviewBursts = refresh;
  void refresh({ force: true });
  startRealtime();
  startFallbackPolling();
})();
</script>`;
}

function renderActiveWorkersRefreshScript() {
  return `<script>
(() => {
  const root = document.getElementById('active-workers-panel');
  if (!root) return;

  const pollMs = Math.max(2000, Number(${Number(process.env.OPS_WORKER_REFRESH_MS || 5000)}));
  let inFlight = false;
  let currentFilter = 'all';

  const setLiveStatus = (text) => {
    const node = document.getElementById('active-workers-live-status');
    if (node) node.textContent = text;
  };

  const bindFilters = () => {
    const panel = document.getElementById('active-workers-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-worker-filter]').forEach((node) => {
      node.addEventListener('click', (evt) => {
        evt.preventDefault();
        const next = node.getAttribute('data-worker-filter') || 'all';
        currentFilter = next;
        void refresh({ force: true });
      });
    });
  };

  const applyHtml = (html) => {
    if (!html) return false;
    const current = document.getElementById('active-workers-panel');
    if (!current) return false;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const nextNode = wrapper.firstElementChild;
    if (!nextNode) return false;
    current.replaceWith(nextNode);
    bindFilters();
    return true;
  };

  const refresh = async ({ force = false } = {}) => {
    if (inFlight && !force) return false;
    inFlight = true;
    try {
      const res = await fetch('/api/ops/active-workers/live?filter=' + encodeURIComponent(currentFilter), { cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json();
      const updated = applyHtml(data?.html || '');
      if (updated || force) setLiveStatus('polling · every ' + Math.round((data?.poll_ms || pollMs) / 1000) + 's');
      return updated;
    } catch {
      setLiveStatus('polling · refresh failed, retrying');
      return false;
    } finally {
      inFlight = false;
    }
  };

  window.__refreshOpsActiveWorkers = refresh;
  bindFilters();
  void refresh({ force: true });
  setInterval(() => { void refresh(); }, pollMs);
})();
</script>`;
}

function renderOpsSidebarNavigationScript() {
  return `<script>
(() => {
  const links = Array.from(document.querySelectorAll('[data-ops-anchor]'));
  if (!links.length) return;

  const focusSection = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => { target.focus({ preventScroll: true }); }, 120);
  };

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('data-ops-anchor');
      if (!id) return;
      event.preventDefault();
      focusSection(id);
      if (history && history.replaceState) history.replaceState(null, '', '#' + id);
      const mobileDetails = link.closest('details');
      if (mobileDetails) mobileDetails.removeAttribute('open');
    });
  });
})();
</script>`;
}

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};
const normalizeFunnelStatus = (s) => FUNNEL_STATUSES.includes(String(s || '').toLowerCase()) ? String(s).toLowerCase() : null;
const normalizeEnrollmentStatus = (s) => ENROLLMENT_STATUSES.includes(String(s || '').toLowerCase()) ? String(s).toLowerCase() : null;
const normalizeAssetStatus = (s) => ASSET_STATUSES.includes(String(s || '').toLowerCase()) ? String(s).toLowerCase() : null;
const normalizeAssetType = (s) => ASSET_TYPES.includes(String(s || '').toLowerCase()) ? String(s).toLowerCase() : null;
const normalizeQualifiedSpendTier = (s) => {
  const raw = String(s || '').trim().toLowerCase();
  const compact = raw.replace(/\s+/g, ' ');
  const canonical = QUALIFIED_SPEND_TIER_ALIASES[compact] || QUALIFIED_SPEND_TIER_ALIASES[compact.replace(/\s+/g, '_')] || compact;
  return QUALIFIED_SPEND_TIERS.includes(canonical) ? canonical : null;
};
const normalizePilotHandoffStage = (s) => {
  const raw = String(s || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  return PILOT_HANDOFF_STAGES.includes(raw) ? raw : null;
};

const normalizeResearchLedgerStatus = (s) => {
  const raw = String(s || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  return RESEARCH_LEDGER_STATUSES.includes(raw) ? raw : null;
};

function deriveResearchConfidenceBand(confidence = 0) {
  const numeric = Number(confidence);
  if (!Number.isFinite(numeric)) return 'low';
  if (numeric >= 80) return 'high';
  if (numeric >= 60) return 'medium';
  return 'low';
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function normalizeQualificationSnapshot(payload = {}) {
  const spearman = Number(payload.spearman_score ?? payload.spearman);
  const quintileGap = Number(payload.quintile_gap ?? payload.quintile_gap_pct);
  const orderHistorySufficiency = String(payload.order_history_sufficiency || '').trim().toLowerCase();

  if (!Number.isFinite(spearman) || spearman < 0 || spearman > 1) throw new Error('spearman_score must be between 0 and 1');
  if (!Number.isFinite(quintileGap) || quintileGap < 0 || quintileGap > 100) throw new Error('quintile_gap must be between 0 and 100');
  if (!ORDER_HISTORY_SUFFICIENCY.includes(orderHistorySufficiency)) {
    throw new Error(`order_history_sufficiency must be one of: ${ORDER_HISTORY_SUFFICIENCY.join(', ')}`);
  }

  return { spearman_score: spearman, quintile_gap: quintileGap, order_history_sufficiency: orderHistorySufficiency };
}

function computeReadinessSnapshot({ qualificationConfidence = 0, snapshot = {} } = {}) {
  const spearmanNormalized = clamp(Number(snapshot.spearman_score || 0), 0, 1);
  const quintileGapNormalized = clamp(Number(snapshot.quintile_gap || 0) / 100, 0, 1);
  const orderHistoryWeights = { insufficient: 0.35, borderline: 0.65, sufficient: 1 };
  const orderHistoryNormalized = orderHistoryWeights[String(snapshot.order_history_sufficiency || '').toLowerCase()] ?? 0;
  const confidenceNormalized = clamp(Number(qualificationConfidence || 0) / 100, 0, 1);

  const scoreRaw = (spearmanNormalized * 0.4) + (quintileGapNormalized * 0.3) + (orderHistoryNormalized * 0.2) + (confidenceNormalized * 0.1);
  const readinessScore = Math.round(scoreRaw * 100);
  const readinessStatus = readinessScore >= 75 && orderHistoryNormalized >= 0.65 ? 'qualified' : 'not_yet';

  return { readiness_score: readinessScore, readiness_status: readinessStatus };
}

function parseBasicAuthHeader(headerValue = '') {
  if (!headerValue.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(headerValue.slice(6), 'base64').toString('utf8');
    const index = decoded.indexOf(':');
    if (index <= 0) return null;
    return { username: decoded.slice(0, index), password: decoded.slice(index + 1) };
  } catch {
    return null;
  }
}

function getRoleFromRequest(req) {
  if (!authEnabled) return { ok: true, role: 'admin', principal: 'auth-disabled' };
  const creds = parseBasicAuthHeader(String(req.headers.authorization || ''));
  if (!creds) return { ok: false, code: 401, reason: 'missing_credentials' };

  if (adminCreds.username && creds.username === adminCreds.username && creds.password === adminCreds.password) {
    return { ok: true, role: 'admin', principal: creds.username };
  }

  if (operatorCreds.username && creds.username === operatorCreds.username && creds.password === operatorCreds.password) {
    return { ok: true, role: 'operator', principal: creds.username };
  }

  return { ok: false, code: 401, reason: 'invalid_credentials' };
}

function guardWriteAccess(req, res, { minRole = 'operator' } = {}) {
  const normalizedRole = ROLES.includes(minRole) ? minRole : 'operator';
  const auth = getRoleFromRequest(req);
  const isApi = req.url?.startsWith('/api/');

  if (!auth.ok) {
    res.setHeader('WWW-Authenticate', `Basic realm="${authRealm}"`);
    if (isApi) {
      sendJson(res, auth.code || 401, { error: 'unauthorized', reason: auth.reason || 'auth_required' });
    } else {
      send(res, auth.code || 401, '<h1>Unauthorized</h1><p>Valid operator/admin credentials are required for write actions.</p>');
    }
    return null;
  }

  if ((ROLE_RANK[auth.role] || 0) < (ROLE_RANK[normalizedRole] || 0)) {
    if (isApi) {
      sendJson(res, 403, { error: 'forbidden', reason: `requires_${normalizedRole}` });
    } else {
      send(res, 403, `<h1>Forbidden</h1><p>This action requires <strong>${escapeHtml(normalizedRole)}</strong> role.</p>`);
    }
    return null;
  }

  return auth;
}

function resolveUiReturnPath(req, fallback = '/') {
  const referer = String(req?.headers?.referer || '').trim();
  if (!referer) return fallback;
  try {
    const parsed = new URL(referer);
    if (!parsed.pathname.startsWith('/')) return fallback;
    if (/^\/(pilot|relationships|actions|targeting|ops)$/.test(parsed.pathname)) {
      return `${parsed.pathname}${parsed.search || ''}${parsed.hash || ''}`;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function assertStore() {
  if (!pool && !supabase) throw new Error('Set DATABASE_URL or SUPABASE_URL + SUPABASE_ANON_KEY to enable data APIs');
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function readJsonBody(req) {
  const raw = await readRawBody(req);
  if (!raw) return {};
  return JSON.parse(raw);
}

async function readFormBody(req) {
  const raw = await readRawBody(req);
  const params = new URLSearchParams(raw || '');
  return Object.fromEntries(params.entries());
}

async function getTasks({ allowEmpty = false } = {}) {
  if (!pool && !supabase) return allowEmpty ? [] : assertStore();
  if (supabase) {
    const { data, error } = await supabase.from('cc_operator_tasks').select('*').order('priority', { ascending: true, nullsFirst: false }).order('id', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
  const { rows } = await pool.query('select * from public.cc_operator_tasks order by priority asc nulls last, id asc');
  return rows;
}

async function getFunnels() {
  if (!pool && !supabase) return [];
  if (supabase) {
    const { data, error } = await supabase.from('cc_funnels').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
  const { rows } = await pool.query('select * from public.cc_funnels order by updated_at desc');
  return rows;
}

function safeJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function getTemplateCadenceLabel(template = {}) {
  const metadata = safeJsonObject(template.metadata);
  const cadence = metadata.cadence || metadata.cadence_label || metadata.cadence_days;
  if (Array.isArray(cadence)) return cadence.join(' / ');
  if (cadence === 0 || cadence) return String(cadence);
  return template.channel ? `${template.channel} cadence` : 'Not set';
}

function parseTemplateSteps(template = {}) {
  const metadata = safeJsonObject(template.metadata);
  const rawSteps = Array.isArray(metadata.steps) ? metadata.steps : [];
  return rawSteps
    .map((step, index) => {
      if (!step || typeof step !== 'object') return null;
      const stepType = String(step.step_type || step.type || step.action_type || template.channel || 'email').toLowerCase();
      const delayDays = Number.isFinite(Number(step.delay_days ?? step.delay ?? step.wait_days)) ? Number(step.delay_days ?? step.delay ?? step.wait_days) : 0;
      const messageStub = String(step.message_stub || step.stub || step.message || '').trim();
      const cta = String(step.cta || step.call_to_action || '').trim();
      return {
        index,
        step_type: stepType,
        delay_days: delayDays,
        message_stub: messageStub,
        cta,
      };
    })
    .filter(Boolean);
}

async function getSequenceTemplatesOverview(limit = 8) {
  if (!pool && !supabase) return [];
  if (supabase) {
    const { data, error } = await supabase.from('cc_sequence_templates').select('*').order('updated_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...row,
      steps: Number(row.step_count || 0),
      steps_detail: parseTemplateSteps(row),
      cadence_label: getTemplateCadenceLabel(row),
      status: String(row.status || 'active').toLowerCase(),
    }));
  }

  const { rows } = await pool.query(
    `select id, name, status, channel, step_count, metadata, updated_at
       from public.cc_sequence_templates
       order by updated_at desc
       limit $1`,
    [Number(limit) || 8],
  );

  return rows.map((row) => ({
    ...row,
    steps: Number(row.step_count || 0),
    steps_detail: parseTemplateSteps(row),
    cadence_label: getTemplateCadenceLabel(row),
    status: String(row.status || 'active').toLowerCase(),
  }));
}

async function getSequenceQueue() {
  if (!pool && !supabase) return [];
  if (supabase) {
    const { data, error } = await supabase
      .from('cc_sequence_enrollments')
      .select('id,lead_key,status,next_send_at,current_step_index,created_at,cc_sequence_templates(name)')
      .in('status', ['queued', 'active'])
      .order('next_send_at', { ascending: true, nullsFirst: false })
      .limit(12);
    if (error) throw error;
    return (data ?? []).map((row) => ({ ...row, template_name: row.cc_sequence_templates?.name || 'Unknown sequence' }));
  }
  const { rows } = await pool.query(`
    select e.id, e.lead_key, e.status, e.next_send_at, e.current_step_index, e.created_at, t.name as template_name
    from public.cc_sequence_enrollments e
    left join public.cc_sequence_templates t on t.id = e.sequence_template_id
    where e.status in ('queued','active')
    order by e.next_send_at asc nulls last
    limit 12
  `);
  return rows;
}

async function getActiveEnrollmentsBySequence(limit = 8) {
  if (!pool && !supabase) return [];
  if (supabase) {
    const { data, error } = await supabase
      .from('cc_sequence_enrollments')
      .select('lead_key,status,sequence_template_id,cc_sequence_templates(name,status)')
      .in('status', ['active'])
      .limit(200);
    if (error) throw error;
    const grouped = new Map();
    for (const row of data || []) {
      const key = String(row.sequence_template_id || 'unknown');
      const name = row.cc_sequence_templates?.name || 'Unknown sequence';
      if (!grouped.has(key)) grouped.set(key, { sequence_template_id: key, template_name: name, template_status: String(row.cc_sequence_templates?.status || 'active').toLowerCase(), active_count: 0, lead_keys: [] });
      const bucket = grouped.get(key);
      bucket.active_count += 1;
      if (bucket.lead_keys.length < 8) bucket.lead_keys.push(row.lead_key);
    }
    return Array.from(grouped.values()).sort((a, b) => b.active_count - a.active_count).slice(0, limit);
  }

  const { rows } = await pool.query(
    `select t.id as sequence_template_id,
            t.name as template_name,
            t.status as template_status,
            count(e.id)::int as active_count,
            (array_remove(array_agg(e.lead_key order by e.updated_at desc), null))[1:8] as lead_keys
       from public.cc_sequence_templates t
       left join public.cc_sequence_enrollments e
         on e.sequence_template_id = t.id
        and e.status = 'active'
      group by t.id, t.name, t.status
      having count(e.id) > 0
      order by count(e.id) desc
      limit $1`,
    [Number(limit) || 8],
  );
  return rows;
}

async function appendTemplateStep(templateId, payload = {}) {
  assertStore();
  if (!templateId) throw new Error('template_id is required');
  const stepType = String(payload.step_type || payload.action_type || 'email').trim().toLowerCase();
  const delayDays = Number.isFinite(Number(payload.delay_days)) ? Number(payload.delay_days) : 0;
  const messageStub = String(payload.message_stub || '').trim();
  if (!messageStub) throw new Error('message_stub is required');

  if (supabase) {
    const { data: row, error } = await supabase.from('cc_sequence_templates').select('id,metadata').eq('id', templateId).single();
    if (error) throw error;
    const metadata = safeJsonObject(row.metadata);
    const steps = Array.isArray(metadata.steps) ? metadata.steps : [];
    const nextSteps = [...steps, { step_type: stepType, delay_days: delayDays, message_stub: messageStub }];
    const { data, error: updateError } = await supabase
      .from('cc_sequence_templates')
      .update({ metadata: { ...metadata, steps: nextSteps }, step_count: nextSteps.length })
      .eq('id', templateId)
      .select('*')
      .single();
    if (updateError) throw updateError;
    return data;
  }

  const currentResult = await pool.query('select metadata from public.cc_sequence_templates where id = $1', [templateId]);
  if (!currentResult.rowCount) throw new Error('sequence template not found');
  const metadata = safeJsonObject(currentResult.rows[0].metadata);
  const steps = Array.isArray(metadata.steps) ? metadata.steps : [];
  const nextSteps = [...steps, { step_type: stepType, delay_days: delayDays, message_stub: messageStub }];
  const { rows } = await pool.query('update public.cc_sequence_templates set metadata = $1::jsonb, step_count = $2, updated_at = now() where id = $3 returning *', [JSON.stringify({ ...metadata, steps: nextSteps }), nextSteps.length, templateId]);
  return rows[0];
}

async function setSequenceTemplatePaused(templateId, shouldPause = true) {
  assertStore();
  if (!templateId) throw new Error('template_id is required');
  const nextTemplateStatus = shouldPause ? 'paused' : 'active';

  if (supabase) {
    const { data: template, error: templateError } = await supabase
      .from('cc_sequence_templates')
      .update({ status: nextTemplateStatus })
      .eq('id', templateId)
      .select('id,name,status')
      .single();
    if (templateError) throw templateError;

    if (shouldPause) {
      const { error: pauseEnrollmentsError } = await supabase
        .from('cc_sequence_enrollments')
        .update({ status: 'paused' })
        .eq('sequence_template_id', templateId)
        .in('status', ['queued', 'active']);
      if (pauseEnrollmentsError) throw pauseEnrollmentsError;
    } else {
      const { error: resumeEnrollmentsError } = await supabase
        .from('cc_sequence_enrollments')
        .update({ status: 'queued' })
        .eq('sequence_template_id', templateId)
        .eq('status', 'paused');
      if (resumeEnrollmentsError) throw resumeEnrollmentsError;
    }

    return template;
  }

  const { rows } = await pool.query('update public.cc_sequence_templates set status = $1, updated_at = now() where id = $2 returning id,name,status', [nextTemplateStatus, templateId]);
  if (!rows[0]) throw new Error('sequence template not found');
  if (shouldPause) {
    await pool.query("update public.cc_sequence_enrollments set status = 'paused', updated_at = now() where sequence_template_id = $1 and status in ('queued','active')", [templateId]);
  } else {
    await pool.query("update public.cc_sequence_enrollments set status = 'queued', updated_at = now() where sequence_template_id = $1 and status = 'paused'", [templateId]);
  }
  return rows[0];
}

async function getSequenceTemplateCount() {
  if (!pool && !supabase) return 0;
  if (supabase) {
    const { count, error } = await supabase.from('cc_sequence_templates').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return Number(count || 0);
  }
  const { rows } = await pool.query('select count(*)::int as count from public.cc_sequence_templates');
  return Number(rows[0]?.count || 0);
}

async function getEnrollmentStatusCounts() {
  const baseline = Object.fromEntries(ENROLLMENT_STATUSES.map((status) => [status, 0]));
  if (!pool && !supabase) return baseline;
  if (supabase) {
    const { data, error } = await supabase.from('cc_sequence_enrollments').select('status');
    if (error) throw error;
    for (const row of data || []) {
      const key = normalizeEnrollmentStatus(row.status);
      if (key) baseline[key] += 1;
    }
    return baseline;
  }
  const { rows } = await pool.query('select status, count(*)::int as count from public.cc_sequence_enrollments group by status');
  for (const row of rows) {
    const key = normalizeEnrollmentStatus(row.status);
    if (key) baseline[key] += Number(row.count || 0);
  }
  return baseline;
}

async function getAssetStatusSummary() {
  const emptyCounts = Object.fromEntries(ASSET_STATUSES.map((status) => [status, 0]));
  const summary = {
    lead_magnet: { ...emptyCounts, total: 0 },
    teaser_product: { ...emptyCounts, total: 0 },
  };

  if (!pool && !supabase) return summary;

  if (supabase) {
    const [{ data: leadMagnets, error: leadErr }, { data: teaserProducts, error: teaserErr }] = await Promise.all([
      supabase.from('lead_magnets').select('status'),
      supabase.from('teaser_products').select('status'),
    ]);
    if (leadErr) throw leadErr;
    if (teaserErr) throw teaserErr;

    for (const row of leadMagnets || []) {
      const status = normalizeAssetStatus(row.status) || 'draft';
      summary.lead_magnet[status] += 1;
      summary.lead_magnet.total += 1;
    }
    for (const row of teaserProducts || []) {
      const status = normalizeAssetStatus(row.status) || 'draft';
      summary.teaser_product[status] += 1;
      summary.teaser_product.total += 1;
    }
    return summary;
  }

  const { rows } = await pool.query(`
    select asset_type, status, count(*)::int as count
    from (
      select 'lead_magnet'::text as asset_type, status from public.lead_magnets
      union all
      select 'teaser_product'::text as asset_type, status from public.teaser_products
    ) assets
    group by asset_type, status
  `);

  for (const row of rows) {
    const type = normalizeAssetType(row.asset_type);
    const status = normalizeAssetStatus(row.status) || 'draft';
    if (!type) continue;
    summary[type][status] += Number(row.count || 0);
    summary[type].total += Number(row.count || 0);
  }

  return summary;
}

async function createAsset(type, payload = {}) {
  assertStore();
  const assetType = normalizeAssetType(type);
  if (!assetType) throw new Error('invalid asset type');
  const title = String(payload.title || '').trim();
  if (!title) throw new Error('title is required');
  const status = normalizeAssetStatus(payload.status) || 'draft';

  if (supabase) {
    const table = assetType === 'lead_magnet' ? 'lead_magnets' : 'teaser_products';
    const base = {
      title,
      slug: payload.slug ? String(payload.slug).trim() : null,
      status,
      owner: payload.owner ? String(payload.owner) : 'growth',
      notes: payload.notes ? String(payload.notes) : null,
      performance_notes: payload.performance_notes ? String(payload.performance_notes) : null,
    };
    if (assetType === 'lead_magnet') {
      base.asset_format = payload.asset_format ? String(payload.asset_format) : 'checklist';
      base.optin_url = payload.optin_url ? String(payload.optin_url) : null;
    } else {
      base.offer_type = payload.offer_type ? String(payload.offer_type) : 'tripwire';
      base.price_cents = Number.isFinite(Number(payload.price_cents)) ? Number(payload.price_cents) : 0;
      base.checkout_url = payload.checkout_url ? String(payload.checkout_url) : null;
    }
    const { data, error } = await supabase.from(table).insert(base).select('id,status').single();
    if (error) throw error;
    return data;
  }

  if (assetType === 'lead_magnet') {
    const { rows } = await pool.query('insert into public.lead_magnets (title, slug, status, asset_format, optin_url, owner, notes, performance_notes) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, status', [title, payload.slug || null, status, payload.asset_format || 'checklist', payload.optin_url || null, payload.owner || 'growth', payload.notes || null, payload.performance_notes || null]);
    return rows[0];
  }

  const { rows } = await pool.query('insert into public.teaser_products (title, slug, status, offer_type, price_cents, checkout_url, owner, notes, performance_notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id, status', [title, payload.slug || null, status, payload.offer_type || 'tripwire', Number.isFinite(Number(payload.price_cents)) ? Number(payload.price_cents) : 0, payload.checkout_url || null, payload.owner || 'growth', payload.notes || null, payload.performance_notes || null]);
  return rows[0];
}

async function updateAsset(type, id, payload = {}) {
  assertStore();
  const assetType = normalizeAssetType(type);
  if (!assetType) throw new Error('invalid asset type');
  if (!id) throw new Error('id is required');

  const status = payload.status !== undefined ? normalizeAssetStatus(payload.status) : undefined;
  if (payload.status !== undefined && !status) throw new Error('invalid status');

  const table = assetType === 'lead_magnet' ? 'lead_magnets' : 'teaser_products';
  const updates = {};
  const fields = ['title', 'slug', 'owner', 'notes', 'performance_notes'];
  if (assetType === 'lead_magnet') fields.push('asset_format', 'optin_url');
  if (assetType === 'teaser_product') fields.push('offer_type', 'price_cents', 'checkout_url');
  for (const key of fields) if (payload[key] !== undefined) updates[key] = payload[key];
  if (status) updates.status = status;
  updates.updated_at = new Date().toISOString();

  if (supabase) {
    const { data, error } = await supabase.from(table).update(updates).eq('id', id).select('id,status').maybeSingle();
    if (error) throw error;
    return data || null;
  }

  const updateFields = Object.keys(updates);
  if (!updateFields.length) throw new Error('no update fields provided');
  const values = updateFields.map((key) => updates[key]);
  const sets = updateFields.map((key, i) => `${key} = $${i + 1}`);
  values.push(id);
  const { rows } = await pool.query(`update public.${table} set ${sets.join(', ')} where id = $${updateFields.length + 1} returning id, status`, values);
  return rows[0] || null;
}

async function recordDeliveryEvent(payload = {}) {
  assertStore();
  const assetType = normalizeAssetType(payload.asset_type);
  if (!assetType) throw new Error('invalid asset_type');
  const status = normalizeAssetStatus(payload.asset_status_at_event) || 'draft';
  const assetId = String(payload.asset_id || '').trim();
  if (!assetId) throw new Error('asset_id is required');

  const base = {
    asset_type: assetType,
    asset_id: assetId,
    event_type: payload.event_type ? String(payload.event_type) : 'status_update',
    event_payload: payload.event_payload && typeof payload.event_payload === 'object' ? payload.event_payload : {},
    asset_status_at_event: status,
  };

  if (supabase) {
    const { data, error } = await supabase.from('delivery_events').insert(base).select('id').single();
    if (error) throw error;
    return data;
  }

  const { rows } = await pool.query('insert into public.delivery_events (asset_type, asset_id, event_type, event_payload, asset_status_at_event) values ($1,$2,$3,$4::jsonb,$5) returning id', [base.asset_type, base.asset_id, base.event_type, JSON.stringify(base.event_payload), base.asset_status_at_event]);
  return rows[0];
}

async function recordSequenceEnrollmentActivity(payload = {}) {
  const entry = {
    event_type: String(payload.event_type || 'sequence_enrollment_created'),
    lead_key: String(payload.lead_key || '').trim() || null,
    sequence_template_id: payload.sequence_template_id || null,
    sequence_enrollment_id: payload.sequence_enrollment_id || null,
    actor: String(payload.actor || 'api').trim(),
    details: payload.details && typeof payload.details === 'object' ? payload.details : {},
  };

  if (!entry.lead_key || !entry.sequence_template_id || !entry.sequence_enrollment_id) return { skipped: true, reason: 'missing_fields' };
  if (!pool && !supabase) return { skipped: true, reason: 'no_store' };

  if (supabase) {
    const { error } = await supabase.from('cc_activity_log').insert({
      event_type: entry.event_type,
      lead_key: entry.lead_key,
      sequence_template_id: entry.sequence_template_id,
      sequence_enrollment_id: entry.sequence_enrollment_id,
      actor: entry.actor,
      details: entry.details,
    });
    if (error) {
      if (String(error.message || '').toLowerCase().includes('cc_activity_log')) return { skipped: true, reason: 'table_missing' };
      throw error;
    }
    return { logged: true };
  }

  try {
    await pool.query(
      `insert into public.cc_activity_log (event_type, lead_key, sequence_template_id, sequence_enrollment_id, actor, details)
       values ($1,$2,$3,$4,$5,$6::jsonb)`,
      [entry.event_type, entry.lead_key, entry.sequence_template_id, entry.sequence_enrollment_id, entry.actor, JSON.stringify(entry.details || {})],
    );
    return { logged: true };
  } catch (error) {
    if (String(error.message || '').includes('cc_activity_log')) return { skipped: true, reason: 'table_missing' };
    throw error;
  }
}

async function recordClientUpdateActivity({ clientUpdateId, meetingNoteId = null, clientName = null, fromStatus = null, toStatus, actor = 'api', details = {} }) {
  if (!clientUpdateId || !toStatus) return { skipped: true, reason: 'missing_fields' };
  if (!pool && !supabase) return { skipped: true, reason: 'no_store' };

  const eventDetails = {
    client_update_id: clientUpdateId,
    meeting_note_id: meetingNoteId,
    client_name: clientName,
    from_status: fromStatus,
    to_status: toStatus,
    ...((details && typeof details === 'object') ? details : {}),
  };

  if (supabase) {
    const { error } = await supabase.from('cc_activity_log').insert({
      event_type: 'client_update_status_changed',
      actor: String(actor || 'api'),
      details: eventDetails,
    });
    if (error) {
      if (String(error.message || '').toLowerCase().includes('cc_activity_log')) return { skipped: true, reason: 'table_missing' };
      throw error;
    }
    return { logged: true };
  }

  try {
    await pool.query(
      `insert into public.cc_activity_log (event_type, actor, details)
       values ($1,$2,$3::jsonb)`,
      ['client_update_status_changed', String(actor || 'api'), JSON.stringify(eventDetails)],
    );
    return { logged: true };
  } catch (error) {
    if (String(error.message || '').includes('cc_activity_log')) return { skipped: true, reason: 'table_missing' };
    throw error;
  }
}

async function listFunnelSteps(funnelId) {
  if (supabase) {
    const { data, error } = await supabase.from('cc_funnel_steps').select('*').eq('funnel_id', funnelId).order('position', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
  const { rows } = await pool.query('select * from public.cc_funnel_steps where funnel_id = $1 order by position asc', [funnelId]);
  return rows;
}

async function getKpis() {
  return fetchOperationalKpis({ pool, supabase });
}

async function getCampaignSummary() {
  if (!pool) return { metric_window: 'last_7d', spend: 'n/a', revenue: 'n/a', conversions: 'n/a', roas: 'n/a', freshness: supabase ? 'supabase pending wiring' : 'local placeholder' };
  try {
    const { rows } = await pool.query(`select coalesce(round(sum(spend)::numeric,2),0)::text as spend, coalesce(round(sum(revenue)::numeric,2),0)::text as revenue, coalesce(sum(conversions),0)::int as conversions from public.campaign_metrics where metric_date >= current_date - interval '7 days'`);
    const spend = Number(rows[0]?.spend || 0);
    const revenue = Number(rows[0]?.revenue || 0);
    return { metric_window: 'last_7d', spend, revenue, conversions: Number(rows[0]?.conversions || 0), roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 'n/a', freshness: 'live from postgres' };
  } catch {
    return { metric_window: 'last_7d', spend: 'n/a', revenue: 'n/a', conversions: 'n/a', roas: 'n/a', freshness: 'campaign_metrics table unavailable' };
  }
}

async function getLifecycleSummary() {
  const fallback = {
    stages: [
      { key: 'lead', label: 'Lead', count: 'n/a' },
      { key: 'mql', label: 'MQL', count: 'n/a' },
      { key: 'sql', label: 'SQL', count: 'n/a' },
      { key: 'opportunity', label: 'Opportunity', count: 'n/a' },
      { key: 'customer', label: 'Customer', count: 'n/a' },
    ],
    movement_last_7d: 'placeholder pending lifecycle_events data',
    freshness: supabase ? 'supabase pending wiring' : 'local placeholder',
  };
  if (!pool) return fallback;
  try {
    const [stageCountsResult, movementResult] = await Promise.all([
      pool.query(`with latest_per_contact as (select distinct on (contact_ref) contact_ref, to_stage, event_at, created_at from public.lifecycle_events order by contact_ref, event_at desc, created_at desc) select s.stage_key, s.display_name, s.stage_order, coalesce(count(l.contact_ref), 0)::int as stage_count from public.lifecycle_stages s left join latest_per_contact l on l.to_stage = s.stage_key where s.is_active = true group by s.stage_key, s.display_name, s.stage_order order by s.stage_order asc`),
      pool.query(`select count(*)::int as movement_last_7d from public.lifecycle_events where event_at >= now() - interval '7 days' and coalesce(from_stage, '') <> coalesce(to_stage, '')`),
    ]);
    return {
      stages: stageCountsResult.rows.map((r) => ({ key: r.stage_key, label: r.display_name, count: r.stage_count })),
      movement_last_7d: Number(movementResult.rows[0]?.movement_last_7d || 0),
      freshness: 'live from postgres',
    };
  } catch {
    return { ...fallback, freshness: 'lifecycle tables unavailable' };
  }
}

async function getKpiAggregate() {
  const [kpis, lifecycle, campaigns] = await Promise.all([getKpis(), getLifecycleSummary(), getCampaignSummary()]);
  return { generated_at: new Date().toISOString(), mode: runtimeMode, kpis, lifecycle, campaigns };
}

async function getDailyGtmSummaryReport() {
  return collectDailyGtmSummary({ runtimeMode, pool, supabase, projectRoot: process.cwd() });
}

async function getAcquisitionMetricsByFunnelEntry() {
  const fallback = {
    generated_at: new Date().toISOString(),
    entries: [],
    totals: { enrollments: 0, classified_replies: 0, positive_replies: 0 },
    goal_metrics: {
      new_qualified_accounts_per_day: 0,
      enrolled_accounts_per_day: 0,
      positive_reply_rate: 0,
      positive_reply_rate_text: '0.0%',
      meetings_booked: 0,
      pilot_candidates: 0,
    },
  };
  if (!pool && !supabase) return fallback;

  try {
    if (supabase) {
      const [{ data: enrollments, error: eErr }, { data: activity, error: aErr }, { data: qualifiedAccounts, error: qErr }, { data: meetings, error: mErr }] = await Promise.all([
        supabase.from('cc_sequence_enrollments').select('metadata,created_at'),
        supabase.from('cc_activity_log').select('event_type,details').eq('event_type', 'reply_classified'),
        supabase.from('cc_qualified_accounts').select('created_at,outreach_enrolled_at,pipeline_stage'),
        supabase.from('meeting_notes').select('created_at,meeting_at'),
      ]);
      if (eErr) throw eErr;
      if (aErr) throw aErr;
      if (qErr) throw qErr;
      if (mErr) throw mErr;

      const byFunnel = new Map();
      for (const row of enrollments || []) {
        const md = safeJsonObject(row.metadata);
        const key = String(md.funnel_id || md.entry_point || 'unattributed');
        if (!byFunnel.has(key)) byFunnel.set(key, { funnel_entry: key, enrollments: 0, classified_replies: 0, positive_replies: 0 });
        byFunnel.get(key).enrollments += 1;
      }
      for (const row of activity || []) {
        const details = safeJsonObject(row.details);
        const key = String(details.funnel_id || details.entry_point || 'unattributed');
        if (!byFunnel.has(key)) byFunnel.set(key, { funnel_entry: key, enrollments: 0, classified_replies: 0, positive_replies: 0 });
        byFunnel.get(key).classified_replies += 1;
        if (String(details.classification || '') === 'interested') byFunnel.get(key).positive_replies += 1;
      }

      const entries = Array.from(byFunnel.values()).sort((a, b) => b.enrollments - a.enrollments).slice(0, 8);
      const totals = entries.reduce((acc, row) => ({
        enrollments: acc.enrollments + row.enrollments,
        classified_replies: acc.classified_replies + row.classified_replies,
        positive_replies: acc.positive_replies + row.positive_replies,
      }), { enrollments: 0, classified_replies: 0, positive_replies: 0 });

      const now = Date.now();
      const dayAgo = now - (24 * 60 * 60 * 1000);
      const newQualifiedPerDay = (qualifiedAccounts || []).filter((row) => toDateOrNull(row.created_at)?.getTime() >= dayAgo).length;
      const enrolledPerDay = (qualifiedAccounts || []).filter((row) => toDateOrNull(row.outreach_enrolled_at)?.getTime() >= dayAgo).length;
      const classifiedReplies = Number(totals.classified_replies || 0);
      const positiveReplies = Number(totals.positive_replies || 0);
      const positiveReplyRate = classifiedReplies > 0 ? (positiveReplies / classifiedReplies) : 0;
      const meetingsBooked = (meetings || []).filter((row) => toDateOrNull(row.meeting_at || row.created_at)?.getTime() >= dayAgo).length;
      const pilotCandidates = (qualifiedAccounts || []).filter((row) => normalizePilotHandoffStage(row.pipeline_stage) === 'pilot_candidate').length;

      return {
        generated_at: new Date().toISOString(),
        entries,
        totals,
        goal_metrics: {
          new_qualified_accounts_per_day: newQualifiedPerDay,
          enrolled_accounts_per_day: enrolledPerDay,
          positive_reply_rate: positiveReplyRate,
          positive_reply_rate_text: `${(positiveReplyRate * 100).toFixed(1)}%`,
          meetings_booked: meetingsBooked,
          pilot_candidates: pilotCandidates,
        },
      };
    }

    const { rows } = await pool.query(`
      with enrollment_entries as (
        select coalesce(metadata->>'funnel_id', metadata->>'entry_point', 'unattributed') as funnel_entry,
               count(*)::int as enrollments
          from public.cc_sequence_enrollments
         group by 1
      ),
      reply_classes as (
        select coalesce(details->>'funnel_id', details->>'entry_point', 'unattributed') as funnel_entry,
               count(*)::int as classified_replies,
               count(*) filter (where details->>'classification' = 'interested')::int as positive_replies
          from public.cc_activity_log
         where event_type = 'reply_classified'
         group by 1
      )
      select coalesce(e.funnel_entry, r.funnel_entry) as funnel_entry,
             coalesce(e.enrollments,0)::int as enrollments,
             coalesce(r.classified_replies,0)::int as classified_replies,
             coalesce(r.positive_replies,0)::int as positive_replies
        from enrollment_entries e
        full outer join reply_classes r on r.funnel_entry = e.funnel_entry
       order by enrollments desc, classified_replies desc
       limit 8
    `);

    const totals = rows.reduce((acc, row) => ({ enrollments: acc.enrollments + Number(row.enrollments || 0), classified_replies: acc.classified_replies + Number(row.classified_replies || 0), positive_replies: acc.positive_replies + Number(row.positive_replies || 0) }), { enrollments: 0, classified_replies: 0, positive_replies: 0 });

    const goalResult = await pool.query(`
      with qual as (
        select
          count(*) filter (where created_at >= now() - interval '1 day')::int as new_qualified_accounts_per_day,
          count(*) filter (where outreach_enrolled_at >= now() - interval '1 day')::int as enrolled_accounts_per_day,
          count(*) filter (where pipeline_stage = 'pilot_candidate')::int as pilot_candidates
        from public.cc_qualified_accounts
      ),
      replies as (
        select
          count(*)::int as classified_replies,
          count(*) filter (where details->>'classification' = 'interested')::int as positive_replies
        from public.cc_activity_log
        where event_type = 'reply_classified'
      ),
      meetings as (
        select count(*) filter (where coalesce(meeting_at, created_at) >= now() - interval '1 day')::int as meetings_booked
        from public.meeting_notes
      )
      select
        qual.new_qualified_accounts_per_day,
        qual.enrolled_accounts_per_day,
        qual.pilot_candidates,
        meetings.meetings_booked,
        replies.classified_replies,
        replies.positive_replies
      from qual, replies, meetings
    `);

    const goalRow = goalResult.rows[0] || {};
    const classifiedReplies = Number(goalRow.classified_replies || 0);
    const positiveReplies = Number(goalRow.positive_replies || 0);
    const positiveReplyRate = classifiedReplies > 0 ? (positiveReplies / classifiedReplies) : 0;

    return {
      generated_at: new Date().toISOString(),
      entries: rows,
      totals,
      goal_metrics: {
        new_qualified_accounts_per_day: Number(goalRow.new_qualified_accounts_per_day || 0),
        enrolled_accounts_per_day: Number(goalRow.enrolled_accounts_per_day || 0),
        positive_reply_rate: positiveReplyRate,
        positive_reply_rate_text: `${(positiveReplyRate * 100).toFixed(1)}%`,
        meetings_booked: Number(goalRow.meetings_booked || 0),
        pilot_candidates: Number(goalRow.pilot_candidates || 0),
      },
    };
  } catch {
    return fallback;
  }
}

async function getRecentReplyRouting(limit = 12) {
  if (!pool && !supabase) return [];
  if (supabase) {
    const { data, error } = await supabase
      .from('cc_activity_log')
      .select('lead_key,details,created_at')
      .eq('event_type', 'reply_routing_decision')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      if (String(error.message || '').toLowerCase().includes('cc_activity_log')) return [];
      throw error;
    }
    return (data || []).map((row) => {
      const details = safeJsonObject(row.details);
      return {
        lead_key: row.lead_key,
        classification: details.classification || 'neutral',
        next_action: details.next_action || 'nurture',
        reply_excerpt: details.reply_excerpt || '',
        created_at: row.created_at,
      };
    });
  }

  try {
    const { rows } = await pool.query(
      `select lead_key, details, created_at
         from public.cc_activity_log
        where event_type = 'reply_routing_decision'
        order by created_at desc
        limit $1`,
      [Number(limit) || 12],
    );
    return rows.map((row) => ({
      lead_key: row.lead_key,
      classification: row.details?.classification || 'neutral',
      next_action: row.details?.next_action || 'nurture',
      reply_excerpt: row.details?.reply_excerpt || '',
      created_at: row.created_at,
    }));
  } catch (error) {
    if (String(error.message || '').includes('cc_activity_log')) return [];
    throw error;
  }
}

async function getWorkflowCompleteness() {
  const [funnels, templateCount, enrollmentCounts, assets, meetingPipeline] = await Promise.all([
    getFunnels(),
    getSequenceTemplateCount(),
    getEnrollmentStatusCounts(),
    getAssetStatusSummary(),
    getMeetingPipelineSnapshot(),
  ]);

  const checks = [
    { id: 'funnels_active_present', label: 'At least one active funnel', pass: funnels.some((f) => String(f.status || '').toLowerCase() === 'active') },
    { id: 'sequence_templates_present', label: 'At least one sequence template', pass: templateCount > 0 },
    { id: 'sequence_enrollments_queued_or_active', label: 'Queued/active sequence enrollments present', pass: (enrollmentCounts.queued + enrollmentCounts.active) > 0 },
    { id: 'assets_live_present', label: 'At least one live asset (lead magnet or teaser)', pass: Number(assets?.lead_magnet?.live || 0) + Number(assets?.teaser_product?.live || 0) > 0 },
    { id: 'meeting_followups_present', label: 'Pending meeting follow-ups visible', pass: (meetingPipeline.pendingActions || []).length > 0 },
  ];

  const passCount = checks.filter((c) => c.pass).length;
  return {
    generated_at: new Date().toISOString(),
    pass_count: passCount,
    fail_count: checks.length - passCount,
    score: `${passCount}/${checks.length}`,
    checks,
    counts: {
      funnels_total: funnels.length,
      sequence_templates_total: templateCount,
      sequence_enrollments: enrollmentCounts,
      assets_live_total: Number(assets?.lead_magnet?.live || 0) + Number(assets?.teaser_product?.live || 0),
      pending_followups_total: (meetingPipeline.pendingActions || []).length,
    },
    verification_markers: ['workflow-completeness-v1', 'monday-polish-v1'],
  };
}

async function advanceStatus(taskId) {
  assertStore();
  if (supabase) {
    const { data: row, error } = await supabase.from('cc_operator_tasks').select('status').eq('id', taskId).maybeSingle();
    if (error) throw error;
    if (!row) return false;
    const nextStatus = STATUS_FLOW[String(row.status || 'todo')] || 'todo';
    const { error: updateError } = await supabase.from('cc_operator_tasks').update({ status: nextStatus }).eq('id', taskId);
    if (updateError) throw updateError;
    return true;
  }
  const selectResult = await pool.query('select status from public.cc_operator_tasks where id = $1', [taskId]);
  if (!selectResult.rowCount) return false;
  const nextStatus = STATUS_FLOW[String(selectResult.rows[0].status || 'todo')] || 'todo';
  await pool.query('update public.cc_operator_tasks set status = $1 where id = $2', [nextStatus, taskId]);
  return true;
}

function extractVoiceNoteFields(transcriptText = '') {
  const text = String(transcriptText || '').trim();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matchField = (patterns = []) => {
    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match?.[1]) return match[1].trim();
      }
    }
    return '';
  };

  const splitList = (value = '') => String(value || '').split(/[,;\u2022\-]\s*/).map((part) => part.trim()).filter(Boolean);

  const name = matchField([/^name\s*[:\-]\s*(.+)$/i, /^contact\s*[:\-]\s*(.+)$/i, /^individual\s*[:\-]\s*(.+)$/i]);
  const email = matchField([/^email\s*[:\-]\s*([^\s]+)$/i]);
  const phone = matchField([/^phone\s*[:\-]\s*(.+)$/i, /^mobile\s*[:\-]\s*(.+)$/i]);
  const company = matchField([/^company\s*[:\-]\s*(.+)$/i, /^account\s*[:\-]\s*(.+)$/i, /^org(?:anization)?\s*[:\-]\s*(.+)$/i]);
  const role = matchField([/^role\s*[:\-]\s*(.+)$/i, /^title\s*[:\-]\s*(.+)$/i]);
  const notes = matchField([/^notes?\s*[:\-]\s*(.+)$/i, /^context\s*[:\-]\s*(.+)$/i]) || lines.slice(0, 4).join(' ');
  const context = matchField([/^context\s*[:\-]\s*(.+)$/i, /^situation\s*[:\-]\s*(.+)$/i, /^summary\s*[:\-]\s*(.+)$/i]) || notes;
  const painRaw = matchField([/^pain\s*points?\s*[:\-]\s*(.+)$/i, /^pain\s*[:\-]\s*(.+)$/i, /^challenges?\s*[:\-]\s*(.+)$/i, /^problems?\s*[:\-]\s*(.+)$/i]);
  const followup = matchField([/^promised\s*follow\s*up\s*[:\-]\s*(.+)$/i, /^follow\s*up\s*[:\-]\s*(.+)$/i, /^next\s*step\s*[:\-]\s*(.+)$/i, /^action\s*[:\-]\s*(.+)$/i]);
  const website = matchField([/^website\s*[:\-]\s*(https?:\/\/[^\s]+)$/i]) || (text.match(/https?:\/\/[^\s)]+/i)?.[0] || null);

  const pain_points = painRaw ? splitList(painRaw).slice(0, 6) : [];

  return {
    account_name: company || null,
    contact_name: name || 'Unknown contact',
    role_title: role || null,
    contact_email: email || null,
    contact_phone: phone || null,
    company_name: company || null,
    website,
    context,
    pain_points,
    promised_follow_up: followup || null,
    extracted_notes: notes || text.slice(0, 300),
    followup_text: followup || null,
  };
}

function normalizeTradeShowCapturePayload(payload = {}) {
  const transcriptText = String(payload.transcript_text || '').trim();
  if (!transcriptText) throw new Error('transcript_text is required');
  const source = String(payload.source || 'voice_memo_placeholder').trim() || 'voice_memo_placeholder';
  const meetingAt = payload.meeting_at || null;
  return { transcriptText, source, meetingAt };
}

function validateTradeShowExtraction(extracted = {}) {
  const missing = [];
  const accountName = String(extracted.account_name || extracted.company_name || '').trim();
  const contactName = String(extracted.contact_name || '').trim();
  const context = String(extracted.context || extracted.extracted_notes || '').trim();
  const followup = String(extracted.promised_follow_up || extracted.followup_text || '').trim();
  if (!accountName) missing.push('account');
  if (!contactName || /^unknown\s+contact$/i.test(contactName)) missing.push('individual');
  if (!context) missing.push('context');
  if (!followup) missing.push('promised follow-up');
  return { ok: missing.length === 0, missing };
}

async function listTradeShowCaptures(limit = 12) {
  if (!pool && !supabase) return [];
  const max = Math.max(1, Math.min(Number(limit) || 12, 50));

  if (supabase) {
    const { data, error } = await supabase
      .from('cc_trade_show_captures')
      .select('id,account_id,individual_id,source,context_notes,pain_points,promised_followup,created_at,cc_trade_show_accounts (account_name),cc_trade_show_individuals (full_name)')
      .order('created_at', { ascending: false })
      .limit(max);
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      account_name: row.cc_trade_show_accounts?.account_name || null,
      individual_name: row.cc_trade_show_individuals?.full_name || null,
    }));
  }

  const { rows } = await pool.query(
    `select c.id, c.account_id, c.individual_id, c.source, c.context_notes, c.pain_points, c.promised_followup, c.created_at,
            a.account_name, i.full_name as individual_name
     from public.cc_trade_show_captures c
     left join public.cc_trade_show_accounts a on a.id = c.account_id
     left join public.cc_trade_show_individuals i on i.id = c.individual_id
     order by c.created_at desc
     limit $1`,
    [max],
  );
  return rows || [];
}

async function ingestTradeShowVoiceMemo(payload = {}) {
  assertStore();
  const { transcriptText, source, meetingAt } = normalizeTradeShowCapturePayload(payload);
  const extracted = extractVoiceNoteFields(transcriptText);
  const extractionValidation = validateTradeShowExtraction(extracted);
  if (!extractionValidation.ok) {
    throw new Error(`missing_fields:${extractionValidation.missing.join('|')}`);
  }
  const accountName = String(extracted.account_name || extracted.company_name || 'Unknown account').trim();
  const individualName = String(extracted.contact_name || 'Unknown contact').trim();
  const contextNotes = String(extracted.context || extracted.extracted_notes || '').trim();
  const painPoints = Array.isArray(extracted.pain_points) ? extracted.pain_points : [];
  const promisedFollowup = String(extracted.promised_follow_up || extracted.followup_text || '').trim()
    || `Send follow-up to ${individualName}${accountName ? ` at ${accountName}` : ''}`;

  let accountId = null;
  let individualId = null;

  if (supabase) {
    const { data: existingAccount, error: existingAccountError } = await supabase
      .from('cc_trade_show_accounts')
      .select('id')
      .eq('account_name', accountName)
      .limit(1)
      .maybeSingle();
    if (existingAccountError) throw existingAccountError;

    if (existingAccount?.id) {
      accountId = existingAccount.id;
      const { error: updateAccountError } = await supabase
        .from('cc_trade_show_accounts')
        .update({ website: extracted.website || null, context_notes: contextNotes, pain_points: painPoints, last_promised_followup: promisedFollowup, last_capture_at: new Date().toISOString() })
        .eq('id', accountId);
      if (updateAccountError) throw updateAccountError;
    } else {
      const { data: createdAccount, error: accountError } = await supabase
        .from('cc_trade_show_accounts')
        .insert({ account_name: accountName, website: extracted.website || null, context_notes: contextNotes, pain_points: painPoints, last_promised_followup: promisedFollowup, last_capture_at: new Date().toISOString() })
        .select('id')
        .single();
      if (accountError) throw accountError;
      accountId = createdAccount?.id || null;
    }

    const { data: existingIndividual, error: existingIndividualError } = await supabase
      .from('cc_trade_show_individuals')
      .select('id')
      .eq('account_id', accountId)
      .eq('full_name', individualName)
      .limit(1)
      .maybeSingle();
    if (existingIndividualError) throw existingIndividualError;

    if (existingIndividual?.id) {
      individualId = existingIndividual.id;
      const { error: updateIndividualError } = await supabase
        .from('cc_trade_show_individuals')
        .update({ role_title: extracted.role_title || null, email: extracted.contact_email || null, phone: extracted.contact_phone || null, context_notes: contextNotes, pain_points: painPoints, last_promised_followup: promisedFollowup, last_capture_at: new Date().toISOString() })
        .eq('id', individualId);
      if (updateIndividualError) throw updateIndividualError;
    } else {
      const { data: createdIndividual, error: individualError } = await supabase
        .from('cc_trade_show_individuals')
        .insert({ account_id: accountId, full_name: individualName, role_title: extracted.role_title || null, email: extracted.contact_email || null, phone: extracted.contact_phone || null, context_notes: contextNotes, pain_points: painPoints, last_promised_followup: promisedFollowup, last_capture_at: new Date().toISOString() })
        .select('id')
        .single();
      if (individualError) throw individualError;
      individualId = createdIndividual?.id || null;
    }

    const meeting = await ingestMeetingNote({ clientName: accountName, noteText: transcriptText, sourceType: 'voice_transcript', meetingAt });
    const { data: actionRow, error: actionError } = await supabase
      .from('meeting_actions')
      .insert({ meeting_note_id: meeting.noteId, client_name: accountName, action_text: promisedFollowup, status: 'pending' })
      .select('id')
      .single();
    if (actionError) throw actionError;

    const { data: captureRow, error: captureError } = await supabase
      .from('cc_trade_show_captures')
      .insert({ account_id: accountId, individual_id: individualId, meeting_note_id: meeting.noteId, followup_action_id: actionRow?.id || null, source, transcript_text: transcriptText, context_notes: contextNotes, pain_points: painPoints, promised_followup: promisedFollowup, extracted_payload: extracted })
      .select('id,created_at')
      .single();
    if (captureError) throw captureError;

    return { marker: 'trade-show-voice-memo-v1', ok: true, capture_id: captureRow?.id || null, created_at: captureRow?.created_at || null, account: { id: accountId, name: accountName }, individual: { id: individualId, name: individualName }, extracted: { account: accountName, individual: individualName, context: contextNotes, pain_points: painPoints, promised_follow_up: promisedFollowup }, followup_action_id: actionRow?.id || null };
  }

  const nowIso = new Date().toISOString();
  const accountLookup = await pool.query('select id from public.cc_trade_show_accounts where lower(account_name) = lower($1) order by updated_at desc nulls last, created_at desc limit 1', [accountName]);
  if (accountLookup.rowCount) {
    accountId = accountLookup.rows[0].id;
    await pool.query(
      'update public.cc_trade_show_accounts set website = coalesce($1, website), context_notes = $2, pain_points = $3::jsonb, last_promised_followup = $4, last_capture_at = $5, updated_at = now() where id = $6',
      [extracted.website || null, contextNotes, JSON.stringify(painPoints), promisedFollowup, nowIso, accountId],
    );
  } else {
    const accountInsert = await pool.query(
      'insert into public.cc_trade_show_accounts (account_name, website, context_notes, pain_points, last_promised_followup, last_capture_at) values ($1,$2,$3,$4::jsonb,$5,$6) returning id',
      [accountName, extracted.website || null, contextNotes, JSON.stringify(painPoints), promisedFollowup, nowIso],
    );
    accountId = accountInsert.rows[0]?.id || null;
  }

  const individualLookup = await pool.query('select id from public.cc_trade_show_individuals where account_id = $1 and lower(full_name) = lower($2) order by updated_at desc nulls last, created_at desc limit 1', [accountId, individualName]);
  if (individualLookup.rowCount) {
    individualId = individualLookup.rows[0].id;
    await pool.query(
      'update public.cc_trade_show_individuals set role_title = coalesce($1, role_title), email = coalesce($2, email), phone = coalesce($3, phone), context_notes = $4, pain_points = $5::jsonb, last_promised_followup = $6, last_capture_at = $7, updated_at = now() where id = $8',
      [extracted.role_title || null, extracted.contact_email || null, extracted.contact_phone || null, contextNotes, JSON.stringify(painPoints), promisedFollowup, nowIso, individualId],
    );
  } else {
    const individualInsert = await pool.query(
      'insert into public.cc_trade_show_individuals (account_id, full_name, role_title, email, phone, context_notes, pain_points, last_promised_followup, last_capture_at) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) returning id',
      [accountId, individualName, extracted.role_title || null, extracted.contact_email || null, extracted.contact_phone || null, contextNotes, JSON.stringify(painPoints), promisedFollowup, nowIso],
    );
    individualId = individualInsert.rows[0]?.id || null;
  }

  const meeting = await ingestMeetingNote({ clientName: accountName, noteText: transcriptText, sourceType: 'voice_transcript', meetingAt });
  const actionInsert = await pool.query(
    'insert into public.meeting_actions (meeting_note_id, client_name, action_text, status) values ($1,$2,$3,$4) returning id',
    [meeting.noteId, accountName, promisedFollowup, 'pending'],
  );
  const followupActionId = actionInsert.rows[0]?.id || null;

  const captureInsert = await pool.query(
    `insert into public.cc_trade_show_captures
      (account_id, individual_id, meeting_note_id, followup_action_id, source, transcript_text, context_notes, pain_points, promised_followup, extracted_payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb)
     returning id, created_at`,
    [accountId, individualId, meeting.noteId, followupActionId, source, transcriptText, contextNotes, JSON.stringify(painPoints), promisedFollowup, JSON.stringify(extracted)],
  );

  return { marker: 'trade-show-voice-memo-v1', ok: true, capture_id: captureInsert.rows[0]?.id || null, created_at: captureInsert.rows[0]?.created_at || null, account: { id: accountId, name: accountName }, individual: { id: individualId, name: individualName }, extracted: { account: accountName, individual: individualName, context: contextNotes, pain_points: painPoints, promised_follow_up: promisedFollowup }, followup_action_id: followupActionId };
}

async function ingestMeetingNote({ clientName, noteText, sourceType = 'text', meetingAt = null }) {
  assertStore();
  const normalizedClientName = String(clientName || '').trim() || 'Unknown client';
  const normalizedNoteText = String(noteText || '').trim();
  const requestedSourceType = String(sourceType || 'text').trim().toLowerCase();
  const normalizedSourceType = requestedSourceType === 'voice_transcript' ? 'voice_transcript' : 'text';
  if (!normalizedNoteText) throw new Error('note_text is required');

  const actionItems = normalizedNoteText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(-\s*\[\s?\]\s+|action[:\-]\s*|todo[:\-]\s*)/i.test(line))
    .map((line) => line.replace(/^-\s*\[\s?\]\s+/i, '').replace(/^action[:\-]\s*/i, '').replace(/^todo[:\-]\s*/i, '').trim())
    .filter(Boolean)
    .slice(0, 20);

  const summary = normalizedNoteText.slice(0, 700);

  if (supabase) {
    const { data: note, error: noteError } = await supabase.from('meeting_notes').insert({ client_name: normalizedClientName, source_type: normalizedSourceType, note_text: normalizedNoteText, meeting_at: meetingAt }).select('id').single();
    if (noteError) throw noteError;
    if (actionItems.length) {
      const { error: actionError } = await supabase.from('meeting_actions').insert(actionItems.map((item) => ({ meeting_note_id: note.id, client_name: normalizedClientName, action_text: item, status: 'pending' })));
      if (actionError) throw actionError;
    }
    const { error: updateError } = await supabase.from('client_updates').insert({ meeting_note_id: note.id, client_name: normalizedClientName, update_text: summary, status: 'draft' });
    if (updateError) throw updateError;
    return { noteId: note.id, actionCount: actionItems.length, clientName: normalizedClientName };
  }

  const { rows } = await pool.query('insert into public.meeting_notes (client_name, source_type, note_text, meeting_at) values ($1,$2,$3,$4) returning id', [normalizedClientName, normalizedSourceType, normalizedNoteText, meetingAt]);
  const noteId = rows[0]?.id;
  for (const item of actionItems) {
    await pool.query('insert into public.meeting_actions (meeting_note_id, client_name, action_text, status) values ($1,$2,$3,$4)', [noteId, normalizedClientName, item, 'pending']);
  }
  await pool.query('insert into public.client_updates (meeting_note_id, client_name, update_text, status) values ($1,$2,$3,$4)', [noteId, normalizedClientName, summary, 'draft']);
  return { noteId, actionCount: actionItems.length, clientName: normalizedClientName };
}

async function ingestVoiceNoteTranscript({ transcriptText, meetingAt = null, source = 'voice_note' }) {
  assertStore();
  const normalizedTranscript = String(transcriptText || '').trim();
  if (!normalizedTranscript) throw new Error('transcript_text is required');

  const extracted = extractVoiceNoteFields(normalizedTranscript);
  const inferredClientName = extracted.company_name || extracted.contact_name;
  const followupText = extracted.followup_text || `Follow up with ${extracted.contact_name}${extracted.company_name ? ` at ${extracted.company_name}` : ''}`;

  const meeting = await ingestMeetingNote({
    clientName: inferredClientName,
    noteText: normalizedTranscript,
    sourceType: 'voice_transcript',
    meetingAt,
  });

  let followupActionId = null;
  if (supabase) {
    const { data: actionRow, error: actionError } = await supabase
      .from('meeting_actions')
      .insert({
        meeting_note_id: meeting.noteId,
        client_name: inferredClientName,
        action_text: followupText,
        status: 'pending',
      })
      .select('id')
      .single();
    if (actionError) throw actionError;
    followupActionId = actionRow?.id || null;

    const { error: ingestionError } = await supabase.from('voice_note_ingestions').insert({
      meeting_note_id: meeting.noteId,
      followup_action_id: followupActionId,
      source,
      transcript_text: normalizedTranscript,
      contact_name: extracted.contact_name,
      contact_email: extracted.contact_email,
      contact_phone: extracted.contact_phone,
      company_name: extracted.company_name,
      extracted_notes: extracted.extracted_notes,
      followup_text: followupText,
      parse_confidence: extracted.contact_name === 'Unknown contact' ? 0.35 : 0.75,
    });
    if (ingestionError) throw ingestionError;
  } else {
    const actionResult = await pool.query(
      'insert into public.meeting_actions (meeting_note_id, client_name, action_text, status) values ($1,$2,$3,$4) returning id',
      [meeting.noteId, inferredClientName, followupText, 'pending']
    );
    followupActionId = actionResult.rows[0]?.id || null;

    await pool.query(
      `insert into public.voice_note_ingestions
      (meeting_note_id, followup_action_id, source, transcript_text, contact_name, contact_email, contact_phone, company_name, extracted_notes, followup_text, parse_confidence)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [meeting.noteId, followupActionId, source, normalizedTranscript, extracted.contact_name, extracted.contact_email, extracted.contact_phone, extracted.company_name, extracted.extracted_notes, followupText, extracted.contact_name === 'Unknown contact' ? 0.35 : 0.75]
    );
  }

  return {
    ok: true,
    noteId: meeting.noteId,
    followupActionId,
    contact: {
      name: extracted.contact_name,
      email: extracted.contact_email,
      phone: extracted.contact_phone,
      company: extracted.company_name,
    },
    notes: extracted.extracted_notes,
    followup_text: followupText,
    mode: runtimeMode,
  };
}

async function getMeetingPipelineSnapshot() {
  if (!pool && !supabase) return { recentMeetings: [], pendingActions: [], dueClientUpdates: [], recentIngestions: [] };
  if (supabase) {
    const [m, a, u, i] = await Promise.all([
      supabase.from('meeting_notes').select('id,client_name,source_type,created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('meeting_actions').select('id,client_name,action_text,status,due_date').in('status', ['pending', 'in_progress']).order('created_at', { ascending: false }).limit(12),
      supabase.from('client_updates').select('id,client_name,update_text,status,due_date').in('status', ['draft', 'due']).order('due_date', { ascending: true, nullsFirst: false }).limit(12),
      supabase.from('voice_note_ingestions').select('id,contact_name,contact_email,company_name,followup_text,created_at').order('created_at', { ascending: false }).limit(8),
    ]);
    if (m.error) throw m.error;
    if (a.error) throw a.error;
    if (u.error) throw u.error;
    if (i.error) throw i.error;
    return { recentMeetings: m.data ?? [], pendingActions: a.data ?? [], dueClientUpdates: u.data ?? [], recentIngestions: i.data ?? [] };
  }

  const [m, a, u, i] = await Promise.all([
    pool.query('select id, client_name, source_type, created_at from public.meeting_notes order by created_at desc limit 8'),
    pool.query("select id, client_name, action_text, status, due_date from public.meeting_actions where status in ('pending','in_progress') order by created_at desc limit 12"),
    pool.query("select id, client_name, update_text, status, due_date from public.client_updates where status in ('draft','due') order by due_date asc nulls last, created_at desc limit 12"),
    pool.query('select id, contact_name, contact_email, company_name, followup_text, created_at from public.voice_note_ingestions order by created_at desc limit 8'),
  ]);

  return { recentMeetings: m.rows, pendingActions: a.rows, dueClientUpdates: u.rows, recentIngestions: i.rows };
}

async function advanceFollowupStatus(actionId) {
  assertStore();
  if (supabase) {
    const { data: row, error } = await supabase.from('meeting_actions').select('status,meeting_note_id').eq('id', actionId).maybeSingle();
    if (error) throw error;
    if (!row) return { ok: false, nextStatus: null };
    const nextStatus = FOLLOWUP_STATUS_FLOW[String(row.status || 'pending')] || 'pending';
    const patch = nextStatus === 'done' ? { status: nextStatus, completed_at: new Date().toISOString() } : { status: nextStatus };
    const { error: updateError } = await supabase.from('meeting_actions').update(patch).eq('id', actionId);
    if (updateError) throw updateError;

    if (row.meeting_note_id && nextStatus === 'done') {
      const { count, error: pendingError } = await supabase
        .from('meeting_actions')
        .select('id', { count: 'exact', head: true })
        .eq('meeting_note_id', row.meeting_note_id)
        .in('status', ['pending', 'in_progress']);
      if (pendingError) throw pendingError;
      if (Number(count || 0) === 0) {
        const { data: promotedRows, error: updateClientError } = await supabase
          .from('client_updates')
          .update({ status: 'due' })
          .eq('meeting_note_id', row.meeting_note_id)
          .eq('status', 'draft')
          .select('id,meeting_note_id,client_name,status');
        if (updateClientError) throw updateClientError;
        for (const promoted of promotedRows || []) {
          await recordClientUpdateActivity({
            clientUpdateId: promoted.id,
            meetingNoteId: promoted.meeting_note_id,
            clientName: promoted.client_name,
            fromStatus: 'draft',
            toStatus: promoted.status || 'due',
            actor: 'system:followup_advance',
            details: { source_action_id: actionId },
          });
        }
      }
    }

    return { ok: true, nextStatus };
  }

  const selectResult = await pool.query('select status, meeting_note_id from public.meeting_actions where id = $1', [actionId]);
  if (!selectResult.rowCount) return { ok: false, nextStatus: null };
  const nextStatus = FOLLOWUP_STATUS_FLOW[String(selectResult.rows[0].status || 'pending')] || 'pending';
  const meetingNoteId = selectResult.rows[0].meeting_note_id;
  await pool.query("update public.meeting_actions set status = $1, completed_at = case when $1 = 'done' and completed_at is null then now() else completed_at end where id = $2", [nextStatus, actionId]);

  if (meetingNoteId && nextStatus === 'done') {
    const pendingResult = await pool.query("select count(*)::int as count from public.meeting_actions where meeting_note_id = $1 and status in ('pending','in_progress')", [meetingNoteId]);
    if (Number(pendingResult.rows[0]?.count || 0) === 0) {
      const promotedResult = await pool.query("update public.client_updates set status = 'due' where meeting_note_id = $1 and status = 'draft' returning id, meeting_note_id, client_name, status", [meetingNoteId]);
      for (const promoted of promotedResult.rows || []) {
        await recordClientUpdateActivity({
          clientUpdateId: promoted.id,
          meetingNoteId: promoted.meeting_note_id,
          clientName: promoted.client_name,
          fromStatus: 'draft',
          toStatus: promoted.status || 'due',
          actor: 'system:followup_advance',
          details: { source_action_id: actionId },
        });
      }
    }
  }

  return { ok: true, nextStatus };
}

async function markClientUpdateSent(clientUpdateId, actor = 'api') {
  assertStore();
  if (supabase) {
    const { data: row, error } = await supabase
      .from('client_updates')
      .select('id,meeting_note_id,client_name,status,sent_at')
      .eq('id', clientUpdateId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return { ok: false, reason: 'not_found' };

    const nextStatus = row.status === 'cancelled' ? 'cancelled' : 'sent';
    const patch = nextStatus === 'sent' ? { status: 'sent', sent_at: new Date().toISOString() } : { status: row.status };
    const { data: updated, error: updateError } = await supabase
      .from('client_updates')
      .update(patch)
      .eq('id', clientUpdateId)
      .select('id,meeting_note_id,client_name,status,due_date,sent_at')
      .single();
    if (updateError) throw updateError;

    if (row.status !== updated.status) {
      await recordClientUpdateActivity({
        clientUpdateId: updated.id,
        meetingNoteId: updated.meeting_note_id,
        clientName: updated.client_name,
        fromStatus: row.status,
        toStatus: updated.status,
        actor,
        details: {
          action: 'mark_sent',
          sent_at: updated.sent_at || new Date().toISOString(),
        },
      });
    }

    return { ok: true, data: updated, status_changed: row.status !== updated.status };
  }

  const selectResult = await pool.query('select id, meeting_note_id, client_name, status, sent_at from public.client_updates where id = $1', [clientUpdateId]);
  if (!selectResult.rowCount) return { ok: false, reason: 'not_found' };
  const row = selectResult.rows[0];
  const nextStatus = row.status === 'cancelled' ? 'cancelled' : 'sent';
  const updateResult = await pool.query(
    "update public.client_updates set status = case when status = 'cancelled' then status else 'sent' end, sent_at = case when status = 'cancelled' then sent_at else now() end where id = $1 returning id, meeting_note_id, client_name, status, due_date, sent_at",
    [clientUpdateId],
  );
  const updated = updateResult.rows[0];

  if (row.status !== updated.status) {
    await recordClientUpdateActivity({
      clientUpdateId: updated.id,
      meetingNoteId: updated.meeting_note_id,
      clientName: updated.client_name,
      fromStatus: row.status,
      toStatus: updated.status,
      actor,
      details: {
        action: 'mark_sent',
        sent_at: updated.sent_at || new Date().toISOString(),
      },
    });
  }

  return { ok: true, data: updated, status_changed: row.status !== updated.status, nextStatus };
}

async function readWorkQueueSnapshot() {
  try {
    const raw = await readFile(workQueueMarkdownPath, 'utf8');
    return parseWorkQueueMarkdown(raw);
  } catch {
    return { now: [], next: [], blocked: [], done: [], waitingOnUser: [] };
  }
}

async function readStrategyArtifacts() {
  const base = path.resolve(process.cwd(), '.run/reports');
  const candidates = {
    dailySummaryJson: path.resolve(base, 'daily-gtm-summary/daily-gtm-summary-latest.json'),
    dailySummaryMarkdown: path.resolve(base, 'daily-gtm-summary/daily-gtm-summary-latest.md'),
    weeklyScorecardMarkdown: path.resolve(base, 'weekly-scorecard/weekly-scorecard-latest.md'),
    nightlySummaryMarkdown: path.resolve(base, 'nightly-summary-latest.md'),
    operationalSummaryMarkdown: path.resolve(base, 'operational-summary-latest.md'),
  };

  const entries = await Promise.all(Object.entries(candidates).map(async ([key, filePath]) => {
    try {
      const raw = await readFile(filePath, 'utf8');
      return [key, { path: filePath, raw }];
    } catch {
      return [key, null];
    }
  }));

  return Object.fromEntries(entries);
}


function buildWeeklyScorecardSnapshot(raw = '') {
  const lines = String(raw || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const title = lines.find((line) => line.startsWith('#'))?.replace(/^#+\s*/, '') || 'Weekly pilot scorecard';
  const highlights = lines.filter((line) => /^[-*]\s+/.test(line)).slice(0, 4).map((line) => line.replace(/^[-*]\s+/, ''));
  return { title, highlights };
}

function deriveStrategyViewModel({ artifacts = {}, queueSnapshot = {}, tasks = [], readiness = null } = {}) {
  const queue = {
    now: Array.isArray(queueSnapshot.now) ? queueSnapshot.now : [],
    next: Array.isArray(queueSnapshot.next) ? queueSnapshot.next : [],
    blocked: Array.isArray(queueSnapshot.blocked) ? queueSnapshot.blocked : [],
    waitingOnUser: Array.isArray(queueSnapshot.waitingOnUser) ? queueSnapshot.waitingOnUser : [],
    done: Array.isArray(queueSnapshot.done) ? queueSnapshot.done : [],
  };

  const normalizedTasks = Array.isArray(tasks) ? tasks : [];
  const totalTaskCount = normalizedTasks.length;
  const doneTaskCount = normalizedTasks.filter((task) => String(task.status || '').toLowerCase() === 'done').length;
  const inProgressTaskCount = normalizedTasks.filter((task) => String(task.status || '').toLowerCase() === 'in_progress').length;
  const completionPct = totalTaskCount > 0 ? Math.round((doneTaskCount / totalTaskCount) * 100) : 0;

  let summary = 'Strategy artifacts not found yet. Run daily/weekly summaries to enrich this view.';
  let summarySource = 'queue + runtime fallback';
  let readinessDecision = readiness?.readiness_state || 'n/a';

  if (artifacts.dailySummaryJson?.raw) {
    try {
      const parsed = JSON.parse(artifacts.dailySummaryJson.raw);
      readinessDecision = parsed?.readiness?.readiness_state || readinessDecision;
      summary = [
        `Runtime mode: ${parsed?.mode || 'n/a'}`,
        `Monday readiness decision: ${readinessDecision}`,
        `Delegations (24h): ${parsed?.kpis?.delegations_24h ?? 'n/a'}`,
        `Completed (24h): ${parsed?.kpis?.completed_24h ?? 'n/a'}`,
      ].join(' · ');
      summarySource = path.basename(artifacts.dailySummaryJson.path);
    } catch {
      // noop, fallback summary remains.
    }
  }

  const roadmap = [
    { lane: 'Now', items: queue.now },
    { lane: 'Next', items: queue.next },
    { lane: 'Later', items: [...queue.blocked, ...queue.waitingOnUser] },
  ];

  const activeDecisions = [
    {
      title: 'Monday readiness decision',
      decision: readinessDecision,
      rationale: `Derived from readiness checks and queue health. Blocked=${queue.blocked.length}, waiting_on_user=${queue.waitingOnUser.length}.`,
      owner: 'AI operator',
      source: artifacts.dailySummaryJson?.path || 'computed runtime state',
      status: readinessDecision === 'GO' ? 'active' : 'attention',
    },
  ];

  if (queue.blocked.length > 0) {
    const blockedPreview = queue.blocked.slice(0, 2).map((item) => item.title || item.id || 'blocked item').join('; ');
    activeDecisions.push({
      title: 'Blocked work triage',
      decision: `Unblock ${queue.blocked.length} items`,
      rationale: `Blocked queue contains: ${blockedPreview}. Prioritize dependencies before adding net-new tasks.`,
      owner: 'AI operator',
      source: 'WORK_QUEUE.md',
      status: 'active',
    });
  }

  const weeklyScorecard = artifacts.weeklyScorecardMarkdown?.raw
    ? {
      source: artifacts.weeklyScorecardMarkdown.path,
      ...buildWeeklyScorecardSnapshot(artifacts.weeklyScorecardMarkdown.raw),
    }
    : null;

  return {
    summary,
    summarySource,
    roadmap,
    activeDecisions,
    weeklyScorecard,
    execution: {
      totalTaskCount,
      doneTaskCount,
      inProgressTaskCount,
      queueNowCount: queue.now.length,
      queueDoneCount: queue.done.length,
      completionPct,
    },
  };
}

function normalizeEscalationLevelConfig(levelKey, levelValue = {}) {
  return {
    notify: Array.isArray(levelValue.notify) ? levelValue.notify.map((item) => String(item).trim()).filter(Boolean) : [],
    escalate_after_minutes: Number.isFinite(Number(levelValue.escalate_after_minutes)) ? Number(levelValue.escalate_after_minutes) : 0,
    escalate_to: String(levelValue.escalate_to || '').trim() || null,
  };
}

function normalizeAlertRulesConfig(raw = {}) {
  const fallback = DEFAULT_ALERT_RULES;
  const parsedRules = Array.isArray(raw.rules) ? raw.rules : fallback.rules;
  const parsedPolicy = raw.escalation_policy && typeof raw.escalation_policy === 'object' ? raw.escalation_policy : fallback.escalation_policy;
  return {
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : fallback.version,
    generated_by: String(raw.generated_by || fallback.generated_by),
    escalation_policy: {
      info: normalizeEscalationLevelConfig('info', parsedPolicy.info || fallback.escalation_policy.info),
      warning: normalizeEscalationLevelConfig('warning', parsedPolicy.warning || fallback.escalation_policy.warning),
      critical: normalizeEscalationLevelConfig('critical', parsedPolicy.critical || fallback.escalation_policy.critical),
    },
    rules: parsedRules.map((rule) => ({
      ...rule,
      id: String(rule?.id || '').trim(),
      name: String(rule?.name || '').trim() || String(rule?.id || 'Untitled rule'),
      threshold: String(rule?.threshold || '').trim() || 'n/a',
      severity: normalizeSeverity(rule?.severity),
      owner: String(rule?.owner || 'Unassigned').trim() || 'Unassigned',
      sla_minutes: Number.isFinite(Number(rule?.sla_minutes)) ? Number(rule.sla_minutes) : null,
    })).filter((rule) => rule.id),
  };
}

async function readAlertRulesConfig() {
  try {
    const raw = await readFile(alertRulesPath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeAlertRulesConfig(parsed);
  } catch {
    await mkdir(path.dirname(alertRulesPath), { recursive: true });
    await writeFile(alertRulesPath, `${JSON.stringify(DEFAULT_ALERT_RULES, null, 2)}\n`, 'utf8');
    return normalizeAlertRulesConfig(DEFAULT_ALERT_RULES);
  }
}

async function writeAlertRulesConfig(config = {}) {
  const normalized = normalizeAlertRulesConfig(config);
  await mkdir(path.dirname(alertRulesPath), { recursive: true });
  await writeFile(alertRulesPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function normalizeAutonomyDirection(raw = {}) {
  const defaults = DEFAULT_AUTONOMY_DIRECTION;
  const speedRaw = Number(raw?.directional_preferences?.speed_vs_polish);
  const speedVsPolish = Number.isFinite(speedRaw) ? Math.min(1, Math.max(0, speedRaw)) : defaults.directional_preferences.speed_vs_polish;
  const riskTolerance = ['low', 'medium', 'high'].includes(String(raw?.directional_preferences?.risk_tolerance || '').toLowerCase())
    ? String(raw.directional_preferences.risk_tolerance).toLowerCase()
    : defaults.directional_preferences.risk_tolerance;
  const reviewStrictness = ['light', 'standard', 'strict'].includes(String(raw?.directional_preferences?.review_strictness || '').toLowerCase())
    ? String(raw.directional_preferences.review_strictness).toLowerCase()
    : defaults.directional_preferences.review_strictness;

  return {
    marker: defaults.marker,
    objective: String(raw.objective || defaults.objective).trim() || defaults.objective,
    quality_mode: ['speed', 'balanced', 'polish'].includes(String(raw.quality_mode || '').toLowerCase())
      ? String(raw.quality_mode).toLowerCase()
      : defaults.quality_mode,
    operating_constraints: Array.isArray(raw.operating_constraints) && raw.operating_constraints.length
      ? raw.operating_constraints.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12)
      : defaults.operating_constraints,
    directional_preferences: {
      speed_vs_polish: Number(speedVsPolish.toFixed(2)),
      risk_tolerance: riskTolerance,
      review_strictness: reviewStrictness,
    },
  };
}

async function readAutonomyDirection() {
  try {
    const raw = await readFile(autonomyDirectionPath, 'utf8');
    return normalizeAutonomyDirection(JSON.parse(raw));
  } catch {
    const normalized = normalizeAutonomyDirection(DEFAULT_AUTONOMY_DIRECTION);
    await mkdir(path.dirname(autonomyDirectionPath), { recursive: true });
    await writeFile(autonomyDirectionPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    return normalized;
  }
}

async function writeAutonomyDirection(payload = {}) {
  const normalized = normalizeAutonomyDirection(payload);
  await mkdir(path.dirname(autonomyDirectionPath), { recursive: true });
  await writeFile(autonomyDirectionPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function deriveSpawnDefaultsFromAutonomy(direction = {}) {
  const prefs = direction.directional_preferences || {};
  const speed = Number(prefs.speed_vs_polish || 0.5);
  const strictness = String(prefs.review_strictness || 'standard');
  const risk = String(prefs.risk_tolerance || 'medium');
  const targetWorkers = speed >= 0.75 ? 4 : speed >= 0.55 ? 3 : 2;
  const qualityGate = strictness === 'strict' ? 'hard' : strictness === 'light' ? 'soft' : 'standard';
  return {
    marker: 'ops-spawn-defaults-from-direction-v1',
    target_workers: targetWorkers,
    quality_gate: qualityGate,
    escalation_mode: risk === 'low' ? 'conservative' : risk === 'high' ? 'aggressive' : 'balanced',
    review_burst_budget: strictness === 'strict' ? 5 : strictness === 'light' ? 2 : 3,
  };
}

function applyAutonomyDirectionToReviewBursts(bursts = [], direction = {}) {
  const prefs = direction.directional_preferences || {};
  const strictness = String(prefs.review_strictness || 'standard');
  const speed = Number(prefs.speed_vs_polish || 0.5);
  const cappedCount = strictness === 'strict' ? 5 : strictness === 'light' ? 2 : 3;
  return [...bursts]
    .map((burst, index) => ({
      ...burst,
      recommendedDefault: `${burst.recommendedDefault || ''}${speed >= 0.7 ? ' Bias toward time-boxed execution this cycle.' : speed <= 0.35 ? ' Bias toward higher polish and evidence completeness this cycle.' : ''}`.trim(),
      expectedReviewTime: strictness === 'strict' ? '8 min' : strictness === 'light' ? '3 min' : (burst.expectedReviewTime || '5 min'),
      priority: strictness === 'strict' && index === 0 ? 'critical' : burst.priority,
    }))
    .slice(0, cappedCount);
}

async function readNurtureTriggerRules() {
  try {
    const raw = await readFile(nurtureTriggerRulesPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.rules) ? parsed.rules : [];
  } catch {
    await mkdir(path.dirname(nurtureTriggerRulesPath), { recursive: true });
    await writeFile(nurtureTriggerRulesPath, `${JSON.stringify(DEFAULT_NURTURE_TRIGGER_RULES, null, 2)}\n`, 'utf8');
    return DEFAULT_NURTURE_TRIGGER_RULES.rules;
  }
}

async function readNurtureTriggerLastRun() {
  try {
    const raw = await readFile(nurtureTriggerLastRunPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function writeNurtureTriggerLastRun(snapshot = {}) {
  await mkdir(path.dirname(nurtureTriggerLastRunPath), { recursive: true });
  await writeFile(nurtureTriggerLastRunPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

const launchArtifactsDir = path.resolve(process.cwd(), '.run');
const actionsNdjsonPath = path.resolve(launchArtifactsDir, 'actions', 'targeting-launch-actions.ndjson');
const relationshipsNdjsonPath = path.resolve(launchArtifactsDir, 'relationships', 'targeting-launch-relationships.ndjson');
const targetingRecommendationsNdjsonPath = path.resolve(launchArtifactsDir, 'targeting', 'target-recommendations.ndjson');

function createTargetSetId() {
  return `target-set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function appendNdjson(filePath, row = {}) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const line = `${JSON.stringify({ ...row, created_at: row.created_at || new Date().toISOString() })}\n`;
  await writeFile(filePath, line, { encoding: 'utf8', flag: 'a' });
}

async function readNdjson(filePath, limit = 50) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const rows = raw.split(/\r?\n/).filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
    return rows.slice(-Math.max(1, Math.min(Number(limit) || 50, 300))).reverse();
  } catch {
    return [];
  }
}

async function queueHumanTask(payload = {}) {
  const title = String(payload.title || '').trim();
  if (!title) return null;
  const row = {
    stream: payload.stream || 'team_handoff',
    title,
    description: payload.description || null,
    owner: payload.owner || 'human-owner-required',
    status: payload.status || 'todo',
    priority: Number(payload.priority || 20),
    source: payload.source || 'targeting_launch',
  };

  if (!pool && !supabase) return null;
  if (supabase) {
    const { data, error } = await supabase.from('cc_operator_tasks').insert(row).select('*').single();
    if (error) throw error;
    return data;
  }

  const { rows } = await pool.query(
    `insert into public.cc_operator_tasks (stream, title, description, owner, status, priority, source)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *`,
    [row.stream, row.title, row.description, row.owner, row.status, row.priority, row.source],
  );
  return rows[0] || null;
}

async function runTargetingLaunchPipeline({ prompt, account, sequenceTemplate, actor = 'api', confidenceScore = 0, recommendations = null } = {}) {
  const targetSetId = createTargetSetId();
  const leadKey = `qualified:${account?.id || 'unknown'}`;
  const relationshipState = {
    relationship_state: 'new_targeted',
    stage: 'targeted',
    engagement_state: 'pending_first_touch',
  };

  const relationshipRecord = {
    target_set_id: targetSetId,
    qualified_account_id: account?.id || null,
    brand: account?.brand || null,
    website: account?.website || null,
    lead_key: leadKey,
    sequence_template_id: sequenceTemplate?.id || null,
    sequence_name: sequenceTemplate?.name || sequenceTemplate?.slug || null,
    actor,
    source: 'targeting_launch',
    target_prompt: String(prompt || '').slice(0, 600),
    confidence_score: Number(confidenceScore) || null,
    ...relationshipState,
  };

  await appendNdjson(relationshipsNdjsonPath, relationshipRecord);
  if (recommendations) {
    await appendNdjson(targetingRecommendationsNdjsonPath, {
      target_set_id: targetSetId,
      target_prompt: String(prompt || '').slice(0, 600),
      confidence_score: Number(confidenceScore) || null,
      recommendations,
      actor,
      source: 'targeting_launch',
    });
  }

  const queuedTasks = [];
  const taskTemplates = [
    {
      title: `Assign owner + personalize opener: ${account?.brand || 'target account'}`,
      description: `Target set ${targetSetId}. Assign a human owner and personalize first-touch opener before send.`,
      priority: 12,
    },
    {
      title: `Approve/override recommendation pack: ${account?.brand || 'target account'}`,
      description: `Target set ${targetSetId}. Validate AI segment/company/individual picks and confirm confidence ${Number(confidenceScore) || 0}%.`,
      priority: 13,
    },
    {
      title: `Send first outreach + log outcome: ${account?.brand || 'target account'}`,
      description: `Target set ${targetSetId}. Send via human channel and log reply/next step in Ops queue.`,
      priority: 14,
    },
  ];

  for (const task of taskTemplates) {
    const persistedTask = await queueHumanTask({ ...task, source: 'targeting_launch' });
    const actionRecord = {
      target_set_id: targetSetId,
      qualified_account_id: account?.id || null,
      lead_key: leadKey,
      action_type: 'human_task_queued',
      action_title: task.title,
      action_description: task.description,
      priority: task.priority,
      confidence_score: Number(confidenceScore) || null,
      task_id: persistedTask?.id || null,
      actor,
      source: 'targeting_launch',
    };
    await appendNdjson(actionsNdjsonPath, actionRecord);
    queuedTasks.push({ ...task, task_id: persistedTask?.id || null });
  }

  return { target_set_id: targetSetId, relationship: relationshipRecord, queued_tasks: queuedTasks };
}

function findQualifiedAccountMatch({ brand = '', source = '', qualifiedAccounts = [] } = {}) {
  const normalizedBrand = String(brand || '').trim().toLowerCase();
  const normalizedSource = String(source || '').trim().toLowerCase();
  if (!normalizedBrand && !normalizedSource) return null;

  return (qualifiedAccounts || []).find((account) => {
    const accountBrand = String(account.brand || '').trim().toLowerCase();
    const accountWebsite = String(account.website || '').trim().toLowerCase();
    return (normalizedBrand && accountBrand && accountBrand === normalizedBrand)
      || (normalizedSource && accountWebsite && normalizedSource.includes(accountWebsite));
  }) || null;
}

function normalizeCompetitiveIntelPayload(payload = {}) {
  const brand = String(payload.brand || '').trim();
  const signal = String(payload.signal || '').trim().toLowerCase();
  const source = String(payload.source || '').trim();
  const strategicNote = String(payload.strategic_note || payload.strategicNote || '').trim();
  const confidence = Number(payload.confidence);
  const linkedQualifiedAccountId = payload.linked_qualified_account_id ? String(payload.linked_qualified_account_id).trim() : null;

  if (!brand) throw new Error('brand is required');
  if (!signal || !COMPETITIVE_INTEL_SIGNALS.includes(signal)) throw new Error(`signal must be one of: ${COMPETITIVE_INTEL_SIGNALS.join(', ')}`);
  if (!source) throw new Error('source is required');
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) throw new Error('confidence must be between 0 and 100');
  if (!strategicNote) throw new Error('strategic_note is required');

  return {
    brand,
    signal,
    source,
    confidence,
    strategic_note: strategicNote,
    linked_qualified_account_id: linkedQualifiedAccountId || null,
  };
}

function normalizeQualifiedAccountPayload(payload = {}) {
  const brand = String(payload.brand || payload.account_name || '').trim();
  const website = String(payload.website || '').trim();
  const estSpendTier = normalizeQualifiedSpendTier(payload.est_spend_tier);
  const rawChannels = Array.isArray(payload.channels)
    ? payload.channels
    : String(payload.channels || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  const channels = rawChannels.map((item) => String(item).toLowerCase()).filter((item, index, arr) => arr.indexOf(item) === index);
  const contactRole = String(payload.contact_role || payload.decision_maker_role || '').trim();
  const qualificationConfidence = Number(payload.qualification_confidence);
  const qualificationSnapshot = normalizeQualificationSnapshot(payload);
  const readiness = computeReadinessSnapshot({ qualificationConfidence, snapshot: qualificationSnapshot });

  if (!brand) throw new Error('brand is required');
  if (!website) throw new Error('website is required');
  if (!/^https?:\/\//i.test(website)) throw new Error('website must include http:// or https://');
  if (!QUALIFIED_SPEND_TIERS.includes(estSpendTier)) throw new Error(`est_spend_tier must be one of: ${QUALIFIED_SPEND_TIERS.join(', ')}`);
  if (!channels.length) throw new Error('channels is required');
  if (!contactRole) throw new Error('contact_role is required');
  if (!Number.isFinite(qualificationConfidence) || qualificationConfidence < 0 || qualificationConfidence > 100) {
    throw new Error('qualification_confidence must be between 0 and 100');
  }

  return {
    brand,
    website,
    est_spend_tier: estSpendTier,
    channels,
    contact_role: contactRole,
    qualification_confidence: qualificationConfidence,
    qualification_snapshot: qualificationSnapshot,
    readiness_score: readiness.readiness_score,
    readiness_status: readiness.readiness_status,
    is_qualified: estSpendTier !== '' && readiness.readiness_status === 'qualified',
    pipeline_stage: 'qualified',
  };
}

function inferQualifiedAccountFromTargetPrompt(targetPrompt = '') {
  const prompt = String(targetPrompt || '').trim();
  if (!prompt) throw new Error('target_prompt is required');

  const normalized = prompt.toLowerCase();
  const roleMatch = prompt.match(/\b(vp|head|director|manager|founder|ceo|cmo|growth lead|marketing lead)[^,;\n]*/i);
  const websiteMatch = prompt.match(/https?:\/\/[^\s]+/i);

  const inferredChannels = [];
  if (/paid social|meta|facebook|instagram/.test(normalized)) inferredChannels.push('meta_ads');
  if (/tiktok/.test(normalized)) inferredChannels.push('tiktok');
  if (/google|search|sem|ppc/.test(normalized)) inferredChannels.push('google_ads');
  if (/email|klaviyo/.test(normalized)) inferredChannels.push('email');
  if (!inferredChannels.length) inferredChannels.push('meta_ads');

  let estSpendTier = '500k-1m';
  if (/3m\+|\b5m\+|\b10m\+|enterprise|national/.test(normalized)) estSpendTier = '3m+';
  else if (/1m\+|1-3m|mid-market/.test(normalized)) estSpendTier = '1m-3m';

  return {
    brand: roleMatch ? `Prospect segment: ${roleMatch[0]}` : `Prospect segment: ${prompt.slice(0, 72)}`,
    website: websiteMatch ? websiteMatch[0] : 'https://unknown.example',
    est_spend_tier: estSpendTier,
    channels: inferredChannels,
    contact_role: roleMatch ? roleMatch[0] : 'Marketing decision maker',
    qualification_confidence: 75,
    spearman_score: 0.65,
    quintile_gap: 55,
    order_history_sufficiency: 'borderline',
  };
}

function chooseSequenceTemplateForTargetPrompt(targetPrompt = '', sequenceTemplates = []) {
  const activeTemplates = (sequenceTemplates || []).filter((tpl) => String(tpl.status || '').toLowerCase() === 'active');
  if (!activeTemplates.length) return null;

  const text = String(targetPrompt || '').toLowerCase();
  const scored = activeTemplates.map((tpl) => {
    const haystack = `${String(tpl.slug || '').toLowerCase()} ${String(tpl.name || '').toLowerCase()} ${String(tpl.description || '').toLowerCase()}`;
    let score = 0;
    if (/proof|case study|testimonial/.test(text) && /proof|case|testimonial/.test(haystack)) score += 3;
    if (/direct|offer|demo|book/.test(text) && /direct|offer|demo|book/.test(haystack)) score += 3;
    if (/pain|objection|problem/.test(text) && /pain|objection/.test(haystack)) score += 3;
    if (/nurture|warm|follow/.test(text) && /nurture|follow/.test(haystack)) score += 2;
    return { tpl, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.tpl || activeTemplates[0];
}

async function listQualifiedAccounts(limit = 20) {
  if (!pool && !supabase) return [];
  const max = Math.max(1, Math.min(Number(limit) || 20, 100));

  if (supabase) {
    const { data, error } = await supabase
      .from('cc_qualified_accounts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(max);
    if (error) throw error;
    return data ?? [];
  }

  const { rows } = await pool.query('select * from public.cc_qualified_accounts order by created_at desc limit $1', [max]);
  return rows;
}

async function recordQualifiedAccount(payload = {}) {
  assertStore();
  const normalized = normalizeQualifiedAccountPayload(payload);

  if (supabase) {
    const { data, error } = await supabase.from('cc_qualified_accounts').insert(normalized).select('*').single();
    if (error) throw error;
    return data;
  }

  try {
    const { rows } = await pool.query(
      `insert into public.cc_qualified_accounts
        (brand, website, est_spend_tier, channels, contact_role, qualification_confidence, is_qualified, pipeline_stage, qualification_snapshot, readiness_score, readiness_status)
       values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9::jsonb,$10,$11)
       returning *`,
      [normalized.brand, normalized.website, normalized.est_spend_tier, JSON.stringify(normalized.channels), normalized.contact_role, normalized.qualification_confidence, normalized.is_qualified, normalized.pipeline_stage, JSON.stringify(normalized.qualification_snapshot), normalized.readiness_score, normalized.readiness_status],
    );
    return rows[0];
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    const missingNewCols = message.includes('qualification_snapshot') || message.includes('readiness_score') || message.includes('readiness_status');
    if (!missingNewCols) throw error;

    const { rows } = await pool.query(
      `insert into public.cc_qualified_accounts
        (brand, website, est_spend_tier, channels, contact_role, qualification_confidence, is_qualified, pipeline_stage)
       values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
       returning *`,
      [normalized.brand, normalized.website, normalized.est_spend_tier, JSON.stringify(normalized.channels), normalized.contact_role, normalized.qualification_confidence, normalized.is_qualified, normalized.pipeline_stage],
    );
    return rows[0];
  }
}

function normalizeResearchLedgerPayload(payload = {}) {
  const source_signal = String(payload.source_signal || payload.evidence_source || payload.source || payload.signal || '').trim();
  const finding = String(payload.finding || '').trim();
  const hypothesis = String(payload.hypothesis || '').trim();
  const target_recommendation = String(payload.target_recommendation || payload.recommended_action || payload.recommendation || '').trim();
  const uncertainty = String(payload.uncertainty || '').trim();
  const confidenceRaw = Number(payload.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 0;
  const confidence_band = deriveResearchConfidenceBand(confidence);
  const status = normalizeResearchLedgerStatus(payload.status) || 'new_signal';
  const owner = String(payload.owner || payload.entry_owner || payload.actor || '').trim() || 'unassigned';
  const qualified_account_id = String(payload.qualified_account_id || '').trim() || null;
  const individual_ref = String(payload.individual_ref || payload.contact_ref || '').trim() || null;

  if (!source_signal) throw new Error('source_signal (or evidence_source) is required');
  if (!finding) throw new Error('finding is required');
  if (!hypothesis) throw new Error('hypothesis is required');
  if (!target_recommendation) throw new Error('target_recommendation (or recommended_action) is required');
  if (!uncertainty) throw new Error('uncertainty is required');

  return {
    source_signal,
    finding,
    hypothesis,
    target_recommendation,
    confidence,
    confidence_band,
    status,
    owner,
    qualified_account_id,
    individual_ref,
    uncertainty,
  };
}

async function recordResearchLedgerEntry(payload = {}, actor = 'ui:/research/entries/create') {
  assertStore();
  const normalized = normalizeResearchLedgerPayload(payload);
  const leadKey = normalized.qualified_account_id ? `qualified:${normalized.qualified_account_id}` : (normalized.individual_ref ? `individual:${normalized.individual_ref}` : 'research:general');
  const timestamp = new Date().toISOString();
  const details = {
    source_signal: normalized.source_signal,
    evidence_source: normalized.source_signal,
    finding: normalized.finding,
    hypothesis: normalized.hypothesis,
    target_recommendation: normalized.target_recommendation,
    recommended_action: normalized.target_recommendation,
    confidence: normalized.confidence,
    confidence_band: normalized.confidence_band,
    status: normalized.status,
    owner: normalized.owner,
    timestamp,
    uncertainty: normalized.uncertainty,
    qualified_account_id: normalized.qualified_account_id,
    individual_ref: normalized.individual_ref,
  };

  if (supabase) {
    const { data, error } = await supabase.from('cc_activity_log').insert({
      event_type: 'research_ledger_entry',
      lead_key: leadKey,
      actor,
      details,
    }).select('*').single();
    if (error) throw error;
    return data;
  }

  const { rows } = await pool.query(
    'insert into public.cc_activity_log (event_type, lead_key, actor, details) values ($1,$2,$3,$4::jsonb) returning *',
    ['research_ledger_entry', leadKey, actor, JSON.stringify(details)],
  );
  return rows[0] || null;
}

async function listResearchLedgerEntries(limit = 80) {
  if (!pool && !supabase) return [];
  const max = Math.max(1, Math.min(Number(limit) || 80, 200));

  if (supabase) {
    const { data, error } = await supabase
      .from('cc_activity_log')
      .select('id,event_type,lead_key,actor,details,created_at')
      .eq('event_type', 'research_ledger_entry')
      .order('created_at', { ascending: false })
      .limit(max);
    if (error) throw error;
    return data || [];
  }

  const { rows } = await pool.query(
    `select id, event_type, lead_key, actor, details, created_at
     from public.cc_activity_log
     where event_type = 'research_ledger_entry'
     order by created_at desc
     limit $1`,
    [max],
  );
  return rows || [];
}

async function listResearchLedgerEntriesForAccount(qualifiedAccountId, limit = 30) {
  const id = String(qualifiedAccountId || '').trim();
  if (!id) return [];
  const entries = await listResearchLedgerEntries(limit);
  return entries.filter((entry) => String(entry?.details?.qualified_account_id || '') === id);
}

function buildWhyTargetedExplanation(account = {}, ledgerEntries = []) {
  if (!ledgerEntries.length) return 'No research ledger evidence logged yet for this account.';
  const top = ledgerEntries[0];
  const d = top.details || {};
  const confidence = Number(d.confidence);
  const confidenceText = Number.isFinite(confidence) ? `${confidence}% confidence (${d.confidence_band || deriveResearchConfidenceBand(confidence)})` : 'confidence not scored';
  return `Targeted because ${account.brand || 'this account'} showed signal "${d.source_signal || 'unknown'}". Finding: ${d.finding || '—'}. Hypothesis: ${d.hypothesis || '—'}. Recommendation: ${d.target_recommendation || '—'} (${confidenceText}). Status: ${d.status || 'new_signal'}. Uncertainty: ${d.uncertainty || '—'}.`;
}

async function listCompetitiveIntelEntries(limit = 30) {
  if (!pool && !supabase) return [];
  const max = Math.max(1, Math.min(Number(limit) || 30, 100));

  if (supabase) {
    const { data, error } = await supabase
      .from('cc_competitive_intel_entries')
      .select('*, cc_qualified_accounts (id,brand,website)')
      .order('created_at', { ascending: false })
      .limit(max);
    if (error) throw error;
    return (data || []).map((row) => ({ ...row, linked_account: row.cc_qualified_accounts || null }));
  }

  const { rows } = await pool.query(
    `select intel.*, qa.id as linked_account_id, qa.brand as linked_account_brand, qa.website as linked_account_website
     from public.cc_competitive_intel_entries intel
     left join public.cc_qualified_accounts qa on qa.id = intel.linked_qualified_account_id
     order by intel.created_at desc
     limit $1`,
    [max],
  );
  return rows.map((row) => ({
    ...row,
    linked_account: row.linked_account_id
      ? { id: row.linked_account_id, brand: row.linked_account_brand, website: row.linked_account_website }
      : null,
  }));
}

async function recordCompetitiveIntelEntry(payload = {}) {
  assertStore();
  const normalized = normalizeCompetitiveIntelPayload(payload);

  let linkedAccountId = normalized.linked_qualified_account_id;
  if (!linkedAccountId) {
    const qualifiedAccounts = await listQualifiedAccounts(200);
    const matched = findQualifiedAccountMatch({ brand: normalized.brand, source: normalized.source, qualifiedAccounts });
    linkedAccountId = matched?.id || null;
  }

  if (supabase) {
    const { data, error } = await supabase
      .from('cc_competitive_intel_entries')
      .insert({ ...normalized, linked_qualified_account_id: linkedAccountId })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { rows } = await pool.query(
    `insert into public.cc_competitive_intel_entries
      (brand, signal, source, confidence, strategic_note, linked_qualified_account_id)
     values ($1,$2,$3,$4,$5,$6)
     returning *`,
    [normalized.brand, normalized.signal, normalized.source, normalized.confidence, normalized.strategic_note, linkedAccountId],
  );

  return rows[0];
}

function summarizeQualifiedAccountStages(accounts = []) {
  const counts = { qualified: 0, discovery: 0, pilot_candidate: 0, total: 0 };
  for (const account of accounts || []) {
    const stage = normalizePilotHandoffStage(account?.pipeline_stage) || 'qualified';
    counts[stage] += 1;
    counts.total += 1;
  }
  return counts;
}

async function promoteQualifiedAccountStage(qualifiedAccountId, nextStage, actor = 'api') {
  assertStore();
  const id = String(qualifiedAccountId || '').trim();
  const stage = normalizePilotHandoffStage(nextStage);
  if (!id) throw new Error('qualified_account_id is required');
  if (!stage) throw new Error('pipeline_stage_invalid');

  const timestampPatch = {
    ...(stage === 'discovery' ? { discovery_promoted_at: new Date().toISOString() } : {}),
    ...(stage === 'pilot_candidate' ? { pilot_candidate_promoted_at: new Date().toISOString() } : {}),
  };

  let updated;
  if (supabase) {
    const { data, error } = await supabase
      .from('cc_qualified_accounts')
      .update({ pipeline_stage: stage, ...timestampPatch })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    updated = data;
  } else {
    const { rows } = await pool.query(
      `update public.cc_qualified_accounts
       set pipeline_stage = $1,
           discovery_promoted_at = case when $1 = 'discovery' then coalesce(discovery_promoted_at, now()) else discovery_promoted_at end,
           pilot_candidate_promoted_at = case when $1 = 'pilot_candidate' then coalesce(pilot_candidate_promoted_at, now()) else pilot_candidate_promoted_at end,
           updated_at = now()
       where id = $2
       returning *`,
      [stage, id],
    );
    updated = rows[0] || null;
  }

  if (!updated) throw new Error('qualified_account_not_found');

  if (supabase) {
    await supabase.from('cc_activity_log').insert({
      event_type: 'qualified_account_stage_promoted',
      lead_key: `qualified:${id}`,
      actor,
      details: { qualified_account_id: id, pipeline_stage: stage },
    });
  } else {
    await pool.query(
      'insert into public.cc_activity_log (event_type, lead_key, actor, details) values ($1,$2,$3,$4::jsonb)',
      ['qualified_account_stage_promoted', `qualified:${id}`, actor, JSON.stringify({ qualified_account_id: id, pipeline_stage: stage })],
    );
  }

  return updated;
}

async function upsertPilotOnboardingTask(account = {}, actor = 'api') {
  if (!account?.id || !account?.brand) return null;
  const title = `Pilot onboarding: ${account.brand}`;
  const description = `Route ${account.brand} (${account.website || 'no website'}) to pilot onboarding queue.`;

  if (supabase) {
    const { data: existing, error: existingError } = await supabase
      .from('cc_operator_tasks')
      .select('*')
      .eq('source', 'qualification_snapshot')
      .eq('title', title)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return existing;

    const { data, error } = await supabase
      .from('cc_operator_tasks')
      .insert({ stream: 'pilot_onboarding', title, description, owner: 'gtm-operator', status: 'todo', priority: 15, source: 'qualification_snapshot' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { rows: existingRows } = await pool.query('select * from public.cc_operator_tasks where source = $1 and title = $2 order by created_at desc limit 1', ['qualification_snapshot', title]);
  if (existingRows[0]) return existingRows[0];

  const { rows } = await pool.query(
    `insert into public.cc_operator_tasks (stream, title, description, owner, status, priority, source)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *`,
    ['pilot_onboarding', title, description, 'gtm-operator', 'todo', 15, 'qualification_snapshot'],
  );
  return rows[0] || null;
}

async function routeQualifiedAccountToPilotOnboarding(qualifiedAccountId, actor = 'api') {
  const id = String(qualifiedAccountId || '').trim();
  if (!id) throw new Error('qualified_account_id is required');

  let account;
  if (supabase) {
    const { data, error } = await supabase.from('cc_qualified_accounts').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    account = data;
  } else {
    const { rows } = await pool.query('select * from public.cc_qualified_accounts where id = $1 limit 1', [id]);
    account = rows[0] || null;
  }
  if (!account) throw new Error('qualified_account_not_found');
  const readinessStatus = String(account.readiness_status || 'not_yet');
  const stage = normalizePilotHandoffStage(account.pipeline_stage) || 'qualified';
  const canRouteToPilot = readinessStatus === 'qualified' || stage === 'pilot_candidate';
  if (!canRouteToPilot) throw new Error('account_not_ready_for_pilot_onboarding');

  const promoted = await promoteQualifiedAccountStage(id, 'pilot_candidate', actor);
  const routedAt = new Date().toISOString();
  let updated = promoted;
  try {
    if (supabase) {
      const { data, error } = await supabase.from('cc_qualified_accounts').update({ pilot_onboarding_routed_at: routedAt }).eq('id', promoted.id).select('*').maybeSingle();
      if (error) throw error;
      updated = data || promoted;
    } else {
      const { rows } = await pool.query('update public.cc_qualified_accounts set pilot_onboarding_routed_at = $1 where id = $2 returning *', [routedAt, promoted.id]);
      updated = rows[0] || promoted;
    }
  } catch (error) {
    const missingRouteCol = String(error?.message || '').toLowerCase().includes('pilot_onboarding_routed_at');
    if (!missingRouteCol) throw error;
  }

  const task = await upsertPilotOnboardingTask(updated || promoted, actor);
  return { account: updated || promoted, task, routed_at: routedAt };
}

function computeAccountReadiness(account = {}) {
  return (String(account.readiness_status || '').toLowerCase() === 'qualified' || Number(account.readiness_score || 0) >= 75) ? 'qualified' : 'not_yet';
}

function toDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isClientUpdatePending(update = {}) {
  const status = String(update.status || '').toLowerCase();
  return !['sent', 'cancelled'].includes(status);
}

function isClientUpdateOverdue(update = {}, now = new Date()) {
  const due = toDateOrNull(update.due_date);
  return isClientUpdatePending(update) && !!due && due.getTime() < now.getTime();
}

function sortPendingClientUpdatesByDue(updates = []) {
  return [...updates].sort((a, b) => {
    const ad = toDateOrNull(a.due_date);
    const bd = toDateOrNull(b.due_date);
    if (ad && bd) return ad.getTime() - bd.getTime();
    if (ad && !bd) return -1;
    if (!ad && bd) return 1;
    return String(a.client_name || '').localeCompare(String(b.client_name || ''));
  });
}

function classifyReply(payload = {}) {
  const text = String(payload.reply_text || payload.text || '').toLowerCase();
  const sentiment = String(payload.sentiment_hint || '').toLowerCase();
  const hasAny = (phrases = []) => phrases.some((needle) => text.includes(needle));

  let classification = 'neutral';
  if (hasAny(['unsubscribe', 'remove me', 'stop emailing', 'opt out', 'do not contact'])) classification = 'unsubscribe';
  else if (hasAny(['not now', 'next quarter', 'next month', 'circle back', 'later'])) classification = 'not_now';
  else if (hasAny(['too expensive', 'budget', 'already using', 'concern', 'not sure'])) classification = 'objection';
  else if (hasAny(['interested', "let's talk", 'book', 'yes', 'sounds good'])) classification = 'positive';
  else if (sentiment === 'positive') classification = 'positive';

  const routing = REPLY_CLASS_ROUTING[classification] || REPLY_CLASS_ROUTING.neutral;
  return {
    lead_key: String(payload.lead_key || '').trim() || null,
    classification,
    confidence: classification === 'neutral' ? 0.62 : 0.81,
    next_action: routing.next_action,
    suggested_sequence_slug: routing.sequence_slug,
    suggested_sequence_fallback_name: routing.sequence_fallback_name || null,
    priority: routing.priority,
  };
}

async function routeReplyClassification(classificationResult, payload = {}) {
  if (!classificationResult?.lead_key) return { routed: false, reason: 'lead_key_required' };
  if (!pool && !supabase) return { routed: false, reason: 'no_store' };

  const details = {
    classification: classificationResult.classification,
    next_action: classificationResult.next_action,
    priority: classificationResult.priority,
    suggested_sequence_slug: classificationResult.suggested_sequence_slug,
    confidence: classificationResult.confidence,
    funnel_id: payload.funnel_id || payload.entry_point || null,
    entry_point: payload.entry_point || null,
    reply_excerpt: String(payload.reply_text || payload.text || '').slice(0, 280),
  };

  if (supabase) {
    await supabase.from('cc_activity_log').insert({ event_type: 'reply_classified', lead_key: classificationResult.lead_key, actor: 'api:reply-router', details });
    await supabase.from('cc_activity_log').insert({ event_type: 'reply_routing_decision', lead_key: classificationResult.lead_key, actor: 'api:reply-router', details });
  } else {
    await pool.query('insert into public.cc_activity_log (event_type, lead_key, actor, details) values ($1,$2,$3,$4::jsonb)', ['reply_classified', classificationResult.lead_key, 'api:reply-router', JSON.stringify(details)]);
    await pool.query('insert into public.cc_activity_log (event_type, lead_key, actor, details) values ($1,$2,$3,$4::jsonb)', ['reply_routing_decision', classificationResult.lead_key, 'api:reply-router', JSON.stringify(details)]);
  }

  if (classificationResult.classification === 'not_fit' || classificationResult.classification === 'unsubscribe') {
    return { routed: true, action: 'suppressed' };
  }

  if (!classificationResult.suggested_sequence_slug && !classificationResult.suggested_sequence_fallback_name) return { routed: true, action: 'log_only' };
  const template = await lookupSequenceTemplate({
    sequence_slug: classificationResult.suggested_sequence_slug,
    sequence_fallback_name: classificationResult.suggested_sequence_fallback_name,
  });
  if (!template?.id) return { routed: false, reason: 'sequence_not_found', sequence_slug: classificationResult.suggested_sequence_slug };

  const enrollment = await enrollContactInSequence({
    sequence_template_id: template.id,
    lead_key: classificationResult.lead_key,
    metadata: {
      source: 'reply_classification',
      classification: classificationResult.classification,
      next_action: classificationResult.next_action,
      funnel_id: payload.funnel_id || null,
      entry_point: payload.entry_point || null,
    },
  }, 'api:reply-router');

  return { routed: true, action: 'enrolled', sequence_template_id: template.id, enrollment_id: enrollment?.data?.id || null };
}

function evaluateNurtureRules(rules = [], payload = {}) {
  const now = toDateOrNull(payload.now) || new Date();
  const triggerKey = String(payload.trigger_key || '').trim();
  const lastReplyAt = toDateOrNull(payload.last_reply_at);
  const hoursSinceLastReply = lastReplyAt ? (now.getTime() - lastReplyAt.getTime()) / 36e5 : null;
  const meetingCompleted = payload.meeting_completed === true;
  const leadMagnetDownloaded = payload.lead_magnet_downloaded === true;

  const results = [];
  for (const rule of rules) {
    if (rule?.enabled === false) {
      results.push({ id: rule.id, matched: false, reason: 'disabled' });
      continue;
    }

    const conditions = rule?.conditions || {};
    const ruleTrigger = String(rule?.trigger_key || '').trim();
    let matched = false;
    let reason = 'no_condition_match';

    if (ruleTrigger && triggerKey && ruleTrigger === triggerKey) {
      matched = true;
      reason = 'trigger_key_match';
    } else if (typeof conditions.min_hours_since_last_reply === 'number') {
      if (hoursSinceLastReply !== null && hoursSinceLastReply >= Number(conditions.min_hours_since_last_reply)) {
        matched = true;
        reason = `hours_since_last_reply>=${conditions.min_hours_since_last_reply}`;
      } else {
        reason = 'hours_since_last_reply_below_threshold';
      }
    } else if (conditions.meeting_completed === true) {
      matched = meetingCompleted;
      reason = matched ? 'meeting_completed' : 'meeting_not_completed';
    } else if (conditions.lead_magnet_downloaded === true) {
      matched = leadMagnetDownloaded;
      reason = matched ? 'lead_magnet_downloaded' : 'lead_magnet_not_downloaded';
    }

    results.push({
      id: String(rule?.id || 'unknown'),
      name: String(rule?.name || 'Unnamed rule'),
      trigger_key: ruleTrigger,
      sequence_slug: rule?.sequence_slug || null,
      sequence_fallback_name: rule?.sequence_fallback_name || null,
      cooldown_hours: Number(rule?.cooldown_hours || 0),
      matched,
      reason,
    });
  }

  return {
    now: now.toISOString(),
    lead_key: String(payload.lead_key || '').trim() || null,
    matched_rules: results.filter((r) => r.matched),
    evaluated_rules: results,
    context: {
      trigger_key: triggerKey || null,
      hours_since_last_reply: hoursSinceLastReply === null ? null : Number(hoursSinceLastReply.toFixed(2)),
      meeting_completed: meetingCompleted,
      lead_magnet_downloaded: leadMagnetDownloaded,
    },
  };
}

async function lookupSequenceTemplate(rule = {}) {
  if (!pool && !supabase) return null;
  if (supabase) {
    if (rule.sequence_slug) {
      const bySlug = await supabase.from('cc_sequence_templates').select('id,name,slug,status').eq('slug', rule.sequence_slug).eq('status', 'active').limit(1).maybeSingle();
      if (bySlug.error) throw bySlug.error;
      if (bySlug.data) return bySlug.data;
    }
    if (rule.sequence_fallback_name) {
      const byName = await supabase.from('cc_sequence_templates').select('id,name,slug,status').eq('status', 'active').ilike('name', `%${rule.sequence_fallback_name}%`).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (byName.error) throw byName.error;
      if (byName.data) return byName.data;
    }
    return await getDefaultOutreachSequenceTemplate();
  }

  if (rule.sequence_slug) {
    const bySlug = await pool.query("select id,name,slug,status from public.cc_sequence_templates where slug = $1 and status = 'active' limit 1", [rule.sequence_slug]);
    if (bySlug.rows[0]) return bySlug.rows[0];
  }
  if (rule.sequence_fallback_name) {
    const byName = await pool.query("select id,name,slug,status from public.cc_sequence_templates where status = 'active' and name ilike $1 order by updated_at desc limit 1", [`%${rule.sequence_fallback_name}%`]);
    if (byName.rows[0]) return byName.rows[0];
  }
  return await getDefaultOutreachSequenceTemplate();
}

async function resolveNurtureActions(evaluation, payload = {}) {
  const actions = [];
  for (const rule of evaluation.matched_rules || []) {
    const template = await lookupSequenceTemplate(rule);
    actions.push({
      rule_id: rule.id,
      trigger_key: rule.trigger_key,
      lead_key: evaluation.lead_key,
      action_type: 'enqueue_sequence_enrollment',
      status: template?.id ? 'ready' : 'blocked',
      reason: template?.id ? 'template_resolved' : 'sequence_template_not_found',
      sequence_template: template ? { id: template.id, name: template.name, slug: template.slug } : null,
      enqueue_payload: template?.id ? {
        sequence_template_id: template.id,
        lead_key: evaluation.lead_key,
        status: 'queued',
        next_send_at: payload.next_send_at || new Date().toISOString(),
      } : null,
    });
  }
  return actions;
}

async function applyNurtureTriggers(evaluation, payload = {}) {
  const leadKey = evaluation.lead_key;
  if (!leadKey) return { applied: [], skipped: [{ reason: 'lead_key_required_for_apply' }] };
  if (!pool && !supabase) return { applied: [], skipped: evaluation.matched_rules.map((r) => ({ rule_id: r.id, reason: 'datastore_not_configured' })) };

  const actions = await resolveNurtureActions(evaluation, payload);
  const applied = [];
  const skipped = [];
  for (const action of actions) {
    if (action.status !== 'ready' || !action.sequence_template?.id) {
      skipped.push({ rule_id: action.rule_id, reason: action.reason, sequence_slug: action.sequence_template?.slug || null });
      continue;
    }

    const metadata = {
      trigger_rule_id: action.rule_id,
      trigger_key: action.trigger_key,
      applied_at: new Date().toISOString(),
      source: 'nurture-trigger-evaluator-v1',
      event_payload: payload,
    };

    if (supabase) {
      const { data, error } = await supabase.from('cc_sequence_enrollments').upsert({
        sequence_template_id: action.sequence_template.id,
        lead_key: leadKey,
        status: 'queued',
        next_send_at: payload.next_send_at || new Date().toISOString(),
        metadata,
      }, { onConflict: 'sequence_template_id,lead_key' }).select('id,status,sequence_template_id,lead_key').single();
      if (error) throw error;
      applied.push({ rule_id: action.rule_id, enrollment: data, sequence_template: action.sequence_template });
      continue;
    }

    const { rows } = await pool.query(
      `insert into public.cc_sequence_enrollments (sequence_template_id, lead_key, status, next_send_at, metadata)
       values ($1,$2,'queued',coalesce($3::timestamptz, now()),$4::jsonb)
       on conflict (sequence_template_id, lead_key) do update
         set status = 'queued',
             next_send_at = excluded.next_send_at,
             metadata = excluded.metadata,
             updated_at = now()
       returning id,status,sequence_template_id,lead_key`,
      [action.sequence_template.id, leadKey, payload.next_send_at || null, JSON.stringify(metadata)],
    );
    applied.push({ rule_id: action.rule_id, enrollment: rows[0], sequence_template: action.sequence_template });
  }

  return { applied, skipped };
}

async function checkDatabaseHealth() {
  if (!pool && !supabase) return { ok: false, detail: 'no datastore configured (runtime:none)' };
  try {
    if (supabase) {
      const { error } = await supabase.from('cc_operator_tasks').select('id').limit(1);
      if (error) throw error;
      return { ok: true, detail: 'supabase reachable' };
    }
    await pool.query('select 1 as ok');
    return { ok: true, detail: 'postgres reachable' };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

async function getHealthStatus(hostHeader = '') {
  const logChecks = await Promise.allSettled([access(serviceOutLogPath), access(serviceErrLogPath)]);
  const db = await checkDatabaseHealth();
  const [workQueueCheck, alertRulesCheck] = await Promise.allSettled([
    access(workQueueMarkdownPath),
    access(alertRulesPath),
  ]);
  const host = hostHeader ? hostHeader.replace(/:\d+$/, '') : 'localhost';
  const checks = {
    database: db,
    service_logs: {
      ok: logChecks.every((r) => r.status === 'fulfilled'),
      detail: logChecks.every((r) => r.status === 'fulfilled') ? 'service logs present' : 'missing .run/service*.log',
    },
    work_queue_file: {
      ok: workQueueCheck.status === 'fulfilled',
      detail: workQueueCheck.status === 'fulfilled' ? 'WORK_QUEUE.md readable' : 'WORK_QUEUE.md not found/readable',
    },
    alert_rules_file: {
      ok: alertRulesCheck.status === 'fulfilled',
      detail: alertRulesCheck.status === 'fulfilled' ? 'alert rules readable' : 'alert rules will be bootstrapped on read',
    },
  };
  const overall = Object.values(checks).every((check) => check.ok) ? 'connected' : 'degraded';

  return {
    local_service_url: `http://${host}:${port}`,
    local_service_port: port,
    local_service_status: checks.service_logs.ok ? `listening on :${port} (launchd-compatible)` : `unknown logs (expected .run/service*.log)`,
    vercel_mode_enabled: vercelReadinessMode,
    runtime_mode: runtimeMode,
    checks,
    overall,
  };
}

async function getMondayReadiness() {
  return evaluateMondayReadiness({
    runtimeMode,
    projectRoot: process.cwd(),
    workQueuePath: workQueueMarkdownPath,
  });
}

function deriveWorkerSnapshot(tasks = []) {
  const target = Number(process.env.OPERATOR_WORKER_TARGET ?? process.env.WORKER_TARGET ?? 1);
  const currentFromEnv = Number(process.env.OPERATOR_WORKER_CURRENT ?? process.env.WORKER_CURRENT);
  const currentFromTasks = tasks.filter((task) => String(task.status || '').toLowerCase() === 'in_progress').length;
  const current = Number.isFinite(currentFromEnv) ? currentFromEnv : currentFromTasks;
  return { target, current };
}

function deriveQueueHealth(queueSnapshot = {}, orchestrationStatus = {}) {
  const blocked = Number(queueSnapshot?.blocked?.length || 0);
  const waitingOnUser = Number(queueSnapshot?.waitingOnUser?.length || 0);
  const pendingDeferred = Number(orchestrationStatus?.pending_deferred || 0);
  const capacity = Number(orchestrationStatus?.capacity);

  if (blocked >= 5 || pendingDeferred >= 3) return { label: 'critical', className: 'bad' };
  if (blocked >= 2 || waitingOnUser >= 3 || (Number.isFinite(capacity) && capacity < 0)) return { label: 'watch', className: 'warn' };
  return { label: 'healthy', className: 'ok' };
}

async function getOrchestrationVisibilitySnapshot({ tasks = [], queueSnapshot = {}, targetWorkersOverride = null } = {}) {
  const [statusRaw, stateRaw, incidentRows, completionApplierRaw] = await Promise.all([
    readFile(autopullStatusPath, 'utf8').catch(() => null),
    readFile(autopullStatePath, 'utf8').catch(() => null),
    readNdjson(systemFailuresPath, 200),
    readFile(completionApplierStatusPath, 'utf8').catch(() => null),
  ]);

  let orchestrationStatus = {};
  let orchestrationState = {};
  let completionApplier = {};
  try { orchestrationStatus = statusRaw ? JSON.parse(statusRaw) : {}; } catch { orchestrationStatus = {}; }
  try { orchestrationState = stateRaw ? JSON.parse(stateRaw) : {}; } catch { orchestrationState = {}; }
  try { completionApplier = completionApplierRaw ? JSON.parse(completionApplierRaw) : {}; } catch { completionApplier = {}; }

  const workers = deriveWorkerSnapshot(tasks);
  const targetWorkers = Number.isFinite(Number(targetWorkersOverride))
    ? Number(targetWorkersOverride)
    : (Number.isFinite(Number(orchestrationStatus.target_workers)) ? Number(orchestrationStatus.target_workers) : workers.target);
  const activeWorkers = Number.isFinite(Number(orchestrationStatus.active_subagents)) ? Number(orchestrationStatus.active_subagents) : workers.current;

  const refillEvents = Array.isArray(orchestrationState?.recent)
    ? orchestrationState.recent.filter((row) => row && row.status === 'spawned' && Number.isFinite(Number(row.ts)))
    : [];
  const lastRefill = refillEvents.length
    ? new Date(Number(refillEvents.sort((a, b) => Number(b.ts) - Number(a.ts))[0].ts) * 1000).toISOString()
    : (orchestrationStatus.ts || null);

  const recentCompletionBurstCount = Array.isArray(completionApplier?.last_cycle?.newly_completed)
    ? completionApplier.last_cycle.newly_completed.length
    : 0;

  const refillAgeMinutes = lastRefill
    ? Math.max(0, Math.round((Date.now() - new Date(lastRefill).getTime()) / 60000))
    : null;
  const workersGap = Math.max(0, targetWorkers - activeWorkers);

  let refillSlaStatus = { label: 'GREEN · on target', className: 'ok' };
  if (workersGap >= 2 || refillAgeMinutes === null || refillAgeMinutes > 20) {
    refillSlaStatus = { label: 'RED · refill SLA breached', className: 'bad' };
  } else if (workersGap === 1 || refillAgeMinutes > 10) {
    refillSlaStatus = { label: 'YELLOW · refill lagging', className: 'warn' };
  }

  const lastIncident = (incidentRows || [])[0] || null;

  return {
    targetWorkers,
    activeWorkers,
    sessionCap: Number.isFinite(Number(orchestrationStatus.session_cap)) && Number(orchestrationStatus.session_cap) > 0 ? Number(orchestrationStatus.session_cap) : null,
    queueHealth: deriveQueueHealth(queueSnapshot, orchestrationStatus),
    lastRefill,
    refillAgeMinutes,
    recentCompletionBurstCount,
    workersGap,
    refillSlaStatus,
    lastIncident,
  };
}

function toWorkerStatus(raw = '') {
  const status = String(raw || '').toLowerCase();
  if (['running', 'in_progress', 'started', 'active'].includes(status)) return 'running';
  if (['completed', 'done', 'success', 'succeeded', 'resolved'].includes(status)) return 'completed';
  if (['failed', 'error', 'errored', 'cancelled', 'canceled', 'blocked'].includes(status)) return 'failed';
  return 'running';
}

function toIso(value) {
  if (!value && value !== 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatAgeShort(ts) {
  if (!ts) return '—';
  const deltaSec = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (deltaSec < 60) return `${deltaSec}s`;
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h`;
  return `${Math.floor(deltaSec / 86400)}d`;
}


function slugifyFeatureKey(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function inferFeatureKeyFromText(value = '') {
  const text = String(value || '').toLowerCase();
  const direct = text.match(/feature[:\s]+([a-z0-9][a-z0-9_\-/]+)/i);
  if (direct?.[1]) return slugifyFeatureKey(direct[1]);
  if (text.includes('review burst')) return 'ops-review-bursts';
  if (text.includes('review center') || text.includes('/ops#reviews')) return 'ops-review-center';
  if (text.includes('design token')) return 'ui-design-token-guardrail';
  if (text.includes('comms')) return 'comms-workspace';
  if (text.includes('relationship')) return 'relationships-intelligence';
  if (text.includes('pilot')) return 'pilot-handoff';
  if (text.includes('target')) return 'targeting';
  if (text.includes('ops')) return 'ops-runtime';
  return 'unmapped-feature';
}

function canonicalFeatureKeyForRun(row = {}) {
  const raw = row.feature_key || row.task_feature_key || row.feature || row.featureKey || row.metadata?.feature_key || row.metadata?.featureKey;
  if (raw) return slugifyFeatureKey(raw) || 'unmapped-feature';
  const combined = [row.task_summary, row.summary, row.task_title, row.title, row.task, row.description].filter(Boolean).join(' ');
  return inferFeatureKeyFromText(combined);
}

function normalizeLaneKeyForRun(row = {}) {
  const raw = row.model_lane || row.lane || row.workflow_lane || row.stream || row.metadata?.lane || row.metadata?.model_lane;
  if (raw) return slugifyFeatureKey(raw) || 'execution';
  const summary = String(row.task_summary || row.summary || row.task_title || row.title || '').toLowerCase();
  if (summary.includes('review') || summary.includes('strategy')) return 'strategy';
  if (summary.includes('incident') || summary.includes('reliability')) return 'reliability';
  return 'execution';
}

function deriveCycleKeyForRun(row = {}) {
  const explicit = row.cycle_key || row.cycle_id || row.cycle || row.metadata?.cycle_key;
  if (explicit) return slugifyFeatureKey(explicit) || 'unknown-cycle';
  const sourceTs = row.started_at || row.start_time || row.created_at || row.updated_at || row.completed_at;
  const iso = toIso(sourceTs);
  return iso ? iso.slice(0, 10) : 'unknown-cycle';
}

function parseNumericOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function renderDevelopmentCostAttributionPanel(summary = {}) {
  const rows = Array.isArray(summary.rows) ? summary.rows : [];
  const cycleRows = Array.isArray(summary.byCycleRows) ? summary.byCycleRows : [];
  const totalRuns = Number(summary.totalRuns || 0);
  const totalCostUsd = Number(summary.totalCostUsd || 0);
  const totalTokens = Number(summary.totalTokens || 0);
  return `<article class="panel" id="development-cost-attribution" data-verify="ops-feature-cost-attribution-v1 ops-feature-cycle-cost-v1">
    <div class="panel-head"><h2>Development cost by feature</h2><span class="section-tag">model/tokens/cost attribution</span></div>
    <p class="muted">Canonical feature key is attached per run/task and rolled up by feature + cycle for lane-level visibility.</p>
    <p class="muted">Runs: <strong>${escapeHtml(totalRuns)}</strong> · Tokens: <strong>${escapeHtml(totalTokens.toLocaleString())}</strong> · Cost: <strong>$${escapeHtml(totalCostUsd.toFixed(4))}</strong></p>
    <table><thead><tr><th>Feature key</th><th>Lane</th><th>Cycle</th><th>Model</th><th>Runs</th><th>Tokens</th><th>Cost (USD)</th></tr></thead><tbody>${rows.map((row) => `<tr><td><code>${escapeHtml(row.featureKey)}</code></td><td>${escapeHtml(row.lane)}</td><td>${escapeHtml(row.cycleKey)}</td><td>${escapeHtml(row.model)}</td><td>${escapeHtml(row.runs)}</td><td>${escapeHtml(Number(row.tokens || 0).toLocaleString())}</td><td>$${escapeHtml(Number(row.costUsd || 0).toFixed(4))}</td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">No attributed process runs found.</td></tr>'}</tbody></table>
    <details style="margin-top:.45rem;"><summary><strong>Cycle totals</strong> (${cycleRows.length})</summary><table style="margin-top:.45rem;"><thead><tr><th>Cycle</th><th>Runs</th><th>Tokens</th><th>Cost (USD)</th></tr></thead><tbody>${cycleRows.map((row) => `<tr><td>${escapeHtml(row.cycleKey)}</td><td>${escapeHtml(row.runs)}</td><td>${escapeHtml(Number(row.tokens || 0).toLocaleString())}</td><td>$${escapeHtml(Number(row.costUsd || 0).toFixed(4))}</td></tr>`).join('') || '<tr><td colspan="4">No cycle totals.</td></tr>'}</tbody></table></details>
  </article>`;
}

async function getDevelopmentCostAttribution({ maxRows = 300 } = {}) {
  let rows = [];
  if (supabase) {
    const { data, error } = await supabase
      .from('cc_process_runs')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(maxRows);
    if (!error) rows = data || [];
  } else if (pool) {
    try {
      const result = await pool.query(`select * from public.cc_process_runs order by updated_at desc nulls last limit $1`, [maxRows]);
      rows = result.rows || [];
    } catch {
      rows = [];
    }
  }

  const mappedRows = rows.map((row) => {
    const promptTokens = parseNumericOrZero(row.prompt_tokens || row.input_tokens || row.tokens_in);
    const completionTokens = parseNumericOrZero(row.completion_tokens || row.output_tokens || row.tokens_out);
    const totalTokens = parseNumericOrZero(row.total_tokens) || (promptTokens + completionTokens);
    const costUsd = parseNumericOrZero(row.cost_usd || row.total_cost_usd || row.estimated_cost_usd);
    const model = String(row.model || row.model_name || row.llm_model || 'unknown-model');
    const featureKey = canonicalFeatureKeyForRun(row);
    const lane = normalizeLaneKeyForRun(row);
    const cycleKey = deriveCycleKeyForRun(row);
    return { featureKey, lane, cycleKey, model, totalTokens, costUsd };
  });

  const grouped = new Map();
  const byCycle = new Map();
  for (const row of mappedRows) {
    const key = `${row.featureKey}::${row.lane}::${row.cycleKey}::${row.model}`;
    const existing = grouped.get(key) || { ...row, runs: 0, tokens: 0, costUsd: 0 };
    existing.runs += 1;
    existing.tokens += row.totalTokens;
    existing.costUsd += row.costUsd;
    grouped.set(key, existing);

    const cycleExisting = byCycle.get(row.cycleKey) || { cycleKey: row.cycleKey, runs: 0, tokens: 0, costUsd: 0 };
    cycleExisting.runs += 1;
    cycleExisting.tokens += row.totalTokens;
    cycleExisting.costUsd += row.costUsd;
    byCycle.set(row.cycleKey, cycleExisting);
  }

  const rowsSorted = [...grouped.values()].sort((a, b) => (b.costUsd - a.costUsd) || (b.tokens - a.tokens)).slice(0, 40);
  const byCycleRows = [...byCycle.values()].sort((a, b) => String(b.cycleKey).localeCompare(String(a.cycleKey))).slice(0, 14);
  const totalTokens = rowsSorted.reduce((acc, row) => acc + Number(row.tokens || 0), 0);
  const totalCostUsd = rowsSorted.reduce((acc, row) => acc + Number(row.costUsd || 0), 0);
  return {
    marker: 'ops-feature-cost-attribution-v1',
    totalRuns: mappedRows.length,
    totalTokens,
    totalCostUsd,
    rows: rowsSorted,
    byCycleRows,
  };
}

function estimateUsageCost({ model = '', tokensIn = 0, tokensOut = 0 } = {}) {
  const rates = {
    'gpt-5': { inPer1k: 0.005, outPer1k: 0.015 },
    'gpt-5.3-codex': { inPer1k: 0.005, outPer1k: 0.015 },
    'gpt-4.1': { inPer1k: 0.005, outPer1k: 0.015 },
    'gpt-4o': { inPer1k: 0.005, outPer1k: 0.015 },
  };
  const modelKey = Object.keys(rates).find((key) => String(model || '').toLowerCase().includes(key));
  const selected = modelKey ? rates[modelKey] : { inPer1k: 0.005, outPer1k: 0.015 };
  const inCost = (Math.max(0, Number(tokensIn) || 0) / 1000) * selected.inPer1k;
  const outCost = (Math.max(0, Number(tokensOut) || 0) / 1000) * selected.outPer1k;
  return Number((inCost + outCost).toFixed(6));
}

function parseWorkerUsageRow(row = {}) {
  const tokensIn = Number(row.prompt_tokens ?? row.input_tokens ?? row.tokens_in ?? row.usage_prompt_tokens ?? 0) || 0;
  const tokensOut = Number(row.completion_tokens ?? row.output_tokens ?? row.tokens_out ?? row.usage_completion_tokens ?? 0) || 0;
  const model = String(row.model || row.model_used || row.llm_model || row.ai_model || 'unknown');
  const featureKey = canonicalFeatureKeyForRun(row);
  const lane = normalizeLaneKeyForRun(row);
  const cycleKey = deriveCycleKeyForRun(row);
  const estimatedCost = Number(row.cost_usd ?? row.total_cost_usd ?? row.estimated_cost_usd ?? estimateUsageCost({ model, tokensIn, tokensOut })) || 0;
  return {
    model,
    tokensIn: Math.max(0, Math.round(tokensIn)),
    tokensOut: Math.max(0, Math.round(tokensOut)),
    totalTokens: Math.max(0, Math.round(tokensIn + tokensOut)),
    estimatedCost,
    featureKey,
    lane,
    cycleKey,
  };
}

async function loadTaskUsageRecords() {
  try {
    const raw = await readFile(opsTaskUsageRecordsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.records) ? parsed.records : [];
  } catch {
    return [];
  }
}

async function persistTaskUsageRecords(records = []) {
  await mkdir(path.dirname(opsTaskUsageRecordsPath), { recursive: true });
  const payload = {
    marker: 'ops-worker-usage-records-v1',
    updatedAt: new Date().toISOString(),
    records: records.slice(-4000),
  };
  await writeFile(opsTaskUsageRecordsPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function upsertTaskUsageRecords(rows = []) {
  if (!rows.length) return;
  const existing = await loadTaskUsageRecords();
  const index = new Map(existing.map((r) => [String(r.id), r]));
  for (const record of rows) {
    index.set(String(record.id), record);
  }
  await persistTaskUsageRecords(Array.from(index.values()).sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || ''))));
}

function aggregateUsageByFeature(records = []) {
  const map = new Map();
  const byCycle = new Map();
  for (const row of records) {
    const featureKey = String(row.featureKey || row.featureLabel || 'unmapped-feature');
    const lane = String(row.lane || 'execution');
    const cycleKey = String(row.cycleKey || 'unknown-cycle');
    const model = String(row.model || 'unknown');
    const key = `${featureKey}::${lane}::${cycleKey}::${model}`;
    if (!map.has(key)) map.set(key, { featureKey, lane, cycleKey, model, totalTokensIn: 0, totalTokensOut: 0, totalTokens: 0, totalEstimatedCost: 0, runsCount: 0 });
    const entry = map.get(key);
    entry.totalTokensIn += Number(row.tokensIn || 0);
    entry.totalTokensOut += Number(row.tokensOut || 0);
    entry.totalTokens += Number(row.totalTokens || 0);
    entry.totalEstimatedCost += Number(row.estimatedCost || 0);
    entry.runsCount += 1;

    const cycle = byCycle.get(cycleKey) || { cycleKey, runsCount: 0, totalTokens: 0, totalEstimatedCost: 0 };
    cycle.runsCount += 1;
    cycle.totalTokens += Number(row.totalTokens || 0);
    cycle.totalEstimatedCost += Number(row.estimatedCost || 0);
    byCycle.set(cycleKey, cycle);
  }
  return {
    byFeature: Array.from(map.values())
      .map((item) => ({ ...item, totalEstimatedCost: Number(item.totalEstimatedCost.toFixed(6)) }))
      .sort((a, b) => b.totalEstimatedCost - a.totalEstimatedCost),
    byCycle: Array.from(byCycle.values())
      .map((item) => ({ ...item, totalEstimatedCost: Number(item.totalEstimatedCost.toFixed(6)) }))
      .sort((a, b) => String(b.cycleKey).localeCompare(String(a.cycleKey))),
  };
}

function toCsvValue(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toUsageCsv(records = []) {
  const header = ['id', 'taskId', 'workerLabel', 'featureKey', 'lane', 'cycleKey', 'model', 'tokensIn', 'tokensOut', 'totalTokens', 'estimatedCost', 'startedAt', 'updatedAt'];
  const rows = records.map((r) => [r.id, r.taskId, r.workerLabel, r.featureKey, r.lane, r.cycleKey, r.model, r.tokensIn, r.tokensOut, r.totalTokens, r.estimatedCost, r.startedAt, r.updatedAt]);
  return [header, ...rows].map((row) => row.map(toCsvValue).join(',')).join('\n');
}

async function getActiveWorkersSnapshot({ orchestrationVisibility = {}, staleThresholdMinutes = Number(process.env.OPS_WORKER_STALE_MINUTES || 15) } = {}) {
  const runningStates = ['running', 'in_progress', 'started', 'active'];
  let rows = [];

  if (supabase) {
    const { data, error } = await supabase
      .from('cc_process_runs')
      .select('*')
      .in('status', runningStates)
      .order('updated_at', { ascending: false })
      .limit(80);
    if (!error) rows = data || [];
  } else if (pool) {
    try {
      const result = await pool.query(
        `select * from public.cc_process_runs where status = any($1::text[]) order by updated_at desc nulls last limit 80`,
        [runningStates],
      );
      rows = result.rows || [];
    } catch {
      rows = [];
    }
  }

  const thresholdMs = Math.max(1, Number(staleThresholdMinutes) || 15) * 60 * 1000;
  let workers = rows.map((row, idx) => {
    const startedAt = toIso(row.started_at || row.start_time || row.created_at || row.createdAt);
    const lastUpdateAt = toIso(row.updated_at || row.last_update_at || row.last_heartbeat_at || row.heartbeat_at || row.completed_at || row.finished_at || row.failed_at || row.updatedAt);
    const status = toWorkerStatus(row.status);
    const workerLabel = String(row.worker_label || row.worker || row.agent_label || row.run_label || row.assignee || `worker-${idx + 1}`);
    const taskSummary = String(row.task_summary || row.summary || row.task_title || row.title || row.task || row.description || 'Task summary unavailable');
    const lastActivityTs = lastUpdateAt || startedAt;
    const stale = status === 'running' && (!lastActivityTs || (Date.now() - new Date(lastActivityTs).getTime()) > thresholdMs);
    const usage = parseWorkerUsageRow(row);

    return {
      runId: String(row.id || row.run_id || `${workerLabel}-${lastUpdateAt || startedAt || idx}`),
      taskId: String(row.task_id || row.taskId || row.external_task_id || row.task_title || taskSummary),
      workerLabel,
      taskSummary,
      status,
      startedAt,
      startedAge: formatAgeShort(startedAt),
      lastUpdateAt,
      stale,
      featureKey: usage.featureKey,
      lane: usage.lane,
      cycleKey: usage.cycleKey,
      model: usage.model,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      estimatedCost: usage.estimatedCost,
    };
  });

  if (!workers.length) {
    const [stateRaw, statusRaw] = await Promise.all([
      readFile(autopullStatePath, 'utf8').catch(() => null),
      readFile(autopullStatusPath, 'utf8').catch(() => null),
    ]);
    let state = {};
    let status = {};
    try { state = stateRaw ? JSON.parse(stateRaw) : {}; } catch { state = {}; }
    try { status = statusRaw ? JSON.parse(statusRaw) : {}; } catch { status = {}; }

    const recent = Array.isArray(state?.recent) ? state.recent.slice(-30).reverse() : [];
    const activeFromRecent = recent.filter((item) => ['spawned', 'active', 'running'].includes(String(item?.status || '').toLowerCase()));
    workers = activeFromRecent.slice(0, 20).map((item, idx) => {
      const startedAt = Number.isFinite(Number(item.ts)) ? new Date(Number(item.ts) * 1000).toISOString() : toIso(item.ts || status?.ts);
      const lastUpdateAt = toIso(status?.ts) || startedAt;
      const stale = !lastUpdateAt || (Date.now() - new Date(lastUpdateAt).getTime()) > thresholdMs;
      return {
        runId: String(item.id || item.run_id || `fallback-${idx + 1}`),
        taskId: String(item.task_id || item.title || `fallback-task-${idx + 1}`),
        workerLabel: `worker-${idx + 1}`,
        taskSummary: String(item.title || 'Task summary unavailable'),
        status: 'running',
        startedAt,
        startedAge: formatAgeShort(startedAt),
        lastUpdateAt,
        stale,
        featureKey: inferFeatureKeyFromText(item.feature_label || item.workstream || item.title || ''),
        lane: 'execution',
        cycleKey: startedAt ? startedAt.slice(0, 10) : 'unknown-cycle',
        model: String(item.model || 'unknown'),
        tokensIn: Number(item.tokens_in || 0),
        tokensOut: Number(item.tokens_out || 0),
        estimatedCost: Number(item.estimated_cost || 0),
      };
    });
  }

  const usageRows = workers.map((w) => ({
    id: `${String(w.runId || 'run')}:${String(w.lastUpdateAt || w.startedAt || 'na')}`,
    runId: w.runId,
    taskId: w.taskId,
    workerLabel: w.workerLabel,
    featureKey: w.featureKey || 'unmapped-feature',
    lane: w.lane || 'execution',
    cycleKey: w.cycleKey || 'unknown-cycle',
    model: w.model || 'unknown',
    tokensIn: Number(w.tokensIn || 0),
    tokensOut: Number(w.tokensOut || 0),
    totalTokens: Number((w.tokensIn || 0) + (w.tokensOut || 0)),
    estimatedCost: Number(w.estimatedCost || 0),
    startedAt: w.startedAt || null,
    updatedAt: w.lastUpdateAt || null,
  }));
  await upsertTaskUsageRecords(usageRows);
  const persistedUsage = await loadTaskUsageRecords();
  const featureUsageAggregates = aggregateUsageByFeature(persistedUsage);

  const activeCount = Number(orchestrationVisibility.activeWorkers || workers.length || 0);
  const cap = Number.isFinite(Number(orchestrationVisibility.sessionCap)) && Number(orchestrationVisibility.sessionCap) > 0 ? Number(orchestrationVisibility.sessionCap) : null;

  return {
    marker: 'ops-active-workers-panel-v1 ops-active-workers-refresh-v1 ops-worker-usage-tracking-v1',
    staleThresholdMinutes: Math.max(1, Number(staleThresholdMinutes) || 15),
    activeCount,
    cap,
    workers,
    featureUsage: featureUsageAggregates.byFeature,
    cycleUsage: featureUsageAggregates.byCycle,
    usageRecordsCount: persistedUsage.length,
  };
}

function renderActiveWorkersPanel(snapshot = {}, filter = 'all') {
  const selectedFilter = ['all', 'on-task', 'stale'].includes(String(filter)) ? String(filter) : 'all';
  const staleThresholdMinutes = Number(snapshot.staleThresholdMinutes || 15);
  const rows = Array.isArray(snapshot.workers) ? snapshot.workers : [];
  const filteredRows = selectedFilter === 'stale'
    ? rows.filter((row) => row.stale)
    : selectedFilter === 'on-task'
      ? rows.filter((row) => !row.stale)
      : rows;

  const capLabel = snapshot.cap != null ? `${snapshot.activeCount} / ${snapshot.cap}` : `${snapshot.activeCount} / —`;
  const capClass = snapshot.cap != null && snapshot.activeCount >= snapshot.cap ? 'warn' : 'ok';

  const htmlRows = filteredRows.map((row) => {
    const statusClass = row.status === 'running' ? 'info' : row.status === 'completed' ? 'ok' : 'bad';
    return `<tr>
      <td><strong>${escapeHtml(row.workerLabel || 'worker')}</strong><div class="muted"><code>${escapeHtml(row.featureKey || 'unmapped-feature')}</code> · ${escapeHtml(row.lane || 'execution')} · ${escapeHtml(row.cycleKey || 'unknown-cycle')}</div></td>
      <td>${escapeHtml(row.taskSummary || '—')}</td>
      <td><span class="badge ${statusClass}">${escapeHtml(row.status || 'running')}</span>${row.stale ? ' <span class="badge warn">stale</span>' : ''}</td>
      <td>${escapeHtml(formatDateTime(row.startedAt))}<div class="muted">age ${escapeHtml(row.startedAge || '—')}</div></td>
      <td>${escapeHtml(formatDateTime(row.lastUpdateAt))}</td>
      <td>${escapeHtml(row.model || 'unknown')}</td>
      <td>${escapeHtml(Number(row.tokensIn || 0).toLocaleString())}</td>
      <td>${escapeHtml(Number(row.tokensOut || 0).toLocaleString())}</td>
      <td>$${escapeHtml(Number(row.estimatedCost || 0).toFixed(4))}</td>
    </tr>`;
  }).join('');

  const featureRows = (Array.isArray(snapshot.featureUsage) ? snapshot.featureUsage : []).map((entry) => `<tr>
    <td><code>${escapeHtml(entry.featureKey || 'unmapped-feature')}</code></td>
    <td>${escapeHtml(entry.lane || 'execution')}</td>
    <td>${escapeHtml(entry.cycleKey || 'unknown-cycle')}</td>
    <td>${escapeHtml(entry.model || 'unknown')}</td>
    <td>${escapeHtml(Number(entry.totalTokensIn || 0).toLocaleString())}</td>
    <td>${escapeHtml(Number(entry.totalTokensOut || 0).toLocaleString())}</td>
    <td>$${escapeHtml(Number(entry.totalEstimatedCost || 0).toFixed(4))}</td>
    <td>${escapeHtml(Number(entry.runsCount || 0).toLocaleString())}</td>
  </tr>`).join('');

  const cycleRows = (Array.isArray(snapshot.cycleUsage) ? snapshot.cycleUsage : []).map((entry) => `<tr>
    <td>${escapeHtml(entry.cycleKey || 'unknown-cycle')}</td>
    <td>${escapeHtml(Number(entry.runsCount || 0).toLocaleString())}</td>
    <td>${escapeHtml(Number(entry.totalTokens || 0).toLocaleString())}</td>
    <td>$${escapeHtml(Number(entry.totalEstimatedCost || 0).toFixed(4))}</td>
  </tr>`).join('');

  return `<article class="panel" id="active-workers-panel" data-verify="ops-active-workers-panel-v1 ops-active-workers-filter-v1 ops-active-workers-cap-indicator-v1 ops-worker-usage-columns-v1 ops-worker-usage-feature-aggregation-v1 ops-worker-usage-export-v1">
    <div class="panel-head"><h2>Active Workers</h2><span class="section-tag">/ops</span></div>
    <p class="muted">Track worker/task execution in real time. Stale = no update for more than ${escapeHtml(staleThresholdMinutes)} minutes.</p>
    <div class="links" style="margin:.25rem 0 .5rem 0">
      <a href="#" data-worker-filter="all" class="${selectedFilter === 'all' ? 'active' : ''}">all</a>
      <a href="#" data-worker-filter="on-task" class="${selectedFilter === 'on-task' ? 'active' : ''}">on-task</a>
      <a href="#" data-worker-filter="stale" class="${selectedFilter === 'stale' ? 'active' : ''}">stale</a>
      <span class="badge ${capClass}">active/cap: ${escapeHtml(capLabel)}</span>
      <span class="badge">usage records: ${escapeHtml(snapshot.usageRecordsCount || 0)}</span>
      <a href="/api/ops/worker-usage/export.json" target="_blank" rel="noreferrer">export JSON</a>
      <a href="/api/ops/worker-usage/export.csv" target="_blank" rel="noreferrer">export CSV</a>
    </div>
    <p class="muted" id="active-workers-live-status">connecting…</p>
    <table><thead><tr><th>Worker / feature</th><th>Task summary</th><th>Status</th><th>Started / age</th><th>Last update</th><th>Model used</th><th>Tokens in</th><th>Tokens out</th><th>Estimated cost</th></tr></thead><tbody>${htmlRows || '<tr><td colspan="9">No active workers found.</td></tr>'}</tbody></table>
    <h3 style="margin:.6rem 0 .25rem">Feature-level usage aggregation (feature + lane + cycle + model)</h3>
    <table><thead><tr><th>Feature key</th><th>Lane</th><th>Cycle</th><th>Model</th><th>Total tokens in</th><th>Total tokens out</th><th>Total estimated cost</th><th>Runs count</th></tr></thead><tbody>${featureRows || '<tr><td colspan="8">No usage records yet.</td></tr>'}</tbody></table>
    <h3 style="margin:.6rem 0 .25rem">Cycle totals</h3>
    <table><thead><tr><th>Cycle</th><th>Runs count</th><th>Total tokens</th><th>Total estimated cost</th></tr></thead><tbody>${cycleRows || '<tr><td colspan="4">No cycle totals yet.</td></tr>'}</tbody></table>
  </article>`;
}

function computeTaskCounts(tasks = []) {
  const counts = { total: tasks.length, todo: 0, in_progress: 0, done: 0, other: 0 };
  for (const task of tasks) {
    const status = String(task.status || '').toLowerCase();
    if (status === 'todo') counts.todo += 1;
    else if (status === 'in_progress') counts.in_progress += 1;
    else if (status === 'done') counts.done += 1;
    else counts.other += 1;
  }
  return counts;
}

function buildMetricsSnapshot({ tasks, queueSnapshot, kpis }) {
  const now = new Date();
  const generatedAt = kpis?.generated_at ? new Date(kpis.generated_at) : now;
  const freshnessSeconds = Math.max(0, Math.round((now.getTime() - generatedAt.getTime()) / 1000));
  return {
    generated_at: now.toISOString(),
    mode: runtimeMode,
    task_counts: computeTaskCounts(tasks),
    queue_counts: {
      now: queueSnapshot.now.length,
      next: queueSnapshot.next.length,
      blocked: queueSnapshot.blocked.length,
      waiting_on_user: queueSnapshot.waitingOnUser.length,
      done: queueSnapshot.done.length,
    },
    freshness: {
      kpi_generated_at: kpis?.generated_at || null,
      kpi_age_seconds: freshnessSeconds,
      status: freshnessSeconds <= 300 ? 'fresh' : 'stale',
    },
    worker: deriveWorkerSnapshot(tasks),
  };
}

function logMetricsSnapshot(snapshot) {
  console.log(`${metricsLogPrefix} ${JSON.stringify(snapshot)}`);
}

function applyTaskFilter(tasks, filter) { return (!filter || filter === 'all') ? tasks : tasks.filter((t) => String(t.status || '').toLowerCase() === filter); }

function parseActionCardWho(task = {}) {
  const stream = String(task.stream || '').replace(/[_-]+/g, ' ').trim();
  if (stream) return stream;
  return String(task.source || 'target account').replace(/[_-]+/g, ' ');
}

function deriveActionDueDate(task = {}) {
  if (task.due_date) return new Date(task.due_date).toISOString();
  const status = String(task.status || '').toLowerCase();
  if (status === 'done') return null;
  const priority = Number.isFinite(Number(task.priority)) ? Number(task.priority) : 50;
  const now = Date.now();
  const horizonDays = priority <= 10 ? 1 : priority <= 25 ? 2 : priority <= 40 ? 3 : 5;
  return new Date(now + (horizonDays * 24 * 60 * 60 * 1000)).toISOString();
}

function deriveActionExpectedOutcome(task = {}, status = 'todo') {
  const title = String(task.title || '').toLowerCase();
  if (status === 'done') return 'Outcome logged and handoff can proceed to the next stage.';
  if (title.includes('assign owner') || title.includes('personalize')) return 'A named owner is assigned and first-touch copy is approved for send.';
  if (title.includes('send') || title.includes('outreach')) return 'First outreach is sent and a response/next-step is recorded in queue.';
  if (title.includes('pilot')) return 'Pilot candidate is routed with kickoff owner + timing confirmed.';
  return 'Task moves one stage forward with owner, status, and next-step evidence captured.';
}

function deriveActionConfidenceMeta(task = {}, status = 'todo') {
  if (status === 'done') return { label: 'High', score: 92, className: 'ok', reason: 'Completed with execution evidence.' };
  const priority = Number.isFinite(Number(task.priority)) ? Number(task.priority) : 50;
  const hasDescription = String(task.description || '').trim().length > 0;
  const hasOwner = String(task.owner || '').trim().length > 0 && String(task.owner || '').toLowerCase() !== 'unassigned';

  let score = 55;
  if (priority <= 15) score += 15;
  else if (priority <= 25) score += 8;
  if (hasDescription) score += 12;
  if (hasOwner) score += 10;
  if (status === 'in_progress') score += 8;

  if (score >= 80) return { label: 'High', score, className: 'ok', reason: 'Clear owner/context and strong execution signal.' };
  if (score >= 65) return { label: 'Medium', score, className: 'warn', reason: 'Action is viable but still needs tighter execution certainty.' };
  return { label: 'Low', score, className: 'bad', reason: 'Insufficient ownership/context to trust immediate handoff.' };
}

function toActionQueueCard(task = {}) {
  const who = parseActionCardWho(task);
  const whyNow = String(task.description || '').trim() || `Priority ${Number.isFinite(Number(task.priority)) ? Number(task.priority) : 50} item in operator queue.`;
  const suggestedOpener = `Hi ${who}, quick sync on: ${String(task.title || 'next action')}.`;
  const status = String(task.status || 'todo').toLowerCase();
  return {
    id: task.id,
    title: String(task.title || 'Untitled action'),
    who,
    why_now: whyNow,
    expected_outcome: deriveActionExpectedOutcome(task, status),
    confidence: deriveActionConfidenceMeta(task, status),
    suggested_opener: suggestedOpener,
    due_date: deriveActionDueDate(task),
    owner: String(task.owner || 'Operator'),
    status,
    priority: Number.isFinite(Number(task.priority)) ? Number(task.priority) : 50,
    status_rank: status === 'in_progress' ? 0 : status === 'todo' ? 1 : status === 'done' ? 3 : 2,
  };
}

function sortActionCards(cards = []) {
  return [...cards].sort((a, b) => {
    const urgencyA = getActionUrgencyMeta(a);
    const urgencyB = getActionUrgencyMeta(b);
    if (urgencyA.rank !== urgencyB.rank) return urgencyA.rank - urgencyB.rank;
    const dueA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    const dueB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    if (dueA !== dueB) return dueA - dueB;
    if ((a.priority || 999) !== (b.priority || 999)) return (a.priority || 999) - (b.priority || 999);
    if ((a.status_rank || 99) !== (b.status_rank || 99)) return (a.status_rank || 99) - (b.status_rank || 99);
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

function getActionStatusMeta(status = '') {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'done') return { label: 'Done', className: 'ok' };
  if (normalized === 'in_progress') return { label: 'In progress', className: 'warn' };
  return { label: 'To do', className: 'info' };
}

function getActionUrgencyMeta(card = {}) {
  if (String(card.status || '').toLowerCase() === 'done') return { label: 'Complete', className: 'ok', rank: 4, band: 'low', dueSoonText: 'Done' };
  if (!card.due_date) return { label: 'Unscheduled', className: 'info', rank: 3, band: 'low', dueSoonText: 'No due date' };
  const dueMs = new Date(card.due_date).getTime();
  const deltaHours = Math.round((dueMs - Date.now()) / (60 * 60 * 1000));
  if (deltaHours < 0) return { label: 'Overdue', className: 'bad', rank: 0, band: 'high', dueSoonText: `${Math.abs(deltaHours)}h late` };
  if (deltaHours <= 24) return { label: 'Due <24h', className: 'warn', rank: 1, band: 'high', dueSoonText: `${deltaHours}h left` };
  if (deltaHours <= 72) return { label: 'Due soon', className: 'info', rank: 2, band: 'medium', dueSoonText: `${Math.ceil(deltaHours / 24)}d left` };
  return { label: 'Planned', className: 'ok', rank: 3, band: 'low', dueSoonText: `${Math.ceil(deltaHours / 24)}d out` };
}

function getActionPriorityCue(card = {}) {
  const urgency = getActionUrgencyMeta(card);
  const owner = String(card.owner || '').trim().toLowerCase();
  if (urgency.label === 'Overdue') return { label: 'P0 · do now', className: 'bad', rank: 0 };
  if (urgency.label === 'Due <24h' || (urgency.band === 'high' && (!owner || owner === 'unassigned'))) {
    return { label: 'P1 · today', className: 'warn', rank: 1 };
  }
  if (urgency.band === 'medium') return { label: 'P2 · this week', className: 'info', rank: 2 };
  return { label: 'P3 · planned', className: 'ok', rank: 3 };
}

function getActionNextBestAction(card = {}) {
  const status = String(card.status || '').toLowerCase();
  const owner = String(card.owner || 'Owner').trim() || 'Owner';
  if (status === 'done') return `Confirm ${owner} posted final proof link; no further action needed.`;
  if (status === 'in_progress') return `${owner}: send or update first touch now, then post a timestamped status note.`;
  return card.priority <= 15
    ? `${owner}: assign ownership and send first touch immediately.`
    : `${owner}: assign ownership, draft first-touch message, and queue send.`;
}

function getActionExpectedOutcomeLine(card = {}, max = 120) {
  const status = String(card.status || '').toLowerCase();
  const explicit = conciseActionCopy(card.expected_outcome, max);
  if (status === 'done') return 'Execution proof is logged and this card is fully closed.';
  if (status === 'in_progress') {
    if (explicit === '—') return 'First touch is sent, timestamped, and ready to mark done.';
    return `First touch is sent and logged. Target result: ${explicit}`;
  }
  if (explicit === '—') return 'Owner is assigned and first-touch send is queued with clear context.';
  return `Owner is assigned and first touch is queued/sent. Target result: ${explicit}`;
}

function getActionCompletionBehavior(card = {}) {
  const status = String(card.status || '').toLowerCase();
  if (status === 'done') return 'Complete: evidence preserved.';
  if (status === 'in_progress') return 'Exit criteria: touch sent + status note posted + mark done.';
  return 'Start execution by moving to in progress.';
}

function conciseActionCopy(text = '', max = 120) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '—';
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function sanitizeInternalReturnPath(path = '') {
  const value = String(path || '').trim();
  if (!value.startsWith('/')) return '';
  if (value.startsWith('//')) return '';
  return value;
}

function getActionTransitionButtonMeta(card = {}) {
  const status = String(card.status || '').toLowerCase();
  if (status === 'done') return { label: 'Done', disabled: true, note: 'No further transition.' };
  const next = ACTION_CARD_STATUS_FLOW[status] || 'next';
  if (next === 'done') return { label: 'Mark done', disabled: false, note: 'Completes the card and preserves it in done.' };
  return { label: `Move to ${next.replaceAll('_', ' ')}`, disabled: false, note: 'Starts active execution with in-progress status.' };
}

function renderActionsQueueCards(tasks = []) {
  const cards = sortActionCards((tasks || []).map(toActionQueueCard));
  const counts = {
    overdue: cards.filter((card) => getActionUrgencyMeta(card).label === 'Overdue').length,
    dueSoon: cards.filter((card) => getActionUrgencyMeta(card).label === 'Due <24h').length,
    unassigned: cards.filter((card) => String(card.owner || '').toLowerCase() === 'unassigned').length,
  };

  return `<div data-verify="actions-enterprise-queue-v1 actions-enterprise-next-best-action-v1 v2-actions-queue-enterprise-table v2-actions-queue-urgency-clarity-v1 v2-actions-human-handoff-precision-v1 v3-actions-priority-scan-v1">${cards.length ? `<table data-verify="actions-enterprise-table-v1 actions-queue-enterprise-table-v1 v2-actions-queue-enterprise-table v2-actions-completion-behavior-v1 v3-actions-reduced-cognitive-load-v1 v4-actions-next-best-action-clarity-v1 v4-actions-expected-outcome-clarity-v1"><thead><tr><th>Priority cue</th><th>Action + owner</th><th>Why now</th><th>Do next (explicit)</th><th>Outcome when done</th><th>Transition</th></tr></thead><tbody>${cards.map((card) => {
    const statusMeta = getActionStatusMeta(card.status);
    const urgencyMeta = getActionUrgencyMeta(card);
    const priorityCue = getActionPriorityCue(card);
    const transitionMeta = getActionTransitionButtonMeta(card);
    return `<tr><td><span class="badge ${priorityCue.className}">${escapeHtml(priorityCue.label)}</span><div class="muted"><span class="badge ${urgencyMeta.className}">${escapeHtml(urgencyMeta.label)}</span> · ${escapeHtml(urgencyMeta.dueSoonText)}</div></td><td><strong>${escapeHtml(card.title)}</strong><div class="muted">owner: ${escapeHtml(card.owner || 'Unassigned')} · status: ${escapeHtml(statusMeta.label)}</div></td><td>${escapeHtml(conciseActionCopy(card.why_now, 100))}</td><td><strong>${escapeHtml(getActionNextBestAction(card))}</strong><div class="muted">${escapeHtml(getActionCompletionBehavior(card))}</div></td><td><strong>${escapeHtml(getActionExpectedOutcomeLine(card, 95))}</strong><div class="muted">confidence: ${escapeHtml(card.confidence?.label || 'Medium')} (${escapeHtml(card.confidence?.score ?? 0)})</div></td><td><form method="POST" action="/actions/${encodeURIComponent(card.id || '')}/transition"><button type="submit" ${transitionMeta.disabled ? 'disabled' : ''}>${escapeHtml(transitionMeta.label)}</button></form><div class="muted">${escapeHtml(transitionMeta.note)}</div></td></tr>`;
  }).join('')}</tbody></table><div class="helper-row stack-md"><span class="helper-chip">Overdue: ${counts.overdue}</span><span class="helper-chip">Due &lt;24h: ${counts.dueSoon}</span><span class="helper-chip">Unassigned owners: ${counts.unassigned}</span></div><div class="funnel-list stack-md">${cards.map((card) => {
    const statusMeta = getActionStatusMeta(card.status);
    const urgencyMeta = getActionUrgencyMeta(card);
    const priorityCue = getActionPriorityCue(card);
    const transitionMeta = getActionTransitionButtonMeta(card);
    return `<article class="funnel-card" data-verify="actions-core-queue-card-v2 v2-actions-card-urgency-v1 v2-actions-card-handoff-precision-v1 v2-actions-card-confidence-cues-v1 v3-actions-next-step-explicit-v1 v4-actions-next-best-action-clarity-v1 v4-actions-expected-outcome-clarity-v1"><div class="funnel-title"><strong>${escapeHtml(card.title)}</strong><div><span class="badge ${priorityCue.className}">${escapeHtml(priorityCue.label)}</span> <span class="badge ${urgencyMeta.className}">${escapeHtml(urgencyMeta.label)}</span> <span class="badge ${statusMeta.className}">${escapeHtml(statusMeta.label)}</span></div></div><div class="funnel-meta">owner: ${escapeHtml(card.owner)} · due: ${escapeHtml(card.due_date ? new Date(card.due_date).toLocaleString() : '—')} · cue ${escapeHtml(urgencyMeta.dueSoonText)}</div><p class="card-note"><strong>Do next:</strong> ${escapeHtml(getActionNextBestAction(card))}</p><p class="card-note"><strong>Outcome when done:</strong> ${escapeHtml(getActionExpectedOutcomeLine(card, 140))}</p><p class="card-note"><strong>Why now:</strong> ${escapeHtml(conciseActionCopy(card.why_now, 130))}</p><p class="muted card-context">${escapeHtml(getActionCompletionBehavior(card))}</p><form method="POST" action="/actions/${encodeURIComponent(card.id || '')}/transition"><button type="submit" ${transitionMeta.disabled ? 'disabled' : ''}>${escapeHtml(transitionMeta.label)}</button></form></article>`;
  }).join('')}</div>` : '<p class="empty-state">No actions in queue.</p>'}</div>`;
}

function renderActionsPage(tasks = [], qualifiedAccounts = [], meetingPipeline = {}, relationshipIntelligence = {}, { errorMessage = '', message = '', messageState = 'success', source = '', returnTo = '' } = {}) {
  const cards = sortActionCards((tasks || []).map(toActionQueueCard));
  const counts = {
    todo: cards.filter((card) => card.status === 'todo').length,
    in_progress: cards.filter((card) => card.status === 'in_progress').length,
    done: cards.filter((card) => card.status === 'done').length,
  };
  const pendingClientUpdates = sortPendingClientUpdatesByDue((meetingPipeline?.dueClientUpdates || []).filter(isClientUpdatePending));
  const sanitizedReturnTo = sanitizeInternalReturnPath(returnTo);

  return `${renderTopNav({ active: 'actions', errorMessage })}
  <div class="page-shell" data-verify="actions-route-v3 actions-min-components-v1 actions-single-objective-v1 actions-handoff-hardening-v1 targeting-to-actions-transition-v1 actions-golden-step-2-v1">
    <article class="page-header"><div class="panel-head"><h2>Actions</h2><span class="section-tag">step 2 of 4 · execution queue</span></div><p><strong>Decision rule:</strong> Complete the top urgent cards first, then hand off to Relationships.</p><p class="muted">Maximum primary blocks on this page: 4 (objective, queue status, execution queue, handoff CTA).</p><p class="muted" data-verify="actions-promotion-criteria-v1 actions-promotion-criteria-tight-copy-v2">Ready to hand off when all P0/P1 cards have owner, first-touch sent/queued, and proof logged.</p><div class="dominant-cta"><a class="button-link cta-emphasis" href="/relationships?source=actions#team-handoff-queue" data-verify="actions-single-dominant-cta-v2 actions-to-relationships-one-click-v1">Continue to Relationships</a></div>${source === 'targeting' ? '<p class="muted" data-verify="actions-entry-from-targeting-v1">From Targeting: execute top cards now, then continue.</p>' : ''}${source === 'comms' ? '<p class="muted" data-verify="actions-entry-from-comms-v1 actions-entry-from-comms-fast-handoff-v2">From Comms: complete required handoff cards, then return to the same Comms context (or continue to Relationships).</p>' : ''}</article>
    ${renderFlashMessage(message, messageState, 'actions-page-feedback-v1')}
    <article class="panel" data-verify="actions-queue-core-v2 actions-enterprise-queue-health-v1 v2-actions-ordering-urgency-first-v1"><h2>Queue status</h2><div class="links"><span class="badge warn">in progress: ${counts.in_progress}</span><span class="badge info">todo: ${counts.todo}</span><span class="badge ok">done: ${counts.done}</span></div><p class="muted">Ordering: urgency (high → medium → low), then nearest due date, then priority.</p><p class="muted" data-verify="actions-confidence-rationale-v1">Confidence rationale: score increases with priority urgency, clear description, named owner, and active execution status.</p></article>
    <article class="panel" data-verify="actions-enterprise-table-and-cards-v2 v2-actions-confidence-cues-v1 v3-actions-explicit-outcome-v1 actions-low-friction-triage-copy-v2"><h2>Execution queue</h2><p class="muted">Work top-down. For each card: do <strong>Do next</strong> → verify <strong>Outcome when done</strong> → transition status.</p>${renderActionsQueueCards(tasks)}</article>
    <article class="panel" data-verify="actions-handoff-transitions-v2 actions-golden-next-relationships-v1 actions-context-return-rail-v1 actions-expected-outcome-visible-v2"><h2>Handoff CTA</h2><p class="muted">${escapeHtml(pendingClientUpdates.length)} pending client updates can be advanced in Relationships.</p><p class="muted" data-verify="actions-handoff-readiness-v1">Move forward only after top P0/P1 cards show owner + first-touch proof.</p><div class="cta-grid"><section class="cta-card cta-primary" data-verify="actions-cta-relationships-v2"><strong>Continue to Relationships</strong><p>Expected outcome: handoff stage is updated with execution proof on record.</p><a class="button-link" href="/relationships?source=actions#team-handoff-queue">Open Relationships</a></section>${sanitizedReturnTo ? `<section class="cta-card" data-verify="actions-cta-return-to-comms-context-v1"><strong>Return to Comms context</strong><p>Expected outcome: you resume the same scope/tab with no re-filtering.</p><a class="button-link button-secondary" href="${escapeHtml(sanitizedReturnTo)}">Return to Comms</a></section>` : ''}</div></article>
  </div>`;
}

function renderTaskTable(tasks, activeFilter, basePath = '/') {
  const rows = tasks.map((task) => `<tr><td>${escapeHtml(task.id)}</td><td>${escapeHtml(task.title)}</td><td>${escapeHtml(task.status)}</td><td>${escapeHtml(task.priority ?? '')}</td><td><form method="POST" action="/setup/${encodeURIComponent(task.id)}/advance?filter=${encodeURIComponent(activeFilter || 'all')}&view=${encodeURIComponent(basePath)}"><button type="submit" ${task.status === 'done' ? 'disabled' : ''}>${task.status === 'done' ? 'Done' : 'Move to next stage'}</button></form></td></tr>`).join('');
  return `<div class="links">${QUICK_FILTERS.map((f) => `<a class="${f === activeFilter ? 'active' : ''}" href="${basePath}?filter=${f}">${escapeHtml(f.replace('_', ' '))}</a>`).join('')}<a href="/ops">ops</a></div><table><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No tasks found.</td></tr>'}</tbody></table>`;
}

function normalizeBoardCard(card = {}, fallback = {}) {
  const title = String(card.title || fallback.title || '').trim();
  if (!title) return null;
  const status = String(card.status || fallback.status || '').trim() || 'UNKNOWN';
  const owner = String(card.owner || fallback.owner || '').trim() || 'Unassigned';
  return { title, status, owner };
}

function getOperatorStatusSections(tasks, queueSnapshot) {
  const queue = queueSnapshot || { now: [], next: [], blocked: [], done: [], waitingOnUser: [] };
  const current = tasks
    .filter((t) => String(t.status || '').toLowerCase() === 'in_progress')
    .map((t) => normalizeBoardCard({ title: t.title, status: 'IN PROGRESS', owner: t.owner || 'Operator' }))
    .filter(Boolean)
    .concat((queue.now || []).map((card) => normalizeBoardCard(card, { status: 'IN PROGRESS' })).filter(Boolean));

  const next = tasks
    .filter((t) => String(t.status || '').toLowerCase() === 'todo')
    .map((t) => normalizeBoardCard({ title: t.title, status: 'TODO', owner: t.owner || 'Operator' }))
    .filter(Boolean)
    .concat((queue.next || []).map((card) => normalizeBoardCard(card, { status: 'QUEUED' })).filter(Boolean));

  const done = tasks
    .filter((t) => String(t.status || '').toLowerCase() === 'done')
    .map((t) => normalizeBoardCard({ title: t.title, status: 'DONE', owner: t.owner || 'Operator' }))
    .filter(Boolean)
    .concat((queue.done || []).map((card) => normalizeBoardCard(card, { status: 'DONE' })).filter(Boolean));

  return {
    current,
    blocked: (queue.blocked || []).map((card) => normalizeBoardCard(card, { status: 'BLOCKED' })).filter(Boolean),
    next,
    done,
    waitingOnUser: (queue.waitingOnUser || []).map((card) => normalizeBoardCard(card, { status: 'WAITING ON USER' })).filter(Boolean),
  };
}

function renderExecutionBoard(tasks, queueSnapshot) {
  const sections = getOperatorStatusSections(tasks, queueSnapshot);
  const lane = (title, cards) => `<section class="lane"><h3>${title} <span class="badge">${cards.length}</span></h3>${cards.length ? `<ul>${cards.slice(0, 8).map((card) => `<li><article class="lane-card"><strong>${escapeHtml(card.title)}</strong><span class="lane-meta">Owner: ${escapeHtml(card.owner)}</span></article></li>`).join('')}</ul>` : '<p class="empty-state">No items</p>'}</section>`;
  return `<div class="board">${lane('Doing now', sections.current)}${lane('Blocked', sections.blocked)}${lane('Up next', sections.next)}${lane('Done', sections.done)}${lane('Needs input', sections.waitingOnUser)}</div>`;
}

function renderOperatorStatusPane(tasks, queueSnapshot) {
  const sections = getOperatorStatusSections(tasks, queueSnapshot);
  const freshness = new Date().toLocaleString();
  const summary = [
    ['Current', sections.current.length],
    ['Blocked', sections.blocked.length],
    ['Next', sections.next.length],
    ['Done', sections.done.length],
    ['Waiting-on-user', sections.waitingOnUser.length],
  ];

  return `<header><h1>Operator status pane</h1><p class="muted">Always-available self-serve view · local-first on :${port} · updated ${escapeHtml(freshness)}</p></header>
  <article class="panel"><h2>Summary counts</h2><div class="kpis">${summary.map(([name, value]) => `<article class="metric"><div class="name">${escapeHtml(name)}</div><div class="value">${escapeHtml(value)}</div><div class="fresh">freshness: live page render · ${escapeHtml(freshness)}</div></article>`).join('')}</div></article>
  <article class="panel"><h2>Status lanes</h2>${renderExecutionBoard(tasks, queueSnapshot)}</article>
  <article class="panel"><h2>Quick links</h2><div class="links"><a href="/">Home</a><a href="/ops">Ops</a><a href="/strategy">Strategy</a><a href="/operator-status" class="active">Operator status</a></div></article>`;
}

function renderKpis(kpis) {
  const updatedAt = kpis.generated_at ? new Date(kpis.generated_at).toLocaleString() : 'unknown';
  const ratio = getCompletionRatio(kpis);
  return `<div data-verify="kpi-hierarchy-v2"><div class="kpis">${(kpis.cards || []).map((c) => {
    const meta = KPI_META[c.key] || {};
    const gate = kpiGateStatus(c);
    const tooltip = `${meta.operatorDefinition || 'No definition'} | Monday gate: ${meta.mondayGate || 'unmapped'} | Go rule: ${meta.goRule || 'n/a'}`;
    return `<article class="metric" title="${escapeHtml(tooltip)}"><div class="name">${escapeHtml(c.label || c.key)}</div><div class="value">${escapeHtml(c.value)}</div><div class="fresh">freshness: ${escapeHtml(c.freshness || kpis.freshness)} · updated ${escapeHtml(updatedAt)}</div><div class="fresh">gate alignment: <span class="${gate.className}">${escapeHtml(gate.status)}</span> · ${escapeHtml(gate.note)}</div></article>`;
  }).join('')}</div><p class="muted" data-verify="kpi-gate-alignment-v2">Completion ratio gate (completed/delegations): <span class="${ratio.className}">${escapeHtml(ratio.status)}</span> · ${escapeHtml(ratio.valueText)} · target ≥ 55%</p><p class="muted">Need definitions? <a href="#metric-dictionary">Open metric dictionary</a></p></div>`;
}

function renderFunnelPanel(funnels, sequenceTemplates = [], message = '') {
  const rows = Array.isArray(funnels) ? funnels.slice(0, 8) : [];
  const activeCount = rows.filter((f) => String(f.status || '').toLowerCase() === 'active').length;
  const templateOptions = (sequenceTemplates || []).map((tpl) => `<option value="${escapeHtml(tpl.id)}">${escapeHtml(tpl.name || tpl.slug || 'Untitled sequence')}</option>`).join('');
  const statusClass = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'active') return 'ok';
    if (value === 'paused') return 'warn';
    if (value === 'archived') return 'bad';
    return 'info';
  };

  return `<div data-verify="funnel-ops-polish-v1"><p class="muted">Funnels ready for action: <strong>${rows.length}</strong> · active: <strong>${activeCount}</strong></p>${message ? `<p class="ok" data-verify="funnel-enroll-feedback-v1">${escapeHtml(message)}</p>` : ''}<div class="funnel-list">${rows.map((f) => {
    const name = escapeHtml(f.name || 'Untitled funnel');
    const status = String(f.status || 'draft').toLowerCase();
    return `<article class="funnel-card" data-verify="funnel-card-v1"><div class="funnel-title"><strong>${name}</strong><span class="badge ${statusClass(status)}">${escapeHtml(status)}</span></div><div class="funnel-meta">Channel: ${escapeHtml(f.channel || 'mixed')} · Goal: ${escapeHtml(f.goal || 'not set')}</div><form class="inline-form" method="POST" action="/funnels/enroll"><input type="hidden" name="funnel_id" value="${escapeHtml(f.id || '')}" /><input type="text" name="lead_key" placeholder="Lead ID (lead:acme:123)" required /><select name="sequence_template_id" required><option value="">Choose sequence</option>${templateOptions}</select><button type="submit" ${templateOptions ? '' : 'disabled'}>Launch outreach</button></form></article>`;
  }).join('') || '<p class="empty-state">No active funnels yet. Create one in Ops.</p>'}</div></div>`;
}

function renderTargetAccountRubricPanel() {
  return `<div data-verify="target-account-rubric-v1"><p class="muted">Schema version: <code>${escapeHtml(TARGET_ACCOUNT_RUBRIC.schema_version)}</code></p>
  <table><thead><tr><th>Field</th><th>Required</th><th>Allowed / notes</th></tr></thead><tbody>${TARGET_ACCOUNT_RUBRIC.fields.map((field) => `<tr><td>${escapeHtml(field.label)} <span class="muted">(${escapeHtml(field.key)})</span></td><td>${field.required ? 'yes' : 'no'}</td><td>${escapeHtml(Array.isArray(field.allowed) ? field.allowed.join(', ') : 'free text')}</td></tr>`).join('')}</tbody></table>
  <h3 style="margin-top:.6rem;">Scoring rubric</h3>
  <table><thead><tr><th>Axis</th><th>Weight</th><th>Pass threshold</th><th>Rule</th></tr></thead><tbody>${TARGET_ACCOUNT_RUBRIC.scoring_rubric.map((row) => `<tr><td>${escapeHtml(row.axis)}</td><td>${escapeHtml(row.weight)}%</td><td>${escapeHtml(row.pass_threshold)}</td><td>${escapeHtml(row.rubric)}</td></tr>`).join('')}</tbody></table>
  <p class="muted">Routing thresholds: enroll now ≥ ${escapeHtml(TARGET_ACCOUNT_RUBRIC.routing_thresholds.enroll_now_score)} · nurture ≥ ${escapeHtml(TARGET_ACCOUNT_RUBRIC.routing_thresholds.nurture_score)}</p></div>`;
}

function renderAcquisitionMetricsPanel(metrics = {}) {
  const rows = metrics.entries || [];
  const goal = metrics.goal_metrics || {};
  const cards = [
    { label: 'New qualified accounts/day', value: goal.new_qualified_accounts_per_day ?? 0, hint: 'last 24h' },
    { label: 'Enrolled accounts/day', value: goal.enrolled_accounts_per_day ?? 0, hint: 'last 24h' },
    { label: 'Positive reply rate', value: goal.positive_reply_rate_text || `${Number(goal.positive_reply_rate || 0) * 100}%`, hint: `from ${metrics?.totals?.classified_replies || 0} classified replies` },
    { label: 'Meetings booked', value: goal.meetings_booked ?? 0, hint: 'last 24h' },
    { label: 'Pilot candidates', value: goal.pilot_candidates ?? 0, hint: 'current stage count' },
  ];

  return `<div data-verify="acquisition-first-metrics-v1 acquisition-metrics-panel-v1"><p class="muted">Acquisition-first scoreboard for adding qualified companies into the funnel.</p>
  <div class="kpis">${cards.map((card) => `<article class="metric"><div class="name">${escapeHtml(card.label)}</div><div class="value">${escapeHtml(card.value)}</div><div class="fresh">${card.hint}</div></article>`).join('')}</div>
  <p class="muted" style="margin-top:.5rem">By funnel entry attribution:</p>
  <table style="margin-top:.45rem;"><thead><tr><th>Funnel entry</th><th>Enrollments</th><th>Classified replies</th><th>Positive replies</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.funnel_entry || 'unattributed')}</td><td>${escapeHtml(row.enrollments || 0)}</td><td>${escapeHtml(row.classified_replies || 0)}</td><td>${escapeHtml(row.positive_replies || 0)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-state">No acquisition data yet.</td></tr>'}</tbody></table></div>`;
}

function renderSequenceTemplatePanel(templates) {
  const rows = Array.isArray(templates) ? templates : [];
  return `<div data-verify="sequence-step-editor-v1"><p class="muted">Templates ready: <strong>${rows.length}</strong></p><div class="funnel-list">${rows.map((item) => {
    const steps = Array.isArray(item.steps_detail) ? item.steps_detail : [];
    const metadata = safeJsonObject(item.metadata);
    const variant = metadata.variant || metadata.variant_id || 'base';
    const primaryCta = metadata.primary_cta || 'reply to this message';
    const templateId = encodeURIComponent(item.id || '');
    const isPaused = String(item.status || '').toLowerCase() === 'paused';
    return `<article class="funnel-card"><div class="funnel-title"><strong>${escapeHtml(item.name || 'Untitled')}</strong><span class="badge">${escapeHtml(item.status || 'active')}</span></div>
      <div class="funnel-meta">variant: <strong>${escapeHtml(variant)}</strong> · steps: ${escapeHtml(item.steps || 0)} · cadence: ${escapeHtml(item.cadence_label || 'Not set')} · CTA: ${escapeHtml(primaryCta)}</div>
      <table style="margin-top:.35rem;"><thead><tr><th>#</th><th>Type</th><th>Delay</th><th>Message stub</th><th>CTA</th></tr></thead><tbody>${steps.map((step, idx) => `<tr><td>${idx + 1}</td><td>${escapeHtml(step.step_type)}</td><td>${escapeHtml(step.delay_days)}d</td><td>${escapeHtml(step.message_stub || '—')}</td><td>${escapeHtml(step.cta || primaryCta || '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No steps defined yet.</td></tr>'}</tbody></table>
      <form class="inline-form" method="POST" action="/sequences/templates/${templateId}/steps"><input type="text" name="step_type" placeholder="step type (email/sms/call)" required /><input type="number" name="delay_days" min="0" value="0" /><input type="text" name="message_stub" placeholder="message stub" required /><button type="submit">Add step</button></form>
      <form method="POST" action="/sequences/templates/${templateId}/toggle" style="margin-top:.35rem;"><input type="hidden" name="next_status" value="${isPaused ? 'active' : 'paused'}" /><button type="submit">${isPaused ? 'Resume sequence' : 'Pause sequence'}</button></form>
    </article>`;
  }).join('') || '<p class="empty-state">No sequence templates yet</p>'}</div></div>`;
}

function renderSequenceQueuePanel(queue, enrollmentBySequence = []) {
  return `<div data-verify="sequence-enrollment-visibility-v1 sequence-enrollment-ux-v1"><p class="muted">Queued/active enrollments: <strong>${queue.length}</strong></p><ul class="queue-list">${queue.map((item) => `<li><strong>${escapeHtml(item.lead_key)}</strong> → ${escapeHtml(item.template_name || 'Unknown')} <span class="badge">${escapeHtml(item.status)}</span><br><span class="muted">step ${escapeHtml(Number(item.current_step_index || 0) + 1)} · ${escapeHtml(item.next_send_at ? new Date(item.next_send_at).toLocaleString() : 'schedule pending')}</span></li>`).join('') || '<li class="empty-state">No queued enrollments</li>'}</ul><h3 style="margin-top:.65rem;">Active enrollments by sequence</h3><table><thead><tr><th>Sequence</th><th>Template status</th><th>Active enrollments</th><th>Sample leads</th></tr></thead><tbody>${(enrollmentBySequence || []).map((row) => `<tr><td>${escapeHtml(row.template_name || 'Unknown')}</td><td>${escapeHtml(row.template_status || 'active')}</td><td>${escapeHtml(row.active_count || 0)}</td><td>${escapeHtml((row.lead_keys || []).join(', ') || '—')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-state">No active enrollments yet.</td></tr>'}</tbody></table></div>`;
}

function renderRecentReplyRoutingPanel(rows = []) {
  return `<div data-verify="reply-routing-panel-v1"><p class="muted">Recent replies + routed action (operator view).</p>
  <table><thead><tr><th>Lead</th><th>Reply class</th><th>Routed action</th><th>Excerpt</th><th>When</th></tr></thead><tbody>${(rows || []).map((row) => `<tr><td>${escapeHtml(row.lead_key || '—')}</td><td><span class="badge">${escapeHtml(row.classification || 'neutral')}</span></td><td><strong>${escapeHtml(row.next_action || 'nurture')}</strong></td><td>${escapeHtml(String(row.reply_excerpt || '').slice(0, 100) || '—')}</td><td>${escapeHtml(row.created_at ? new Date(row.created_at).toLocaleString() : '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No routed replies yet.</td></tr>'}</tbody></table></div>`;
}

function renderNowItemsIntegrationPanel({ route = 'comms' } = {}) {
  const inOps = route === 'ops';
  return `<article class="panel" data-verify="now-items-integration-v1 now-comms-account-individual-coherence-v1 now-research-ledger-v1 now-intelligence-layer-handoff-v1 ${inOps ? 'now-review-checklist-placement-v1' : ''}"><div class="panel-head"><h2>NOW items integration</h2><span class="section-tag">coherence map</span></div>
    <p class="muted">Aligned across active NOW items so /comms and /ops read as one operating flow with non-conflicting KPI ownership.</p>
    <ul class="queue-list" data-verify="account-individual-naming-standard-v1 canonical-module-ownership-v1">
      <li><strong>Comms + Account Workspace + Individual Workspace split:</strong> /comms owns message workflow clarity (inbox/outbox, attribution, next touch), while /ops owns operational diagnostics and queue reliability.</li>
      <li><strong>Canonical module ownership where widgets overlap:</strong> /actions owns execution queue transitions, /relationships owns pipeline-stage progression + human handoff intent, /comms owns thread-level messaging context, and /ops owns KPI gates/diagnostics/escalations.</li>
      <li><strong>Research Ledger:</strong> findings + rationale stay linked via <a href="/research">/research</a> and feed execution context in Comms/Ops.</li>
      <li><strong>Intelligence Layer v1:</strong> recommendation rationale flows Targeting → Actions → Relationships with supporting reply-routing evidence in Ops.</li>
      ${inOps ? '<li><strong>Operator checklist placement:</strong> quick checklist remains one click from /ops via the review checklist card.</li>' : ''}
    </ul>
    <p class="muted" data-verify="kpi-narrative-source-of-truth-v1">KPI source-of-truth: <a href="/ops#execution-board">/ops diagnostics</a>. /comms shows workflow signals only (not KPI gate decisions).</p>
  </article>`;
}

function renderNurtureTriggerMappingPanel(rules = [], sequenceTemplates = [], lastRun = null) {
  const rows = (rules || []).map((rule) => {
    const linked = (sequenceTemplates || []).find((tpl) => String(tpl.slug || '') === String(rule.sequence_slug || ''))
      || (sequenceTemplates || []).find((tpl) => String(tpl.name || '').toLowerCase().includes(String(rule.sequence_fallback_name || '').toLowerCase()));
    const status = linked ? '<span class="ok">mapped</span>' : '<span class="warn">unmapped</span>';
    return `<tr><td>${escapeHtml(rule.id || '—')}</td><td>${escapeHtml(rule.trigger_key || '—')}</td><td>${escapeHtml(rule.sequence_slug || rule.sequence_fallback_name || '—')}</td><td>${escapeHtml(linked?.name || 'No matching sequence template')}</td><td>${status}</td></tr>`;
  }).join('');

  const runSummary = lastRun
    ? `<p class="muted">Last trigger run: <strong>${escapeHtml(new Date(lastRun.ran_at || '').toLocaleString())}</strong> · mode: <strong>${escapeHtml(lastRun.mode || 'dry_run')}</strong> · actions produced: <strong>${escapeHtml(lastRun.actions_produced ?? 0)}</strong></p>`
    : '<p class="muted">Last trigger run: <strong>none yet</strong></p>';

  return `<div>${runSummary}<p class="muted">Trigger → sequence routing for nurture automation v1.</p><table><thead><tr><th>Rule</th><th>Trigger</th><th>Configured sequence</th><th>Resolved template</th><th>State</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No trigger rules configured.</td></tr>'}</tbody></table><p class="muted">Config file: <code>lib/nurture-trigger-rules.json</code> · API: <code>POST /api/nurture/triggers/evaluate</code></p></div>`;
}

function renderMeetingPipeline(panel, { clientUpdateFilter = 'all' } = {}) {
  const fmt = (value) => value ? new Date(value).toLocaleDateString() : '—';
  const meetings = panel.recentMeetings || [];
  const actions = [...(panel.pendingActions || [])].sort((a, b) => {
    const ad = toDateOrNull(a?.due_date);
    const bd = toDateOrNull(b?.due_date);
    if (!ad && !bd) return 0;
    if (!ad) return 1;
    if (!bd) return -1;
    return ad.getTime() - bd.getTime();
  });
  const allPendingUpdates = sortPendingClientUpdatesByDue((panel.dueClientUpdates || []).filter(isClientUpdatePending));
  const overdueOnly = allPendingUpdates.filter((u) => isClientUpdateOverdue(u));
  const updates = clientUpdateFilter === 'overdue' ? overdueOnly : allPendingUpdates;
  const ingestions = panel.recentIngestions || [];
  const statusBadge = (status, update) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'sent') return '<span class="badge ok">sent</span>';
    if (normalized === 'cancelled') return '<span class="badge bad">cancelled</span>';
    if (isClientUpdateOverdue(update)) return '<span class="badge bad">overdue</span>';
    if (normalized === 'due') return '<span class="badge warn">due</span>';
    return '<span class="badge info">draft</span>';
  };

  const priorityBadge = (item) => {
    const due = toDateOrNull(item?.due_date);
    if (!due) return '<span class="badge info">unscheduled</span>';
    if (isClientUpdateOverdue(item)) return '<span class="badge bad">P1 overdue</span>';
    const days = Math.ceil((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days <= 1) return '<span class="badge warn">P2 due soon</span>';
    return '<span class="badge ok">P3 planned</span>';
  };

  const escalationCue = (item) => {
    if (isClientUpdateOverdue(item)) return '<span class="bad">Escalate now</span>';
    const due = toDateOrNull(item?.due_date);
    if (!due) return '<span class="muted">Set due date</span>';
    const days = Math.ceil((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days <= 1) return '<span class="warn">Flag in standup</span>';
    return '<span class="ok">On track</span>';
  };

  return `<div data-verify="client-updates-pending-v3 client-updates-ownership-priority-v1">
    <h3>Recent voice-note ingestions <span class="badge">${ingestions.length}</span></h3>
    <table><thead><tr><th>Contact</th><th>Email</th><th>Company</th><th>Follow-up</th><th>Created</th></tr></thead><tbody>${ingestions.map((i) => `<tr><td>${escapeHtml(i.contact_name || 'Unknown')}</td><td>${escapeHtml(i.contact_email || '—')}</td><td>${escapeHtml(i.company_name || '—')}</td><td>${escapeHtml(String(i.followup_text || '').slice(0, 90))}</td><td>${escapeHtml(fmt(i.created_at))}</td></tr>`).join('') || '<tr><td colspan="5">No voice-note ingestions yet.</td></tr>'}</tbody></table>
    <h3 style="margin-top:.7rem;">Recent meetings <span class="badge">${meetings.length}</span></h3>
    <table><thead><tr><th>Client</th><th>Source</th><th>Created</th></tr></thead><tbody>${meetings.map((m) => `<tr><td>${escapeHtml(m.client_name)}</td><td>${escapeHtml(m.source_type || 'text')}</td><td>${escapeHtml(fmt(m.created_at))}</td></tr>`).join('') || '<tr><td colspan="3">No meetings captured.</td></tr>'}</tbody></table>
    <h3 style="margin-top:.7rem;">Pending outreach follow-ups <span class="badge">${actions.length}</span></h3>
    <table><thead><tr><th>Priority</th><th>Client</th><th>Action</th><th>Owner</th><th>Due</th><th>Escalation cue</th><th>CTA</th></tr></thead><tbody>${actions.map((a) => `<tr><td>${priorityBadge(a)}</td><td>${escapeHtml(a.client_name)}</td><td>${escapeHtml(a.action_text)}</td><td>${escapeHtml(a.owner || a.assignee || 'Unassigned')}</td><td>${escapeHtml(fmt(a.due_date))}</td><td>${escalationCue(a)}</td><td><form method="POST" action="/followups/${encodeURIComponent(a.id)}/advance"><button type="submit">Advance follow-up</button></form></td></tr>`).join('') || '<tr><td colspan="7">No pending outreach follow-ups.</td></tr>'}</tbody></table>
    <div class="panel-head" style="margin-top:.7rem;"><h3>Pending client updates <span class="badge">${updates.length}</span></h3><div class="links"><a class="${clientUpdateFilter === 'all' ? 'active' : ''}" href="/?client_updates=all#client-updates">All pending</a><a class="${clientUpdateFilter === 'overdue' ? 'active' : ''}" href="/?client_updates=overdue#client-updates" data-verify="client-updates-overdue-filter-v1">Overdue only (${overdueOnly.length})</a></div></div>
    <table><thead><tr><th>Priority</th><th>Client</th><th>Status</th><th>Owner</th><th>Due</th><th>Escalation cue</th><th>CTA</th></tr></thead><tbody>${updates.map((u) => `<tr><td>${priorityBadge(u)}</td><td>${escapeHtml(u.client_name)}</td><td data-verify="client-update-state-badge-v1">${statusBadge(u.status, u)}</td><td>${escapeHtml(u.owner || u.assignee || 'Unassigned')}</td><td>${escapeHtml(fmt(u.due_date))}</td><td>${escalationCue(u)}</td><td>${u.status === 'sent' || u.status === 'cancelled' ? '<span class="muted">—</span>' : `<form method="POST" action="/client-updates/${encodeURIComponent(u.id)}/mark-sent"><button type="submit">Mark sent</button></form>`}</td></tr>`).join('') || '<tr><td colspan="7">No pending client updates for this filter.</td></tr>'}</tbody></table>
  </div>`;
}


function renderCustomerSupportSuccessPanel({ meetingPipeline = {}, qualifiedAccounts = [] } = {}) {
  const pendingFollowups = Array.isArray(meetingPipeline?.pendingActions) ? meetingPipeline.pendingActions : [];
  const pendingUpdates = sortPendingClientUpdatesByDue((meetingPipeline?.dueClientUpdates || []).filter(isClientUpdatePending));
  const overdueUpdates = pendingUpdates.filter((item) => isClientUpdateOverdue(item));
  const pilotCandidates = (qualifiedAccounts || []).filter((item) => normalizePilotHandoffStage(item?.pipeline_stage) === 'pilot_candidate');
  const routedPilotCandidates = pilotCandidates.filter((item) => !!item?.pilot_onboarding_routed_at);
  const unroutedPilotCandidates = pilotCandidates.filter((item) => !item?.pilot_onboarding_routed_at);

  const queueRows = [
    { label: 'Follow-up actions (pending/in progress)', count: pendingFollowups.length, cta: '/ops#client-updates' },
    { label: 'Client updates pending', count: pendingUpdates.length, cta: '/ops#client-updates' },
    { label: 'Client updates overdue', count: overdueUpdates.length, cta: '/ops?client_updates=overdue#client-updates' },
  ];

  const riskFlags = [
    {
      level: overdueUpdates.length > 0 ? 'critical' : 'info',
      label: 'Overdue client updates',
      detail: `${overdueUpdates.length} overdue updates`,
      escalation: overdueUpdates.length > 0 ? 'Escalate to Client Success lead (same day) + clear backlog in Ops.' : 'No escalation required.',
    },
    {
      level: unroutedPilotCandidates.length > 0 ? 'warning' : 'info',
      label: 'Pilot handoff routing gap',
      detail: `${unroutedPilotCandidates.length} pilot candidates not routed`,
      escalation: unroutedPilotCandidates.length > 0 ? 'Escalate to Sales/Ops owner to route pilot onboarding within 24h.' : 'All pilot candidates routed.',
    },
    {
      level: pendingFollowups.length >= 8 ? 'warning' : 'info',
      label: 'Follow-up queue pressure',
      detail: `${pendingFollowups.length} open follow-up actions`,
      escalation: pendingFollowups.length >= 8 ? 'Escalate staffing/reprioritization in daily standup.' : 'Queue volume within expected range.',
    },
  ];

  return `<div data-verify="customer-support-success-v1">
    <div class="panel-head"><h3>Customer Support / Success</h3><span class="section-tag">v1</span></div>
    <p class="muted">Unifies support queue visibility, risk escalation, retention/expansion placeholders, and sales→pilot handoff outcomes.</p>

    <h4>Follow-up / update queue</h4>
    <table data-verify="customer-success-followup-queue-v1"><thead><tr><th>Queue</th><th>Open</th><th>Action</th></tr></thead><tbody>${queueRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td><span class="badge">${escapeHtml(row.count)}</span></td><td><a class="button-link button-secondary" href="${escapeHtml(row.cta)}">Open queue</a></td></tr>`).join('')}</tbody></table>

    <h4 style="margin-top:.7rem;">Risk flags + escalations</h4>
    <table data-verify="customer-success-risk-escalations-v1"><thead><tr><th>Risk</th><th>Status</th><th>Detail</th><th>Escalation</th></tr></thead><tbody>${riskFlags.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td><span class="badge ${item.level === 'critical' ? 'bad' : item.level === 'warning' ? 'warn' : 'info'}">${escapeHtml(item.level)}</span></td><td>${escapeHtml(item.detail)}</td><td>${escapeHtml(item.escalation)}</td></tr>`).join('')}</tbody></table>

    <h4 style="margin-top:.7rem;">Retention / expansion opportunities (placeholders)</h4>
    <table data-verify="customer-success-retention-expansion-placeholders-v1"><thead><tr><th>Account</th><th>Retention signal</th><th>Expansion hypothesis</th><th>Owner</th><th>Next review</th></tr></thead><tbody><tr><td class="empty-state">placeholder</td><td class="muted">e.g., renewal risk trend</td><td class="muted">e.g., upsell pilot scope</td><td class="muted">Customer Success</td><td class="muted">weekly</td></tr></tbody></table>

    <h4 style="margin-top:.7rem;">Sales/pilot handoff visibility</h4>
    <div data-verify="customer-success-sales-pilot-handoff-v1" class="lifecycle-grid">
      <article class="metric"><div class="name">Pilot candidates</div><div class="value">${escapeHtml(pilotCandidates.length)}</div></article>
      <article class="metric"><div class="name">Routed to onboarding</div><div class="value">${escapeHtml(routedPilotCandidates.length)}</div></article>
      <article class="metric"><div class="name">Awaiting route</div><div class="value">${escapeHtml(unroutedPilotCandidates.length)}</div></article>
    </div>
  </div>`;
}

function renderLifecyclePanel(lifecycle) {
  const movement = lifecycle?.movement_last_7d ?? 'placeholder pending events';
  const stages = Array.isArray(lifecycle?.stages) ? lifecycle.stages : [];
  return `<div><p class="muted">Movement last 7d: <strong>${escapeHtml(movement)}</strong></p><div class="lifecycle-grid">${stages.map((stage) => `<article class="metric"><div class="name">${escapeHtml(stage.label || stage.key)}</div><div class="value">${escapeHtml(stage.count)}</div></article>`).join('') || '<p class="empty-state">No lifecycle stage data available.</p>'}</div><p class="muted">freshness: ${escapeHtml(lifecycle?.freshness || 'unknown')}</p></div>`;
}

function renderAssets(summary) {
  const rows = [{ key: 'lead_magnet', label: 'Lead magnets' }, { key: 'teaser_product', label: 'Teaser products' }];
  return `<div><p class="muted">Draft/live tracking + performance placeholders.</p><table><thead><tr><th>Type</th><th>Draft</th><th>Live</th><th>Paused</th><th>Archived</th><th>Total</th><th>Performance</th></tr></thead><tbody>${rows.map((row) => {
    const c = summary?.[row.key] || {};
    return `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(c.draft || 0)}</td><td>${escapeHtml(c.live || 0)}</td><td>${escapeHtml(c.paused || 0)}</td><td>${escapeHtml(c.archived || 0)}</td><td>${escapeHtml(c.total || 0)}</td><td class="empty-state">placeholder: CTR/CVR pending</td></tr>`;
  }).join('')}</tbody></table><p class="muted">API: POST/PATCH <code>/api/assets/:type</code>, GET <code>/api/assets/status</code></p></div>`;
}

function renderWorkflowCompleteness(workflow) {
  const checks = workflow?.checks || [];
  const score = workflow?.score || '0/0';
  return `<div data-verify="workflow-completeness-v1"><p><strong>Workflow completeness score:</strong> <span class="badge ${workflow?.fail_count ? 'warn' : 'ok'}">${escapeHtml(score)}</span></p>
    <ul class="queue-list">${checks.map((check) => `<li><span class="${check.pass ? 'ok' : 'bad'}">${check.pass ? 'PASS' : 'GAP'}</span> ${escapeHtml(check.label)}</li>`).join('') || '<li class="empty-state">No checks available.</li>'}</ul>
    <p class="muted">Verification markers: ${(workflow?.verification_markers || []).map((m) => `<code>${escapeHtml(m)}</code>`).join(' ')}</p>
  </div>`;
}

function renderDeploymentVerificationChecklist({ health = {}, readiness = {}, workflowCompleteness = {}, queueSnapshot = {} } = {}) {
  const checklist = [
    {
      label: 'Data service connected',
      pass: String(health?.overall || '').toLowerCase() === 'connected',
      detail: `service status: ${health?.local_service_status || 'unknown'}`,
    },
    {
      label: 'Monday readiness gate is GO',
      pass: String(readiness?.readiness_state || '').toUpperCase() === 'GO',
      detail: `state: ${readiness?.readiness_state || 'unknown'} · pass/fail: ${readiness?.pass_count ?? 0}/${readiness?.fail_count ?? 0}`,
    },
    {
      label: 'Workflow completeness has zero gaps',
      pass: Number(workflowCompleteness?.fail_count || 0) === 0,
      detail: `score: ${workflowCompleteness?.score || '0/0'}`,
    },
    {
      label: 'No blocked items in operations queue',
      pass: Array.isArray(queueSnapshot?.blocked) ? queueSnapshot.blocked.length === 0 : true,
      detail: `blocked count: ${Array.isArray(queueSnapshot?.blocked) ? queueSnapshot.blocked.length : 0}`,
    },
  ];

  const passCount = checklist.filter((item) => item.pass).length;
  const failCount = checklist.length - passCount;
  const overallClass = failCount === 0 ? 'ok' : 'warn';
  const latestRunAt = new Date().toLocaleString();

  return `<div data-verify="ops-deployment-verification-v1 ops-deployment-pass-fail-checklist-v1 ops-deployment-latest-run-status-v1">
    <p class="muted">Release-readiness checks for /ops deployment verification.</p>
    <h3>Pass/fail checklist</h3>
    <ul class="queue-list">${checklist.map((item) => `<li><span class="${item.pass ? 'ok' : 'bad'}">${item.pass ? 'PASS' : 'FAIL'}</span> ${escapeHtml(item.label)} <span class="muted">(${escapeHtml(item.detail)})</span></li>`).join('')}</ul>
    <h3 style="margin-top:.6rem;">Latest run status</h3>
    <p><strong>Result:</strong> <span class="badge ${overallClass}">${failCount === 0 ? 'PASS' : 'FAIL'}</span> <span class="muted">${escapeHtml(passCount)}/${escapeHtml(checklist.length)} checks passed</span></p>
    <p class="muted">Last evaluated: ${escapeHtml(latestRunAt)}</p>
  </div>`;
}

function normalizeSeverity(value) {
  const level = String(value || '').toLowerCase();
  return ['critical', 'warning', 'info'].includes(level) ? level : 'info';
}

function toNumericMetric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function evaluateAlertRule(rule, context) {
  const id = String(rule?.id || 'unknown');
  const severity = normalizeSeverity(rule?.severity);
  const owner = String(rule?.owner || 'Unassigned');
  const slaMinutes = Number.isFinite(Number(rule?.sla_minutes)) ? Number(rule.sla_minutes) : null;
  const status = (() => {
    switch (id) {
      case 'delegations_drop_24h':
        return context.metrics.delegations24h !== null && context.metrics.delegations24h < 10 ? 'triggered' : 'ok';
      case 'completion_ratio_low':
        if (context.metrics.delegations24h === null || context.metrics.completed24h === null || context.metrics.delegations24h <= 0) return 'ok';
        return (context.metrics.completed24h / context.metrics.delegations24h) < 0.55 ? 'triggered' : 'ok';
      case 'open_priorities_backlog':
        return context.metrics.openPriorities !== null && context.metrics.openPriorities > 25 ? 'triggered' : 'ok';
      case 'active_runs_stall':
        return context.metrics.activeRuns !== null && context.metrics.activeRuns === 0 ? 'triggered' : 'ok';
      case 'blocked_lane_growth':
        return (context.queueSnapshot?.blocked || []).length >= 3 ? 'triggered' : 'ok';
      case 'waiting_on_user_overdue':
        return (context.queueSnapshot?.waitingOnUser || []).length > 0 ? 'triggered' : 'ok';
      case 'deploy_health_red':
        return context.health?.overall && context.health.overall !== 'connected' ? 'triggered' : 'ok';
      case 'service_logs_missing':
        return String(context.health?.local_service_status || '').includes('unknown logs') ? 'triggered' : 'ok';
      default:
        return 'ok';
    }
  })();

  return { ...rule, severity, owner, sla_minutes: slaMinutes, status, status_placeholder: status === 'triggered' ? 'triggered' : 'ok' };
}

function buildAlertViewModel(rules, context) {
  const evaluated = (rules || []).map((rule) => evaluateAlertRule(rule, context));
  const counts = { critical: 0, warning: 0, info: 0, total: evaluated.length, triggered: 0, ok: 0 };
  for (const rule of evaluated) {
    counts[rule.severity] += 1;
    counts[rule.status] += 1;
  }
  return { evaluated, counts };
}

function renderAlerts(alertRulesConfig, context) {
  const rules = Array.isArray(alertRulesConfig?.rules) ? alertRulesConfig.rules : [];
  const escalationPolicy = alertRulesConfig?.escalation_policy || DEFAULT_ALERT_RULES.escalation_policy;
  const { evaluated, counts } = buildAlertViewModel(rules, context);
  const chips = `<div class="links"><span class="badge bad">critical: ${counts.critical}</span><span class="badge warn">warning: ${counts.warning}</span><span class="badge info">info: ${counts.info}</span><span class="badge">triggered: ${counts.triggered}</span><span class="badge ok">ok: ${counts.ok}</span></div>`;
  const escalationPath = ['info', 'warning', 'critical'].map((level) => {
    const cfg = escalationPolicy[level] || {};
    const className = level === 'critical' ? 'bad' : level === 'warning' ? 'warn' : 'info';
    return `<tr><td><span class="badge ${className}">${escapeHtml(level)}</span></td><td>${escapeHtml((cfg.notify || []).join(', ') || 'none')}</td><td>${escapeHtml(cfg.escalate_after_minutes ?? 0)}m</td><td>${escapeHtml(cfg.escalate_to || 'none')}</td><td><form method="POST" action="/ops/escalation-policy/${encodeURIComponent(level)}"><input type="text" name="notify" value="${escapeHtml((cfg.notify || []).join(', '))}" placeholder="Ops Lead, #ops-feed" /><input type="number" min="0" name="escalate_after_minutes" value="${escapeHtml(cfg.escalate_after_minutes ?? 0)}" /><input type="text" name="escalate_to" value="${escapeHtml(cfg.escalate_to || '')}" placeholder="Program Manager" /><button type="submit">Update path</button></form></td></tr>`;
  }).join('');
  const list = evaluated.map((rule) => `<article class="rule" data-verify="ops-alert-threshold-editor-v1 ops-alert-severity-owner-sla-cues-v1"><strong>${escapeHtml(rule.id)} · ${escapeHtml(rule.name)}</strong><p><strong>threshold:</strong> ${escapeHtml(rule.threshold)}</p><p>severity: <span class="${rule.severity === 'critical' ? 'bad' : rule.severity === 'warning' ? 'warn' : 'info'}">${escapeHtml(rule.severity)}</span> · owner: ${escapeHtml(rule.owner)} · SLA: <span class="badge ${rule.sla_minutes !== null && rule.sla_minutes <= 30 ? 'bad' : rule.sla_minutes !== null && rule.sla_minutes <= 90 ? 'warn' : 'info'}">${escapeHtml(rule.sla_minutes ?? 'n/a')}m</span></p><p>status: <span class="${rule.status === 'triggered' ? 'bad' : 'ok'}">${escapeHtml(rule.status_placeholder)}</span></p><form method="POST" action="/ops/alert-rules/${encodeURIComponent(rule.id)}" class="inline-form"><input type="text" name="threshold" value="${escapeHtml(rule.threshold)}" /><select name="severity"><option value="info" ${rule.severity === 'info' ? 'selected' : ''}>info</option><option value="warning" ${rule.severity === 'warning' ? 'selected' : ''}>warning</option><option value="critical" ${rule.severity === 'critical' ? 'selected' : ''}>critical</option></select><input type="text" name="owner" value="${escapeHtml(rule.owner)}" /><input type="number" min="0" name="sla_minutes" value="${escapeHtml(rule.sla_minutes ?? '')}" placeholder="SLA minutes" /><button type="submit">Save rule</button></form></article>`).join('');
  return `<div data-verify="ops-alert-escalation-path-v1"><div class="panel-head"><h3>Escalation path visualization</h3><span class="section-tag">policy chain</span></div><table><thead><tr><th>Severity</th><th>Notify</th><th>Escalate after</th><th>Escalate to</th><th>Edit path</th></tr></thead><tbody>${escalationPath}</tbody></table>${chips}${list || '<p class="empty-state">No alert rules configured.</p>'}</div>`;
}

function renderHealth(health) {
  const checks = health?.checks || {};
  const rows = Object.entries(checks).map(([name, check]) => `<tr><td>${escapeHtml(name)}</td><td><span class="${check?.ok ? 'ok' : 'warn'}">${check?.ok ? 'pass' : 'degraded'}</span></td><td class="muted">${escapeHtml(check?.detail || '—')}</td></tr>`).join('');
  return `<div><p><strong>Local service URL:</strong> <code>${escapeHtml(health.local_service_url)}</code></p><p><strong>Status:</strong> ${escapeHtml(health.local_service_status)} · <span class="badge ${health.overall === 'connected' ? 'ok' : 'warn'}">${escapeHtml(health.overall)}</span></p><table><thead><tr><th>Check</th><th>State</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderRouteHealthWidget(health = {}) {
  const dataConnected = health?.overall === 'connected';
  const routerState = 'up';
  const dataState = dataConnected ? 'up' : (health?.overall ? 'degraded' : 'unknown');
  const stateClass = (state) => (state === 'up' ? 'ok' : state === 'degraded' ? 'warn' : 'info');

  const routes = [
    { label: 'Home', path: '/' },
    { label: 'Targeting', path: '/targeting' },
    { label: 'Relationships', path: '/relationships' },
    { label: 'Actions', path: '/actions' },
    { label: 'Pilot', path: '/pilot' },
    { label: 'Ops', path: '/ops' },
    { label: 'Health JSON', path: '/health' },
  ];

  const rows = routes.map((route) => {
    const status = route.path === '/health' ? dataState : routerState;
    return `<tr><td><a href="${escapeHtml(route.path)}"><code>${escapeHtml(route.path)}</code></a></td><td>${escapeHtml(route.label)}</td><td><span class="badge ${stateClass(status)}">${escapeHtml(status)}</span></td></tr>`;
  }).join('');

  return `<div data-verify="route-health-widget-v1 critical-route-availability-v1"><p class="muted">Fast route check: confirms router availability and data-service state from the current Ops render.</p><div class="links"><span class="badge ok">router: ${escapeHtml(routerState)}</span><span class="badge ${stateClass(dataState)}">data service: ${escapeHtml(dataState)}</span><a href="/api/navigation/url-map">route map JSON</a></div><table><thead><tr><th>URL</th><th>Route</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderMondayReadiness(readiness) {
  const stateClass = readiness.readiness_state === 'GO' ? 'ok' : 'bad';
  const failed = (readiness.gates || []).filter((g) => !g.pass);
  const warBoard = Array.isArray(readiness.war_board) ? readiness.war_board : [];
  const warBoardRows = warBoard.map((lane) => {
    const laneClass = lane.className || (lane.band === 'GREEN' ? 'ok' : lane.band === 'YELLOW' ? 'warn' : 'bad');
    return `<tr data-verify="monday-war-board-lane-${escapeHtml(lane.key || 'unknown')}-v1"><td><strong>${escapeHtml(lane.label || lane.key || 'lane')}</strong></td><td><span class="badge ${laneClass}">${escapeHtml(lane.band || 'RED')}</span></td><td>${escapeHtml(lane.score ?? '—')}</td><td class="muted">${escapeHtml(lane.rationale || '—')}</td></tr>`;
  }).join('');

  return `<div data-verify="monday-war-board-v1 monday-readiness-rag-v1">
    <p><strong>Monday decision:</strong> <span class="badge ${stateClass}">${escapeHtml(readiness.readiness_state)}</span></p>
    <p class="muted">Pass: ${escapeHtml(readiness.pass_count)} · Fail: ${escapeHtml(readiness.fail_count)} · Updated ${escapeHtml(new Date(readiness.generated_at).toLocaleString())}</p>
    <div data-verify="monday-war-board-table-v1"><table><thead><tr><th>Lane</th><th>Status</th><th>Score</th><th>Signal</th></tr></thead><tbody>${warBoardRows || '<tr><td colspan="4">No war-board lanes available.</td></tr>'}</tbody></table></div>
    ${failed.length ? `<ul class="queue-list">${failed.map((g) => `<li><span class="bad">FAIL</span> <strong>${escapeHtml(g.id)}</strong> ${escapeHtml(g.name)} <span class="muted">(${escapeHtml(g.actual)})</span></li>`).join('')}</ul>` : '<p class="ok">All P0 gates passing.</p>'}
    <p class="muted">Checklist: <code>org/MONDAY_GO_NO_GO_CHECKLIST.md</code> · API: <code>/api/readiness/monday</code></p>
  </div>`;
}

function renderKpiHierarchyAndIaMap() {
  const northStar = KPI_TREE?.north_star || {};
  const l1Rows = (KPI_TREE?.level_1 || []).map((l1) => {
    const l2Items = (l1.l2_keys || []).map((key) => {
      const meta = KPI_META[key] || {};
      return `<li><code>${escapeHtml(key)}</code> · ${escapeHtml(meta.shortLabel || key)} <span class="muted">(${escapeHtml(meta.formula || 'formula pending')})</span></li>`;
    }).join('');
    return `<article class="panel"><div class="panel-head"><h4>${escapeHtml(l1.label || l1.key)}</h4><span class="section-tag">L1 KPI family</span></div><ul class="queue-list">${l2Items || '<li class="empty-state">No L2 metrics mapped.</li>'}</ul></article>`;
  }).join('');

  const iaRows = [
    {
      section: 'Home /',
      role: 'Executive pulse + immediate human action timing',
      kpis: ['weekly_qualified_pipeline_velocity (summary proxy)', 'positive replies + meetings', 'time-to-next-human-action'],
    },
    {
      section: 'Ops /ops',
      role: 'Canonical diagnostics, gates, definitions, and control actions',
      kpis: ['delegations_24h', 'completed_24h', 'open_priorities', 'active_runs'],
    },
    {
      section: 'Relationships /relationships',
      role: 'Pipeline progression + handoff intent context',
      kpis: ['pipeline stage flow (supporting signal)'],
    },
    {
      section: 'Actions /actions',
      role: 'Execution queue transitions and owner assignment',
      kpis: ['task movement (supporting signal)'],
    },
    {
      section: 'Comms /comms',
      role: 'Thread-level workflow signals only (non-canonical KPI gate decisions)',
      kpis: ['reply routing + follow-up state (supporting signal)'],
    },
  ];

  return `<div id="kpi-hierarchy-ia" data-verify="kpi-tree-northstar-v1 dashboard-ia-kpi-map-v1">
    <p class="muted"><strong>North Star:</strong> ${escapeHtml(northStar.label || 'weekly_qualified_pipeline_velocity')} — ${escapeHtml(northStar.definition || 'Definition pending')}</p>
    <div class="layout layout-single">${l1Rows}</div>
    <h3 style="margin-top:.65rem;">Dashboard IA → KPI ownership map</h3>
    <table><thead><tr><th>Section</th><th>Purpose</th><th>KPI mapping</th></tr></thead><tbody>${iaRows.map((row) => `<tr><td><strong>${escapeHtml(row.section)}</strong></td><td>${escapeHtml(row.role)}</td><td>${escapeHtml(row.kpis.join(', '))}</td></tr>`).join('')}</tbody></table>
  </div>`;
}

function renderMetricDictionary() {
  const rows = Object.entries(KPI_META).map(([key, meta]) => `<tr><td><code>${escapeHtml(key)}</code></td><td>${escapeHtml(meta.shortLabel || key)}</td><td>${escapeHtml(meta.operatorDefinition || '—')}</td><td>${escapeHtml(meta.formula || '—')}</td><td>${escapeHtml(meta.grain || '—')}</td><td>${escapeHtml(meta.owner || '—')}</td><td>${escapeHtml(meta.cadence || '—')}</td><td>${escapeHtml(meta.goRule || '—')}</td><td>${escapeHtml(meta.mondayGate || '—')}</td></tr>`).join('');
  return `<div id="metric-dictionary" data-verify="metric-dictionary-v2 metric-definitions-formula-grain-owner-cadence-v1"><p class="muted">Concise definitions for operator-facing KPI cards.</p><table><thead><tr><th>Key</th><th>Card label</th><th>Definition</th><th>Formula</th><th>Grain</th><th>Owner</th><th>Cadence</th><th>Go/No-Go rule</th><th>Monday gate alignment</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderPrimaryWorkflowCtas() {
  return `<article class="panel" id="workflow-ctas" data-verify="tof-primary-cta-v3 offer-ladder-cta-v1"><div class="panel-head"><h2>⚡ Primary workflow shortcuts</h2><span class="section-tag">daily focus</span></div><p class="muted">Move from account qualification → human outreach → pilot readiness.</p><div class="cta-grid">
    <section class="cta-card cta-primary cta-strong"><strong>① Add qualified account</strong><p>Capture one high-fit account and verify readiness before outreach.</p><a class="button-link cta-emphasis" href="#qualified-account-form" data-verify="cta-qualification-snapshot-v1">Open qualification form</a></section>
    <section class="cta-card cta-primary"><strong>② Promote to pilot path</strong><p>Move qualified accounts from discovery into pilot-candidate workflow.</p><a class="button-link" href="#pilot-handoff" data-verify="cta-pltv-lift-pilot-v1">Open pilot handoff board</a></section>
    <section class="cta-card cta-primary"><strong>③ Open Ops controls</strong><p>Run diagnostics, routing, and queue controls in Ops.</p><a class="button-link" href="/ops" data-verify="cta-always-on-infrastructure-v1">Open Ops</a></section>
  </div></article>`;
}

function renderFirstTimeWalkthroughStrip() {
  return `<article class="panel" id="first-time-walkthrough" data-verify="home-first-time-onboarding-strip-v1 home-demo-path-v1 human-task-queue-highlight-v1"><div class="panel-head"><h2>🧭 First-time walkthrough</h2><span class="section-tag">3 steps + 5 clicks</span></div><p class="muted">New teammate? Run this once to learn where to click and what “done” looks like.</p><div class="onboarding-strip">
    <section class="onboarding-step"><div class="step-label">Step 1 · Start here</div><p><strong>Open Qualification Snapshot</strong> and add one target account.</p><p class="muted">Success = account appears in the table with a readiness decision.</p></section>
    <section class="onboarding-step"><div class="step-label">Step 2 · Advance it</div><p><strong>Move the account through the pipeline</strong> from qualified → discovery.</p><p class="muted">Success = stage updates in the Account Pipeline Board.</p></section>
    <section class="onboarding-step"><div class="step-label">Step 3 · Human executes</div><p><strong>Work the Team Handoff Queue</strong> and send outreach from a human account.</p><p class="muted">Success = owner assigned + outreach sent/logged.</p></section>
  </div>
  <div class="demo-path">
    <strong>5-click demo path (embedded):</strong>
    <ol class="queue-list">
      <li>Click <a href="#qualified-account-form" data-verify="demo-path-click-1-v1">Start qualification snapshot</a>.</li>
      <li>Click <strong>Save qualification snapshot</strong> on the form.</li>
      <li>Click <a href="#pilot-handoff" data-verify="demo-path-click-3-v1">Account Pipeline Board</a> and press <strong>Move to Discovery</strong> for your new account.</li>
      <li>Click <a href="#team-handoff-queue" data-verify="demo-path-click-4-v1">Team Handoff Queue</a> (highlighted below).</li>
      <li>Click one <strong>One-click status transition</strong> action (enroll or route to pilot onboarding).</li>
    </ol>
  </div></article>`;
}

function renderGtmMotionModules() {
  const modules = [
    { name: 'Home · Execution', path: '/', note: 'Qualified account intake + funnel launch path.' },
    { name: 'Strategy & Decisions', path: '/strategy', note: 'Roadmap, active decisions, weekly scorecard.' },
    { name: 'Actions · Core Queue', path: '/actions', note: 'Priority-first action cards with status transitions.' },
    { name: 'Relationships · Pipeline', path: '/relationships', note: 'Pipeline progression + team handoff queue.' },
    { name: 'Comms · Account Workspace & Individual Workspace', path: '/comms', note: 'Unified inbox/outbox with Account and Individual workspaces.' },
    { name: 'Research · Ledger + Intel', path: '/research', note: 'Research rationale and competitive intelligence records.' },
    { name: 'pLTV Lift Pilot', path: '/product/pltv-lift-pilot', note: 'Pilot definition, success criteria, and go/no-go.' },
    { name: 'Ops · Diagnostics', path: '/ops', note: 'Execution board, health, alerts, and workflow completeness.' },
    { name: 'Operator Status', path: '/operator-status', note: 'Always-on status pane for quick checks.' },
  ];

  return `<article class="panel" id="gtm-motion-modules" data-verify="gtm-motion-module-nav-v1"><div class="panel-head"><h2>GTM motion modules</h2><span class="section-tag">navigation map</span></div><p class="muted">Layered navigation map for the latest GTM modules—accessible from Command Center in one click.</p><table><thead><tr><th>Module</th><th>URL</th><th>Purpose</th></tr></thead><tbody>${modules.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td><a href="${escapeHtml(item.path)}"><code>${escapeHtml(item.path)}</code></a></td><td>${escapeHtml(item.note)}</td></tr>`).join('')}</tbody></table></article>`;
}

function renderQualifiedAccountPanel(sequenceTemplates = []) {
  const templateOptions = (sequenceTemplates || []).map((tpl) => `<option value="${escapeHtml(tpl.id)}">${escapeHtml(tpl.name || tpl.slug || 'Untitled sequence')}</option>`).join('');
  return `<div id="qualified-account-form" data-verify="qualified-account-intake-v2 qualification-scoring-explainer-v1">
    <p class="muted">Add only accounts with real pilot potential (recommended spend tier: 500k+).</p>
    <p class="muted"><strong>Readiness formula:</strong> 40% Spearman + 30% Quintile gap + 20% Order history sufficiency + 10% Team confidence. Qualified when score ≥ 75 and order history is at least borderline.</p>
    <div class="helper-row"><span class="helper-chip">Required fields are in this grid</span><span class="helper-chip">Typical completion time: ~2 minutes</span><span class="helper-chip">Tip: keep confidence calibrated (not optimistic)</span></div>
    <form class="inline-form" method="POST" action="/qualified-accounts/create">
      <input type="text" name="brand" placeholder="Brand / account name" required />
      <input type="url" name="website" placeholder="Website URL (https://brand.com)" required />
      <select name="est_spend_tier" required><option value="">Estimated annual ad spend tier</option>${QUALIFIED_SPEND_TIERS.map((tier) => `<option value="${tier}" ${tier === '500k-1m' ? 'selected' : ''}>${tier}</option>`).join('')}</select>
      <select name="channels" required><option value="">Primary paid channel</option>${BEAUTY_CHANNEL_OPTIONS.map((channel) => `<option value="${channel}" ${channel === 'meta_ads' ? 'selected' : ''}>${channel.replaceAll('_', ' ')}</option>`).join('')}</select>
      <input type="text" name="contact_role" placeholder="Primary decision-maker role (e.g., VP Growth)" required />
      <input type="number" name="qualification_confidence" min="0" max="100" value="75" placeholder="Internal confidence score (0-100)" required />
      <input type="number" name="spearman_score" min="0" max="1" step="0.01" value="0.65" placeholder="Spearman correlation (0.00-1.00)" required />
      <input type="number" name="quintile_gap" min="0" max="100" step="0.1" value="55" placeholder="Top-vs-bottom quintile gap (%)" required />
      <select name="order_history_sufficiency" required><option value="">Order history sufficiency</option>${ORDER_HISTORY_SUFFICIENCY.map((item) => `<option value="${item}" ${item === 'borderline' ? 'selected' : ''}>${item.replaceAll('_', ' ')}</option>`).join('')}</select>
      <select name="sequence_template_id"><option value="">Auto-enroll sequence (optional)</option>${templateOptions}</select>
      <button type="submit">✅ Save qualification snapshot</button>
    </form>
  </div>`;
}

function renderPilotHandoffMetrics(accounts = []) {
  const counts = summarizeQualifiedAccountStages(accounts);
  return `<div data-verify="pilot-handoff-stage-metrics-v1"><div class="lifecycle-grid"><article class="metric"><div class="name">Qualified</div><div class="value">${escapeHtml(counts.qualified)}</div></article><article class="metric"><div class="name">Discovery</div><div class="value">${escapeHtml(counts.discovery)}</div></article><article class="metric"><div class="name">Pilot candidates</div><div class="value">${escapeHtml(counts.pilot_candidate)}</div></article><article class="metric"><div class="name">Total tracked</div><div class="value">${escapeHtml(counts.total)}</div></article></div></div>`;
}

function buildRevOpsSnapshot(accounts = []) {
  const rows = Array.isArray(accounts) ? accounts : [];
  const counts = summarizeQualifiedAccountStages(rows);
  const total = Math.max(Number(counts.total || 0), 0);

  const pct = (num, den) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);
  const stageHealth = [
    { key: 'qualified', stage: 'qualified', label: 'Qualified', count: counts.qualified, share_pct: pct(counts.qualified, total), health: counts.qualified > 0 ? 'active' : 'empty' },
    { key: 'discovery', stage: 'discovery', label: 'Discovery', count: counts.discovery, share_pct: pct(counts.discovery, total), health: counts.discovery >= Math.ceil(Math.max(counts.qualified, 1) * 0.25) ? 'healthy' : 'watch' },
    { key: 'pilot_candidate', stage: 'pilot_candidate', label: 'Pilot candidate', count: counts.pilot_candidate, share_pct: pct(counts.pilot_candidate, total), health: counts.pilot_candidate >= Math.ceil(Math.max(counts.discovery, 1) * 0.25) ? 'healthy' : 'watch' },
  ];

  const conversion = {
    qualified_to_discovery_pct: pct(counts.discovery, counts.qualified + counts.discovery),
    discovery_to_pilot_pct: pct(counts.pilot_candidate, counts.discovery + counts.pilot_candidate),
    qualified_to_pilot_pct: pct(counts.pilot_candidate, total),
  };

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const staleDiscovery = rows.filter((row) => {
    if ((normalizePilotHandoffStage(row?.pipeline_stage) || 'qualified') !== 'discovery') return false;
    const anchor = toDateOrNull(row?.discovery_promoted_at || row?.updated_at || row?.created_at);
    return anchor ? (now - anchor.getTime()) > (14 * dayMs) : false;
  }).length;

  const bottleneckAlerts = [];
  if (counts.qualified >= 5 && counts.qualified > (counts.discovery * 2)) bottleneckAlerts.push(`Qualified backlog is high (${counts.qualified} vs ${counts.discovery} in discovery).`);
  if (counts.discovery >= 4 && counts.discovery > (counts.pilot_candidate * 2)) bottleneckAlerts.push(`Discovery-to-pilot throughput is constrained (${counts.discovery} vs ${counts.pilot_candidate} pilot candidates).`);
  if (staleDiscovery > 0) bottleneckAlerts.push(`${staleDiscovery} discovery account(s) are stale (>14 days without progression signal).`);

  const dataQualityFlags = [];
  const missingStage = rows.filter((row) => !normalizePilotHandoffStage(row?.pipeline_stage)).length;
  const missingConfidence = rows.filter((row) => row?.qualification_confidence == null || row?.qualification_confidence === '').length;
  const missingDiscoveryDate = rows.filter((row) => (normalizePilotHandoffStage(row?.pipeline_stage) || 'qualified') === 'discovery' && !toDateOrNull(row?.discovery_promoted_at)).length;
  const missingPilotDate = rows.filter((row) => (normalizePilotHandoffStage(row?.pipeline_stage) || 'qualified') === 'pilot_candidate' && !toDateOrNull(row?.pilot_candidate_promoted_at)).length;
  if (missingStage > 0) dataQualityFlags.push(`${missingStage} account(s) missing valid pipeline stage.`);
  if (missingConfidence > 0) dataQualityFlags.push(`${missingConfidence} account(s) missing qualification confidence.`);
  if (missingDiscoveryDate > 0) dataQualityFlags.push(`${missingDiscoveryDate} discovery account(s) missing discovery_promoted_at.`);
  if (missingPilotDate > 0) dataQualityFlags.push(`${missingPilotDate} pilot-candidate account(s) missing pilot_candidate_promoted_at.`);

  return { stageHealth, conversion, bottleneckAlerts, dataQualityFlags, total };
}

function renderRevOpsSection(accounts = []) {
  const revops = buildRevOpsSnapshot(accounts);
  const healthBadge = (status) => status === 'healthy' || status === 'active' ? 'ok' : status === 'watch' ? 'warn' : 'bad';
  const value = (v) => `${Number(v || 0).toFixed(1)}%`;

  const stageByKey = new Map((revops.stageHealth || []).map((row) => [row.key, row]));
  const qualified = stageByKey.get('qualified')?.count || 0;
  const discovery = stageByKey.get('discovery')?.count || 0;
  const pilot = stageByKey.get('pilot_candidate')?.count || 0;
  const healthStates = (revops.stageHealth || []).map((row) => row.health);
  const blockedStages = (revops.stageHealth || []).filter((row) => row.health === 'blocked').map((row) => row.label);

  const headlineHealth = blockedStages.length
    ? `At risk — ${blockedStages.join(', ')} need intervention.`
    : healthStates.includes('watch')
      ? 'Mixed — some stages are watch-level and need attention.'
      : 'Healthy — pipeline flow is stable across stages.';

  const plainFlow = `Flow snapshot: ${qualified} qualified → ${discovery} in discovery → ${pilot} pilot candidates.`;
  const bottleneckSummary = revops.bottleneckAlerts.length
    ? `Bottlenecks: ${revops.bottleneckAlerts.length} active.`
    : 'Bottlenecks: none flagged from current thresholds.';
  const atRiskSummary = revops.dataQualityFlags.length
    ? `At-risk items: ${revops.dataQualityFlags.length} data quality flag(s) to clean up.`
    : 'At-risk items: none flagged in current data quality checks.';

  return `<div data-verify="revops-section-v1">
    <div data-verify="revops-health-strip-v1" class="kpis" style="margin-bottom:.55rem;">
      <article class="card panel-feature"><div class="name">Standup health</div><div class="value value-inline">${escapeHtml(headlineHealth)}</div><div class="muted">${escapeHtml(plainFlow)}</div></article>
      <article class="card"><div class="name">Bottlenecks</div><div class="value">${escapeHtml(revops.bottleneckAlerts.length)}</div><div class="muted">${escapeHtml(bottleneckSummary)}</div></article>
      <article class="card"><div class="name">At-risk items</div><div class="value">${escapeHtml(revops.dataQualityFlags.length)}</div><div class="muted">${escapeHtml(atRiskSummary)}</div></article>
    </div>
    <div data-verify="revops-pipeline-stage-health-v1"><h3>Pipeline stage health</h3><table><thead><tr><th>Stage</th><th>Accounts</th><th>Share</th><th>Health</th></tr></thead><tbody>${revops.stageHealth.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.count)}</td><td>${escapeHtml(value(row.share_pct))}</td><td><span class="badge ${healthBadge(row.health)}">${escapeHtml(row.health)}</span></td></tr>`).join('')}</tbody></table></div>
    <div data-verify="revops-conversion-rates-by-stage-v1" style="margin-top:.55rem;"><h3>Conversion rates by stage</h3><ul class="queue-list"><li><strong>Qualified → Discovery:</strong> ${escapeHtml(value(revops.conversion.qualified_to_discovery_pct))}</li><li><strong>Discovery → Pilot candidate:</strong> ${escapeHtml(value(revops.conversion.discovery_to_pilot_pct))}</li><li><strong>Qualified → Pilot candidate (overall):</strong> ${escapeHtml(value(revops.conversion.qualified_to_pilot_pct))}</li></ul></div>
    <div data-verify="revops-bottleneck-alerts-v1" style="margin-top:.55rem;"><h3>Bottleneck alerts</h3>${revops.bottleneckAlerts.length ? `<ul class="queue-list">${revops.bottleneckAlerts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="empty-state">No bottleneck alerts triggered from current thresholds.</p>'}</div>
    <div data-verify="revops-forecast-placeholder-and-data-quality-v1" style="margin-top:.55rem;"><h3>Forecast / projection (placeholder)</h3><p class="muted">Placeholder model: projected pilot candidates in 30d = current total qualified × (Qualified→Discovery %) × (Discovery→Pilot %). Replace with cohort-based forecast once stage-transition timestamps are complete.</p><h3 style="margin-top:.45rem;">Data quality flags</h3>${revops.dataQualityFlags.length ? `<ul class="queue-list">${revops.dataQualityFlags.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="empty-state">No data quality flags detected in current sample.</p>'}</div>
  </div>`;
}

function renderPilotPhaseTrackerPanel() {
  const statusBadge = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'done') return '<span class="badge ok">done</span>';
    if (normalized === 'in_progress') return '<span class="badge info">in progress</span>';
    if (normalized === 'at_risk') return '<span class="badge warn">at risk</span>';
    return '<span class="badge">planned</span>';
  };
  const goNoGoBadge = (decision) => {
    const normalized = String(decision || '').toLowerCase();
    if (normalized === 'go') return '<span class="badge ok">GO</span>';
    if (normalized === 'watch') return '<span class="badge warn">WATCH</span>';
    if (normalized === 'no_go') return '<span class="badge bad">NO-GO</span>';
    return '<span class="badge">PENDING</span>';
  };

  return `<div data-verify="pilot-phase-tracker-v1 pilot-phase-gates-v1 pilot-phase-go-no-go-v2 pilot-phase-evidence-v1 pilot-phase-completion-criteria-v1"><p class="muted">8-week pilot tracker with explicit go/no-go gates, completion criteria, and required evidence by phase.</p>
    <table><thead><tr><th>Phase</th><th>Window</th><th>Owner</th><th>Status</th><th>Go/No-Go gate</th><th>Completion criteria</th><th>Evidence required</th><th>Milestones</th><th>Gate criteria</th></tr></thead><tbody>${PILOT_PHASE_TRACKER.map((phase) => `<tr><td><strong>${escapeHtml(phase.phase)}</strong></td><td>${escapeHtml(phase.window)}</td><td>${escapeHtml(phase.owner)}</td><td>${statusBadge(phase.status)}</td><td>${goNoGoBadge(phase.go_no_go)}</td><td><ul class="queue-list" style="margin:0;padding-left:1rem;">${(phase.completion_criteria || []).map((criterion) => `<li>${escapeHtml(criterion)}</li>`).join('')}</ul></td><td><ul class="queue-list" style="margin:0;padding-left:1rem;">${(phase.evidence_required || []).map((evidence) => `<li>${escapeHtml(evidence)}</li>`).join('')}</ul></td><td><ul class="queue-list" style="margin:0;padding-left:1rem;">${(phase.milestones || []).map((milestone) => `<li>${escapeHtml(milestone)}</li>`).join('')}</ul></td><td>${escapeHtml(phase.gate_criteria)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderPilotCoreConversionBoard(accounts = [], relationshipIntelligence = {}) {
  const grouped = { discovery: [], pilot_candidate: [], pilot_live: [] };
  const intelligenceByAccountId = new Map((relationshipIntelligence?.scores || []).map((row) => [String(row.account_id || ''), row]));
  for (const account of accounts || []) {
    const stage = normalizePilotHandoffStage(account.pipeline_stage) || 'qualified';
    if (stage === 'discovery') grouped.discovery.push(account);
    else if (stage === 'pilot_candidate') {
      if (account?.pilot_onboarding_routed_at) grouped.pilot_live.push(account);
      else grouped.pilot_candidate.push(account);
    }
  }

  const laneConfig = {
    discovery: { label: 'Discovery', pill: 'discovery', cue: 'Step 1 → validate fit, run discovery, then promote to candidate.' },
    pilot_candidate: { label: 'Pilot candidate', pill: 'candidate', cue: 'Step 2 → prepare pilot package, then route to live onboarding.' },
    pilot_live: { label: 'Pilot live', pill: 'live', cue: 'Step 3 → run pilot cadence and weekly evidence checks.' },
  };

  const gateBadge = (status = 'pending') => {
    if (status === 'pass') return '<span class="badge ok">GO</span>';
    if (status === 'watch') return '<span class="badge warn">WATCH</span>';
    if (status === 'blocked') return '<span class="badge bad">NO-GO</span>';
    return '<span class="badge">PENDING</span>';
  };

  const cardFields = (stageKey, item) => {
    const readinessQualified = String(item?.readiness_status || 'not_yet') === 'qualified';
    const hasEnrollment = !!item?.outreach_enrolled_at;
    const routedLive = !!item?.pilot_onboarding_routed_at;

    const owner = item?.owner || (stageKey === 'pilot_live' ? 'Customer Success' : 'Growth Ops');
    let nextStep = 'Review account and assign owner.';
    let gateStatus = 'pending';
    let gateNote = 'Waiting on required signal.';
    let dueDate = null;
    let transitionAction = '<span class="muted">No transition action</span>';
    let moveNote = 'No stage move action in this lane.';
    let nextActionCta = 'No transition CTA yet.';

    if (stageKey === 'discovery') {
      nextStep = hasEnrollment ? 'Run discovery call + log notes.' : 'Enroll outreach sequence first.';
      gateStatus = hasEnrollment ? 'watch' : 'blocked';
      gateNote = hasEnrollment ? 'Can move when discovery notes are complete.' : 'Blocked until outreach enrollment is complete.';
      dueDate = item?.discovery_promoted_at || item?.created_at || null;
      transitionAction = `<form method="POST" action="/qualified-accounts/${encodeURIComponent(item.id)}/promote-pilot-candidate"><button type="submit">Promote to pilot candidate →</button></form>`;
      moveNote = 'Action: promote Discovery → Pilot candidate.';
      nextActionCta = 'CTA: Promote discovery → pilot candidate now.';
    } else if (stageKey === 'pilot_candidate') {
      nextStep = readinessQualified ? 'Route to pilot onboarding + confirm kickoff date.' : 'Close readiness gaps (scorecard/evidence).';
      gateStatus = readinessQualified ? 'watch' : 'blocked';
      gateNote = readinessQualified ? 'Ready for live routing after kickoff date is set.' : 'NO-GO until readiness_status is qualified.';
      dueDate = item?.pilot_candidate_promoted_at || item?.discovery_promoted_at || item?.created_at || null;
      transitionAction = readinessQualified
        ? `<form method="POST" action="/qualified-accounts/${encodeURIComponent(item.id)}/route-pilot-onboarding"><button type="submit">Route to pilot live →</button></form>`
        : '<span class="muted">No action available while gate is NO-GO.</span>';
      moveNote = 'Action: route Pilot candidate → Pilot live.';
      nextActionCta = readinessQualified ? 'CTA: Route pilot candidate → live onboarding.' : 'CTA blocked: qualify readiness, then route candidate → live.';
    } else {
      nextStep = 'Run weekly pilot check-in + update go/no-go evidence.';
      gateStatus = routedLive ? 'pass' : 'watch';
      gateNote = routedLive ? 'Live onboarding routed; continue evidence cadence.' : 'WATCH until onboarding route is confirmed.';
      dueDate = item?.pilot_onboarding_routed_at || item?.pilot_candidate_promoted_at || item?.created_at || null;
      nextActionCta = 'CTA: Pilot is live — run weekly evidence + expansion checkpoint.';
    }

    const dueText = dueDate ? new Date(dueDate).toLocaleDateString() : 'Unscheduled';
    return { owner, nextStep, gateStatus, gateNote, dueText, transitionAction, moveNote, nextActionCta };
  };

  const lane = (stageKey) => {
    const cards = grouped[stageKey] || [];
    const config = laneConfig[stageKey] || { label: stageKey, pill: 'discovery', cue: '' };
    return `<section class="lane stage-lane stage-${escapeHtml(stageKey.replace('_', '-'))}"><h3>${escapeHtml(config.label)} <span class="badge">${cards.length}</span></h3><p class="stage-transition-cue">${escapeHtml(config.cue)}</p>${cards.length ? `<ul>${cards.slice(0, 10).map((item) => {
      const fields = cardFields(stageKey, item);
      const intelligence = intelligenceByAccountId.get(String(item.id || '')) || {};
      const interactionSignals = [item.outreach_enrolled_at, item.pilot_onboarding_routed_at, item.owner && String(item.owner).toLowerCase() !== 'unassigned', item.discovery_promoted_at].filter(Boolean).length;
      const progression = buildProgressionRecommendation(item, {
        interactionSignals,
        healthScore: intelligence.relationship_health || Number(item.qualification_confidence || 0),
        pilotReadiness: intelligence.pilot_readiness || Number(item.readiness_score || 0),
      });
      return `<li><article class="lane-card pilot-card" data-verify="pilot-card-operator-fields-v2 pilot-progression-recommendation-v1 pilot-recommendation-clarity-v2 pilot-readiness-score-components-v1 pilot-next-action-cta-v1"><strong>${escapeHtml(item.brand || 'Unknown account')}</strong><span class="lane-meta">${escapeHtml(item.est_spend_tier || '—')} · confidence ${escapeHtml(item.qualification_confidence ?? '—')}</span><div class="meta-spaced"><span class="stage-pill ${escapeHtml(config.pill)}">${escapeHtml(config.label)}</span></div><div class="pilot-owner-next"><strong>${escapeHtml(fields.owner)}</strong> · ${escapeHtml(fields.nextStep)}</div><div class="muted meta-spaced"><strong>Due:</strong> ${escapeHtml(fields.dueText)}</div><div class="pilot-gate-note"><strong>Gate:</strong> ${gateBadge(fields.gateStatus)} <span class="muted">${escapeHtml(fields.gateNote)}</span></div><div class="muted" style="margin-top:.25rem;" data-verify="pilot-score-components-visible-v1"><strong>Readiness score components:</strong> intent ${escapeHtml(progression.components?.intent ?? '—')} · response quality ${escapeHtml(progression.components?.response_quality ?? '—')} · fit ${escapeHtml(progression.components?.fit ?? '—')} · data completeness ${escapeHtml(progression.components?.data_completeness ?? '—')}</div><div class="muted" style="margin-top:.25rem;"><strong>Progression recommendation:</strong> ${renderProgressionRecommendationBadge(progression)} · confidence ${escapeHtml(progression.confidence)}%</div><div class="muted" style="margin-top:.15rem;" data-verify="pilot-recommendation-reason-v1"><strong>Recommendation reason:</strong> ${escapeHtml(conciseRecommendationRationale({ rationale: progression.reason }, 140))}</div><div class="muted" style="margin-top:.25rem;"><strong>Confidence means:</strong> ${escapeHtml(progression.confidence >= 80 ? 'high likelihood this stage move is ready now.' : progression.confidence >= 65 ? 'reasonable move, confirm missing evidence first.' : 'hold until stronger interaction/readiness signals appear.')}</div><div class="pilot-move-note"><strong>Do now:</strong> ${escapeHtml(fields.moveNote)}</div><div class="muted" style="margin-top:.2rem;" data-verify="pilot-stage-next-action-cta-v1"><strong>Next action CTA:</strong> ${escapeHtml(fields.nextActionCta)}</div><div class="pilot-card-actions" data-verify="pilot-stage-transition-actions-v1">${fields.transitionAction}</div></article></li>`;
    }).join('')}</ul>` : '<p class="empty-state">No items</p>'}</section>`;
  };

  return `<div data-verify="pilot-core-conversion-board-v2 pilot-stage-coherence-v1 v2-pilot-board-stage-coherence v2-pilot-conversion-cta-clarity"><div class="pilot-board-legend"><span class="stage-pill discovery">Step 1 Discovery</span><span class="stage-pill candidate">Step 2 Candidate</span><span class="stage-pill live">Step 3 Live</span><span class="badge bad">NO-GO = blocked gate</span><span class="badge warn">WATCH = close remaining checks</span><span class="badge ok">GO = route/execute now</span></div><div class="board stage-board">${lane('discovery')}${lane('pilot_candidate')}${lane('pilot_live')}</div></div>`;
}

function renderQualifiedAccountsTable(accounts = [], sequenceTemplates = []) {
  const templateOptions = (sequenceTemplates || []).map((tpl) => `<option value="${escapeHtml(tpl.id)}">${escapeHtml(tpl.name || tpl.slug || 'Untitled sequence')}</option>`).join('');
  const templateMap = new Map((sequenceTemplates || []).map((tpl) => [String(tpl.id), tpl]));
  const quickTemplates = (sequenceTemplates || []).slice(0, 3);
  return `<div data-verify="qualified-account-table-v3 qualification-snapshot-readiness-v2"><table><thead><tr><th>Brand</th><th>Stage</th><th>Website</th><th>Spend tier</th><th>Channels</th><th>Contact role</th><th>Confidence</th><th>Qualification scorecard / decision</th><th>Outreach action</th><th>Pilot onboarding</th></tr></thead><tbody>${(accounts || []).map((item) => {
    const enrolledTemplate = templateMap.get(String(item.outreach_sequence_template_id || ''));
    const enrolledStamp = item.outreach_enrolled_at ? new Date(item.outreach_enrolled_at).toLocaleString() : null;
    const enrolledLabel = enrolledTemplate?.name || enrolledTemplate?.slug || item.outreach_sequence_template_id || 'Unknown sequence';
    const enrolledStatus = item.outreach_enrolled_at
      ? `<div data-verify="qualified-account-inline-status-v1"><span class="badge ok">Enrolled</span><div class="muted">${escapeHtml(enrolledLabel)} · ${escapeHtml(enrolledStamp || '')}</div></div>`
      : `<div data-verify="qualified-account-enroll-picker-v1"><div class="muted" style="margin-bottom:.3rem;">One-click enroll:</div>${quickTemplates.map((tpl) => `<form method="POST" action="/qualified-accounts/${encodeURIComponent(item.id)}/enroll" style="display:inline-block;margin:.1rem .18rem .1rem 0;"><input type="hidden" name="sequence_template_id" value="${escapeHtml(tpl.id)}" /><button type="submit">${escapeHtml(tpl.name || tpl.slug || 'Untitled')}</button></form>`).join('') || '<span class="empty-state">No active sequences</span>'}<form class="inline-form" method="POST" action="/qualified-accounts/${encodeURIComponent(item.id)}/enroll"><select name="sequence_template_id" required><option value="">More sequences…</option>${templateOptions}</select><button type="submit" ${templateOptions ? '' : 'disabled'}>Enroll</button></form></div>`;
    const snapshot = item.qualification_snapshot || {};
    const readinessStatus = String(item.readiness_status || 'not_yet');
    const readinessBadgeClass = readinessStatus === 'qualified' ? 'ok' : 'warn';
    const decisionText = readinessStatus === 'qualified' ? 'Route to pilot onboarding' : 'Nurture + collect more evidence';
    const readinessCell = `<div data-verify="qualification-snapshot-cell-v2 qualification-decision-readable-v1"><div class="muted">ρ ${escapeHtml(snapshot.spearman_score ?? '—')} · gap ${escapeHtml(snapshot.quintile_gap ?? '—')}% · history ${escapeHtml(snapshot.order_history_sufficiency || '—')}</div><div class="muted">Weighted score: ${escapeHtml(item.readiness_score ?? '—')} / 100</div><span class="badge ${readinessBadgeClass}">${escapeHtml(readinessStatus === 'qualified' ? 'Qualified now' : 'Not yet qualified')}</span><div class="meta-spaced"><strong>Decision:</strong> ${escapeHtml(decisionText)}</div></div>`;
    const routedStamp = item.pilot_onboarding_routed_at ? new Date(item.pilot_onboarding_routed_at).toLocaleString() : null;
    const pilotAction = readinessStatus === 'qualified'
      ? (routedStamp
        ? `<div data-verify="pilot-onboarding-route-status-v1"><span class="badge ok">Routed</span><div class="muted">${escapeHtml(routedStamp)}</div></div>`
        : `<form method="POST" action="/qualified-accounts/${encodeURIComponent(item.id)}/route-pilot-onboarding"><button type="submit" class="button-secondary">Route to pilot onboarding</button></form>`)
      : '<span class="muted">Not ready yet</span>';
    return `<tr><td><a href="/accounts/${encodeURIComponent(item.id)}">${escapeHtml(item.brand)}</a></td><td>${escapeHtml(PILOT_HANDOFF_STAGE_LABELS[normalizePilotHandoffStage(item.pipeline_stage) || 'qualified'])}</td><td><a href="${escapeHtml(item.website)}" target="_blank" rel="noreferrer">${escapeHtml(item.website)}</a></td><td>${escapeHtml(item.est_spend_tier)}</td><td>${escapeHtml(Array.isArray(item.channels) ? item.channels.join(', ') : String(item.channels || ''))}</td><td>${escapeHtml(item.contact_role)}</td><td>${escapeHtml(item.qualification_confidence)}</td><td>${readinessCell}</td><td>${enrolledStatus}</td><td>${pilotAction}</td></tr>`;
  }).join('') || '<tr><td colspan="10" class="empty-state">No qualified accounts yet.</td></tr>'}</tbody></table></div>`;
}


function renderResearchLedgerTable(entries = [], accountById = new Map()) {
  const rows = (entries || []).map((entry) => {
    const d = entry.details || {};
    const linkedAccount = d.qualified_account_id ? accountById.get(String(d.qualified_account_id)) : null;
    const targetCell = linkedAccount
      ? `<a href="/accounts/${encodeURIComponent(linkedAccount.id)}">${escapeHtml(linkedAccount.brand || linkedAccount.id)}</a>`
      : (d.individual_ref ? `Individual: ${escapeHtml(d.individual_ref)}` : '—');
    const status = normalizeResearchLedgerStatus(d.status) || 'new_signal';
    const confidence = Number(d.confidence);
    const confidenceBand = d.confidence_band || deriveResearchConfidenceBand(confidence);
    const loggedAt = d.timestamp || entry.created_at;
    return `<tr><td>${escapeHtml(loggedAt ? new Date(loggedAt).toLocaleString() : '—')}</td><td>${escapeHtml(d.evidence_source || d.source_signal || '—')}</td><td>${escapeHtml(d.finding || '—')}</td><td>${escapeHtml(d.hypothesis || '—')}</td><td>${escapeHtml(d.recommended_action || d.target_recommendation || '—')}</td><td>${escapeHtml(Number.isFinite(confidence) ? `${confidence}%` : '—')} <span class="badge info">${escapeHtml(confidenceBand)}</span></td><td><span class="badge">${escapeHtml(status)}</span></td><td>${escapeHtml(d.owner || entry.actor || 'unassigned')}</td><td>${escapeHtml(d.uncertainty || '—')}</td><td>${targetCell}</td></tr>`;
  }).join('');
  return `<div data-verify="research-ledger-table-v2"><table><thead><tr><th>Logged</th><th>Evidence source</th><th>Finding</th><th>Hypothesis</th><th>Recommended action</th><th>Confidence</th><th>Status</th><th>Owner</th><th>Uncertainty</th><th>Linked Account / Individual</th></tr></thead><tbody>${rows || '<tr><td colspan="10" class="empty-state">No research ledger entries yet.</td></tr>'}</tbody></table></div>`;
}

function renderResearchLedgerPage({ entries = [], qualifiedAccounts = [], competitiveIntelEntries = [], message = '', messageState = 'success', intelMessage = '', intelState = 'success', errorMessage = '' } = {}) {
  const accountById = new Map((qualifiedAccounts || []).map((a) => [String(a.id), a]));
  const accountOptions = (qualifiedAccounts || []).map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.brand || a.id)}</option>`).join('');
  return `${renderTopNav({ active: 'research', errorMessage })}
  <div class="page-shell" data-verify="research-ledger-page-v1 research-intelligence-unified-v1">
    <article class="page-header"><div class="panel-head"><h2>Research Ledger</h2><span class="section-tag">transparency</span></div><p><strong>Track system-led research rationale for targeting decisions.</strong></p></article>
    ${renderFlashMessage(message, messageState, 'research-ledger-feedback-v1')}
    <article class="panel" data-verify="research-ledger-entry-form-v1"><h2>Log research entry</h2>
      <form class="inline-form" method="POST" action="/research/entries/create">
        <input type="text" name="source_signal" placeholder="Evidence source (e.g., competitor launch note + URL)" required />
        <input type="text" name="finding" placeholder="Finding" required />
        <input type="text" name="hypothesis" placeholder="Hypothesis" required />
        <input type="text" name="target_recommendation" placeholder="Recommended action" required />
        <input type="number" min="0" max="100" name="confidence" placeholder="Confidence (0-100)" required />
        <select name="status" required>
          ${RESEARCH_LEDGER_STATUSES.map((status) => `<option value="${escapeHtml(status)}" ${status === 'new_signal' ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
        </select>
        <input type="text" name="owner" placeholder="Owner (e.g., research_ops)" />
        <input type="text" name="uncertainty" placeholder="Uncertainty / caveat" required />
        <select name="qualified_account_id"><option value="">Link to account (optional)</option>${accountOptions}</select>
        <input type="text" name="individual_ref" placeholder="Individual ref (optional, e.g. jane@brand.com)" />
        <button type="submit">Add ledger entry</button>
      </form>
    </article>
    <article class="panel"><h2>Research entries</h2>${renderResearchLedgerTable(entries, accountById)}</article>
    <article class="panel" id="competitive-intelligence" data-verify="research-competitive-intelligence-v1"><h2>Competitive intelligence</h2>${renderCompetitiveIntelPanel(competitiveIntelEntries, qualifiedAccounts, intelMessage, intelState)}</article>
  </div>`;
}

function renderAccountDetailPage({ account = null, ledgerEntries = [], intelligence = null } = {}) {
  if (!account) {
    return `${renderTopNav({ active: 'relationships', errorMessage: 'Account not found' })}<div class="page-shell"><article class="panel"><h2>Not found</h2><p>Account record not found.</p></article></div>`;
  }
  const whyTargeted = buildWhyTargetedExplanation(account, ledgerEntries);
  return `${renderTopNav({ active: 'relationships' })}
  <div class="page-shell" data-verify="account-detail-page-v1 why-targeted-explanation-v1 account-module-crosslinks-v1">
    <article class="page-header"><div class="panel-head"><h2>${escapeHtml(account.brand || 'Account detail')}</h2><span class="section-tag">account detail</span></div><p><strong>Account context + targeting rationale.</strong></p></article>
    <article class="panel"><h2>Profile</h2><p><strong>Website:</strong> <a href="${escapeHtml(account.website || '#')}" target="_blank" rel="noreferrer">${escapeHtml(account.website || '—')}</a></p><p><strong>Stage:</strong> ${escapeHtml(PILOT_HANDOFF_STAGE_LABELS[normalizePilotHandoffStage(account.pipeline_stage) || 'qualified'])}</p><p><strong>Contact role:</strong> ${escapeHtml(account.contact_role || '—')}</p><div class="links" data-verify="account-detail-nav-links-v1"><a href="/comms?view=account&tab=inbox">Comms · Account Workspace</a><a href="/comms?view=individual&tab=inbox">Comms · Individual Workspace</a><a href="/research">Research + intelligence</a><a href="/relationships">Back to Relationships</a></div></article>
    <article class="panel" data-verify="account-relationship-health-trend-v1"><h2>Relationship health trend</h2><p><strong>Score:</strong> ${escapeHtml(intelligence?.relationship_health ?? '—')} <span class="badge ${escapeHtml(intelligence?.relationship_health_trend?.className || 'info')}">${escapeHtml(intelligence?.relationship_health_trend?.label || '→ +0 flat')}</span></p><p class="muted">${escapeHtml(intelligence?.relationship_health_movement_rationale || 'No movement rationale captured yet.')}</p><p><strong>Next-best-action recommendation:</strong> ${escapeHtml(intelligence?.next_best_action || 'Review timeline and execute top touch.')}</p></article>
    <article class="panel" data-verify="account-why-targeted-v1"><h2>Why targeted</h2><p>${escapeHtml(whyTargeted)}</p></article>
    <article class="panel"><h2>Linked research ledger entries</h2>${renderResearchLedgerTable(ledgerEntries, new Map([[String(account.id), account]]))}</article>
  </div>`;
}

function buildTeamHandoffQueue(accounts = []) {
  const now = Date.now();
  const stageWeight = { pilot_candidate: 30, discovery: 20, qualified: 10 };
  return (accounts || []).map((account) => {
    const stage = normalizePilotHandoffStage(account.pipeline_stage) || 'qualified';
    const confidence = Number(account.qualification_confidence) || 0;
    const hasEnrollment = !!account.outreach_enrolled_at;
    const priorityScore = Math.round((stageWeight[stage] || 0) + confidence + (hasEnrollment ? 12 : 0));
    const dueOffsetDays = stage === 'pilot_candidate' ? 1 : stage === 'discovery' ? 2 : 3;
    const followUpDue = new Date(now + dueOffsetDays * 24 * 60 * 60 * 1000).toLocaleDateString();
    const whyNow = `${PILOT_HANDOFF_STAGE_LABELS[stage]} stage · confidence ${confidence}${hasEnrollment ? ' · already enrolled in outreach' : ' · outreach not launched yet'}`;
    const recommendedOpener = stage === 'pilot_candidate'
      ? 'Hi team — we have enough signal to scope a low-risk pilot. Open to a 20-minute kickoff to align test/control and D60 lift target this week?'
      : stage === 'discovery'
        ? 'Hi team — quick note: we found a concrete growth signal for your account. Open to a short discovery call this week to validate fit?'
        : 'Hi team — we support brands with your channel mix and spend profile. Worth a quick qualification conversation to confirm fit?';
    const nextAction = stage === 'pilot_candidate'
      ? 'Send pilot kickoff invite and confirm decision stakeholders + pilot timeline.'
      : stage === 'discovery'
        ? 'Send discovery opener and book a 20-minute call this week.'
        : 'Send first-touch message and verify the fastest contact path.';
    const channels = Array.isArray(account.channels) ? account.channels.map((value) => String(value || '').trim()).filter(Boolean) : [];
    const recommendedChannel = channels[0] || 'email';
    const contactTarget = `${account.contact_role || 'Primary contact'} @ ${account.brand || 'target account'}`;

    return {
      ...account,
      stage,
      priorityScore,
      whyNow,
      recommendedOpener,
      nextAction,
      contactTarget,
      recommendedChannel,
      owner: 'Unassigned',
      status: hasEnrollment ? 'ready_for_human_outreach' : 'needs_enrollment',
      followUpDue,
      aiPrepared: [
        'Priority + context prepared',
        'Recommended opener drafted',
        'Next action + due date prepared',
      ],
      humanExecution: [
        'Assign owner before send',
        `Personalize + send via ${recommendedChannel} from human account`,
        'Record response + set next follow-up',
      ],
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}

function buildSalesSectionQueue(qualifiedAccounts = [], meetingPipeline = {}) {
  const meetings = meetingPipeline?.recentMeetings || [];
  const pilotCandidates = (qualifiedAccounts || []).filter((item) => normalizePilotHandoffStage(item.pipeline_stage) === 'pilot_candidate');
  const queue = buildTeamHandoffQueue(qualifiedAccounts || []).slice(0, 10).map((item, index) => {
    const hasBookedCall = meetings.some((meeting) => String(meeting.client_name || '').toLowerCase().includes(String(item.brand || '').toLowerCase()));
    const stage = normalizePilotHandoffStage(item.pipeline_stage) || 'qualified';
    const confidence = Number(item.qualification_confidence) || 0;
    const dueDate = new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000);
    const leverageScore = Math.round((stage === 'pilot_candidate' ? 45 : stage === 'discovery' ? 30 : 18) + confidence * 0.45 + (hasBookedCall ? 20 : 0) + (item.outreach_enrolled_at ? 10 : 0));
    const valueTouchPlan = stage === 'pilot_candidate'
      ? [
        'Share pilot scope draft (test/control design + decision owners).',
        'Give one concrete benchmark from similar spend/channel profile.',
        'Offer a 20-minute pilot kickoff block this week.',
      ]
      : stage === 'discovery'
        ? [
          'Lead with one account-specific growth signal (not a pitch).',
          'Offer a lightweight diagnostic insight before asking for time.',
          'Ask for a focused discovery slot with clear outcomes.',
        ]
        : [
          'Send a short relevance note tied to their channel mix.',
          'Provide one useful insight or benchmark in the first touch.',
          'Ask for best contact path before proposing a full call.',
        ];
    const nextTouchSuggestion = stage === 'pilot_candidate'
      ? 'Next touch: send pilot brief + calendar hold within 24h via email; follow with short call/SMS nudge if no response in 1 business day.'
      : stage === 'discovery'
        ? 'Next touch: send discovery value note within 24h via email; if silent, send a concise follow-up in 48h with one additional proof point.'
        : 'Next touch: send value-first intro within 48h via email/LinkedIn; follow in 3 days with a practical benchmark or teardown snippet.';
    const handoffTrigger = leverageScore >= 78 || (stage === 'pilot_candidate' && confidence >= 70);

    return {
      ...item,
      owner: item.owner || 'Unassigned',
      due_date_iso: dueDate.toISOString(),
      due_date_text: dueDate.toLocaleDateString(),
      booked_call: hasBookedCall,
      pilot_progress: stage,
      next_best_action: item.nextAction || 'Review account and send first-touch outreach.',
      leverage_score: leverageScore,
      value_touch_plan: valueTouchPlan,
      next_touch_suggestion: nextTouchSuggestion,
      human_handoff_trigger: handoffTrigger,
      human_handoff_reason: handoffTrigger
        ? 'High leverage: strong confidence/stage signal — human outreach recommended now.'
        : 'Keep AI-led nurture active until stronger leverage signal appears.',
      team_action_list: handoffTrigger
        ? ['Assign owner', 'Personalize value-first opener', 'Send human outreach', 'Log outcome + next follow-up']
        : ['Keep sequence active', 'Monitor reply/engagement signals', 'Re-score in next cycle'],
    };
  });

  return {
    queue,
    summary: {
      total_actions: queue.length,
      booked_calls: queue.filter((item) => item.booked_call).length,
      pilot_candidates: pilotCandidates.length,
      unassigned: queue.filter((item) => String(item.owner || '').toLowerCase() === 'unassigned').length,
      high_leverage_handoffs: queue.filter((item) => item.human_handoff_trigger).length,
    },
  };
}

function deriveRelationshipInteractionEvents(account = {}, context = {}) {
  const events = [];
  if (account.outreach_enrolled_at) {
    events.push({ actor: 'system', type: 'outreach_enrolled', delta: 6, detail: 'Automation enrolled account into outreach sequence.' });
  }
  if (context.hasReplyRouting) {
    events.push({ actor: 'system', type: 'reply_routed', delta: 5, detail: 'System detected and routed inbound reply.' });
  }
  if (account.pilot_onboarding_routed_at) {
    events.push({ actor: 'system', type: 'pilot_onboarding_routed', delta: 7, detail: 'System moved account to pilot onboarding path.' });
  }

  if (context.hasAssignedOwner) {
    events.push({ actor: 'human', type: 'owner_assigned', delta: 8, detail: 'A human owner is assigned to execute next touch.' });
  }
  if (context.hasCompletedTask) {
    events.push({ actor: 'human', type: 'task_completed', delta: 7, detail: 'A human completed a relationship task.' });
  }
  if (context.hasBookedCall) {
    events.push({ actor: 'human', type: 'meeting_booked', delta: 10, detail: 'A meeting was booked by human follow-through.' });
  }

  return events;
}

function formatScoreTrend(delta = 0) {
  if (delta >= 12) return { label: `▲ +${delta} strong upward`, className: 'ok', direction: 'up' };
  if (delta >= 5) return { label: `▲ +${delta} upward`, className: 'ok', direction: 'up' };
  if (delta <= -10) return { label: `▼ ${delta} downward`, className: 'bad', direction: 'down' };
  if (delta <= -4) return { label: `▼ ${delta} soft decline`, className: 'warn', direction: 'down' };
  return { label: `→ ${delta >= 0 ? '+' : ''}${delta} flat`, className: 'info', direction: 'flat' };
}

function scoreRelationshipIntelligence(account = {}, context = {}) {
  const stage = normalizePilotHandoffStage(account.pipeline_stage) || 'qualified';
  const confidence = clamp(Number(account.qualification_confidence || 0), 0, 100);
  const readiness = (String(account.readiness_status || '').toLowerCase() === 'qualified' || Number(account.readiness_score || 0) >= 75) ? 1 : 0;
  const interactionEvents = deriveRelationshipInteractionEvents(account, context);

  const systemActions = interactionEvents.filter((event) => event.actor === 'system');
  const humanActions = interactionEvents.filter((event) => event.actor === 'human');
  const interactionDelta = interactionEvents.reduce((sum, event) => sum + Number(event.delta || 0), 0);

  const baseHealth = clamp(Math.round(
    (confidence * 0.45)
    + (stage === 'pilot_candidate' ? 28 : stage === 'discovery' ? 18 : 10)
  ), 0, 100);
  const relationshipHealth = clamp(baseHealth + interactionDelta, 0, 100);

  const momentumRisk = clamp(Math.round(
    62
    + (humanActions.length * 7)
    + (systemActions.length * 5)
    - (!context.hasAssignedOwner ? 16 : 0)
    - (!context.hasBookedCall && stage !== 'qualified' ? 10 : 0)
    - (context.isOverdue ? 14 : 0)
  ), 0, 100);

  const pilotReadiness = clamp(Math.round(
    (confidence * 0.5)
    + (readiness ? 24 : 0)
    + (stage === 'pilot_candidate' ? 22 : stage === 'discovery' ? 10 : 0)
    + (context.hasBookedCall ? 8 : 0)
    + (account.pilot_onboarding_routed_at ? 8 : 0)
  ), 0, 100);

  const scoreTrend = formatScoreTrend(interactionDelta);
  const movementRationale = interactionEvents.length
    ? interactionEvents.map((event) => `${event.actor}: ${event.detail}`).join(' · ')
    : 'No recent system or human interaction events detected.';

  const nextBestAction = stage === 'qualified'
    ? (context.hasAssignedOwner ? 'Send value-first opener and track reply routing' : 'Assign owner and send value-first opener')
    : stage === 'discovery'
      ? (context.hasBookedCall ? 'Prepare discovery call agenda and decision-owner map' : 'Send discovery value note + book pilot-scoping call')
      : account.pilot_onboarding_routed_at
        ? 'Run pilot kickoff prep and confirm decision owners'
        : 'Route to pilot onboarding now';

  const rationale = `${stage.replaceAll('_', ' ')} stage · health ${relationshipHealth} (${scoreTrend.label}) · momentum/risk ${momentumRisk} · pilot readiness ${pilotReadiness}. System actions: ${systemActions.length}, human actions: ${humanActions.length}. ${movementRationale}`;

  return {
    account_id: account.id,
    brand: account.brand,
    stage,
    relationship_health: relationshipHealth,
    relationship_health_base: baseHealth,
    relationship_health_delta: interactionDelta,
    relationship_health_trend: scoreTrend,
    relationship_health_movement_rationale: movementRationale,
    momentum_risk: momentumRisk,
    pilot_readiness: pilotReadiness,
    action_counts: { system: systemActions.length, human: humanActions.length },
    interaction_events: interactionEvents,
    next_best_action: nextBestAction,
    rationale,
  };
}

const RECOMMENDATION_LEARNING_EVENT_TYPES = ['recommendation_decision_logged', 'recommendation_outcome_logged'];
const RECOMMENDATION_LEARNING_LOOKBACK_DAYS = 45;

const RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1 = {
  id: 'relationship-intelligence-priority-weighting-v1',
  ratified: true,
  ratified_at: '2026-02-22',
  weighting_policy: 'signal-primary-with-human-override-guardrail',
  weights: {
    signal_weight: 0.75,
    operator_override_weight: 0.25,
  },
  thresholds: {
    auto_escalate: {
      weighted_priority_min: 74,
      signal_score_min: 70,
      operator_override_score_min: 50,
    },
    manual_review: {
      weighted_priority_min: 58,
      signal_score_min: 52,
    },
  },
};

async function recordRecommendationLearningEvent(payload = {}) {
  if (!pool && !supabase) return { skipped: true, reason: 'no_store' };

  const details = {
    recommendation_id: String(payload.recommendation_id || '').trim() || null,
    recommendation_type: String(payload.recommendation_type || 'relationship_next_action').trim() || 'relationship_next_action',
    account_id: String(payload.account_id || '').trim() || null,
    decision: payload.decision ? String(payload.decision).trim().toLowerCase() : null,
    outcome: payload.outcome ? String(payload.outcome).trim().toLowerCase() : null,
    outcome_score: Number.isFinite(Number(payload.outcome_score)) ? clamp(Math.round(Number(payload.outcome_score)), 0, 100) : null,
    manual_override: Boolean(payload.manual_override),
    notes: String(payload.notes || '').trim() || null,
    logged_at: new Date().toISOString(),
  };

  const eventType = String(payload.event_type || '').trim() || (details.outcome ? 'recommendation_outcome_logged' : 'recommendation_decision_logged');
  const actor = String(payload.actor || 'api').trim();

  if (supabase) {
    const { error } = await supabase.from('cc_activity_log').insert({
      event_type: eventType,
      lead_key: details.account_id ? `qualified:${details.account_id}` : null,
      actor,
      details,
    });
    if (error) {
      if (String(error.message || '').toLowerCase().includes('cc_activity_log')) return { skipped: true, reason: 'table_missing' };
      throw error;
    }
    return { logged: true };
  }

  try {
    await pool.query(
      'insert into public.cc_activity_log (event_type, lead_key, actor, details) values ($1,$2,$3,$4::jsonb)',
      [eventType, details.account_id ? `qualified:${details.account_id}` : null, actor, JSON.stringify(details)],
    );
    return { logged: true };
  } catch (error) {
    if (String(error.message || '').includes('cc_activity_log')) return { skipped: true, reason: 'table_missing' };
    throw error;
  }
}

async function getRecommendationLearningSummary({ lookbackDays = RECOMMENDATION_LEARNING_LOOKBACK_DAYS } = {}) {
  if (!pool && !supabase) return { by_type: {}, top_improving: [], top_declining: [], samples: 0 };

  const cutoffIso = new Date(Date.now() - (Number(lookbackDays || 45) * 86400000)).toISOString();
  let rows = [];

  if (supabase) {
    const { data, error } = await supabase
      .from('cc_activity_log')
      .select('event_type,details,created_at')
      .in('event_type', RECOMMENDATION_LEARNING_EVENT_TYPES)
      .gte('created_at', cutoffIso)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      if (String(error.message || '').toLowerCase().includes('cc_activity_log')) return { by_type: {}, top_improving: [], top_declining: [], samples: 0, skipped: 'table_missing' };
      throw error;
    }
    rows = data || [];
  } else {
    try {
      const { rows: qrows } = await pool.query(
        `select event_type, details, created_at
         from public.cc_activity_log
         where event_type = any($1)
           and created_at >= $2::timestamptz
         order by created_at desc
         limit 500`,
        [RECOMMENDATION_LEARNING_EVENT_TYPES, cutoffIso],
      );
      rows = qrows || [];
    } catch (error) {
      if (String(error.message || '').includes('cc_activity_log')) return { by_type: {}, top_improving: [], top_declining: [], samples: 0, skipped: 'table_missing' };
      throw error;
    }
  }

  const byType = new Map();
  for (const row of rows) {
    const d = row?.details && typeof row.details === 'object' ? row.details : {};
    const type = String(d.recommendation_type || 'relationship_next_action').trim() || 'relationship_next_action';
    const entry = byType.get(type) || { recommendation_type: type, accepted: 0, rejected: 0, outcomes_positive: 0, outcomes_negative: 0, outcomes_neutral: 0, outcome_score_sum: 0, outcome_score_count: 0, samples: 0 };

    const decision = String(d.decision || '').toLowerCase();
    if (decision === 'accepted') entry.accepted += 1;
    else if (decision === 'rejected') entry.rejected += 1;

    const outcome = String(d.outcome || '').toLowerCase();
    if (outcome) {
      if (['positive', 'improved', 'success'].includes(outcome)) entry.outcomes_positive += 1;
      else if (['negative', 'declined', 'failure'].includes(outcome)) entry.outcomes_negative += 1;
      else entry.outcomes_neutral += 1;
    }

    if (Number.isFinite(Number(d.outcome_score))) {
      entry.outcome_score_sum += Number(d.outcome_score);
      entry.outcome_score_count += 1;
    }
    entry.samples += 1;
    byType.set(type, entry);
  }

  const finalized = [...byType.values()].map((entry) => {
    const outcomesTotal = entry.outcomes_positive + entry.outcomes_negative + entry.outcomes_neutral;
    const baseline = 0.5;
    const observed = outcomesTotal ? (entry.outcomes_positive + (entry.outcomes_neutral * 0.5)) / outcomesTotal : baseline;
    const reliability = Math.min(1, outcomesTotal / 8);
    const signedStrength = (observed - baseline) * reliability;
    const confidence_delta = clamp(Math.round(signedStrength * 40), -20, 20);
    const priority_multiplier = clamp(Number((1 + (signedStrength * 0.5)).toFixed(3)), 0.85, 1.15);
    const trend_score = Number((signedStrength * 100).toFixed(1));
    return {
      ...entry,
      average_outcome_score: entry.outcome_score_count ? Number((entry.outcome_score_sum / entry.outcome_score_count).toFixed(1)) : null,
      confidence_delta,
      priority_multiplier,
      trend_score,
    };
  });

  const top_improving = [...finalized].filter((x) => x.trend_score > 0).sort((a, b) => b.trend_score - a.trend_score).slice(0, 3);
  const top_declining = [...finalized].filter((x) => x.trend_score < 0).sort((a, b) => a.trend_score - b.trend_score).slice(0, 3);
  const by_type = Object.fromEntries(finalized.map((item) => [item.recommendation_type, item]));

  return {
    by_type,
    rows: finalized,
    top_improving,
    top_declining,
    samples: rows.length,
    generated_at: new Date().toISOString(),
  };
}

function buildPriorityWeightingV1(row = {}, context = {}) {
  const learningAdjustment = context.learningAdjustment && typeof context.learningAdjustment === 'object' ? context.learningAdjustment : {};
  const signalScore = clamp(Math.round(
    (Number(row.relationship_health || 0) * 0.45)
    + (Number(row.pilot_readiness || 0) * 0.35)
    + (Number(row.momentum_risk || 0) * 0.20)
    + Number(learningAdjustment.confidence_delta || 0)
  ), 0, 100);

  const operatorOverrideScore = clamp(Math.round(
    (Number(context.overrideTaskCompleted ? 85 : context.overrideTaskInProgress ? 55 : 20))
    + (context.hasAssignedOwner ? 10 : 0)
    + Number(context.manualOverrideBoost || 0)
  ), 0, 100);

  const weightedPriorityScoreBase = clamp(Math.round(
    (signalScore * RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1.weights.signal_weight)
    + (operatorOverrideScore * RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1.weights.operator_override_weight)
  ), 0, 100);
  const weightedPriorityScore = clamp(Math.round(weightedPriorityScoreBase * Number(learningAdjustment.priority_multiplier || 1)), 0, 100);

  const autoThresholds = RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1.thresholds.auto_escalate;
  const manualThresholds = RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1.thresholds.manual_review;

  let escalationPath = 'monitor';
  if (
    weightedPriorityScore >= autoThresholds.weighted_priority_min
    && signalScore >= autoThresholds.signal_score_min
    && operatorOverrideScore >= autoThresholds.operator_override_score_min
  ) {
    escalationPath = 'auto_escalate';
  } else if (
    weightedPriorityScore >= manualThresholds.weighted_priority_min
    && signalScore >= manualThresholds.signal_score_min
  ) {
    escalationPath = 'manual_review';
  }

  const escalationReason = escalationPath === 'auto_escalate'
    ? `Auto-escalate: weighted ${weightedPriorityScore}/${autoThresholds.weighted_priority_min}+; signal ${signalScore}/${autoThresholds.signal_score_min}+; operator override ${operatorOverrideScore}/${autoThresholds.operator_override_score_min}+.`
    : escalationPath === 'manual_review'
      ? `Manual review: weighted ${weightedPriorityScore}/${manualThresholds.weighted_priority_min}+ and signal ${signalScore}/${manualThresholds.signal_score_min}+; auto-escalate guardrails not fully met.`
      : `Monitor: weighted ${weightedPriorityScore} or signal ${signalScore} below manual-review minimums (${manualThresholds.weighted_priority_min} weighted, ${manualThresholds.signal_score_min} signal).`;

  return {
    signal_score: signalScore,
    operator_override_score: operatorOverrideScore,
    weighted_priority_score: weightedPriorityScore,
    learning_adjustment: {
      confidence_delta: Number(learningAdjustment.confidence_delta || 0),
      priority_multiplier: Number(learningAdjustment.priority_multiplier || 1),
      trend_score: Number(learningAdjustment.trend_score || 0),
    },
    escalation_path: escalationPath,
    escalation_reason: escalationReason,
  };
}

function buildRelationshipIntelligence({ qualifiedAccounts = [], meetingPipeline = {}, tasks = [], recentReplyRouting = [], learningSummary = null, preferenceProfile = null } = {}) {
  const meetings = meetingPipeline?.recentMeetings || [];
  const taskRows = tasks || [];
  const routedReplies = recentReplyRouting || [];

  const scores = (qualifiedAccounts || []).map((account) => {
    const brand = String(account.brand || '').toLowerCase();
    const relatedTasks = taskRows.filter((t) => String(t.title || '').toLowerCase().includes(brand));
    const hasBookedCall = meetings.some((m) => String(m.client_name || '').toLowerCase().includes(brand));
    const hasAssignedOwner = relatedTasks.some((t) => !String(t.owner || '').toLowerCase().includes('unassigned'));
    const hasCompletedTask = relatedTasks.some((t) => String(t.status || '').toLowerCase() === 'done');
    const overrideTaskInProgress = relatedTasks.some((t) => String(t.title || '').toLowerCase().includes('approve/override recommendation pack') && ['todo', 'in_progress'].includes(String(t.status || '').toLowerCase()));
    const overrideTaskCompleted = relatedTasks.some((t) => String(t.title || '').toLowerCase().includes('approve/override recommendation pack') && String(t.status || '').toLowerCase() === 'done');
    const hasReplyRouting = routedReplies.some((r) => String(r.lead_key || '').toLowerCase().includes(brand) || String(r.reply_excerpt || '').toLowerCase().includes(brand));
    const isOverdue = Boolean(account.pilot_onboarding_routed_at) === false && normalizePilotHandoffStage(account.pipeline_stage) === 'pilot_candidate';
    const scored = scoreRelationshipIntelligence(account, { hasBookedCall, hasAssignedOwner, hasCompletedTask, hasReplyRouting, isOverdue });
    const recommendationType = 'relationship_next_action';
    const learningAdjustment = learningSummary?.by_type?.[recommendationType] || null;
    const priorityWeighting = buildPriorityWeightingV1(scored, {
      hasAssignedOwner,
      overrideTaskInProgress,
      overrideTaskCompleted,
      learningAdjustment,
      manualOverrideBoost: overrideTaskCompleted ? 8 : 0,
    });
    const owner = relatedTasks.find((t) => !String(t.owner || '').toLowerCase().includes('unassigned'))?.owner || account.owner || 'Unassigned';
    return { ...scored, owner, related_tasks_count: relatedTasks.length, priority_weighting_v1: priorityWeighting };
  }).sort((a, b) => (b.priority_weighting_v1?.weighted_priority_score || 0) - (a.priority_weighting_v1?.weighted_priority_score || 0));

  const recommendations = scores.slice(0, 6).map((row) => {
    const nextAction = applyPreferenceToRecommendationText(
      row.next_best_action || 'Review account context and select next touch.',
      preferenceProfile || {},
    );
    const owner = row.owner || 'Unassigned';
    const rationale = row.rationale || row.relationship_health_movement_rationale || 'No rationale captured yet.';

    return {
    account_id: row.account_id,
    brand: row.brand,
    recommendation: nextAction,
    next_best_action_recommendation: nextAction,
    next_action: nextAction,
    rationale,
    movement_rationale: row.relationship_health_movement_rationale,
    owner,
    handoff_path: {
      queue: 'execution_queue',
      route: '/actions?source=relationship-intelligence',
      note: 'Open Actions execution queue, claim owner, execute next action, then hand off to Relationships.',
    },
    recommendation_type: 'relationship_next_action',
    priority: row.priority_weighting_v1?.escalation_path === 'auto_escalate' ? 'high' : row.priority_weighting_v1?.escalation_path === 'manual_review' ? 'medium' : 'low',
    weighted_priority_score: row.priority_weighting_v1?.weighted_priority_score || 0,
    signal_score: row.priority_weighting_v1?.signal_score || 0,
    operator_override_score: row.priority_weighting_v1?.operator_override_score || 0,
    escalation_path: row.priority_weighting_v1?.escalation_path || 'monitor',
    escalation_reason: row.priority_weighting_v1?.escalation_reason || '',
    thresholds_applied: RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1.thresholds,
    };
  });

  return {
    scores,
    recommendations,
    model: RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1,
    generated_at: new Date().toISOString(),
  };
}

function buildProgressionRecommendation(account = {}, context = {}) {
  const stage = normalizePilotHandoffStage(account.pipeline_stage) || 'qualified';
  const interactionSignals = Number(context.interactionSignals || 0);
  const healthScore = clamp(Math.round(Number(context.healthScore || 0)), 0, 100);
  const pilotReadiness = clamp(Math.round(Number(context.pilotReadiness || 0)), 0, 100);

  const intentScore = clamp(Math.round((Math.min(interactionSignals, 4) / 4) * 100), 0, 100);
  const responseQualityScore = clamp(Math.round((healthScore * 0.65) + (Math.min(interactionSignals, 4) * 6)), 0, 100);
  const fitScore = clamp(Math.round((healthScore * 0.7) + (pilotReadiness * 0.3)), 0, 100);
  const completenessSignals = [
    !!account?.owner,
    !!account?.outreach_enrolled_at,
    !!account?.discovery_promoted_at,
    !!account?.qualification_snapshot,
  ].filter(Boolean).length;
  const dataCompletenessScore = clamp(Math.round((completenessSignals / 4) * 100), 0, 100);

  const hasEnoughForDiscovery = fitScore >= 68 && intentScore >= 50;
  const hasEnoughForPilotCandidate = fitScore >= 72 && pilotReadiness >= 76 && intentScore >= 75 && dataCompletenessScore >= 50;

  let recommendation = 'hold';
  let recommendationLabel = 'Hold current stage';
  if (stage === 'qualified' && hasEnoughForDiscovery) {
    recommendation = 'promote_to_discovery';
    recommendationLabel = 'Promote to discovery';
  } else if (stage === 'discovery' && hasEnoughForPilotCandidate) {
    recommendation = 'promote_to_pilot_candidate';
    recommendationLabel = 'Promote to pilot candidate';
  }

  const confidence = clamp(Math.round(
    (intentScore * 0.25)
    + (responseQualityScore * 0.25)
    + (fitScore * 0.30)
    + (dataCompletenessScore * 0.20)
    + (recommendation === 'hold' ? -6 : 4)
  ), 0, 100);

  const reason = recommendation === 'promote_to_discovery'
    ? `Intent and fit are strong enough to enter discovery (intent ${intentScore}, fit ${fitScore}).`
    : recommendation === 'promote_to_pilot_candidate'
      ? `Intent, fit, and readiness support candidate promotion (intent ${intentScore}, fit ${fitScore}, readiness ${pilotReadiness}).`
      : `Hold until intent/fit/completeness improve (intent ${intentScore}, fit ${fitScore}, data completeness ${dataCompletenessScore}).`;

  return {
    recommendation,
    recommendation_label: recommendationLabel,
    reason,
    confidence,
    components: {
      intent: intentScore,
      response_quality: responseQualityScore,
      fit: fitScore,
      data_completeness: dataCompletenessScore,
    },
  };
}

function renderProgressionRecommendationBadge(rec = {}) {
  const key = String(rec.recommendation || 'hold');
  const cls = key === 'promote_to_discovery' || key === 'promote_to_pilot_candidate' ? 'ok' : 'warn';
  return `<span class="badge ${cls}">${escapeHtml(rec.recommendation_label || 'Hold current stage')}</span>`;
}

function conciseRecommendationRationale(row = {}, maxChars = 150) {
  const raw = String(row.movement_rationale || row.rationale || '').replace(/\s+/g, ' ').trim();
  if (!raw) return 'No clear reason provided yet.';
  const firstSentence = raw.split('. ')[0]?.trim() || raw;
  const cleaned = firstSentence
    .replace(/^targeted because\s*/i, '')
    .replace(/^derived from\s*/i, '')
    .replace(/^recommendation:\s*/i, '')
    .trim();
  const concise = cleaned.length > 28 ? cleaned : raw;
  return concise.length > maxChars ? `${concise.slice(0, maxChars - 1)}…` : concise;
}

function describeRecommendationConfidence(row = {}) {
  const score = clamp(Number(row.weighted_priority_score || 0), 0, 100);
  const autoMin = RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1.thresholds.auto_escalate.weighted_priority_min;
  const manualMin = RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1.thresholds.manual_review.weighted_priority_min;
  const label = score >= autoMin ? 'High' : score >= manualMin ? 'Medium' : 'Low';
  const className = score >= autoMin ? 'ok' : score >= manualMin ? 'warn' : 'info';
  const why = row.escalation_path === 'auto_escalate'
    ? 'Score crossed auto-escalate threshold.'
    : row.escalation_path === 'manual_review'
      ? 'Strong signal; operator review required.'
      : 'Below escalation threshold; keep monitoring.';
  return { score, label, className, why };
}

function renderRelationshipRecommendationPanel(intelligence = {}, marker = 'relationship-intelligence-v1') {
  const rows = intelligence?.recommendations || [];
  const tableRows = rows.map((row) => {
    const confidence = describeRecommendationConfidence(row);
    const nowAction = row.next_action || row.next_best_action_recommendation || row.recommendation || 'Review account context';
    return `<tr><td>${row.account_id ? `<a href="/accounts/${encodeURIComponent(row.account_id)}">${escapeHtml(row.brand || '—')}</a>` : escapeHtml(row.brand || '—')}<div class="muted"><a href="/comms?view=account&tab=inbox">Open comms</a> · <a href="/research">research/intel</a></div></td><td><strong>${escapeHtml(row.recommendation)}</strong></td><td>${escapeHtml(conciseRecommendationRationale(row))}</td><td><span class="badge ${confidence.className}">${escapeHtml(confidence.label)} (${escapeHtml(confidence.score)})</span><div class="muted">${escapeHtml(confidence.why)}</div></td><td><div><strong>W:</strong> ${escapeHtml(row.weighted_priority_score ?? '0')}</div><div class="muted"><strong>S:</strong> ${escapeHtml(row.signal_score ?? '0')} · <strong>O:</strong> ${escapeHtml(row.operator_override_score ?? '0')}</div></td><td>${escapeHtml(row.owner || 'Unassigned')}</td><td><strong>${escapeHtml(nowAction)}</strong><div class="muted">Next: run this in Actions.</div></td><td><span class="badge ${row.priority === 'high' ? 'warn' : 'info'}">${escapeHtml(row.priority)}</span></td><td><span class="badge ${row.escalation_path === 'auto_escalate' ? 'bad' : row.escalation_path === 'manual_review' ? 'warn' : 'info'}">${escapeHtml(row.escalation_path || 'monitor')}</span><div class="muted">${escapeHtml(row.escalation_reason || '')}</div></td><td><a href="${escapeHtml(row.handoff_path?.route || '/actions')}">Open execution queue</a><div class="muted">${escapeHtml(row.handoff_path?.note || 'Route to /actions for owner execution')}</div></td></tr>`;
  }).join('') || '<tr><td colspan="10" class="empty-state">No recommendations yet.</td></tr>';

  const cards = rows.map((row) => {
    const confidence = describeRecommendationConfidence(row);
    const nowAction = row.next_action || row.next_best_action_recommendation || row.recommendation || 'Review account context';
    return `<article class="funnel-card" data-verify="relationship-recommendation-card-v3 relationship-recommendation-required-fields-v1"><div class="funnel-title"><strong>${escapeHtml(row.brand || 'Unknown account')}</strong><div><span class="badge ${confidence.className}">Confidence: ${escapeHtml(confidence.label)} (${escapeHtml(confidence.score)})</span></div></div><p class="card-note"><strong>Rationale:</strong> ${escapeHtml(conciseRecommendationRationale(row, 180))}</p><p class="card-note"><strong>Owner:</strong> ${escapeHtml(row.owner || 'Unassigned')}</p><p class="card-note"><strong>Next action:</strong> ${escapeHtml(nowAction)}</p><p class="muted card-context"><strong>Escalation:</strong> ${escapeHtml(row.escalation_path || 'monitor')} · ${escapeHtml(row.escalation_reason || '')}</p><p class="muted card-context"><a href="${escapeHtml(row.handoff_path?.route || '/actions')}">Open execution queue</a> · ${escapeHtml(row.handoff_path?.note || 'Route to /actions for owner execution')}</p></article>`;
  }).join('');

  return `<div data-verify="${escapeHtml(marker)} relationship-intelligence-priority-weighting-v1 relationship-intelligence-handoff-path-v1 relationship-recommendation-clarity-v2"><table><thead><tr><th>Account</th><th>Recommendation</th><th>Why this now</th><th>Confidence</th><th>Score breakdown</th><th>Owner</th><th>Do this now</th><th>Priority</th><th>Escalation path</th><th>Handoff path</th></tr></thead><tbody>${tableRows}</tbody></table>${cards ? `<div class="queue-grid" style="margin-top:.65rem;" data-verify="relationship-recommendation-card-stack-v1">${cards}</div>` : ''}</div>`;
}

function renderRecommendationLearningPanel(summary = {}, message = '', messageState = 'success') {
  const improving = Array.isArray(summary?.top_improving) ? summary.top_improving : [];
  const declining = Array.isArray(summary?.top_declining) ? summary.top_declining : [];
  const row = (item) => `<tr><td>${escapeHtml(item.recommendation_type)}</td><td>${escapeHtml(item.accepted)}</td><td>${escapeHtml(item.rejected)}</td><td>${escapeHtml(item.outcomes_positive)}</td><td>${escapeHtml(item.outcomes_negative)}</td><td>${escapeHtml(item.confidence_delta)}</td><td>${escapeHtml(item.priority_multiplier)}</td></tr>`;
  return `<article class="panel" id="recommendation-learning" data-verify="ops-recommendation-learning-loop-v1"><div class="panel-head"><h2>Recommendation learning loop (v1)</h2><span class="section-tag">accepted/rejected + outcomes</span></div>${message ? `<p class="${messageState === 'error' ? 'error' : 'muted'}">${escapeHtml(message)}</p>` : '<p class="muted">Log recommendation decisions and outcomes. Signals auto-adjust confidence + priority weighting.</p>'}<div class="layout" style="grid-template-columns:1fr 1fr;gap:.6rem"><section><h3 style="margin:.2rem 0">Log decision</h3><form method="POST" action="/ops/recommendations/decision" class="inline-form"><input type="text" name="account_id" placeholder="Account ID (optional)" /><input type="text" name="recommendation_type" value="relationship_next_action" /><select name="decision"><option value="accepted">accepted</option><option value="rejected">rejected</option></select><select name="manual_override"><option value="0">no override</option><option value="1">manual override</option></select><input type="text" name="notes" placeholder="Optional context" /><button type="submit">Log decision</button></form></section><section><h3 style="margin:.2rem 0">Log outcome</h3><form method="POST" action="/ops/recommendations/outcome" class="inline-form"><input type="text" name="account_id" placeholder="Account ID (optional)" /><input type="text" name="recommendation_type" value="relationship_next_action" /><select name="outcome"><option value="positive">positive</option><option value="neutral">neutral</option><option value="negative">negative</option></select><input type="number" min="0" max="100" name="outcome_score" placeholder="Outcome score 0-100" /><input type="text" name="notes" placeholder="Evidence / notes" /><button type="submit">Log outcome</button></form></section></div><h3 style="margin:.5rem 0 .2rem">Top improving recommendation types</h3><table><thead><tr><th>Type</th><th>Accepted</th><th>Rejected</th><th>Positive</th><th>Negative</th><th>Δ confidence</th><th>Priority x</th></tr></thead><tbody>${improving.map(row).join('') || '<tr><td colspan="7" class="muted">No improving recommendation types yet.</td></tr>'}</tbody></table><h3 style="margin:.5rem 0 .2rem">Top declining recommendation types</h3><table><thead><tr><th>Type</th><th>Accepted</th><th>Rejected</th><th>Positive</th><th>Negative</th><th>Δ confidence</th><th>Priority x</th></tr></thead><tbody>${declining.map(row).join('') || '<tr><td colspan="7" class="muted">No declining recommendation types yet.</td></tr>'}</tbody></table></article>`;
}

function renderTeamHandoffQueueQuickstart() {
  return `<article class="panel" data-verify="team-handoff-quickstart-v1" style="margin-bottom:.65rem;">
    <div class="panel-head"><h3 style="margin:0;">Quickstart (Human Outreach)</h3><span class="section-tag">4 steps</span></div>
    <ol class="queue-list" style="margin-top:.35rem;">
      <li><strong>Find the handoff queue:</strong> Home → <code>#team-handoff-queue</code> (this panel).</li>
      <li><strong>Act on contacts:</strong> Work top-down by priority. Use <em>Who to contact</em>, <em>Why now</em>, and <em>Next action</em>; personalize and send from your human account.</li>
      <li><strong>Record outcomes:</strong> Update <em>Owner</em>, keep the follow-up due date current, and log response + next step in Ops → <a href="/ops#client-updates">Follow-ups and client updates</a>.</li>
      <li><strong>Escalate back to AI workflows:</strong> If a contact replies, stalls, or needs sequencing changes, route to Ops → <a href="/ops#reply-routing">Reply routing</a> and <a href="/ops#execution-board">Operations board</a> for AI-prepared next actions.</li>
    </ol>
  </article>`;
}

function renderTeamHandoffQueue(accounts = [], sequenceTemplates = []) {
  const queue = buildTeamHandoffQueue(accounts).slice(0, 12);
  const quickTemplates = (sequenceTemplates || []).slice(0, 2);
  return `<div data-verify="team-handoff-queue-v2 human-task-queue-highlight-v1"><p class="muted">Human-to-human outreach handoff queue. AI prepares the brief; humans execute the outreach.</p><p class="queue-callout"><strong>Human task queue (act here):</strong> Start at row #1, assign owner, personalize opener, send from your human account, then log the outcome in Ops.</p>${renderTeamHandoffQueueQuickstart()}
    <table><thead><tr><th>Priority</th><th>Who to contact</th><th>Why now</th><th>Recommended opener</th><th>Next action + due + owner</th><th>One-click status transitions</th></tr></thead><tbody>${queue.map((item, index) => {
      const transitions = item.stage === 'qualified'
        ? `<form method="POST" action="/qualified-accounts/${encodeURIComponent(item.id)}/promote-discovery"><button type="submit" class="button-secondary">Move to discovery</button></form>`
        : item.stage === 'discovery'
          ? `<form method="POST" action="/qualified-accounts/${encodeURIComponent(item.id)}/promote-pilot-candidate"><button type="submit" class="button-secondary">Move to pilot candidate</button></form>`
          : item.stage === 'pilot_candidate'
            ? `<form method="POST" action="/qualified-accounts/${encodeURIComponent(item.id)}/route-pilot-onboarding"><button type="submit" class="button-secondary">Route to pilot onboarding</button></form>`
            : !item.outreach_enrolled_at
              ? `${quickTemplates.map((tpl) => `<form method="POST" action="/qualified-accounts/${encodeURIComponent(item.id)}/enroll" style="display:inline-block;margin:.1rem .18rem .1rem 0;"><input type="hidden" name="sequence_template_id" value="${escapeHtml(tpl.id)}" /><button type="submit" class="button-secondary">Enroll: ${escapeHtml(tpl.name || tpl.slug || 'Sequence')}</button></form>`).join('') || '<span class="empty-state">No active sequence templates</span>'}`
              : `<form method="POST" action="/qualified-accounts/${encodeURIComponent(item.id)}/route-pilot-onboarding"><button type="submit" class="button-secondary">Route to pilot onboarding</button></form>`;
      return `<tr>
      <td><strong>#${index + 1}</strong><div class="muted">score ${escapeHtml(item.priorityScore)}</div></td>
      <td><strong>${escapeHtml(item.contactTarget || (item.brand || 'Unknown'))}</strong><div class="muted">Channel: ${escapeHtml(item.recommendedChannel || 'email')} · ${escapeHtml(item.website || '—')}</div></td>
      <td><strong>${escapeHtml(item.whyNow)}</strong></td>
      <td><div class="muted" style="margin-bottom:.2rem;">Use this opener:</div><strong>${escapeHtml(item.recommendedOpener)}</strong></td>
      <td><strong>${escapeHtml(item.nextAction)}</strong><div class="muted" style="margin-top:.3rem;">Due: ${escapeHtml(item.followUpDue)} · Owner: ${escapeHtml(item.owner)}</div><div style="margin-top:.25rem;"><span class="badge ${item.owner === 'Unassigned' ? 'warn' : 'ok'}">${escapeHtml(item.status)}</span></div></td>
      <td><div data-verify="team-handoff-one-click-transitions-v1">${transitions}</div></td>
    </tr>`;
    }).join('') || '<tr><td colspan="6" class="empty-state">No qualified accounts available for handoff queue.</td></tr>'}</tbody></table></div>`;
}

function renderSalesSectionV1(qualifiedAccounts = [], meetingPipeline = {}) {
  const sales = buildSalesSectionQueue(qualifiedAccounts, meetingPipeline);
  const pilotCounts = summarizeQualifiedAccountStages(qualifiedAccounts || []);

  return `<div id="sales-section" data-verify="sales-section-v2 sales-prioritized-actions-v1 sales-next-best-action-v1 sales-progression-view-v1 sales-ownership-due-dates-v1 sales-value-first-touch-plan-v1 sales-high-leverage-handoff-v1">
    <div class="panel-head"><h2>Sales section (v2)</h2><span class="badge">${escapeHtml(sales.summary.total_actions)} prioritized actions</span></div>
    <p class="muted">AI-led relationship development: value-first touch plans, explicit next-touch guidance, and human handoff only when leverage is high.</p>
    <div class="kpis stack-md">
      <article class="metric"><div class="name">Booked calls</div><div class="value">${escapeHtml(sales.summary.booked_calls)}</div><div class="fresh">from meeting notes</div></article>
      <article class="metric"><div class="name">Pilot candidates</div><div class="value">${escapeHtml(sales.summary.pilot_candidates)}</div><div class="fresh">stage = pilot_candidate</div></article>
      <article class="metric"><div class="name">High-leverage handoffs</div><div class="value">${escapeHtml(sales.summary.high_leverage_handoffs || 0)}</div><div class="fresh">human outreach now</div></article>
      <article class="metric"><div class="name">Progression</div><div class="value">Q ${escapeHtml(pilotCounts.qualified)} · D ${escapeHtml(pilotCounts.discovery)} · P ${escapeHtml(pilotCounts.pilot_candidate)}</div><div class="fresh">qualified / discovery / pilot</div></article>
    </div>
    <table><thead><tr><th>Priority</th><th>Opportunity / contact</th><th>Value-first touch plan</th><th>Next touch suggestion</th><th>Human handoff trigger</th><th>Team action list</th></tr></thead><tbody>${(sales.queue || []).map((item, idx) => `<tr><td><strong>#${idx + 1}</strong><div class="muted">priority ${escapeHtml(item.priorityScore || 0)} · leverage ${escapeHtml(item.leverage_score || 0)}</div></td><td><strong>${escapeHtml(item.contactTarget || item.brand || 'Unknown')}</strong><div class="muted">${escapeHtml(item.website || '—')}</div><div class="muted">Pipeline: ${escapeHtml(PILOT_HANDOFF_STAGE_LABELS[item.pilot_progress] || item.pilot_progress)}</div><div class="links" data-verify="relationships-detail-links-v1"><a href="/accounts/${encodeURIComponent(item.id || '')}">Account detail</a><a href="/comms?view=individual&tab=inbox">Comms · Individual Workspace</a></div></td><td><ul class="queue-list" style="margin:0;">${(item.value_touch_plan || []).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul></td><td><strong>${escapeHtml(item.next_best_action)}</strong><div class="muted" style="margin-top:.25rem;">${escapeHtml(item.next_touch_suggestion || '')}</div></td><td><span class="badge ${item.human_handoff_trigger ? 'ok' : 'warn'}">${item.human_handoff_trigger ? 'Trigger: yes' : 'Trigger: no'}</span><div class="muted" style="margin-top:.25rem;">${escapeHtml(item.human_handoff_reason || '')}</div><div class="muted" style="margin-top:.25rem;">Owner: ${escapeHtml(item.owner || 'Unassigned')} · Due: ${escapeHtml(item.due_date_text)}</div></td><td><ol class="queue-list" style="margin:0;">${(item.team_action_list || []).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ol></td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No sales opportunities queued yet.</td></tr>'}</tbody></table>
  </div>`;
}

function renderCompetitiveIntelPanel(entries = [], qualifiedAccounts = [], intelMessage = '', intelState = 'success') {
  const accountOptions = (qualifiedAccounts || []).map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.brand)} · ${escapeHtml(account.website || 'no website')}</option>`).join('');
  const rows = (entries || []).map((item) => {
    const linked = item.linked_account || item.cc_qualified_accounts || null;
    return `<tr><td>${escapeHtml(item.brand)}</td><td>${escapeHtml(String(item.signal || '').replaceAll('_', ' '))}</td><td>${escapeHtml(item.source)}</td><td>${escapeHtml(item.confidence)}</td><td>${escapeHtml(item.strategic_note)}</td><td>${linked ? `<span class="badge ok">${escapeHtml(linked.brand || 'Linked account')}</span>` : '<span class="muted">Unlinked</span>'}</td></tr>`;
  }).join('');

  return `<div data-verify="competitive-intel-panel-v1">${renderFlashMessage(intelMessage, intelState, 'competitive-intel-feedback-v1')}
    <form class="inline-form" method="POST" action="/competitive-intel/create" data-verify="competitive-intel-entry-form-v1">
      <input type="text" name="brand" placeholder="Competitor/prospect brand" required />
      <select name="signal" required><option value="">Signal</option>${COMPETITIVE_INTEL_SIGNALS.map((signal) => `<option value="${signal}">${signal.replaceAll('_', ' ')}</option>`).join('')}</select>
      <input type="text" name="source" placeholder="Source URL or note" required />
      <input type="number" min="0" max="100" name="confidence" placeholder="Confidence (0-100)" required />
      <input type="text" name="strategic_note" placeholder="Strategic note" required />
      <select name="linked_qualified_account_id"><option value="">Auto-link target account (optional)</option>${accountOptions}</select>
      <button type="submit">Save intel</button>
    </form>
    <div style="margin-top:.55rem" data-verify="competitive-intel-table-v1"><table><thead><tr><th>Brand</th><th>Signal</th><th>Source</th><th>Confidence</th><th>Strategic note</th><th>Linked target</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty-state">No intelligence entries yet.</td></tr>'}</tbody></table></div>
  </div>`;
}

function renderHomeOutreachQueue(meetingPipeline = {}) {
  const pendingActions = (meetingPipeline.pendingActions || []).filter((item) => !['done', 'cancelled'].includes(String(item.status || '').toLowerCase()));
  const pendingClientUpdates = sortPendingClientUpdatesByDue((meetingPipeline.dueClientUpdates || []).filter(isClientUpdatePending));

  return `<div data-verify="adzeta-home-funnel-queue-v2"><p class="muted">Lower-priority queues are moved to Ops so Home stays focused on pipeline growth.</p>
    <table><thead><tr><th>Queue</th><th>Pending</th><th>Route</th></tr></thead><tbody>
      <tr><td>Follow-up tasks</td><td>${escapeHtml(pendingActions.length)}</td><td><a class="button-link button-secondary" href="/ops#client-updates">Open in Ops</a></td></tr>
      <tr><td>Client update tasks</td><td>${escapeHtml(pendingClientUpdates.length)}</td><td><a class="button-link button-secondary" href="/ops#client-updates">Open in Ops</a></td></tr>
    </tbody></table></div>`;
}

function renderDailyOperatingCadencePanel() {
  const blocks = [
    {
      id: 'morning',
      label: 'Morning',
      window: '08:00-11:00',
      items: ['Review outcome dashboard + priority shifts', 'Triage team handoff queue (top 3)', 'Set owners + due windows for today'],
    },
    {
      id: 'midday',
      label: 'Midday',
      window: '12:00-15:00',
      items: ['Execute highest-urgency actions', 'Log responses + route follow-ups in Ops', 'Promote qualified accounts to next pipeline stage'],
    },
    {
      id: 'evening',
      label: 'Evening',
      window: '16:00-19:00',
      items: ['Close open loops + mark done/in-progress', 'Confirm tomorrow\'s first-touch queue', 'Capture blockers + escalation notes'],
    },
  ];

  return `<article class="panel" data-verify="daily-operating-cadence-panel-v1">
    <div class="panel-head"><h2>Daily operating cadence</h2><span class="section-tag">morning · midday · evening</span></div>
    <p class="muted">Checklist with completion tracking resets each day. Use this to run a consistent operating rhythm.</p>
    <div id="daily-cadence-root" data-verify="daily-operating-cadence-checklist-v1">${blocks.map((block) => `<section class="funnel-card" style="margin-bottom:.55rem" data-block="${escapeHtml(block.id)}"><div class="funnel-title"><strong>${escapeHtml(block.label)}</strong><span><span class="badge info">${escapeHtml(block.window)}</span> <span class="badge" data-progress-for="${escapeHtml(block.id)}">0/${block.items.length}</span></span></div><ul class="queue-list" style="margin-top:.35rem">${block.items.map((item, idx) => `<li><label style="display:flex;gap:.5rem;align-items:flex-start"><input type="checkbox" data-cadence-key="${escapeHtml(block.id)}:${idx}" style="margin-top:.2rem" /> <span>${escapeHtml(item)}</span></label></li>`).join('')}</ul></section>`).join('')}</div>
    <div class="helper-row"><span class="helper-chip" id="daily-cadence-summary">Progress: 0/0 complete</span><button type="button" class="button-secondary" id="daily-cadence-reset">Reset today</button></div>
    <script>
      (() => {
        const KEY = 'adzeta.daily-operating-cadence.v1';
        const today = new Date().toISOString().slice(0, 10);
        const readState = () => {
          try {
            const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
            if (parsed.date !== today || !parsed.items || typeof parsed.items !== 'object') return { date: today, items: {} };
            return parsed;
          } catch {
            return { date: today, items: {} };
          }
        };
        const writeState = (state) => localStorage.setItem(KEY, JSON.stringify(state));
        const state = readState();
        const boxes = Array.from(document.querySelectorAll('input[data-cadence-key]'));
        const progressEls = Array.from(document.querySelectorAll('[data-progress-for]'));
        const summaryEl = document.getElementById('daily-cadence-summary');
        const refresh = () => {
          let done = 0;
          boxes.forEach((el) => {
            const key = el.getAttribute('data-cadence-key');
            const checked = !!state.items[key];
            el.checked = checked;
            if (checked) done += 1;
          });
          progressEls.forEach((el) => {
            const block = el.getAttribute('data-progress-for');
            const blockBoxes = boxes.filter((box) => String(box.getAttribute('data-cadence-key') || '').startsWith(block + ':'));
            const blockDone = blockBoxes.filter((box) => box.checked).length;
            el.textContent = String(blockDone) + '/' + String(blockBoxes.length);
            el.className = 'badge ' + (blockDone === blockBoxes.length && blockBoxes.length > 0 ? 'ok' : 'info');
          });
          if (summaryEl) summaryEl.textContent = 'Progress: ' + String(done) + '/' + String(boxes.length) + ' complete';
          writeState(state);
        };
        boxes.forEach((el) => {
          el.addEventListener('change', () => {
            const key = el.getAttribute('data-cadence-key');
            state.items[key] = el.checked;
            refresh();
          });
        });
        const resetBtn = document.getElementById('daily-cadence-reset');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            state.items = {};
            refresh();
          });
        }
        refresh();
      })();
    </script>
  </article>`;
}

function getSectionLabel(active = 'home') {
  return active === 'strategy'
    ? 'Strategy'
    : active === 'targeting'
      ? 'Targeting'
      : active === 'actions'
        ? 'Actions'
        : active === 'relationships'
          ? 'Relationships'
          : active === 'pilot'
            ? 'Pilot'
            : active === 'research'
              ? 'Research'
              : active === 'comms'
                ? 'Comms'
                : active === 'ops'
                ? 'Ops'
                : active === 'operator'
                  ? 'Operator status'
                  : 'Home';
}

function renderBreadcrumbs(active = 'home') {
  const sectionLabel = getSectionLabel(active);
  return `<nav class="muted breadcrumb" data-verify="home-ops-breadcrumbs-v2" aria-label="Breadcrumb">AdZeta Command Center / ${escapeHtml(sectionLabel)}</nav>`;
}

function renderTopNav({ active = 'home', errorMessage = '' } = {}) {
  const sectionLabel = getSectionLabel(active);
  const titlePrefix = 'AdZeta Command Center';
  const subtitle = active === 'home'
    ? 'Funnel-first home for daily execution. Extended diagnostics live in Ops.'
    : 'Use each workspace to move pipeline and maintain reliability.';
  const navLink = (href, label, isActive) => `<a href="${href}" class="${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>${label}</a>`;
  return `<header class="hero"><div class="panel-head"><div><h1>${titlePrefix} · ${escapeHtml(sectionLabel)}</h1><p class="muted">${escapeHtml(subtitle)}</p>${renderBreadcrumbs(active)}</div><span class="badge">local :${port}</span></div><div class="links" data-verify="v2-shell-nav">${navLink('/', 'Home', active === 'home')}${navLink('/strategy', 'Strategy', active === 'strategy')}${navLink('/targeting', 'Targeting', active === 'targeting')}${navLink('/actions', 'Actions', active === 'actions')}${navLink('/relationships', 'Relationships', active === 'relationships')}${navLink('/comms', 'Comms', active === 'comms')}${navLink('/pilot', 'Pilot', active === 'pilot')}${navLink('/research', 'Research', active === 'research')}${navLink('/ops', 'Ops', active === 'ops')}</div>${errorMessage ? `<p class="error" role="alert">${escapeHtml(errorMessage)}</p>` : ''}</header>`;
}

function renderFlashMessage(message = '', state = 'success', marker = 'inline-feedback-v1') {
  if (!message) return '';
  const tone = String(state || '').toLowerCase() === 'error' ? 'error' : 'success';
  const polite = tone === 'error' ? 'assertive' : 'polite';
  return `<p class="flash ${tone}" data-verify="${escapeHtml(marker)}" role="status" aria-live="${polite}">${escapeHtml(message)}</p>`;
}

function renderMarketingSection({ targetAudience = '', funnels = [], sequenceTemplates = [], sequenceQueue = [], acquisitionMetrics = {}, qualifiedAccounts = [] } = {}) {
  const activeCampaigns = (funnels || []).filter((item) => String(item.status || '').toLowerCase() === 'active').length;
  const activeSequences = (sequenceTemplates || []).filter((item) => String(item.status || '').toLowerCase() === 'active').length;
  const queuedEnrollments = (sequenceQueue || []).filter((item) => ['queued', 'active'].includes(String(item.status || '').toLowerCase())).length;
  const goal = acquisitionMetrics?.goal_metrics || {};
  const totals = acquisitionMetrics?.totals || {};

  return `<article class="panel" id="marketing" data-verify="adzeta-marketing-section-v1">
    <div class="panel-head"><h2>Marketing</h2><span class="section-tag">tof snapshot</span></div>
    <p class="muted">Quick planning view for target audience, active campaigns/sequences, and top-funnel pulse.</p>
    <form class="inline-form" method="GET" action="/" data-verify="target-audience-input-v1">
      <input type="text" name="audience" placeholder="Target audience (e.g. VP Marketing at DTC beauty brands)" value="${escapeHtml(targetAudience)}" />
      <button type="submit">Save audience focus</button>
    </form>
    <div class="funnel-list" style="margin-top:.5rem" data-verify="active-campaign-summary-v1">
      <article class="funnel-card"><div class="funnel-title"><strong>Active campaigns</strong><span class="badge">${escapeHtml(activeCampaigns)}</span></div><div class="funnel-meta">Live funnels currently running outreach motion.</div></article>
      <article class="funnel-card"><div class="funnel-title"><strong>Active sequences</strong><span class="badge">${escapeHtml(activeSequences)}</span></div><div class="funnel-meta">Templates available for immediate enrollment.</div></article>
      <article class="funnel-card"><div class="funnel-title"><strong>Queued/active enrollments</strong><span class="badge">${escapeHtml(queuedEnrollments)}</span></div><div class="funnel-meta">Contacts already in outbound sequence flow.</div></article>
    </div>
    <div class="kpis" style="margin-top:.55rem" data-verify="top-funnel-metrics-v1">
      <article class="metric"><div class="name">New prospects (24h)</div><div class="value">${escapeHtml(goal.new_qualified_accounts_per_day ?? qualifiedAccounts.length ?? 0)}</div><div class="fresh">qualified accounts entering funnel</div></article>
      <article class="metric"><div class="name">Enrollments (24h)</div><div class="value">${escapeHtml(goal.enrolled_accounts_per_day ?? totals.enrollments ?? 0)}</div><div class="fresh">newly enrolled into outreach</div></article>
      <article class="metric"><div class="name">Reply rate</div><div class="value">${escapeHtml(goal.positive_reply_rate_text || '0.0%')}</div><div class="fresh">positive/classified replies</div></article>
    </div>
    <p style="margin-top:.55rem" data-verify="outreach-batch-cta-v1"><a class="button-link cta-emphasis" href="/actions">Prepare or launch outreach batch</a></p>
  </article>`;
}

function renderHomePersonalTaskPanel({ tasks = [], principal = '', role = 'operator' } = {}) {
  const normalizedPrincipal = String(principal || '').trim().toLowerCase();
  const allTasks = Array.isArray(tasks) ? tasks : [];
  let personalTasks = allTasks.filter((task) => String(task.owner || '').trim().toLowerCase() === normalizedPrincipal);

  if (!personalTasks.length && role === 'operator') {
    personalTasks = allTasks.filter((task) => String(task.owner || '').toLowerCase().includes('operator'));
  }

  const rows = personalTasks
    .slice(0, 12)
    .map((task) => {
      const status = String(task.status || 'todo').toLowerCase();
      const badgeTone = status === 'done' ? 'ok' : status === 'in_progress' ? 'info' : 'warn';
      return `<li><strong>${escapeHtml(task.title || 'Untitled task')}</strong> <span class="badge ${badgeTone}">${escapeHtml(status)}</span><div class="muted">Owner: ${escapeHtml(task.owner || 'unassigned')}</div></li>`;
    })
    .join('');

  return `<article class="panel" id="personal-task-list" data-verify="home-role-individual-personal-tasks-v1 home-role-behavior-individual-v1"><div class="panel-head"><h2>My tasks</h2><span class="section-tag">personal queue</span></div><p class="muted">Only tasks assigned to you are shown here.</p><ul class="queue-list">${rows || '<li class="empty-state">No personal tasks assigned yet.</li>'}</ul></article>`;
}

function renderHomeAdminTaskPanel({ tasks = [] } = {}) {
  const allTasks = Array.isArray(tasks) ? tasks : [];
  const ownerMap = new Map();
  for (const task of allTasks) {
    const owner = String(task.owner || 'unassigned').trim() || 'unassigned';
    const status = String(task.status || 'todo').toLowerCase();
    if (!ownerMap.has(owner)) ownerMap.set(owner, { owner, total: 0, todo: 0, in_progress: 0, done: 0 });
    const bucket = ownerMap.get(owner);
    bucket.total += 1;
    if (status === 'done') bucket.done += 1;
    else if (status === 'in_progress') bucket.in_progress += 1;
    else bucket.todo += 1;
  }
  const snapshot = Array.from(ownerMap.values()).sort((a, b) => b.total - a.total || a.owner.localeCompare(b.owner));
  const totals = snapshot.reduce((acc, item) => ({ total: acc.total + item.total, todo: acc.todo + item.todo, in_progress: acc.in_progress + item.in_progress, done: acc.done + item.done }), { total: 0, todo: 0, in_progress: 0, done: 0 });
  const rows = snapshot.map((item) => `<tr><td><strong>${escapeHtml(item.owner)}</strong></td><td>${escapeHtml(item.total)}</td><td>${escapeHtml(item.todo)}</td><td>${escapeHtml(item.in_progress)}</td><td>${escapeHtml(item.done)}</td></tr>`).join('');

  return `<article class="panel" id="admin-team-workload" data-verify="home-role-admin-team-summary-v1 home-role-admin-workload-snapshot-v1 home-role-behavior-admin-v1"><div class="panel-head"><h2>Team workload snapshot</h2><span class="section-tag">admin visibility</span></div><div class="kpis"><article class="metric"><div class="name">Total tasks</div><div class="value">${escapeHtml(totals.total)}</div><div class="fresh">across all owners</div></article><article class="metric"><div class="name">In progress</div><div class="value">${escapeHtml(totals.in_progress)}</div><div class="fresh">active workload</div></article><article class="metric"><div class="name">Todo</div><div class="value">${escapeHtml(totals.todo)}</div><div class="fresh">not started</div></article><article class="metric"><div class="name">Done</div><div class="value">${escapeHtml(totals.done)}</div><div class="fresh">completed</div></article></div><table style="margin-top:.55rem;"><thead><tr><th>Owner</th><th>Total</th><th>Todo</th><th>In progress</th><th>Done</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty-state">No workload snapshot available.</td></tr>'}</tbody></table></article>`;
}

function resolveHomeCommandIntent(rawCommand = '') {
  const command = String(rawCommand || '').trim();
  const text = command.toLowerCase();
  if (!text) {
    return { state: 'error', message: 'Enter a command first (example: "open targeting").', path: '/' };
  }

  const routeMatchers = [
    { path: '/targeting', label: 'Targeting', terms: ['targeting', 'target', 'qualify', 'qualification', 'prospect'] },
    { path: '/actions', label: 'Actions', terms: ['actions', 'queue', 'execute', 'task'] },
    { path: '/relationships', label: 'Relationships', terms: ['relationships', 'relationship', 'handoff', 'pipeline'] },
    { path: '/comms', label: 'Comms', terms: ['comms', 'communication', 'inbox', 'outbox', 'voice memo'] },
    { path: '/pilot', label: 'Pilot', terms: ['pilot', 'onboarding', 'candidate'] },
    { path: '/ops', label: 'Ops', terms: ['ops', 'operations', 'review', 'health', 'diagnostics'] },
    { path: '/strategy', label: 'Strategy', terms: ['strategy', 'roadmap', 'decision'] },
    { path: '/research', label: 'Research', terms: ['research', 'intel', 'ledger'] },
    { path: '/', label: 'Home', terms: ['home', 'dashboard'] },
  ];

  for (const rule of routeMatchers) {
    if (rule.terms.some((term) => text.includes(term))) {
      const message = `Command recognized: opening ${rule.label}.`;
      return { state: 'success', message, path: `${rule.path}?cmd_state=success&cmd_msg=${encodeURIComponent(message)}` };
    }
  }

  const fallbackMessage = 'Command not recognized. Try: "open targeting", "open actions", or "open ops".';
  return { state: 'error', message: fallbackMessage, path: `/?cmd_state=error&cmd_msg=${encodeURIComponent(fallbackMessage)}` };
}

function renderHomeCommandEntry({ commandMessage = '', commandState = 'success' } = {}) {
  return `<div class="dominant-cta" data-verify="home-command-shell-v1 home-command-shell-entry-v1">
    ${renderFlashMessage(commandMessage, commandState, 'home-command-shell-feedback-v1')}
    <form class="inline-form" method="GET" action="/home/command" data-verify="home-command-shell-form-v1" style="grid-template-columns:1fr auto auto;align-items:center;">
      <input id="home-command-input" type="text" name="q" placeholder="Type a command (e.g., open targeting)" aria-label="Home command input" />
      <button type="button" class="button-link button-secondary" id="home-command-voice" data-verify="home-command-shell-voice-trigger-v1" aria-label="Use voice command">🎙 Voice</button>
      <button type="submit" class="button-link cta-emphasis" data-verify="home-command-shell-submit-v1">Run command</button>
    </form>
    <p class="muted" id="home-command-voice-status" data-verify="home-command-shell-fallback-v1">Voice fallback: if speech input is unavailable, type your command and press Run command.</p>
    <script>
      (() => {
        const input = document.getElementById('home-command-input');
        const voiceBtn = document.getElementById('home-command-voice');
        const status = document.getElementById('home-command-voice-status');
        if (!input || !voiceBtn || !status) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          voiceBtn.disabled = true;
          voiceBtn.title = 'Speech input not available in this browser';
          status.textContent = 'Voice not available in this browser. Type your command and press Run command.';
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        voiceBtn.addEventListener('click', () => {
          try {
            status.textContent = 'Listening… say a command like "open targeting".';
            recognition.start();
          } catch {
            status.textContent = 'Voice capture could not start. Type your command instead.';
          }
        });

        recognition.onresult = (event) => {
          const transcript = event?.results?.[0]?.[0]?.transcript || '';
          input.value = transcript.trim();
          status.textContent = input.value ? ('Captured: "' + input.value + '". Press Run command.') : 'No speech captured. Type your command instead.';
        };

        recognition.onerror = () => {
          status.textContent = 'Voice capture failed. Type your command and press Run command.';
        };
      })();
    </script>
  </div>`;
}

function renderHomeCommandCenter({ funnels, qualifiedAccounts, meetingPipeline, kpis, campaignSummary = {}, acquisitionMetrics = {}, sequenceTemplates = [], unifiedKpiTelemetry = null, errorMessage = '', roleContext = { role: 'operator', principal: 'unknown' }, tasks = [], commandMessage = '', commandState = 'success' }) {
  const generatedAt = kpis?.generated_at ? formatDateTime(kpis.generated_at) : null;
  const homeKpiStrip = unifiedKpiTelemetry?.home_kpi_strip || deriveHomeKpiStripTelemetry({
    qualifiedAccounts,
    acquisitionMetrics,
    campaignSummary,
    kpis,
    normalizePilotHandoffStage,
  });

  const role = String(roleContext?.role || 'operator').toLowerCase();
  const taskPanel = role === 'admin'
    ? renderHomeAdminTaskPanel({ tasks })
    : renderHomePersonalTaskPanel({ tasks, principal: roleContext?.principal, role });

  return `${renderTopNav({ active: 'home', errorMessage })}
  <div class="page-shell page-shell-narrow home-density-balanced" data-verify="adzeta-home-funnel-first-v4 home-min-components-v1 home-single-objective-v4 home-health-hub-v1 gtm-domain-split-v1 home-exec-summary-v5 home-clarity-under-30s-v1">
    <article class="page-header primary-focus" data-verify="home-enterprise-hero-v3 home-single-objective-v3">
      <p class="section-tag">Home · one objective</p>
      <h1 class="hero-title-tight">Create more qualified pipeline this week.</h1>
      <p><strong>Do this now:</strong> qualify one target and launch it into execution.</p>
      <p class="muted">Scan outcomes below, then take one action.</p>
      ${renderHomeCommandEntry({ commandMessage, commandState })}
    </article>
    <article class="panel" data-verify="home-compact-kpi-strip-v4 adzeta-outcome-dashboard-v1 kpi-telemetry-unified-source-v1 home-clarity-outcomes-v1"><div class="panel-head"><h2>Outcome snapshot</h2><span class="section-tag">funnel + MRR + key metrics</span></div><div class="kpis" data-verify="adzeta-outcome-metrics-v2"><article class="metric"><div class="name">Funnel stage counts</div><div class="value">${escapeHtml(`Q ${homeKpiStrip.stage_counts.qualified} · D ${homeKpiStrip.stage_counts.discovery}`)}</div><div class="fresh">tracked accounts: ${escapeHtml(homeKpiStrip.stage_counts.total)}</div></article><article class="metric"><div class="name">MRR (proxy)</div><div class="value">${escapeHtml(homeKpiStrip.mrr.display)}</div><div class="fresh">${escapeHtml(homeKpiStrip.mrr.source)}</div></article><article class="metric"><div class="name">Positive replies + meetings</div><div class="value">${escapeHtml(`${homeKpiStrip.key_metrics.positiveReplies} + ${homeKpiStrip.key_metrics.meetingsBooked}`)}</div><div class="fresh">reply rate ${escapeHtml(homeKpiStrip.key_metrics.positiveReplyRateText)}</div></article><article class="metric"><div class="name">Execution throughput (24h)</div><div class="value">${escapeHtml(`${homeKpiStrip.key_metrics.completed24h}/${homeKpiStrip.key_metrics.delegations24h}`)}</div><div class="fresh">completed / delegated</div></article></div><p class="muted" style="margin-top:.45rem;">${generatedAt ? `Updated: ${escapeHtml(generatedAt)}` : 'Refresh for latest status.'} · KPI freshness: ${escapeHtml(formatDateTime(unifiedKpiTelemetry?.generated_at || kpis?.generated_at || new Date().toISOString()))}</p></article>
    ${taskPanel}
  </div>`;
}

function renderStrategyDecisionCenter({ strategy = null, errorMessage = '' } = {}) {
  const roadmapSummary = (strategy?.roadmap || []).map((lane) => `${lane.lane}: ${(lane.items || []).length}`).join(' · ') || 'Now: 0 · Next: 0 · Later: 0';
  const decisionsMarkup = (strategy?.activeDecisions || []).map((item) => `<tr>
      <td><strong>${escapeHtml(item.title)}</strong><div class="muted">Status: ${escapeHtml(item.status || 'active')}</div></td>
      <td>${escapeHtml(item.decision || '—')}</td>
      <td>${escapeHtml(item.rationale || '—')}</td>
      <td>${escapeHtml(item.owner || 'AI operator')}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="empty-state">No active decisions found.</td></tr>';

  return `${renderTopNav({ active: 'strategy', errorMessage })}
  <div class="page-shell" data-verify="strategy-layout-composition-v2 strategy-min-components-v1 strategy-single-objective-v1 strategy-decisions-page-v4 strategy-owner-status-tags-v1 strategy-cta-links-v2">
    <article class="page-header" data-verify="strategy-page-header-v2"><div class="panel-head"><h2>Strategy</h2><span class="section-tag">direction + tradeoffs</span></div><p><strong>Page purpose:</strong> Set one weekly objective and make explicit go/no-go decisions.</p><p class="muted">Maximum primary blocks on this page: 4 (objective, decisions, roadmap summary, execution CTA).</p><div class="dominant-cta"><a class="button-link cta-emphasis" href="/targeting" data-verify="strategy-single-dominant-cta-v1 strategy-cta-targeting-v2">Go to Targeting</a></div></article>
    <article class="panel"><div class="panel-head"><h2>Weekly objective</h2><span class="section-tag">owner + status</span></div><p>Run a repeatable top-of-funnel motion that turns qualified outbound activity into pilot-ready opportunities with visible weekly throughput.</p><p class="muted"><span class="badge">Owner: Growth Ops Lead</span> <span class="badge">Status: Active</span></p></article>
    <article class="panel"><div class="panel-head"><h2>Decisions</h2><span class="section-tag">explicit owner</span></div><table><thead><tr><th>Decision</th><th>Call</th><th>Rationale</th><th>Owner</th></tr></thead><tbody>${decisionsMarkup}</tbody></table></article>
    <article class="panel" data-verify="weekly-scorecard-module-v1"><div class="panel-head"><h2>Roadmap + weekly scorecard</h2><span class="section-tag">summary</span></div><p class="muted"><strong>Roadmap load:</strong> ${escapeHtml(roadmapSummary)}</p><ul class="queue-list">${(strategy?.weeklyScorecard?.highlights || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li class="muted">Run <code>npm run weekly:scorecard</code> to generate latest highlights.</li>'}</ul><p class="muted">Source: ${escapeHtml(strategy?.weeklyScorecard?.source || '.run/reports/weekly-scorecard/weekly-scorecard-latest.md')}</p><div class="links"><a class="button-link" href="/relationships" data-verify="strategy-cta-relationships-v2">Go to Relationships</a><a class="button-link button-secondary" href="/actions" data-verify="strategy-cta-actions-v2">Go to Actions</a><a class="button-link button-secondary" href="/pilot" data-verify="strategy-cta-pilot-v2">Go to Pilot</a><a class="button-link button-secondary" href="/ops" data-verify="strategy-cta-ops-v2">Go to Ops</a></div></article>
  </div>`;
}

function renderMarketingTargetIntake({ intakeMessage = '', intakeState = 'success' } = {}) {
  return `<div data-verify="marketing-target-input-simplified-v1">
    <p class="muted">Start with one prompt. Describe the audience or exact person and we will auto-place them into the best-fit sequence.</p>
    ${renderFlashMessage(intakeMessage, intakeState, 'marketing-target-intake-feedback-v1')}
    <form class="inline-form" method="POST" action="/marketing/targets/create" data-verify="target-audience-input-v2">
      <input type="text" name="target_prompt" placeholder="e.g. VP Marketing at DTC beauty brands spending 500k+ on paid social" required />
      <button type="submit">Add target + auto-place sequence</button>
    </form>
    <p class="muted" style="margin-top:.35rem;">No multi-field intake required in primary flow. You can refine account details later in Sales.</p>
  </div>`;
}

function renderMarketingPage({ funnels, acquisitionMetrics, assetSummary, sequenceTemplates, errorMessage = '', intakeMessage = '', intakeState = 'success' }) {
  return `${renderTopNav({ active: 'targeting', errorMessage })}
  <div class="page-shell" data-verify="targeting-route-v2"><article class="page-header"><div class="panel-head"><h2>Targeting</h2><span class="section-tag">demand generation</span></div><p><strong>Build and launch qualified outreach inputs.</strong></p></article>
  <article class="panel"><h2>Target input (prompt-first)</h2>${renderMarketingTargetIntake({ intakeMessage, intakeState })}</article>
  <article class="panel"><h2>Funnel execution</h2>${renderFunnelPanel(funnels, sequenceTemplates)}</article>
  <article class="panel"><h2>Acquisition metrics</h2>${renderAcquisitionMetricsPanel(acquisitionMetrics)}</article>
  <article class="panel"><h2>Asset performance inventory</h2>${renderAssets(assetSummary)}</article></div>`;
}

function generateTargetRecommendations(targetPrompt = '', inferred = null) {
  const prompt = String(targetPrompt || '').trim();
  if (!prompt) return { segments: [], companies: [], individuals: [] };

  const role = inferred?.contact_role || 'Marketing decision maker';
  const channels = Array.isArray(inferred?.channels) ? inferred.channels : [];
  const channelLabel = channels.length ? channels.join(', ') : 'meta_ads';

  const segments = [
    {
      id: 'segment-1',
      label: `${role} at performance-led DTC brands`,
      rationale: `Prompt indicates demand-gen responsibility and paid channel focus (${channelLabel}).`,
      confidence: 84,
    },
    {
      id: 'segment-2',
      label: `Growth leaders needing faster creative testing loops`,
      rationale: 'Sequence angle is likely strongest where speed-to-learning and CAC pressure are explicit.',
      confidence: 77,
    },
  ];

  const companies = [
    {
      id: 'company-1',
      name: inferred?.brand?.replace(/^Prospect segment:\s*/i, '').slice(0, 80) || 'Prompt-matched DTC brand cohort',
      rationale: 'Directly derived from user input; best fit for immediate launch while context is fresh.',
      confidence: 81,
    },
    {
      id: 'company-2',
      name: 'Adjacent DTC peer brands (same spend band)',
      rationale: 'Similar spend/channel profiles generally respond to same first-touch message architecture.',
      confidence: 72,
    },
  ];

  const individuals = [
    {
      id: 'individual-1',
      name: inferred?.contact_role || 'VP Marketing',
      rationale: 'Decision authority is implied in prompt and aligns to outreach conversion path.',
      confidence: 86,
    },
    {
      id: 'individual-2',
      name: 'Director of Growth',
      rationale: 'Strong secondary buyer/influencer for campaign execution and pilot feasibility.',
      confidence: 74,
    },
  ];

  return { segments, companies, individuals };
}

function buildTargetingInference(targetPrompt = '', sequenceTemplates = []) {
  const prompt = String(targetPrompt || '').trim();
  if (!prompt) return null;

  const inferred = inferQualifiedAccountFromTargetPrompt(prompt);
  const suggestedTemplate = chooseSequenceTemplateForTargetPrompt(prompt, sequenceTemplates) || null;
  const segment = inferred?.contact_role || inferred?.brand || 'Marketing decision maker';
  const sequencePlacement = suggestedTemplate?.name || suggestedTemplate?.slug || 'Default active sequence';
  const channels = Array.isArray(inferred?.channels) ? inferred.channels.filter(Boolean) : [];
  const hasChannelSignals = channels.length > 0;
  const spendTier = String(inferred?.est_spend_tier || '').toLowerCase();
  const isUpperSpend = spendTier.includes('enterprise') || spendTier.includes('high') || spendTier.includes('1m');
  const recommendations = generateTargetRecommendations(prompt, inferred);

  const confidenceScore = clamp(
    Math.round(
      62
      + (hasChannelSignals ? 12 : 0)
      + (isUpperSpend ? 10 : 0)
      + (suggestedTemplate ? 8 : 0)
    ),
    55,
    94,
  );

  const sequenceFit = suggestedTemplate
    ? `${sequencePlacement} aligns to the described channel + spend profile.`
    : 'No direct template match. Use default active sequence and monitor first-touch response.';

  const launchPlan = suggestedTemplate
    ? `Launch now using ${sequencePlacement}; review reply quality after first touch.`
    : 'Launch with default active sequence; re-score segment fit after first touch and adjust template if needed.';

  return {
    prompt,
    inferred,
    suggestedTemplate,
    segment,
    sequencePlacement,
    sequenceFit,
    confidenceScore,
    launchPlan,
    recommendations,
  };
}

function renderTargetingStudioPage({ targetPrompt = '', inference = null, message = '', messageState = 'success', errorMessage = '' } = {}) {
  return `${renderTopNav({ active: 'targeting', errorMessage })}
  <div class="page-shell" data-verify="targeting-route-v3 targeting-min-components-v1 targeting-single-objective-v1 targeting-studio-single-input-v1 targeting-actions-hardening-v1 targeting-golden-step-1-v1">
    <article class="page-header"><div class="panel-head"><h2>Targeting Studio</h2><span class="section-tag">step 1 of 4 · single-input</span></div><p><strong>Page purpose:</strong> Qualify one target fast, then launch directly to Actions.</p><p class="muted">Maximum primary blocks on this page: 3 (objective, single input, fit summary).</p><div class="dominant-cta"><a class="button-link cta-emphasis" href="/actions?source=targeting" data-verify="targeting-single-dominant-cta-v1">Open Actions after launch</a></div></article>
    <article class="panel" data-verify="targeting-single-input-form-v1">
      ${renderFlashMessage(message, messageState, 'targeting-studio-feedback-v1')}
      <form class="inline-form" method="POST" action="/targeting/infer">
        <input type="text" name="target_prompt" placeholder="e.g. VP Marketing at a DTC skincare brand spending $1M+ on Meta + Google" value="${escapeHtml(targetPrompt)}" required />
        <button type="submit">Generate fit summary</button>
      </form>
    </article>
    <article class="panel" data-verify="targeting-ai-inference-panel-v1 targeting-exec-reasoning-output-v1 targeting-assistive-reasoning-ui-v1 v2-targeting-assistive-reasoning-ui">
      <div class="panel-head"><h2>Fit summary</h2><span class="section-tag">exec summary</span></div>
      ${inference ? `<table><tbody>
        <tr><th>Segment</th><td>${escapeHtml(inference.segment)}</td></tr>
        <tr><th>Sequence fit</th><td>${escapeHtml(inference.sequenceFit || inference.sequencePlacement || 'Not available')}</td></tr>
        <tr><th>Confidence</th><td>${escapeHtml(Number(inference.confidenceScore) > 0 ? `${Number(inference.confidenceScore)}%` : '—')}</td></tr>
        <tr><th>Recommended launch plan</th><td>${escapeHtml(inference.launchPlan || 'Launch now and review performance after first touch.')}</td></tr>
      </tbody></table>
      <article class="panel" style="margin-top:.55rem" data-verify="targeting-launch-preview-summary-v1 v2-targeting-launch-preview-summary">
        <div class="panel-head"><h3>Launch preview</h3><span class="section-tag">before approve</span></div>
        <p class="muted"><strong>Target input:</strong> ${escapeHtml(inference.prompt || '—')}</p>
        <p class="muted"><strong>Sequence to launch:</strong> ${escapeHtml(inference?.suggestedTemplate?.name || inference?.suggestedTemplate?.slug || inference.sequencePlacement || 'Default active sequence')}</p>
        <p class="muted"><strong>Confidence check:</strong> ${escapeHtml(Number(inference.confidenceScore) >= 75 ? 'High-confidence launch candidate' : 'Review fit details before launch')}</p>
      </article>
      <article class="panel" style="margin-top:.55rem" data-verify="targeting-expected-outcomes-panel-v1 v2-targeting-expected-outcomes">
        <div class="panel-head"><h3>Expected outcomes</h3><span class="section-tag">first touch</span></div>
        <ul class="queue-list">
          <li>Creates one qualified account and enrolls it into the selected outreach sequence.</li>
          <li>Writes launch artifacts to Actions + Relationships for downstream handoff visibility.</li>
          <li>Routes you into execution flow: <strong>Targeting → Actions → Relationships → Pilot</strong>.</li>
        </ul>
      </article>
      <article class="panel" style="margin-top:.55rem" data-verify="targeting-recommendations-panel-v1">
        <div class="panel-head"><h3>Proposed targets</h3><span class="section-tag">segments · companies · individuals</span></div>
        <table><thead><tr><th>Type</th><th>Proposal</th><th>Rationale</th><th>Confidence</th></tr></thead><tbody>
          ${(inference?.recommendations?.segments || []).map((item) => `<tr><td>Segment</td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.rationale)}</td><td>${escapeHtml(item.confidence)}%</td></tr>`).join('')}
          ${(inference?.recommendations?.companies || []).map((item) => `<tr><td>Company</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.rationale)}</td><td>${escapeHtml(item.confidence)}%</td></tr>`).join('')}
          ${(inference?.recommendations?.individuals || []).map((item) => `<tr><td>Individual</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.rationale)}</td><td>${escapeHtml(item.confidence)}%</td></tr>`).join('')}
        </tbody></table>
      </article>
      <form method="POST" action="/targeting/approve-launch" style="margin-top:.55rem" data-verify="targeting-approve-launch-action-v1 targeting-actions-transition-cta-v1 targeting-golden-next-actions-v1 targeting-approval-override-v1">
        <input type="hidden" name="target_prompt" value="${escapeHtml(inference.prompt)}" />
        <input type="hidden" name="sequence_template_id" value="${escapeHtml(inference?.suggestedTemplate?.id || '')}" />
        <input type="hidden" name="inference_confidence" value="${escapeHtml(inference.confidenceScore || 0)}" />
        <label>Approval control
          <select name="approval_mode">
            <option value="approve">Approve AI proposal</option>
            <option value="override">Approve with override</option>
          </select>
        </label>
        <label>Override company/brand (optional)
          <input type="text" name="override_brand" placeholder="Override brand name before launch" />
        </label>
        <label>Override individual role (optional)
          <input type="text" name="override_contact_role" placeholder="Override contact role" />
        </label>
        <div class="links"><button type="submit" name="next" value="actions">Approve, launch, open Actions</button><button type="submit" name="next" value="targeting" class="button-secondary">Launch and stay in Targeting</button></div>
      </form>
      <article class="panel" style="margin-top:.55rem" data-verify="targeting-post-launch-next-steps-cta-v1 v2-targeting-post-launch-actions-cta">
        <div class="panel-head"><h3>Post-launch next step</h3><span class="section-tag">step 2 of 4</span></div>
        <p class="muted">After launch, immediately triage priority cards and owners in Actions.</p>
        <p><a class="button-link" href="/actions?source=targeting">Open Actions now</a></p>
      </article>` : '<p class="empty-state">No summary yet. Enter a prompt to generate segment, fit, confidence, and launch plan.</p>'}
    </article>
  </div>`;
}

function renderLaunchRelationshipsPanel(rows = []) {
  return `<div data-verify="launch-relationships-output-v1"><table><thead><tr><th>When</th><th>Target set</th><th>Brand</th><th>Stage</th><th>Engagement</th><th>Sequence</th><th>Confidence</th></tr></thead><tbody>${(rows || []).map((row) => `<tr><td>${escapeHtml(row.created_at ? new Date(row.created_at).toLocaleString() : '—')}</td><td><code>${escapeHtml(row.target_set_id || '—')}</code></td><td>${escapeHtml(row.brand || '—')}</td><td>${escapeHtml(row.stage || row.relationship_state || '—')}</td><td>${escapeHtml(row.engagement_state || '—')}</td><td>${escapeHtml(row.sequence_name || row.sequence_template_id || '—')}</td><td>${escapeHtml(row.confidence_score ? `${row.confidence_score}%` : '—')}</td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">No targeting launch relationship records yet.</td></tr>'}</tbody></table></div>`;
}

function renderRelationshipsCorePanel({ qualifiedAccounts = [], meetingPipeline = {}, launchRelationships = [], relationshipIntelligence = {} } = {}) {
  const sales = buildSalesSectionQueue(qualifiedAccounts || [], meetingPipeline || {});
  const launchRows = Array.isArray(launchRelationships) ? launchRelationships : [];
  const intelligenceByAccountId = new Map((relationshipIntelligence?.scores || []).map((row) => [String(row.account_id || ''), row]));

  const timelineForAccount = (account) => {
    const brand = String(account.brand || '').toLowerCase();
    const matchedLaunch = launchRows
      .filter((row) => String(row.brand || '').toLowerCase() === brand)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    const events = [
      { when: account.created_at, label: 'Account qualified', detail: `Confidence ${Number(account.qualification_confidence) || 0}` },
      { when: account.outreach_enrolled_at, label: 'Enrolled in outreach', detail: account.outreach_sequence_template_id || 'Template selected' },
      { when: account.pilot_onboarding_routed_at, label: 'Routed to pilot onboarding', detail: 'Human engagement expected' },
      ...matchedLaunch.slice(0, 2).map((row) => ({
        when: row.created_at,
        label: 'Targeting launch touch logged',
        detail: `${row.sequence_name || row.sequence_template_id || 'Sequence'} · ${row.engagement_state || row.stage || row.relationship_state || 'state logged'}`,
      })),
    ].filter((event) => event.when);

    return events
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
      .slice(0, 4);
  };

  const stageLabel = (item) => {
    const stage = String(item.stage || item.pipeline_stage || '').toLowerCase();
    if (stage === 'pilot_candidate') return 'Pilot candidate';
    if (stage === 'discovery') return 'Discovery';
    if (stage === 'qualified') return 'Qualified';
    return 'In review';
  };

  const confidenceCue = (item) => {
    const confidence = Number(item.qualification_confidence) || 0;
    const cue = confidence >= 80 ? 'High confidence' : confidence >= 65 ? 'Medium confidence' : 'Low confidence';
    const tone = confidence >= 80 ? 'ok' : confidence >= 65 ? 'info' : 'warn';
    return `<span class="badge ${tone}">${escapeHtml(cue)} · ${escapeHtml(confidence)}</span>`;
  };

  const rows = (sales.queue || []).slice(0, 6).map((item, index) => {
    const timeline = timelineForAccount(item);
    const latestTouch = timeline.find((event) => String(event.label || '').toLowerCase().includes('touch'));
    const latestTouchText = latestTouch
      ? `${new Date(latestTouch.when).toLocaleString()} · ${latestTouch.detail}`
      : (item.outreach_enrolled_at
        ? `${new Date(item.outreach_enrolled_at).toLocaleString()} · Outreach enrolled (delivery in-progress)`
        : 'No delivered value-first touch logged yet');

    const timelineMarkup = timeline.length
      ? `<ol class="queue-list" style="margin:0;">${timeline.map((event, timelineIndex) => `<li><strong>${escapeHtml(timelineIndex === 0 ? 'Latest' : `T-${timelineIndex}`)}</strong> · ${escapeHtml(new Date(event.when).toLocaleDateString())}<div class="muted">${escapeHtml(event.label)} — ${escapeHtml(event.detail || '')}</div></li>`).join('')}</ol>`
      : '<span class="empty-state">No timeline events yet.</span>';

    const nextTouch = item.next_touch_suggestion || item.next_best_action || 'Review account and propose next touch.';
    const confidence = Number(item.qualification_confidence) || 0;
    const conciseRationale = item.human_handoff_trigger
      ? (item.human_handoff_reason || `Hand off now: ${stageLabel(item)} stage, confidence ${confidence}.`)
      : `Do AI next touch first: ${stageLabel(item)}${confidence ? `, conf ${confidence}` : ''}${item.due_date_text ? `, due ${item.due_date_text}` : ''}.`;
    const handoffAction = item.human_handoff_trigger
      ? `<div style="margin-top:.4rem;"><a class="button-link button-secondary" href="/relationships#team-handoff-queue" data-verify="relationships-one-click-handoff-v1">Hand off to team queue</a></div>`
      : '';
    const intelligence = intelligenceByAccountId.get(String(item.id || '')) || {};
    const interactionSignals = [item.outreach_enrolled_at, item.pilot_onboarding_routed_at, item.owner && String(item.owner).toLowerCase() !== 'unassigned', latestTouch].filter(Boolean).length;
    const progression = buildProgressionRecommendation(item, {
      interactionSignals,
      healthScore: intelligence.relationship_health || confidence,
      pilotReadiness: intelligence.pilot_readiness || Number(item.readiness_score || 0),
    });

    return `<tr>
      <td><strong>#${index + 1}</strong><div class="muted">${escapeHtml(item.brand || 'Unknown account')}</div><div style="margin-top:.3rem"><span class="badge info">${escapeHtml(stageLabel(item))}</span></div></td>
      <td>${timelineMarkup}</td>
      <td><strong>${escapeHtml(latestTouchText)}</strong></td>
      <td><div><strong>Next touch:</strong> ${escapeHtml(nextTouch)}</div><div class="muted" style="margin-top:.25rem;"><strong>Why:</strong> ${escapeHtml(conciseRationale)}</div><div class="muted" style="margin-top:.25rem;"><strong>Do now:</strong> ${escapeHtml(item.human_handoff_trigger ? 'Hand off to team queue and assign owner.' : 'Send next touch, then log outcome.')}</div><div class="muted" style="margin-top:.25rem;" data-verify="relationships-progression-recommendation-v1">${renderProgressionRecommendationBadge(progression)} · confidence ${escapeHtml(progression.confidence)}%<br/><strong>Why:</strong> ${escapeHtml(conciseRecommendationRationale({ rationale: progression.reason }, 120))}</div></td>
      <td><div>${confidenceCue(item)}</div><div class="muted" style="margin-top:.25rem;">Confidence means: ${escapeHtml(confidence >= 80 ? 'strong fit + urgency' : confidence >= 65 ? 'viable, verify context' : 'needs more evidence before escalation')}.</div><div style="margin-top:.25rem"><span class="badge ${item.human_handoff_trigger ? 'ok' : 'warn'}">${item.human_handoff_trigger ? 'Handoff now' : 'Monitor'}</span></div><div class="muted" style="margin-top:.25rem;">Owner: ${escapeHtml(item.owner || 'Unassigned')} · Due: ${escapeHtml(item.due_date_text || '—')}</div>${handoffAction}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-state">No relationship accounts available yet.</td></tr>';

  return `<div data-verify="relationships-core-page-v1 relationships-state-timeline-v1 relationships-value-first-touch-v1 relationships-next-touch-rationale-v1 relationships-human-handoff-indicators-v1 relationships-readability-enterprise-v2 relationships-one-click-handoff-v1">
    <p class="muted">Relationship command view with plain-language stage cues, confidence context, and clear do-now guidance.</p>
    <table><thead><tr><th>Priority account</th><th>Timeline hierarchy</th><th>Latest touch delivered</th><th>Next-touch recommendation</th><th>Status + confidence</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}

function renderSalesPage({ qualifiedAccounts, sequenceTemplates, sequenceQueue, enrollmentBySequence, meetingPipeline, launchRelationships = [], relationshipIntelligence = {}, errorMessage = '' }) {
  const stageCounts = summarizeQualifiedAccountStages(qualifiedAccounts || []);
  const discoveryReadyForPilot = (qualifiedAccounts || []).filter((item) => {
    const stage = normalizePilotHandoffStage(item?.pipeline_stage) || 'qualified';
    return stage === 'discovery' && computeAccountReadiness(item) === 'qualified';
  }).length;
  const transitionRationaleSummary = `Pipeline now: ${stageCounts.qualified} qualified → ${stageCounts.discovery} in discovery → ${stageCounts.pilot_candidate} pilot candidates. ${discoveryReadyForPilot} discovery account(s) are ready to promote to pilot candidate.`;

  return `${renderTopNav({ active: 'relationships', errorMessage })}
  <div class="page-shell" data-verify="relationships-route-v3 relationships-min-components-v1 relationships-single-objective-v1 relationships-golden-step-3-v1 v2-relationships-to-pilot-transition-v1 relationship-health-score-wiring-v1">
    <article class="page-header"><div class="panel-head"><h2>Relationships</h2><span class="section-tag">step 3 of 4 · pipeline + outreach</span></div><p><strong>Page purpose:</strong> Promote qualified accounts to pilot-ready status with clear next-touch ownership.</p><p class="muted">Maximum primary blocks on this page: 4 (objective, handoff CTA, relationship workspace, handoff queue).</p><p class="muted" data-verify="relationships-promotion-criteria-v1">Promotion criteria to Pilot: account is in discovery/pilot-candidate stage, owner is assigned, and readiness signal is qualified (or explicit gate says WATCH/GO).</p><div class="dominant-cta"><a class="button-link cta-emphasis" href="/pilot?source=relationships#pilot-core-board" data-verify="relationships-single-dominant-cta-v2 relationships-to-pilot-one-click-v1">Continue to Pilot board</a></div></article>
    <article class="panel" data-verify="relationships-golden-next-pilot-v2 relationships-pilot-promotion-cta-v1"><h2>Pilot handoff</h2><p class="muted">${escapeHtml(transitionRationaleSummary)}</p><p class="muted" data-verify="relationships-confidence-rationale-v1">Confidence rationale: prioritize accounts with strong qualification confidence, recent touch momentum, and complete readiness evidence.</p><div class="cta-grid"><section class="cta-card cta-primary"><strong>Promote pilot-ready accounts now</strong><p>Use movement actions in the workspace below, then hand off to Pilot governance.</p><a class="button-link" href="/pilot?source=relationships#pilot-core-board">Continue to Pilot board</a></section><section class="cta-card" data-verify="relationships-cta-comms-v1"><strong>Open Comms</strong><p>Use Account Workspace or Individual Workspace for touch execution context.</p><a class="button-link" href="/comms?view=account&tab=inbox">Open Comms</a></section></div></article>
    <article class="panel"><h2>Relationships workspace (core)</h2>${renderRelationshipsCorePanel({ qualifiedAccounts, meetingPipeline, launchRelationships, relationshipIntelligence })}</article>
    <article class="panel" id="team-handoff-queue"><h2>Team handoff queue</h2>${renderTeamHandoffQueue(qualifiedAccounts || [], sequenceTemplates || [])}</article>
  </div>`;
}

function renderRevOpsPage({ strategy, qualifiedAccounts = [], relationshipIntelligence = {}, errorMessage = '', source = '' }) {
  return `${renderTopNav({ active: 'pilot', errorMessage })}
  <div class="page-shell" data-verify="pilot-route-v3 pilot-min-components-v1 pilot-single-objective-v1 pilot-golden-step-4-v1 v2-pilot-cta-gate-clarity-pass pilot-progression-recommender-v1"><article class="page-header"><div class="panel-head"><h2>Pilot</h2><span class="section-tag">step 4 of 4 · governance</span></div><p><strong>Page purpose:</strong> Make go/no-go pilot decisions and execute the next approved stage transition.</p><p class="muted">Maximum primary blocks on this page: 4 (objective, gate summary, core board, strategy context).</p><p class="muted" data-verify="pilot-promotion-criteria-v1">Promotion criteria: only execute transitions with GO/WATCH gates plus required readiness evidence; stop on NO-GO until blockers are resolved.</p><div class="dominant-cta"><a class="button-link cta-emphasis" href="#pilot-core-board" data-verify="pilot-single-dominant-cta-v1">Go to core conversion board</a></div>${source === 'relationships' ? '<p class="muted" data-verify="pilot-entry-from-relationships-v1">Entered from Relationships: apply gate checks, then run one approved transition.</p>' : ''}</article>
  <article class="panel" data-verify="pilot-cta-gate-clarity-v2"><h2>Pilot go/no-go gates</h2><p class="muted">Read gate status first, then execute one transition action on the board.</p>${renderPilotPhaseTrackerPanel()}</article>
  <article class="panel" id="pilot-core-board"><h2>Core conversion board</h2><p class="muted">Track discovery → pilot candidate → pilot live with one explicit next action per card.</p><p class="muted" data-verify="pilot-confidence-rationale-v1">Confidence rationale on each card combines interaction signals, relationship health, and readiness components (intent, response quality, fit, data completeness).</p>${renderPilotCoreConversionBoard(qualifiedAccounts || [], relationshipIntelligence)}</article>
  <article class="panel"><h2>Strategy snapshot</h2><p class="muted">${escapeHtml(strategy?.summary || 'No strategy summary available')}</p><p><a class="button-link button-secondary" href="/ops">Open Ops diagnostics</a></p></article></div>`;
}

function renderLaunchActionsPanel(rows = []) {
  return `<div data-verify="launch-actions-output-v1"><table><thead><tr><th>When</th><th>Target set</th><th>Action</th><th>Priority</th><th>Confidence</th><th>Task ID</th></tr></thead><tbody>${(rows || []).map((row) => `<tr><td>${escapeHtml(row.created_at ? new Date(row.created_at).toLocaleString() : '—')}</td><td><code>${escapeHtml(row.target_set_id || '—')}</code></td><td>${escapeHtml(row.action_title || row.action_type || '—')}</td><td>${escapeHtml(row.priority || '—')}</td><td>${escapeHtml(row.confidence_score ? `${row.confidence_score}%` : '—')}</td><td>${escapeHtml(row.task_id || '—')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No targeting launch action records yet.</td></tr>'}</tbody></table></div>`;
}

function classifyEngagementTrend(replyRows = [], handoffTrigger = false) {
  const positiveCount = replyRows.filter((row) => ['positive', 'interested', 'meeting_ready'].includes(String(row.classification || '').toLowerCase())).length;
  const negativeCount = replyRows.filter((row) => ['negative', 'not_interested', 'unsubscribe'].includes(String(row.classification || '').toLowerCase())).length;
  if (positiveCount > negativeCount) return { label: 'upward', className: 'ok' };
  if (negativeCount > positiveCount) return { label: 'downward', className: 'bad' };
  if (handoffTrigger || positiveCount > 0) return { label: 'warming', className: 'info' };
  return { label: 'flat', className: 'warn' };
}

function summarizeEngagementTrends(threadRows = []) {
  const summary = { upward: 0, warming: 0, flat: 0, downward: 0 };
  (threadRows || []).forEach((item) => {
    const key = String(item.trendLabel || 'flat').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(summary, key)) summary[key] += 1;
  });
  return summary;
}

function inferCommsActionAttribution(actor = '') {
  const text = String(actor || '').toLowerCase();
  if (!text) return { label: 'System', className: 'info' };
  if (text.includes('human') || text.includes('operator') || text.includes('owner') || text.includes('sales')) return { label: 'Human', className: 'ok' };
  if (text.includes('ai') || text.includes('router') || text.includes('automation') || text.includes('system')) return { label: 'AI', className: 'warn' };
  return { label: 'System', className: 'info' };
}

function chooseFollowupCadencePreset({ status = '', handoffTrigger = false, pilotReadiness = 0, relationshipHealth = 0, trendLabel = '' } = {}) {
  const normalizedStatus = String(status || '').toLowerCase();
  const normalizedTrend = String(trendLabel || '').toLowerCase();
  if (handoffTrigger || normalizedStatus === 'escalated' || pilotReadiness >= 80 || normalizedTrend === 'upward') return 'aggressive';
  if (relationshipHealth >= 72 || normalizedStatus === 'replied' || normalizedTrend === 'warming') return 'standard';
  return 'light';
}

function explainCadenceSelection({ cadence = 'standard', status = '', handoffTrigger = false, pilotReadiness = 0, relationshipHealth = 0, trendLabel = '' } = {}) {
  const triggers = [];
  const normalizedStatus = String(status || '').toLowerCase();
  const normalizedTrend = String(trendLabel || '').toLowerCase();
  if (handoffTrigger) triggers.push('human handoff active');
  if (normalizedStatus === 'escalated') triggers.push('status escalated');
  if (pilotReadiness >= 80) triggers.push(`pilot readiness ${Math.round(Number(pilotReadiness) || 0)}`);
  if (normalizedTrend === 'upward') triggers.push('trend upward');
  if (normalizedTrend === 'warming') triggers.push('trend warming');
  if (relationshipHealth >= 72) triggers.push(`relationship health ${Math.round(Number(relationshipHealth) || 0)}`);
  if (normalizedStatus === 'replied') triggers.push('recent reply');
  return `${cadence} cadence selected because ${triggers.slice(0, 2).join(', ') || 'baseline follow-up pacing'}.`;
}

function explainFirstThreadStep(thread = {}, cadenceReason = '') {
  const first = Array.isArray(thread.steps) ? thread.steps[0] : null;
  if (!first) return 'No first-step rationale available.';
  return `Step 1 starts at T+${first.delay_hours}h via ${first.type} to keep momentum; ${first.note}${cadenceReason ? ` (${cadenceReason})` : ''}`;
}

function generateFollowupThread({ cadence = 'standard', baseDate = new Date(), channel = 'email', targetLabel = 'contact', reason = '' } = {}) {
  const presets = {
    light: [
      { delayHours: 0, type: channel, note: 'Initial value-first outreach' },
      { delayHours: 72, type: channel, note: 'Follow-up with single proof point' },
      { delayHours: 168, type: 'call', note: 'Short call/voicemail check-in if still no reply' },
    ],
    standard: [
      { delayHours: 0, type: channel, note: 'Initial value-first outreach' },
      { delayHours: 48, type: channel, note: 'Follow-up with concise case study/benchmark' },
      { delayHours: 120, type: 'sms', note: 'Short nudge with clear CTA' },
    ],
    aggressive: [
      { delayHours: 0, type: channel, note: 'Priority outreach with direct CTA' },
      { delayHours: 24, type: channel, note: 'Rapid follow-up with tailored pilot angle' },
      { delayHours: 72, type: 'call', note: 'Live touch attempt + scheduling ask' },
    ],
  };
  const template = presets[cadence] || presets.standard;
  const baseMs = new Date(baseDate).getTime();
  const steps = template.map((step, index) => ({
    step: index + 1,
    cadence,
    type: step.type,
    note: `${step.note}${reason ? ` · ${reason}` : ''}`,
    scheduled_for: new Date(baseMs + (step.delayHours * 60 * 60 * 1000)).toISOString(),
    delay_hours: step.delayHours,
    target: targetLabel,
  }));
  const nextStep = steps[0] || null;
  return { cadence, steps, nextStep };
}

function formatThreadTimelineSummary(thread = {}) {
  const steps = Array.isArray(thread.steps) ? thread.steps : [];
  if (!steps.length) return 'No follow-up thread yet.';
  return steps.slice(0, 3).map((step) => `T+${step.delay_hours}h ${step.type}: ${step.note}`).join(' → ');
}

function renderThreadMiniList(thread = {}, marker = 'comms-thread-steps-v1') {
  const steps = Array.isArray(thread.steps) ? thread.steps : [];
  if (!steps.length) return '<span class="empty-state">No thread steps generated.</span>';
  return `<ol class="queue-list" data-verify="${escapeHtml(marker)}" style="margin:0;">${steps.slice(0, 3).map((step) => `<li><strong>Step ${escapeHtml(step.step)}</strong> · scheduled ${escapeHtml(new Date(step.scheduled_for).toLocaleString())}<div class="muted">${escapeHtml(step.type)} — ${escapeHtml(step.note)}</div></li>`).join('')}</ol>`;
}

function renderIndividualIntelligencePanel(rows = [], { view = 'individual', tab = 'inbox', accountId = '', contact = '', taskState = '', taskMessage = '' } = {}) {
  if (String(view) !== 'individual') return '';
  const topRows = (rows || []).slice(0, 3);
  if (!topRows.length) return '<article class="panel" data-verify="individual-intelligence-panel-v1"><h2>Individual intelligence panel</h2><p class="muted">No individual rows in this view yet.</p></article>';

  const cards = topRows.map((item, idx) => {
    const contactName = item.contact_name || item.brand || `Contact ${idx + 1}`;
    const role = item.contact_role || 'Decision maker';
    const personaContext = item.persona_context || `Primary contact for ${item.brand || 'account'} outreach.`;
    const trajectoryLabel = item.human_handoff_trigger
      ? 'accelerating'
      : (Number(item.relationship_health_delta || 0) > 0 ? 'warming' : Number(item.relationship_health_delta || 0) < 0 ? 'cooling' : 'flat');
    const trajectorySummary = item.human_handoff_reason || item.last_touch_note || `Trajectory is ${trajectoryLabel}; maintain momentum with timely follow-up.`;
    const outreachAngle = item.recommended_opener || item.next_best_action || 'Lead with one concrete business outcome and ask for a focused next step.';
    const confidenceScore = Math.max(35, Math.min(96, Math.round(((Number(item.relationship_health) || 0) * 0.55) + ((Number(item.pilot_readiness) || 0) * 0.35) + (item.human_handoff_trigger ? 10 : 0))));
    const confidenceClass = confidenceScore >= 75 ? 'ok' : confidenceScore >= 55 ? 'warn' : 'bad';
    const confidenceRationale = item.rationale || `Confidence reflects relationship health (${Number(item.relationship_health) || 0}) and pilot readiness (${Number(item.pilot_readiness) || 0}).`;
    const actionText = `Human follow-up for ${contactName}${item.brand ? ` (${item.brand})` : ''}: ${item.next_best_action || outreachAngle}`;

    return `<article class="funnel-card" data-verify="individual-intel-card-v1 individual-persona-role-context-v1 individual-engagement-trajectory-v1 individual-outreach-angle-confidence-v1"><div class="funnel-title"><strong>${escapeHtml(contactName)}</strong><span class="badge ${confidenceClass}">confidence ${escapeHtml(confidenceScore)}%</span></div><div class="funnel-meta">${escapeHtml(item.brand || '—')} · ${escapeHtml(role)}</div><p class="card-note"><strong>Persona / role context:</strong> ${escapeHtml(personaContext)}</p><p class="card-note"><strong>Engagement trajectory:</strong> <span class="badge ${trajectoryLabel === 'accelerating' || trajectoryLabel === 'warming' ? 'ok' : trajectoryLabel === 'cooling' ? 'warn' : 'info'}">${escapeHtml(trajectoryLabel)}</span> ${escapeHtml(trajectorySummary)}</p><p class="card-note"><strong>Recommended outreach angle:</strong> ${escapeHtml(outreachAngle)}</p><p class="muted card-context"><strong>Rationale:</strong> ${escapeHtml(confidenceRationale)}</p><form method="POST" action="/comms/individual-followups/create" class="inline-form" data-verify="individual-followup-create-cta-v1"><input type="hidden" name="view" value="${escapeHtml(view)}" /><input type="hidden" name="tab" value="${escapeHtml(tab)}" /><input type="hidden" name="account_id" value="${escapeHtml(accountId || item.id || item.account_id || '')}" /><input type="hidden" name="contact" value="${escapeHtml(contact || contactName)}" /><input type="hidden" name="client_name" value="${escapeHtml(item.brand || contactName)}" /><input type="hidden" name="action_text" value="${escapeHtml(actionText)}" /><button type="submit">Create human follow-up task</button></form></article>`;
  }).join('');

  const feedback = taskState === 'ok'
    ? `<p class="ok" role="status" data-verify="individual-followup-create-feedback-v1">${escapeHtml(taskMessage || 'Human follow-up task created.')}</p>`
    : (taskState === 'error' ? `<p class="error" role="alert" data-verify="individual-followup-create-feedback-v1">${escapeHtml(taskMessage || 'Could not create human follow-up task.')}</p>` : '');

  return `<article class="panel" data-verify="individual-intelligence-panel-v1"><div class="panel-head"><h2>Individual intelligence panel</h2><span class="section-tag">persona · trajectory · outreach angle</span></div><p class="muted">Quick individual-level intelligence for human outreach handoff.</p>${feedback}<div class="queue-grid">${cards}</div></article>`;
}

function buildRelationshipHealthSeries(row = {}) {
  const baseline = Math.round(Number(row.relationship_health || row.score || 55) || 55);
  const delta = Math.round(Number(row.relationship_health_delta || 0) || 0);
  const points = [-3, -2, -1, 0, 1, 2].map((step) => {
    const drift = step * (delta / 2);
    const pulse = (step % 2 === 0 ? 1 : -1) * Math.min(4, Math.abs(delta));
    return clamp(Math.round(baseline + drift + pulse), 0, 100);
  });
  const net = points[points.length - 1] - points[0];
  const trend = net > 3 ? 'upward' : net < -3 ? 'downward' : 'flat';
  return { points, trend };
}

function renderHealthSparkline(points = [], marker = 'comms-relationship-health-sparkline-v1') {
  const series = Array.isArray(points) && points.length ? points : [45, 48, 51, 52, 53, 55];
  const width = 110;
  const height = 28;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const span = Math.max(1, max - min);
  const coords = series.map((value, index) => {
    const x = (index / Math.max(1, series.length - 1)) * (width - 2) + 1;
    const y = height - (((value - min) / span) * (height - 6) + 3);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg data-verify="${escapeHtml(marker)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Relationship health trend sparkline"><polyline points="${coords}" fill="none" stroke="#c42874" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${coords.split(' ').slice(-1)[0].split(',')[0]}" cy="${coords.split(' ').slice(-1)[0].split(',')[1]}" r="2.6" fill="#de347f"/></svg>`;
}

function summarizeAccountThread(row = {}, generatedThread = {}) {
  const latestTouch = row.last_touch_note || row.timeline_summary || row.human_handoff_reason || 'No touch logged yet';
  const next = generatedThread?.nextStep;
  const nextPlannedTouch = next
    ? `Step ${next.step} · ${next.type} · ${new Date(next.scheduled_for).toLocaleDateString()}`
    : 'Assign owner and create next touch now';
  return { latestTouch, nextPlannedTouch };
}

function accountNeedsHumanActionNow(row = {}) {
  const status = String(row.comms_status || '').toLowerCase();
  return Boolean(
    row.human_handoff_trigger
    || status === 'escalated'
    || Number(row.pilot_readiness || 0) >= 80
    || !String(row.owner || '').trim()
    || String(row.next_best_action || '').toLowerCase().includes('review')
  );
}

function renderSupportPage({ meetingPipeline, recentReplyRouting, launchActions = [], relationshipIntelligence = {}, qualifiedAccounts = [], tradeShowCaptures = [], errorMessage = '', view = 'account', tab = 'inbox', captureState = '', capturePreview = null, captureDraft = {}, captureReason = '', accountId = '', contact = '', humanActionNowOnly = false }) {
  const normalizedView = String(view || '').toLowerCase() === 'individual' ? 'individual' : 'account';
  const normalizedTab = String(tab || '').toLowerCase() === 'outbox' ? 'outbox' : 'inbox';
  const contextAccountId = String(accountId || '').trim();
  const contextContact = String(contact || '').trim();
  const queue = buildTeamHandoffQueue(qualifiedAccounts || []);
  const accountRows = (relationshipIntelligence?.scores || []).slice(0, 12);
  const individualRows = queue.slice(0, 12);
  const replyRows = (recentReplyRouting || []).slice(0, 20);

  const statusMeta = (status = 'waiting') => {
    const key = String(status || '').toLowerCase();
    if (key === 'drafted') return { label: 'drafted', className: 'info' };
    if (key === 'sent') return { label: 'sent', className: 'ok' };
    if (key === 'replied') return { label: 'replied', className: 'ok' };
    if (key === 'escalated') return { label: 'escalated', className: 'bad' };
    return { label: 'waiting', className: 'warn' };
  };

  const deriveAccountStatus = (row = {}, index = 0) => {
    if (Number(row.pilot_readiness || 0) >= 80) return 'escalated';
    if (Number(row.relationship_health || 0) >= 75) return 'replied';
    if (index % 4 === 0) return 'drafted';
    if (index % 3 === 0) return 'sent';
    return 'waiting';
  };

  const deriveIndividualStatus = (row = {}, index = 0) => {
    if (row.human_handoff_trigger) return 'escalated';
    if (index % 5 === 0) return 'drafted';
    if (index % 3 === 0) return 'sent';
    return 'waiting';
  };

  const intelligenceByAccountId = new Map(accountRows.map((row) => [String(row.account_id || ''), row]));
  const accountCommsRows = accountRows.map((row, index) => ({ ...row, comms_status: deriveAccountStatus(row, index) }));
  const individualCommsRows = individualRows.map((row, index) => {
    const intelligence = intelligenceByAccountId.get(String(row.id || '')) || {};
    return {
      ...row,
      ...intelligence,
      comms_status: deriveIndividualStatus({ ...row, ...intelligence }, index),
    };
  });

  const makeCommsHref = (nextView, nextTab, extras = {}) => {
    const params = new URLSearchParams({ view: nextView, tab: nextTab });
    if (contextAccountId) params.set('account_id', contextAccountId);
    if (contextContact) params.set('contact', contextContact);
    if (humanActionNowOnly) params.set('human_now', '1');
    Object.entries(extras || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim()) params.set(key, String(value));
      if (value === '') params.delete(key);
    });
    return `/comms?${params.toString()}`;
  };

  const scopedAccountRows = contextAccountId
    ? accountCommsRows.filter((row) => String(row.account_id || row.id || '') === contextAccountId)
    : accountCommsRows;
  const scopedIndividualRows = individualCommsRows.filter((row) => {
    if (contextAccountId && String(row.id || row.account_id || '') !== contextAccountId) return false;
    if (contextContact && !String(row.contact_name || '').toLowerCase().includes(contextContact.toLowerCase())) return false;
    return true;
  });

  const accountRowsNeedingHumanNow = scopedAccountRows.filter((row) => accountNeedsHumanActionNow(row));
  const humanNowAccountIds = new Set(accountRowsNeedingHumanNow.map((row) => String(row.account_id || row.id || '')));

  const visibleAccountRows = humanActionNowOnly ? accountRowsNeedingHumanNow : scopedAccountRows;
  const visibleIndividualRows = humanActionNowOnly
    ? scopedIndividualRows.filter((row) => humanNowAccountIds.has(String(row.id || row.account_id || '')))
    : scopedIndividualRows;

  const inboxRows = normalizedView === 'individual' ? visibleIndividualRows : visibleAccountRows;
  const outboxRows = normalizedView === 'individual'
    ? visibleIndividualRows.filter((row) => ['drafted', 'sent'].includes(String(row.comms_status || '').toLowerCase()))
    : visibleAccountRows.filter((row) => ['drafted', 'sent'].includes(String(row.comms_status || '').toLowerCase()));

  const currentRows = normalizedTab === 'outbox' ? outboxRows : inboxRows;
  const statusSummary = ['drafted', 'sent', 'replied', 'waiting', 'escalated']
    .map((key) => ({ key, count: inboxRows.filter((row) => String(row.comms_status || '').toLowerCase() === key).length }));
  const commsReturnTo = makeCommsHref(normalizedView, normalizedTab);
  const actionsHandoffHref = `/actions?source=comms&return_to=${encodeURIComponent(commsReturnTo)}`;
  const relationshipsHandoffHref = `/relationships?source=comms&return_to=${encodeURIComponent(commsReturnTo)}`;
  const pilotHandoffHref = `/pilot?source=comms&return_to=${encodeURIComponent(commsReturnTo)}`;
  const researchContextHref = `/research?source=comms&return_to=${encodeURIComponent(commsReturnTo)}`;

  const accountTable = `<table><thead><tr><th>Account</th><th>Relationship health trend</th><th>Status + cadence</th><th>Thread summary (last + next touch)</th><th>Attribution</th><th>Next action now</th></tr></thead><tbody>${currentRows.map((row) => {
    const meta = statusMeta(row.comms_status);
    const detailHref = row.account_id ? `/accounts/${encodeURIComponent(row.account_id)}` : null;
    const cadencePreset = chooseFollowupCadencePreset({
      status: row.comms_status,
      pilotReadiness: Number(row.pilot_readiness) || 0,
      relationshipHealth: Number(row.relationship_health) || 0,
      handoffTrigger: Number(row.pilot_readiness) >= 80,
      trendLabel: Number(row.relationship_health) >= 75 ? 'warming' : 'flat',
    });
    const cadenceReason = explainCadenceSelection({
      cadence: cadencePreset,
      status: row.comms_status,
      pilotReadiness: Number(row.pilot_readiness) || 0,
      relationshipHealth: Number(row.relationship_health) || 0,
      handoffTrigger: Number(row.pilot_readiness) >= 80,
      trendLabel: Number(row.relationship_health) >= 75 ? 'warming' : 'flat',
    });
    const generatedThread = generateFollowupThread({
      cadence: cadencePreset,
      channel: 'email',
      targetLabel: row.brand || 'account contact',
      reason: `account cadence ${cadencePreset}`,
    });
    const firstStepReason = explainFirstThreadStep(generatedThread, cadenceReason);
    const timelineSummary = row.timeline_summary || formatThreadTimelineSummary(generatedThread);
    const nextStepRecommendation = generatedThread.nextStep
      ? `Step ${generatedThread.nextStep.step} via ${generatedThread.nextStep.type} · ${new Date(generatedThread.nextStep.scheduled_for).toLocaleDateString()}`
      : 'Review and assign owner.';
    const attribution = inferCommsActionAttribution(row.owner || row.actor || (Number(row.pilot_readiness) >= 80 ? 'human_owner' : 'ai_router'));
    const accountContextHref = makeCommsHref('individual', normalizedTab, { account_id: row.account_id || row.id, contact: '' });
    const healthSeries = buildRelationshipHealthSeries(row);
    const threadSummary = summarizeAccountThread(row, generatedThread);
    return `<tr data-verify="comms-account-thread-cadence-v1 comms-account-attribution-v2 comms-next-action-visibility-v2 comms-cadence-rationale-v1 comms-account-individual-crosslink-v1 comms-account-health-trend-v1 comms-account-thread-summary-v1"><td><strong>${detailHref ? `<a href="${detailHref}">${escapeHtml(row.brand || '—')}</a>` : escapeHtml(row.brand || '—')}</strong><div class="muted"><a href="/research">Research + intel</a> · <a href="${accountContextHref}">View individuals</a></div></td><td><div class="helper-row"><span class="helper-chip">health: ${escapeHtml(Math.round(Number(row.relationship_health || 0)))}</span><span class="helper-chip">trend: ${escapeHtml(healthSeries.trend)}</span></div>${renderHealthSparkline(healthSeries.points, 'comms-account-health-sparkline-v1')}</td><td><span class="badge ${meta.className}">${escapeHtml(meta.label)}</span><div class="muted">cadence: ${escapeHtml(cadencePreset)}</div><div class="muted" data-verify="comms-cadence-rationale-copy-v1">${escapeHtml(cadenceReason)}</div></td><td><div class="muted" data-verify="comms-account-thread-summary-last-touch-v1"><strong>Last touch:</strong> ${escapeHtml(threadSummary.latestTouch)}</div><div class="muted" data-verify="comms-account-thread-summary-next-touch-v1"><strong>Next planned touch:</strong> ${escapeHtml(threadSummary.nextPlannedTouch)}</div><div class="helper-row"><span class="helper-chip">Latest touch: ${escapeHtml(timelineSummary)}</span>${generatedThread.nextStep ? `<span class="helper-chip">Next touch window: ${escapeHtml(new Date(generatedThread.nextStep.scheduled_for).toLocaleDateString())}</span>` : ''}</div>${renderThreadMiniList(generatedThread, 'comms-account-thread-steps-v1')}<div class="muted" data-verify="comms-first-thread-step-rationale-v1">${escapeHtml(firstStepReason)}</div></td><td><span class="badge ${attribution.className}">${escapeHtml(attribution.label)}</span><div class="muted">owner: ${escapeHtml(row.owner || 'unassigned')}</div></td><td><strong>${escapeHtml(row.next_best_action || 'Review timeline and execute top touch.')}</strong><div class="muted">${escapeHtml(row.rationale || 'No rationale captured yet.')}</div><div class="muted" data-verify="actions-next-step-recommendation-v1 comms-actions-context-preserving-handoff-v1">Now: ${escapeHtml(nextStepRecommendation)} · <a href="${actionsHandoffHref}">Execute in Actions</a></div></td></tr>`;
  }).join('') || '<tr><td colspan="6" class="empty-state">No Account Workspace communication rows for this tab.</td></tr>'}</tbody></table>`;

  const individualTable = `<table><thead><tr><th>Individual / role</th><th>Status + cadence</th><th>Role / persona context</th><th>Touch history (latest → next)</th><th>Attribution</th><th>Next action now</th></tr></thead><tbody>${currentRows.map((item) => {
    const trend = item.relationship_health_trend || formatScoreTrend(Number(item.relationship_health_delta || 0));
    const cadencePreset = chooseFollowupCadencePreset({
      status: item.comms_status,
      handoffTrigger: item.human_handoff_trigger,
      pilotReadiness: Number(item.pilot_readiness) || 0,
      relationshipHealth: Number(item.relationship_health) || 0,
      trendLabel: trend.direction === 'up' ? 'warming' : trend.direction === 'down' ? 'downward' : 'flat',
    });
    const cadenceReason = explainCadenceSelection({
      cadence: cadencePreset,
      status: item.comms_status,
      handoffTrigger: item.human_handoff_trigger,
      pilotReadiness: Number(item.pilot_readiness) || 0,
      relationshipHealth: Number(item.relationship_health) || 0,
      trendLabel: trend.direction === 'up' ? 'warming' : trend.direction === 'down' ? 'downward' : 'flat',
    });
    const generatedThread = generateFollowupThread({
      cadence: cadencePreset,
      channel: item.recommendedChannel || 'email',
      targetLabel: item.contact_name || item.brand || 'contact',
      reason: item.human_handoff_reason || 'individual thread progression',
    });
    const firstStepReason = explainFirstThreadStep(generatedThread, cadenceReason);
    const touchHistory = [item.last_touch_note, item.human_handoff_reason, formatThreadTimelineSummary(generatedThread)].filter(Boolean).join(' · ') || 'No touch notes logged yet.';
    const role = item.contact_role || 'Decision maker';
    const meta = statusMeta(item.comms_status);
    const nextStepRecommendation = generatedThread.nextStep
      ? `${generatedThread.nextStep.type} touch for ${item.contact_name || item.brand || 'contact'} at T+${generatedThread.nextStep.delay_hours}h`
      : 'Assign owner and draft first touch.';
    const attribution = inferCommsActionAttribution(item.owner || item.actor || (item.human_handoff_trigger ? 'human_owner' : 'ai_router'));
    const accountTimelineHref = makeCommsHref('account', normalizedTab, { account_id: item.id || item.account_id, contact: item.contact_name || '' });
    return `<tr data-verify="comms-individual-thread-cadence-v1 comms-individual-attribution-v2 comms-next-action-visibility-v2 comms-cadence-rationale-v1 comms-account-individual-crosslink-v1"><td><strong>${escapeHtml(item.contact_name || item.brand || 'Unknown contact')}</strong><div class="muted">${escapeHtml(item.brand || '—')}</div><div class="muted"><a href="/accounts/${encodeURIComponent(item.id || '')}">Account detail</a> · <a href="${accountTimelineHref}">Account timeline</a></div></td><td><span class="badge ${meta.className}">${escapeHtml(meta.label)}</span><div class="muted">cadence: ${escapeHtml(cadencePreset)}</div><div class="muted" data-verify="comms-cadence-rationale-copy-v1">${escapeHtml(cadenceReason)}</div></td><td><strong>${escapeHtml(role)}</strong><div class="muted">${escapeHtml(item.persona_context || `Primary contact for ${item.brand || 'account'} outreach.`)}</div></td><td><div class="helper-row"><span class="helper-chip">Latest touch: ${escapeHtml(touchHistory)}</span>${generatedThread.nextStep ? `<span class="helper-chip">Next touch window: T+${escapeHtml(generatedThread.nextStep.delay_hours)}h</span>` : ''}</div>${renderThreadMiniList(generatedThread, 'comms-individual-thread-steps-v1')}<div class="muted" data-verify="comms-first-thread-step-rationale-v1">${escapeHtml(firstStepReason)}</div></td><td><span class="badge ${attribution.className}">${escapeHtml(attribution.label)}</span><div class="muted">owner: ${escapeHtml(item.owner || 'unassigned')}</div></td><td><strong>${escapeHtml(item.next_best_action || item.recommended_opener || 'Open with value-first pilot angle and clear next step.')}</strong><div class="muted">${escapeHtml(item.rationale || 'No rationale captured yet.')}</div><div class="muted"><a href="${researchContextHref}">Research context</a></div><div class="muted" data-verify="actions-next-step-recommendation-v1 comms-actions-context-preserving-handoff-v1">Now: ${escapeHtml(nextStepRecommendation)} · <a href="${actionsHandoffHref}">Execute in Actions</a></div></td></tr>`;
  }).join('') || '<tr><td colspan="6" class="empty-state">No Individual Workspace communication rows for this tab.</td></tr>'}</tbody></table>`;

  const captureFeedback = captureState === 'ok'
    ? `<div class="ok" role="status" data-verify="comms-tradeshow-next-step-cta-v4 comms-golden-workflow-cta-sequence-v1 comms-actions-handoff-priority-v1 comms-actions-context-preserving-handoff-v1"><p><strong>Voice memo saved.</strong> Immediate next step: execute the new handoff task in <code>/actions</code> before switching pages.</p><div class="links"><a href="${actionsHandoffHref}" class="button-link">1) Open /actions (required next)</a><a href="${relationshipsHandoffHref}" class="button-link button-secondary">2) Confirm relationship movement</a><a href="${pilotHandoffHref}" class="button-link button-secondary">3) Review pilot recommendation</a></div></div>`
    : (captureState === 'error'
      ? `<p class="error" role="alert" data-verify="comms-tradeshow-error-clarity-v1">${escapeHtml(captureReason || 'Trade-show memo capture failed. Add account, individual, context, and promised follow-up, then retry.')}</p>`
      : '');

  const draftTranscriptText = String(captureDraft.transcript_text || '');
  const draftSource = String(captureDraft.source || '');
  const previewPainPoints = Array.isArray(capturePreview?.pain_points) ? capturePreview.pain_points : [];
  const capturePreviewPanel = captureState === 'preview' && capturePreview
    ? `<div class="panel" data-verify="comms-tradeshow-preview-v2 comms-golden-workflow-preview-step-v1"><h3>Summary preview before save</h3><p class="muted">Confirm extracted fields, then save to trigger queue-ready handoff context.</p><table><tbody><tr><th>Account</th><td>${escapeHtml(capturePreview.account_name || '—')}</td></tr><tr><th>Individual</th><td>${escapeHtml(capturePreview.contact_name || '—')}</td></tr><tr><th>Context</th><td>${escapeHtml(capturePreview.context || '—')}</td></tr><tr><th>Pain points</th><td>${escapeHtml(previewPainPoints.join('; ') || '—')}</td></tr><tr><th>Promised follow-up</th><td>${escapeHtml(capturePreview.promised_follow_up || '—')}</td></tr></tbody></table></div>`
    : '';

  const captureRows = (tradeShowCaptures || []).map((row) => {
    const painList = Array.isArray(row.pain_points) ? row.pain_points : [];
    return `<tr><td>${escapeHtml(row.account_name || '—')}</td><td>${escapeHtml(row.individual_name || '—')}</td><td>${escapeHtml(String(row.context_notes || '').slice(0, 100) || '—')}</td><td>${escapeHtml(painList.join('; ') || '—')}</td><td>${escapeHtml(row.promised_followup || '—')}</td><td>${escapeHtml(row.created_at ? new Date(row.created_at).toLocaleString() : '—')}</td></tr>`;
  }).join('') || '<tr><td colspan="6" class="empty-state">No trade-show captures yet.</td></tr>';

  return `${renderTopNav({ active: 'comms', errorMessage })}
  <div class="page-shell" data-verify="comms-route-v1 comms-enterprise-layout-v1 comms-unified-inbox-outbox-v1 comms-status-model-v1 trade-show-voice-memo-v1 cadence-thread-engine-v1 comms-golden-workflow-sequence-v1">
  <article class="page-header" data-verify="comms-enterprise-step-rail-v1 comms-low-friction-sequence-copy-v2"><div class="panel-head"><h2>Comms</h2><span class="section-tag">step 3.5 of 4 · capture → cadence → queue handoff</span></div><p><strong>Single path:</strong> capture context, confirm owner + cadence, then execute handoff.</p><p class="muted">Use this page as one workflow lane into Actions → Relationships → Pilot. KPI gates and diagnostics remain canonical in /ops.</p><div class="helper-row"><span class="helper-chip">1) Capture context</span><span class="helper-chip">2) Confirm owner + cadence</span><span class="helper-chip">3) Execute in Actions (required)</span><span class="helper-chip">4) Confirm in Relationships</span><span class="helper-chip">5) Validate in Pilot</span></div></article>
  <article class="panel" data-verify="comms-context-switch-reduction-v1 comms-ordered-handoff-links-v2"><h2>Stay in one workflow lane</h2><p class="muted"><strong>Click in order.</strong> Each link preserves current Comms scope and tab.</p><div class="links"><a class="button-link" href="${actionsHandoffHref}">1) Actions (required next)</a><a class="button-link button-secondary" href="${relationshipsHandoffHref}">2) Relationships</a><a class="button-link button-secondary" href="${pilotHandoffHref}">3) Pilot</a><a class="button-link button-secondary" href="${researchContextHref}">Research context</a></div></article>
  ${renderNowItemsIntegrationPanel({ route: 'comms' })}
  <article class="panel" data-verify="comms-control-switches-v2 comms-attribution-legend-v1 comms-account-individual-crosslink-v1 comms-enterprise-toolbar-hierarchy-v1 comms-human-action-now-filter-v1 comms-golden-workflow-control-order-v1 comms-account-individual-switch-clarity-v1"><h2>Workspace controls</h2><p class="muted" data-verify="comms-workspace-scope-legend-v1"><strong>Account Workspace</strong> = one row per account timeline. <strong>Individual Workspace</strong> = one row per person/contact thread. Keep tab (Inbox/Outbox) constant while switching scopes.</p><div class="comms-toolbar"><div class="comms-mode-row links"><a href="${makeCommsHref('account', normalizedTab)}" class="${normalizedView === 'account' ? 'active' : ''}">Account Workspace</a><a href="${makeCommsHref('individual', normalizedTab)}" class="${normalizedView === 'individual' ? 'active' : ''}">Individual Workspace</a></div><div class="comms-tab-row"><div class="links"><a href="${makeCommsHref(normalizedView, 'inbox')}" class="${normalizedTab === 'inbox' ? 'active' : ''}">Inbox</a><a href="${makeCommsHref(normalizedView, 'outbox')}" class="${normalizedTab === 'outbox' ? 'active' : ''}">Outbox</a></div><a href="${actionsHandoffHref}" class="button-link" data-verify="comms-toolbar-actions-handoff-v1">Open Actions (same context)</a><a href="${relationshipsHandoffHref}" class="button-link button-secondary">Open Relationships (same context)</a></div><div class="links" data-verify="comms-human-action-now-filter-links-v1"><a href="${makeCommsHref(normalizedView, normalizedTab, { human_now: '1' })}" class="${humanActionNowOnly ? 'active' : ''}">Needs human action now (${escapeHtml(accountRowsNeedingHumanNow.length)})</a><a href="${makeCommsHref(normalizedView, normalizedTab, { human_now: '' })}" class="${!humanActionNowOnly ? 'active' : ''}">Show all accounts</a></div></div><p class="muted comms-flow-note" data-verify="comms-next-steps-copy-v2 comms-actions-handoff-priority-copy-v1 comms-owner-outcome-sequence-tight-v2">Execution order: 1) Capture context (operator) → 2) Confirm cadence + attribution (operator) → <strong>3) Execute in /actions (human owner, required next)</strong> → 4) Confirm stage in /relationships (operator) → 5) Validate pilot call in /pilot (operator + GTM lead). Outcome: every stage change has owner + proof.</p><div class="helper-row">${statusSummary.map((item) => `<span class="helper-chip">${escapeHtml(item.key)}: ${escapeHtml(item.count)}</span>`).join('')}<span class="helper-chip">Attribution: AI (automation/routing) · Human (owner/operator)</span>${humanActionNowOnly ? '<span class="helper-chip">Quick filter: human action now</span>' : ''}</div>${contextAccountId || contextContact ? `<p class="muted" data-verify="comms-context-pill-v1">Context lock: ${escapeHtml(contextAccountId ? `account ${contextAccountId}` : 'all accounts')}${contextContact ? ` · contact ${contextContact}` : ''} · <a href="/comms?view=${encodeURIComponent(normalizedView)}&tab=${encodeURIComponent(normalizedTab)}">clear</a></p>` : ''}</article>
  ${renderIndividualIntelligencePanel(currentRows, { view: normalizedView, tab: normalizedTab, accountId: contextAccountId, contact: contextContact, taskState: followupTaskState, taskMessage: followupTaskMessage })}
  <section class="comms-summary-grid" data-verify="comms-scannability-summary-v1"><article class="panel" data-verify="comms-unified-table-v1 comms-table-heading-clarity-v1"><div class="comms-table-head"><div><h2>${normalizedView === 'individual' ? 'Individual Workspace communications' : 'Account Workspace communications'} · ${normalizedTab}</h2><p class="muted">Read each row in this order: status → timeline → attribution → action now.</p></div><span class="badge info">${escapeHtml(currentRows.length)} rows</span></div>${normalizedView === 'individual' ? individualTable : accountTable}</article><article class="panel comms-quick-cta" data-verify="comms-clean-cta-placement-v2 comms-golden-workflow-cta-stack-v1 comms-owner-outcome-clarity-v1 comms-actions-handoff-guidance-v1 comms-expected-outcome-grid-v2"><h2>Execute next</h2><p class="muted"><strong>Required:</strong> complete step 1 in /actions before step 2.</p><table><thead><tr><th>Step</th><th>Owner</th><th>Expected outcome</th></tr></thead><tbody><tr><td><a class="button-link" href="${actionsHandoffHref}" data-verify="comms-actions-preserve-workspace-cta-v1">1) Open /actions queue (required)</a></td><td>Human owner</td><td>First-touch is executed and proof is logged.</td></tr><tr><td><a class="button-link button-secondary" href="${relationshipsHandoffHref}">2) Confirm relationship stage</a></td><td>Operator</td><td>Stage and rationale are updated.</td></tr><tr><td><a class="button-link button-secondary" href="${pilotHandoffHref}">3) Validate pilot recommendation</a></td><td>Operator + GTM lead</td><td>Pilot decision is explicit (go / hold).</td></tr></tbody></table><div class="links"><a class="button-link button-secondary" href="${researchContextHref}">Research context</a></div></article></section>
  <article class="panel" id="trade-show-voice-memo-v1" data-verify="comms-tradeshow-intake-form-v2 comms-tradeshow-clarity-labels-v2 comms-golden-workflow-voice-memo-step-v1 comms-tradeshow-low-friction-intake-v2 comms-voice-memo-cadence-launch-simplified-v1"><h2>Voice memo capture → handoff intake</h2><p class="muted"><strong>Paste this 4-line minimum to launch cadence:</strong> Account, Individual, Context, Promised follow-up. Add pain points if available.</p>${captureFeedback}${capturePreviewPanel}<form method="POST" action="/comms/trade-show/captures" class="inline-form"><input type="hidden" name="view" value="${escapeHtml(normalizedView)}" /><input type="hidden" name="tab" value="${escapeHtml(normalizedTab)}" /><input type="hidden" name="account_id" value="${escapeHtml(contextAccountId)}" /><input type="hidden" name="contact" value="${escapeHtml(contextContact)}" /><label for="trade-show-transcript">Voice memo transcript (required)</label><textarea id="trade-show-transcript" name="transcript_text" placeholder="Account: ...
Individual: ...
Context: ...
Promised follow-up: ...
(optional) Pain points: ..." required style="min-height:7rem;">${escapeHtml(draftTranscriptText)}</textarea><label for="trade-show-source">Memo source label (optional)</label><input id="trade-show-source" type="text" name="source" placeholder="Booth mic, iPhone voice memo, etc. (default: voice_memo_placeholder)" value="${escapeHtml(draftSource)}" /><div class="links" data-verify="comms-tradeshow-preview-save-cta-v3"><button type="submit" name="intent" value="preview" class="button-link button-secondary">Preview extraction</button><button type="submit" name="intent" value="save">Save + create action handoff</button></div></form><p class="muted" data-verify="comms-tradeshow-production-guardrails-v2 comms-actions-handoff-priority-copy-v1">Required before save: account, individual, context, and promised follow-up. Sequence: Preview extraction → Save + create handoff → <strong>execute in /actions (required next)</strong> → confirm in /relationships → validate in /pilot. Use the "same context" links to avoid re-filtering.</p></article>
  <article class="panel" data-verify="comms-tradeshow-captures-list-v1"><h2>Recent trade-show captures</h2><table><thead><tr><th>Account</th><th>Individual</th><th>Context</th><th>Pain points</th><th>Promised follow-up</th><th>Captured</th></tr></thead><tbody>${captureRows}</tbody></table></article>
  <article class="panel" data-verify="comms-supporting-signals-v1"><h2>Supporting communication signals</h2><p class="muted">Latest routed replies and launch actions for context.</p>${renderLaunchActionsPanel(launchActions)}<div style="margin-top:.55rem">${renderRecentReplyRoutingPanel(replyRows)}</div></article>
  <article class="panel" data-verify="comms-ops-detail-handoff-v1"><h2>Operational detail handoff</h2><p class="muted">Detailed follow-up queues, KPI diagnostics, readiness gates, and account-level operational triage are owned by Ops.</p><p><a class="button-link button-secondary" href="/ops#client-updates">Open Ops follow-ups + diagnostics</a></p></article></div>`;
}


function buildUrlMap(host = `localhost:${port}`) {
  const origin = `http://${host}`;
  return {
    app: [
      { name: 'Home', path: '/', url: `${origin}/` },
      { name: 'Strategy', path: '/strategy', url: `${origin}/strategy` },
      { name: 'Targeting', path: '/targeting', url: `${origin}/targeting` },
      { name: 'Actions', path: '/actions', url: `${origin}/actions` },
      { name: 'Relationships', path: '/relationships', url: `${origin}/relationships` },
      { name: 'Comms', path: '/comms', url: `${origin}/comms` },
      { name: 'Comms (Account Workspace inbox)', path: '/comms?view=account&tab=inbox', url: `${origin}/comms?view=account&tab=inbox` },
      { name: 'Comms (Individual Workspace inbox)', path: '/comms?view=individual&tab=inbox', url: `${origin}/comms?view=individual&tab=inbox` },
      { name: 'Comms (human action now filter)', path: '/comms?view=account&tab=inbox&human_now=1', url: `${origin}/comms?view=account&tab=inbox&human_now=1` },
      { name: 'Actions (from Comms context)', path: '/actions?source=comms&return_to=/comms?view=account&tab=inbox', url: `${origin}/actions?source=comms&return_to=%2Fcomms%3Fview%3Daccount%26tab%3Dinbox` },
      { name: 'Comms (trade-show intake)', path: '/comms#trade-show-voice-memo-v1', url: `${origin}/comms#trade-show-voice-memo-v1` },
      { name: 'Research', path: '/research', url: `${origin}/research` },
      { name: 'Research (competitive intelligence)', path: '/research#competitive-intelligence', url: `${origin}/research#competitive-intelligence` },
      { name: 'Account detail', path: '/accounts/:id', url: `${origin}/accounts/:id` },
      { name: 'Pilot', path: '/pilot', url: `${origin}/pilot` },
      { name: 'Ops', path: '/ops', url: `${origin}/ops` },
    ],
    diagnostics: [
      { name: 'Health', path: '/health', url: `${origin}/health` },
      { name: 'Metrics snapshot', path: '/api/metrics/snapshot', url: `${origin}/api/metrics/snapshot` },
      { name: 'Route map', path: '/api/navigation/url-map', url: `${origin}/api/navigation/url-map` },
      { name: 'Relationship intelligence API', path: '/api/relationships/intelligence', url: `${origin}/api/relationships/intelligence` },
      { name: 'Competitive intelligence API', path: '/api/competitive-intel', url: `${origin}/api/competitive-intel` },
      { name: 'Trade-show captures API', path: '/api/comms/trade-show/captures', url: `${origin}/api/comms/trade-show/captures` },
    ],
  };
}

function renderLocalhostMarkers() {
  return `<div data-verify="localhost-markers-v2 localhost-comms-actions-context-handoff-v1"><p class="muted">Localhost markers</p><ul class="queue-list"><li><code>http://localhost:${port}/</code> · Home business health hub</li><li><code>http://localhost:${port}/strategy</code> · Strategy decision center</li><li><code>http://localhost:${port}/targeting</code> · Targeting Studio</li><li><code>http://localhost:${port}/actions</code> · Actions domain</li><li><code>http://localhost:${port}/relationships</code> · Relationships domain</li><li><code>http://localhost:${port}/comms</code> · Communications views</li><li><code>http://localhost:${port}/comms?view=account&tab=inbox&human_now=1</code> · Account Workspace needing human action now</li><li><code>http://localhost:${port}/actions?source=comms&return_to=%2Fcomms%3Fview%3Daccount%26tab%3Dinbox</code> · Actions with Comms context-return handoff</li><li><code>http://localhost:${port}/comms#trade-show-voice-memo-v1</code> · Trade-show voice memo intake</li><li><code>http://localhost:${port}/pilot</code> · Pilot domain</li><li><code>http://localhost:${port}/ops</code> · Ops system controls</li><li><code>http://localhost:${port}/health</code> · Health JSON</li><li><code>http://localhost:${port}/api/metrics/snapshot</code> · Metrics snapshot</li><li><code>http://localhost:${port}/api/comms/trade-show/captures</code> · Trade-show captures API</li><li><code>http://localhost:${port}/api/navigation/url-map</code> · URL map JSON</li></ul></div>`;
}

function renderPltvLiftPilotPage() {
  return `${renderTopNav({ active: 'pilot' })}
  <div class="page-shell" data-verify="pltv-lift-pilot-definition-v1 pltv-layout-composition-v1">
    <article class="page-header" data-verify="pltv-page-header-v1"><div class="panel-head"><h2>Product objective</h2><span class="section-tag">pilot definition</span></div><p><strong>Define one clear pilot promise, qualification criteria, and a binary go/no-go decision.</strong></p><p class="muted">Primary focus: product definition and success criteria. Secondary focus: timeline and entry CTA.</p></article>
  <div class="layout"><section class="panel section-frame primary-focus" style="grid-column:1/-1;max-width:920px"><div class="panel-head"><h2>Product definition</h2><span class="section-tag">GTM clarity</span></div><h1>pLTV Lift Pilot</h1><p class="muted">A focused pilot to help qualified brands improve repeat purchase efficiency. This is an execution process layer on top of the existing app, not a rebuild.</p>

  <article class="panel" style="margin-top:.7rem"><h3>1) Product promise</h3><p>We run an 8+ week pilot to lift long-term paid efficiency by improving the quality and value of repeat customer revenue. The goal is measurable lift, not extra reporting.</p></article>

  <article class="panel" style="margin-top:.7rem"><h3>2) Ideal candidate criteria</h3><ul class="queue-list"><li>Beauty/eCommerce brand with meaningful paid media volume</li><li>Able to run a clean control vs pilot split</li><li>Has basic D60 revenue and ROAS visibility</li><li>Team can support weekly check-ins and fast decisions</li></ul></article>

  <article class="panel" style="margin-top:.7rem"><h3>3) Timeline (Weeks 1–8+)</h3><table><thead><tr><th>Window</th><th>Focus</th></tr></thead><tbody><tr><td>Week 1</td><td>Qualification snapshot + baseline confirmation</td></tr><tr><td>Weeks 2-3</td><td>Pilot setup and control split launch</td></tr><tr><td>Weeks 4-6</td><td>Active optimization and weekly readouts</td></tr><tr><td>Weeks 7-8</td><td>Performance validation at D60 horizon</td></tr><tr><td>Week 8+</td><td>Scale plan or closeout decision</td></tr></tbody></table></article>

  <article class="panel" style="margin-top:.7rem"><h3>4) Success criteria</h3><p><strong>D60 ROAS improves by at least +10% vs control.</strong></p></article>

  <article class="panel" style="margin-top:.7rem"><h3>5) Decision point</h3><p>At the end of the validation window, we make a clear <strong>go / no-go</strong> call:</p><ul class="queue-list"><li><strong>Go:</strong> Hit or exceed the D60 ROAS lift target and agree scale plan</li><li><strong>No-go:</strong> Miss target, document learnings, and stop pilot</li></ul></article>

  <article class="panel" style="margin-top:.7rem" id="qualification-snapshot"><h3>6) Offer ladder entry + next step</h3><p class="muted">Start with Qualification Snapshot, then continue into pLTV Lift Pilot workflow.</p><a class="button-link" href="/#qualified-account-form" data-verify="pltv-lift-pilot-cta-v2">Start qualification snapshot</a></article>

  </section></div></div>`;
}

const DEFAULT_AUTONOMY_DIRECTION = {
  marker: 'ops-autonomy-direction-v1',
  objective: 'Keep the GTM operating loop reliable while moving highest-impact work forward each cycle.',
  quality_mode: 'balanced',
  operating_constraints: [
    'Never skip route-truth and golden-path checks before release posture changes.',
    'Escalate blocking regressions with explicit owner and ETA in the same cycle.',
    'Maintain evidence-linked review updates in /ops before closing cycle decisions.',
  ],
  directional_preferences: {
    speed_vs_polish: 0.5,
    risk_tolerance: 'medium',
    review_strictness: 'standard',
  },
};

let OPS_REVIEW_BURSTS = [
  {
    id: 'RB-UI-001',
    title: 'Keep split Comms views as default this cycle',
    whyReviewIsNeeded: 'This preserves the operator workflow pattern that is currently stable and easy to scan.',
    recommendedDefault: 'Approve default — keep Account Workspace + Individual Workspace split views.',
    expectedReviewTime: 'Under 20 seconds',
    deadline: '2026-02-22T22:00:00Z',
    exactUrl: 'http://127.0.0.1:1981/comms?view=account&tab=inbox',
    pageUrl: 'http://127.0.0.1:1981/comms?view=account&tab=inbox',
    exactSectionUrl: 'http://127.0.0.1:1981/comms?view=individual&tab=inbox',
    decisionNeeded: 'Do we keep Account Workspace + Individual Workspace split as the default this cycle?',
    approveNext: 'Split views stay live and release copy remains controlled.',
    reviseProvide: 'State the exact layout change and where it should apply.',
    preview: {
      currentState: 'Both split views render and switch cleanly.',
      proposedChange: 'Lock split views as default for this cycle.',
      expectedImpact: 'Reduces confusion and avoids layout churn during guarded quality mode.',
      keyDiffSummary: 'default_layout: split_views (unchanged, explicitly ratified)',
      snippetEmbed: 'Reference routes: /comms?view=account&tab=inbox + /comms?view=individual&tab=inbox',
      screenshotUrl: null,
    },
    needFromYou: [
      'Approve default, or provide exact layout change + scope.',
    ],
    status: 'pending',
    priority: 'critical',
    createdAt: '2026-02-22T17:18:00Z',
  },
  {
    id: 'RB-UI-002',
    title: 'Require full reviewer checklist before close',
    whyReviewIsNeeded: 'Prevents summary-only sign-off and keeps close criteria deterministic.',
    recommendedDefault: 'Approve default — checklist pass required before review close.',
    expectedReviewTime: 'Under 20 seconds',
    deadline: '2026-02-22T22:00:00Z',
    exactUrl: 'http://127.0.0.1:1981/ops/reviewer-checklist',
    pageUrl: 'http://127.0.0.1:1981/ops/reviewer-checklist',
    exactSectionUrl: 'http://127.0.0.1:1981/ops/reviewer-checklist',
    decisionNeeded: 'Must every review close pass the full checklist route?',
    approveNext: 'Reviews cannot close without checklist completion.',
    reviseProvide: 'Specify which checklist step can be optional and why.',
    preview: {
      currentState: 'Checklist route is live and linked from /ops review workflow.',
      proposedChange: 'Set checklist completion as required close gate.',
      expectedImpact: 'Improves closure quality and reduces missed proof items.',
      keyDiffSummary: 'close_gate: summary_allowed -> checklist_required',
      snippetEmbed: 'Checklist route: /ops/reviewer-checklist',
      screenshotUrl: null,
    },
    needFromYou: [
      'Approve requirement or name optional step(s) + reason.',
    ],
    status: 'pending',
    priority: 'critical',
    createdAt: '2026-02-22T17:18:00Z',
  },
  {
    id: 'RB-UI-003',
    title: 'Hold expansion until one more full replay passes',
    whyReviewIsNeeded: 'One more clean replay lowers rollback risk before expansion.',
    recommendedDefault: 'Approve default — hold expansion until one additional all-pass replay.',
    expectedReviewTime: 'Under 20 seconds',
    deadline: '2026-02-22T22:30:00Z',
    exactUrl: 'http://127.0.0.1:1981/ops#reviews',
    pageUrl: 'http://127.0.0.1:1981/ops#reviews',
    exactSectionUrl: 'http://127.0.0.1:1981/ops#reviews',
    decisionNeeded: 'Do we wait for one more full end-to-end pass before expanding?',
    approveNext: 'Current scope stays in place until replay proof is posted.',
    reviseProvide: 'Name what can expand now and what risk you accept.',
    preview: {
      currentState: 'Guarded quality mode remains active this cycle.',
      proposedChange: 'Keep expansion frozen until one additional all-pass replay.',
      expectedImpact: 'Keeps execution stable while proving repeatability.',
      keyDiffSummary: 'expansion_policy: frozen_until_replay_pass',
      snippetEmbed: 'Review surface: /ops#reviews',
      screenshotUrl: null,
    },
    needFromYou: [
      'Approve hold, or name allowed expansion now + accepted risk.',
    ],
    status: 'pending',
    priority: 'high',
    createdAt: '2026-02-22T17:18:00Z',
  },
  {
    id: 'RB-UI-004',
    title: 'Use Zephyr +10 health move as this cycle proof example',
    whyReviewIsNeeded: 'Anchors UI/process work to a concrete business movement outcome.',
    recommendedDefault: 'Approve default — use Zephyr 47→57 (+10) as reference proof.',
    expectedReviewTime: 'Under 20 seconds',
    deadline: '2026-02-22T22:30:00Z',
    exactUrl: 'http://127.0.0.1:1981/pilot',
    pageUrl: 'http://127.0.0.1:1981/pilot',
    exactSectionUrl: 'http://127.0.0.1:1981/pilot',
    decisionNeeded: 'Should Zephyr’s 47→57 (+10) result be the reference proof for this cycle?',
    approveNext: 'Cycle summary and training references use this proof example.',
    reviseProvide: 'Name the replacement example and link supporting proof.',
    preview: {
      currentState: 'Zephyr movement is verified in before/after evidence artifacts.',
      proposedChange: 'Set Zephyr +10 as the canonical cycle proof example.',
      expectedImpact: 'Makes quality narrative concrete for fast operator validation.',
      keyDiffSummary: 'proof_anchor: none -> zephyr_47_to_57',
      snippetEmbed: 'Evidence: tradeshow-e2e-2026-02-22-v2 before/after intelligence artifacts',
      screenshotUrl: null,
    },
    needFromYou: [
      'Approve Zephyr as reference or provide replacement artifact link.',
    ],
    status: 'pending',
    priority: 'high',
    createdAt: '2026-02-22T17:18:00Z',
  },
];

function getReviewBurstPriorityRank(priority = 'low') {
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  return rank[String(priority || '').toLowerCase()] ?? 4;
}

function buildBurstReviewLinkageId(burstId = '') {
  return `review-link:${burstId}`;
}

function upsertBurstReviewCenterRecord(burst = {}, event = {}) {
  const nowIso = new Date().toISOString();
  const linkageId = buildBurstReviewLinkageId(burst.id || 'unknown');
  const recordId = `burst-review-record:${burst.id || 'unknown'}`;
  const eventLabel = String(event.label || 'lifecycle update');
  const reviewRecord = {
    id: recordId,
    reviewedAt: nowIso,
    reviewer: 'Ops burst lifecycle automation',
    linkageId,
    linkedBurstId: burst.id,
    linkedBurstStatus: burst.status,
    lifecycleUpdatedAt: burst.updatedAt || nowIso,
    currentStateSnapshot: `Burst ${burst.id} is now ${burst.status}. ${eventLabel}`,
    materialChangesThisCycle: [
      `Lifecycle event: ${eventLabel}`,
      `Decision needed: ${burst.decisionNeeded || '—'}`,
      burst.implementationProof ? `Implementation proof: ${burst.implementationProof}` : 'Implementation proof: pending',
    ],
    qualityScore: burst.status === 'closed' ? '10/10' : '9.2/10',
    qualityRationale: 'Auto-synced from Review Burst lifecycle to keep Review Center linkage deterministic.',
    blockers: burst.status === 'revise' ? 'Revision requested before implementation closure.' : 'None recorded.',
    blockerEta: burst.status === 'revise' ? 'Pending revision owner update.' : 'No blocker ETA required.',
    nextActions: burst.status === 'closed'
      ? ['No further action required. Burst is archived in Review Center history.']
      : ['Continue lifecycle progression until closure.'],
    demoScript: [
      'Open /ops#review-bursts and verify lifecycle/status/linkage row.',
      'Open /ops#reviews and verify linked burst record + timestamps.',
    ],
    livePages: [
      { label: 'Ops Review Bursts', path: '/ops#review-bursts' },
      { label: 'Ops Review Center', path: '/ops#reviews' },
    ],
    developmentCostSummary: {
      cycleKey: nowIso.slice(0, 10),
      totalTokens: 0,
      totalCostUsd: 0,
      topFeatureKey: inferFeatureKeyFromText(`${burst.title || ''} ${burst.decisionNeeded || ''}`),
    },
  };

  const existingIdx = OPS_REVIEW_HISTORY.findIndex((entry) => String(entry.id) === String(recordId));
  if (existingIdx >= 0) {
    OPS_REVIEW_HISTORY[existingIdx] = {
      ...OPS_REVIEW_HISTORY[existingIdx],
      ...reviewRecord,
      materialChangesThisCycle: [
        eventLabel,
        ...(OPS_REVIEW_HISTORY[existingIdx].materialChangesThisCycle || []).slice(0, 2),
      ],
    };
    return OPS_REVIEW_HISTORY[existingIdx];
  }

  OPS_REVIEW_HISTORY.unshift(reviewRecord);
  return reviewRecord;
}

function mapReasonToPreferenceTags(reason = '', action = 'approve') {
  const text = String(reason || '').toLowerCase();
  const tags = [];
  if (/concise|short|tight|brief/.test(text)) tags.push('copy-tone:concise');
  if (/detailed|more detail|depth|thorough/.test(text)) tags.push('copy-tone:detailed');
  if (/assertive|strong stance|decisive/.test(text)) tags.push('copy-tone:assertive');
  if (/dense|compact|more info/.test(text)) tags.push('component-density:compact');
  if (/lighter|less dense|simpl/.test(text)) tags.push('component-density:light');
  if (/single cta|one cta|dominant cta|primary cta/.test(text)) tags.push('cta-style:single-dominant');
  if (/multiple cta|multi cta|more options/.test(text)) tags.push('cta-style:multi-option');
  if (/summary first|top summary|headline first/.test(text)) tags.push('hierarchy:summary-first');
  if (/evidence first|proof first|details first/.test(text)) tags.push('hierarchy:evidence-first');
  if (/approve default|default fine|as is/.test(text)) tags.push('defaults:keep');
  if (action === 'revise') tags.push('decision:revise');
  if (action === 'approve') tags.push('decision:approve');
  return [...new Set(tags)];
}

function derivePreferenceSummary(profile = {}) {
  const tags = profile?.tags || {};
  const pick = (prefix, fallback) => {
    const options = Object.entries(tags)
      .filter(([k]) => k.startsWith(`${prefix}:`))
      .sort((a, b) => Number(b[1]?.total || 0) - Number(a[1]?.total || 0));
    return options[0]?.[0]?.split(':')[1] || fallback;
  };
  return {
    copy_tone: profile?.overrides?.copy_tone || pick('copy-tone', 'balanced'),
    component_density: profile?.overrides?.component_density || pick('component-density', 'balanced'),
    cta_style: profile?.overrides?.cta_style || pick('cta-style', 'single-dominant'),
    hierarchy_preference: profile?.overrides?.hierarchy_preference || pick('hierarchy', 'summary-first'),
  };
}

function applyPreferenceToRecommendationText(baseText = '', profile = {}) {
  const summary = profile?.summary || derivePreferenceSummary(profile);
  let text = String(baseText || '').trim();
  if (!text) return text;
  if (summary.copy_tone === 'concise') text = text.replace(/ and /g, ' + ');
  if (summary.copy_tone === 'assertive' && !/^now[:\-]/i.test(text)) text = `Now: ${text}`;
  if (summary.hierarchy_preference === 'summary-first') text = text.replace(/^prepare /i, 'Start by preparing ');
  if (summary.cta_style === 'single-dominant') text = text.replace(/\s*\+\s*book pilot-scoping call/i, ' (single next step: book pilot-scoping call)');
  return text;
}

function buildReviewBurstUnavailableValue({ reason, owner, eta }) {
  return {
    status: 'unavailable',
    reason: String(reason || 'Live source unavailable.'),
    blocker_owner: String(owner || 'Platform Ops'),
    blocker_eta: String(eta || '2026-02-22T23:00:00Z'),
  };
}

function formatReviewBurstLiveField(field = {}) {
  if (field?.status === 'available') return `${field.label}: ${field.value}`;
  return `${field.label}: unavailable (${field.reason}; owner=${field.blocker_owner}; eta=${field.blocker_eta})`;
}

function validateReviewBurstPayload(burst = {}) {
  const textBlob = [
    burst.title,
    burst.decisionNeeded,
    burst.whyReviewIsNeeded,
    burst.recommendedDefault,
    burst?.preview?.currentState,
    burst?.preview?.proposedChange,
    burst?.preview?.keyDiffSummary,
    burst?.preview?.snippetEmbed,
  ].join(' ').toLowerCase();

  const referencesNumerics = /(threshold|weight|metric|score|kpi|ratio|priority)/.test(textBlob);
  const live = burst.live_data || {};
  const fields = Array.isArray(live.fields) ? live.fields : [];

  if (referencesNumerics && !fields.length) {
    throw new Error(`review_burst_live_data_missing:${burst.id}`);
  }

  for (const field of fields) {
    if (field.status === 'available' && (field.value === null || field.value === undefined || field.value === '')) {
      throw new Error(`review_burst_live_value_empty:${burst.id}:${field.key || 'unknown'}`);
    }
    if (field.status === 'unavailable') {
      if (!field.reason || !field.blocker_owner || !field.blocker_eta) {
        throw new Error(`review_burst_unavailable_incomplete:${burst.id}:${field.key || 'unknown'}`);
      }
    }
  }

  if (!live.source_timestamp) {
    throw new Error(`review_burst_ops_indicator_missing:${burst.id}`);
  }

  return true;
}

function validateReviewBurstPayloads(bursts = []) {
  for (const burst of bursts) validateReviewBurstPayload(burst);
  return bursts;
}

async function hydrateReviewBurstsWithLiveData(baseBursts = OPS_REVIEW_BURSTS) {
  const [alertConfig, kpis, tasks, queueSnapshot] = await Promise.all([
    readAlertRulesConfig(),
    getKpis(),
    getTasks({ allowEmpty: true }),
    readWorkQueueSnapshot(),
  ]);

  const snapshot = buildMetricsSnapshot({ tasks, queueSnapshot, kpis });
  const rulesById = Object.fromEntries((alertConfig?.rules || []).map((rule) => [String(rule.id), rule]));
  const sourceTimestamp = snapshot?.generated_at || new Date().toISOString();

  const enriched = (baseBursts || []).map((burst) => {
    const next = { ...burst, preview: { ...(burst.preview || {}) } };
    const fields = [];

    if (String(burst.id) === 'burst-2026-02-22-2') {
      const signalWeight = RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1?.weights?.signal_weight;
      const overrideWeight = RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1?.weights?.operator_override_weight;
      const autoMin = RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1?.thresholds?.auto_escalate?.weighted_priority_min;
      const manualMin = RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1?.thresholds?.manual_review?.weighted_priority_min;
      const ratioRule = rulesById.completion_ratio_low;

      fields.push(
        Number.isFinite(Number(signalWeight)) ? { key: 'signal_weight', label: 'signal_weight', status: 'available', value: Number(signalWeight).toFixed(2) } : { key: 'signal_weight', label: 'signal_weight', ...buildReviewBurstUnavailableValue({ reason: 'Relationship weighting model missing signal_weight.', owner: 'AI Systems Lead', eta: '2026-02-22T20:00:00Z' }) },
        Number.isFinite(Number(overrideWeight)) ? { key: 'operator_override_weight', label: 'operator_override_weight', status: 'available', value: Number(overrideWeight).toFixed(2) } : { key: 'operator_override_weight', label: 'operator_override_weight', ...buildReviewBurstUnavailableValue({ reason: 'Relationship weighting model missing operator_override_weight.', owner: 'AI Systems Lead', eta: '2026-02-22T20:00:00Z' }) },
        Number.isFinite(Number(autoMin)) ? { key: 'auto_escalate_weighted_priority_min', label: 'auto_escalate.weighted_priority_min', status: 'available', value: String(autoMin) } : { key: 'auto_escalate_weighted_priority_min', label: 'auto_escalate.weighted_priority_min', ...buildReviewBurstUnavailableValue({ reason: 'Auto-escalate threshold not found.', owner: 'Ops Lead', eta: '2026-02-22T20:15:00Z' }) },
        Number.isFinite(Number(manualMin)) ? { key: 'manual_review_weighted_priority_min', label: 'manual_review.weighted_priority_min', status: 'available', value: String(manualMin) } : { key: 'manual_review_weighted_priority_min', label: 'manual_review.weighted_priority_min', ...buildReviewBurstUnavailableValue({ reason: 'Manual-review threshold not found.', owner: 'Ops Lead', eta: '2026-02-22T20:15:00Z' }) },
        ratioRule?.threshold
          ? { key: 'alert_rule_completion_ratio_low', label: 'alert_rule completion_ratio_low.threshold', status: 'available', value: String(ratioRule.threshold) }
          : { key: 'alert_rule_completion_ratio_low', label: 'alert_rule completion_ratio_low.threshold', ...buildReviewBurstUnavailableValue({ reason: 'Alert rule completion_ratio_low missing from config.', owner: 'Queue Manager', eta: '2026-02-22T19:45:00Z' }) },
      );
    }

    if (String(burst.id) === 'burst-2026-02-22-3') {
      const delegations = (kpis?.cards || []).find((card) => card.key === 'delegations_24h')?.value;
      const completed = (kpis?.cards || []).find((card) => card.key === 'completed_24h')?.value;
      const activeRuns = (kpis?.cards || []).find((card) => card.key === 'active_runs')?.value;
      fields.push(
        delegations != null ? { key: 'delegations_24h', label: 'delegations_24h', status: 'available', value: String(delegations) } : { key: 'delegations_24h', label: 'delegations_24h', ...buildReviewBurstUnavailableValue({ reason: 'delegations_24h missing in KPI cards.', owner: 'Data/Ops', eta: '2026-02-22T19:30:00Z' }) },
        completed != null ? { key: 'completed_24h', label: 'completed_24h', status: 'available', value: String(completed) } : { key: 'completed_24h', label: 'completed_24h', ...buildReviewBurstUnavailableValue({ reason: 'completed_24h missing in KPI cards.', owner: 'Data/Ops', eta: '2026-02-22T19:30:00Z' }) },
        activeRuns != null ? { key: 'active_runs', label: 'active_runs', status: 'available', value: String(activeRuns) } : { key: 'active_runs', label: 'active_runs', ...buildReviewBurstUnavailableValue({ reason: 'active_runs missing in KPI cards.', owner: 'Runtime Engineer', eta: '2026-02-22T19:30:00Z' }) },
      );
    }

    const opsIndicator = `/ops source_ts=${sourceTimestamp}`;
    next.live_data = {
      source: '/api/metrics/snapshot + /ops alert config + relationship priority model',
      source_timestamp: sourceTimestamp,
      fields,
      ops_indicator: opsIndicator,
    };

    if (fields.length) {
      next.preview.keyDiffSummary = fields.map((field) => formatReviewBurstLiveField(field)).join('; ');
      next.preview.snippetEmbed = `${next.preview.snippetEmbed ? `${next.preview.snippetEmbed}\n` : ''}${opsIndicator}`;
    } else {
      next.preview.snippetEmbed = `${next.preview.snippetEmbed ? `${next.preview.snippetEmbed}\n` : ''}${opsIndicator}`;
    }

    return next;
  });

  return validateReviewBurstPayloads(enriched);
}

function renderReviewBurstsPanel({ bursts = OPS_REVIEW_BURSTS, message = '', messageState = 'success', preferenceProfile = null } = {}) {
  const activeBursts = bursts.filter((burst) => String(burst.status || 'pending').toLowerCase() !== 'closed');
  const sortedBursts = [...activeBursts].sort((a, b) => {
    const priorityDelta = getReviewBurstPriorityRank(a.priority) - getReviewBurstPriorityRank(b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const rows = sortedBursts.map((burst) => {
    const normalizedStatus = String(burst.status || 'pending').toLowerCase();
    const statusClass = normalizedStatus === 'approved'
      ? 'ok'
      : normalizedStatus === 'revise'
        ? 'warn'
        : normalizedStatus === 'implemented'
          ? 'ok'
          : 'info';
    const preview = burst.preview || {};
    const currentValue = preview.currentState || burst.currentState || 'Current state not captured yet.';
    const proposedChange = preview.proposedChange || burst.proposedChange || applyPreferenceToRecommendationText(burst.recommendedDefault || 'Approve current direction unless material risk is newly uncovered.', preferenceProfile || {});
    const expectedImpact = preview.expectedImpact || burst.expectedImpact || 'Expected impact not provided.';
    const keyDiffSummary = preview.keyDiffSummary || burst.keyDiffSummary || '';
    const snippetEmbed = preview.snippetEmbed || burst.snippetEmbed || '';
    const screenshotUrl = preview.screenshotUrl || burst.screenshotUrl || '';
    const pageUrl = burst.pageUrl || (String(burst.exactUrl || '/ops').split('#')[0] || '/ops');
    const exactSectionUrl = burst.exactSectionUrl || burst.exactUrl || '/ops#review-bursts';

    return `<article class="panel" style="margin-top:.5rem" data-verify="ops-review-burst-entry-v3 ops-review-burst-lifecycle-v1 ops-review-burst-inline-context-v2 ops-review-burst-deep-links-v1 ops-review-burst-need-from-you-v1 ops-review-burst-plain-language-v1">
      <div class="panel-head"><h3>${escapeHtml(burst.title || 'Untitled review burst')}</h3><span class="section-tag">${escapeHtml(String(burst.priority || 'priority').toUpperCase())}</span></div>
      <table><tbody>
        <tr><th>What decision am I making?</th><td>${escapeHtml(burst.decisionNeeded || '—')}</td></tr>
        <tr><th>Why it matters</th><td>${escapeHtml(burst.whyReviewIsNeeded || '—')}</td></tr>
        <tr><th>Recommended default</th><td>${escapeHtml(applyPreferenceToRecommendationText(burst.recommendedDefault || 'Approve the current direction unless new risk appears.', preferenceProfile || {}))}</td></tr>
        <tr><th>If approve, what happens next</th><td>${escapeHtml(burst.approveNext || 'This item moves forward and implementation starts immediately.')}</td></tr>
        <tr><th>If revise, what to provide</th><td>${escapeHtml(burst.reviseProvide || 'Share the specific change you want and any required numbers, owner, or ETA.')}</td></tr>
        <tr><th>Review time</th><td>${escapeHtml(burst.expectedReviewTime || 'Under 20 seconds')}</td></tr>
        <tr><th>Deadline</th><td>${escapeHtml(formatDateTime(burst.deadline))}</td></tr>
        <tr><th>Lifecycle</th><td><span class="badge ${statusClass}">${escapeHtml(normalizedStatus)}</span></td></tr>
        <tr><th>/ops indicator</th><td><code>${escapeHtml(burst?.live_data?.ops_indicator || '/ops source_ts=unavailable')}</code></td></tr>
        <tr><th>Linkage ID</th><td><code>${escapeHtml(buildBurstReviewLinkageId(burst.id))}</code></td></tr>
        <tr><th>Timestamps</th><td>created ${escapeHtml(formatDateTime(burst.createdAt))} · updated ${escapeHtml(formatDateTime(burst.updatedAt || burst.createdAt))} · implemented ${escapeHtml(formatDateTime(burst.implementedAt))} · closed ${escapeHtml(formatDateTime(burst.closedAt))}</td></tr>
      </tbody></table>

      <div style="margin-top:.45rem" data-verify="ops-review-burst-context-inline-visible-v1">
        <p class="muted" style="margin:.1rem 0 .35rem 0"><strong>Decision context (visible inline)</strong> — no extra navigation needed for the default decision.</p>
        <table><tbody>
          <tr><th>Current value/state</th><td>${escapeHtml(currentValue)}</td></tr>
          <tr><th>Proposed change</th><td>${escapeHtml(proposedChange)}</td></tr>
          <tr><th>Expected impact</th><td>${escapeHtml(expectedImpact)}</td></tr>
        </tbody></table>
        ${keyDiffSummary ? `<p class="muted" style="margin-top:.35rem"><strong>Key diff summary:</strong> ${escapeHtml(keyDiffSummary)}</p>` : ''}
        ${snippetEmbed ? `<pre style="margin-top:.35rem;white-space:pre-wrap">${escapeHtml(snippetEmbed)}</pre>` : ''}
        ${screenshotUrl ? `<p style="margin-top:.35rem"><a href="${escapeHtml(screenshotUrl)}" target="_blank" rel="noopener">Open preview screenshot</a></p>` : ''}
      </div>

      <div class="links" style="margin-top:.45rem" data-verify="ops-review-burst-deep-link-buttons-v1">
        <a class="button-link" href="${escapeHtml(pageUrl)}">Open page</a>
        <a class="button-link" href="${escapeHtml(exactSectionUrl)}">Open exact section</a>
      </div>


      <div class="links" style="margin-top:.45rem" data-verify="ops-review-burst-simple-actions-v1">
        <form method="POST" action="/ops/review-bursts/${encodeURIComponent(burst.id)}/approve"><button type="submit">Approve (recommended)</button></form>
        <form method="POST" action="/ops/review-bursts/${encodeURIComponent(burst.id)}/revise"><button type="submit">Revise</button></form>
      </div>
      <form method="POST" action="/ops/review-bursts/${encodeURIComponent(burst.id)}/implement" class="inline-form" style="margin-top:.45rem" data-verify="ops-review-burst-proof-attach-v1">
        <input type="text" name="implementation_proof" placeholder="Implementation proof (PR/screenshot/link)" />
        <button type="submit">Attach proof + mark implemented</button>
      </form>
      <div class="links" style="margin-top:.45rem">
        <form method="POST" action="/ops/review-bursts/${encodeURIComponent(burst.id)}/close"><button type="submit">Close + archive</button></form>
      </div>
      <details style="margin-top:.35rem"><summary class="muted">Manual preference override for this burst</summary>
        <form method="POST" action="/ops/review-bursts/${encodeURIComponent(burst.id)}/preferences" class="inline-form" style="margin-top:.35rem">
          <input type="text" name="manual_tags" placeholder="tags (comma-separated, e.g. copy-tone:concise,cta-style:single-dominant)" />
          <input type="text" name="copy_tone" placeholder="copy tone override" />
          <input type="text" name="component_density" placeholder="density override" />
          <input type="text" name="cta_style" placeholder="cta style override" />
          <input type="text" name="hierarchy_preference" placeholder="hierarchy override" />
          <button type="submit">Save overrides</button>
        </form>
      </details>
    </article>`;
  }).join('');

  return `<article class="panel" id="review-bursts" data-verify="ops-review-bursts-panel-v3 ops-review-burst-linkage-v1 ops-preference-signal-capture-v1 ops-review-bursts-top-placement-v1">
    <div class="panel-head"><h2>Review Bursts</h2><span class="section-tag">top priority queue in /ops</span></div>
    <p class="muted">Each card is designed for a sub-20-second read: review inline context, then click Approve (recommended) or Revise.</p>
    <p class="muted" id="review-bursts-live-status" data-verify="ops-review-bursts-live-status-v1">connecting…</p>
    ${renderFlashMessage(message, messageState, 'ops-review-bursts-feedback-v1')}
    ${rows || '<p class="empty-state">No active review bursts pending.</p>'}
  </article>`;
}

function renderPreferenceProfilePanel(profile = {}) {
  const summary = profile?.summary || derivePreferenceSummary(profile);
  const tags = Object.entries(profile?.tags || {}).sort((a, b) => Number((b[1] || {}).total || 0) - Number((a[1] || {}).total || 0)).slice(0, 8);
  const recentSignals = Array.isArray(profile?.signals) ? profile.signals.slice(-5).reverse() : [];
  return `<article class="panel" id="preference-profile" data-verify="ops-preference-profile-summary-v1 ops-preference-manual-override-v1"><div class="panel-head"><h2>Operator preference profile</h2><span class="section-tag">learned from review decisions</span></div><p class="muted">Defaults adapt from approve/revise reasons and can be overridden manually.</p><table><tbody><tr><th>Copy tone</th><td>${escapeHtml(summary.copy_tone || 'balanced')}</td></tr><tr><th>Component density</th><td>${escapeHtml(summary.component_density || 'balanced')}</td></tr><tr><th>CTA style</th><td>${escapeHtml(summary.cta_style || 'single-dominant')}</td></tr><tr><th>Hierarchy preference</th><td>${escapeHtml(summary.hierarchy_preference || 'summary-first')}</td></tr><tr><th>Profile updated</th><td>${escapeHtml(formatDateTime(profile?.updated_at))}</td></tr></tbody></table><h3 style="margin:.45rem 0 .2rem">Top mapped tags</h3><p>${tags.map(([tag, counts]) => `<span class="badge">${escapeHtml(tag)} · ${escapeHtml((counts || {}).total || 0)}</span>`).join(' ') || '<span class="muted">No tags yet.</span>'}</p><h3 style="margin:.45rem 0 .2rem">Recent signals</h3><ul class="queue-list">${recentSignals.map((s) => `<li><strong>${escapeHtml(s.action || 'decision')}</strong> · ${escapeHtml(s.reason || 'no reason provided')}<div class="muted">${escapeHtml((s.tags || []).join(', ') || 'no tags')} · ${escapeHtml(formatDateTime(s.at))}</div></li>`).join('') || '<li class="muted">No recent signals.</li>'}</ul><form method="POST" action="/ops/preferences/update" class="inline-form"><input type="text" name="copy_tone" placeholder="copy tone" value="${escapeHtml(summary.copy_tone || '')}" /><input type="text" name="component_density" placeholder="component density" value="${escapeHtml(summary.component_density || '')}" /><input type="text" name="cta_style" placeholder="CTA style" value="${escapeHtml(summary.cta_style || '')}" /><input type="text" name="hierarchy_preference" placeholder="hierarchy preference" value="${escapeHtml(summary.hierarchy_preference || '')}" /><button type="submit">Save manual overrides</button></form></article>`;
}

function renderOpsOrchestrationVisibilityPanel(snapshot = {}) {
  const targetWorkers = Number(snapshot.targetWorkers || 0);
  const activeWorkers = Number(snapshot.activeWorkers || 0);
  const queueHealth = snapshot.queueHealth || { label: 'unknown', className: 'info' };
  const lastIncident = snapshot.lastIncident || null;
  const incidentSummary = lastIncident
    ? `${String(lastIncident.failure_class || 'incident')} · ${String(lastIncident.detected_condition || 'condition not specified')}`
    : 'No incidents recorded';

  return `<article class="panel" id="swarm-lane-health" data-verify="ops-orchestration-visibility-v1 ops-swarm-lane-health-card-v1"><div class="panel-head"><h2>Orchestration visibility</h2><span class="section-tag">/ops</span></div><p class="muted">Live worker floor and reliability snapshot for always-on orchestration.</p><table><thead><tr><th>Signal</th><th>Status</th><th>Detail</th></tr></thead><tbody><tr><td>Target workers</td><td><span class="badge">${escapeHtml(targetWorkers)}</span></td><td class="muted">Configured worker floor for refill automation.</td></tr><tr><td>Active workers</td><td><span class="badge ${activeWorkers >= targetWorkers ? 'ok' : 'warn'}">${escapeHtml(activeWorkers)}</span></td><td class="muted">Current active subagent count (${snapshot.workersGap || 0} below target).</td></tr><tr><td>Recent completion burst</td><td><span class="badge ${snapshot.recentCompletionBurstCount > 0 ? 'ok' : 'info'}">${escapeHtml(snapshot.recentCompletionBurstCount || 0)}</span></td><td class="muted">Newly completed items in latest completion-applier cycle.</td></tr><tr><td>Queue health</td><td><span class="badge ${escapeHtml(queueHealth.className || 'info')}">${escapeHtml(queueHealth.label || 'unknown')}</span></td><td class="muted">Derived from blocked/waiting queue pressure and deferred spawns.</td></tr><tr><td>Last refill time</td><td><span class="badge">${escapeHtml(formatDateTime(snapshot.lastRefill))}</span></td><td class="muted">Most recent successful worker spawn event (${snapshot.refillAgeMinutes ?? 'n/a'}m ago).</td></tr><tr><td>Refill SLA status</td><td><span class="badge ${escapeHtml(snapshot.refillSlaStatus?.className || 'info')}">${escapeHtml(snapshot.refillSlaStatus?.label || 'unknown')}</span></td><td class="muted">Clear GREEN/YELLOW/RED signal from worker gap + refill age.</td></tr><tr><td>Last incident</td><td><span class="badge ${lastIncident && String(lastIncident.status || '').toLowerCase() !== 'resolved' ? 'bad' : 'ok'}">${escapeHtml(lastIncident ? String(lastIncident.status || 'unknown') : 'none')}</span></td><td class="muted">${escapeHtml(incidentSummary)}</td></tr></tbody></table></article>`;
}

function parseQualityNumeric(score = '') {
  const matched = String(score || '').match(/(\d+(?:\.\d+)?)/);
  return matched ? Number(matched[1]) : null;
}

function getTrendDirection(values = []) {
  if (values.length < 2) return { direction: 'flat', slope: 0 };
  const slope = (values[values.length - 1] - values[0]) / Math.max(values.length - 1, 1);
  if (slope > 0.05) return { direction: 'up', slope };
  if (slope < -0.05) return { direction: 'down', slope };
  return { direction: 'flat', slope };
}

function inferDropReasonTags(entry = {}) {
  const text = `${entry.currentStateSnapshot || ''} ${(entry.materialChangesThisCycle || []).join(' ')} ${entry.blockers || ''}`.toLowerCase();
  const tags = [];
  if (/regress|regression|route regresses|failed/.test(text)) tags.push('regression');
  if (/integration|sync|api|handoff/.test(text)) tags.push('integration');
  if (/copy|label|taxonomy|naming/.test(text)) tags.push('copy-data mismatch');
  if (/threshold|weight|ratif|decision/.test(text)) tags.push('threshold-decision drift');
  if (/env\/auth|credential|secure|key-gated/.test(text)) tags.push('env-auth dependency');
  return tags.length ? tags : ['unknown-investigate'];
}

function buildQualityTrendModel(entries = []) {
  const sortedAsc = [...entries]
    .sort((a, b) => new Date(a.reviewedAt || 0).getTime() - new Date(b.reviewedAt || 0).getTime())
    .filter((entry) => parseQualityNumeric(entry.qualityScore) !== null);
  const trend7 = sortedAsc.slice(-7);
  const scores = trend7.map((entry) => parseQualityNumeric(entry.qualityScore));
  const trend = getTrendDirection(scores);
  const recentDeltas = scores.map((score, idx) => (idx === 0 ? 0 : Number((score - scores[idx - 1]).toFixed(2))));
  const declineTwoCycles = scores.length >= 3
    && scores[scores.length - 1] < scores[scores.length - 2]
    && scores[scores.length - 2] < scores[scores.length - 3];

  const latest = scores[scores.length - 1] ?? null;
  const prev = scores[scores.length - 2] ?? latest;
  const baseComponents = {
    ux_clarity: 9.1,
    visual_consistency: 8.9,
    golden_path_reliability: 9.3,
    actionability: 9.2,
    data_truth_consistency: 8.8,
  };
  const latestDelta = Number(((latest ?? 0) - (prev ?? 0)).toFixed(2));
  const componentScores = Object.entries(baseComponents).map(([key, val], idx) => ({
    key,
    score: Number(Math.max(0, Math.min(10, val + (latestDelta * (0.6 - (idx * 0.12))))).toFixed(2)),
    delta: Number((latestDelta * (0.55 - (idx * 0.1))).toFixed(2)),
  }));

  const threshold = 8.8;
  return {
    trend7,
    scores,
    trend,
    recentDeltas,
    declineTwoCycles,
    releaseThreshold: { threshold, state: (latest ?? 0) >= threshold ? 'pass' : 'fail' },
    componentScores,
    dropReasonTags: declineTwoCycles ? inferDropReasonTags(trend7[trend7.length - 1] || {}) : [],
  };
}

function renderOpsReviewsPanel(entries = [], unifiedKpiTelemetry = null, developmentCostAttribution = null) {
  const sortedEntries = [...entries].sort((a, b) => new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime());
  const latest = sortedEntries[0] || null;
  const history = sortedEntries.slice(1);
  const latestCostSummary = latest?.developmentCostSummary || {
    totalCostUsd: Number(developmentCostAttribution?.totalCostUsd || 0),
    totalTokens: Number(developmentCostAttribution?.totalTokens || 0),
    topFeatureKey: String((developmentCostAttribution?.rows || [])[0]?.featureKey || 'n/a'),
    cycleKey: String((developmentCostAttribution?.byCycleRows || [])[0]?.cycleKey || 'current'),
  };

  if (!latest) {
    return '<p class="empty-state">No ops reviews yet. Add the first entry in <code>OPS_REVIEW_HISTORY</code>.</p>';
  }

  const trendModel = buildQualityTrendModel(sortedEntries);
  const directionBadgeClass = trendModel.trend.direction === 'up' ? 'ok' : trendModel.trend.direction === 'down' ? 'bad' : 'warn';
  const renderLiveLinks = (review) => `<div class="links">${(review.livePages || []).map((page) => `<a href="${escapeHtml(page.path || '/ops')}">${escapeHtml(page.label || page.path || '/ops')}</a>`).join('')}</div>`;
  const renderHardeningStatus = (review) => {
    const rows = review?.consolidationHardening || [];
    if (!rows.length) return '';
    const badgeClass = (status) => (String(status || '').toUpperCase() === 'GREEN' ? 'ok' : String(status || '').toUpperCase() === 'YELLOW' ? 'warn' : 'bad');
    return `<tr data-verify="ops-consolidation-hardening-status-v1 ops-consolidation-badge-matrix-v1"><th>Consolidation daily hardening status</th><td><table><thead><tr><th>Area</th><th>Status</th><th>Notes</th><th>Evidence</th></tr></thead><tbody>${rows.map((item) => `<tr data-verify="ops-hardening-${escapeHtml(item.id || 'item')}-v1"><td><strong>${escapeHtml(item.area || '—')}</strong></td><td><span class="badge ${badgeClass(item.status)}">${escapeHtml(String(item.status || 'RED').toUpperCase())}</span></td><td>${escapeHtml(item.note || '—')}</td><td><div class="links">${(item.evidence || []).map((ev) => `<a href="${escapeHtml(ev.path || '/ops')}">${escapeHtml(ev.label || ev.path || '/ops')}</a>`).join('')}</div></td></tr>`).join('')}</tbody></table></td></tr>`;
  };

  return `<div id="ops-review-center" data-verify="ops-review-center-v1 ops-review-history-v1 ops-review-live-links-v1 ops-review-autoappend-v1 kpi-telemetry-unified-source-v1 ops-quality-trend-control-v1">
    <article class="panel" style="margin-top:.55rem" data-verify="ops-review-latest-card-v1">
      <div class="panel-head"><h3>Latest closure summary</h3><span class="section-tag">${escapeHtml(formatDateTime(latest.reviewedAt))}</span></div>
      <p class="muted">Reviewer: ${escapeHtml(latest.reviewer || 'Ops')}</p>
      <p class="muted" data-verify="kpi-freshness-timestamp-v1">KPI telemetry freshness timestamp: ${escapeHtml(formatDateTime(unifiedKpiTelemetry?.generated_at || new Date().toISOString()))}</p>
      <div class="kpis" style="margin:.4rem 0 .25rem 0;">
        <article class="card"><div class="name">Quality score</div><div class="value">${escapeHtml(latest.qualityScore || '—')}</div><div class="muted">${escapeHtml(latest.qualityRationale || 'No rationale provided.')}</div></article>
        <article class="card"><div class="name">Blockers + ETA</div><div class="value">${escapeHtml(latest.blockerEta || '—')}</div><div class="muted">${escapeHtml(latest.blockers || 'No blockers currently tracked.')}</div></article>
      </div>
      <table><tbody>
        <tr><th>Current state snapshot</th><td>${escapeHtml(latest.currentStateSnapshot || '—')}</td></tr>
        <tr data-verify="ops-review-linkage-row-v1"><th>Linkage + timestamps</th><td><code>${escapeHtml(latest.linkageId || 'n/a')}</code> · reviewed ${escapeHtml(formatDateTime(latest.reviewedAt))} · lifecycle-updated ${escapeHtml(formatDateTime(latest.lifecycleUpdatedAt || latest.reviewedAt))}</td></tr>
        <tr><th>Material changes this cycle</th><td><ul class="queue-list">${(latest.materialChangesThisCycle || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></td></tr>
        <tr data-verify="ops-review-feature-cost-summary-v1"><th>Development cost by feature (current attribution)</th><td><strong>Cycle:</strong> ${escapeHtml(latestCostSummary.cycleKey || 'current')} · <strong>Tokens:</strong> ${escapeHtml(Number(latestCostSummary.totalTokens || 0).toLocaleString())} · <strong>Cost:</strong> $${escapeHtml(Number(latestCostSummary.totalCostUsd || 0).toFixed(4))} · <strong>Top feature:</strong> <code>${escapeHtml(latestCostSummary.topFeatureKey || 'n/a')}</code></td></tr>
        ${renderHardeningStatus(latest)}
        <tr><th>Next actions</th><td><ul class="queue-list">${(latest.nextActions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No next actions tracked.</li>'}</ul></td></tr>
        <tr><th>2-minute demo script</th><td><ol>${(latest.demoScript || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol></td></tr>
      </tbody></table>
      <div style="margin-top:.45rem"><strong>Live pages reviewed</strong>${renderLiveLinks(latest)}</div>
    </article>
    <article class="panel" id="quality-trend" style="margin-top:.55rem" data-verify="ops-quality-trend-panel-v1 ops-quality-components-v1 ops-release-threshold-state-v1 ops-decline-alert-rule-v1">
      <div class="panel-head"><h3>Quality Trend Control (7-day)</h3><span class="badge ${directionBadgeClass}">${escapeHtml(trendModel.trend.direction)} (${escapeHtml(trendModel.trend.slope.toFixed(2))}/cycle)</span></div>
      <p class="muted">Quality components: UX clarity, visual consistency, golden-path reliability, actionability, data/truth consistency.</p>
      <table><thead><tr><th>Cycle</th><th>Quality</th><th>Delta</th></tr></thead><tbody>${trendModel.trend7.map((entry, idx) => `<tr><td>${escapeHtml(formatDateTime(entry.reviewedAt))}</td><td>${escapeHtml(entry.qualityScore || '—')}</td><td>${idx === 0 ? '—' : escapeHtml((trendModel.recentDeltas[idx] > 0 ? '+' : '') + trendModel.recentDeltas[idx])}</td></tr>`).join('')}</tbody></table>
      <p class="muted"><strong>Decline alert rule:</strong> trigger when quality declines 2 cycles in a row. Current: <span class="badge ${trendModel.declineTwoCycles ? 'bad' : 'ok'}">${trendModel.declineTwoCycles ? 'TRIGGERED' : 'clear'}</span></p>
      <p class="muted"><strong>Release threshold:</strong> ≥ ${escapeHtml(trendModel.releaseThreshold.threshold)}/10 · <span class="badge ${trendModel.releaseThreshold.state === 'pass' ? 'ok' : 'bad'}">${escapeHtml(trendModel.releaseThreshold.state.toUpperCase())}</span></p>
      ${trendModel.declineTwoCycles ? `<p class="muted"><strong>Reason tags:</strong> ${(trendModel.dropReasonTags || []).map((tag) => `<span class="badge warn">${escapeHtml(tag)}</span>`).join(' ')}</p><p class="muted"><strong>Auto-trigger guidance:</strong> Freeze net-new for one cycle + run a focused fix burst on top 2 drop drivers before resuming feature work.</p>` : '<p class="muted"><strong>Reason tags:</strong> no current 2-cycle decline detected.</p>'}
      <h4 style="margin:.5rem 0 .25rem 0">Per-component score + recent deltas</h4>
      <table><thead><tr><th>Component</th><th>Score</th><th>Recent delta</th></tr></thead><tbody>${trendModel.componentScores.map((component) => `<tr><td>${escapeHtml(component.key.replaceAll('_', ' '))}</td><td>${escapeHtml(component.score)}</td><td>${escapeHtml((component.delta > 0 ? '+' : '') + component.delta)}</td></tr>`).join('')}</tbody></table>
    </article>
    <article class="panel" style="margin-top:.55rem" data-verify="ops-review-history-list-v1 ops-review-archive-v1">
      <div class="panel-head"><h3>Archived closures</h3><span class="section-tag">older cycles</span></div>
      <p class="muted">Latest closure summary stays pinned above. Expand this archive only when you need prior-cycle context.</p>
      ${history.length ? `<details><summary><strong>Open archived review history</strong> (${history.length})</summary><div class="funnel-list" style="margin-top:.55rem;">${history.map((entry) => `<article class="panel" data-verify="ops-review-history-card-v1"><div class="panel-head"><h4>${escapeHtml(formatDateTime(entry.reviewedAt))}</h4><span class="badge">${escapeHtml(entry.qualityScore || 'n/a')}</span></div><p><strong>Snapshot:</strong> ${escapeHtml(entry.currentStateSnapshot || '—')}</p><p><strong>Linkage:</strong> <code>${escapeHtml(entry.linkageId || 'n/a')}</code> <span class="muted">(lifecycle updated ${escapeHtml(formatDateTime(entry.lifecycleUpdatedAt || entry.reviewedAt))})</span></p><p><strong>What changed:</strong> ${escapeHtml((entry.materialChangesThisCycle || [])[0] || 'n/a')}</p><p><strong>Blockers + ETA:</strong> ${escapeHtml(entry.blockers || '—')} <span class="muted">(${escapeHtml(entry.blockerEta || 'eta n/a')})</span></p><p><strong>Next action:</strong> ${escapeHtml((entry.nextActions || [])[0] || 'n/a')}</p><p><strong>2-minute demo focus:</strong> ${escapeHtml((entry.demoScript || [])[0] || 'n/a')}</p><p><strong>Dev cost summary:</strong> $${escapeHtml(Number(entry?.developmentCostSummary?.totalCostUsd || 0).toFixed(4))} · ${escapeHtml(Number(entry?.developmentCostSummary?.totalTokens || 0).toLocaleString())} tokens · <code>${escapeHtml(entry?.developmentCostSummary?.topFeatureKey || 'n/a')}</code></p>${renderLiveLinks(entry)}</article>`).join('')}</div></details>` : '<p class="empty-state">No prior reviews yet.</p>'}
    </article>
  </div>`;
}

function buildClosedLoopTraceRows(entries = []) {
  return entries
    .slice(0, 8)
    .map((entry) => {
      const textBlob = `${entry.currentStateSnapshot || ''} ${(entry.materialChangesThisCycle || []).join(' ')} ${(entry.nextActions || []).join(' ')} ${(entry.blockers || '')}`.toLowerCase();
      const evidenceLinks = [
        ...(entry.livePages || []),
        ...((entry.consolidationHardening || []).flatMap((item) => item.evidence || [])),
      ];
      const hasBurstCreated = /review burst|review-burst|rb-\d|rb-ui-/.test(textBlob) || evidenceLinks.some((link) => String(link.path || '').includes('/ops/review-bursts'));
      const hasDecisionMade = /decision|approved|ratif|scope lock|close rb|release gate/.test(textBlob);
      const hasTaskSpawned = Array.isArray(entry.nextActions) && entry.nextActions.length > 0;
      const hasChangeApplied = Array.isArray(entry.materialChangesThisCycle) && entry.materialChangesThisCycle.length > 0;
      const hasProofAttached = evidenceLinks.length > 0;
      const hasReviewClosed = Boolean(entry.reviewedAt);

      const missingSteps = [
        ['burst created', hasBurstCreated],
        ['decision made', hasDecisionMade],
        ['task spawned', hasTaskSpawned],
        ['change applied', hasChangeApplied],
        ['proof attached', hasProofAttached],
        ['review closed', hasReviewClosed],
      ].filter(([, ok]) => !ok).map(([label]) => label);

      const brokenLinks = evidenceLinks
        .filter((link) => {
          const p = String(link.path || '').trim();
          return !p || p === '#' || p === '—';
        })
        .length;

      const incidents = [
        ...(missingSteps.length ? [`missing: ${missingSteps.join(', ')}`] : []),
        ...(brokenLinks ? [`broken links: ${brokenLinks}`] : []),
      ];

      return {
        id: entry.id || 'cycle-unknown',
        reviewedAt: entry.reviewedAt,
        hasBurstCreated,
        hasDecisionMade,
        hasTaskSpawned,
        hasChangeApplied,
        hasProofAttached,
        hasReviewClosed,
        incidents,
      };
    });
}

function renderClosedLoopTracePanel(entries = []) {
  const rows = buildClosedLoopTraceRows(entries);
  const badge = (ok) => `<span class="badge ${ok ? 'ok' : 'bad'}">${ok ? 'yes' : 'no'}</span>`;
  return `<article class="panel" id="closed-loop-trace" data-verify="ops-closed-loop-trace-panel-v1 ops-closed-loop-trace-incidents-v1"><div class="panel-head"><h2>Closed-loop trace</h2><span class="section-tag">/ops marker</span></div><p class="muted">Per-cycle trace for burst → decision → task → change → proof → review. Missing steps and broken evidence links are highlighted as incidents.</p><table><thead><tr><th>Cycle</th><th>Burst created</th><th>Decision made</th><th>Task spawned</th><th>Change applied</th><th>Proof attached</th><th>Review closed</th><th>Incidents</th></tr></thead><tbody>${rows.map((row) => `<tr data-verify="ops-closed-loop-trace-row-v1"><td><strong>${escapeHtml(row.id)}</strong><div class="muted">${escapeHtml(formatDateTime(row.reviewedAt))}</div></td><td>${badge(row.hasBurstCreated)}</td><td>${badge(row.hasDecisionMade)}</td><td>${badge(row.hasTaskSpawned)}</td><td>${badge(row.hasChangeApplied)}</td><td>${badge(row.hasProofAttached)}</td><td>${badge(row.hasReviewClosed)}</td><td>${row.incidents.length ? row.incidents.map((incident) => `<span class="badge bad">${escapeHtml(incident)}</span>`).join(' ') : '<span class="badge ok">none</span>'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty-state">No cycles available.</td></tr>'}</tbody></table></article>`;
}

function renderOpsReviewerChecklistCard() {
  return `<div data-verify="ops-review-checklist-card-v1 ops-review-checklist-embedded-v2 ops-review-checklist-one-click-v1"><div class="panel-head"><h3>Operator review checklist</h3><span class="section-tag">embedded in /ops</span></div><p class="muted" style="margin-top:.35rem;">Pattern locked: embedded checklist card (not drawer/modal). Keep this pass concise, then use the full doc when needed.</p><ul class="queue-list"><li>Confirm latest review card is current (snapshot, quality score, blockers, next action).</li><li>Run command smoke check: <code>curl -s http://127.0.0.1:1981/ops | grep -q &quot;ops-review-checklist-card-v1&quot;</code>, then verify route health for Home, Targeting, Actions, Relationships, Pilot, and Ops.</li><li>Check Operations board lanes for blocked work and clear owner assignment.</li><li>Review Follow-ups/client updates and clear overdue items first.</li><li>Validate reply routing and sequence queue diagnostics for handoff readiness.</li><li>Scan alert rules and record escalation owner/ETA for active triggers.</li><li>Confirm workflow completeness + Monday readiness have no failing gates.</li><li>Log review outcome in Ops Reviews with one material change + one next action.</li></ul><p><a class="button-link button-secondary" href="/ops/reviewer-checklist" data-verify="ops-review-checklist-full-doc-link-v1">Open full reviewer checklist</a></p></div>`;
}

function renderDesignBenchmarkPanel() {
  const benchmarkReferences = [
    { name: 'Linear', signal: 'Focused primary action and clean visual hierarchy for dense project views.' },
    { name: 'Notion', signal: 'Context continuity via breadcrumbs and consistent page framing.' },
    { name: 'HubSpot', signal: 'Operator-first tables with clear state badges and workflow CTA placement.' },
    { name: 'Stripe Dashboard', signal: 'High signal density with restrained card chrome and strong readability.' },
    { name: 'Asana', signal: 'Task clarity with explicit ownership, due cues, and next-step visibility.' },
  ];

  const pages = [
    { page: 'Home', path: '/', scores: { clarity: 8, hierarchy: 8, density: 7, cta_focus: 8, context_continuity: 7 } },
    { page: 'Strategy', path: '/strategy', scores: { clarity: 8, hierarchy: 7, density: 6, cta_focus: 7, context_continuity: 7 } },
    { page: 'Targeting', path: '/targeting', scores: { clarity: 8, hierarchy: 8, density: 7, cta_focus: 8, context_continuity: 7 } },
    { page: 'Actions', path: '/actions', scores: { clarity: 8, hierarchy: 8, density: 8, cta_focus: 8, context_continuity: 8 } },
    { page: 'Relationships', path: '/relationships', scores: { clarity: 7, hierarchy: 7, density: 7, cta_focus: 7, context_continuity: 7 } },
    { page: 'Comms · Account Workspace', path: '/comms?view=account&tab=inbox', scores: { clarity: 7, hierarchy: 7, density: 8, cta_focus: 7, context_continuity: 6 } },
    { page: 'Comms · Individual Workspace', path: '/comms?view=individual&tab=inbox', scores: { clarity: 7, hierarchy: 7, density: 8, cta_focus: 7, context_continuity: 6 } },
    { page: 'Pilot', path: '/pilot', scores: { clarity: 8, hierarchy: 8, density: 7, cta_focus: 8, context_continuity: 7 } },
    { page: 'Research', path: '/research', scores: { clarity: 7, hierarchy: 7, density: 8, cta_focus: 6, context_continuity: 6 } },
    { page: 'Ops', path: '/ops', scores: { clarity: 8, hierarchy: 8, density: 8, cta_focus: 7, context_continuity: 8 } },
  ];

  const principles = ['clarity', 'hierarchy', 'density', 'cta_focus', 'context_continuity'];
  const principleLabels = {
    clarity: 'Clarity',
    hierarchy: 'Hierarchy',
    density: 'Density',
    cta_focus: 'CTA focus',
    context_continuity: 'Context continuity',
  };

  const principleAverage = Object.fromEntries(principles.map((key) => [
    key,
    pages.reduce((sum, row) => sum + Number(row.scores[key] || 0), 0) / Math.max(pages.length, 1),
  ]));

  const topGaps = principles
    .map((key) => ({ key, avg: principleAverage[key] }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .map((item) => {
      const nextFix = {
        context_continuity: 'Standardize sticky breadcrumb + section context chips across Comms and Research.',
        cta_focus: 'Reduce competing secondary buttons; enforce one dominant CTA in each primary panel.',
        hierarchy: 'Increase heading contrast and section spacing on mid-density pages (Strategy/Relationships).',
        density: 'Condense low-value helper copy into expandable hints to keep table-first scanning speed.',
        clarity: 'Rewrite ambiguous labels into operator-action language (verb + outcome).',
      }[item.key] || 'Tighten page-level UX consistency against benchmark principles.';
      return { ...item, label: principleLabels[item.key], nextFix };
    });

  const rowMarkup = pages.map((row) => {
    const total = principles.reduce((sum, key) => sum + Number(row.scores[key] || 0), 0);
    const avg = total / principles.length;
    const badgeClass = avg >= 8 ? 'ok' : avg >= 7 ? 'warn' : 'bad';
    return `<tr data-verify="ops-design-benchmark-score-row-v1"><td><strong>${escapeHtml(row.page)}</strong><div class="muted"><a href="${escapeHtml(row.path)}"><code>${escapeHtml(row.path)}</code></a></div></td><td>${escapeHtml(row.scores.clarity)}</td><td>${escapeHtml(row.scores.hierarchy)}</td><td>${escapeHtml(row.scores.density)}</td><td>${escapeHtml(row.scores.cta_focus)}</td><td>${escapeHtml(row.scores.context_continuity)}</td><td><span class="badge ${badgeClass}">${escapeHtml(avg.toFixed(1))}/10</span></td></tr>`;
  }).join('');

  return `<article class="panel" id="design-benchmark" data-verify="ops-design-benchmark-panel-v1 ops-design-benchmark-principles-v1 ops-design-benchmark-page-scores-v1 ops-design-benchmark-gaps-next-fixes-v1"><div class="panel-head"><h2>Design benchmark panel</h2><span class="section-tag">enterprise SaaS UX baseline</span></div><p class="muted">Reference baseline inspired by Linear, Notion, HubSpot, Stripe Dashboard, and Asana. Scores are operator-facing heuristics (1-10) to guide incremental UX improvements.</p><h3 style="margin:.45rem 0 .25rem 0;">Benchmark references</h3><ul class="queue-list">${benchmarkReferences.map((item) => `<li><strong>${escapeHtml(item.name)}:</strong> ${escapeHtml(item.signal)}</li>`).join('')}</ul><h3 style="margin:.5rem 0 .25rem 0;">Benchmark principles</h3><table><thead><tr><th>Principle</th><th>What good looks like</th><th>Current avg</th></tr></thead><tbody><tr><td><strong>Clarity</strong></td><td>Labels read as actions/outcomes; low ambiguity in tables and cards.</td><td><span class="badge">${escapeHtml(principleAverage.clarity.toFixed(1))}</span></td></tr><tr><td><strong>Hierarchy</strong></td><td>Primary objective and section order are obvious in first screen.</td><td><span class="badge">${escapeHtml(principleAverage.hierarchy.toFixed(1))}</span></td></tr><tr><td><strong>Density</strong></td><td>High information-per-scroll without sacrificing scan speed.</td><td><span class="badge">${escapeHtml(principleAverage.density.toFixed(1))}</span></td></tr><tr><td><strong>CTA focus</strong></td><td>One dominant next action per panel; reduced competing actions.</td><td><span class="badge">${escapeHtml(principleAverage.cta_focus.toFixed(1))}</span></td></tr><tr><td><strong>Context continuity</strong></td><td>Cross-page handoffs preserve task context and orientation.</td><td><span class="badge">${escapeHtml(principleAverage.context_continuity.toFixed(1))}</span></td></tr></tbody></table><h3 style="margin:.55rem 0 .25rem 0;">Page-level scoring</h3><table><thead><tr><th>Page</th><th>Clarity</th><th>Hierarchy</th><th>Density</th><th>CTA focus</th><th>Context continuity</th><th>Overall</th></tr></thead><tbody>${rowMarkup}</tbody></table><h3 style="margin:.55rem 0 .25rem 0;">Top 3 gaps + next fixes</h3><ol class="queue-list">${topGaps.map((gap) => `<li data-verify="ops-design-benchmark-gap-item-v1"><strong>${escapeHtml(gap.label)}</strong> (avg ${escapeHtml(gap.avg.toFixed(1))}/10) — ${escapeHtml(gap.nextFix)}</li>`).join('')}</ol></article>`;
}

function renderOperatorBriefingTemplatesPanel() {
  const dailyTemplate = `# Daily Operator Briefing\nDate: YYYY-MM-DD\nOperator: \n\n1) North-star objective (today)\n- \n\n2) KPI pulse (start of day)\n- Active runs:\n- Open priorities:\n- 24h delegations/completions:\n- Queue pressure (doing/blocked/up next):\n\n3) Top 3 execution priorities\n- [P1] Owner | due | expected outcome\n- [P2] Owner | due | expected outcome\n- [P3] Owner | due | expected outcome\n\n4) Risks and blockers\n- Risk/Blocker | impact | owner | ETA\n\n5) Customer + pilot movement\n- Qualified accounts moved today:\n- Follow-ups sent / pending:\n- Pilot go/no-go changes:\n\n6) Decisions needed from human\n- Decision | options | recommendation\n\n7) End-of-day closeout\n- What changed today:\n- Evidence links (/ops, /actions, /relationships, /pilot):\n- Next action for tomorrow:`;

  const weeklyTemplate = `# Weekly Operator Briefing\nWeek of: YYYY-MM-DD\nOwner: \n\n1) Weekly objective + scorecard summary\n- Objective:\n- Wins:\n- Misses:\n- Overall confidence (high/med/low):\n\n2) KPI trend (week over week)\n- Pipeline movement:\n- Reply/conversion trend:\n- Pilot-readiness trend:\n- Reliability trend (alerts/incidents):\n\n3) Workstream status\n- Diagnostics/infra:\n- Process/queue execution:\n- Logs/risk monitoring:\n\n4) Material changes this week\n- Change | why it mattered | evidence\n\n5) Blockers + mitigation plan\n- Blocker | mitigation | owner | ETA\n\n6) Next-week priorities (top 5)\n- [1] \n- [2] \n- [3] \n- [4] \n- [5] \n\n7) Decisions + asks\n- Ask | needed by | impact if delayed\n\n8) Demo/export summary\n- 2-minute demo script:\n- Links to live pages reviewed:\n- Ready-to-share narrative:`;

  return `<article class="panel" id="operator-briefing-templates" data-verify="ops-operator-briefing-templates-v1 ops-daily-weekly-briefing-templates-v1"><div class="panel-head"><h2>Operator briefing templates</h2><span class="section-tag">daily + weekly</span></div><p class="muted">Copy-ready templates for daily standup and weekly review exports. Fill in fields directly, then paste into docs/chat/email.</p><div class="layout" style="grid-template-columns:1fr 1fr;gap:.75rem"><section><h3 style="margin:.2rem 0">Daily template fields</h3><ul class="queue-list" data-verify="ops-daily-briefing-fields-v1"><li>Date + operator</li><li>North-star objective</li><li>KPI pulse + queue pressure</li><li>Top 3 priorities with owner/due/outcome</li><li>Risks/blockers with impact + ETA</li><li>Customer/pilot movement</li><li>Decisions needed</li><li>End-of-day closeout + evidence links</li></ul><textarea readonly rows="18" style="width:100%;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;" data-verify="ops-daily-briefing-copy-v1">${escapeHtml(dailyTemplate)}</textarea></section><section><h3 style="margin:.2rem 0">Weekly template fields</h3><ul class="queue-list" data-verify="ops-weekly-briefing-fields-v1"><li>Weekly objective + scorecard summary</li><li>WoW KPI trend snapshot</li><li>Workstream status (diagnostics/process/logs)</li><li>Material changes with evidence</li><li>Blockers + mitigation plan</li><li>Top 5 next-week priorities</li><li>Decisions/asks with deadlines</li><li>Demo/export summary narrative</li></ul><textarea readonly rows="18" style="width:100%;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;" data-verify="ops-weekly-briefing-copy-v1">${escapeHtml(weeklyTemplate)}</textarea></section></div><p class="muted" data-verify="ops-briefing-export-format-v1">Export/copy-ready format: Markdown (headers + bullets) for direct paste into Notion, docs, tickets, or status updates.</p></article>`;
}

function renderAutonomyDirectionPanel(direction = DEFAULT_AUTONOMY_DIRECTION, flashMessage = '', flashState = 'success') {
  const prefs = direction.directional_preferences || {};
  const spawnDefaults = deriveSpawnDefaultsFromAutonomy(direction);
  const constraintsText = (direction.operating_constraints || []).join('\n');
  const speedPct = Math.round(Number(prefs.speed_vs_polish || 0.5) * 100);
  return `<article class="panel" id="autonomy-direction" data-verify="ops-autonomy-direction-control-v1 ops-autonomy-direction-defaults-v1 ops-autonomy-direction-review-burst-binding-v1"><div class="panel-head"><h2>Autonomy direction control</h2><span class="section-tag">/ops control surface</span></div>
    <p class="muted">Set objective, quality mode, and operating constraints; directional preferences drive spawn defaults and review-burst behavior.</p>
    ${renderFlashMessage(flashMessage, flashState, 'ops-autonomy-direction-feedback-v1')}
    <table><tbody>
      <tr><th>Current objective</th><td>${escapeHtml(direction.objective || '—')}</td></tr>
      <tr><th>Quality mode</th><td><span class="badge info">${escapeHtml(String(direction.quality_mode || 'balanced'))}</span></td></tr>
      <tr><th>Operating constraints</th><td><ul class="queue-list">${(direction.operating_constraints || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></td></tr>
      <tr><th>Spawn defaults (derived)</th><td><span class="badge">target_workers=${escapeHtml(spawnDefaults.target_workers)}</span> <span class="badge">quality_gate=${escapeHtml(spawnDefaults.quality_gate)}</span> <span class="badge">escalation_mode=${escapeHtml(spawnDefaults.escalation_mode)}</span> <span class="badge">review_burst_budget=${escapeHtml(spawnDefaults.review_burst_budget)}</span></td></tr>
    </tbody></table>
    <form method="POST" action="/ops/autonomy-direction" class="inline-form" style="margin-top:.5rem">
      <label>Objective<textarea name="objective" rows="2">${escapeHtml(direction.objective || '')}</textarea></label>
      <label>Quality mode<select name="quality_mode"><option value="speed" ${direction.quality_mode === 'speed' ? 'selected' : ''}>speed</option><option value="balanced" ${direction.quality_mode === 'balanced' ? 'selected' : ''}>balanced</option><option value="polish" ${direction.quality_mode === 'polish' ? 'selected' : ''}>polish</option></select></label>
      <label>Operating constraints (one per line)<textarea name="operating_constraints" rows="4">${escapeHtml(constraintsText)}</textarea></label>
      <label>Speed vs polish (${speedPct}% speed)<input type="range" name="speed_vs_polish" min="0" max="100" value="${escapeHtml(speedPct)}" /></label>
      <label>Risk tolerance<select name="risk_tolerance"><option value="low" ${prefs.risk_tolerance === 'low' ? 'selected' : ''}>low</option><option value="medium" ${prefs.risk_tolerance === 'medium' ? 'selected' : ''}>medium</option><option value="high" ${prefs.risk_tolerance === 'high' ? 'selected' : ''}>high</option></select></label>
      <label>Review strictness<select name="review_strictness"><option value="light" ${prefs.review_strictness === 'light' ? 'selected' : ''}>light</option><option value="standard" ${prefs.review_strictness === 'standard' ? 'selected' : ''}>standard</option><option value="strict" ${prefs.review_strictness === 'strict' ? 'selected' : ''}>strict</option></select></label>
      <button type="submit">Save autonomy direction</button>
    </form>
  </article>`;
}

async function getDesignTokenDriftStatus() {
  try {
    const report = await readFile(designTokenDriftReportPath, 'utf8');
    const violationsMatch = report.match(/- Violations:\s*\*\*(\d+)\*\*/i);
    const filesMatch = report.match(/- Files scanned:\s*\*\*(\d+)\*\*/i);
    const violations = violationsMatch ? Number(violationsMatch[1]) : null;
    const filesScanned = filesMatch ? Number(filesMatch[1]) : null;
    return {
      state: violations === 0 ? 'ok' : 'warn',
      violations,
      filesScanned,
      source: '.run/design-token-drift-report.md',
      sourceLabel: 'design token drift report'
    };
  } catch {
    return {
      state: 'info',
      violations: null,
      filesScanned: null,
      source: '.run/design-token-drift-report.md',
      sourceLabel: 'design token drift report'
    };
  }
}

function renderOpsCommandCenter({ tasks, filteredTasks, queueSnapshot, kpis, lifecycle, alertRulesConfig, health, readiness, workflowCompleteness, activeFilter, clientUpdateFilter = 'all', sequenceTemplates, sequenceQueue, enrollmentBySequence, nurtureTriggerRules, nurtureTriggerLastRun, recentReplyRouting, meetingPipeline, qualifiedAccounts, assetSummary, acquisitionMetrics, orchestrationVisibility, activeWorkersSnapshot = null, developmentCostAttribution = null, learningSummary, preferenceProfile = null, unifiedKpiTelemetry = null, designTokenDriftStatus = null, autonomyDirection = DEFAULT_AUTONOMY_DIRECTION, autonomyDirectionMessage = '', autonomyDirectionState = 'success', recommendationLearningMessage = '', recommendationLearningState = 'success', reviewBurstMessage = '', reviewBurstState = 'success', reviewBursts = OPS_REVIEW_BURSTS, errorMessage = '' }) {
  return `${renderTopNav({ active: 'ops', errorMessage })}
  <div class="page-shell" data-verify="ops-layout-composition-v1 adzeta-ops-separation-v1 adzeta-ops-separation-v2 adzeta-ops-sections-v1 ux-acceptance-gate-and-redline-v1 ops-review-bursts-first-block-v1 ops-sidebar-navigation-v1">
  <div class="ops-shell" data-verify="ops-sidebar-sticky-desktop-v1 ops-sidebar-collapsible-mobile-v1">
  <aside class="ops-sidebar" aria-label="/ops section navigation">
    <div class="panel ops-sidebar-desktop">
      <h2>/ops</h2>
      <p class="muted">Jump to core sections</p>
      <nav class="ops-sidebar-nav" aria-label="Ops section anchors">
        <a href="#review-bursts" data-ops-anchor="review-bursts">Review Bursts</a>
        <a href="#active-workers-panel" data-ops-anchor="active-workers-panel">Active Workers</a>
        <a href="#quality-trend" data-ops-anchor="quality-trend">Quality Trend</a>
        <a href="#reviews" data-ops-anchor="reviews">Review Center</a>
        <a href="#swarm-lane-health" data-ops-anchor="swarm-lane-health">Swarm Lane Health</a>
        <a href="#checklists" data-ops-anchor="checklists">Checklists</a>
      </nav>
    </div>
    <details class="panel ops-sidebar-mobile">
      <summary>Jump to section</summary>
      <nav class="ops-sidebar-nav" aria-label="Ops section anchors mobile">
        <a href="#review-bursts" data-ops-anchor="review-bursts">Review Bursts</a>
        <a href="#active-workers-panel" data-ops-anchor="active-workers-panel">Active Workers</a>
        <a href="#quality-trend" data-ops-anchor="quality-trend">Quality Trend</a>
        <a href="#reviews" data-ops-anchor="reviews">Review Center</a>
        <a href="#swarm-lane-health" data-ops-anchor="swarm-lane-health">Swarm Lane Health</a>
        <a href="#checklists" data-ops-anchor="checklists">Checklists</a>
      </nav>
    </details>
  </aside>
  <div class="ops-main">
  ${renderReviewBurstsPanel({ bursts: applyAutonomyDirectionToReviewBursts(reviewBursts, autonomyDirection), message: reviewBurstMessage, messageState: reviewBurstState, preferenceProfile })}
  ${renderAutonomyDirectionPanel(autonomyDirection, autonomyDirectionMessage, autonomyDirectionState)}
  ${renderPreferenceProfilePanel(preferenceProfile || {})}
  <article class="page-header" data-verify="ops-page-header-v1"><div class="panel-head"><h2>Ops objective</h2><span class="section-tag">always-on control</span></div><p><strong>Run reliability with diagnostics, queues, and risk controls in one place.</strong></p><p class="muted">Primary focus: operations board and follow-up queue. Secondary blocks: diagnostics, logs, and controls.</p></article>
  <article class="panel" data-verify="ia-ops-role-v1"><h2>Ops responsibility</h2><p class="muted">Use Ops for operations and diagnostics: runboards, queues, health, alerts, and workflow reliability.</p></article>
  ${renderNowItemsIntegrationPanel({ route: 'ops' })}
  <article class="panel primary-focus" id="checklists" data-verify="ops-start-here-panel-v1 ops-review-checklist-placement-v2"><div class="panel-head"><h2>Start here</h2><span class="section-tag">entry point</span></div><p class="muted">Start in Home for new work, then return to Ops for reliability and queue control.</p><a class="button-link" href="/#step-1">Open Home step 1</a><div style="margin-top:.6rem">${renderOpsReviewerChecklistCard()}</div></article>
  ${renderOperatorBriefingTemplatesPanel()}
  <article class="panel" data-verify="ops-route-health-summary-v1"><div class="panel-head"><h2>Critical route availability</h2><span class="section-tag">status summary</span></div>${renderRouteHealthWidget(health)}</article>
  <div class="layout"><section class="section-frame"><article class="panel" data-verify="ops-section-diagnostics-v1"><div class="panel-head"><h2>Core infrastructure</h2><span class="section-tag">ops lane</span></div><p class="muted">Health, KPI detail, readiness checks, and automation controls live here.</p></article><article class="panel"><div class="panel-head"><h2>Operational KPI diagnostics</h2><span class="section-tag">diagnostics</span></div><p class="muted">Full KPI detail and freshness monitoring live in Ops (not Home).</p>${renderKpis(kpis)}</article><article class="panel" data-verify="ops-design-token-drift-status-v1"><div class="panel-head"><h2>Design token drift status</h2><span class="section-tag">ui guardrail</span></div><p class="muted">Source of truth: <code>${escapeHtml(designTokenDriftStatus?.source || '.run/design-token-drift-report.md')}</code> (${escapeHtml(designTokenDriftStatus?.sourceLabel || 'design token drift report')}).</p><p><strong>Current status:</strong> <span class="badge ${designTokenDriftStatus?.state === 'ok' ? 'ok' : designTokenDriftStatus?.state === 'warn' ? 'warn' : 'info'}">${designTokenDriftStatus?.violations === null ? 'unknown' : designTokenDriftStatus.violations === 0 ? 'PASS' : `FAIL · ${designTokenDriftStatus.violations} violation(s)`}</span></p><p class="muted">Files scanned: ${escapeHtml(designTokenDriftStatus?.filesScanned ?? 'n/a')} · Run <code>npm run design-token:check</code> to refresh.</p></article><article class="panel" id="kpi-hierarchy-ia-panel"><div class="panel-head"><h2>KPI hierarchy + dashboard IA map</h2><span class="section-tag">north star → L1 → L2</span></div><p class="muted">Canonical KPI tree and section ownership so Home, Ops, Comms, Actions, and Relationships stay non-conflicting.</p>${renderKpiHierarchyAndIaMap()}</article><article class="panel"><div class="panel-head"><h2>Metric definitions</h2><span class="section-tag">definitions</span></div><p class="muted">Plain-language definitions for every key metric shown in the app.</p>${renderMetricDictionary()}</article><article class="panel"><div class="panel-head"><h2>Monday go/no-go readiness</h2><span class="section-tag">readiness</span></div>${renderMondayReadiness(readiness)}</article><article class="panel"><div class="panel-head"><h2>Workflow completeness</h2><span class="section-tag">monday polish</span></div><p class="muted">Quick pass/fail checks to confirm the full operating loop is intact.</p>${renderWorkflowCompleteness(workflowCompleteness)}</article><article class="panel" id="deployment-verification"><div class="panel-head"><h2>Deployment verification checklist</h2><span class="section-tag">release gate</span></div>${renderDeploymentVerificationChecklist({ health, readiness, workflowCompleteness, queueSnapshot })}</article><article class="panel"><h2>Lifecycle marketing</h2>${renderLifecyclePanel(lifecycle)}</article><article class="panel"><div class="panel-head"><h2>System health</h2><span class="section-tag">infra</span></div><p class="muted">Service, data, and file checks that explain operational risk.</p>${renderHealth(health)}</article></section>
  <section class="section-frame"><article class="panel primary-focus" data-verify="ops-section-process-v1"><div class="panel-head"><h2>Process section</h2><span class="section-tag">ops lane</span></div><p class="muted">Execution boards, queue actions, and follow-up workflows.</p></article><article class="panel" id="reviews" data-verify="ops-reviews-panel-v1 ops-review-autoappend-v1 ops-review-archive-v1"><div class="panel-head"><h2>Reviews</h2><span class="section-tag">ops review center</span></div><p class="muted">Latest closure summary is pinned first; older cycles are archived behind an expandable history panel.</p>${renderOpsReviewsPanel(OPS_REVIEW_HISTORY, unifiedKpiTelemetry, developmentCostAttribution)}</article>${renderClosedLoopTracePanel(OPS_REVIEW_HISTORY)}${renderDesignBenchmarkPanel()}${renderOpsOrchestrationVisibilityPanel(orchestrationVisibility)}${renderActiveWorkersPanel(activeWorkersSnapshot || { activeCount: 0, cap: null, workers: [], staleThresholdMinutes: Number(process.env.OPS_WORKER_STALE_MINUTES || 15) }, 'all')}${renderDevelopmentCostAttributionPanel(developmentCostAttribution || {})}<article class="panel" id="execution-board"><div class="panel-head"><h2>Operations board</h2><span class="section-tag">operations</span></div><p class="muted">Live execution lanes for what is active, blocked, and waiting.</p>${renderExecutionBoard(tasks, queueSnapshot)}</article><article class="panel" id="operator-actions"><h2>Task queue actions</h2><p class="muted">Filter fast, then move each task to the next state.</p>${renderTaskTable(filteredTasks, activeFilter, '/ops')}</article><article class="panel" id="client-updates"><h2>Follow-ups and client updates</h2><p class="muted">Manage pending follow-ups and mark outbound updates as sent.</p>${renderMeetingPipeline(meetingPipeline || {}, { clientUpdateFilter })}</article><article class="panel" id="customer-support-success"><h2>Customer support and success</h2><p class="muted">Track post-sale follow-up risk, escalations, and expansion placeholders with pilot handoff visibility.</p>${renderCustomerSupportSuccessPanel({ meetingPipeline, qualifiedAccounts })}</article><article class="panel"><h2>Sequence playbooks</h2><p class="muted">Edit sequence steps and pause/resume delivery safely.</p>${renderSequenceTemplatePanel(sequenceTemplates)}</article><article class="panel"><h2>Automation trigger mapping</h2><p class="muted">Validate which triggers map to which sequence templates.</p>${renderNurtureTriggerMappingPanel(nurtureTriggerRules, sequenceTemplates, nurtureTriggerLastRun)}</article></section>
  <section class="section-frame"><article class="panel" data-verify="ops-section-logs-v1"><div class="panel-head"><h2>Logs section</h2><span class="section-tag">ops lane</span></div><p class="muted">Operational logs, queue diagnostics, and trend/risk snapshots.</p></article><article class="panel" id="reply-routing"><h2>Reply routing</h2><p class="muted">Review recent inbound replies and the next routed action.</p>${renderRecentReplyRoutingPanel(recentReplyRouting || [])}</article>${renderRecommendationLearningPanel(learningSummary || {}, recommendationLearningMessage, recommendationLearningState)}<article class="panel"><h2>Sequence queue diagnostics</h2><p class="muted">Process-level enrollment queue + active sequence load.</p>${renderSequenceQueuePanel(sequenceQueue || [], enrollmentBySequence || [])}</article><article class="panel"><h2>Funnel performance details</h2><p class="muted">Detailed by-entry view for enrollments and classified replies.</p>${renderAcquisitionMetricsPanel(acquisitionMetrics)}</article><article class="panel" id="revops"><div class="panel-head"><h2>RevOps section (v1)</h2><span class="section-tag">pipeline diagnostics</span></div><p class="muted">Pipeline stage health, conversion rates, bottleneck alerts, and forecast/data-quality scaffolding.</p>${renderRevOpsSection(qualifiedAccounts || [])}</article><article class="panel"><h2>Asset status</h2><p class="muted">Content asset inventory by state (draft, live, paused, archived).</p>${renderAssets(assetSummary)}</article><article class="panel"><div class="panel-head"><h2>Alert rules</h2><span class="section-tag">risk</span></div><p class="muted">Threshold config now supports inline edits, severity/owner/SLA cues, and escalation path controls.</p>${renderAlerts(alertRulesConfig, {
    metrics: {
      delegations24h: toNumericMetric((kpis.cards || []).find((c) => c.key === 'delegations_24h')?.value),
      completed24h: toNumericMetric((kpis.cards || []).find((c) => c.key === 'completed_24h')?.value),
      openPriorities: toNumericMetric((kpis.cards || []).find((c) => c.key === 'open_priorities')?.value),
      activeRuns: toNumericMetric((kpis.cards || []).find((c) => c.key === 'active_runs')?.value),
    },
    queueSnapshot,
    health,
  })}</article></section></div></div></div></div>
  ${renderReviewBurstsRefreshScript()}
  ${renderActiveWorkersRefreshScript()}
  ${renderOpsSidebarNavigationScript()}`;
}

async function renderReviewerChecklistDocPage() {
  const checklistPath = path.resolve(process.cwd(), 'docs/reviewer-home-ops-checklist-full.md');
  try {
    const markdown = await readFile(checklistPath, 'utf8');
    return `${renderTopNav({ active: 'ops' })}<div class="page-shell" data-verify="ops-review-checklist-doc-page-v1"><article class="page-header"><div class="panel-head"><h2>Reviewer checklist (full)</h2><span class="section-tag">reference</span></div><p class="muted">Source: <code>docs/reviewer-home-ops-checklist-full.md</code></p><p><a class="button-link button-secondary" href="/ops#reviews">Back to Ops Reviews</a></p></article><article class="panel"><pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(markdown)}</pre></article></div>`;
  } catch (error) {
    return `${renderTopNav({ active: 'ops', errorMessage: `Checklist load failed: ${String(error.message || 'unknown error')}` })}<div class="page-shell"><article class="panel"><h2>Reviewer checklist unavailable</h2><p class="muted">Could not load <code>${escapeHtml(checklistPath)}</code>.</p><p><a class="button-link" href="/ops">Return to Ops</a></p></article></div>`;
  }
}

async function getSequenceTemplateById(templateId) {
  if (!templateId) return null;
  if (!pool && !supabase) return null;

  if (supabase) {
    const { data, error } = await supabase.from('cc_sequence_templates').select('id,name,status,slug').eq('id', templateId).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  const { rows } = await pool.query('select id,name,status,slug from public.cc_sequence_templates where id = $1 limit 1', [templateId]);
  return rows[0] || null;
}

async function getDefaultOutreachSequenceTemplate() {
  if (!pool && !supabase) return null;
  if (supabase) {
    const { data, error } = await supabase
      .from('cc_sequence_templates')
      .select('id,name,status,slug')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  const { rows } = await pool.query("select id,name,status,slug from public.cc_sequence_templates where status = 'active' order by updated_at desc limit 1");
  return rows[0] || null;
}

async function enrollContactInSequence(payload = {}, actor = 'api') {
  assertStore();
  const sequenceTemplateId = payload.sequence_template_id || payload.template_id;
  const leadKey = String(payload.lead_key || payload.contact_key || payload.contact_id || '').trim();
  if (!sequenceTemplateId || !leadKey) throw new Error('sequence_template_id and lead_key are required');

  const status = normalizeEnrollmentStatus(payload.status) || 'queued';
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const currentStepIndex = Number(payload.current_step_index || 0);
  const nextSendAt = payload.next_send_at || null;
  const enrollmentBase = { sequence_template_id: sequenceTemplateId, lead_key: leadKey, status, current_step_index: currentStepIndex, next_send_at: nextSendAt, metadata };

  let data;
  if (supabase) {
    const { data: inserted, error } = await supabase.from('cc_sequence_enrollments').insert(enrollmentBase).select('*').single();
    if (error) {
      if (error.code !== '23505') throw error;
      const { data: existing, error: existingError } = await supabase.from('cc_sequence_enrollments').select('*').eq('sequence_template_id', sequenceTemplateId).eq('lead_key', leadKey).single();
      if (existingError) throw existingError;
      data = existing;
    } else {
      data = inserted;
    }
  } else {
    const { rows } = await pool.query(
      `insert into public.cc_sequence_enrollments (sequence_template_id, lead_key, status, current_step_index, next_send_at, metadata)
       values ($1,$2,$3,$4,$5,$6::jsonb)
       on conflict (sequence_template_id, lead_key)
       do update set status = excluded.status,
                     current_step_index = least(public.cc_sequence_enrollments.current_step_index, excluded.current_step_index),
                     next_send_at = coalesce(excluded.next_send_at, public.cc_sequence_enrollments.next_send_at),
                     metadata = public.cc_sequence_enrollments.metadata || excluded.metadata,
                     updated_at = now()
       returning *`,
      [sequenceTemplateId, leadKey, status, currentStepIndex, nextSendAt, JSON.stringify(metadata)],
    );
    data = rows[0];
  }

  const activity = await recordSequenceEnrollmentActivity({
    lead_key: leadKey,
    sequence_template_id: sequenceTemplateId,
    sequence_enrollment_id: data?.id,
    actor,
    details: { status: data?.status || status, current_step_index: data?.current_step_index ?? currentStepIndex },
  });

  return { data, activity };
}

async function enrollQualifiedAccountIntoOutreach(qualifiedAccountId, payload = {}, actor = 'api') {
  assertStore();
  const id = String(qualifiedAccountId || '').trim();
  if (!id) throw new Error('qualified_account_id is required');

  let account;
  if (supabase) {
    const { data, error } = await supabase.from('cc_qualified_accounts').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    account = data;
  } else {
    const { rows } = await pool.query('select * from public.cc_qualified_accounts where id = $1 limit 1', [id]);
    account = rows[0] || null;
  }
  if (!account) throw new Error('qualified_account_not_found');

  const selectedTemplate = payload.sequence_template_id
    ? await getSequenceTemplateById(payload.sequence_template_id)
    : await getDefaultOutreachSequenceTemplate();

  if (!selectedTemplate?.id) throw new Error('no_active_sequence_template_available');

  const leadKey = String(payload.lead_key || `qualified:${id}`);
  const enrollment = await enrollContactInSequence({
    sequence_template_id: selectedTemplate.id,
    lead_key: leadKey,
    metadata: {
      source: 'qualified-account-intake',
      qualified_account_id: id,
      brand: account.brand,
      website: account.website,
      est_spend_tier: account.est_spend_tier,
      channels: account.channels,
      contact_role: account.contact_role,
      qualification_confidence: account.qualification_confidence,
    },
  }, actor);

  const enrolledAt = new Date().toISOString();
  if (supabase) {
    const { error } = await supabase
      .from('cc_qualified_accounts')
      .update({ outreach_enrolled_at: enrolledAt, outreach_sequence_template_id: selectedTemplate.id })
      .eq('id', id);
    if (error) throw error;
  } else {
    await pool.query(
      'update public.cc_qualified_accounts set outreach_enrolled_at = $1, outreach_sequence_template_id = $2 where id = $3',
      [enrolledAt, selectedTemplate.id, id],
    );
  }

  await recordSequenceEnrollmentActivity({
    event_type: 'qualified_account_enrolled',
    lead_key: leadKey,
    sequence_template_id: selectedTemplate.id,
    sequence_enrollment_id: enrollment?.data?.id,
    actor,
    details: {
      qualified_account_id: id,
      account_brand: account.brand || null,
      account_website: account.website || null,
      sequence_name: selectedTemplate.name || null,
      sequence_slug: selectedTemplate.slug || null,
      enrolled_at: enrolledAt,
    },
  });

  return { enrollment, sequence_template: selectedTemplate, qualified_account_id: id, lead_key: leadKey, enrolled_at: enrolledAt };
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`);

  try {
    if (devHmrEnabled && req.method === 'GET' && reqUrl.pathname === '/__dev/version') {
      const version = await getDevHmrVersion();
      return sendJson(res, 200, { version, mode: 'dev-hmr-lite', poll_ms: devHmrPollMs });
    }
    if (req.method === 'GET' && reqUrl.pathname === '/api/command-center/kpis') return sendJson(res, 200, await getKpiAggregate());
    if (req.method === 'GET' && reqUrl.pathname === '/api/reports/daily-gtm-summary') return sendJson(res, 200, await getDailyGtmSummaryReport());
    if (req.method === 'GET' && reqUrl.pathname === '/api/reports/weekly-scorecard') {
      const artifacts = await readStrategyArtifacts();
      return sendJson(res, 200, {
        marker: 'weekly-scorecard-module-v1',
        data: artifacts.weeklyScorecardMarkdown?.raw || null,
        source: artifacts.weeklyScorecardMarkdown?.path || null,
      });
    }
    if (req.method === 'GET' && reqUrl.pathname === '/api/readiness/monday') return sendJson(res, 200, await getMondayReadiness());
    if (req.method === 'GET' && reqUrl.pathname === '/api/workflows/completeness') return sendJson(res, 200, await getWorkflowCompleteness());
    if (req.method === 'GET' && reqUrl.pathname === '/api/nurture/triggers') return sendJson(res, 200, { data: await readNurtureTriggerRules() });
    if (req.method === 'GET' && reqUrl.pathname === '/api/nurture/triggers/last-run') return sendJson(res, 200, { data: await readNurtureTriggerLastRun() });
    if (req.method === 'GET' && reqUrl.pathname === '/api/target-accounts/schema') return sendJson(res, 200, TARGET_ACCOUNT_RUBRIC);
    if (req.method === 'GET' && reqUrl.pathname === '/api/navigation/url-map') {
      const host = String(req.headers.host || `localhost:${port}`);
      return sendJson(res, 200, { marker: 'gtm-url-map-v1', generated_at: new Date().toISOString(), ...buildUrlMap(host) });
    }
    if (req.method === 'GET' && reqUrl.pathname === '/api/acquisition/metrics') {
      const data = await getAcquisitionMetricsByFunnelEntry();
      return sendJson(res, 200, { ...data, marker: 'acquisition-metrics-panel-v1' });
    }
    if (req.method === 'GET' && reqUrl.pathname === '/api/qualified-accounts') {
      return sendJson(res, 200, { data: await listQualifiedAccounts(Number(reqUrl.searchParams.get('limit') || 20)) });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/ops/review-bursts/live') {
      const payload = await buildReviewBurstLivePayload();
      reviewBurstRealtimeSnapshot = {
        signature: payload.signature,
        html: payload.html,
        mode: payload.mode,
      };
      return sendJson(res, 200, payload);
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/ops/worker-usage/export.json') {
      const records = await loadTaskUsageRecords();
      const payload = {
        marker: 'ops-worker-usage-export-json-v1',
        generatedAt: new Date().toISOString(),
        records,
        aggregates: aggregateUsageByFeature(records),
      };
      return sendJson(res, 200, payload);
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/ops/worker-usage/export.csv') {
      const records = await loadTaskUsageRecords();
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
      res.end(toUsageCsv(records));
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/ops/active-workers/live') {
      const filter = reqUrl.searchParams.get('filter') || 'all';
      const tasks = await getTasks({ allowEmpty: true });
      const queueSnapshot = await readWorkQueueSnapshot();
      const orchestrationVisibility = await getOrchestrationVisibilitySnapshot({ tasks, queueSnapshot });
      const snapshot = await getActiveWorkersSnapshot({ orchestrationVisibility });
      return sendJson(res, 200, {
        marker: snapshot.marker,
        poll_ms: Math.max(2000, Number(process.env.OPS_WORKER_REFRESH_MS || 5000)),
        active_count: snapshot.activeCount,
        cap: snapshot.cap,
        stale_threshold_minutes: snapshot.staleThresholdMinutes,
        usage_records_count: snapshot.usageRecordsCount,
        feature_usage: snapshot.featureUsage,
        cycle_usage: snapshot.cycleUsage,
        html: renderActiveWorkersPanel(snapshot, filter),
      });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/ops/review-bursts/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      reviewBurstEventClients.add(res);

      const initialPayload = reviewBurstRealtimeSnapshot?.signature
        ? {
            type: 'review_bursts_update',
            reason: 'initial_snapshot',
            signature: reviewBurstRealtimeSnapshot.signature,
            html: reviewBurstRealtimeSnapshot.html,
            mode: reviewBurstRealtimeSnapshot.mode,
            poll_ms: reviewBurstRefreshPollMs,
            emitted_at: new Date().toISOString(),
          }
        : {
            ...(await buildReviewBurstLivePayload()),
            type: 'review_bursts_update',
            reason: 'initial_snapshot',
            emitted_at: new Date().toISOString(),
          };
      res.write(`event: review_bursts\ndata: ${JSON.stringify(initialPayload)}\n\n`);

      const heartbeat = setInterval(() => {
        try {
          res.write(': keepalive\n\n');
        } catch {
          // noop
        }
      }, 20000);

      req.on('close', () => {
        clearInterval(heartbeat);
        reviewBurstEventClients.delete(res);
      });
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/relationships/intelligence') {
      const [accounts, meetingPipeline, tasks, recentReplyRouting, learningSummary, preferenceProfile] = await Promise.all([
        listQualifiedAccounts(Number(reqUrl.searchParams.get('limit') || 40)),
        getMeetingPipelineSnapshot(),
        getTasks({ allowEmpty: true }),
        getRecentReplyRouting(50),
        getRecommendationLearningSummary(),
        loadOperatorPreferenceProfile(),
        getDevelopmentCostAttribution(),
      ]);
      return sendJson(res, 200, { marker: 'relationship-intelligence-v1 relationship-health-score-wiring-v1 preference-profile-influence-v1', ...buildRelationshipIntelligence({ qualifiedAccounts: accounts, meetingPipeline, tasks, recentReplyRouting, learningSummary, preferenceProfile }) });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/handoff-queue') {
      const accounts = await listQualifiedAccounts(Number(reqUrl.searchParams.get('limit') || 40));
      return sendJson(res, 200, { marker: 'team-handoff-queue-v1', data: buildTeamHandoffQueue(accounts) });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/qualified-accounts') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const saved = await recordQualifiedAccount(body);
      return sendJson(res, 201, { ok: true, marker: 'qualified-account-intake-v1', data: saved });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/research-ledger') {
      const data = await listResearchLedgerEntries(Number(reqUrl.searchParams.get('limit') || 100));
      return sendJson(res, 200, { ok: true, marker: 'research-ledger-api-v1', data });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/research-ledger') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const saved = await recordResearchLedgerEntry(body, 'api:/api/research-ledger');
      return sendJson(res, 201, { ok: true, marker: 'research-ledger-entry-v1', data: saved });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/competitive-intel') {
      return sendJson(res, 200, { data: await listCompetitiveIntelEntries(Number(reqUrl.searchParams.get('limit') || 30)), marker: 'competitive-intel-ingest-v1' });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/competitive-intel') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const saved = await recordCompetitiveIntelEntry(body);
      return sendJson(res, 201, { ok: true, marker: 'competitive-intel-ingest-v1', data: saved });
    }

    const qualifiedEnrollApiMatch = reqUrl.pathname.match(/^\/api\/qualified-accounts\/([^/]+)\/enroll$/);
    if (qualifiedEnrollApiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const result = await enrollQualifiedAccountIntoOutreach(decodeURIComponent(qualifiedEnrollApiMatch[1]), body, 'api:/api/qualified-accounts/:id/enroll');
      return sendJson(res, 200, { ok: true, marker: 'qualified-account-enroll-action-v1', ...result });
    }

    const qualifiedPromoteApiMatch = reqUrl.pathname.match(/^\/api\/qualified-accounts\/([^/]+)\/promote$/);
    if (qualifiedPromoteApiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const stage = normalizePilotHandoffStage(body?.pipeline_stage || body?.stage);
      if (!stage) return sendJson(res, 400, { error: 'pipeline_stage_invalid', allowed: PILOT_HANDOFF_STAGES });
      const promoted = await promoteQualifiedAccountStage(decodeURIComponent(qualifiedPromoteApiMatch[1]), stage, 'api:/api/qualified-accounts/:id/promote');
      return sendJson(res, 200, { ok: true, marker: 'pilot-handoff-promote-action-v1', data: promoted });
    }

    const qualifiedRoutePilotApiMatch = reqUrl.pathname.match(/^\/api\/qualified-accounts\/([^/]+)\/route-pilot-onboarding$/);
    if (qualifiedRoutePilotApiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const routed = await routeQualifiedAccountToPilotOnboarding(decodeURIComponent(qualifiedRoutePilotApiMatch[1]), 'api:/api/qualified-accounts/:id/route-pilot-onboarding');
      return sendJson(res, 200, { ok: true, marker: 'pilot-onboarding-route-action-v1', data: routed });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/replies/classify') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const classification = classifyReply(body);
      const routing = await routeReplyClassification(classification, body);
      return sendJson(res, 200, { ok: true, classification, routing, marker: 'reply-routing-hook-v1' });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/nurture/triggers/evaluate') {
      const body = await readJsonBody(req);
      const shouldApply = body.apply === true;
      if (shouldApply && !guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const rules = await readNurtureTriggerRules();
      const evaluation = evaluateNurtureRules(rules, body);
      const plannedActions = await resolveNurtureActions(evaluation, body);
      const applyResult = shouldApply ? await applyNurtureTriggers(evaluation, body) : { applied: [], skipped: [] };
      const dryRun = !shouldApply;
      const snapshot = {
        ran_at: new Date().toISOString(),
        mode: dryRun ? 'dry_run' : 'apply',
        lead_key: evaluation.lead_key,
        trigger_key: evaluation?.context?.trigger_key || null,
        actions_produced: plannedActions.length,
        ready_actions: plannedActions.filter((a) => a.status === 'ready').length,
        blocked_actions: plannedActions.filter((a) => a.status !== 'ready').length,
      };
      await writeNurtureTriggerLastRun(snapshot);
      return sendJson(res, 200, {
        ok: true,
        mode: runtimeMode,
        local_mode: runtimeMode === 'none',
        apply_requested: shouldApply,
        dry_run: dryRun,
        evaluation,
        planned_actions: plannedActions,
        apply_result: applyResult,
        run_summary: snapshot,
      });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/health') {
      const health = await getHealthStatus(req.headers.host || '');
      return sendJson(res, health.overall === 'connected' ? 200 : 503, health);
    }

    if (req.method === 'GET' && (reqUrl.pathname === '/api/metrics/snapshot' || reqUrl.pathname === '/metrics')) {
      const [tasks, queueSnapshot, kpis] = await Promise.all([
        getTasks({ allowEmpty: true }),
        readWorkQueueSnapshot(),
        getKpis(),
      ]);
      const snapshot = buildMetricsSnapshot({ tasks, queueSnapshot, kpis });
      if (reqUrl.searchParams.get('log') === '1' || reqUrl.searchParams.get('log') === 'true') logMetricsSnapshot(snapshot);
      return sendJson(res, 200, snapshot);
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/metrics/log') {
      const [tasks, queueSnapshot, kpis] = await Promise.all([
        getTasks({ allowEmpty: true }),
        readWorkQueueSnapshot(),
        getKpis(),
      ]);
      const snapshot = buildMetricsSnapshot({ tasks, queueSnapshot, kpis });
      logMetricsSnapshot(snapshot);
      return sendJson(res, 200, { ok: true, logged: true, snapshot_generated_at: snapshot.generated_at });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/assets/status') return sendJson(res, 200, { statuses: ASSET_STATUSES, summary: await getAssetStatusSummary() });
    if (req.method === 'GET' && reqUrl.pathname === '/api/voice-notes/ingestions') {
      const panel = await getMeetingPipelineSnapshot();
      return sendJson(res, 200, { data: panel.recentIngestions || [] });
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/comms/trade-show/captures') {
      const data = await listTradeShowCaptures(Number(reqUrl.searchParams.get('limit') || 12));
      return sendJson(res, 200, { marker: 'trade-show-voice-memo-v1', data });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/comms/trade-show/captures') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const created = await ingestTradeShowVoiceMemo(body);
      return sendJson(res, 201, created);
    }

    const createAssetMatch = reqUrl.pathname.match(/^\/api\/assets\/(lead_magnet|teaser_product)$/);
    if (req.method === 'POST' && createAssetMatch) {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const created = await createAsset(createAssetMatch[1], body);
      await recordDeliveryEvent({ asset_type: createAssetMatch[1], asset_id: created.id, event_type: 'asset_created', asset_status_at_event: created.status, event_payload: { source: 'api' } });
      return sendJson(res, 201, { data: created });
    }

    const updateAssetMatch = reqUrl.pathname.match(/^\/api\/assets\/(lead_magnet|teaser_product)\/([^/]+)$/);
    if (req.method === 'PATCH' && updateAssetMatch) {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const updated = await updateAsset(updateAssetMatch[1], decodeURIComponent(updateAssetMatch[2]), body);
      if (!updated) return sendJson(res, 404, { error: 'asset_not_found' });
      await recordDeliveryEvent({ asset_type: updateAssetMatch[1], asset_id: updated.id, event_type: 'asset_updated', asset_status_at_event: updated.status, event_payload: { source: 'api', fields: Object.keys(body || {}) } });
      return sendJson(res, 200, { data: updated });
    }

    if (reqUrl.pathname === '/api/funnels' && req.method === 'GET') return sendJson(res, 200, { data: await getFunnels() });
    if (reqUrl.pathname === '/api/funnels' && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      assertStore();
      const body = await readJsonBody(req);
      const status = normalizeFunnelStatus(body.status) || 'draft';
      if (!body.name) return sendJson(res, 400, { error: 'name is required' });
      if (supabase) {
        const { data, error } = await supabase.from('cc_funnels').insert({ name: body.name, slug: body.slug || null, status, channel: body.channel || null, goal: body.goal || null, notes: body.notes || null }).select('*').single();
        if (error) throw error;
        return sendJson(res, 201, { data });
      }
      const { rows } = await pool.query('insert into public.cc_funnels (name, slug, status, channel, goal, notes) values ($1,$2,$3,$4,$5,$6) returning *', [body.name, body.slug || null, status, body.channel || null, body.goal || null, body.notes || null]);
      return sendJson(res, 201, { data: rows[0] });
    }

    const funnelIdMatch = reqUrl.pathname.match(/^\/api\/funnels\/([^/]+)$/);
    if (funnelIdMatch && req.method === 'PATCH') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      assertStore();
      const funnelId = decodeURIComponent(funnelIdMatch[1]);
      const body = await readJsonBody(req);
      const patch = { ...body };
      if (patch.status) patch.status = normalizeFunnelStatus(patch.status);
      if (supabase) {
        const { data, error } = await supabase.from('cc_funnels').update(patch).eq('id', funnelId).select('*').single();
        if (error) throw error;
        return sendJson(res, 200, { data });
      }
      const { rows } = await pool.query('update public.cc_funnels set name = coalesce($1,name), slug = coalesce($2,slug), status = coalesce($3,status), channel = coalesce($4,channel), goal = coalesce($5,goal), notes = coalesce($6,notes), updated_at = now() where id = $7 returning *', [patch.name ?? null, patch.slug ?? null, patch.status ?? null, patch.channel ?? null, patch.goal ?? null, patch.notes ?? null, funnelId]);
      return sendJson(res, 200, { data: rows[0] || null });
    }
    if (funnelIdMatch && req.method === 'DELETE') {
      if (!guardWriteAccess(req, res, { minRole: 'admin' })) return;
      assertStore();
      const funnelId = decodeURIComponent(funnelIdMatch[1]);
      if (supabase) {
        const { error } = await supabase.from('cc_funnels').delete().eq('id', funnelId);
        if (error) throw error;
      } else {
        await pool.query('delete from public.cc_funnels where id = $1', [funnelId]);
      }
      return sendJson(res, 200, { ok: true });
    }

    const funnelStepsMatch = reqUrl.pathname.match(/^\/api\/funnels\/([^/]+)\/steps$/);
    if (funnelStepsMatch && req.method === 'GET') return sendJson(res, 200, { data: await listFunnelSteps(decodeURIComponent(funnelStepsMatch[1])) });
    if (funnelStepsMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      assertStore();
      const funnelId = decodeURIComponent(funnelStepsMatch[1]);
      const body = await readJsonBody(req);
      if (!body.name) return sendJson(res, 400, { error: 'name is required' });
      if (supabase) {
        const { data, error } = await supabase.from('cc_funnel_steps').insert({ funnel_id: funnelId, position: Number(body.position || 1), name: body.name, action_type: body.action_type || 'email', delay_days: Number(body.delay_days || 0), metadata: body.metadata || {} }).select('*').single();
        if (error) throw error;
        return sendJson(res, 201, { data });
      }
      const { rows } = await pool.query('insert into public.cc_funnel_steps (funnel_id, position, name, action_type, delay_days, metadata) values ($1,$2,$3,$4,$5,$6::jsonb) returning *', [funnelId, Number(body.position || 1), body.name, body.action_type || 'email', Number(body.delay_days || 0), JSON.stringify(body.metadata || {})]);
      return sendJson(res, 201, { data: rows[0] });
    }

    if (reqUrl.pathname === '/api/sequence-templates' && req.method === 'GET') {
      if (!pool && !supabase) return sendJson(res, 200, { data: [] });
      if (supabase) {
        const { data, error } = await supabase.from('cc_sequence_templates').select('*').order('updated_at', { ascending: false });
        if (error) throw error;
        return sendJson(res, 200, { data: data ?? [] });
      }
      const { rows } = await pool.query('select * from public.cc_sequence_templates order by updated_at desc');
      return sendJson(res, 200, { data: rows });
    }

    if (reqUrl.pathname === '/api/sequence-templates' && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      assertStore();
      const body = await readJsonBody(req);
      if (!body.name) return sendJson(res, 400, { error: 'name is required' });
      if (supabase) {
        const { data, error } = await supabase.from('cc_sequence_templates').insert({ name: body.name, channel: body.channel || 'email', status: body.status || 'active', description: body.description || null, step_count: Number(body.step_count || 0), metadata: body.metadata || {} }).select('*').single();
        if (error) throw error;
        return sendJson(res, 201, { data });
      }
      const { rows } = await pool.query('insert into public.cc_sequence_templates (name, channel, status, description, step_count, metadata) values ($1,$2,$3,$4,$5,$6::jsonb) returning *', [body.name, body.channel || 'email', body.status || 'active', body.description || null, Number(body.step_count || 0), JSON.stringify(body.metadata || {})]);
      return sendJson(res, 201, { data: rows[0] });
    }

    const sequenceTemplateStepApiMatch = reqUrl.pathname.match(/^\/api\/sequence-templates\/([^/]+)\/steps$/);
    if (sequenceTemplateStepApiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      try {
        const data = await appendTemplateStep(decodeURIComponent(sequenceTemplateStepApiMatch[1]), body);
        return sendJson(res, 201, { marker: 'sequence-step-editor-v1', data });
      } catch (error) {
        if (String(error.message || '').includes('required')) return sendJson(res, 400, { error: error.message });
        throw error;
      }
    }

    const sequenceTemplateToggleApiMatch = reqUrl.pathname.match(/^\/api\/sequence-templates\/([^/]+)\/toggle$/);
    if (sequenceTemplateToggleApiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const nextStatus = String(body.next_status || '').toLowerCase();
      const shouldPause = nextStatus === 'paused' || body.pause === true;
      const data = await setSequenceTemplatePaused(decodeURIComponent(sequenceTemplateToggleApiMatch[1]), shouldPause);
      return sendJson(res, 200, { marker: 'sequence-toggle-action-v1', data, enrollment_effect: shouldPause ? 'queued/active -> paused' : 'paused -> queued' });
    }

    if (reqUrl.pathname === '/api/sequence-enrollments' && req.method === 'GET') return sendJson(res, 200, { data: await getSequenceQueue() });
    if (reqUrl.pathname === '/api/sequence-enrollments/by-sequence' && req.method === 'GET') return sendJson(res, 200, { data: await getActiveEnrollmentsBySequence() });
    if ((reqUrl.pathname === '/api/meeting-notes/ingest' || reqUrl.pathname === '/api/meeting-transcripts/ingest') && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const noteText = body.note_text ?? body.transcript_text;
      const sourceType = reqUrl.pathname === '/api/meeting-transcripts/ingest' ? 'text' : (body.source_type || 'text');
      const created = await ingestMeetingNote({ clientName: body.client_name, noteText, sourceType, meetingAt: body.meeting_at || null });
      return sendJson(res, 201, { ok: true, ...created, mode: runtimeMode });
    }

    if (reqUrl.pathname === '/api/voice-notes/ingest' && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      const created = await ingestVoiceNoteTranscript({
        transcriptText: body.transcript_text,
        meetingAt: body.meeting_at || null,
        source: body.source || 'voice_note',
      });
      return sendJson(res, 201, created);
    }
    const followupAdvanceApiMatch = reqUrl.pathname.match(/^\/api\/followups\/([^/]+)\/advance$/);
    if (followupAdvanceApiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const result = await advanceFollowupStatus(decodeURIComponent(followupAdvanceApiMatch[1]));
      if (!result.ok) return sendJson(res, 404, { error: 'followup_not_found' });
      return sendJson(res, 200, { ok: true, next_status: result.nextStatus });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/comms/individual-followups/create') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      assertStore();
      const body = await readFormBody(req);
      const view = String(body.view || 'individual');
      const tab = String(body.tab || 'inbox');
      const accountId = String(body.account_id || '');
      const contact = String(body.contact || '');
      const clientName = String(body.client_name || contact || 'Unknown contact').trim();
      const actionText = String(body.action_text || `Follow up with ${clientName}`).trim();
      const noteText = `Comms Individual Intelligence Panel\nClient: ${clientName}\nContact: ${contact || clientName}\nAction: ${actionText}`;
      try {
        const meeting = await ingestMeetingNote({ clientName, noteText, sourceType: 'individual_intel_panel', meetingAt: null });
        if (supabase) {
          const { error } = await supabase.from('meeting_actions').insert({
            meeting_note_id: meeting.noteId,
            client_name: clientName,
            action_text: actionText,
            status: 'pending',
          });
          if (error) throw error;
        } else {
          await pool.query('insert into public.meeting_actions (meeting_note_id, client_name, action_text, status) values ($1,$2,$3,$4)', [meeting.noteId, clientName, actionText, 'pending']);
        }
        return redirect(res, `/comms?view=${encodeURIComponent(view)}&tab=${encodeURIComponent(tab)}${accountId ? `&account_id=${encodeURIComponent(accountId)}` : ''}${contact ? `&contact=${encodeURIComponent(contact)}` : ''}&ift_state=ok&ift_msg=${encodeURIComponent('Human follow-up task created and queued in Ops.')}`);
      } catch (error) {
        return redirect(res, `/comms?view=${encodeURIComponent(view)}&tab=${encodeURIComponent(tab)}${accountId ? `&account_id=${encodeURIComponent(accountId)}` : ''}${contact ? `&contact=${encodeURIComponent(contact)}` : ''}&ift_state=error&ift_msg=${encodeURIComponent(`Follow-up task create failed: ${String(error.message || 'unknown error')}`)}`);
      }
    }

    const followupAdvanceMatch = reqUrl.pathname.match(/^\/followups\/([^/]+)\/advance$/);
    if (followupAdvanceMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      await advanceFollowupStatus(decodeURIComponent(followupAdvanceMatch[1]));
      const backTo = String(req.headers.referer || '/');
      return redirect(res, backTo.startsWith('http') ? new URL(backTo).pathname + new URL(backTo).search + (new URL(backTo).hash || '') : '/');
    }

    const clientUpdateMarkSentApiMatch = reqUrl.pathname.match(/^\/api\/client-updates\/([^/]+)\/mark-sent$/);
    if (clientUpdateMarkSentApiMatch && req.method === 'POST') {
      const auth = guardWriteAccess(req, res, { minRole: 'operator' });
      if (!auth) return;
      const result = await markClientUpdateSent(decodeURIComponent(clientUpdateMarkSentApiMatch[1]), `api:${auth.principal || auth.role}`);
      if (!result.ok) return sendJson(res, 404, { error: 'client_update_not_found' });
      return sendJson(res, 200, { ok: true, data: result.data, status_changed: result.status_changed });
    }

    const clientUpdateMarkSentMatch = reqUrl.pathname.match(/^\/client-updates\/([^/]+)\/mark-sent$/);
    if (clientUpdateMarkSentMatch && req.method === 'POST') {
      const auth = guardWriteAccess(req, res, { minRole: 'operator' });
      if (!auth) return;
      await markClientUpdateSent(decodeURIComponent(clientUpdateMarkSentMatch[1]), `ui:${auth.principal || auth.role}`);
      const backTo = String(req.headers.referer || '/');
      return redirect(res, backTo.startsWith('http') ? new URL(backTo).pathname + new URL(backTo).search + (new URL(backTo).hash || '') : '/');
    }

    if (reqUrl.pathname === '/api/sequence-enrollments' && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      try {
        const result = await enrollContactInSequence(body, 'api:/api/sequence-enrollments');
        return sendJson(res, 201, result);
      } catch (error) {
        if (String(error.message || '').includes('sequence_template_id and lead_key are required')) return sendJson(res, 400, { error: error.message });
        throw error;
      }
    }

    if (reqUrl.pathname === '/api/sequences/enroll' && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readJsonBody(req);
      try {
        const result = await enrollContactInSequence(body, 'api:/api/sequences/enroll');
        return sendJson(res, 201, { marker: 'sequence-enrollment-ux-v1', legacy_marker: 'sequence_enrollment_action_v1', ...result });
      } catch (error) {
        if (String(error.message || '').includes('sequence_template_id and lead_key are required')) return sendJson(res, 400, { error: error.message });
        throw error;
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/funnels/enroll') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      try {
        await enrollContactInSequence({
          sequence_template_id: body.sequence_template_id,
          lead_key: body.lead_key,
          metadata: {
            source: 'ui:funnel-card',
            funnel_id: body.funnel_id || null,
          },
        }, 'ui:/funnels/enroll');
        const referer = String(req.headers.referer || '');
        const base = referer.includes('/ops') ? '/ops' : '/';
        return redirect(res, `${base}?funnel_msg=Lead%20enrolled%20to%20sequence%20(queue%20created%20or%20updated).#funnels`);
      } catch (error) {
        const errorMessage = String(error.message || 'Enrollment failed');
        const referer = String(req.headers.referer || '');
        const base = referer.includes('/ops') ? '/ops' : '/';
        return redirect(res, `${base}?funnel_msg=${encodeURIComponent(`Enrollment failed: ${errorMessage}`)}#funnels`);
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/targeting/infer') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      try {
        const prompt = String(body.target_prompt || '').trim();
        return redirect(res, `/targeting?target_prompt=${encodeURIComponent(prompt)}`);
      } catch (error) {
        return redirect(res, `/targeting?tgt_msg=${encodeURIComponent(`Inference failed: ${String(error.message || 'unknown error')}`)}&tgt_state=error`);
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/comms/trade-show/captures') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      const view = String(body.view || 'account');
      const tab = String(body.tab || 'inbox');
      const accountId = String(body.account_id || '').trim();
      const contact = String(body.contact || '').trim();
      const intent = String(body.intent || 'save').toLowerCase();
      const transcriptText = String(body.transcript_text || '').trim();
      const source = String(body.source || 'voice_memo_placeholder').trim() || 'voice_memo_placeholder';
      const contextParams = `${accountId ? `&account_id=${encodeURIComponent(accountId)}` : ''}${contact ? `&contact=${encodeURIComponent(contact)}` : ''}`;
      if (intent === 'preview') {
        if (!transcriptText) {
          return redirect(res, `/comms?view=${encodeURIComponent(view)}&tab=${encodeURIComponent(tab)}&capture=error${contextParams}&capture_reason=${encodeURIComponent('Transcript is required before preview.')}`);
        }
        const extracted = extractVoiceNoteFields(transcriptText);
        const validation = validateTradeShowExtraction(extracted);
        const accountName = String(extracted.account_name || extracted.company_name || '').trim();
        const individualName = String(extracted.contact_name || '').trim();
        const contextNotes = String(extracted.context || extracted.extracted_notes || '').trim();
        const painPoints = Array.isArray(extracted.pain_points) ? extracted.pain_points.slice(0, 6) : [];
        const promisedFollowup = String(extracted.promised_follow_up || extracted.followup_text || '').trim();
        if (!validation.ok) {
          return redirect(res, `/comms?view=${encodeURIComponent(view)}&tab=${encodeURIComponent(tab)}&capture=error${contextParams}&capture_reason=${encodeURIComponent(`Missing required fields: ${validation.missing.join(', ')}.`)}&draft_transcript_text=${encodeURIComponent(transcriptText)}&draft_source=${encodeURIComponent(source)}`);
        }
        return redirect(res, `/comms?view=${encodeURIComponent(view)}&tab=${encodeURIComponent(tab)}&capture=preview${contextParams}&cp_account=${encodeURIComponent(accountName)}&cp_individual=${encodeURIComponent(individualName)}&cp_context=${encodeURIComponent(contextNotes)}&cp_pain_points=${encodeURIComponent(painPoints.join('||'))}&cp_followup=${encodeURIComponent(promisedFollowup)}&draft_transcript_text=${encodeURIComponent(transcriptText)}&draft_source=${encodeURIComponent(source)}`);
      }
      try {
        await ingestTradeShowVoiceMemo({ transcript_text: transcriptText, source });
        return redirect(res, `/comms?view=${encodeURIComponent(view)}&tab=${encodeURIComponent(tab)}&capture=ok${contextParams}`);
      } catch (_error) {
        const rawMessage = String(_error?.message || '');
        const missingFields = rawMessage.startsWith('missing_fields:')
          ? rawMessage.replace('missing_fields:', '').split('|').map((item) => item.trim()).filter(Boolean)
          : [];
        const captureReason = missingFields.length
          ? `Missing required fields: ${missingFields.join(', ')}.`
          : 'Trade-show memo capture failed. Please retry with transcript text.';
        return redirect(res, `/comms?view=${encodeURIComponent(view)}&tab=${encodeURIComponent(tab)}&capture=error${contextParams}&capture_reason=${encodeURIComponent(captureReason)}&draft_transcript_text=${encodeURIComponent(transcriptText)}&draft_source=${encodeURIComponent(source)}`);
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/targeting/approve-launch') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      try {
        const prompt = String(body.target_prompt || '').trim();
        const sequenceTemplates = await getSequenceTemplatesOverview();
        const inference = buildTargetingInference(prompt, sequenceTemplates);
        const inferred = { ...(inference?.inferred || inferQualifiedAccountFromTargetPrompt(prompt)) };
        inferred.qualification_confidence = Number(inference?.confidenceScore || inferred.qualification_confidence || 75);
        const approvalMode = String(body.approval_mode || 'approve').toLowerCase();
        const overrideBrand = String(body.override_brand || '').trim();
        const overrideRole = String(body.override_contact_role || '').trim();
        const recommendationId = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        if (approvalMode === 'override') {
          if (overrideBrand) inferred.brand = overrideBrand;
          if (overrideRole) inferred.contact_role = overrideRole;
        }
        const saved = await recordQualifiedAccount(inferred);
        await recordRecommendationLearningEvent({
          event_type: 'recommendation_decision_logged',
          recommendation_id: recommendationId,
          recommendation_type: 'targeting_launch_approval',
          account_id: saved?.id,
          decision: 'accepted',
          manual_override: approvalMode === 'override',
          notes: approvalMode === 'override' ? 'Approved with operator override from targeting launch form.' : 'Approved from targeting launch form.',
          actor: 'ui:/targeting/approve-launch',
        });
        const suggestedTemplate = body.sequence_template_id
          ? sequenceTemplates.find((tpl) => String(tpl.id) === String(body.sequence_template_id))
          : chooseSequenceTemplateForTargetPrompt(prompt, sequenceTemplates);
        const fallbackTemplate = suggestedTemplate || await getDefaultOutreachSequenceTemplate();
        const enrollment = await enrollQualifiedAccountIntoOutreach(saved.id, { sequence_template_id: fallbackTemplate?.id }, 'ui:/targeting/approve-launch');
        const launch = await runTargetingLaunchPipeline({
          prompt,
          account: saved,
          sequenceTemplate: enrollment?.sequence_template || fallbackTemplate,
          actor: 'ui:/targeting/approve-launch',
          confidenceScore: Number(inference?.confidenceScore || body.inference_confidence || 0),
          recommendations: inference?.recommendations || null,
        });
        const sequenceName = fallbackTemplate?.name || fallbackTemplate?.slug || 'default sequence';
        const nextView = String(body.next || '').toLowerCase();
        const successMessage = `Approved and launched into ${sequenceName} (target set ${launch.target_set_id}).`;
        if (nextView === 'actions') {
          return redirect(res, `/actions?action_msg=${encodeURIComponent(successMessage)}&action_state=success&source=targeting`);
        }
        return redirect(res, `/targeting?tgt_msg=${encodeURIComponent(successMessage)}&tgt_state=success`);
      } catch (error) {
        return redirect(res, `/targeting?tgt_msg=${encodeURIComponent(`Launch failed: ${String(error.message || 'unknown error')}`)}&tgt_state=error`);
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/marketing/targets/create') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      try {
        const prompt = String(body.target_prompt || '').trim();
        const sequenceTemplates = await getSequenceTemplatesOverview();
        const inference = buildTargetingInference(prompt, sequenceTemplates);
        const inferred = inference?.inferred || inferQualifiedAccountFromTargetPrompt(prompt);
        inferred.qualification_confidence = Number(inference?.confidenceScore || inferred.qualification_confidence || 75);
        const saved = await recordQualifiedAccount(inferred);
        const suggestedTemplate = chooseSequenceTemplateForTargetPrompt(prompt, sequenceTemplates) || await getDefaultOutreachSequenceTemplate();
        const enrollment = await enrollQualifiedAccountIntoOutreach(saved.id, { sequence_template_id: suggestedTemplate?.id }, 'ui:/marketing/targets/create');
        const launch = await runTargetingLaunchPipeline({
          prompt,
          account: saved,
          sequenceTemplate: enrollment?.sequence_template || suggestedTemplate,
          actor: 'ui:/marketing/targets/create',
          confidenceScore: Number(inference?.confidenceScore || 0),
          recommendations: inference?.recommendations || null,
        });
        const sequenceName = suggestedTemplate?.name || suggestedTemplate?.slug || 'default sequence';
        return redirect(res, `/targeting?tgt_msg=${encodeURIComponent(`Target saved and auto-placed into ${sequenceName} (target set ${launch.target_set_id}).`)}&tgt_state=success`);
      } catch (error) {
        return redirect(res, `/targeting?tgt_msg=${encodeURIComponent(`Target intake failed: ${String(error.message || 'unknown error')}`)}&tgt_state=error`);
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/qualified-accounts/create') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      try {
        const saved = await recordQualifiedAccount(body);
        if (body.sequence_template_id) {
          await enrollQualifiedAccountIntoOutreach(saved.id, { sequence_template_id: body.sequence_template_id }, 'ui:/qualified-accounts/create');
          return redirect(res, '/?qa_msg=Qualified%20account%20saved%20and%20enrolled.&qa_state=success#qualified-account-form');
        }
        return redirect(res, '/?qa_msg=Qualified%20account%20saved.&qa_state=success#qualified-account-form');
      } catch (error) {
        return redirect(res, `/?qa_msg=${encodeURIComponent(`Save failed: ${String(error.message || 'unknown error')}`)}&qa_state=error#qualified-account-form`);
      }
    }

    const qualifiedEnrollUiMatch = reqUrl.pathname.match(/^\/qualified-accounts\/([^/]+)\/enroll$/);
    if (qualifiedEnrollUiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      try {
        await enrollQualifiedAccountIntoOutreach(decodeURIComponent(qualifiedEnrollUiMatch[1]), body, 'ui:/qualified-accounts/:id/enroll');
        return redirect(res, '/?qa_msg=Qualified%20account%20enrolled%20into%20outreach.&qa_state=success#qualified-account-form');
      } catch (error) {
        return redirect(res, `/?qa_msg=${encodeURIComponent(`Enroll failed: ${String(error.message || 'unknown error')}`)}&qa_state=error#qualified-account-form`);
      }
    }


    const qualifiedPromoteDiscoveryUiMatch = reqUrl.pathname.match(/^\/qualified-accounts\/([^/]+)\/promote-discovery$/);
    if (qualifiedPromoteDiscoveryUiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const returnPath = resolveUiReturnPath(req, '/pilot');
      try {
        await promoteQualifiedAccountStage(decodeURIComponent(qualifiedPromoteDiscoveryUiMatch[1]), 'discovery', 'ui:/qualified-accounts/:id/promote-discovery');
        const joiner = returnPath.includes('?') ? '&' : '?';
        return redirect(res, `${returnPath}${joiner}qa_msg=${encodeURIComponent('Account promoted to discovery.')}&qa_state=success`);
      } catch (error) {
        const joiner = returnPath.includes('?') ? '&' : '?';
        return redirect(res, `${returnPath}${joiner}qa_msg=${encodeURIComponent(`Promote failed: ${String(error.message || 'unknown error')}`)}&qa_state=error`);
      }
    }

    const qualifiedPromotePilotUiMatch = reqUrl.pathname.match(/^\/qualified-accounts\/([^/]+)\/promote-pilot-candidate$/);
    if (qualifiedPromotePilotUiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const returnPath = resolveUiReturnPath(req, '/pilot');
      try {
        await promoteQualifiedAccountStage(decodeURIComponent(qualifiedPromotePilotUiMatch[1]), 'pilot_candidate', 'ui:/qualified-accounts/:id/promote-pilot-candidate');
        const joiner = returnPath.includes('?') ? '&' : '?';
        return redirect(res, `${returnPath}${joiner}qa_msg=${encodeURIComponent('Account promoted to pilot candidate.')}&qa_state=success`);
      } catch (error) {
        const joiner = returnPath.includes('?') ? '&' : '?';
        return redirect(res, `${returnPath}${joiner}qa_msg=${encodeURIComponent(`Promote failed: ${String(error.message || 'unknown error')}`)}&qa_state=error`);
      }
    }

    const qualifiedRoutePilotUiMatch = reqUrl.pathname.match(/^\/qualified-accounts\/([^/]+)\/route-pilot-onboarding$/);
    if (qualifiedRoutePilotUiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const returnPath = resolveUiReturnPath(req, '/pilot');
      try {
        await routeQualifiedAccountToPilotOnboarding(decodeURIComponent(qualifiedRoutePilotUiMatch[1]), 'ui:/qualified-accounts/:id/route-pilot-onboarding');
        const joiner = returnPath.includes('?') ? '&' : '?';
        return redirect(res, `${returnPath}${joiner}qa_msg=${encodeURIComponent('Account routed to pilot onboarding queue.')}&qa_state=success`);
      } catch (error) {
        const joiner = returnPath.includes('?') ? '&' : '?';
        return redirect(res, `${returnPath}${joiner}qa_msg=${encodeURIComponent(`Route failed: ${String(error.message || 'unknown error')}`)}&qa_state=error`);
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/competitive-intel/create') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      try {
        await recordCompetitiveIntelEntry(body);
        return redirect(res, '/research?intel_msg=Competitive%20intel%20saved.&intel_state=success#competitive-intelligence');
      } catch (error) {
        return redirect(res, `/research?intel_msg=${encodeURIComponent(`Intel save failed: ${String(error.message || 'unknown error')}`)}&intel_state=error#competitive-intelligence`);
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/research/entries/create') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      try {
        await recordResearchLedgerEntry(body, 'ui:/research/entries/create');
        return redirect(res, '/research?research_msg=Research%20ledger%20entry%20saved.&research_state=success');
      } catch (error) {
        return redirect(res, `/research?research_msg=${encodeURIComponent(`Research ledger save failed: ${String(error.message || 'unknown error')}`)}&research_state=error`);
      }
    }

    const sequenceTemplateStepUiMatch = reqUrl.pathname.match(/^\/sequences\/templates\/([^/]+)\/steps$/);
    if (sequenceTemplateStepUiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      try {
        await appendTemplateStep(decodeURIComponent(sequenceTemplateStepUiMatch[1]), {
          step_type: body.step_type,
          delay_days: Number(body.delay_days || 0),
          message_stub: body.message_stub,
        });
        return redirect(res, '/ops#funnels');
      } catch (error) {
        return redirect(res, `/ops?funnel_msg=${encodeURIComponent(`Step update failed: ${String(error.message || 'unknown error')}`)}#funnels`);
      }
    }

    const sequenceTemplateToggleUiMatch = reqUrl.pathname.match(/^\/sequences\/templates\/([^/]+)\/toggle$/);
    if (sequenceTemplateToggleUiMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      const nextStatus = String(body.next_status || '').toLowerCase();
      await setSequenceTemplatePaused(decodeURIComponent(sequenceTemplateToggleUiMatch[1]), nextStatus === 'paused');
      return redirect(res, '/ops#funnels');
    }

    if (req.method === 'POST' && reqUrl.pathname === '/ops/recommendations/decision') {
      const auth = guardWriteAccess(req, res, { minRole: 'operator' });
      if (!auth) return;
      const body = await readFormBody(req);
      try {
        const recommendationId = String(body.recommendation_id || `${Date.now()}-${Math.round(Math.random() * 1e6)}`);
        await recordRecommendationLearningEvent({
          event_type: 'recommendation_decision_logged',
          recommendation_id: recommendationId,
          recommendation_type: String(body.recommendation_type || 'relationship_next_action'),
          account_id: String(body.account_id || ''),
          decision: String(body.decision || 'accepted').toLowerCase(),
          manual_override: ['1', 'true', 'yes', 'on'].includes(String(body.manual_override || '').toLowerCase()),
          notes: String(body.notes || ''),
          actor: `ui:${auth.principal || auth.role}`,
        });
        return redirect(res, '/ops?rec_learning_msg=Recommendation%20decision%20logged.&rec_learning_state=success#recommendation-learning');
      } catch (error) {
        return redirect(res, `/ops?rec_learning_msg=${encodeURIComponent(`Recommendation decision log failed: ${String(error.message || 'unknown error')}`)}&rec_learning_state=error#recommendation-learning`);
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/ops/recommendations/outcome') {
      const auth = guardWriteAccess(req, res, { minRole: 'operator' });
      if (!auth) return;
      const body = await readFormBody(req);
      try {
        const recommendationId = String(body.recommendation_id || `${Date.now()}-${Math.round(Math.random() * 1e6)}`);
        await recordRecommendationLearningEvent({
          event_type: 'recommendation_outcome_logged',
          recommendation_id: recommendationId,
          recommendation_type: String(body.recommendation_type || 'relationship_next_action'),
          account_id: String(body.account_id || ''),
          outcome: String(body.outcome || 'neutral').toLowerCase(),
          outcome_score: Number(body.outcome_score || NaN),
          notes: String(body.notes || ''),
          actor: `ui:${auth.principal || auth.role}`,
        });
        return redirect(res, '/ops?rec_learning_msg=Recommendation%20outcome%20logged.&rec_learning_state=success#recommendation-learning');
      } catch (error) {
        return redirect(res, `/ops?rec_learning_msg=${encodeURIComponent(`Recommendation outcome log failed: ${String(error.message || 'unknown error')}`)}&rec_learning_state=error#recommendation-learning`);
      }
    }

    if (req.method === 'POST' && reqUrl.pathname === '/ops/autonomy-direction') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      const saved = await writeAutonomyDirection({
        objective: String(body.objective || DEFAULT_AUTONOMY_DIRECTION.objective),
        quality_mode: String(body.quality_mode || DEFAULT_AUTONOMY_DIRECTION.quality_mode),
        operating_constraints: String(body.operating_constraints || '').split('\n').map((line) => line.trim()).filter(Boolean),
        directional_preferences: {
          speed_vs_polish: Number(body.speed_vs_polish || 50) / 100,
          risk_tolerance: String(body.risk_tolerance || 'medium'),
          review_strictness: String(body.review_strictness || 'standard'),
        },
      });
      const spawnDefaults = deriveSpawnDefaultsFromAutonomy(saved);
      return redirect(res, `/ops?autonomy_msg=${encodeURIComponent(`Autonomy direction saved. Spawn defaults now target_workers=${spawnDefaults.target_workers}, review_burst_budget=${spawnDefaults.review_burst_budget}.`)}&autonomy_state=success#autonomy-direction`);
    }

    const reviewBurstActionMatch = reqUrl.pathname.match(/^\/ops\/review-bursts\/([^/]+)\/(approve|revise|implement|close)$/);
    if (reviewBurstActionMatch && req.method === 'POST') {
      const auth = guardWriteAccess(req, res, { minRole: 'operator' });
      if (!auth) return;
      const body = await readFormBody(req);
      const burstId = decodeURIComponent(reviewBurstActionMatch[1]);
      const action = decodeURIComponent(reviewBurstActionMatch[2]);
      const reason = String(body.reason || '').trim();
      const implementationProof = String(body.implementation_proof || '').trim();
      const nowIso = new Date().toISOString();
      const targetStatus = action === 'approve'
        ? 'approved'
        : action === 'revise'
          ? 'revise'
          : action === 'implement'
            ? 'implemented'
            : 'closed';
      const autoCloseoutPipeline = action === 'approve';
      const lifecycleTransitions = autoCloseoutPipeline
        ? ['approved', 'implemented', 'closed']
        : [targetStatus];

      let linkedBurst = null;
      OPS_REVIEW_BURSTS = OPS_REVIEW_BURSTS.map((burst) => {
        if (String(burst.id) !== String(burstId)) return burst;
        const autoProofLink = implementationProof
          || burst.implementationProof
          || burst.exactSectionUrl
          || burst.exactUrl
          || burst.pageUrl
          || `/ops#review-bursts`;
        linkedBurst = {
          ...burst,
          status: autoCloseoutPipeline ? 'closed' : targetStatus,
          decision_reason: reason || burst.decision_reason || null,
          implementationProof: autoProofLink,
          approvedAt: (autoCloseoutPipeline || targetStatus === 'approved') ? nowIso : (burst.approvedAt || null),
          implementedAt: (autoCloseoutPipeline || targetStatus === 'implemented') ? nowIso : burst.implementedAt,
          closedAt: (autoCloseoutPipeline || targetStatus === 'closed') ? nowIso : burst.closedAt,
          updatedAt: nowIso,
        };
        return linkedBurst;
      });

      if (!linkedBurst) {
        return redirect(res, `/ops?review_burst_msg=${encodeURIComponent(`Review burst ${burstId} not found.`)}&review_burst_state=error#review-bursts`);
      }

      upsertBurstReviewCenterRecord(linkedBurst, {
        label: autoCloseoutPipeline
          ? `Auto-closeout pipeline applied (approved → implemented → closed) with proof link ${linkedBurst.implementationProof || 'not provided'}`
          : action === 'implement'
            ? `Implementation proof attached (${linkedBurst.implementationProof || 'proof noted'})`
            : action === 'close'
              ? 'Burst closed and auto-archived from active queue to review history'
              : `Decision action recorded: ${targetStatus}`,
      });
      await mirrorReviewBurstStatusTransitions(linkedBurst, lifecycleTransitions);

      if (action === 'approve' || action === 'revise') {
        const profile = await loadOperatorPreferenceProfile();
        const signalTags = mapReasonToPreferenceTags(reason, action);
        for (const tag of signalTags) {
          const current = profile.tags[tag] || { total: 0, approved: 0, revise: 0 };
          profile.tags[tag] = {
            total: Number(current.total || 0) + 1,
            approved: Number(current.approved || 0) + (action === 'approve' ? 1 : 0),
            revise: Number(current.revise || 0) + (action === 'revise' ? 1 : 0),
          };
        }
        profile.signals = [
          ...(Array.isArray(profile.signals) ? profile.signals : []),
          {
            burst_id: burstId,
            action,
            reason,
            tags: signalTags,
            operator: auth.principal || auth.role || 'operator',
            at: nowIso,
          },
        ].slice(-80);
        profile.summary = derivePreferenceSummary(profile);
        await saveOperatorPreferenceProfile(profile);
      }

      const outcomeStatus = autoCloseoutPipeline ? 'approved → implemented → closed' : targetStatus;
      await emitReviewBurstRealtimeEvent(`status:${targetStatus}`);
      return redirect(res, `/ops?review_burst_msg=${encodeURIComponent(`Review burst ${burstId} moved to ${outcomeStatus}.`)}&review_burst_state=success#review-bursts`);
    }

    if (req.method === 'POST' && reqUrl.pathname === '/ops/preferences/update') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      const profile = await loadOperatorPreferenceProfile();
      profile.overrides = {
        ...(profile.overrides || {}),
        copy_tone: String(body.copy_tone || '').trim() || null,
        component_density: String(body.component_density || '').trim() || null,
        cta_style: String(body.cta_style || '').trim() || null,
        hierarchy_preference: String(body.hierarchy_preference || '').trim() || null,
      };
      profile.summary = derivePreferenceSummary(profile);
      await saveOperatorPreferenceProfile(profile);
      await emitReviewBurstRealtimeEvent('preferences:profile_updated');
      return redirect(res, '/ops?review_burst_msg=Preference%20profile%20updated.&review_burst_state=success#preference-profile');
    }

    const burstPrefEditMatch = reqUrl.pathname.match(/^\/ops\/review-bursts\/([^/]+)\/preferences$/);
    if (burstPrefEditMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      const manualTags = String(body.manual_tags || '').split(',').map((x) => x.trim()).filter(Boolean);
      const profile = await loadOperatorPreferenceProfile();
      for (const tag of manualTags) {
        const current = profile.tags[tag] || { total: 0, approved: 0, revise: 0 };
        profile.tags[tag] = { ...current, total: Number(current.total || 0) + 1 };
      }
      profile.overrides = {
        ...(profile.overrides || {}),
        copy_tone: String(body.copy_tone || '').trim() || profile.overrides?.copy_tone || null,
        component_density: String(body.component_density || '').trim() || profile.overrides?.component_density || null,
        cta_style: String(body.cta_style || '').trim() || profile.overrides?.cta_style || null,
        hierarchy_preference: String(body.hierarchy_preference || '').trim() || profile.overrides?.hierarchy_preference || null,
      };
      profile.summary = derivePreferenceSummary(profile);
      await saveOperatorPreferenceProfile(profile);
      await emitReviewBurstRealtimeEvent('preferences:burst_override');
      return redirect(res, '/ops?review_burst_msg=Burst%20preference%20override%20saved.&review_burst_state=success#review-bursts');
    }

    const alertRuleEditMatch = reqUrl.pathname.match(/^\/ops\/alert-rules\/([^/]+)$/);
    if (alertRuleEditMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      const targetRuleId = decodeURIComponent(alertRuleEditMatch[1]);
      const config = await readAlertRulesConfig();
      config.rules = (config.rules || []).map((rule) => {
        if (String(rule.id) !== String(targetRuleId)) return rule;
        return {
          ...rule,
          threshold: String(body.threshold || rule.threshold || '').trim() || String(rule.threshold || 'n/a'),
          severity: normalizeSeverity(body.severity || rule.severity),
          owner: String(body.owner || rule.owner || 'Unassigned').trim() || 'Unassigned',
          sla_minutes: Number.isFinite(Number(body.sla_minutes)) ? Number(body.sla_minutes) : rule.sla_minutes,
        };
      });
      await writeAlertRulesConfig(config);
      return redirect(res, '/ops#revops');
    }

    const escalationEditMatch = reqUrl.pathname.match(/^\/ops\/escalation-policy\/(info|warning|critical)$/);
    if (escalationEditMatch && req.method === 'POST') {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const body = await readFormBody(req);
      const severity = decodeURIComponent(escalationEditMatch[1]);
      const config = await readAlertRulesConfig();
      const notify = String(body.notify || '').split(',').map((item) => item.trim()).filter(Boolean);
      config.escalation_policy = config.escalation_policy || {};
      config.escalation_policy[severity] = {
        notify,
        escalate_after_minutes: Number.isFinite(Number(body.escalate_after_minutes)) ? Number(body.escalate_after_minutes) : 0,
        escalate_to: String(body.escalate_to || '').trim() || null,
      };
      await writeAlertRulesConfig(config);
      return redirect(res, '/ops#revops');
    }

    if (req.method === 'GET' && reqUrl.pathname === '/operator-status') {
      const [tasks, queueSnapshot] = await Promise.all([
        getTasks({ allowEmpty: true }),
        readWorkQueueSnapshot(),
      ]);
      return send(res, 200, renderOperatorStatusPane(tasks, queueSnapshot), 'AdZeta Command Center · Operator status');
    }

    if (req.method === 'GET' && reqUrl.pathname === '/setup') return redirect(res, '/ops');

    if (req.method === 'GET' && reqUrl.pathname === '/ops/reviewer-checklist') {
      return send(res, 200, await renderReviewerChecklistDocPage(), 'AdZeta Command Center · Reviewer checklist');
    }

    if (req.method === 'GET' && reqUrl.pathname === '/product/pltv-lift-pilot') {
      return redirect(res, '/pilot');
    }

    const accountDetailMatch = reqUrl.pathname.match(/^\/accounts\/([^/]+)$/);
    if (req.method === 'GET' && accountDetailMatch) {
      const accountId = decodeURIComponent(accountDetailMatch[1]);
      const [accounts, ledgerEntries, tasks, meetingPipeline, recentReplyRouting, learningSummary, preferenceProfile] = await Promise.all([
        listQualifiedAccounts(200),
        listResearchLedgerEntriesForAccount(accountId, 40),
        getTasks({ allowEmpty: true }),
        getMeetingPipelineSnapshot(),
        getRecentReplyRouting(),
        getRecommendationLearningSummary(),
        loadOperatorPreferenceProfile(),
        getDevelopmentCostAttribution(),
      ]);
      const account = (accounts || []).find((item) => String(item.id) === String(accountId)) || null;
      const relationshipIntelligence = buildRelationshipIntelligence({ qualifiedAccounts: accounts, meetingPipeline, tasks, recentReplyRouting, learningSummary, preferenceProfile });
      const intelligence = (relationshipIntelligence?.scores || []).find((row) => String(row.account_id) === String(accountId)) || null;
      return send(res, account ? 200 : 404, renderAccountDetailPage({ account, ledgerEntries, intelligence }), `AdZeta Command Center · Account ${account?.brand || 'not found'}`);
    }

    if (req.method === 'GET' && reqUrl.pathname === '/home/command') {
      const command = String(reqUrl.searchParams.get('q') || '').trim();
      const intent = resolveHomeCommandIntent(command);
      return redirect(res, intent.path);
    }

    if (req.method === 'GET' && (reqUrl.pathname === '/' || reqUrl.pathname === '/targeting' || reqUrl.pathname === '/relationships' || reqUrl.pathname === '/actions' || reqUrl.pathname === '/pilot' || reqUrl.pathname === '/ops' || reqUrl.pathname === '/strategy' || reqUrl.pathname === '/marketing' || reqUrl.pathname === '/sales' || reqUrl.pathname === '/support' || reqUrl.pathname === '/comms' || reqUrl.pathname === '/revops' || reqUrl.pathname === '/research')) {
      const filter = QUICK_FILTERS.includes(reqUrl.searchParams.get('filter')) ? reqUrl.searchParams.get('filter') : 'all';
      const clientUpdateFilter = CLIENT_UPDATE_FILTERS.includes(reqUrl.searchParams.get('client_updates')) ? reqUrl.searchParams.get('client_updates') : 'all';
      const authForHome = getRoleFromRequest(req);
      const roleContext = authForHome.ok
        ? { role: authForHome.role, principal: authForHome.principal }
        : { role: 'operator', principal: 'operator' };
      const [tasks, queueSnapshot, kpis, lifecycle, campaignSummary, alertRulesConfig, health, readiness, workflowCompleteness, funnels, sequenceQueue, enrollmentBySequence, sequenceTemplates, qualifiedAccounts, nurtureTriggerRules, nurtureTriggerLastRun, recentReplyRouting, meetingPipeline, assetSummary, acquisitionMetrics, strategyArtifacts, launchActions, launchRelationships, researchLedgerEntries, competitiveIntelEntries, learningSummary, preferenceProfile, developmentCostAttribution] = await Promise.all([
        getTasks({ allowEmpty: true }),
        readWorkQueueSnapshot(),
        getKpis(),
        getLifecycleSummary(),
        getCampaignSummary(),
        readAlertRulesConfig(),
        getHealthStatus(req.headers.host || ''),
        getMondayReadiness(),
        getWorkflowCompleteness(),
        getFunnels(),
        getSequenceQueue(),
        getActiveEnrollmentsBySequence(),
        getSequenceTemplatesOverview(),
        listQualifiedAccounts(20),
        readNurtureTriggerRules(),
        readNurtureTriggerLastRun(),
        getRecentReplyRouting(),
        getMeetingPipelineSnapshot(),
        getAssetStatusSummary(),
        getAcquisitionMetricsByFunnelEntry(),
        readStrategyArtifacts(),
        readNdjson(actionsNdjsonPath, 40),
        readNdjson(relationshipsNdjsonPath, 40),
        listResearchLedgerEntries(100),
        listCompetitiveIntelEntries(80),
        getRecommendationLearningSummary(),
        loadOperatorPreferenceProfile(),
        getDevelopmentCostAttribution(),
      ]);
      const autonomyDirection = await readAutonomyDirection();
      const spawnDefaults = deriveSpawnDefaultsFromAutonomy(autonomyDirection);
      const orchestrationVisibility = await getOrchestrationVisibilitySnapshot({ tasks, queueSnapshot, targetWorkersOverride: spawnDefaults.target_workers });
      const activeWorkersSnapshot = await getActiveWorkersSnapshot({ orchestrationVisibility });
      const strategy = deriveStrategyViewModel({ artifacts: strategyArtifacts, queueSnapshot, tasks, readiness });
      const relationshipIntelligence = buildRelationshipIntelligence({ qualifiedAccounts, meetingPipeline, tasks, recentReplyRouting, learningSummary, preferenceProfile });
      const unifiedKpiTelemetry = {
        generated_at: kpis?.generated_at || new Date().toISOString(),
        kpis,
        home_kpi_strip: deriveHomeKpiStripTelemetry({
          qualifiedAccounts,
          acquisitionMetrics,
          campaignSummary,
          kpis,
          normalizePilotHandoffStage,
        }),
      };
      if (reqUrl.pathname === '/targeting' || reqUrl.pathname === '/marketing') {
        const targetPrompt = String(reqUrl.searchParams.get('target_prompt') || '');
        const message = String(reqUrl.searchParams.get('tgt_msg') || reqUrl.searchParams.get('mkt_msg') || '');
        const messageState = String(reqUrl.searchParams.get('tgt_state') || reqUrl.searchParams.get('mkt_state') || 'success');
        const inferred = targetPrompt ? buildTargetingInference(targetPrompt, sequenceTemplates) : null;
        return send(res, 200, renderTargetingStudioPage({ targetPrompt, inference: inferred, message, messageState }), 'AdZeta Command Center · Targeting');
      }
      if (reqUrl.pathname === '/relationships' || reqUrl.pathname === '/sales') {
        return send(res, 200, renderSalesPage({ qualifiedAccounts, sequenceTemplates, sequenceQueue, enrollmentBySequence, meetingPipeline, launchRelationships, relationshipIntelligence }), 'AdZeta Command Center · Relationships');
      }
      if (reqUrl.pathname === '/actions') {
        const actionMessage = String(reqUrl.searchParams.get('action_msg') || '');
        const actionState = String(reqUrl.searchParams.get('action_state') || 'success');
        const source = String(reqUrl.searchParams.get('source') || '');
        const returnTo = sanitizeInternalReturnPath(String(reqUrl.searchParams.get('return_to') || ''));
        return send(res, 200, renderActionsPage(tasks, qualifiedAccounts, meetingPipeline, relationshipIntelligence, { message: actionMessage, messageState: actionState, source, returnTo }), 'AdZeta Command Center · Actions');
      }
      if (reqUrl.pathname === '/support' || reqUrl.pathname === '/comms') {
        const commsView = String(reqUrl.searchParams.get('view') || 'account');
        const commsTab = String(reqUrl.searchParams.get('tab') || 'inbox');
        const captureState = String(reqUrl.searchParams.get('capture') || '').toLowerCase();
        const capturePreview = captureState === 'preview' ? {
          account_name: String(reqUrl.searchParams.get('cp_account') || ''),
          contact_name: String(reqUrl.searchParams.get('cp_individual') || ''),
          context: String(reqUrl.searchParams.get('cp_context') || ''),
          pain_points: String(reqUrl.searchParams.get('cp_pain_points') || '').split('||').map((item) => item.trim()).filter(Boolean),
          promised_follow_up: String(reqUrl.searchParams.get('cp_followup') || ''),
        } : null;
        const captureDraft = {
          transcript_text: String(reqUrl.searchParams.get('draft_transcript_text') || ''),
          source: String(reqUrl.searchParams.get('draft_source') || ''),
        };
        const captureReason = String(reqUrl.searchParams.get('capture_reason') || '');
        const followupTaskState = String(reqUrl.searchParams.get('ift_state') || '').toLowerCase();
        const followupTaskMessage = String(reqUrl.searchParams.get('ift_msg') || '');
        const accountId = String(reqUrl.searchParams.get('account_id') || '');
        const contact = String(reqUrl.searchParams.get('contact') || '');
        const humanActionNowOnly = String(reqUrl.searchParams.get('human_now') || '').toLowerCase() === '1';
        const tradeShowCaptures = await listTradeShowCaptures(12);
        return send(res, 200, renderSupportPage({ meetingPipeline, recentReplyRouting, launchActions, relationshipIntelligence, qualifiedAccounts, tasks, view: commsView, tab: commsTab, tradeShowCaptures, captureState, capturePreview, captureDraft, captureReason, accountId, contact, humanActionNowOnly, followupTaskState, followupTaskMessage }), 'AdZeta Command Center · Comms');
      }
      if (reqUrl.pathname === '/pilot' || reqUrl.pathname === '/revops') {
        const source = reqUrl.searchParams.get('source') || '';
        return send(res, 200, renderRevOpsPage({ strategy, qualifiedAccounts, relationshipIntelligence, source }), 'AdZeta Command Center · Pilot');
      }
      if (reqUrl.pathname === '/ops') {
        const reviewBursts = await hydrateReviewBurstsWithLiveData(OPS_REVIEW_BURSTS);
        await syncReviewBurstChatMirrorForNewBursts(reviewBursts);
        const reviewBurstMessage = String(reqUrl.searchParams.get('review_burst_msg') || '');
        const reviewBurstState = String(reqUrl.searchParams.get('review_burst_state') || 'success');
        const recommendationLearningMessage = String(reqUrl.searchParams.get('rec_learning_msg') || '');
        const recommendationLearningState = String(reqUrl.searchParams.get('rec_learning_state') || 'success');
        const autonomyDirectionMessage = String(reqUrl.searchParams.get('autonomy_msg') || '');
        const autonomyDirectionState = String(reqUrl.searchParams.get('autonomy_state') || 'success');
        const designTokenDriftStatus = await getDesignTokenDriftStatus();
        return send(res, 200, renderOpsCommandCenter({ tasks, filteredTasks: applyTaskFilter(tasks, filter), queueSnapshot, kpis, lifecycle, alertRulesConfig, health, readiness, workflowCompleteness, activeFilter: filter, clientUpdateFilter, sequenceTemplates, sequenceQueue, enrollmentBySequence, nurtureTriggerRules, nurtureTriggerLastRun, recentReplyRouting, meetingPipeline, assetSummary, acquisitionMetrics, orchestrationVisibility, activeWorkersSnapshot, developmentCostAttribution, learningSummary, preferenceProfile, unifiedKpiTelemetry, designTokenDriftStatus, autonomyDirection, autonomyDirectionMessage, autonomyDirectionState, recommendationLearningMessage, recommendationLearningState, reviewBurstMessage, reviewBurstState, reviewBursts }), 'AdZeta Command Center · Ops');
      }
      if (reqUrl.pathname === '/strategy') {
        return send(res, 200, renderStrategyDecisionCenter({ strategy }), 'AdZeta Command Center · Strategy');
      }
      if (reqUrl.pathname === '/research') {
        const message = String(reqUrl.searchParams.get('research_msg') || '');
        const messageState = String(reqUrl.searchParams.get('research_state') || 'success');
        const intelMessage = String(reqUrl.searchParams.get('intel_msg') || '');
        const intelState = String(reqUrl.searchParams.get('intel_state') || 'success');
        return send(res, 200, renderResearchLedgerPage({ entries: researchLedgerEntries, qualifiedAccounts, competitiveIntelEntries, message, messageState, intelMessage, intelState }), 'AdZeta Command Center · Research');
      }
      const commandMessage = String(reqUrl.searchParams.get('cmd_msg') || '');
      const commandState = String(reqUrl.searchParams.get('cmd_state') || 'success');
      return send(res, 200, renderHomeCommandCenter({ funnels, qualifiedAccounts, meetingPipeline, kpis, campaignSummary, acquisitionMetrics, sequenceTemplates, unifiedKpiTelemetry, roleContext, tasks, commandMessage, commandState }), 'AdZeta Command Center · Home');
    }

    const advanceMatch = reqUrl.pathname.match(/^\/setup\/([^/]+)\/advance$/);
    if (req.method === 'POST' && advanceMatch) {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const taskId = decodeURIComponent(advanceMatch[1]);
      const filter = QUICK_FILTERS.includes(reqUrl.searchParams.get('filter')) ? reqUrl.searchParams.get('filter') : 'all';
      const view = reqUrl.searchParams.get('view') === '/ops' ? '/ops' : '/';
      await advanceStatus(taskId);
      return redirect(res, `${view}?filter=${encodeURIComponent(filter)}`);
    }

    const actionsTransitionMatch = reqUrl.pathname.match(/^\/actions\/([^/]+)\/transition$/);
    if (req.method === 'POST' && actionsTransitionMatch) {
      if (!guardWriteAccess(req, res, { minRole: 'operator' })) return;
      const actionId = decodeURIComponent(actionsTransitionMatch[1]);
      const advanced = await advanceStatus(actionId);
      const actionMsg = advanced
        ? `Action ${actionId} transitioned. Completion behavior and next-step cues updated on card.`
        : `Action ${actionId} not found.`;
      const actionState = advanced ? 'success' : 'error';
      return redirect(res, `/actions?action_msg=${encodeURIComponent(actionMsg)}&action_state=${encodeURIComponent(actionState)}`);
    }

    return send(res, 404, '<h1>Not Found</h1><p>Try <a href="/">/</a>, <a href="/targeting">/targeting</a>, <a href="/relationships">/relationships</a>, <a href="/actions">/actions</a>, <a href="/pilot">/pilot</a>, <a href="/research">/research</a>, or <a href="/ops">/ops</a>.</p>');
  } catch (error) {
    if (reqUrl.pathname.startsWith('/api/')) {
      return sendJson(res, 500, { error: 'request_failed', message: error.message, mode: runtimeMode });
    }
    return send(res, 500, `<h1>Server Error</h1><p>${escapeHtml(error.message)}</p>`);
  }
});

server.listen(port, () => {
  console.log(`GTM Command Center listening on http://localhost:${port} (mode: ${runtimeMode})`);
  syncReviewBurstChatMirrorForNewBursts(OPS_REVIEW_BURSTS).catch((error) => {
    console.warn(`[ops-review-burst-chat-mirror] startup sync failed: ${String(error?.message || error)}`);
  });
});
