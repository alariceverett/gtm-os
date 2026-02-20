#!/usr/bin/env node
// Forge Feedback Agent — anonymized usage telemetry posted to GitHub Issues.
// Opt-in only. Dry-run by default.
//
// Usage:
//   node feedback_agent.js                  # dry-run (prints what would be posted)
//   node feedback_agent.js --post           # actually post to GitHub
//   node feedback_agent.js --post --confirm # skip interactive confirmation
//
// Environment:
//   FORGE_FEEDBACK=true          — must be set to enable (even dry-run checks this)
//   FORGE_FEEDBACK_TOKEN         — GitHub personal access token (for --post)
//   FORGE_FEEDBACK_REPO          — target repo (default: EJKIV/Forge)
//   FORGE_FEEDBACK_DRY_RUN=false — alternative to --post flag

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { scrub, scrubObject, validate } = require('./privacy_filter');

// --- Config ---
const REPO = process.env.FORGE_FEEDBACK_REPO || 'EJKIV/Forge';
const TOKEN = process.env.FORGE_FEEDBACK_TOKEN || '';
const ORG_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(ORG_ROOT, '..');
const args = process.argv.slice(2);
const wantPost = args.includes('--post') || process.env.FORGE_FEEDBACK_DRY_RUN === 'false';
const skipConfirm = args.includes('--confirm');

// --- Gate: opt-in check ---
if (process.env.FORGE_FEEDBACK !== 'true') {
  console.log('Forge Feedback Agent is disabled.');
  console.log('To enable: export FORGE_FEEDBACK=true');
  process.exit(0);
}

// ============================================================
// Data Collectors — each returns { category, summary, body }
// ============================================================

function collectProcessUsage() {
  // Try to read process data from DB via process_report.js output
  // Fallback: check if cc_processes table data is available via a simpler query
  try {
    const dbPath = path.join(ORG_ROOT, 'engine', 'db.js');
    if (!fs.existsSync(dbPath) || !process.env.DATABASE_URL) {
      return null; // No DB configured
    }
    // Run a lightweight query to get process counts
    const script = `
      const { query } = require('${dbPath.replace(/\\/g, '\\\\')}');
      (async () => {
        try {
          const res = await query(\`
            SELECT p.process_id, COUNT(r.id)::int as runs
            FROM cc_processes p
            LEFT JOIN cc_process_runs r ON r.process_id = p.process_id
            GROUP BY p.process_id
          \`);
          console.log(JSON.stringify(res.rows));
        } catch(e) { console.log('[]'); }
        process.exit(0);
      })();
    `;
    const output = execFileSync('node', ['-e', script], {
      timeout: 15000, encoding: 'utf-8', env: process.env
    }).trim();
    const rows = JSON.parse(output || '[]');
    if (rows.length === 0) return null;

    const used = rows.filter(r => r.runs > 0);
    const unused = rows.filter(r => r.runs === 0);
    const total = rows.length;

    const lines = [
      `Total registered processes: ${total}`,
      `Processes with at least 1 run: ${used.length}`,
      `Processes never run: ${unused.length}`,
      '',
      'Never-run process IDs (sanitized):',
      ...unused.map(r => `- ${scrub(r.process_id)}`),
    ];

    return {
      category: 'Process Usage',
      summary: `${used.length}/${total} processes active, ${unused.length} unused`,
      body: lines.join('\n'),
    };
  } catch {
    return null;
  }
}

function collectSkillGaps() {
  const gapFile = path.join(ORG_ROOT, 'skill-gaps.jsonl');
  if (!fs.existsSync(gapFile)) return null;

  const lines = fs.readFileSync(gapFile, 'utf-8').split('\n').filter(Boolean);
  if (lines.length === 0) return null;

  // Parse and extract categories only
  const categories = {};
  for (const line of lines) {
    try {
      const gap = JSON.parse(line);
      const cat = scrub(gap.category || gap.skill_category || 'uncategorized');
      categories[cat] = (categories[cat] || 0) + 1;
    } catch { /* skip malformed */ }
  }

  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const bodyLines = [
    `Total skill gaps logged: ${lines.length}`,
    '',
    'Gap categories (count):',
    ...sorted.map(([cat, count]) => `- ${cat}: ${count}`),
  ];

  return {
    category: 'Skill Gaps',
    summary: `${lines.length} gaps across ${sorted.length} categories`,
    body: bodyLines.join('\n'),
  };
}

