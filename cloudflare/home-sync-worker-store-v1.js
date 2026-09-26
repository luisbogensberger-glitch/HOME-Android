// HOME Store Worker v1
// Multi-user, privacy-minimised backend for Play Store / App Store builds.
//
// Required bindings/secrets:
//   DB                         Cloudflare D1 binding
//   OPENAI_API_KEY             server-side only
//   SUPABASE_URL               e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  server-side only; required for complete account deletion
// Optional vars:
//   OPENAI_MODEL               defaults to gpt-5.6-terra
//   LEGAL_CONTACT_EMAIL        displayed on privacy/deletion pages
//
// Client-side Supabase auth uses the public anon key. This worker validates access JWTs
// with Supabase JWKS and never accepts a shared HOME_TOKEN.

const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

const json = (status, value, extra = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { ...BASE_HEADERS, ...extra },
});
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const safeText = (v, max = 1000) => String(v ?? '').trim().slice(0, max);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function readJson(request, max = 120000) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > max) throw new HttpError(413, 'Request too large');
  const raw = await request.text();
  if (raw.length > max) throw new HttpError(413, 'Request too large');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { throw new HttpError(400, 'Invalid JSON'); }
}

function base64UrlBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function base64UrlJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));
}

const jwksCache = new Map();
async function supabaseJwk(env, kid) {
  const base = safeText(env.SUPABASE_URL, 500).replace(/\/$/, '');
  if (!base) throw new HttpError(503, 'Authentication is not configured');
  const cached = jwksCache.get(kid);
  if (cached && cached.expires > Date.now()) return cached.jwk;
  const r = await fetch(`${base}/auth/v1/.well-known/jwks.json`, {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!r.ok) throw new HttpError(503, 'Authentication keys unavailable');
  const body = await r.json();
  for (const jwk of body?.keys || []) {
    if (jwk?.kid) jwksCache.set(jwk.kid, { jwk, expires: Date.now() + 5 * 60 * 1000 });
  }
  const found = jwksCache.get(kid)?.jwk;
  if (!found) throw new HttpError(401, 'Unknown authentication key');
  return found;
}

async function verifySupabaseJwt(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'Sign in required');
  const token = auth.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Invalid session');
  let header, payload;
  try { header = base64UrlJson(parts[0]); payload = base64UrlJson(parts[1]); }
  catch (_) { throw new HttpError(401, 'Invalid session'); }

  if (!header.kid || !['RS256', 'ES256'].includes(header.alg)) throw new HttpError(401, 'Unsupported session signature');
  const jwk = await supabaseJwk(env, header.kid);
  const algorithm = header.alg === 'RS256'
    ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
    : { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };
  let key;
  try {
    key = await crypto.subtle.importKey('jwk', jwk,
      header.alg === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } : { name: 'ECDSA', namedCurve: 'P-256' },
      false, ['verify']);
  } catch (_) { throw new HttpError(401, 'Invalid session key'); }
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlBytes(parts[2]);
  const ok = await crypto.subtle.verify(algorithm, key, signature, signed);
  if (!ok) throw new HttpError(401, 'Invalid session signature');

  const clock = Math.floor(Date.now() / 1000);
  if (!payload.sub || !payload.exp || payload.exp <= clock - 30) throw new HttpError(401, 'Session expired');
  if (payload.nbf && payload.nbf > clock + 30) throw new HttpError(401, 'Session not active');
  const expectedIssuer = `${safeText(env.SUPABASE_URL, 500).replace(/\/$/, '')}/auth/v1`;
  if (payload.iss !== expectedIssuer) throw new HttpError(401, 'Invalid session issuer');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes('authenticated')) throw new HttpError(401, 'Invalid session audience');
  return { id: safeText(payload.sub, 160), email: safeText(payload.email, 320) };
}

function outputText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  let result = '';
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') result += part.text;
    }
  }
  return result;
}

async function checkDailyLimit(db, userId, max = 100) {
  const day = new Date().toISOString().slice(0, 10);
  const row = await db.prepare('SELECT requests FROM store_usage WHERE user_id=? AND day=?').bind(userId, day).first();
  const count = Number(row?.requests || 0);
  if (count >= max) throw new HttpError(429, 'Daily AI limit reached');
  await db.prepare(`INSERT INTO store_usage (user_id,day,requests,updated_at) VALUES (?,?,1,?)
    ON CONFLICT(user_id,day) DO UPDATE SET requests=requests+1, updated_at=excluded.updated_at`)
    .bind(userId, day, now()).run();
}

