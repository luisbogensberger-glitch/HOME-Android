import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

test('authentication, task sync, quiz evidence and adaptive profile', async t => {
  const token = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const { server } = createApp({ token, filename: ':memory:' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, method = 'GET', body, authorization = token) => fetch(base + path, { method, headers: { Authorization: `Bearer ${authorization}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  assert.equal((await call('/v1/snapshot', 'GET', null, 'wrong')).status, 401);
  const task = await (await call('/v1/tasks', 'POST', { title: 'Buy cardholder' })).json();
  assert.equal((await (await call('/v1/snapshot')).json()).open[0].id, task.id);
  await call(`/v1/tasks/${task.id}/done`, 'POST', { done: true });
  assert.equal((await (await call('/v1/snapshot')).json()).completed.length, 1);
  const card = await (await call('/v1/cards', 'POST', { title: 'Test', topic: 'Science', options: ['a', 'b', 'c', 'd'], correct: 1, prompt: 'Explain the concept.' })).json();
  const attempt = await (await call('/v1/attempts', 'POST', { cardId: card.id, selected: 1, sentence: 'The mechanism has a measurable consequence.' })).json();
  assert.equal(attempt.mcScore, 40);
  assert.equal(attempt.writtenScore, null);
  const mcp = await (await call('/mcp', 'POST', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'home_assess_quiz', arguments: { attemptId: attempt.id, writtenScore: 52, feedback: 'Good mechanism; add a specific example.' } } })).json();
  assert.match(mcp.result.content[0].text, /"score":92/);
  assert.equal((await (await call('/v1/snapshot')).json()).profile[0].mastery, 'Solid');
});

test('first-device import is repeatable and preserves completion state', async t => {
  const token = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const { server } = createApp({ token, filename: ':memory:' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, payload) => fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const payload = { tasks: [{ id: 'legacy:task-1', title: 'Keep my archived task', completedAt: 1700000000000 }], cards: [{ id: 'legacy-card', title: 'Preserved lesson', topic: 'History', options: ['A', 'B', 'C', 'D'], correct: 2, prompt: 'Explain it.' }] };
  assert.equal((await (await request('/v1/import', payload)).json()).imported, 2);
  assert.equal((await (await request('/v1/import', payload)).json()).imported, 0);
  const snapshot = await (await fetch(base + '/v1/snapshot', { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.equal(snapshot.completed.length, 1);
  assert.equal(snapshot.cards.length, 1);
  assert.equal((await request('/v1/tasks/legacy:task-1/done', { done: false })).status, 200);
});
