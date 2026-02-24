import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getSupabaseWeeklyReportBridge } from './supabase-reporting-bridge.mjs';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function readSignalHealthNotes(notesPath) {
  try {
    const raw = await readFile(notesPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.notes)) return parsed.notes.map((n) => String(n)).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}

async function getDelivery({ pool, supabase, supabaseBridge = null }) {
  if (supabase && !pool) {
    if (supabaseBridge?.delivery) {
      return { ...supabaseBridge.delivery, source: supabaseBridge.source || 'supabase reporting views' };
    }

    return {
      delivery_events_7d: 'n/a',
      lead_magnets_live: 'n/a',
      teaser_products_live: 'n/a',
      delivery_score: 'n/a',
      source: 'supabase mode (placeholder)',
    };
  }

  if (!pool) {
    return {
      delivery_events_7d: 0,
      lead_magnets_live: 0,
      teaser_products_live: 0,
      delivery_score: 'n/a',
      source: 'local placeholder',
    };
  }

  const [eventsRes, lmRes, tpRes] = await Promise.all([
    pool.query(`select count(*)::int as count from public.delivery_events where occurred_at >= now() - interval '7 days'`).catch(() => ({ rows: [{ count: 0 }] })),
    pool.query(`select count(*)::int as count from public.lead_magnets where lower(coalesce(status,'')) = 'live'`).catch(() => ({ rows: [{ count: 0 }] })),
    pool.query(`select count(*)::int as count from public.teaser_products where lower(coalesce(status,'')) = 'live'`).catch(() => ({ rows: [{ count: 0 }] })),
  ]);

  const deliveryEvents = toNumber(eventsRes.rows?.[0]?.count, 0);
  const liveAssets = toNumber(lmRes.rows?.[0]?.count, 0) + toNumber(tpRes.rows?.[0]?.count, 0);
  const deliveryScore = liveAssets > 0 ? Number((deliveryEvents / liveAssets).toFixed(2)) : 'n/a';

  return {
    delivery_events_7d: deliveryEvents,
    lead_magnets_live: toNumber(lmRes.rows?.[0]?.count, 0),
    teaser_products_live: toNumber(tpRes.rows?.[0]?.count, 0),
    delivery_score: deliveryScore,
    source: 'live from postgres',
  };
}

async function getCac({ pool, supabase, supabaseBridge = null }) {
  if (supabase && !pool) {
    if (supabaseBridge?.cac) {
      return { ...supabaseBridge.cac, source: supabaseBridge.source || 'supabase reporting views' };
    }

    return { spend_7d: 'n/a', conversions_7d: 'n/a', cac_7d: 'n/a', source: 'supabase mode (placeholder)' };
  }

  if (!pool) {
    return { spend_7d: 0, conversions_7d: 0, cac_7d: 'n/a', source: 'local placeholder' };
  }

  const res = await pool
    .query(`
      select
        coalesce(sum(spend),0)::numeric as spend,
        coalesce(sum(conversions),0)::int as conversions
      from public.campaign_metrics
      where metric_date >= current_date - interval '7 days'
    `)
    .catch(() => ({ rows: [{ spend: 0, conversions: 0 }] }));

  const spend = toNumber(res.rows?.[0]?.spend, 0);
  const conversions = toNumber(res.rows?.[0]?.conversions, 0);

  return {
    spend_7d: Number(spend.toFixed(2)),
    conversions_7d: conversions,
    cac_7d: conversions > 0 ? Number((spend / conversions).toFixed(2)) : 'n/a',
    source: 'live from postgres',
  };
}

async function getD60Roas({ pool, supabase, supabaseBridge = null }) {
  if (supabase && !pool) {
    if (supabaseBridge?.d60_roas) {
      return { ...supabaseBridge.d60_roas, source: supabaseBridge.source || 'supabase reporting views' };
    }

    return {
      proxy_7d_roas: 'n/a',
      actual_d60_roas: 'n/a',
      actual_field: 'metadata.d60_roas_actual',
      source: 'supabase mode (placeholder)',
    };
  }

  if (!pool) {
    return {
      proxy_7d_roas: 'n/a',
      actual_d60_roas: 'n/a',
      actual_field: 'metadata.d60_roas_actual',
      source: 'local placeholder',
    };
  }

  const [proxyRes, actualRes] = await Promise.all([
    pool
      .query(`
        select
          coalesce(sum(spend),0)::numeric as spend,
          coalesce(sum(revenue),0)::numeric as revenue
        from public.campaign_metrics
        where metric_date >= current_date - interval '7 days'
      `)
      .catch(() => ({ rows: [{ spend: 0, revenue: 0 }] })),
    pool
      .query(`
        select avg((metadata->>'d60_roas_actual')::numeric) as d60_roas_actual
        from public.campaign_metrics
        where metadata ? 'd60_roas_actual'
      `)
      .catch(() => ({ rows: [{ d60_roas_actual: null }] })),
  ]);

  const spend = toNumber(proxyRes.rows?.[0]?.spend, 0);
  const revenue = toNumber(proxyRes.rows?.[0]?.revenue, 0);
  const proxyRoas = spend > 0 ? Number((revenue / spend).toFixed(2)) : 'n/a';
  const actualRoasRaw = actualRes.rows?.[0]?.d60_roas_actual;
  const actualRoas = Number.isFinite(Number(actualRoasRaw)) ? Number(Number(actualRoasRaw).toFixed(2)) : 'n/a';

  return {
    proxy_7d_roas: proxyRoas,
    actual_d60_roas: actualRoas,
    actual_field: 'metadata.d60_roas_actual',
    source: 'live from postgres',
  };
}

