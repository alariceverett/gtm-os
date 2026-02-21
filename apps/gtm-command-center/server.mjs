import http from 'node:http';
import { URL } from 'node:url';
import { Pool } from 'pg';
import { createServerSupabaseClient } from './lib/supabase-clients.mjs';
import { resolveRuntimeMode } from './lib/supabase-env.mjs';

const port = Number(process.env.PORT || 3000);
const runtimeMode = resolveRuntimeMode(process.env);
const databaseUrl = process.env.DATABASE_URL;

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

function pageHtml(content) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GTM Command Center</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem; }
      table { border-collapse: collapse; width: 100%; max-width: 1000px; }
      th, td { border: 1px solid #ddd; padding: 0.6rem; text-align: left; }
      th { background: #f7f7f7; }
      .status { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .error { color: #b00020; margin-bottom: 1rem; }
      .muted { color: #666; margin: 0.5rem 0 1rem; }
      a { color: #0050b3; }
      button { padding: 0.35rem 0.6rem; cursor: pointer; }
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

function assertStore() {
  if (!pool && !supabase) {
    throw new Error('Set DATABASE_URL or SUPABASE_URL + SUPABASE_ANON_KEY to read/write tasks');
  }
}

async function getTasks() {
  assertStore();

  if (supabase) {
    const { data, error } = await supabase
      .from('cc_operator_tasks')
      .select('id,title,status,priority')
      .order('priority', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  const query = `
    SELECT id, title, status, priority
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

function renderSetup(tasks, errorMessage = '') {
  const rows = tasks
    .map(
      (task) => `
      <tr>
        <td>${task.id}</td>
        <td>${task.title}</td>
        <td class="status">${task.status}</td>
        <td>${task.priority ?? ''}</td>
        <td>
          <form method="POST" action="/setup/${task.id}/advance">
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
    <p>Workflow: <code>todo → in_progress → done</code></p>
    ${errorMessage ? `<p class="error">${errorMessage}</p>` : ''}
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
    return redirect(res, '/setup');
  }

  if (req.method === 'GET' && reqUrl.pathname === '/setup') {
    try {
      const tasks = await getTasks();
      return send(res, 200, renderSetup(tasks));
    } catch (error) {
      return send(res, 500, renderSetup([], `Failed to load tasks: ${error.message}`));
    }
  }

  const advanceMatch = reqUrl.pathname.match(/^\/setup\/([^/]+)\/advance$/);
  if (req.method === 'POST' && advanceMatch) {
    const taskId = advanceMatch[1];

    try {
      await advanceStatus(taskId);
      return redirect(res, '/setup');
    } catch (error) {
      return send(res, 500, renderSetup([], `Failed to update task: ${error.message}`));
    }
  }

  return send(res, 404, '<h1>Not Found</h1><p>Try <a href="/setup">/setup</a>.</p>');
});

server.listen(port, () => {
  console.log(`GTM Command Center listening on http://localhost:${port} (mode: ${runtimeMode})`);
});
