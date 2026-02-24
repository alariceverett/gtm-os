#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv = []) {
  const flags = new Set(argv);
  const kv = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [k, ...rest] = arg.slice(2).split('=');
    if (rest.length) kv[k] = rest.join('=');
  }
  return { flags, kv };
}

async function getText(url) {
  const res = await fetch(url);
  const text = await res.text();
  return { res, text };
}

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try { return { res, json: JSON.parse(text), text }; } catch { return { res, json: null, text }; }
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { res, json: JSON.parse(text), text }; } catch { return { res, json: null, text }; }
}

async function postForm(url, formDataObj, password = '') {
  const body = new URLSearchParams(formDataObj);
  const auth = Buffer.from(`operator:${password}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${auth}`,
    },
    body,
  });
  return res;
}

export async function runGoldenFlowRetest({
  base = process.env.CC_BASE_URL || 'http://localhost:1981',
  password = process.env.CC_OPERATOR_PASSWORD || '',
  writeArtifacts = true,
} = {}) {
  const startedAt = Date.now();
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve('.run', 'evidence', `golden-flow-retest-${stamp}`);
  if (writeArtifacts) await fs.mkdir(outDir, { recursive: true });

  const steps = [];
  const record = (name, pass, detail = '', latencyMs = null) => steps.push({ name, pass, detail, latency_ms: latencyMs });

  // preflight
  {
    const t0 = Date.now();
    const health = await fetch(`${base}/health`);
    record('preflight: health', health.ok, `status=${health.status}`, Date.now() - t0);
  }

  // targeting via approve-launch
  const prompt = `VP Marketing at Retest Brand ${Date.now()} spending 2m on Meta and Google https://retest.example`;
  const launchT0 = Date.now();
  const launchRes = await postForm(`${base}/targeting/approve-launch`, { target_prompt: prompt, next: 'actions' }, password);
  const launchLoc = launchRes.headers.get('location') || '';
  const launchLocDecoded = decodeURIComponent(launchLoc);
  record('targeting: approve launch', launchRes.status === 303 && launchLoc.includes('/actions?'), `status=${launchRes.status} location=${launchLoc}`, Date.now() - launchT0);

  // actions + relationships artifacts should contain latest target set
  const targetSetMatch = launchLocDecoded.match(/target set ([^)]+)\)/i);
  const targetSetId = targetSetMatch?.[1] || null;

  let qaid = null;
  if (targetSetId) {
    const relPath = path.resolve('.run', 'relationships', 'targeting-launch-relationships.ndjson');
    const actPath = path.resolve('.run', 'actions', 'targeting-launch-actions.ndjson');
    const [relRaw, actRaw] = await Promise.all([
      fs.readFile(relPath, 'utf8').catch(() => ''),
      fs.readFile(actPath, 'utf8').catch(() => ''),
    ]);
    const relLine = relRaw.trim().split('\n').reverse().find((line) => line.includes(targetSetId));
    const actLines = actRaw.trim().split('\n').filter((line) => line.includes(targetSetId));
    if (relLine) {
      try { qaid = JSON.parse(relLine).qualified_account_id; } catch {}
    }
    record('actions: launch tasks queued', actLines.length >= 2, `target_set_id=${targetSetId} tasks=${actLines.length}`);
    record('relationships: launch relationship row', Boolean(relLine), `target_set_id=${targetSetId}`);
  } else {
    record('actions: launch tasks queued', false, 'target_set_id missing');
    record('relationships: launch relationship row', false, 'target_set_id missing');
  }

  if (qaid) {
    const intelT0 = Date.now();
    const intel = await postJson(`${base}/api/competitive-intel`, {
      brand: 'Retest Brand',
      signal: 'offer_shift',
      source: 'https://example.com/retest',
      confidence: 80,
      strategic_note: 'Golden flow retest linkage',
      qualified_account_id: qaid,
    });
    record('relationships: competitive intel linked', intel.res.ok && intel.json?.marker === 'competitive-intel-ingest-v1', `qaid=${qaid}`, Date.now() - intelT0);

    const dT0 = Date.now();
    const d = await postJson(`${base}/api/qualified-accounts/${qaid}/promote`, { pipeline_stage: 'discovery' });
    record('pilot: promote to discovery', d.res.ok && d.json?.data?.pipeline_stage === 'discovery', `qaid=${qaid}`, Date.now() - dT0);

    const pT0 = Date.now();
    const p = await postJson(`${base}/api/qualified-accounts/${qaid}/promote`, { pipeline_stage: 'pilot_candidate' });
    record('pilot: promote to pilot_candidate', p.res.ok && p.json?.data?.pipeline_stage === 'pilot_candidate', `qaid=${qaid}`, Date.now() - pT0);
  } else {
    record('relationships: competitive intel linked', false, 'qualified_account_id missing');
    record('pilot: promote to discovery', false, 'qualified_account_id missing');
    record('pilot: promote to pilot_candidate', false, 'qualified_account_id missing');
  }

  // Route-truth checks (must run every pass)
  const routeChecks = [
    {
      name: 'route-truth: home route',
      path: '/',
      expects: ['AdZeta Command Center · Home', 'Grow qualified pipeline this week.'],
    },
    {
      name: 'route-truth: targeting route',
      path: '/targeting',
      expects: ['Targeting', 'targeting-golden-step-1-v1'],
    },
    {
      name: 'route-truth: actions route',
      path: '/actions',
      expects: ['Continue to Relationships', 'Actions'],
    },
    {
      name: 'route-truth: relationships route',
      path: '/relationships',
      expects: ['Continue to Pilot board', 'Relationships'],
    },
    {
      name: 'route-truth: pilot route',
      path: '/pilot',
      expects: ['Pilot'],
    },
    {
      name: 'route-truth: comms route',
      path: '/comms',
      expects: ['Comms', 'comms-unified-table-v1'],
    },
    {
      name: 'route-truth: strategy route',
      path: '/strategy',
      expects: ['AdZeta Command Center · Strategy', 'Strategy objective'],
    },
    {
      name: 'route-truth: ops route',
      path: '/ops',
      expects: ['ops-orchestration-visibility-v1', 'Alert rules'],
    },
  ];

  for (const check of routeChecks) {
    const t0 = Date.now();
    const { res, text } = await getText(`${base}${check.path}`);
    const missing = check.expects.filter((needle) => !text.includes(needle));
    const pass = res.ok && missing.length === 0;
    record(check.name, pass, `status=${res.status}${missing.length ? ` missing=${missing.join('|')}` : ''}`, Date.now() - t0);
  }

  const endedAt = Date.now();
  const matrix = {
    marker: 'golden-flow-retest-matrix-v2',
    generated_at: new Date().toISOString(),
    base,
    run_latency_ms: endedAt - startedAt,
    pass_count: steps.filter((s) => s.pass).length,
    fail_count: steps.filter((s) => !s.pass).length,
    steps,
    target_set_id: targetSetId,
    qualified_account_id: qaid,
  };

  if (writeArtifacts) {
    await fs.writeFile(path.join(outDir, 'matrix.json'), JSON.stringify(matrix, null, 2));
  }

  return matrix;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { kv } = parseArgs(process.argv.slice(2));
  const matrix = await runGoldenFlowRetest({
    base: kv.base || process.env.CC_BASE_URL || 'http://localhost:1981',
    password: kv.password || process.env.CC_OPERATOR_PASSWORD || '',
    writeArtifacts: kv['write-artifacts'] !== 'false',
  });
  console.log(JSON.stringify(matrix, null, 2));
  process.exit(matrix.fail_count > 0 ? 1 : 0);
}