function buildSignalHealthNotes(scorecard = {}, configuredNotes = []) {
  const notes = [];
  const deliveryEvents = toNumber(scorecard?.delivery?.delivery_events_7d, 0);
  const cac = scorecard?.cac?.cac_7d;
  const proxyRoas = scorecard?.d60_roas?.proxy_7d_roas;
  const actualRoas = scorecard?.d60_roas?.actual_d60_roas;

  if (deliveryEvents < 5) notes.push('Low delivery activity in the last 7d; risk of weak learning loops.');
  if (typeof cac === 'number' && cac > 200) notes.push('CAC is elevated (>200) and may pressure unit economics.');
  if (typeof proxyRoas === 'number' && proxyRoas < 1.2) notes.push('ROAS proxy is below 1.2; monitor creative/audience quality.');
  if (actualRoas === 'n/a') notes.push('D60 actual ROAS not yet populated; using proxy field for interim decisions.');

  return [...notes, ...configuredNotes].slice(0, 8);
}

function computeTrajectoryFlag(scorecard = {}) {
  const deliveryEvents = toNumber(scorecard?.delivery?.delivery_events_7d, 0);
  const cac = scorecard?.cac?.cac_7d;
  const proxyRoas = scorecard?.d60_roas?.proxy_7d_roas;

  const healthyDelivery = deliveryEvents >= 5;
  const healthyCac = typeof cac === 'number' ? cac <= 200 : false;
  const healthyRoas = typeof proxyRoas === 'number' ? proxyRoas >= 1.2 : false;

  const passed = [healthyDelivery, healthyCac, healthyRoas].filter(Boolean).length;
  if (passed === 3) return 'GO';
  if (passed <= 1) return 'NO_GO';
  return 'WATCH';
}

async function getControlVsTest({ pool, supabase, supabaseBridge = null }) {
  if (supabase && !pool) {
    if (supabaseBridge?.control_vs_test) {
      return { ...supabaseBridge.control_vs_test, source: supabaseBridge.source || 'supabase reporting views' };
    }

    return {
      control_roas_7d: 'n/a',
      test_roas_7d: 'n/a',
      d60_lift_pct_vs_control: 'n/a',
      split_field: 'metadata.variant_group',
      source: 'supabase mode (placeholder)',
    };
  }

  if (!pool) {
    return {
      control_roas_7d: 'n/a',
      test_roas_7d: 'n/a',
      d60_lift_pct_vs_control: 'n/a',
      split_field: 'metadata.variant_group',
      source: 'local placeholder',
    };
  }

  const grouped = await pool
    .query(`
      select
        lower(coalesce(metadata->>'variant_group','')) as variant_group,
        coalesce(sum(spend),0)::numeric as spend,
        coalesce(sum(revenue),0)::numeric as revenue
      from public.campaign_metrics
      where metric_date >= current_date - interval '7 days'
      group by 1
    `)
    .catch(() => ({ rows: [] }));

  const pickRoas = (name) => {
    const row = grouped.rows.find((r) => (r.variant_group || '').trim() === name);
    if (!row) return 'n/a';
    const spend = toNumber(row.spend, 0);
    const revenue = toNumber(row.revenue, 0);
    return spend > 0 ? Number((revenue / spend).toFixed(2)) : 'n/a';
  };

  const controlRoas = pickRoas('control');
  const testRoas = pickRoas('test');
  const liftPct = typeof controlRoas === 'number' && controlRoas > 0 && typeof testRoas === 'number'
    ? Number((((testRoas - controlRoas) / controlRoas) * 100).toFixed(1))
    : 'n/a';

  return {
    control_roas_7d: controlRoas,
    test_roas_7d: testRoas,
    d60_lift_pct_vs_control: liftPct,
    split_field: 'metadata.variant_group',
    source: 'live from postgres',
  };
}

