#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const configPath = path.join(projectRoot, 'scripts', 'design-token-lint.config.json');

const defaultConfig = {
  keyUiRoots: ['app', 'components', 'src/app', 'src/components', 'ui'],
  keyUiFiles: ['server.mjs'],
  includeExtensions: ['.tsx', '.jsx', '.css', '.scss', '.mjs', '.js'],
  excludeDirs: ['node_modules', '.next', '.git', '.run', 'docs'],
  allowTokenPatterns: ['token(', 'var(--', 'theme('],
  ignoreLinePatterns: ['design-token-lint: ignore', 'design-token-lint-ignore'],
  reportPath: '.run/design-token-drift-report.md'
};

function loadConfig() {
  if (!fs.existsSync(configPath)) return defaultConfig;
  const raw = fs.readFileSync(configPath, 'utf8');
  return { ...defaultConfig, ...JSON.parse(raw) };
}

function walk(dir, cfg, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (cfg.excludeDirs.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, cfg, out);
      continue;
    }
    if (cfg.includeExtensions.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function hasToken(text, cfg) {
  return cfg.allowTokenPatterns.some((p) => text.includes(p));
}

function isIgnoredLine(line, cfg) {
  return (cfg.ignoreLinePatterns || []).some((marker) => line.includes(marker));
}

function collectViolations(file, cfg) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const violations = [];

  const checks = [
    {
      kind: 'color',
      regex: /(#(?:[0-9a-fA-F]{3,8})\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\))/g,
      why: 'Raw color literal detected'
    },
    {
      kind: 'spacing',
      regex: /\b(?:margin|padding|gap|row-gap|column-gap)\s*:\s*[^;]*(\d+(?:\.\d+)?(?:px|rem|em))/g,
      why: 'Raw spacing value detected'
    },
    {
      kind: 'typography',
      regex: /\b(?:font-size|line-height|letter-spacing)\s*:\s*[^;]*(\d+(?:\.\d+)?(?:px|rem|em))/g,
      why: 'Raw typography value detected'
    },
    {
      kind: 'tailwind-color',
      regex: /\b(?:text|bg|border|from|to)-\[#(?:[0-9a-fA-F]{3,8})\]/g,
      why: 'Tailwind arbitrary raw color detected'
    },
    {
      kind: 'tailwind-scale',
      regex: /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|text|leading|tracking)-\[[^\]]*(?:px|rem|em)[^\]]*\]/g,
      why: 'Tailwind arbitrary raw spacing/typography detected'
    }
  ];

  lines.forEach((line, idx) => {
    if (hasToken(line, cfg) || isIgnoredLine(line, cfg)) return;
    for (const check of checks) {
      let match;
      while ((match = check.regex.exec(line)) !== null) {
        violations.push({
          file,
          line: idx + 1,
          kind: check.kind,
          match: match[0],
          why: check.why,
          source: line.trim()
        });
      }
      check.regex.lastIndex = 0;
    }
  });

  return violations;
}

function formatReport(violations, filesScanned, rootsScanned, cfg, opts = {}) {
  const byKind = violations.reduce((acc, v) => {
    acc[v.kind] = (acc[v.kind] || 0) + 1;
    return acc;
  }, {});

  const header = [
    '# UI Design Token Drift Report',
    '',
    `- Files scanned: **${filesScanned}**`,
    `- UI roots scanned: ${rootsScanned.join(', ') || '(none found)'}`,
    `- Report path: \`${cfg.reportPath}\``,
    `- Violations: **${violations.length}**`,
    ''
  ];

  const failConditions = [
    '## Fail conditions',
    '',
    '- CI fails when one or more raw color/spacing/typography literals are found in tracked UI files.',
    '- Any report with `Violations > 0` returns exit code `1` unless override mode is explicitly enabled.',
    ''
  ];

  const overrides = [
    '## Override notes',
    '',
    '- Temporary one-line bypass: append `design-token-lint: ignore` to a specific line (must include cleanup follow-up).',
    '- Temporary run bypass: set `ALLOW_DESIGN_TOKEN_DRIFT=1` or pass `--allow-drift` to keep CI green while report still records violations.',
    '- Required follow-up for overrides: include owner, expiry date, and replacement-token plan in the related PR/task.',
    ''
  ];

  const summary = ['## Summary by category', ''];
  if (Object.keys(byKind).length === 0) {
    summary.push('- No drift violations found ✅', '');
  } else {
    for (const [k, c] of Object.entries(byKind)) summary.push(`- ${k}: ${c}`);
    summary.push('');
  }

  if (opts.allowDrift && violations.length > 0) {
    summary.push('> ⚠️ Override mode active: violations are present but exit code is forced to success for this run.', '');
  }

  const details = ['## Violations', ''];
  if (violations.length === 0) {
    details.push('No violations to report.');
  } else {
    for (const v of violations) {
      const rel = path.relative(projectRoot, v.file);
      details.push(`- ${rel}:${v.line} [${v.kind}] ${v.why}`);
      details.push(`  - match: \`${v.match}\``);
      details.push(`  - line: \`${v.source}\``);
    }
  }

  return [...header, ...failConditions, ...overrides, ...summary, ...details, ''].join('\n');
}

