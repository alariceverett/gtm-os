export const KPI_TREE = {
  north_star: {
    key: 'weekly_qualified_pipeline_velocity',
    label: 'Weekly qualified pipeline velocity',
    definition: 'How quickly qualified accounts are moved into active execution and completed work.',
  },
  level_1: [
    { key: 'execution_throughput', label: 'Execution throughput', l2_keys: ['delegations_24h', 'completed_24h'] },
    { key: 'queue_health', label: 'Queue health', l2_keys: ['open_priorities', 'active_runs'] },
  ],
};

export const KPI_META = {
  delegations_24h: {
    shortLabel: 'Delegations dispatched (24h)',
    operatorDefinition: 'Count of delegations created in the last 24 hours.',
    formula: 'COUNT(cc_delegations.id) WHERE created_at >= now() - 24h',
    grain: 'Rolling 24h · global operator queue',
    owner: 'Ops · execution owner',
    cadence: 'Hourly check, daily operating review',
    mondayGate: 'GATE-03 work queue not blocked',
    goRule: 'Healthy when >= 10',
    hierarchy: { northStar: 'weekly_qualified_pipeline_velocity', l1: 'execution_throughput', l2: 'delegations_24h' },
  },
  completed_24h: {
    shortLabel: 'Delegations completed (24h)',
    operatorDefinition: 'Count of delegations completed in the last 24 hours.',
    formula: 'COUNT(cc_delegations.id) WHERE completed_at >= now() - 24h',
    grain: 'Rolling 24h · global operator queue',
    owner: 'Ops · execution owner',
    cadence: 'Hourly check, daily operating review',
    mondayGate: 'Execution stability guard',
    goRule: 'Healthy ratio when completed/delegations >= 0.55',
    hierarchy: { northStar: 'weekly_qualified_pipeline_velocity', l1: 'execution_throughput', l2: 'completed_24h' },
  },
  open_priorities: {
    shortLabel: 'Open priority backlog',
    operatorDefinition: 'Count of priority items not done/completed/cancelled.',
    formula: "COUNT(cc_priorities.id) WHERE status NOT IN ('done','completed','cancelled')",
    grain: 'Point-in-time snapshot · global priority board',
    owner: 'Ops · queue manager',
    cadence: 'Continuous monitor, reviewed each standup',
    mondayGate: 'GATE-03 work queue not blocked',
    goRule: 'Healthy when <= 25',
    hierarchy: { northStar: 'weekly_qualified_pipeline_velocity', l1: 'queue_health', l2: 'open_priorities' },
  },
  active_runs: {
    shortLabel: 'Active process runs',
    operatorDefinition: 'Count of process runs in running/in_progress/started.',
    formula: "COUNT(cc_process_runs.id) WHERE status IN ('running','in_progress','started')",
    grain: 'Point-in-time snapshot · process orchestration layer',
    owner: 'Ops automation owner',
    cadence: 'Real-time monitor, hourly reliability check',
    mondayGate: 'Operator throughput continuity',
    goRule: 'Healthy when > 0',
    hierarchy: { northStar: 'weekly_qualified_pipeline_velocity', l1: 'queue_health', l2: 'active_runs' },
  },
};