async function callOpenAI(env, db, userId, name, instructions, context, schema, maxOutputTokens = 500) {
  if (!env.OPENAI_API_KEY) throw new HttpError(503, 'AI is not configured');
  await checkDailyLimit(db, userId);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: safeText(env.OPENAI_MODEL, 100) || 'gpt-5.6-terra',
      store: false,
      reasoning: { effort: 'low' },
      instructions,
      input: JSON.stringify(context),
      text: { verbosity: 'low', format: { type: 'json_schema', name, strict: true, schema } },
      max_output_tokens: maxOutputTokens,
    }),
  });
  const raw = await response.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch (_) {}
  if (!response.ok) throw new HttpError(502, safeText(body?.error?.message || 'AI request failed', 300));
  const text = outputText(body);
  if (!text) throw new HttpError(502, 'AI returned no text');
  try { return JSON.parse(text); } catch (_) { throw new HttpError(502, 'AI returned invalid JSON'); }
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    understanding: { type: 'integer', minimum: 0, maximum: 100 },
    application: { type: 'integer', minimum: 0, maximum: 100 },
    applicationObserved: { type: 'boolean' },
    precision: { type: 'integer', minimum: 0, maximum: 100 },
    depth: { type: 'integer', minimum: 0, maximum: 100 },
    taskFulfillment: { type: 'integer', minimum: 0, maximum: 100 },
    overall: { type: 'integer', minimum: 0, maximum: 100 },
    verdict: { type: 'string', enum: ['weak','developing','solid','strong'] },
    nextFocus: { type: 'string', enum: ['understanding','application','precision','depth','advance'] },
    feedback: { type: 'string' },
    misconception: { type: 'string' },
  },
  required: ['understanding','application','applicationObserved','precision','depth','taskFulfillment','overall','verdict','nextFocus','feedback','misconception'],
  additionalProperties: false,
};

async function reviewSentence(env, db, user, input) {
  const sentence = safeText(input.sentence, 2400);
  if (sentence.length < 3) throw new HttpError(400, 'Sentence is required');
  // Data minimisation: send only the learning material needed to evaluate this attempt.
  const context = {
    title: safeText(input.title, 220),
    topic: safeText(input.topic, 120),
    question: safeText(input.question, 1000),
    prompt: safeText(input.prompt, 1000),
    takeaway: safeText(input.takeaway, 1200),
    sections: Array.isArray(input.sections) ? input.sections.slice(0, 5) : [],
    selected: Number.isInteger(input.selected) ? input.selected : null,
    correct: Number.isInteger(input.correct) ? input.correct : null,
    sentence,
  };
  const instructions = 'You are HOME Sentence Reviewer. Judge conceptual correctness, precision and useful transfer. Be concise. Never infer sensitive personal attributes. Do not reward verbosity by itself.';
  const review = await callOpenAI(env, db, user.id, 'home_sentence_review', instructions, context, REVIEW_SCHEMA, 500);
  return {
    requestId: safeText(input.requestId, 120),
    attemptId: safeText(input.attemptId, 180),
    cardId: safeText(input.cardId, 160),
    reviewedAt: now(),
    model: safeText(env.OPENAI_MODEL, 100) || 'gpt-5.6-terra',
    review,
  };
}

const tableSpec = {
  tasks: { table: 'store_tasks', order: 'updated_at' },
  cards: { table: 'store_cards', order: 'updated_at' },
  attempts: { table: 'store_attempts', order: 'created_at' },
  activity: { table: 'store_activity', order: 'created_at' },
};

