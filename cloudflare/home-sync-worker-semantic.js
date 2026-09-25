// HOME Sync Cloudflare Worker — current /api contract + semantic learning + private WhatsApp inbox.
// Required bindings/secrets: DB (D1), HOME_TOKEN (secret), OPENAI_API_KEY (secret).
// OpenAI requests are stateless (store:false). Never place either secret in this file.

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

function responseOutputText(data) {
  let outputText = typeof data?.output_text === 'string' ? data.output_text : '';
  if (!outputText && Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const part of item.content) {
        if (part?.type === 'output_text' && typeof part.text === 'string') outputText += part.text;
      }
    }
  }
  return outputText;
}

async function callStructuredModel(env, name, instructions, context, schema, maxOutputTokens = 500) {
  if (!env.OPENAI_API_KEY) throw new HttpError(503, 'OPENAI_API_KEY is not configured');
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
        format: { type: 'json_schema', name, strict: true, schema },
      },
      max_output_tokens: maxOutputTokens,
    }),
  });

  const raw = await apiResponse.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
  if (!apiResponse.ok) {
    const detail = safeText(data?.error?.message || raw || 'OpenAI request failed', 300);
    throw new HttpError(502, `AI request failed: ${detail}`);
  }
  const outputText = responseOutputText(data);
  if (!outputText) throw new HttpError(502, 'AI returned no text');
  try { return JSON.parse(outputText); }
  catch (_) { throw new HttpError(502, 'AI returned invalid JSON'); }
}

async function openAIReview(env, input) {
  const sentence = safeText(input.sentence, 2400);
  if (sentence.length < 3) throw new HttpError(400, 'Sentence is required');

  const sections = Array.isArray(input.sections)
    ? input.sections.slice(0, 5).map(s => Array.isArray(s)
        ? [safeText(s[0], 180), safeText(s[1], 900)]
        : safeText(s, 900))
    : [];

  const context = {
    title: safeText(input.title, 220),
    topic: safeText(input.topic, 120),
    learning_method: safeText(input.method, 60),
    content_depth: safeText(input.contentDepth, 60),
    question: safeText(input.question, 1000),
    prompt: safeText(input.prompt, 1000),
    lead: safeText(input.lead, 1200),
    takeaway: safeText(input.takeaway, 1200),
    sections,
    options: Array.isArray(input.options) ? input.options.slice(0, 4).map(x => safeText(x, 500)) : [],
    selected: Number.isInteger(input.selected) ? input.selected : null,
    correct: Number.isInteger(input.correct) ? input.correct : null,
    sentence,
  };

  const instructions = [
    'You are HOME Sentence Reviewer, a rigorous learning evaluator.',
    'Judge the learner\'s raw answer semantically against the supplied learning context and exact task.',
    'Do not reward verbosity, polished English, keyword matching, or style by itself.',
    'Reward conceptual correctness, causal understanding, precise distinctions, and useful transfer when relevant.',
    'A concise answer can score very highly if correct and precise.',
    'If the prompt did not ask for real-world application, set applicationObserved=false and do not penalize missing application.',
    'If there is a misconception, state it briefly. Otherwise misconception must be empty.',
    'Feedback must be concise and name the strongest point and single most useful improvement.',
    'nextFocus must be understanding, application, precision, depth, or advance.',
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
    required: ['understanding','application','applicationObserved','precision','depth','taskFulfillment','overall','verdict','nextFocus','feedback','misconception'],
    additionalProperties: false,
  };

  const review = await callStructuredModel(env, 'home_sentence_review', instructions, context, schema, 500);
  return {
    requestId: safeText(input.requestId, 120),
    attemptId: safeText(input.attemptId, 180),
    cardId: safeText(input.cardId, 160),
    reviewedAt: stamp(),
    model: 'gpt-5.6-terra',
    review,
  };
}