function collectDecisionHealth() {
  try {
    const dbPath = path.join(ORG_ROOT, 'engine', 'db.js');
    if (!fs.existsSync(dbPath) || !process.env.DATABASE_URL) return null;

    const script = `
      const { query } = require('${dbPath.replace(/\\/g, '\\\\')}');
      (async () => {
        try {
          const d = await query('SELECT COUNT(*)::int as c FROM cc_decisions');
          const del = await query('SELECT COUNT(*)::int as c FROM cc_delegations');
          const s = await query('SELECT COUNT(*)::int as c FROM cc_decision_steps');
          console.log(JSON.stringify({
            decisions: d.rows[0].c,
            delegations: del.rows[0].c,
            steps: s.rows[0].c
          }));
        } catch(e) { console.log('{}'); }
        process.exit(0);
      })();
    `;
    const output = execFileSync('node', ['-e', script], {
      timeout: 15000, encoding: 'utf-8', env: process.env
    }).trim();
    const data = JSON.parse(output || '{}');
    if (!data.decisions && !data.delegations && !data.steps) return null;

    const ratio = data.decisions > 0
      ? (data.delegations / data.decisions).toFixed(1)
      : 'N/A';
    const stepsRatio = data.decisions > 0
      ? (data.steps / data.decisions).toFixed(1)
      : 'N/A';

    const bodyLines = [
      `Decisions logged: ${data.decisions}`,
      `Delegations logged: ${data.delegations}`,
      `Reasoning steps logged: ${data.steps}`,
      `Delegations per decision: ${ratio}`,
      `Steps per decision: ${stepsRatio}`,
    ];

    return {
      category: 'Decision Engine Health',
      summary: `${data.decisions} decisions, ${ratio} delegations/decision`,
      body: bodyLines.join('\n'),
    };
  } catch {
    return null;
  }
}

function collectFileStructure() {
  // Compare current org/ files against known template files
  const TEMPLATE_FILES = [
    'DECISION_FRAMEWORK.md', 'EXCELLENCE_PREAMBLE.md', 'DELEGATION_SYSTEM.md',
    'PRIORITY_SYSTEM.md', 'CEO_OPERATING_RHYTHM.md', 'PRODUCT_PROCESS.md',
    'SKILL_DISCOVERY.md', 'WORK_QUEUE.md', 'TASK_BACKLOG.md',
    'learning/ORGANIZATIONAL_LEARNING.md', 'learning/IMPROVEMENT_ENGINE.md',
    'learning/SKILL_TREES.md', 'learning/AFTER_ACTION_TEMPLATE.md',
    'learning/WEEKLY_REVIEW_TEMPLATE.md', 'training/SKILL_PACK_TEMPLATE.md',
    'training/AGENT_CURRICULUM.md', 'templates/TASK_TEMPLATE.md',
    'SECURITY.md', 'security/SECURITY_CHECKLIST.md',
  ];

  const exists = [];
  const missing = [];
  for (const f of TEMPLATE_FILES) {
    const full = path.join(ORG_ROOT, f);
    if (fs.existsSync(full)) {
      exists.push(f);
    } else {
      missing.push(f);
    }
  }

  // Count custom files added beyond template
  let customCount = 0;
  try {
    const allFiles = execSync(`find "${ORG_ROOT}" -type f -name "*.md" -o -name "*.js" -o -name "*.json" 2>/dev/null`, {
      encoding: 'utf-8', timeout: 5000
    }).trim().split('\n').filter(Boolean);
    const templateSet = new Set(TEMPLATE_FILES.map(f => path.join(ORG_ROOT, f)));
    customCount = allFiles.filter(f => !templateSet.has(f)).length;
  } catch { /* ignore */ }

  if (exists.length === 0 && missing.length === 0) return null;

  const bodyLines = [
    `Template files present: ${exists.length}/${TEMPLATE_FILES.length}`,
    `Template files removed/missing: ${missing.length}`,
    `Custom files added: ${customCount}`,
    '',
    ...(missing.length > 0 ? ['Missing template files:', ...missing.map(f => `- ${f}`)] : []),
  ];

  return {
    category: 'File Structure',
    summary: `${exists.length}/${TEMPLATE_FILES.length} template files present, ${customCount} custom`,
    body: bodyLines.join('\n'),
  };
}