async function listRows(db, userId, kind) {
  const spec = tableSpec[kind];
  const rows = await db.prepare(`SELECT body FROM ${spec.table} WHERE user_id=? ORDER BY ${spec.order} DESC LIMIT 1000`).bind(userId).all();
  return (rows.results || []).map(r => { try { return JSON.parse(r.body); } catch (_) { return null; } }).filter(Boolean);
}
async function getRow(db, userId, kind, id) {
  const spec = tableSpec[kind];
  const row = await db.prepare(`SELECT body FROM ${spec.table} WHERE user_id=? AND id=?`).bind(userId, id).first();
  if (!row?.body) return null;
  try { return JSON.parse(row.body); } catch (_) { return null; }
}
async function upsertRow(db, userId, kind, body) {
  const spec = tableSpec[kind];
  const id = safeText(body?.id, 180) || uuid();
  if (kind === 'attempts') {
    const createdAt = safeText(body?.createdAt, 80) || now();
    const item = { ...body, id, cardId: safeText(body?.cardId, 160) || 'unknown', createdAt };
    await db.prepare(`INSERT INTO store_attempts (user_id,id,card_id,body,created_at) VALUES (?,?,?,?,?)
      ON CONFLICT(user_id,id) DO UPDATE SET card_id=excluded.card_id,body=excluded.body,created_at=excluded.created_at`)
      .bind(userId, id, item.cardId, JSON.stringify(item), createdAt).run();
    return item;
  }
  if (kind === 'activity') {
    const createdAt = safeText(body?.createdAt, 80) || now();
    const item = { ...body, id, kind: safeText(body?.kind || body?.type, 100) || 'activity', createdAt };
    await db.prepare(`INSERT INTO store_activity (user_id,id,kind,body,created_at) VALUES (?,?,?,?,?)
      ON CONFLICT(user_id,id) DO UPDATE SET kind=excluded.kind,body=excluded.body,created_at=excluded.created_at`)
      .bind(userId, id, item.kind, JSON.stringify(item), createdAt).run();
    return item;
  }
  const updatedAt = now();
  const item = { ...body, id, updatedAt };
  await db.prepare(`INSERT INTO ${spec.table} (user_id,id,body,updated_at) VALUES (?,?,?,?)
    ON CONFLICT(user_id,id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`)
    .bind(userId, id, JSON.stringify(item), updatedAt).run();
  return item;
}

async function deleteEverything(db, userId) {
  for (const table of ['store_tasks','store_cards','store_attempts','store_activity','store_usage']) {
    await db.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(userId).run();
  }
}