function main() {
  const cfg = loadConfig();
  const sampleMode = process.argv.includes('--sample-report');
  const allowDrift = process.argv.includes('--allow-drift') || ['1', 'true', 'yes', 'on'].includes(String(process.env.ALLOW_DESIGN_TOKEN_DRIFT || '').toLowerCase());

  if (sampleMode) {
    const sampleViolations = [
      {
        file: path.join(projectRoot, 'server.mjs'),
        line: 612,
        kind: 'color',
        match: '#de347f',
        why: 'Raw color literal detected',
        source: "button,.button-link{background:linear-gradient(135deg,#de347f 0%,#ff5d74 100%);...}"
      },
      {
        file: path.join(projectRoot, 'server.mjs'),
        line: 615,
        kind: 'spacing',
        match: 'padding:.24rem .62rem',
        why: 'Raw spacing value detected',
        source: ".links a{...padding:.24rem .62rem;...}"
      },
      {
        file: path.join(projectRoot, 'server.mjs'),
        line: 605,
        kind: 'typography',
        match: 'font-size:.95rem',
        why: 'Raw typography value detected',
        source: "h2{font-size:.95rem;line-height:1.3;...}"
      }
    ];

    const sampleReport = formatReport(sampleViolations, 1, ['server.mjs'], cfg, { allowDrift: false });
    const samplePath = path.join(projectRoot, '.run/design-token-drift-report.sample.md');
    fs.mkdirSync(path.dirname(samplePath), { recursive: true });
    fs.writeFileSync(samplePath, sampleReport);
    console.log(sampleReport);
    console.log(`\nSample report written to ${path.relative(projectRoot, samplePath)}`);
    return;
  }

  const rootFiles = cfg.keyUiRoots
    .map((r) => ({ rel: r, abs: path.join(projectRoot, r) }))
    .filter((item) => fs.existsSync(item.abs));
  const rootedFiles = rootFiles.flatMap((item) => walk(item.abs, cfg));
  const explicitFiles = (cfg.keyUiFiles || [])
    .map((f) => path.join(projectRoot, f))
    .filter((f) => fs.existsSync(f));

  const fileSet = new Set([...rootedFiles, ...explicitFiles]);
  const files = [...fileSet];
  const rootsScanned = [
    ...rootFiles.map((item) => item.rel),
    ...(cfg.keyUiFiles || []).filter((f) => fs.existsSync(path.join(projectRoot, f))).map((f) => `${f} (explicit)`)
  ];

  const violations = files.flatMap((f) => collectViolations(f, cfg));

  const report = formatReport(violations, files.length, rootsScanned, cfg, { allowDrift });
  const reportPath = path.join(projectRoot, cfg.reportPath);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);

  console.log(report);
  if (violations.length > 0 && !allowDrift) {
    console.error(`\nDesign token drift check failed with ${violations.length} violation(s).`);
    process.exit(1);
  }

  if (violations.length > 0 && allowDrift) {
    console.warn(`\nDesign token drift override active. ${violations.length} violation(s) recorded in report.`);
  } else {
    console.log('\nDesign token drift check passed.');
  }
}

main();