export async function fetchOperationalKpis({ pool, supabase } = {}) {
  const generatedAt = new Date().toISOString();
  if (!pool && !supabase) return { generated_at: generatedAt, freshness: 'local placeholder', cards: [] };
  const metricQueries = [
    { key: 'delegations_24h', label: KPI_META.delegations_24h.shortLabel, sql: `select count(*)::int as value from public.cc_delegations where created_at >= now() - interval '24 hours'` },
    { key: 'completed_24h', label: KPI_META.completed_24h.shortLabel, sql: `select count(*)::int as value from public.cc_delegations where completed_at >= now() - interval '24 hours'` },
    { key: 'open_priorities', label: KPI_META.open_priorities.shortLabel, sql: `select count(*)::int as value from public.cc_priorities where lower(coalesce(status,'')) not in ('done','completed','cancelled')` },
    { key: 'active_runs', label: KPI_META.active_runs.shortLabel, sql: `select count(*)::int as value from public.cc_process_runs where status in ('running','in_progress','started')` },
  ];

  if (!pool) {
    return {
      generated_at: generatedAt,
      freshness: 'supabase mode',
      cards: metricQueries.map((m) => ({ key: m.key, label: m.label, value: 'n/a', freshness: 'pending wiring', deltaText: 'Δ — baseline pending', deltaClass: 'info' })),
    };
  }

  const settled = await Promise.allSettled(metricQueries.map((m) => pool.query(m.sql).then((r) => r.rows[0]?.value ?? 'n/a')));
  return {
    generated_at: generatedAt,
    freshness: 'live from postgres',
    cards: settled.map((r, i) => ({
      key: metricQueries[i].key,
      label: metricQueries[i].label,
      value: r.status === 'fulfilled' ? r.value : 'n/a',
      freshness: r.status === 'fulfilled' ? 'live from postgres' : 'query failed',
      deltaText: 'Δ — baseline pending',
      deltaClass: r.status === 'fulfilled' ? 'info' : 'warn',
    })),
  };
}

export function kpiGateStatus(card = {}) {
  const key = String(card.key || '');
  const value = Number(card.value);
  const numeric = Number.isFinite(value);
  if (!numeric) return { status: 'INFO', className: 'info', note: 'Value pending' };
  if (key === 'delegations_24h') return value >= 10 ? { status: 'GO', className: 'ok', note: 'Supports queue flow' } : { status: 'ATTN', className: 'warn', note: 'Dispatch rate below baseline' };
  if (key === 'completed_24h') return { status: 'INFO', className: 'info', note: 'Use ratio check below' };
  if (key === 'open_priorities') return value <= 25 ? { status: 'GO', className: 'ok', note: 'Backlog bounded' } : { status: 'ATTN', className: 'warn', note: 'Backlog above gate target' };
  if (key === 'active_runs') return value > 0 ? { status: 'GO', className: 'ok', note: 'Run activity present' } : { status: 'ATTN', className: 'warn', note: 'No active runs' };
  return { status: 'INFO', className: 'info', note: 'No gate mapping' };
}

export function getCompletionRatio(kpis = {}) {
  const delegations = Number((kpis.cards || []).find((c) => c.key === 'delegations_24h')?.value);
  const completed = Number((kpis.cards || []).find((c) => c.key === 'completed_24h')?.value);
  if (!Number.isFinite(delegations) || !Number.isFinite(completed) || delegations <= 0) {
    return { valueText: 'n/a', status: 'INFO', className: 'info' };
  }
  const ratio = completed / delegations;
  return { valueText: `${(ratio * 100).toFixed(1)}%`, status: ratio >= 0.55 ? 'GO' : 'ATTN', className: ratio >= 0.55 ? 'ok' : 'warn' };
}

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
};