async function deleteSupabaseUser(env, userId) {
  const base = safeText(env.SUPABASE_URL, 500).replace(/\/$/, '');
  const key = safeText(env.SUPABASE_SERVICE_ROLE_KEY, 2000);
  if (!base || !key) throw new HttpError(503, 'Account deletion is not fully configured');
  const r = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${key}`, apikey: key },
  });
  if (!r.ok && r.status !== 404) throw new HttpError(502, 'Could not delete authentication account');
}

function htmlPage(title, body) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px/1.55 system-ui;max-width:760px;margin:48px auto;padding:0 20px;color:#171717}h1{font-size:32px}input,button{font:inherit;padding:12px;margin:6px 0;width:100%;box-sizing:border-box}button{cursor:pointer}small{color:#666}</style></head><body>${body}</body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' },
  });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();
      if (!env.DB) throw new HttpError(503, 'Database is not configured');

      if (path === '/' && method === 'GET') return json(200, { service: 'HOME Store Sync', ok: true });
      if (path === '/health' && method === 'GET') return json(200, { ok: true, auth: Boolean(env.SUPABASE_URL), ai: Boolean(env.OPENAI_API_KEY), sharedToken: false });

      if (path === '/privacy' && method === 'GET') {
        const contact = safeText(env.LEGAL_CONTACT_EMAIL, 320) || 'the support address shown in the HOME app';
        return htmlPage('HOME Privacy Policy', `<h1>HOME Privacy Policy</h1><p><strong>Last updated: 25 September 2026.</strong></p><p>HOME stores account data, tasks, learning progress and settings needed to provide the service. AI evaluation sends only the content needed for the requested feature to OpenAI. HOME requests OpenAI API processing with storage disabled where supported. Authentication is provided by Supabase and backend hosting/database services are provided by Cloudflare.</p><p>HOME does not sell personal data. Sensitive device permissions are optional and feature-specific. The Store build does not use Android Accessibility Service to read other apps.</p><p>You can delete your HOME account and associated HOME data from Account settings. Google Play users can also request deletion at <a href="/delete-account">this deletion page</a>.</p><p>For privacy requests contact ${contact}. Applicable statutory rights, including access, correction, erasure, restriction and objection, remain unaffected.</p><p><small>This page is the technical baseline. Before publication, the developer must add the legal controller identity/address, exact retention periods, lawful bases and any jurisdiction-specific transfer information.</small></p>`);
      }

      if (path === '/delete-account' && method === 'GET') {
        return htmlPage('Delete HOME account', `<h1>Delete your HOME account</h1><p>You can delete your account directly inside HOME under Account → Delete account. If you no longer have the app, submit a deletion request here.</p><form method="post" action="/api/deletion-request"><label>Email used for HOME</label><input name="email" type="email" required autocomplete="email"><button type="submit">Request account deletion</button></form><p><small>We may need to verify ownership before completing an external request.</small></p>`);
      }
      if (path === '/api/deletion-request' && method === 'POST') {
        const type = request.headers.get('content-type') || '';
        let email = '';
        if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
          const form = await request.formData(); email = safeText(form.get('email'), 320).toLowerCase();
        } else { email = safeText((await readJson(request, 5000)).email, 320).toLowerCase(); }
        if (!email || !email.includes('@')) throw new HttpError(400, 'Valid email required');
        await env.DB.prepare('INSERT INTO deletion_requests (id,email,requested_at,status) VALUES (?,?,?,?)')
          .bind(uuid(), email, now(), 'requested').run();
        if (type.includes('form')) return htmlPage('Deletion requested', '<h1>Request received</h1><p>Your HOME account deletion request was recorded. Ownership may need to be verified before deletion.</p>');
        return json(202, { ok: true });
      }

      const user = await verifySupabaseJwt(request, env);
      const db = env.DB;

      if (path === '/api/account' && method === 'GET') return json(200, { id: user.id, email: user.email });
      if (path === '/api/account' && method === 'DELETE') {
        // Require auth-provider deletion capability before mutating data, avoiding half-deleted accounts.
        await deleteSupabaseUser(env, user.id);
        await deleteEverything(db, user.id);
        return json(200, { ok: true, deleted: true });
      }

      if (path === '/api/snapshot' && method === 'GET') return json(200, {
        tasks: await listRows(db, user.id, 'tasks'),
        cards: await listRows(db, user.id, 'cards'),
        attempts: await listRows(db, user.id, 'attempts'),
        activity: await listRows(db, user.id, 'activity'),
      });
      if (path === '/v1/snapshot' && method === 'GET') {
        const tasks = await listRows(db, user.id, 'tasks');
        return json(200, { open: tasks.filter(t => !t.done), completed: tasks.filter(t => t.done), cards: await listRows(db, user.id, 'cards'), attempts: await listRows(db, user.id, 'attempts') });
      }

      if (path === '/api/tasks' && method === 'GET') return json(200, await listRows(db, user.id, 'tasks'));
      if (path === '/api/tasks' && method === 'POST') {
        const input = await readJson(request);
        const title = safeText(input.title, 160);
        if (!title) throw new HttpError(400, 'Task title is required');
        return json(201, await upsertRow(db, user.id, 'tasks', { done: false, area: 'Personal', minutes: 0, note: '', ...input, title }));
      }
      const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
      if (taskMatch && ['PATCH','PUT'].includes(method)) {
        const id = decodeURIComponent(taskMatch[1]);
        const old = await getRow(db, user.id, 'tasks', id);
        if (!old) throw new HttpError(404, 'Task not found');
        const input = await readJson(request);
        const merged = { ...old, ...input, id };
        if (!safeText(merged.title, 160)) throw new HttpError(400, 'Task title is required');
        return json(200, await upsertRow(db, user.id, 'tasks', merged));
      }
      if (taskMatch && method === 'DELETE') {
        const id = decodeURIComponent(taskMatch[1]);
        await db.prepare('DELETE FROM store_tasks WHERE user_id=? AND id=?').bind(user.id, id).run();
        return json(200, { ok: true, id });
      }

      if (path === '/api/cards' && method === 'GET') return json(200, await listRows(db, user.id, 'cards'));
      if (path === '/api/cards' && method === 'POST') {
        const input = await readJson(request);
        const title = safeText(input.title, 220);
        if (!title) throw new HttpError(400, 'Card title is required');
        return json(201, await upsertRow(db, user.id, 'cards', { ...input, title }));
      }
      if (path === '/api/attempts' && method === 'POST') return json(201, await upsertRow(db, user.id, 'attempts', await readJson(request)));
      if (path === '/api/activity' && method === 'POST') return json(201, await upsertRow(db, user.id, 'activity', await readJson(request)));

      if (path === '/api/review-sentence' && method === 'POST') {
        const input = await readJson(request);
        const result = await reviewSentence(env, db, user, input);
        if (result.attemptId) {
          await upsertRow(db, user.id, 'attempts', {
            id: result.attemptId,
            cardId: result.cardId,
            title: safeText(input.title, 220),
            topic: safeText(input.topic, 120),
            sentence: safeText(input.sentence, 2400),
            semanticReview: result.review,
            semanticReviewedAt: result.reviewedAt,
            semanticModel: result.model,
            createdAt: now(),
          });
        }
        return json(200, result);
      }

      // Intentionally absent in Store v1: notification/accessibility scraping of Gmail/WhatsApp.
      // These private-build endpoints remain in the personal worker only.
      if (path === '/api/whatsapp-message' || path === '/api/gmail-notification') {
        throw new HttpError(403, 'This private-device integration is not enabled in the Store build');
      }

      return json(404, { error: 'Not found' });
    } catch (error) {
      return json(Number(error?.status) || 400, { error: safeText(error?.message || 'HOME Store Sync error', 500) });
    }
  },
};
