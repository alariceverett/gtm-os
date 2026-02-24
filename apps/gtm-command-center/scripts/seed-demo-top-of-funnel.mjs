import 'dotenv/config';
import { pool, closePool } from './db.mjs';
import {
  DEMO_TAG,
  DEMO_FUNNEL,
  DEMO_SEQUENCE_TEMPLATES,
  DEMO_QUALIFIED_ACCOUNTS,
  DEMO_WEBSITES,
} from './demo-top-of-funnel-dataset.mjs';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const funnelRes = await client.query(
      `insert into public.cc_funnels (slug, name, status, channel, goal, notes)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (slug) do update
         set name = excluded.name,
             status = excluded.status,
             channel = excluded.channel,
             goal = excluded.goal,
             notes = excluded.notes,
             updated_at = now()
       returning id`,
      [
        DEMO_FUNNEL.slug,
        DEMO_FUNNEL.name,
        DEMO_FUNNEL.status,
        DEMO_FUNNEL.channel,
        DEMO_FUNNEL.goal,
        DEMO_FUNNEL.notes,
      ],
    );
    const funnelId = funnelRes.rows[0].id;

    for (const [position, name, actionType, delayDays, metadata] of DEMO_FUNNEL.steps) {
      await client.query(
        `insert into public.cc_funnel_steps (funnel_id, position, name, action_type, delay_days, metadata)
         values ($1,$2,$3,$4,$5,$6::jsonb)
         on conflict (funnel_id, position) do update
           set name = excluded.name,
               action_type = excluded.action_type,
               delay_days = excluded.delay_days,
               metadata = excluded.metadata,
               updated_at = now()`,
        [funnelId, position, name, actionType, delayDays, JSON.stringify({ ...metadata, demo_tag: DEMO_TAG })],
      );
    }

    const templatesBySlug = new Map();
    for (const variant of DEMO_SEQUENCE_TEMPLATES) {
      const sequenceRes = await client.query(
        `insert into public.cc_sequence_templates (slug, name, channel, status, description, step_count, metadata)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb)
         on conflict (slug) do update
           set name = excluded.name,
               channel = excluded.channel,
               status = excluded.status,
               description = excluded.description,
               step_count = excluded.step_count,
               metadata = excluded.metadata,
               updated_at = now()
         returning id, slug`,
        [variant.slug, variant.name, 'email', 'active', variant.description, 3, JSON.stringify(variant.metadata)],
      );
      templatesBySlug.set(sequenceRes.rows[0].slug, sequenceRes.rows[0].id);
    }

    await client.query(
      `delete from public.cc_qualified_accounts
       where website = any($1::text[])`,
      [DEMO_WEBSITES],
    );

    let createdQualifiedAccounts = 0;
    let upsertedEnrollments = 0;
    let insertedReplyEvents = 0;

    for (let i = 0; i < DEMO_QUALIFIED_ACCOUNTS.length; i += 1) {
      const account = DEMO_QUALIFIED_ACCOUNTS[i];
      const template = DEMO_SEQUENCE_TEMPLATES[i % DEMO_SEQUENCE_TEMPLATES.length];
      const templateId = templatesBySlug.get(template.slug);

      const qaRes = await client.query(
        `insert into public.cc_qualified_accounts
         (brand, website, est_spend_tier, channels, contact_role, qualification_confidence, is_qualified, outreach_enrolled_at, outreach_sequence_template_id, pipeline_stage)
         values ($1,$2,$3,$4::jsonb,$5,$6,$7,now() - ($8::int || ' hours')::interval,$9,$10)
         returning id`,
        [
          account.brand,
          account.website,
          account.est_spend_tier,
          JSON.stringify(account.channels),
          account.contact_role,
          account.qualification_confidence,
          true,
          i + 1,
          templateId,
          account.pipeline_stage,
        ],
      );
      const qualifiedAccountId = qaRes.rows[0].id;
      createdQualifiedAccounts += 1;

      const enrollmentRes = await client.query(
        `insert into public.cc_sequence_enrollments (sequence_template_id, lead_key, status, current_step_index, next_send_at, metadata)
         values ($1,$2,$3,$4,now() + interval '1 day',$5::jsonb)
         on conflict (sequence_template_id, lead_key) do update
           set status = excluded.status,
               current_step_index = excluded.current_step_index,
               next_send_at = excluded.next_send_at,
               metadata = excluded.metadata,
               updated_at = now()
         returning id`,
        [
          templateId,
          account.lead_key,
          'queued',
          0,
          JSON.stringify({
            source: 'demo_seed',
            demo_tag: DEMO_TAG,
            funnel_id: DEMO_FUNNEL.slug,
            entry_point: account.entry_point,
            qualified_account_id: qualifiedAccountId,
          }),
        ],
      );
      upsertedEnrollments += 1;

      await client.query(
        `insert into public.cc_activity_log
         (event_type, lead_key, sequence_template_id, sequence_enrollment_id, actor, details)
         values ($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          'reply_classified',
          account.lead_key,
          templateId,
          enrollmentRes.rows[0].id,
          'demo_seed',
          JSON.stringify({
            demo_tag: DEMO_TAG,
            classification: account.reply_classification,
            next_action: account.next_action,
            reply_text: account.reply_text,
            funnel_id: DEMO_FUNNEL.slug,
            entry_point: account.entry_point,
          }),
        ],
      );
      insertedReplyEvents += 1;
    }

    await client.query('commit');

    console.log(
      JSON.stringify(
        {
          ok: true,
          demo_tag: DEMO_TAG,
          funnel_slug: DEMO_FUNNEL.slug,
          sequence_templates_seeded: DEMO_SEQUENCE_TEMPLATES.length,
          qualified_accounts_seeded: createdQualifiedAccounts,
          sequence_enrollments_upserted: upsertedEnrollments,
          reply_events_inserted: insertedReplyEvents,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('rollback');
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
