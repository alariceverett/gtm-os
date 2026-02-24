function hasSupabaseClient(supabase) {
  return Boolean(supabase && typeof supabase.from === 'function');
}

function toNumberOrNA(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 'n/a';
}

function toIntegerOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * Reporting view names are env-configurable so local-first mode can stay unblocked
 * while Supabase reporting views are introduced incrementally.
 */
export function resolveSupabaseReportingConfig(env = process.env) {
  return {
    views: {
      dailyKpis: env.CC_SUPABASE_DAILY_KPI_VIEW || 'cc_reporting_daily_kpis_v1',
      dailySequenceActivity: env.CC_SUPABASE_DAILY_SEQUENCE_ACTIVITY_VIEW || 'cc_reporting_sequence_activity_v1',
      weeklyDelivery: env.CC_SUPABASE_WEEKLY_DELIVERY_VIEW || 'cc_reporting_weekly_delivery_v1',
      weeklyCac: env.CC_SUPABASE_WEEKLY_CAC_VIEW || 'cc_reporting_weekly_cac_v1',
      weeklyRoas: env.CC_SUPABASE_WEEKLY_ROAS_VIEW || 'cc_reporting_weekly_roas_v1',
      weeklyControlVsTest: env.CC_SUPABASE_WEEKLY_CONTROL_TEST_VIEW || 'cc_reporting_weekly_control_vs_test_v1',
    },
  };
}

async function fetchSingleRow(supabase, viewName, fallback = null) {
  if (!hasSupabaseClient(supabase)) return fallback;
  const { data, error } = await supabase.from(viewName).select('*').limit(1);
  if (error) return fallback;
  return data?.[0] || fallback;
}

async function fetchRows(supabase, viewName, fallback = []) {
  if (!hasSupabaseClient(supabase)) return fallback;
  const { data, error } = await supabase.from(viewName).select('*');
  if (error) return fallback;
  return Array.isArray(data) ? data : fallback;
}

/**
 * Mapping layer/interface for daily KPI cards.
 */
export function mapDailyKpiRowToCards(row = {}) {
  return [
    { key: 'delegations_24h', label: 'Delegations (24h)', value: toNumberOrNA(row.delegations_24h) },
    { key: 'completed_24h', label: 'Completed (24h)', value: toNumberOrNA(row.completed_delegations_24h) },
    { key: 'open_priorities', label: 'Open priorities', value: toNumberOrNA(row.open_priorities) },
    { key: 'active_runs', label: 'Active runs', value: toNumberOrNA(row.active_process_runs) },
  ];
}

/**
 * Mapping layer/interface for sequence activity shape used by summary renderer.
 */
export function mapSequenceActivityRows(rows = []) {
  const statusCounts = { queued: 0, active: 0, paused: 0, completed: 0, cancelled: 0 };
  const recentEvents = [];

  for (const row of rows) {
    const status = String(row.status || '').toLowerCase();
    if (Object.hasOwn(statusCounts, status)) {
      statusCounts[status] = toIntegerOrZero(row.count);
    }

    if (row.recent_event_type) {
      recentEvents.push({
        id: row.recent_event_id || null,
        event_type: row.recent_event_type,
        lead_key: row.recent_event_lead_key || null,
        created_at: row.recent_event_created_at || null,
      });
    }
  }

  return {
    enrollment_status_counts: statusCounts,
    recent_events_24h_count: recentEvents.length,
    recent_events: recentEvents,
  };
}

export async function getSupabaseDailyReportBridge({ supabase, env = process.env } = {}) {
  const { views } = resolveSupabaseReportingConfig(env);

  const [kpiRow, sequenceRows] = await Promise.all([
    fetchSingleRow(supabase, views.dailyKpis, null),
    fetchRows(supabase, views.dailySequenceActivity, []),
  ]);

  const hasKpiData = Boolean(kpiRow);
  const hasSequenceData = Array.isArray(sequenceRows) && sequenceRows.length > 0;

  return {
    source: hasKpiData || hasSequenceData ? 'supabase reporting views' : 'supabase mode (fallback placeholder)',
    kpis: hasKpiData ? mapDailyKpiRowToCards(kpiRow) : null,
    sequenceActivity: hasSequenceData ? mapSequenceActivityRows(sequenceRows) : null,
  };
}

function mapWeeklyDeliveryRow(row = {}) {
  return {
    delivery_events_7d: toNumberOrNA(row.delivery_events_7d),
    lead_magnets_live: toNumberOrNA(row.lead_magnets_live),
    teaser_products_live: toNumberOrNA(row.teaser_products_live),
    delivery_score: toNumberOrNA(row.delivery_score),
  };
}

function mapWeeklyCacRow(row = {}) {
  return {
    spend_7d: toNumberOrNA(row.spend_7d),
    conversions_7d: toNumberOrNA(row.conversions_7d),
    cac_7d: toNumberOrNA(row.cac_7d),
  };
}

function mapWeeklyRoasRow(row = {}) {
  return {
    proxy_7d_roas: toNumberOrNA(row.proxy_7d_roas),
    actual_d60_roas: toNumberOrNA(row.actual_d60_roas),
    actual_field: row.actual_field || 'metadata.d60_roas_actual',
  };
}

function mapWeeklyControlVsTestRow(row = {}) {
  return {
    control_roas_7d: toNumberOrNA(row.control_roas_7d),
    test_roas_7d: toNumberOrNA(row.test_roas_7d),
    d60_lift_pct_vs_control: toNumberOrNA(row.d60_lift_pct_vs_control),
    split_field: row.split_field || 'metadata.variant_group',
  };
}

export async function getSupabaseWeeklyReportBridge({ supabase, env = process.env } = {}) {
  const { views } = resolveSupabaseReportingConfig(env);

  const [deliveryRow, cacRow, roasRow, controlRow] = await Promise.all([
    fetchSingleRow(supabase, views.weeklyDelivery, null),
    fetchSingleRow(supabase, views.weeklyCac, null),
    fetchSingleRow(supabase, views.weeklyRoas, null),
    fetchSingleRow(supabase, views.weeklyControlVsTest, null),
  ]);

  return {
    source: 'supabase reporting views bridge',
    delivery: deliveryRow ? mapWeeklyDeliveryRow(deliveryRow) : null,
    cac: cacRow ? mapWeeklyCacRow(cacRow) : null,
    d60_roas: roasRow ? mapWeeklyRoasRow(roasRow) : null,
    control_vs_test: controlRow ? mapWeeklyControlVsTestRow(controlRow) : null,
  };
}
