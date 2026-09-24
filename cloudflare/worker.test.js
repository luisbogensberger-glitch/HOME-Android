import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

function fakeD1() {
  const tables = Object.fromEntries(['tasks', 'cards', 'attempts', 'activity'].map(t => [t, new Map()]));
  return { prepare(sql) {
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async first() { const table = sql.match(/FROM (\w+)/)[1]; return tables[table].get(args[0]) || null; },
      async all() { const table = sql.match(/FROM (\w+)/)[1]; return { results: [...tables[table].values()] }; },
      async run() {
        const table = sql.match(/INTO (\w+)/)?.[1] || 'attempts';
        if (sql.startsWith('UPDATE')) { const row = tables.attempts.get(args[1]); tables.attempts.set(args[1], { ...row, body: args[0] }); }
        else tables[table].set(args[0], { id: args[0], body: table === 'attempts' || table === 'activity' ? args[2] : args[1], updated_at: args[3] || args[2] });
        return { success: true };
      }
    };
  } };
}

test('Worker keeps tasks, imports cards and saves evidence for review', async () => {
  const env = { HOME_TOKEN: 'abcdefghijklmnopqrstuvwxyz0123456789', DB: fakeD1() };
  const call = async (path, method = 'GET', body, token = env.HOME_TOKEN) => worker.fetch(new Request(`https://home.example${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }), env);
  assert.equal((await call('/v1/snapshot', 'GET', null, 'wrong')).status, 401);
  const imported = await (await call('/v1/import', 'POST', { tasks: [{ id: 'local-1', title: 'Buy a cardholder' }], cards: [{ id: 'card-1', title: 'History', topic: 'History', options: ['A', 'B', 'C', 'D'], correct: 2, prompt: 'Why did it matter?' }] })).json();
  assert.equal(imported.imported, 2);
  assert.equal((await (await call('/v1/snapshot')).json()).open.length, 1);
  const quiz = await (await call('/v1/attempts', 'POST', { id: 'attempt-1', cardId: 'card-1', selected: 2, sentence: 'Standardisation reduced repeated handling at ports.' })).json();
  assert.equal(quiz.mcScore, 40);
  assert.equal(quiz.writtenScore, null);
  const result = await (await call('/mcp', 'POST', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'home_assess_quiz', arguments: { attemptId: 'attempt-1', writtenScore: 54, feedback: 'Clear mechanism, useful detail.' } } })).json();
  assert.match(result.result.content[0].text, /"score":94/);
});
