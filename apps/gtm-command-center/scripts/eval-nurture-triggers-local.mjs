import 'dotenv/config';

const port = Number(process.env.PORT || 1981);
const endpoint = process.env.NURTURE_TRIGGER_EVAL_URL || `http://localhost:${port}/api/nurture/triggers/evaluate`;

const applyRequested = String(process.env.APPLY || 'false').toLowerCase() === 'true';

const body = {
  lead_key: process.env.LEAD_KEY || 'lead:local:sample',
  trigger_key: process.env.TRIGGER_KEY || 'no_reply_48h',
  last_reply_at: process.env.LAST_REPLY_AT || new Date(Date.now() - (49 * 60 * 60 * 1000)).toISOString(),
  meeting_completed: String(process.env.MEETING_COMPLETED || '').toLowerCase() === 'true',
  lead_magnet_downloaded: String(process.env.LEAD_MAGNET_DOWNLOADED || '').toLowerCase() === 'true',
  apply: applyRequested,
};

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const text = await response.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = { raw: text };
}

if (!response.ok) {
  console.error(JSON.stringify({ ok: false, status: response.status, endpoint, body, response: parsed }, null, 2));
  process.exitCode = 1;
} else {
  const planned = Array.isArray(parsed?.planned_actions) ? parsed.planned_actions : [];
  const preview = {
    dry_run: parsed?.dry_run === true,
    matched_rules: Number(parsed?.evaluation?.matched_rules?.length || 0),
    actions_produced: planned.length,
    ready_actions: planned.filter((a) => a.status === 'ready').length,
    blocked_actions: planned.filter((a) => a.status !== 'ready').length,
    apply_requested: applyRequested,
  };

  console.log(JSON.stringify({ ok: true, status: response.status, endpoint, body, preview, response: parsed }, null, 2));
}
