import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { evaluateMondayReadiness } from './monday-readiness.mjs';
import { getSupabaseDailyReportBridge } from './supabase-reporting-bridge.mjs';

async function readAlertRules(alertRulesPath) {
  try {
    const raw = await readFile(alertRulesPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.rules) ? parsed.rules : [];
  } catch {
    return [];
  }
}

async function getKpis({ pool, supabase, supabaseBridge = null }) {
  const generatedAt = new Date().toISOString();
  if (!pool && !supabase) return { generated_at: generatedAt, freshness: 'local placeholder', cards: [] };

  if (supabase && !pool) {
    if (supabaseBridge?.kpis) {
      return {
        generated_at: generatedAt,
        freshness: supabaseBridge.source || 'supabase reporting views',
        cards: supabaseBridge.kpis,
      };
    }

    return {
      generated_at: generatedAt,
      freshness: 'supabase mode (placeholder)',
      cards: [
        { key: 'delegations_24h', label: 'Delegations (24h)', value: 'n/a' },
        { key: 'completed_24h', label: 'Completed (24h)', value: 'n/a' },
        { key: 'open_priorities', label: 'Open priorities', value: 'n/a' },
        { key: 'active_runs', label: 'Active runs', value: 'n/a' },
      ],
    };
  }

  const metricQueries = [
    { key: 'delegations_24h', label: 'Delegations (24h)', sql: `select count(*)::int as value from public.cc_delegations where created_at >= now() - interval '24 hours'` },
    { key: 'completed_24h', label: 'Completed (24h)', sql: `select count(*)::int as value from public.cc_delegations where completed_at >= now() - interval '24 hours'` },
    { key: 'open_priorities', label: 'Open priorities', sql: `select count(*)::int as value from public.cc_priorities where lower(coalesce(status,'')) not in ('done','completed','cancelled')` },
    { key: 'active_runs', label: 'Active runs', sql: `select count(*)::int as value from public.cc_process_runs where status in ('running','in_progress','started')` },
  ];

  const settled = await Promise.allSettled(metricQueries.map((m) => pool.query(m.sql).then((r) => r.rows[0]?.value ?? 'n/a')));
  return {
    generated_at: generatedAt,
    freshness: 'live from postgres',
    cards: settled.map((r, i) => ({
      key: metricQueries[i].key,
      label: metricQueries[i].label,
      value: r.status === 'fulfilled' ? r.value : 'n/a',
    })),
  };
}

async function getSequenceActivity({ pool, supabase, supabaseBridge = null }) {
  const statusCounts = { queued: 0, active: 0, paused: 0, completed: 0, cancelled: 0 };

  if (supabase && !pool) {
    if (supabaseBridge?.sequenceActivity) {
      return supabaseBridge.sequenceActivity;
    }

    return {
      enrollment_status_counts: statusCounts,
      recent_events_24h_count: 0,
      recent_events: [],
    };
  }

  if (!pool) {
    return {
      enrollment_status_counts: statusCounts,
      recent_events_24h_count: 0,
      recent_events: [],
    };
  }

  const [countsResult, recentResult] = await Promise.all([
    pool.query('select status, count(*)::int as count from public.cc_sequence_enrollments group by status').catch(() => ({ rows: [] })),
    pool.query(`select id,event_type,lead_key,created_at from public.cc_activity_log where event_type like 'sequence_%' and created_at >= now() - interval '24 hours' order by created_at desc limit 20`).catch(() => ({ rows: [] })),
  ]);

  for (const row of countsResult.rows || []) {
    const key = String(row.status || '').toLowerCase();
    if (Object.hasOwn(statusCounts, key)) statusCounts[key] = Number(row.count || 0);
  }

  return {
    enrollment_status_counts: statusCounts,
    recent_events_24h_count: (recentResult.rows || []).length,
    recent_events: recentResult.rows || [],
  };
}

function summarizeAlerts(rules = []) {
  const severityCounts = { info: 0, warning: 0, critical: 0, other: 0 };
  for (const rule of rules) {
    const key = String(rule?.severity || '').toLowerCase();
    if (Object.hasOwn(severityCounts, key)) severityCounts[key] += 1;
    else severityCounts.other += 1;
  }
  return {
    rules_count: rules.length,
    severity_counts: severityCounts,
    rules,
  };
}

export async function collectDailyGtmSummary({ runtimeMode = 'none', pool = null, supabase = null, projectRoot = process.cwd() } = {}) {
  const alertRulesPath = process.env.ALERT_RULES_FILE || path.resolve(projectRoot, 'lib/alert-rules.json');

  const supabaseBridge = runtimeMode === 'supabase' && supabase && !pool
    ? await getSupabaseDailyReportBridge({ supabase, env: process.env })
    : null;

  const [kpis, sequenceActivity, alertRules, readiness] = await Promise.all([
    getKpis({ pool, supabase, supabaseBridge }),
    getSequenceActivity({ pool, supabase, supabaseBridge }),
    readAlertRules(alertRulesPath),
    evaluateMondayReadiness({ runtimeMode, projectRoot }),
  ]);

  return {
    generated_at: new Date().toISOString(),
    mode: runtimeMode,
    kpis,
    sequence_activity: sequenceActivity,
    alerts: summarizeAlerts(alertRules),
    readiness,
  };
}

export function renderDailyGtmSummaryMarkdown(summary = {}, dateStamp = '') {
  const cards = summary?.kpis?.cards || [];
  const cardLine = (key) => cards.find((c) => c.key === key)?.value ?? 'n/a';
  const sequenceCounts = summary?.sequence_activity?.enrollment_status_counts || {};
  const alerts = summary?.alerts || {};
  const readiness = summary?.readiness || {};

  return `# Daily GTM Summary (${dateStamp})\n\n- Generated at: ${summary.generated_at || 'n/a'}\n- Runtime mode: ${summary.mode || 'n/a'}\n\n## KPIs\n- Delegations (24h): ${cardLine('delegations_24h')}\n- Completed (24h): ${cardLine('completed_24h')}\n- Open priorities: ${cardLine('open_priorities')}\n- Active runs: ${cardLine('active_runs')}\n\n## Sequence activity\n- Enrollments (queued): ${sequenceCounts.queued ?? 0}\n- Enrollments (active): ${sequenceCounts.active ?? 0}\n- Enrollments (paused): ${sequenceCounts.paused ?? 0}\n- Enrollments (completed): ${sequenceCounts.completed ?? 0}\n- Enrollments (cancelled): ${sequenceCounts.cancelled ?? 0}\n- Recent sequence events (24h): ${summary?.sequence_activity?.recent_events_24h_count ?? 0}\n\n## Alerts\n- Rules configured: ${alerts.rules_count ?? 0}\n- Critical: ${alerts?.severity_counts?.critical ?? 0}\n- Warning: ${alerts?.severity_counts?.warning ?? 0}\n- Info: ${alerts?.severity_counts?.info ?? 0}\n\n## Monday readiness\n- Decision: ${readiness.readiness_state || 'n/a'}\n- Gates pass/fail: ${readiness.pass_count ?? 0}/${(readiness.pass_count ?? 0) + (readiness.fail_count ?? 0)}\n- Queue counts: now=${readiness?.queue_counts?.now ?? 0}, next=${readiness?.queue_counts?.next ?? 0}, blocked=${readiness?.queue_counts?.blocked ?? 0}, waiting_on_user=${readiness?.queue_counts?.waiting_on_user ?? 0}, done=${readiness?.queue_counts?.done ?? 0}\n`;
}
