import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export function createStore(filename = './home.sqlite') {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, card_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, kind TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);`);
  const now = () => new Date().toISOString();
  const decode = r => r && JSON.parse(r.body);
  function put(table, value) {
    const record = { ...value, id: value.id || randomUUID(), updatedAt: now() };
    db.prepare(`INSERT INTO ${table} (id,body,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`).run(record.id, JSON.stringify(record), record.updatedAt);
    return record;
  }
  const list = table => db.prepare(`SELECT body FROM ${table} ORDER BY ${table === 'attempts' ? 'created_at' : 'updated_at'} DESC`).all().map(decode);
  const get = (table, id) => decode(db.prepare(`SELECT body FROM ${table} WHERE id=?`).get(id));
  function addTask(input) {
    const title = String(input.title || '').trim();
    if (!title || title.length > 120) throw new Error('Task title must contain 1–120 characters');
    return put('tasks', { title, done: false, area: 'Personal', details: { outcome: '', info: [], tips: [], links: [] }, ...input, title, id: input.id || randomUUID() });
  }
  function completeTask(id, done) {
    const task = get('tasks', id);
    if (!task) throw new Error('Task not found');
    return put('tasks', { ...task, done: Boolean(done), completedAt: done ? now() : null });
  }
  function addCard(input) {
    if (!input.title || !input.topic || !Array.isArray(input.options) || input.options.length !== 4 || !Number.isInteger(input.correct) || input.correct < 0 || input.correct > 3 || !input.prompt) throw new Error('Card needs title, topic, four options, correct index and prompt');
    return put('cards', { ...input, active: input.active !== false });
  }
  function submitAttempt(input) {
    const card = get('cards', String(input.cardId));
    if (!card) throw new Error('Unknown card');
    if (!Number.isInteger(input.selected) || input.selected < 0 || input.selected > 3) throw new Error('Select one answer A–D');
    const sentence = String(input.sentence || '').trim();
    if (sentence.length < 10 || sentence.length > 1200) throw new Error('Write a one-sentence answer');
    const id = String(input.id || randomUUID());
    const previous = db.prepare('SELECT body FROM attempts WHERE id=?').get(id);
    if (previous) return decode(previous);
    const attempt = { id, cardId: card.id, topic: card.topic, selected: input.selected, sentence, mcScore: input.selected === card.correct ? 40 : 0, writtenScore: null, score: null, feedback: '', createdAt: now() };
    db.prepare('INSERT INTO attempts (id,card_id,body,created_at) VALUES (?,?,?,?)').run(id, card.id, JSON.stringify(attempt), attempt.createdAt);
    return attempt;
  }
  function assessAttempt(id, writtenScore, feedback) {
    const old = decode(db.prepare('SELECT body FROM attempts WHERE id=?').get(id));
    if (!old) throw new Error('Attempt not found');
    if (old.writtenScore !== null) throw new Error('Attempt already assessed');
    if (!Number.isInteger(writtenScore) || writtenScore < 0 || writtenScore > 60 || !String(feedback).trim()) throw new Error('Score must be 0–60 with feedback');
    const record = { ...old, writtenScore, score: old.mcScore + writtenScore, feedback: String(feedback).trim(), assessedAt: now() };
    db.prepare('UPDATE attempts SET body=? WHERE id=?').run(JSON.stringify(record), id);
    return record;
  }
  function profile() {
    const out = {};
    for (const a of db.prepare('SELECT body FROM attempts ORDER BY created_at').all().map(decode)) {
      const p = out[a.topic] ||= { topic: a.topic, attempts: 0, assessed: 0, average: null, writtenAverage: null, lastAnswered: null, gaps: [], strengths: [] };
      p.attempts++; p.lastAnswered = a.createdAt;
      if (a.score !== null) { p.assessed++; p.average = Math.round(((p.average || 0) * (p.assessed - 1) + a.score) / p.assessed); p.writtenAverage = Math.round(((p.writtenAverage || 0) * (p.assessed - 1) + a.writtenScore) / p.assessed); if (a.score < 75) p.gaps.push(a.feedback); else p.strengths.push(a.feedback); }
    }
    for (const p of Object.values(out)) { p.mastery = p.assessed === 0 ? 'New' : p.average < 50 ? 'New' : p.average < 75 ? 'Developing' : p.average < 90 ? 'Solid' : p.assessed >= 3 ? 'Advanced' : 'Solid'; p.gaps = p.gaps.slice(-3); p.strengths = p.strengths.slice(-3); if (p.assessed) p.nextReview = new Date(Date.parse(p.lastAnswered) + (p.mastery === 'New' ? 1 : p.mastery === 'Developing' ? 3 : p.mastery === 'Solid' ? 7 : 14) * 86400000).toISOString(); }
    return Object.values(out);
  }
  function recordActivity(kind, body) {
    const item = { id: randomUUID(), kind, body, createdAt: now() };
    db.prepare('INSERT INTO activity (id,kind,body,created_at) VALUES (?,?,?,?)').run(item.id, kind, JSON.stringify(item), item.createdAt);
    return item;
  }
  return { db, get, list, addTask, completeTask, addCard, submitAttempt, assessAttempt, profile, recordActivity };
}