function buildRecommendationStatus(scorecard = {}) {
  const trajectory = scorecard?.trajectory_flag;
  const lift = scorecard?.control_vs_test?.d60_lift_pct_vs_control;

  if (trajectory === 'GO' && typeof lift === 'number' && lift >= 10) {
    return {
      status: 'RECOMMEND_GO',
      summary: 'Scale recommendation on track: D60 lift is at/above +10% vs control.',
    };
  }

  if (trajectory === 'NO_GO' || (typeof lift === 'number' && lift < 0)) {
    return {
      status: 'RECOMMEND_NO_GO',
      summary: 'Hold rollout: pilot performance is below control or operating health is off-track.',
    };
  }

  return {
    status: 'RECOMMEND_WATCH',
    summary: 'Continue pilot and reassess next week; current evidence is directionally positive but not decisive.',
  };
}

export async function collectWeeklyScorecard({ runtimeMode = 'none', pool = null, supabase = null, projectRoot = process.cwd() } = {}) {
  const signalNotesPath = process.env.PILOT_SIGNAL_NOTES_FILE || path.resolve(projectRoot, 'lib/pilot-signal-notes.json');

  const supabaseBridge = runtimeMode === 'supabase' && supabase && !pool
    ? await getSupabaseWeeklyReportBridge({ supabase, env: process.env })
    : null;

  const [delivery, cac, d60_roas, control_vs_test, configuredNotes] = await Promise.all([
    getDelivery({ pool, supabase, supabaseBridge }),
    getCac({ pool, supabase, supabaseBridge }),
    getD60Roas({ pool, supabase, supabaseBridge }),
    getControlVsTest({ pool, supabase, supabaseBridge }),
    readSignalHealthNotes(signalNotesPath),
  ]);

  const base = {
    generated_at: new Date().toISOString(),
    mode: runtimeMode,
    delivery,
    cac,
    d60_roas,
    control_vs_test,
  };

  const signal_health_notes = buildSignalHealthNotes(base, configuredNotes);
  const trajectory_flag = computeTrajectoryFlag(base);
  const recommendation = buildRecommendationStatus({ ...base, trajectory_flag });

  return { ...base, signal_health_notes, trajectory_flag, recommendation };
}

export function renderWeeklyScorecardMarkdown(scorecard = {}, dateStamp = '') {
  return `# Weekly Pilot Scorecard (${dateStamp})\n\n## Executive snapshot\n- Recommendation status: ${scorecard?.recommendation?.status || 'n/a'}\n- Recommendation summary: ${scorecard?.recommendation?.summary || 'n/a'}\n- D60 ROAS lift trajectory (vs control): ${scorecard?.control_vs_test?.d60_lift_pct_vs_control ?? 'n/a'}${typeof scorecard?.control_vs_test?.d60_lift_pct_vs_control === 'number' ? '%' : ''}\n- Go/No-Go trajectory flag: ${scorecard.trajectory_flag || 'n/a'}\n\n## D60 ROAS lift trajectory\n- Proxy ROAS (7d): ${scorecard?.d60_roas?.proxy_7d_roas ?? 'n/a'}\n- D60 actual ROAS: ${scorecard?.d60_roas?.actual_d60_roas ?? 'n/a'}\n- Actual field source: ${scorecard?.d60_roas?.actual_field ?? 'n/a'}\n\n## Control vs test visibility\n- Control ROAS (7d): ${scorecard?.control_vs_test?.control_roas_7d ?? 'n/a'}\n- Test ROAS (7d): ${scorecard?.control_vs_test?.test_roas_7d ?? 'n/a'}\n- D60 ROAS lift vs control: ${scorecard?.control_vs_test?.d60_lift_pct_vs_control ?? 'n/a'}${typeof scorecard?.control_vs_test?.d60_lift_pct_vs_control === 'number' ? '%' : ''}\n- Split field: ${scorecard?.control_vs_test?.split_field ?? 'n/a'}\n\n## Core operating inputs\n- Generated at: ${scorecard.generated_at || 'n/a'}\n- Runtime mode: ${scorecard.mode || 'n/a'}\n- Delivery events (7d): ${scorecard?.delivery?.delivery_events_7d ?? 'n/a'}\n- Live lead magnets: ${scorecard?.delivery?.lead_magnets_live ?? 'n/a'}\n- Live teaser products: ${scorecard?.delivery?.teaser_products_live ?? 'n/a'}\n- Delivery score: ${scorecard?.delivery?.delivery_score ?? 'n/a'}\n- Spend (7d): ${scorecard?.cac?.spend_7d ?? 'n/a'}\n- Conversions (7d): ${scorecard?.cac?.conversions_7d ?? 'n/a'}\n- CAC (7d): ${scorecard?.cac?.cac_7d ?? 'n/a'}\n\n## Signal health notes\n${(scorecard?.signal_health_notes || []).length ? (scorecard.signal_health_notes.map((n) => `- ${n}`).join('\n')) : '- none'}\n`;
}
