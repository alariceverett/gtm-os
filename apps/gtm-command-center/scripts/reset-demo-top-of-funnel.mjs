import 'dotenv/config';
import { pool, closePool } from './db.mjs';
import {
  DEMO_TAG,
  DEMO_FUNNEL,
  DEMO_SEQUENCE_SLUGS,
  DEMO_WEBSITES,
} from './demo-top-of-funnel-dataset.mjs';

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  const apply = hasFlag('--apply');

  const client = await pool.connect();
  try {
    const templateIdsRes = await client.query(
      `select id from public.cc_sequence_templates where slug = any($1::text[])`,
      [DEMO_SEQUENCE_SLUGS],
    );
    const templateIds = templateIdsRes.rows.map((r) => r.id);

    const enrollmentCountRes = await client.query(
      `select count(*)::int as count
       from public.cc_sequence_enrollments
       where lead_key like 'lead:demo:%'
          or sequence_template_id = any($1::uuid[])`,
      [templateIds.length ? templateIds : ['00000000-0000-0000-0000-000000000000']],
    );

    const activityCountRes = await client.query(
      `select count(*)::int as count
       from public.cc_activity_log
       where lead_key like 'lead:demo:%'
          or details->>'demo_tag' = $1`,
      [DEMO_TAG],
    );

    const qaCountRes = await client.query(
      `select count(*)::int as count
       from public.cc_qualified_accounts
       where website = any($1::text[])`,
      [DEMO_WEBSITES],
    );

    const funnelCountRes = await client.query(
      `select count(*)::int as count
       from public.cc_funnels
       where slug = $1`,
      [DEMO_FUNNEL.slug],
    );

    const templateCountRes = await client.query(
      `select count(*)::int as count
       from public.cc_sequence_templates
       where slug = any($1::text[])`,
      [DEMO_SEQUENCE_SLUGS],
    );

    const summary = {
      ok: true,
      demo_tag: DEMO_TAG,
      dry_run: !apply,
      would_delete: {
        cc_activity_log: activityCountRes.rows[0].count,
        cc_sequence_enrollments: enrollmentCountRes.rows[0].count,
        cc_qualified_accounts: qaCountRes.rows[0].count,
        cc_funnels: funnelCountRes.rows[0].count,
        cc_sequence_templates: templateCountRes.rows[0].count,
      },
    };

    if (!apply) {
      summary.next_step = 'Re-run with --apply to execute deletes.';
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    await client.query('begin');

    const deletedActivity = await client.query(
      `delete from public.cc_activity_log
       where lead_key like 'lead:demo:%'
          or details->>'demo_tag' = $1`,
      [DEMO_TAG],
    );

    const deletedEnrollments = await client.query(
      `delete from public.cc_sequence_enrollments
       where lead_key like 'lead:demo:%'
          or sequence_template_id = any($1::uuid[])`,
      [templateIds.length ? templateIds : ['00000000-0000-0000-0000-000000000000']],
    );

    const deletedAccounts = await client.query(
      `delete from public.cc_qualified_accounts
       where website = any($1::text[])`,
      [DEMO_WEBSITES],
    );

    const deletedFunnel = await client.query(
      `delete from public.cc_funnels where slug = $1`,
      [DEMO_FUNNEL.slug],
    );

    const deletedTemplates = await client.query(
      `delete from public.cc_sequence_templates where slug = any($1::text[])`,
      [DEMO_SEQUENCE_SLUGS],
    );

    await client.query('commit');

    console.log(
      JSON.stringify(
        {
          ok: true,
          demo_tag: DEMO_TAG,
          dry_run: false,
          deleted: {
            cc_activity_log: deletedActivity.rowCount,
            cc_sequence_enrollments: deletedEnrollments.rowCount,
            cc_qualified_accounts: deletedAccounts.rowCount,
            cc_funnels: deletedFunnel.rowCount,
            cc_sequence_templates: deletedTemplates.rowCount,
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
