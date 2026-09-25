// HOME Sync Cloudflare Worker — current /api contract + semantic sentence review.
// Required bindings/secrets: DB (D1), HOME_TOKEN (secret), OPENAI_API_KEY (secret).
// The OpenAI request is stateless (store:false). Never place either secret in this file.

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

const reply = (status, value) => new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
const stamp = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const decode = row => row && JSON.parse(row.body);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function safeText(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function constantTimeBearer(request, token) {
  const raw = request.headers.get('authorization') || '';
  const a = new TextEncoder().encode(raw);
  const b = new TextEncoder().encode(`Bearer ${token}`);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

async function readJson(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 120000) throw new HttpError(413, 'Request too large');
  const raw = await request.text();
  if (raw.length > 120000) throw new HttpError(413, 'Request too large');
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch (_) { throw new HttpError(400, 'Invalid JSON'); }
}

async function openAIReview(env, input) {
  if (!env.OPENAI_API_KEY) throw new HttpError(503, 'OPENAI_API_KEY is not configured');

  const sentence = safeText(input.sentence, 2400);
  if (sentence.length < 3) throw new HttpError(400, 'Sentence is required');

  const context = {
    title: safeText(input.title, 220),
    topic: safeText(input.topic, 120),
    learning_method: safeText(input.method, 60),
    content_depth: safeText(input.contentDepth, 60),
    question: safeText(input.question, 1000),
    prompt: safeText(input.prompt, 1000),
    takeaway: safeText(input.takeaway, 1200),
    options: Array.isArray(input.options) ? input.options.slice(0, 4).map(x => safeText(x, 500)) : [],
    selected: Number.isInteger(input.selected) ? input.selected : null,
    correct: Number.isInteger(input.correct) ? input.correct : null,
    sentence,
  };

  const instructions = [
    'You are HOME Sentence Reviewer, a rigorous learning evaluator.',
    'Judge the learner\'s raw answer semantically against the supplied learning context and the exact task they were asked to perform.',
    'Do not reward verbosity, polished English, keyword matching, or stylistic sophistication by itself.',
    'Reward conceptual correctness, causal understanding, precise distinctions, and useful transfer when the prompt asks for transfer.',
    'A concise answer can score very highly if it is correct and precise.',
    'If the prompt did not ask for real-world application, set applicationObserved=false and do not penalize the answer for lacking an application example.',
    'If there is a misconception, state it briefly and specifically. If there is none, misconception must be an empty string.',
    'Feedback must be concise, concrete, and tell the learner what was strong and the single most useful improvement.',
    'nextFocus must identify the next learning skill HOME should train: understanding, application, precision, depth, or advance.',
  ].join(' ');

  const schema = {
    type: 'object',
    properties: {
      understanding: { type: 'integer', minimum: 0, maximum: 100 },
      application: { type: 'integer', minimum: 0, maximum: 100 },
      applicationObserved: { type: 'boolean' },
      precision: { type: 'integer', minimum: 0, maximum: 100 },
      depth: { type: 'integer', minimum: 0, maximum: 100 },
      taskFulfillment: { type: 'integer', minimum: 0, maximum: 100 },
      overall: { type: 'integer', minimum: 0, maximum: 100 },
      verdict: { type: 'string', enum: ['weak', 'developing', 'solid', 'strong'] },
      nextFocus: { type: 'string', enum: ['understanding', 'application', 'precision', 'depth', 'advance'] },
      feedback: { type: 'string' },
      misconception: { type: 'string' },
    },
    required: [
      'understanding', 'application', 'applicationObserved', 'precision', 'depth',
      'taskFulfillment', 'overall', 'verdict', 'nextFocus', 'feedback', 'misconception'
    ],
    additionalProperties: false,
  };

  const apiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.6-terra',
      reasoning: { effort: 'low' },
      store: false,
      instructions,
      input: JSON.stringify(context),
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'home_sentence_review',
          strict: true,
          schema,
        },
      },
      max_output_tokens: 500,
    }),
  });

  const raw = await apiResponse.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
  if (!apiResponse.ok) {
    const detail = safeText(data?.error?.message || raw || 'OpenAI request failed', 300);
    throw new HttpError(502, `Sentence reviewer failed: ${detail}`);
  }

  let outputText = typeof data.output_text === 'string' ? data.output_text : '';
  if (!outputText && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const part of item.content) {
        if (part?.type === 'output_text' && typeof part.text === 'string') outputText += part.text;
      }
    }
  }
  if (!outputText) throw new HttpError(502, 'Sentence reviewer returned no text');

  let review;
  try { review = JSON.parse(outputText); }
  catch (_) { throw new HttpError(502, 'Sentence reviewer returned invalid JSON'); }

  return {
    requestId: safeText(input.requestId, 120),
    cardId: safeText(input.cardId, 160),
    reviewedAt: stamp(),
    model: 'gpt-5.6-terra',
    review,
  };
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();

      // Public health probe reveals no user data or secrets.
      if (path === '/' && method === 'GET') return reply(200, { service: 'HOME Sync', ok: true });
      if (path === '/health' && method === 'GET') return reply(200, { ok: true, reviewerConfigured: Boolean(env.OPENAI_API_KEY) });

      if (!env.DB || !env.HOME_TOKEN || String(env.HOME_TOKEN).length < 16) {
        throw new HttpError(503, 'HOME service not configured');
      }
      if (!constantTimeBearer(request, env.HOME_TOKEN)) throw new HttpError(401, 'Unauthorized');

      const db = env.DB;
      const get = async (table, key) => decode(await db.prepare(`SELECT body FROM ${table} WHERE id=?`).bind(key).first());
      const list = async table => {
        const order = table === 'attempts' || table === 'activity' ? 'created_at' : 'updated_at';
        const rows = await db.prepare(`SELECT body FROM ${table} ORDER BY ${order} DESC LIMIT 1000`).all();
        return rows.results.map(decode).filter(Boolean);
      };
      const upsert = async (table, body) => {
        const record = { ...body, id: safeText(body?.id, 160) || uuid(), updatedAt: stamp() };
        await db.prepare(`INSERT INTO ${table} (id,body,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`)
          .bind(record.id, JSON.stringify(record), record.updatedAt).run();
        return record;
      };

      if (path === '/api/snapshot' && method === 'GET') {
        return reply(200, {
          tasks: await list('tasks'),
          cards: await list('cards'),
          attempts: await list('attempts'),
          activity: await list('activity'),
        });
      }

      if (path === '/api/tasks' && method === 'GET') return reply(200, await list('tasks'));
      if (path === '/api/tasks' && method === 'POST') {
        const input = await readJson(request);
        const title = safeText(input.title, 160);
        if (!title) throw new HttpError(400, 'Task title is required');
        return reply(201, await upsert('tasks', {
          done: false, area: 'Personal', minutes: 0, note: '', ...input, title,
          id: safeText(input.id, 160) || uuid(),
        }));
      }

      const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
      if (taskMatch && (method === 'PATCH' || method === 'PUT')) {
        const key = decodeURIComponent(taskMatch[1]);
        const old = await get('tasks', key);
        if (!old) throw new HttpError(404, 'Task not found');
        const input = await readJson(request);
        const merged = { ...old, ...input, id: key };
        if (!safeText(merged.title, 160)) throw new HttpError(400, 'Task title is required');
        return reply(200, await upsert('tasks', merged));
      }
      if (taskMatch && method === 'DELETE') {
        const key = decodeURIComponent(taskMatch[1]);
        await db.prepare('DELETE FROM tasks WHERE id=?').bind(key).run();
        return reply(200, { ok: true, id: key });
      }

      if (path === '/api/cards' && method === 'GET') return reply(200, await list('cards'));
      if (path === '/api/cards' && method === 'POST') {
        const input = await readJson(request);
        const title = safeText(input.title, 220);
        if (!title) throw new HttpError(400, 'Card title is required');
        return reply(201, await upsert('cards', { ...input, title, id: safeText(input.id, 160) || uuid() }));
      }

      if (path === '/api/attempts' && method === 'POST') {
        const input = await readJson(request);
        const attemptId = safeText(input.id, 180) || uuid();
        const cardId = safeText(input.cardId || input.id, 160) || 'unknown';
        const createdAt = safeText(input.createdAt, 80) || (Number(input.at) > 0 ? new Date(Number(input.at)).toISOString() : stamp());
        const item = { ...input, id: attemptId, cardId, createdAt };
        await db.prepare('INSERT INTO attempts (id,card_id,body,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET card_id=excluded.card_id,body=excluded.body,created_at=excluded.created_at')
          .bind(item.id, item.cardId, JSON.stringify(item), item.createdAt).run();
        return reply(201, item);
      }

      if (path === '/api/activity' && method === 'POST') {
        const input = await readJson(request);
        const item = {
          ...input,
          id: safeText(input.id, 180) || uuid(),
          kind: safeText(input.kind || input.type, 100) || 'activity',
          createdAt: safeText(input.createdAt, 80) || (Number(input.at) > 0 ? new Date(Number(input.at)).toISOString() : stamp()),
        };
        await db.prepare('INSERT INTO activity (id,kind,body,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,body=excluded.body,created_at=excluded.created_at')
          .bind(item.id, item.kind, JSON.stringify(item), item.createdAt).run();
        return reply(201, item);
      }

      if (path === '/api/review-sentence' && method === 'POST') {
        const input = await readJson(request);
        return reply(200, await openAIReview(env, input));
      }

      // Compatibility with the first HOME Worker prototype.
      if (path === '/v1/snapshot' && method === 'GET') {
        const tasks = await list('tasks');
        return reply(200, {
          open: tasks.filter(t => !t.done), completed: tasks.filter(t => t.done),
          cards: await list('cards'), attempts: await list('attempts'),
        });
      }

      return reply(404, { error: 'Not found' });
    } catch (error) {
      return reply(Number(error?.status) || 400, { error: safeText(error?.message || 'HOME Sync error', 500) });
    }
  },
};
