// Cloudflare Workers + D1 adapter for the HOME API. Never expose HOME_TOKEN as a plain variable.
const CORS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const response = (code, value) => new Response(JSON.stringify(value), { status: code, headers: CORS });
const stamp = () => new Date().toISOString();
const decode = row => row && JSON.parse(row.body);
const auth = (request, token) => {
  const raw = request.headers.get('authorization') || '';
  // Fixed length check plus constant-time byte comparison avoids an early-match leak.
  const a = new TextEncoder().encode(raw), b = new TextEncoder().encode(`Bearer ${token}`);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
};
const id = () => crypto.randomUUID();

export default {
  async fetch(request, env) {
    try {
      if (!env.DB || !env.HOME_TOKEN || env.HOME_TOKEN.length < 32) return response(503, { error: 'HOME service not configured' });
      if (!auth(request, env.HOME_TOKEN)) return response(401, { error: 'Unauthorized' });
      const path = new URL(request.url).pathname, method = request.method;
      const db = env.DB;
      const get = async (table, key) => decode(await db.prepare(`SELECT body FROM ${table} WHERE id=?`).bind(key).first());
      const list = async table => (await db.prepare(`SELECT body FROM ${table} ORDER BY ${table === 'attempts' ? 'created_at' : 'updated_at'} DESC LIMIT 1000`).all()).results.map(decode);
      const put = async (table, body) => {
        const record = { ...body, id: body.id || id(), updatedAt: stamp() };
        await db.prepare(`INSERT INTO ${table} (id,body,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`).bind(record.id, JSON.stringify(record), record.updatedAt).run();
        return record;
      };
      const addTask = async input => {
        const title = String(input.title || '').trim();
        if (!title || title.length > 120) throw Error('Task title must contain 1–120 characters');
        return put('tasks', { id: id(), title, done: false, area: 'Personal', details: { outcome: '', info: [], tips: [], links: [] }, ...input, title });
      };
      const addCard = async input => {
        if (!input.title || !input.topic || !Array.isArray(input.options) || input.options.length !== 4 || !Number.isInteger(input.correct) || input.correct < 0 || input.correct > 3 || !input.prompt) throw Error('Card needs title, topic, four options, correct index and prompt');
        return put('cards', { ...input, active: input.active !== false });
      };
      const completeTask = async (key, done) => {
        const task = await get('tasks', key); if (!task) throw Error('Task not found');
        return put('tasks', { ...task, done: Boolean(done), completedAt: done ? stamp() : null });
      };
      const submitAttempt = async input => {
        const card = await get('cards', String(input.cardId)); if (!card) throw Error('Unknown card');
        if (!Number.isInteger(input.selected) || input.selected < 0 || input.selected > 3) throw Error('Select one answer A–D');
        const sentence = String(input.sentence || '').trim(); if (sentence.length < 10 || sentence.length > 1200) throw Error('Write a one-sentence answer');
        const key = String(input.id || id()), previous = await get('attempts', key);
        if (previous) return previous;
        const item = { id: key, cardId: card.id, topic: card.topic, selected: input.selected, sentence, mcScore: input.selected === card.correct ? 40 : 0, writtenScore: null, score: null, feedback: '', createdAt: stamp() };
        await db.prepare('INSERT INTO attempts (id,card_id,body,created_at) VALUES (?,?,?,?)').bind(item.id, item.cardId, JSON.stringify(item), item.createdAt).run();
        return item;
      };
      const assess = async (key, writtenScore, feedback) => {
        const old = await get('attempts', key); if (!old) throw Error('Attempt not found');
        if (old.writtenScore !== null) throw Error('Attempt already assessed');
        if (!Number.isInteger(writtenScore) || writtenScore < 0 || writtenScore > 60 || !String(feedback).trim()) throw Error('Score must be 0–60 with feedback');
        const item = { ...old, writtenScore, score: old.mcScore + writtenScore, feedback: String(feedback).trim(), assessedAt: stamp() };
        await db.prepare('UPDATE attempts SET body=? WHERE id=?').bind(JSON.stringify(item), key).run();
        return item;
      };
      const profile = async () => {
        const grouped = {};
        for (const a of (await list('attempts')).reverse()) {
          const p = grouped[a.topic] ||= { topic: a.topic, attempts: 0, assessed: 0, average: null, writtenAverage: null, gaps: [], strengths: [], lastAnswered: null };
          p.attempts++; p.lastAnswered = a.createdAt;
          if (a.score !== null) { p.assessed++; p.average = Math.round(((p.average || 0) * (p.assessed - 1) + a.score) / p.assessed); p.writtenAverage = Math.round(((p.writtenAverage || 0) * (p.assessed - 1) + a.writtenScore) / p.assessed); (a.score < 75 ? p.gaps : p.strengths).push(a.feedback); }
        }
        for (const p of Object.values(grouped)) { p.mastery = p.assessed === 0 || p.average < 50 ? 'New' : p.average < 75 ? 'Developing' : p.average < 90 || p.assessed < 3 ? 'Solid' : 'Advanced'; p.gaps = p.gaps.slice(-3); p.strengths = p.strengths.slice(-3); if (p.assessed) p.nextReview = new Date(Date.parse(p.lastAnswered) + (p.mastery === 'New' ? 1 : p.mastery === 'Developing' ? 3 : p.mastery === 'Solid' ? 7 : 14) * 86400000).toISOString(); }
        return Object.values(grouped);
      };
      const snapshot = async () => {
        const tasks = await list('tasks');
        return { open: tasks.filter(t => !t.done), completed: tasks.filter(t => t.done), cards: (await list('cards')).filter(c => c.active), attempts: await list('attempts'), profile: await profile() };
      };
      const json = async () => {
        if (Number(request.headers.get('content-length') || 0) > 100000) throw Error('Request too large');
        const raw = await request.text(); if (raw.length > 100000) throw Error('Request too large');
        return raw ? JSON.parse(raw) : {};
      };
      if (path === '/v1/snapshot' && method === 'GET') return response(200, await snapshot());
      if (path === '/v1/tasks' && method === 'POST') return response(201, await addTask(await json()));
      const task = path.match(/^\/v1\/tasks\/([a-zA-Z0-9:_-]+)\/done$/);
      if (task && method === 'POST') return response(200, await completeTask(task[1], (await json()).done));
      if (path === '/v1/cards' && method === 'POST') return response(201, await addCard(await json()));
      if (path === '/v1/attempts' && method === 'POST') return response(201, await submitAttempt(await json()));
      if (path === '/v1/import' && method === 'POST') {
        const input = await json(); if (!Array.isArray(input.tasks) || !Array.isArray(input.cards) || input.tasks.length > 500 || input.cards.length > 100) throw Error('Import requires bounded tasks and cards');
        let imported = 0;
        for (const t of input.tasks) if (t.id && !await get('tasks', t.id)) { await addTask({ ...t, done: Boolean(t.completedAt), completedAt: t.completedAt || null }); imported++; }
        for (const c of input.cards) if (c.id && !await get('cards', c.id)) { await addCard(c); imported++; }
        return response(200, { imported });
      }
      if (path === '/v1/activity' && method === 'POST') {
        const input = await json(); if (!['calendar_summary', 'mail_candidate', 'habit_observation'].includes(input.kind)) throw Error('Unsupported activity');
        const item = { id: id(), kind: input.kind, body: input.body, createdAt: stamp() };
        await db.prepare('INSERT INTO activity (id,kind,body,created_at) VALUES (?,?,?,?)').bind(item.id, item.kind, JSON.stringify(item), item.createdAt).run();
        return response(201, item);
      }
      if (path === '/mcp' && method === 'POST') {
        const rpc = await json(), args = rpc.params?.arguments || {};
        if (rpc.method === 'notifications/initialized') return new Response(null, { status: 202 });
        let result;
        if (rpc.method === 'initialize') result = { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'home-personal', version: '0.1.0' } };
        else if (rpc.method === 'tools/list') result = { tools: [
          { name: 'home_snapshot', description: 'Read HOME tasks, cards, quiz attempts and mastery.', inputSchema: { type: 'object', properties: {} } },
          { name: 'home_add_task', description: 'Create a HOME task.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, area: { type: 'string' }, details: { type: 'object' } }, required: ['title'] } },
          { name: 'home_complete_task', description: 'Complete or reopen a task.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, done: { type: 'boolean' } }, required: ['id', 'done'] } },
          { name: 'home_add_card', description: 'Create a learning card.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, topic: { type: 'string' }, options: { type: 'array' }, correct: { type: 'integer' }, prompt: { type: 'string' } }, required: ['title', 'topic', 'options', 'correct', 'prompt'] } },
          { name: 'home_assess_quiz', description: 'Grade a sentence against the card rubric.', inputSchema: { type: 'object', properties: { attemptId: { type: 'string' }, writtenScore: { type: 'integer' }, feedback: { type: 'string' } }, required: ['attemptId', 'writtenScore', 'feedback'] } }
        ] };
        else if (rpc.method === 'tools/call') {
          const name = rpc.params?.name;
          const value = name === 'home_snapshot' ? await snapshot() : name === 'home_add_task' ? await addTask(args) : name === 'home_complete_task' ? await completeTask(args.id, args.done) : name === 'home_add_card' ? await addCard(args) : name === 'home_assess_quiz' ? await assess(args.attemptId, args.writtenScore, args.feedback) : null;
          if (value === null) throw Error('Unknown tool');
          result = { content: [{ type: 'text', text: JSON.stringify(value) }] };
        } else return response(400, { jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'Method not found' } });
        return response(200, { jsonrpc: '2.0', id: rpc.id, result });
      }
      return response(404, { error: 'Not found' });
    } catch (error) { return response(400, { error: error.message }); }
  }
};
