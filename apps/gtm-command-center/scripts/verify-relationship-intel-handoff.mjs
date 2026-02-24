#!/usr/bin/env node

const baseUrl = process.env.GTM_BASE_URL || 'http://127.0.0.1:1981';

async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`);
  const body = await res.text();
  let json = null;
  try { json = JSON.parse(body); } catch {}
  return { ok: res.ok, status: res.status, json, body };
}

function fail(message, extra = {}) {
  console.error(JSON.stringify({ ok: false, marker: 'relationship-intelligence-handoff-verify-v1', message, ...extra }, null, 2));
  process.exit(1);
}

const intelligence = await getJson('/api/relationships/intelligence');
if (!intelligence.ok || !intelligence.json) fail('Failed to fetch /api/relationships/intelligence', { status: intelligence.status });

const queue = await getJson('/api/handoff-queue');
if (!queue.ok || !queue.json) fail('Failed to fetch /api/handoff-queue', { status: queue.status });

const recommendations = Array.isArray(intelligence.json.recommendations) ? intelligence.json.recommendations : [];
const requiredFields = ['rationale', 'owner', 'next_action', 'weighted_priority_score'];
const missingFieldRows = recommendations
  .map((row, idx) => ({ idx, missing: requiredFields.filter((key) => row[key] === undefined || row[key] === null || row[key] === '') }))
  .filter((x) => x.missing.length > 0);

const badHandoffRoutes = recommendations
  .map((row, idx) => ({ idx, route: row?.handoff_path?.route || '' }))
  .filter((x) => x.route !== '/actions?source=relationship-intelligence');

if (missingFieldRows.length > 0) fail('Recommendation payload missing required fields', { missingFieldRows });
if (badHandoffRoutes.length > 0) fail('Recommendation handoff route is not wired to Actions queue', { badHandoffRoutes });

const output = {
  ok: true,
  marker: 'relationship-intelligence-handoff-verify-v1',
  verified_at: new Date().toISOString(),
  thresholds_marker: 'relationship-intelligence-priority-weighting-v1',
  required_fields_marker: 'relationship-recommendation-required-fields-v1',
  handoff_marker: 'relationship-intelligence-handoff-path-v1',
  queue_marker: queue.json.marker,
  recommendation_count: recommendations.length,
  queue_count: Array.isArray(queue.json.data) ? queue.json.data.length : 0,
  sample: recommendations[0] ? {
    brand: recommendations[0].brand,
    owner: recommendations[0].owner,
    next_action: recommendations[0].next_action,
    rationale: recommendations[0].rationale,
    confidence: recommendations[0].weighted_priority_score,
    handoff_route: recommendations[0]?.handoff_path?.route,
  } : null,
};

console.log(JSON.stringify(output, null, 2));