async function openAIWhatsApp(env, input) {
  const message = safeText(input.message, 2400);
  if (!message) throw new HttpError(400, 'WhatsApp message is required');
  const context = {
    receivedAt: Number(input.at) > 0 ? new Date(Number(input.at)).toISOString() : stamp(),
    timezone: safeText(input.timezone, 80) || 'Europe/London',
    chat: safeText(input.chat, 180),
    sender: safeText(input.sender, 180),
    message,
  };

  const instructions = [
    'You are HOME WhatsApp Inbox Intelligence for one private user.',
    'Classify whether this incoming WhatsApp message requires a concrete action by the user.',
    'Do not create tasks for greetings, jokes, reactions, general conversation, FYI-only updates, or vague possibilities.',
    'Create an action only for a concrete request, promised follow-up, explicit deadline, appointment/booking change, payment/admin action, document/file request, or a reply that is clearly expected.',
    'Be conservative: actionable should be true only when confidence is high.',
    'If timing is relative (tomorrow, Friday, later today), preserve it in dueText rather than inventing a timestamp.',
    'Task titles must be short and start with a verb. Never include unnecessary private message content in the title.',
    'taskNote may contain only the minimum context needed to act, including sender/chat when useful.',
    'summary should be a short private summary of the message.',
  ].join(' ');

  const schema = {
    type: 'object',
    properties: {
      actionable: { type: 'boolean' },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
      actionType: { type: 'string', enum: ['none','reply','task','reminder','followup','calendar'] },
      urgency: { type: 'string', enum: ['low','normal','high'] },
      taskTitle: { type: 'string' },
      taskNote: { type: 'string' },
      dueText: { type: 'string' },
      summary: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['actionable','confidence','actionType','urgency','taskTitle','taskNote','dueText','summary','reason'],
    additionalProperties: false,
  };

  return await callStructuredModel(env, 'home_whatsapp_message', instructions, context, schema, 450);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();

      if (path === '/' && method === 'GET') return reply(200, { service: 'HOME Sync', ok: true });
      if (path === '/health' && method === 'GET') return reply(200, { ok: true, reviewerConfigured: Boolean(env.OPENAI_API_KEY), whatsappConfigured: Boolean(env.OPENAI_API_KEY) });

      if (!env.DB || !env.HOME_TOKEN || String(env.HOME_TOKEN).length < 16) throw new HttpError(503, 'HOME service not configured');
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
      const savePrivateActivity = async body => {
        const item = {
          ...body,
          id: safeText(body?.id, 180) || uuid(),
          kind: safeText(body?.kind, 100) || 'private',
          createdAt: safeText(body?.createdAt, 80) || stamp(),
        };
        await db.prepare('INSERT INTO activity (id,kind,body,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,body=excluded.body,created_at=excluded.created_at')
          .bind(item.id, item.kind, JSON.stringify(item), item.createdAt).run();
        return item;
      };
      const mergeAttempt = async input => {
        const attemptId = safeText(input.id || input.attemptId, 180) || uuid();
        const previous = await get('attempts', attemptId) || {};
        const cardId = safeText(input.cardId || previous.cardId || input.id, 160) || 'unknown';
        const createdAt = safeText(input.createdAt || previous.createdAt, 80) || (Number(input.at) > 0 ? new Date(Number(input.at)).toISOString() : stamp());
        const item = { ...previous, ...input, id: attemptId, cardId, createdAt };
        await db.prepare('INSERT INTO attempts (id,card_id,body,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET card_id=excluded.card_id,body=excluded.body,created_at=excluded.created_at')
          .bind(item.id, item.cardId, JSON.stringify(item), item.createdAt).run();
        return item;
      };

      if (path === '/api/snapshot' && method === 'GET') {
        return reply(200, { tasks: await list('tasks'), cards: await list('cards'), attempts: await list('attempts'), activity: await list('activity') });
      }

      if (path === '/api/tasks' && method === 'GET') return reply(200, await list('tasks'));
      if (path === '/api/tasks' && method === 'POST') {
        const input = await readJson(request);
        const title = safeText(input.title, 160);
        if (!title) throw new HttpError(400, 'Task title is required');
        return reply(201, await upsert('tasks', { done: false, area: 'Personal', minutes: 0, note: '', ...input, title, id: safeText(input.id, 160) || uuid() }));
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

      if (path === '/api/attempts' && method === 'POST') return reply(201, await mergeAttempt(await readJson(request)));

      if (path === '/api/activity' && method === 'POST') {
        const input = await readJson(request);
        const item = { ...input, id: safeText(input.id, 180) || uuid(), kind: safeText(input.kind || input.type, 100) || 'activity', createdAt: safeText(input.createdAt, 80) || (Number(input.at) > 0 ? new Date(Number(input.at)).toISOString() : stamp()) };
        await db.prepare('INSERT INTO activity (id,kind,body,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,body=excluded.body,created_at=excluded.created_at')
          .bind(item.id, item.kind, JSON.stringify(item), item.createdAt).run();
        return reply(201, item);
      }

      if (path === '/api/review-sentence' && method === 'POST') {
        const input = await readJson(request);
        const result = await openAIReview(env, input);
        if (result.attemptId) {
          await mergeAttempt({
            id: result.attemptId,
            cardId: result.cardId,
            title: safeText(input.title, 220), topic: safeText(input.topic, 120), prompt: safeText(input.prompt, 1000), question: safeText(input.question, 1000),
            sentence: safeText(input.sentence, 2400), selected: Number.isInteger(input.selected) ? input.selected : null, correct: Number.isInteger(input.correct) ? input.correct : null,
            learningMethod: safeText(input.method, 60), contentDepth: safeText(input.contentDepth, 60), reviewRequestId: result.requestId,
            semanticReview: result.review, semanticReviewedAt: result.reviewedAt, semanticModel: result.model, at: Number(input.at) || Date.now(),
          });
        }
        return reply(200, result);
      }

      if (path === '/api/whatsapp-message' && method === 'POST') {
        const input = await readJson(request);
        const id = safeText(input.id, 160) || `wa-${uuid()}`;
        const message = safeText(input.message, 2400);
        if (!message) throw new HttpError(400, 'WhatsApp message is required');

        const analysis = await openAIWhatsApp(env, input);
        const createdAt = Number(input.at) > 0 ? new Date(Number(input.at)).toISOString() : stamp();
        await savePrivateActivity({
          id,
          kind: 'whatsapp_message_private',
          createdAt,
          source: 'whatsapp-notification',
          chat: safeText(input.chat, 180),
          sender: safeText(input.sender, 180),
          message,
          analysis,
        });

        let task = null;
        if (analysis.actionable === true && Number(analysis.confidence) >= 80 && analysis.actionType !== 'none' && safeText(analysis.taskTitle, 160)) {
          const taskId = `wa-task-${id}`.slice(0, 160);
          const due = safeText(analysis.dueText, 120);
          const noteParts = [safeText(analysis.taskNote, 700)];
          if (due) noteParts.push(`Timing: ${due}`);
          task = await upsert('tasks', {
            id: taskId,
            title: safeText(analysis.taskTitle, 160),
            area: 'Personal',
            minutes: analysis.actionType === 'reply' ? 5 : 10,
            note: noteParts.filter(Boolean).join(' · '),
            done: false,
            source: 'whatsapp-ai',
            sourceKey: id,
            urgency: safeText(analysis.urgency, 20),
            createdAt,
          });
        }
        return reply(200, { ok: true, id, analysis, taskCreated: Boolean(task), task });
      }

      if (path === '/v1/snapshot' && method === 'GET') {
        const tasks = await list('tasks');
        return reply(200, { open: tasks.filter(t => !t.done), completed: tasks.filter(t => t.done), cards: await list('cards'), attempts: await list('attempts') });
      }

      return reply(404, { error: 'Not found' });
    } catch (error) {
      return reply(Number(error?.status) || 400, { error: safeText(error?.message || 'HOME Sync error', 500) });
    }
  },
};