export function deriveHomeOutcomeTelemetry({ qualifiedAccounts = [], meetingPipeline = {}, acquisitionMetrics = {}, nowTs = Date.now(), formatDateTime = (v) => String(v), normalizePilotHandoffStage = (v) => String(v || '') } = {}) {
  const allAccounts = qualifiedAccounts || [];
  const pilotCandidates = allAccounts.filter((item) => normalizePilotHandoffStage(item.pipeline_stage) === 'pilot_candidate');
  const qualifiedAccountsOnly = allAccounts.filter((item) => normalizePilotHandoffStage(item.pipeline_stage) === 'qualified');
  const unroutedPilotCandidates = pilotCandidates.filter((item) => !item?.pilot_onboarding_routed_at);

  const weekAgo = nowTs - (7 * 24 * 60 * 60 * 1000);
  const qualifiedAccountsPerWeek = allAccounts.filter((item) => {
    const t = toDate(item?.created_at)?.getTime();
    return Number.isFinite(t) && t >= weekAgo;
  }).length;

  const totals = acquisitionMetrics?.totals || {};
  const goal = acquisitionMetrics?.goal_metrics || {};
  const positiveReplies = Number(totals.positive_replies ?? totals.positive_reply_count ?? 0);
  const meetingsBooked = Number(goal.meetings_booked ?? 0);
  const pilotCandidateConversion = qualifiedAccountsOnly.length > 0 ? Math.round((pilotCandidates.length / qualifiedAccountsOnly.length) * 100) : null;

  const pendingReplies = (meetingPipeline?.dueClientUpdates || []).filter((item) => {
    const status = String(item?.status || '').toLowerCase();
    return !status || status === 'pending' || status === 'in_progress';
  });
  const overdueReplies = pendingReplies.filter((item) => {
    const due = toDate(item?.due_date || item?.created_at);
    return due ? due.getTime() < nowTs : false;
  });
  const nextDueAt = pendingReplies
    .map((item) => toDate(item?.due_date || item?.created_at))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime())[0] || null;

  const minutesToNextAction = nextDueAt ? Math.round((nextDueAt.getTime() - nowTs) / (1000 * 60)) : null;
  const nextHumanActionText = nextDueAt
    ? (minutesToNextAction <= 0 ? `Overdue now (${Math.abs(minutesToNextAction)}m) · ${overdueReplies.length} overdue` : `${minutesToNextAction}m · next due ${formatDateTime(nextDueAt.toISOString())}`)
    : (unroutedPilotCandidates.length > 0 ? `${unroutedPilotCandidates.length} pilot candidates need onboarding route` : 'No pending human actions');

  return {
    qualifiedAccountsPerWeek,
    positiveReplies,
    meetingsBooked,
    pilotCandidateConversion,
    pilotCandidates: pilotCandidates.length,
    qualifiedBase: qualifiedAccountsOnly.length,
    nextHumanActionText,
  };
}

const formatCurrencyUsd = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'n/a';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};

export function deriveHomeKpiStripTelemetry({ qualifiedAccounts = [], acquisitionMetrics = {}, campaignSummary = {}, kpis = {}, normalizePilotHandoffStage = (v) => String(v || '') } = {}) {
  const stageCounts = (qualifiedAccounts || []).reduce((acc, row) => {
    const stage = normalizePilotHandoffStage(row?.pipeline_stage);
    if (stage === 'discovery') acc.discovery += 1;
    else if (stage === 'qualified') acc.qualified += 1;
    acc.total += 1;
    return acc;
  }, { qualified: 0, discovery: 0, total: 0 });

  const totals = acquisitionMetrics?.totals || {};
  const goal = acquisitionMetrics?.goal_metrics || {};
  const classifiedReplies = Number(totals.classified_replies || 0);
  const positiveReplies = Number(totals.positive_replies ?? totals.positive_reply_count ?? 0);
  const positiveReplyRate = Number(goal.positive_reply_rate || 0);
  const meetingsBooked = Number(goal.meetings_booked || 0);
  const qualifiedPerDay = Number(goal.new_qualified_accounts_per_day || 0);

  const mrrValue = Number(campaignSummary?.revenue);
  const mrr = {
    value: Number.isFinite(mrrValue) ? mrrValue : null,
    display: Number.isFinite(mrrValue) ? formatCurrencyUsd(mrrValue) : 'n/a',
    source: Number.isFinite(mrrValue) ? 'campaign_metrics.revenue (last_7d proxy)' : 'campaign_metrics unavailable',
  };

  const keyMetrics = {
    newQualifiedPerDay: qualifiedPerDay,
    positiveReplies,
    meetingsBooked,
    classifiedReplies,
    positiveReplyRate,
    positiveReplyRateText: `${(positiveReplyRate * 100).toFixed(1)}%`,
    delegations24h: Number((kpis.cards || []).find((c) => c.key === 'delegations_24h')?.value ?? 0),
    completed24h: Number((kpis.cards || []).find((c) => c.key === 'completed_24h')?.value ?? 0),
  };

  return {
    stage_counts: stageCounts,
    mrr,
    key_metrics: keyMetrics,
  };
}
