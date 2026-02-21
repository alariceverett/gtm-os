import http from 'node:http';
import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { createServerSupabaseClient } from './lib/supabase-clients.mjs';
import { resolveRuntimeMode } from './lib/supabase-env.mjs';

const port = Number(process.env.PORT || 3000);
const runtimeMode = resolveRuntimeMode(process.env);
const databaseUrl = process.env.DATABASE_URL;
const queueFilePath = process.env.OPERATOR_QUEUE_FILE || path.join(process.cwd(), '.run', 'operator-task-queue.json');

const pool = runtimeMode === 'pg' && databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : null;

const supabase = runtimeMode === 'supabase'
  ? createServerSupabaseClient(process.env)
  : null;

const STATUS_FLOW = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'done',
};

const OPERATOR_SECTIONS = ['current', 'blocked', 'next', 'done', 'waiting_on_user'];

function pageHtml(content) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GTM Command Center</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem; }
      table { border-collapse: collapse; width: 100%; max-width: 1200px; }
      th, td { border: 1px solid #ddd; padding: 0.6rem; text-align: left; vertical-align: top; }
      th { background: #f7f7f7; }
      .status { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .error { color: #b00020; margin-bottom: 1rem; }
      .muted { color: #666; margin: 0.5rem 0 1rem; }
      .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; max-width: 1200px; }
      .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; background: #fff; }
      .card h3 { margin: 0 0 8px 0; font-size: 1rem; }
      .count { font-size: 1.5rem; font-weight: 600; }
      .meta { color: #666; font-size: 0.85rem; }
      .pill { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 999px; background: #f1f4f8; font-size: 0.8rem; }
      a { color: #0050b3; }
      button { padding: 0.35rem 0.6rem; cursor: pointer; }
      ul { margin: 0.25rem 0 0 1rem; padding: 0; }
      li { margin: 0.25rem 0; }
    </style>
  </head>
  <body>
    ${content}
  </body>
</html>`;
}

function send(res, statusCode, html) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pageHtml(html));
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function assertStore() {
  if (!pool && !supabase) {
    throw new Error('Set DATABASE_URL or SUPABASE_URL + SUPABASE_ANON_KEY to read/write tasks');
  }
}

async function getTasks({ allowEmpty = false } = {}) {
  if (!pool && !supabase) {
    if (allowEmpty) return [];
    assertStore();
  }

  if (supabase) {
    const { data, error } = await supabase
      .from('cc_operator_tasks')
      .select('*')
      .order('priority', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  const query = `
    SELECT *
    FROM public.cc_operator_tasks
    ORDER BY priority ASC NULLS LAST, id ASC
  `;

  const { rows } = await pool.query(query);
  return rows;
}

async function advanceStatus(taskId) {
  assertStore();

  if (supabase) {
    const { data: row, error: selectError } = await supabase
      .from('cc_operator_tasks')
      .select('status')
      .eq('id', taskId)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!row) return false;

    const currentStatus = String(row.status || 'todo');
    const nextStatus = STATUS_FLOW[currentStatus] || 'todo';

    const { error: updateError } = await supabase
      .from('cc_operator_tasks')
      .update({ status: nextStatus })
      .eq('id', taskId);

    if (updateError) throw updateError;
    return true;
  }

  const selectResult = await pool.query(
    'SELECT status FROM public.cc_operator_tasks WHERE id = $1',
    [taskId],
  );

  if (selectResult.rowCount === 0) {
    return false;
  }

  const currentStatus = String(selectResult.rows[0].status || 'todo');
  const nextStatus = STATUS_FLOW[currentStatus] || 'todo';

  await pool.query(
    'UPDATE public.cc_operator_tasks SET status = $1 WHERE id = $2',
    [nextStatus, taskId],
  );

  return true;
}

async function readQueueOverrides() {
  try {
    const raw = await readFile(queueFilePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (Array.isArray(parsed.tasks)) {
      return parsed.tasks;
    }

    return [];
  } catch {
    return [];
  }
}

function normalizeSection(value) {
  const v = String(value || '').trim().toLowerCase();

  if (['current', 'now', 'doing', 'in_progress', 'in progress', 'running', 'started'].includes(v)) return 'current';
  if (['blocked', 'stuck'].includes(v)) return 'blocked';
  if (['next', 'todo', 'queued', 'queue', 'ready'].includes(v)) return 'next';
  if (['done', 'completed', 'complete', 'cancelled', 'canceled'].includes(v)) return 'done';
  if (['waiting_on_user', 'waiting on user', 'user_wait', 'needs_user', 'needs input', 'waiting'].includes(v)) return 'waiting_on_user';

  return '';
}

function sectionFromTask(task) {
  const explicit = normalizeSection(
    task.section
    ?? task.operator_section
    ?? task.operator_state
    ?? task.queue_state
    ?? task.lane,
  );

  if (explicit) return explicit;

  const fromStatus = normalizeSection(task.status);
  if (fromStatus) return fromStatus;

  return 'next';
}

function summarizeOperatorView(tasks, queueOverrides = []) {
  const queueById = new Map();
  for (const q of queueOverrides) {
    if (q?.id == null) continue;
    queueById.set(String(q.id), q);
  }

  const bucketed = {
    current: [],
    blocked: [],
    next: [],
    done: [],
    waiting_on_user: [],
  };

  for (const task of tasks) {
    const queueMatch = queueById.get(String(task.id));
    const merged = queueMatch ? { ...task, ...queueMatch } : task;
    const section = sectionFromTask(merged);
    bucketed[section].push(merged);
  }

  bucketed.done.sort((a, b) => {
    const at = new Date(a.completed_at || a.updated_at || a.created_at || 0).getTime();
    const bt = new Date(b.completed_at || b.updated_at || b.created_at || 0).getTime();
    return bt - at;
  });

  return {
    counts: {
      current: bucketed.current.length,
      blocked: bucketed.blocked.length,
      next: bucketed.next.length,
      done: bucketed.done.length,
      waiting_on_user: bucketed.waiting_on_user.length,
      total: tasks.length,
    },
    sections: {
      ...bucketed,
      done: bucketed.done.slice(0, 12),
    },
  };
}

function renderTaskList(tasks) {
  if (!tasks.length) return '<span class="meta">None</span>';
  return `<ul>${tasks.map((task) => `<li>
    <strong>${escapeHtml(task.title || 'Untitled task')}</strong>
    <span class="pill">${escapeHtml(task.status || 'unknown')}</span>
    ${task.priority != null ? `<span class="meta">p${escapeHtml(task.priority)}</span>` : ''}
  </li>`).join('')}</ul>`;
}

function renderOperatorPane(tasks, errorMessage = '') {
  const freshness = new Date().toISOString();
  const view = summarizeOperatorView(tasks);

  const cards = [
    ['Current', view.counts.current],
    ['Blocked', view.counts.blocked],
    ['Next', view.counts.next],
    ['Done', view.counts.done],
    ['Waiting-on-user', view.counts.waiting_on_user],
  ].map(([label, value]) => `
      <div class="card">
        <h3>${label}</h3>
        <div class="count">${value}</div>
      </div>
    `).join('');

  return `
    <h1>Operator Status Pane</h1>
    <p class="muted">Runtime mode: <code>${runtimeMode}</code> · freshness: <code>${freshness}</code> · total tasks: <strong>${view.counts.total}</strong></p>
    ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ''}
    <div class="cards">${cards}</div>
    <br />
    <table>
      <thead>
        <tr>
          <th style="width:20%">Current</th>
          <th style="width:20%">Blocked</th>
          <th style="width:20%">Next</th>
          <th style="width:20%">Done (recent)</th>
          <th style="width:20%">Waiting-on-user</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${renderTaskList(view.sections.current)}</td>
          <td>${renderTaskList(view.sections.blocked)}</td>
          <td>${renderTaskList(view.sections.next)}</td>
          <td>${renderTaskList(view.sections.done)}</td>
          <td>${renderTaskList(view.sections.waiting_on_user)}</td>
        </tr>
      </tbody>
    </table>
    <p class="muted">Queue override file (optional): <code>${escapeHtml(queueFilePath)}</code></p>
  `;
}

function renderSetup(tasks, errorMessage = '') {
  const rows = tasks
    .map(
      (task) => `
      <tr>
        <td>${escapeHtml(task.id)}</td>
        <td>${escapeHtml(task.title)}</td>
        <td class="status">${escapeHtml(task.status)}</td>
        <td>${escapeHtml(task.priority ?? '')}</td>
        <td>
          <form method="POST" action="/setup/${encodeURIComponent(task.id)}/advance">
            <button type="submit" ${task.status === 'done' ? 'disabled' : ''}>
              ${task.status === 'done' ? 'Completed' : 'Advance status'}
            </button>
          </form>
        </td>
      </tr>
    `,
    )
    .join('');

  return `
    <h1>Setup Task Board</h1>
    <p class="muted">Runtime mode: <code>${runtimeMode}</code></p>
    <p>Workflow: <code>todo → in_progress → done</code> · <a href="/operator">Operator pane</a></p>
    ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ''}
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5">No tasks found.</td></tr>'}
      </tbody>
    </table>
  `;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && reqUrl.pathname === '/') {
    return redirect(res, '/operator');
  }

  if (req.method === 'GET' && reqUrl.pathname === '/setup') {
    try {
      const tasks = await getTasks();
      return send(res, 200, renderSetup(tasks));
    } catch (error) {
      return send(res, 500, renderSetup([], `Failed to load tasks: ${error.message}`));
    }
  }

  if (req.method === 'GET' && (reqUrl.pathname === '/operator' || reqUrl.pathname === '/operator/status')) {
    try {
      const [tasks, queueOverrides] = await Promise.all([getTasks({ allowEmpty: true }), readQueueOverrides()]);
      const byId = new Map();
      for (const task of tasks) byId.set(String(task.id), task);
      for (const override of queueOverrides) {
        const key = String(override?.id ?? override?.task_id ?? '');
        if (!key) continue;
        byId.set(key, { ...(byId.get(key) || { id: key, title: override.title || 'Queued task' }), ...override });
      }
      return send(res, 200, renderOperatorPane(Array.from(byId.values())));
    } catch (error) {
      return send(res, 500, renderOperatorPane([], `Failed to load operator pane: ${error.message}`));
    }
  }

  const advanceMatch = reqUrl.pathname.match(/^\/setup\/([^/]+)\/advance$/);
  if (req.method === 'POST' && advanceMatch) {
    const taskId = decodeURIComponent(advanceMatch[1]);

    try {
      await advanceStatus(taskId);
      return redirect(res, '/setup');
    } catch (error) {
      return send(res, 500, renderSetup([], `Failed to update task: ${error.message}`));
    }
  }

  return send(res, 404, '<h1>Not Found</h1><p>Try <a href="/setup">/setup</a> or <a href="/operator">/operator</a>.</p>');
});

server.listen(port, () => {
  console.log(`GTM Command Center listening on http://localhost:${port} (mode: ${runtimeMode})`);
});
