import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const reportsDir = path.resolve(projectRoot, '.run', 'reports');
const now = new Date();
const dateStamp = now.toISOString().slice(0, 10);

async function getData() {
  if (!process.env.DATABASE_URL) {
    return {
      mode: 'placeholder',
      generatedAt: now.toISOString(),
      delegations24h: 'n/a',
      completed24h: 'n/a',
      lifecycleMovement7d: 'n/a',
      campaignSpend7d: 'n/a',
      campaignRevenue7d: 'n/a',
      notes: ['No DATABASE_URL set; summary generated in local placeholder mode.'],
    };
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    const sql = `
      with delegations_24h as (
        select count(*)::int as c
        from public.cc_delegations
        where created_at >= now() - interval '24 hours'
      ),
      completed_24h as (
        select count(*)::int as c
        from public.cc_delegations
        where completed_at >= now() - interval '24 hours'
      ),
      lifecycle_movement_7d as (
        select count(*)::int as c
        from public.lifecycle_events
        where event_at >= now() - interval '7 days'
          and coalesce(from_stage, '') <> coalesce(to_stage, '')
      ),
      campaign_7d as (
        select
          coalesce(round(sum(spend)::numeric, 2), 0)::text as spend,
          coalesce(round(sum(revenue)::numeric, 2), 0)::text as revenue
        from public.campaign_metrics
        where metric_date >= current_date - interval '7 days'
      )
      select
        (select c from delegations_24h) as delegations_24h,
        (select c from completed_24h) as completed_24h,
        (select c from lifecycle_movement_7d) as lifecycle_movement_7d,
        (select spend from campaign_7d) as campaign_spend_7d,
        (select revenue from campaign_7d) as campaign_revenue_7d
    `;

    const { rows } = await pool.query(sql);
    const row = rows[0] ?? {};

    return {
      mode: 'postgres',
      generatedAt: now.toISOString(),
      delegations24h: Number(row.delegations_24h ?? 0),
      completed24h: Number(row.completed_24h ?? 0),
      lifecycleMovement7d: Number(row.lifecycle_movement_7d ?? 0),
      campaignSpend7d: Number(row.campaign_spend_7d ?? 0),
      campaignRevenue7d: Number(row.campaign_revenue_7d ?? 0),
      notes: ['Nightly summary scaffold; extend with alerting/routing as needed.'],
    };
  } catch (error) {
    return {
      mode: 'postgres-partial',
      generatedAt: now.toISOString(),
      delegations24h: 'n/a',
      completed24h: 'n/a',
      lifecycleMovement7d: 'n/a',
      campaignSpend7d: 'n/a',
      campaignRevenue7d: 'n/a',
      notes: [`Query failed: ${error.message}`],
    };
  } finally {
    await pool.end();
  }
}

function renderMarkdown(data) {
  return `# Nightly Command Center Summary (${dateStamp})\n\n- Generated at: ${data.generatedAt}\n- Mode: ${data.mode}\n\n## Core KPIs\n- Delegations (24h): ${data.delegations24h}\n- Completed (24h): ${data.completed24h}\n- Lifecycle movement (7d): ${data.lifecycleMovement7d}\n- Campaign spend (7d): ${data.campaignSpend7d}\n- Campaign revenue (7d): ${data.campaignRevenue7d}\n\n## Notes\n${(data.notes || []).map((n) => `- ${n}`).join('\n')}\n`;
}

async function main() {
  const data = await getData();
  await mkdir(reportsDir, { recursive: true });

  const mdPath = path.join(reportsDir, `nightly-summary-${dateStamp}.md`);
  const jsonPath = path.join(reportsDir, `nightly-summary-${dateStamp}.json`);
  const latestPath = path.join(reportsDir, 'nightly-summary-latest.md');

  await writeFile(mdPath, renderMarkdown(data), 'utf8');
  await writeFile(jsonPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await writeFile(latestPath, renderMarkdown(data), 'utf8');

  console.log(`Wrote nightly summary:\n- ${mdPath}\n- ${jsonPath}\n- ${latestPath}`);
}

main().catch((error) => {
  console.error('nightly summary failed:', error.message);
  process.exitCode = 1;
});
