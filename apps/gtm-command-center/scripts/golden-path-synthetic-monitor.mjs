#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { runGoldenFlowRetest } from './retest-golden-flow.mjs';

const reportsDir = path.resolve('.run', 'reports', 'synthetic-monitor');
const latestPath = path.join(reportsDir, 'golden-path-latest.json');
const historyPath = path.join(reportsDir, 'golden-path-history.ndjson');
const incidentsPath = path.resolve('..', '..', 'org', 'logs', 'system-failures.jsonl');

function parseArgs(argv = []) {
  const flags = new Set();
  const kv = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const clean = arg.slice(2);
    const [k, ...rest] = clean.split('=');
    if (!rest.length) flags.add(k);
    else kv[k] = rest.join('=');
  }
  return { flags, kv };
}

async function ensureDirs() {
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(path.dirname(incidentsPath), { recursive: true });
}

async function appendNdjson(filePath, obj) {
  await fs.appendFile(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
}

async function readLatestIncident(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(lines[i]);
      } catch {
        // keep scanning older lines
      }
    }
  } catch {
    // ignore missing file
  }
  return null;
}

function buildIncident(run) {
  const failed = (run.steps || []).filter((s) => !s.pass);
  const detectedCondition = failed.map((f) => f.name).join(', ').slice(0, 400) || 'golden-path check failure';
  return {
    timestamp: new Date().toISOString(),
    status: 'open',
    severity: 'critical',
    surface: '/ops',
    failure_class: 'golden_path_synthetic_failure',
    detected_condition: detectedCondition,
    impact: 'Core flow degraded (targeting->actions->relationships->pilot)',
    monitor: {
      marker: run.marker,
      run_latency_ms: run.latency_ms,
      fail_count: run.fail_count,
      pass_count: run.pass_count,
      base: run.base,
      run_id: run.run_id,
    },
    route: {
      alert_channel: '/ops',
      alert_text: `SYNTHETIC FAIL: ${detectedCondition}`,
    },
  };
}

function buildResolvedIncident(run, priorIncident) {
  return {
    timestamp: new Date().toISOString(),
    status: 'resolved',
    severity: priorIncident?.severity || 'critical',
    surface: '/ops',
    failure_class: priorIncident?.failure_class || 'golden_path_synthetic_failure',
    detected_condition: `Recovered after monitor pass (${run.run_id})`,
    impact: 'Core flow healthy (targeting->actions->relationships->pilot)',
    monitor: {
      marker: run.marker,
      run_latency_ms: run.latency_ms,
      fail_count: run.fail_count,
      pass_count: run.pass_count,
      base: run.base,
      run_id: run.run_id,
    },
    route: {
      alert_channel: '/ops',
      alert_text: `SYNTHETIC RECOVERED: ${run.run_id}`,
    },
  };
}

async function runOnce({ base, password }) {
  const started = Date.now();
  let matrix;
  let hardError = null;
  try {
    matrix = await runGoldenFlowRetest({ base, password, writeArtifacts: true });
  } catch (error) {
    hardError = error;
    matrix = {
      marker: 'golden-flow-retest-matrix-v2',
      generated_at: new Date().toISOString(),
      base,
      run_latency_ms: Date.now() - started,
      pass_count: 0,
      fail_count: 1,
      steps: [
        {
          name: 'monitor: execution error',
          pass: false,
          detail: String(error?.message || error || 'unknown error'),
          latency_ms: Date.now() - started,
        },
      ],
    };
  }

  const run = {
    marker: 'golden-path-synthetic-run-v1',
    run_id: `syn-${Date.now().toString(36)}`,
    generated_at: new Date().toISOString(),
    base,
    status: matrix.fail_count > 0 ? 'fail' : 'pass',
    latency_ms: matrix.run_latency_ms,
    pass_count: matrix.pass_count,
    fail_count: matrix.fail_count,
    steps: matrix.steps,
  };

  await ensureDirs();
  await fs.writeFile(latestPath, JSON.stringify(run, null, 2));
  await appendNdjson(historyPath, run);

  const latestIncident = await readLatestIncident(incidentsPath);

  if (run.status === 'fail') {
    const incident = buildIncident(run);
    await appendNdjson(incidentsPath, incident);
  } else if (latestIncident && String(latestIncident.status || '').toLowerCase() !== 'resolved') {
    const resolved = buildResolvedIncident(run, latestIncident);
    await appendNdjson(incidentsPath, resolved);
  }

  if (hardError) throw hardError;
  return run;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { flags, kv } = parseArgs(process.argv.slice(2));
  const base = kv.base || process.env.CC_BASE_URL || 'http://localhost:1981';
  const password = kv.password || process.env.CC_OPERATOR_PASSWORD || '';
  const intervalSec = Number(kv.intervalSec || process.env.GOLDEN_SYNTHETIC_INTERVAL_SEC || 300);
  const once = flags.has('once');

  if (!Number.isFinite(intervalSec) || intervalSec < 15) {
    throw new Error('intervalSec must be >= 15 seconds');
  }

  const loop = async () => {
    const run = await runOnce({ base, password });
    console.log(JSON.stringify(run));
  };

  if (once) {
    await loop();
    return;
  }

  // continuous mode
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await loop();
    } catch (error) {
      console.error(`[golden-synthetic] run error: ${String(error?.message || error)}`);
    }
    await sleep(intervalSec * 1000);
  }
}

await main();