function collectErrorPatterns() {
  // Scan engine scripts for recent error patterns in memory/ logs
  const memDir = path.join(WORKSPACE_ROOT, 'memory');
  if (!fs.existsSync(memDir)) return null;

  const errorTypes = {};
  try {
    const files = fs.readdirSync(memDir).filter(f => f.endsWith('.md')).slice(-7); // last 7 days
    for (const file of files) {
      const content = fs.readFileSync(path.join(memDir, file), 'utf-8');
      // Look for error-like patterns
      const errorMatches = content.match(/(?:Error|ERROR|❌|FAIL|error:)\s*[^\n]{0,100}/gi) || [];
      for (const match of errorMatches) {
        // Extract just the error type, strip specifics
        const type = match.replace(/(?:Error|ERROR|❌|FAIL|error:)\s*/i, '')
          .replace(/['"]/g, '')
          .substring(0, 50);
        const scrubbed = scrub(type);
        if (scrubbed.length > 3) {
          errorTypes[scrubbed] = (errorTypes[scrubbed] || 0) + 1;
        }
      }
    }
  } catch { /* ignore */ }

  const entries = Object.entries(errorTypes).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return {
    category: 'Error Patterns',
    summary: `${entries.length} distinct error types in last 7 days`,
    body: [
      'Error types (anonymized, last 7 days):',
      ...entries.slice(0, 10).map(([type, count]) => `- ${type}: ${count} occurrences`),
      ...(entries.length > 10 ? [`- ... and ${entries.length - 10} more types`] : []),
    ].join('\n'),
  };
}

// ============================================================
// Compose & Post
// ============================================================

function composeIssues() {
  const collectors = [
    collectProcessUsage,
    collectSkillGaps,
    collectDecisionHealth,
    collectFileStructure,
    collectErrorPatterns,
  ];

  const results = [];
  for (const fn of collectors) {
    try {
      const r = fn();
      if (r) results.push(r);
    } catch (e) {
      // Collector failed — skip silently
    }
  }
  return results;
}

function formatIssue(item) {
  const title = `Forge Feedback: ${item.category} — ${item.summary}`;
  const body = [
    '## Forge Feedback (Automated & Anonymized)',
    '',
    `**Category:** ${item.category}`,
    `**Summary:** ${item.summary}`,
    '',
    '### Details',
    '',
    item.body,
    '',
    '---',
    '_This feedback was generated automatically by the Forge Feedback Agent._',
    '_All data has been anonymized through a privacy filter. No proprietary information is included._',
    '_See: [Privacy Policy](https://github.com/EJKIV/Forge/blob/main/org/feedback/PRIVACY_POLICY.md)_',
  ].join('\n');

  // Final validation pass
  const titleCheck = validate(scrub(title));
  const bodyCheck = validate(scrub(body));
  if (!titleCheck.safe || !bodyCheck.safe) {
    console.error(`⚠️  Privacy validation failed for "${item.category}": ${[...titleCheck.issues, ...bodyCheck.issues].join(', ')}`);
    return null;
  }

  return { title: scrub(title), body: scrub(body), labels: ['feedback', 'automated', 'anonymized'] };
}

async function postIssue(issue) {
  if (!TOKEN) {
    console.error('❌ FORGE_FEEDBACK_TOKEN not set. Cannot post to GitHub.');
    process.exit(1);
  }

  const https = require('https');
  const [owner, repo] = REPO.split('/');
  const data = JSON.stringify({
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/issues`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Forge-Feedback-Agent/1.0',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          const parsed = JSON.parse(body);
          resolve(parsed.html_url);
        } else {
          reject(new Error(`GitHub API ${res.statusCode}: ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============================================================
// Benchmarks — fetch community averages and compare locally
// ============================================================

const BENCHMARK_URL = `https://raw.githubusercontent.com/${REPO}/main/community_benchmarks.json`;
const BENCHMARKS_MD = path.join(__dirname, 'BENCHMARKS.md');

function computeLocalMetrics(items) {
  const metrics = {};
  for (const item of items) {
    if (item.category === 'Process Usage') {
      const m = item.body.match(/Total registered processes: (\d+)/);
      const m2 = item.body.match(/Processes with at least 1 run: (\d+)/);
      if (m) metrics.processes_registered = parseInt(m[1]);
      if (m2) metrics.processes_with_runs = parseInt(m2[1]);
      if (metrics.processes_registered > 0) {
        metrics.process_adoption_rate = +(metrics.processes_with_runs / metrics.processes_registered).toFixed(2);
      }
    }
    if (item.category === 'Skill Gaps') {
      const m = item.body.match(/Total skill gaps logged: (\d+)/);
      const cats = (item.body.match(/^- .+: \d+$/gm) || []).length;
      if (m) metrics.total_skill_gaps = parseInt(m[1]);
      metrics.skill_gap_categories = cats;
    }
    if (item.category === 'Decision Engine Health') {
      const md = item.body.match(/Decisions logged: (\d+)/);
      const mr = item.body.match(/Delegations per decision: ([\d.]+)/);
      const ms = item.body.match(/Steps per decision: ([\d.]+)/);
      if (md) metrics.decisions_logged = parseInt(md[1]);
      if (mr && mr[1] !== 'N/A') metrics.delegations_per_decision = parseFloat(mr[1]);
      if (ms && ms[1] !== 'N/A') metrics.steps_per_decision = parseFloat(ms[1]);
    }
    if (item.category === 'File Structure') {
      const m = item.body.match(/Template files present: (\d+)/);
      const mc = item.body.match(/Custom files added: (\d+)/);
      if (m) metrics.template_files_retained = parseInt(m[1]);
      if (mc) metrics.custom_files_added = parseInt(mc[1]);
    }
  }
  return metrics;
}

async function fetchBenchmarks() {
  const https = require('https');
  return new Promise((resolve) => {
    https.get(BENCHMARK_URL, { headers: { 'User-Agent': 'Forge-Feedback-Agent/1.0' } }, (res) => {
      if (res.statusCode !== 200) { resolve(null); res.resume(); return; }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function assess(local, avg) {
  if (local == null || avg == null || avg === 0) return '⚪ No data';
  const ratio = local / avg;
  if (ratio >= 1.15) return '🟢 Above average';
  if (ratio >= 0.85) return '🟡 Average';
  return '🔴 Below average';
}

function fmtVal(v) {
  return v != null ? String(v) : '—';
}

function writeBenchmarkReport(localMetrics, community) {
  const avg = community?.averages || {};
  const now = new Date().toISOString().slice(0, 19) + 'Z';
  const instanceCount = community?.instance_count || 0;
  const minInstances = community?.minimum_instances || 5;
  const hasEnoughData = instanceCount >= minInstances;

  const metricRows = [
    ['Processes registered', localMetrics.processes_registered, avg.processes_registered],
    ['Processes with runs', localMetrics.processes_with_runs, avg.processes_with_runs],
    ['Process adoption rate', localMetrics.process_adoption_rate, avg.process_adoption_rate],
    ['Skill gap categories', localMetrics.skill_gap_categories, avg.skill_gap_categories],
    ['Total skill gaps logged', localMetrics.total_skill_gaps, avg.total_skill_gaps],
    ['Decisions logged', localMetrics.decisions_logged, avg.decisions_logged],
    ['Delegations per decision', localMetrics.delegations_per_decision, avg.delegations_per_decision],
    ['Steps per decision', localMetrics.steps_per_decision, avg.steps_per_decision],
    ['Template files retained', localMetrics.template_files_retained, avg.template_files_retained],
    ['Custom files added', localMetrics.custom_files_added, avg.custom_files_added],
  ];

  const tableRows = metricRows.map(([name, local, communityVal]) => {
    const delta = (local != null && communityVal != null)
      ? (local - communityVal > 0 ? '+' : '') + (local - communityVal).toFixed(1)
      : '—';
    const assessment = hasEnoughData ? assess(local, communityVal) : '⚪ No data';
    return `| ${name} | ${fmtVal(local)} | ${hasEnoughData ? fmtVal(communityVal) : '—'} | ${delta} | ${assessment} |`;
  });

  const insights = [];
  if (!hasEnoughData) {
    insights.push(`- Community benchmarks require at least ${minInstances} contributing instances. Currently: ${instanceCount}. Keep contributing — benchmarks will appear once the threshold is met.`);
  } else {
    // Generate insights from the data
    if (localMetrics.process_adoption_rate != null && avg.process_adoption_rate != null) {
      if (localMetrics.process_adoption_rate < avg.process_adoption_rate * 0.85) {
        insights.push('- 📋 Your process adoption rate is below average. Consider reviewing registered processes — some may need better integration into your workflow, or unused ones could be removed.');
      } else if (localMetrics.process_adoption_rate > avg.process_adoption_rate * 1.15) {
        insights.push('- ✅ Strong process adoption — you\'re using more of your registered processes than most Forge instances.');
      }
    }
    if (localMetrics.delegations_per_decision != null && avg.delegations_per_decision != null) {
      if (localMetrics.delegations_per_decision < avg.delegations_per_decision * 0.7) {
        insights.push('- 🔀 Low delegation ratio. Your CEO agent may be handling too much directly — consider delegating more to division leads.');
      }
    }
    if (localMetrics.template_files_retained != null && avg.template_files_retained != null) {
      if (localMetrics.template_files_retained < avg.template_files_retained * 0.85) {
        insights.push('- 📂 You\'ve removed more template files than average. Some removed files may contain valuable framework features — review what\'s missing.');
      }
    }
    if (insights.length === 0) {
      insights.push('- Your instance is tracking close to community averages across all metrics. Looking good!');
    }
  }

  const md = `# Forge Community Benchmarks

_Auto-generated by the Forge Feedback Agent. Do not edit manually — this file is overwritten on each run._

_Last updated: ${now}_
_Community instances contributing: ${instanceCount}_

---

## Your Instance vs Community Average

| Metric | Your Value | Community Avg | Delta | Assessment |
|---|---|---|---|---|
${tableRows.join('\n')}

### Assessment Key

- 🟢 **Above average** — your usage exceeds the community norm
- 🟡 **Average** — within normal range
- 🔴 **Below average** — potential area for improvement
- ⚪ **No data** — insufficient data for comparison

---

## Insights

${insights.join('\n')}

---

## How Benchmarks Work

Community benchmarks are aggregated from anonymized feedback submitted by opt-in Forge instances. The averages are published as a public JSON file in the Forge repo (\`community_benchmarks.json\`) and fetched by your feedback agent after each submission.

- **No individual instance data is identifiable** in the benchmark file
- **Minimums apply** — benchmarks only appear when enough instances have contributed (minimum ${minInstances}) to prevent fingerprinting
- **Your local data never leaves** for benchmark comparison — the community averages come to you
`;

  fs.writeFileSync(BENCHMARKS_MD, md);
  return md;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       Forge Feedback Agent v1.0          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const items = composeIssues();
  if (items.length === 0) {
    console.log('No feedback data collected. Nothing to report.');
    return;
  }

  const issues = items.map(formatIssue).filter(Boolean);
  if (issues.length === 0) {
    console.log('All feedback items failed privacy validation. Nothing to report.');
    return;
  }

  // Combine into a single issue to reduce noise
  const combined = {
    title: `Forge Feedback: Weekly Report — ${issues.length} observations`,
    body: issues.map(i => i.body).join('\n\n---\n\n'),
    labels: ['feedback', 'automated', 'anonymized'],
  };

  console.log('=== FEEDBACK PREVIEW ===\n');
  console.log(`Title: ${combined.title}\n`);
  console.log(combined.body);
  console.log('\n=== END PREVIEW ===\n');

  if (!wantPost) {
    console.log('🔒 DRY RUN — nothing was posted.');
    console.log('   To post: node feedback_agent.js --post');
    console.log('   To post without confirmation: node feedback_agent.js --post --confirm');
    // Still fetch benchmarks in dry-run mode
    await runBenchmarks(items);
    return;
  }

  if (!skipConfirm) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
      rl.question('Post this feedback to GitHub? (y/N) ', resolve);
    });
    rl.close();
    if (answer.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      return;
    }
  }

  try {
    const url = await postIssue(combined);
    console.log(`✅ Feedback posted: ${url}`);
  } catch (e) {
    console.error(`❌ Failed to post: ${e.message}`);
    process.exit(1);
  }

  // --- Fetch and display benchmarks ---
  await runBenchmarks(items);
}

async function runBenchmarks(items) {
  console.log('\n📊 Fetching community benchmarks...');
  const localMetrics = computeLocalMetrics(items);
  const community = await fetchBenchmarks();

  if (!community) {
    console.log('   Benchmarks not yet available (community_benchmarks.json not found in repo).');
    console.log('   A benchmark file will be published once enough instances are contributing.');
    // Still write a local report with just our data
    writeBenchmarkReport(localMetrics, null);
    console.log(`   Local metrics written to ${BENCHMARKS_MD}`);
    return;
  }

  writeBenchmarkReport(localMetrics, community);
  console.log(`   Benchmark report written to ${BENCHMARKS_MD}`);

  // Print summary to console
  const avg = community.averages || {};
  console.log('\n   Your Instance vs Community:');
  if (localMetrics.process_adoption_rate != null && avg.process_adoption_rate != null) {
    console.log(`   • Process adoption: ${(localMetrics.process_adoption_rate * 100).toFixed(0)}% (community: ${(avg.process_adoption_rate * 100).toFixed(0)}%)`);
  }
  if (localMetrics.delegations_per_decision != null && avg.delegations_per_decision != null) {
    console.log(`   • Delegations/decision: ${localMetrics.delegations_per_decision} (community: ${avg.delegations_per_decision})`);
  }
  if (localMetrics.template_files_retained != null && avg.template_files_retained != null) {
    console.log(`   • Template files kept: ${localMetrics.template_files_retained} (community: ${avg.template_files_retained})`);
  }
  console.log(`\n   Full report: org/feedback/BENCHMARKS.md`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
