import 'dotenv/config';
import { pool, closePool } from './db.mjs';

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
        'founder-outreach-q1',
        'Founder Outreach Q1',
        'active',
        'email',
        'Book strategy calls from outbound founder list',
        'Local seed funnel for command center testing',
      ],
    );

    const funnelId = funnelRes.rows[0].id;

    const steps = [
      [1, 'Intro email', 'email', 0, { template: 'outreach_intro_v1' }],
      [2, 'LinkedIn follow-up', 'linkedin_dm', 2, { template: 'founder_dm_followup' }],
      [3, 'Breakup nudge', 'email', 5, { template: 'outreach_breakup_v1' }],
    ];

    for (const [position, name, actionType, delayDays, metadata] of steps) {
      await client.query(
        `insert into public.cc_funnel_steps (funnel_id, position, name, action_type, delay_days, metadata)
         values ($1,$2,$3,$4,$5,$6::jsonb)
         on conflict (funnel_id, position) do update
           set name = excluded.name,
               action_type = excluded.action_type,
               delay_days = excluded.delay_days,
               metadata = excluded.metadata,
               updated_at = now()`,
        [funnelId, position, name, actionType, delayDays, JSON.stringify(metadata)],
      );
    }

    const variants = [
      {
        slug: 'tof-direct-offer-v1',
        name: 'TOF Direct Offer v1',
        description: 'Direct CTA to book an intro call',
        metadata: {
          variant: 'direct_offer',
          cadence_days: [0, 2, 5],
          primary_cta: 'Book a 15-min strategy call',
          steps: [
            { step_type: 'email', delay_days: 0, message_stub: 'Quick intro + value prop', cta: 'Pick a call slot' },
            { step_type: 'linkedin_dm', delay_days: 2, message_stub: 'Bump with one-liner proof', cta: 'Reply YES for times' },
            { step_type: 'email', delay_days: 5, message_stub: 'Breakup with final offer', cta: 'Close loop or book now' }
          ]
        }
      },
      {
        slug: 'tof-proof-first-v1',
        name: 'TOF Proof First v1',
        description: 'Lead with case study then CTA',
        metadata: {
          variant: 'proof_first',
          cadence_days: [0, 3, 6],
          primary_cta: 'Reply for the full case study',
          steps: [
            { step_type: 'email', delay_days: 0, message_stub: 'Share headline result', cta: 'Reply and I will send breakdown' },
            { step_type: 'email', delay_days: 3, message_stub: 'Objection handling + social proof', cta: 'Open to a short walkthrough?' },
            { step_type: 'call', delay_days: 6, message_stub: 'Final nudge + soft close', cta: 'Book quick fit call' }
          ]
        }
      },
      {
        slug: 'tof-pain-point-v1',
        name: 'TOF Pain Point v1',
        description: 'Pain-led messaging with diagnostic CTA',
        metadata: {
          variant: 'pain_point',
          cadence_days: [0, 1, 4],
          primary_cta: 'Reply with your #1 bottleneck',
          steps: [
            { step_type: 'email', delay_days: 0, message_stub: 'Surface likely bottleneck', cta: 'Share your current blocker' },
            { step_type: 'linkedin_dm', delay_days: 1, message_stub: 'Confirm pain hypothesis', cta: 'Worth a quick diagnostic?' },
            { step_type: 'email', delay_days: 4, message_stub: 'Offer mini audit', cta: 'Send audit checklist?' }
          ]
        }
      }
    ];

    let firstTemplateId = null;
    for (const variant of variants) {
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
         returning id`,
        [variant.slug, variant.name, 'email', 'active', variant.description, 3, JSON.stringify(variant.metadata)],
      );
      if (!firstTemplateId) firstTemplateId = sequenceRes.rows[0].id;
    }

    await client.query(
      `insert into public.cc_sequence_enrollments (sequence_template_id, lead_key, status, current_step_index, next_send_at, metadata)
       values ($1,$2,$3,$4,now() + interval '1 day',$5::jsonb)
       on conflict (sequence_template_id, lead_key) do update
         set status = excluded.status,
             current_step_index = excluded.current_step_index,
             next_send_at = excluded.next_send_at,
             metadata = excluded.metadata,
             updated_at = now()`,
      [firstTemplateId, 'lead:sample:acme-co', 'queued', 0, JSON.stringify({ source: 'seed', funnel_id: 'founder-outreach-q1', entry_point: 'cold_email' })],
    );

    await client.query('commit');

    console.log(JSON.stringify({ ok: true, funnel_id: funnelId, seeded_sequence_variants: 3, sample_sequence_template_id: firstTemplateId }, null, 2));
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
