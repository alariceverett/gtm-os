import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

function normalizeStatus(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.toLowerCase();
  if (compact.includes('done') || compact.includes('completed')) return 'DONE';
  if (compact.includes('blocked')) return 'BLOCKED';
  if (compact.includes('queue') || compact.includes('queued')) return 'QUEUED';
  if (compact.includes('progress') || compact.includes('active')) return 'IN PROGRESS';
  if (compact.includes('wait') || compact.includes('await')) return 'WAITING ON USER';
  return raw.toUpperCase();
}

function defaultStatusForSection(section = '') {
  if (section === 'now') return 'IN PROGRESS';
  if (section === 'next') return 'QUEUED';
  if (section === 'blocked') return 'BLOCKED';
  return '';
}

function normalizeCard(card = {}, section = '') {
  const title = String(card.title || '').replace(/`/g, '').replace(/\*\*/g, '').trim();
  if (!title) return null;
  const status = normalizeStatus(card.status || defaultStatusForSection(section));
  const owner = String(card.owner || '').replace(/`/g, '').replace(/\*\*/g, '').trim() || 'Unassigned';
  return { title, status, owner };
}

export function parseWorkQueueMarkdown(raw = '') {
  const snapshot = { now: [], next: [], blocked: [], done: [], waitingOnUser: [] };
  const lines = String(raw).split(/\r?\n/);
  let section = '';
  let currentCard = null;

  const flush = () => {
    if (!section || !snapshot[section] || !currentCard) {
      currentCard = null;
      return;
    }
    const card = normalizeCard(currentCard, section);
    currentCard = null;
    if (!card) return;
    snapshot[section].push(card);
    if (card.status.includes('DONE')) snapshot.done.push(card);
    if (card.status.includes('WAITING') || card.status.includes('AWAIT')) snapshot.waitingOnUser.push(card);
  };

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(NOW|NEXT|BLOCKED)\b/i);
    if (headingMatch) {
      flush();
      section = headingMatch[1].toLowerCase();
      continue;
    }

    if (/^##\s+/.test(line)) {
      flush();
      section = '';
      continue;
    }

    if (!section || !snapshot[section]) continue;

    const itemMatch = line.match(/^\s*(?:\d+\.|-)\s+(.+)$/);
    if (itemMatch) {
      const itemText = itemMatch[1].trim();
      const ownerMeta = itemText.match(/^Owner:\s*(.+)$/i);
      const statusMeta = itemText.match(/^Status:\s*(.+)$/i);

      if (ownerMeta && currentCard) {
        currentCard.owner = ownerMeta[1].trim();
        continue;
      }
      if (statusMeta && currentCard) {
        currentCard.status = statusMeta[1].trim();
        continue;
      }

      flush();
      currentCard = { title: itemText, status: '', owner: '' };
      continue;
    }

    const ownerInline = line.match(/^\s*[-*]\s*Owner:\s*(.+)$/i);
    if (ownerInline && currentCard) {
      currentCard.owner = ownerInline[1].trim();
      continue;
    }

    const statusInline = line.match(/^\s*[-*]\s*Status:\s*(.+)$/i);
    if (statusInline && currentCard) {
      currentCard.status = statusInline[1].trim();
      continue;
    }
  }

  flush();
  return snapshot;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function clampScore(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreToBand(score) {
  if (score >= 80) return 'GREEN';
  if (score >= 60) return 'YELLOW';
  return 'RED';
}

function bandClass(band) {
  if (band === 'GREEN') return 'ok';
  if (band === 'YELLOW') return 'warn';
  return 'bad';
}

export async function evaluateMondayReadiness(options = {}) {
  const {
    runtimeMode = 'none',
    projectRoot = process.cwd(),
    workQueuePath = path.resolve(projectRoot, '../../org/WORK_QUEUE.md'),
    checklistPath = path.resolve(projectRoot, '../../org/MONDAY_GO_NO_GO_CHECKLIST.md'),
    backupManifestPath = path.resolve(projectRoot, '.run/backups/latest/manifest.json'),
    nightlySummaryPath = path.resolve(projectRoot, '.run/reports/nightly-summary-latest.md'),
    serviceOutLogPath = path.resolve(projectRoot, '.run/service.out.log'),
    serviceErrLogPath = path.resolve(projectRoot, '.run/service.err.log'),
  } = options;

  let queue = { now: [], next: [], blocked: [], done: [], waitingOnUser: [] };
  try {
    queue = parseWorkQueueMarkdown(await readFile(workQueuePath, 'utf8'));
  } catch {}

  const serviceOutExists = await exists(serviceOutLogPath);
  const serviceErrExists = await exists(serviceErrLogPath);
  const checklistExists = await exists(checklistPath);
  const backupManifestExists = await exists(backupManifestPath);
  const nightlySummaryExists = await exists(nightlySummaryPath);

  const gates = [
    {
      id: 'GATE-01',
      name: 'Runtime connected',
      pass: runtimeMode === 'pg' || runtimeMode === 'supabase',
      actual: `runtime_mode=${runtimeMode}`,
      required: 'runtime_mode in {pg,supabase}',
      source: 'runtime',
    },
    {
      id: 'GATE-02',
      name: 'Service logs present',
      pass: serviceOutExists && serviceErrExists,
      actual: `out_log=${serviceOutExists}; err_log=${serviceErrExists}`,
      required: 'both service logs exist',
      source: '.run/service*.log',
    },
    {
      id: 'GATE-03',
      name: 'Work queue not blocked',
      pass: (queue.blocked || []).length < 3,
      actual: `blocked=${(queue.blocked || []).length}`,
      required: 'blocked < 3',
      source: 'org/WORK_QUEUE.md',
    },
    {
      id: 'GATE-04',
      name: 'Waiting-on-user bounded',
      pass: (queue.waitingOnUser || []).length < 3,
      actual: `waiting_on_user=${(queue.waitingOnUser || []).length}`,
      required: 'waiting_on_user < 3',
      source: 'org/WORK_QUEUE.md',
    },
    {
      id: 'GATE-05',
      name: 'Backup artifact available',
      pass: backupManifestExists,
      actual: `backup_manifest=${backupManifestExists}`,
      required: 'latest backup manifest exists',
      source: '.run/backups/latest/manifest.json',
    },
    {
      id: 'GATE-06',
      name: 'Nightly summary generated',
      pass: nightlySummaryExists,
      actual: `nightly_summary=${nightlySummaryExists}`,
      required: 'nightly summary exists',
      source: '.run/reports/nightly-summary-latest.md',
    },
    {
      id: 'GATE-07',
      name: 'Checklist artifact present',
      pass: checklistExists,
      actual: `checklist=${checklistExists}`,
      required: 'checklist file exists',
      source: 'org/MONDAY_GO_NO_GO_CHECKLIST.md',
    },
  ];

  const queueCounts = {
    now: (queue.now || []).length,
    next: (queue.next || []).length,
    blocked: (queue.blocked || []).length,
    done: (queue.done || []).length,
    waiting_on_user: (queue.waitingOnUser || []).length,
  };

  const flowUsabilityScore = clampScore(100 - queueCounts.blocked * 30 - queueCounts.waiting_on_user * 18 + Math.min(queueCounts.now, 3) * 4);
  const outreachOpsScore = clampScore(100 - queueCounts.waiting_on_user * 25 - (queueCounts.next === 0 ? 20 : 0) - (queueCounts.now === 0 ? 10 : 0));

  const pilotSignals = [
    gates.find((g) => g.id === 'GATE-03')?.pass,
    gates.find((g) => g.id === 'GATE-04')?.pass,
    gates.find((g) => g.id === 'GATE-07')?.pass,
  ];
  const pilotPasses = pilotSignals.filter(Boolean).length;
  const pilotConversionScore = clampScore((pilotPasses / Math.max(pilotSignals.length, 1)) * 100);

  const reliabilitySignals = [
    gates.find((g) => g.id === 'GATE-01')?.pass,
    gates.find((g) => g.id === 'GATE-02')?.pass,
    gates.find((g) => g.id === 'GATE-05')?.pass,
    gates.find((g) => g.id === 'GATE-06')?.pass,
  ];
  const reliabilityPasses = reliabilitySignals.filter(Boolean).length;
  const reliabilityScore = clampScore((reliabilityPasses / Math.max(reliabilitySignals.length, 1)) * 100);

  const war_board = [
    {
      key: 'flow_usability',
      label: 'flow usability',
      score: flowUsabilityScore,
      band: scoreToBand(flowUsabilityScore),
      className: bandClass(scoreToBand(flowUsabilityScore)),
      rationale: `blocked=${queueCounts.blocked}, waiting_on_user=${queueCounts.waiting_on_user}, now=${queueCounts.now}`,
    },
    {
      key: 'outreach_ops',
      label: 'outreach ops',
      score: outreachOpsScore,
      band: scoreToBand(outreachOpsScore),
      className: bandClass(scoreToBand(outreachOpsScore)),
      rationale: `next=${queueCounts.next}, now=${queueCounts.now}, waiting_on_user=${queueCounts.waiting_on_user}`,
    },
    {
      key: 'pilot_conversion',
      label: 'pilot conversion',
      score: pilotConversionScore,
      band: scoreToBand(pilotConversionScore),
      className: bandClass(scoreToBand(pilotConversionScore)),
      rationale: `pilot_gates=${pilotPasses}/${pilotSignals.length}`,
    },
    {
      key: 'reliability',
      label: 'reliability',
      score: reliabilityScore,
      band: scoreToBand(reliabilityScore),
      className: bandClass(scoreToBand(reliabilityScore)),
      rationale: `infra_gates=${reliabilityPasses}/${reliabilitySignals.length}`,
    },
  ];

  const failedGates = gates.filter((g) => !g.pass);
  return {
    generated_at: new Date().toISOString(),
    readiness_state: failedGates.length === 0 ? 'GO' : 'NO_GO',
    pass_count: gates.length - failedGates.length,
    fail_count: failedGates.length,
    gates,
    queue_counts: queueCounts,
    war_board,
  };
}
