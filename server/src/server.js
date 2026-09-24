import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createStore } from './store.js';

const tools = [
  { name: 'home_snapshot', description: 'Read HOME tasks, learning cards, quiz attempts and topic mastery.', inputSchema: { type: 'object', properties: {} } },
  { name: 'home_add_task', description: 'Add one task to the Android HOME app.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, area: { type: 'string' }, details: { type: 'object' } }, required: ['title'] } },
  { name: 'home_complete_task', description: 'Mark a task done or reopen it.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, done: { type: 'boolean' } }, required: ['id', 'done'] } },
  { name: 'home_add_card', description: 'Create an original learning card with an A–D quiz.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, topic: { type: 'string' }, lead: { type: 'string' }, sections: { type: 'array' }, takeaway: { type: 'string' }, q: { type: 'string' }, options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 }, correct: { type: 'integer' }, prompt: { type: 'string' }, rubric: { type: 'string' }, img: { type: 'string' } }, required: ['title', 'topic', 'options', 'correct', 'prompt'] } },
  { name: 'home_assess_quiz', description: 'Assess an unanswered written quiz using its rubric; 0–60 points and specific feedback.', inputSchema: { type: 'object', properties: { attemptId: { type: 'string' }, writtenScore: { type: 'integer', minimum: 0, maximum: 60 }, feedback: { type: 'string' } }, required: ['attemptId', 'writtenScore', 'feedback'] } },
];

function safeEqual(a, b) {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createApp({ token, filename = './home.sqlite' }) {
  if (!token || token.length < 32) throw new Error('HOME_TOKEN must contain at least 32 characters');
  const store = createStore(filename);
  const json = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
  async function read(req) {
    let data = '';
    for await (const chunk of req) { data += chunk; if (data.length > 100_000) throw new Error('Request too large'); }
    return data ? JSON.parse(data) : {};
  }
  const snapshot = () => ({ open: store.list('tasks').filter(t => !t.done), completed: store.list('tasks').filter(t => t.done), cards: store.list('cards').filter(c => c.active), attempts: store.list('attempts'), profile: store.profile() });
  function invoke(name, args) {
    if (name === 'home_snapshot') return snapshot();
    if (name === 'home_add_task') return store.addTask(args);
    if (name === 'home_complete_task') return store.completeTask(args.id, args.done);
    if (name === 'home_add_card') return store.addCard(args);
    if (name === 'home_assess_quiz') return store.assessAttempt(args.attemptId, args.writtenScore, args.feedback);
    throw new Error('Unknown tool');
  }
  const server = http.createServer(async (req, res) => {
    try {
      if (!safeEqual(req.headers.authorization, `Bearer ${token}`)) return json(res, 401, { error: 'Unauthorized' });
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/v1/snapshot' && req.method === 'GET') return json(res, 200, snapshot());
      if (path === '/v1/tasks' && req.method === 'POST') return json(res, 201, store.addTask(await read(req)));
      const task = path.match(/^\/v1\/tasks\/([a-zA-Z0-9:_-]+)\/done$/);
      if (task && req.method === 'POST') return json(res, 200, store.completeTask(task[1], (await read(req)).done));
      if (path === '/v1/cards' && req.method === 'POST') return json(res, 201, store.addCard(await read(req)));
      if (path === '/v1/import' && req.method === 'POST') {
        const input = await read(req);
        if (!Array.isArray(input.tasks) || !Array.isArray(input.cards) || input.tasks.length > 500 || input.cards.length > 100) throw new Error('Import requires bounded tasks and cards');
        let imported = 0;
        for (const task of input.tasks) if (task.id && !store.get('tasks', task.id)) { store.addTask({ ...task, done: Boolean(task.completedAt), completedAt: task.completedAt || null }); imported++; }
        for (const card of input.cards) if (card.id && !store.get('cards', card.id)) { store.addCard(card); imported++; }
        return json(res, 200, { imported });
      }
      if (path === '/v1/attempts' && req.method === 'POST') return json(res, 201, store.submitAttempt(await read(req)));
      if (path === '/v1/activity' && req.method === 'POST') {
        const input = await read(req);
        if (!['calendar_summary', 'mail_candidate', 'habit_observation'].includes(input.kind)) throw new Error('Unsupported activity');
        return json(res, 201, store.recordActivity(input.kind, input.body));
      }
      if (path === '/mcp' && req.method === 'POST') {
        const rpc = await read(req);
        if (rpc.method === 'notifications/initialized') { res.writeHead(202); return res.end(); }
        let result;
        if (rpc.method === 'initialize') result = { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'home-personal', version: '0.1.0' } };
        else if (rpc.method === 'tools/list') result = { tools };
        else if (rpc.method === 'tools/call') { const value = invoke(rpc.params?.name, rpc.params?.arguments || {}); result = { content: [{ type: 'text', text: JSON.stringify(value) }] }; }
        else return json(res, 400, { jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'Method not found' } });
        return json(res, 200, { jsonrpc: '2.0', id: rpc.id, result });
      }
      json(res, 404, { error: 'Not found' });
    } catch (error) { json(res, 400, { error: error.message }); }
  });
  return { server, store };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { server } = createApp({ token: process.env.HOME_TOKEN, filename: process.env.HOME_DB || './home.sqlite' });
  server.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1', () => console.log('HOME backend listening'));
}
