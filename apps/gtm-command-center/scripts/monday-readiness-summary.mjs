import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRuntimeMode } from '../lib/supabase-env.mjs';
import { evaluateMondayReadiness } from '../lib/monday-readiness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function gateLine(gate) {
  const status = gate.pass ? 'PASS' : 'FAIL';
  return `${status.padEnd(4)}  ${gate.id}  ${gate.name}  [actual: ${gate.actual}]`;
}

async function main() {
  const runtimeMode = resolveRuntimeMode(process.env);
  const readiness = await evaluateMondayReadiness({ runtimeMode, projectRoot });

  console.log('=== MONDAY GO/NO-GO READINESS ===');
  console.log(`Generated: ${readiness.generated_at}`);
  console.log(`Decision:  ${readiness.readiness_state}`);
  console.log(`Summary:   pass=${readiness.pass_count} fail=${readiness.fail_count}`);
  console.log('');
  console.log('Gates:');
  for (const gate of readiness.gates || []) console.log(`- ${gateLine(gate)}`);
  console.log('');
  console.log(`Queue counts: now=${readiness.queue_counts.now} next=${readiness.queue_counts.next} blocked=${readiness.queue_counts.blocked} waiting_on_user=${readiness.queue_counts.waiting_on_user} done=${readiness.queue_counts.done}`);
  console.log('MARKER:MONDAY_READINESS_SUMMARY');

  if (readiness.readiness_state !== 'GO') process.exitCode = 2;
}

main().catch((error) => {
  console.error('monday readiness summary failed:', error.message);
  process.exitCode = 1;
});
