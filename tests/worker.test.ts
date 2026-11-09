import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { type Env } from '../worker/index';
import type { OrderInput } from '../shared/domain';
class LocalDB {
  sqlite = new DatabaseSync(':memory:');
  constructor() { this.sqlite.exec(readFileSync(new URL('../migrations/0001_orders.sql', import.meta.url), 'utf8')); }
  prepare(sql: string) {
    const query = this.sqlite.prepare(sql); let values: (string | number | null)[] = [];
    const statement = {
      bind(...args: (string | number | null)[]) { values = args; return statement; },
      async first() { return query.get(...values) ?? null; },
      async all() { return { results: query.all(...values) }; },
      async run() { return query.run(...values); },
    }; return statement;
  }
  async batch(statements: { run(): Promise<unknown> }[]) { this.sqlite.exec('BEGIN'); try { const rows = await Promise.all(statements.map(s => s.run())); this.sqlite.exec('COMMIT'); return rows; } catch (e) { this.sqlite.exec('ROLLBACK'); throw e; } }
}
const payload: OrderInput = { cart: { pancakes: [{ filling: 'frango', dough: 'verde', sauce: 'batata', extras: [], qty: 2 }], drinks: {} }, customer: { name: 'Teste de Integração', phone: '98999999999', address: 'Rua de Teste, 123', neighborhood: 'Centro', reference: '', notes: '', payment: 'card', privacy: true } };
function setup() {
  const db = new LocalDB();
  const env = { DB: db as unknown as D1Database, ASSETS: { fetch: async () => new Response('ok') } as unknown as Fetcher,
    ADMIN_PASSWORD: 'uma-senha-de-teste-comprida', SESSION_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres' } satisfies Env;
  const call = (path: string, method = 'GET', body?: unknown, headers?: Record<string,string>) => worker.fetch(new Request('https://loja.test'+path, {
    method, headers: { Origin: 'https://loja.test', 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), env);
  return { db, env, call };
}
test('API grava em SQLite, recalcula total, reutiliza tentativa e evita exposição pública', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-12T22:00:00Z') });
  const { call, db } = setup(); const key = crypto.randomUUID();
  const first = await call('/api/orders', 'POST', { ...payload, totalCents: 1 }, { 'Idempotency-Key': key });
  assert.equal(first.status, 201); const data = await first.json() as { id: number; totalCents: number };
  assert.equal(data.totalCents, 2199);
  const retry = await call('/api/orders', 'POST', payload, { 'Idempotency-Key': key });
  assert.equal(retry.status, 200); assert.equal((await retry.json() as { id: number }).id, data.id);
  assert.equal((db.sqlite.prepare('SELECT count(*) as n FROM orders').get() as { n: number }).n, 1);
  const changed = structuredClone(payload); changed.customer.name = 'Outro cliente';
  assert.equal((await call('/api/orders', 'POST', changed, { 'Idempotency-Key': key })).status, 409);
  assert.equal((await call('/api/admin/orders')).status, 401);
  assert.equal((await call('/api/orders/1')).status, 404);
  t.mock.timers.setTime(new Date('2026-11-13T02:00:00Z').getTime());
  assert.equal((await call('/api/orders', 'POST', payload, { 'Idempotency-Key': crypto.randomUUID() })).status, 409);
  assert.equal((await call('/api/orders', 'POST', payload, { 'Idempotency-Key': key })).status, 200);
  db.sqlite.close();
});
test('painel exige autenticação, cookie protegido, origem correta e transições válidas', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-12T22:00:00Z') });
  const { call, db } = setup();
  const created = await call('/api/orders', 'POST', payload, { 'Idempotency-Key': crypto.randomUUID() });
  const { id } = await created.json() as { id: number };
  assert.equal((await call('/api/admin/login', 'POST', { password: 'errada' })).status, 401);
  const login = await call('/api/admin/login', 'POST', { password: 'uma-senha-de-teste-comprida' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('Set-Cookie')!;
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  const headers = { Cookie: cookie.split(';')[0] };
  const list = await call('/api/admin/orders', 'GET', undefined, headers);
  assert.equal(list.status, 200); assert.equal((await list.json() as { orders: unknown[] }).orders.length, 1);
  assert.equal((await call(`/api/admin/orders/${id}`, 'PATCH', { previousStatus: 'pending', status: 'completed' }, headers)).status, 400);
  assert.equal((await call(`/api/admin/orders/${id}`, 'PATCH', { previousStatus: 'pending', status: 'accepted' }, headers)).status, 200);
  assert.equal((await call(`/api/admin/orders/${id}`, 'PATCH', { previousStatus: 'pending', status: 'accepted' }, headers)).status, 409);
  assert.equal((await call('/api/admin/logout', 'POST', {}, { ...headers, Origin: 'https://malicioso.test' })).status, 403);
  t.mock.timers.setTime(Date.now() + 9 * 3600_000);
  assert.equal((await call('/api/admin/orders', 'GET', undefined, headers)).status, 401);
  db.sqlite.close();
});
test('tentativas de login são limitadas e segredos ausentes bloqueiam o painel', async () => {
  const { call, db, env } = setup();
  for (let i = 0; i < 5; i++) assert.equal((await call('/api/admin/login', 'POST', { password: 'errada' })).status, 401);
  assert.equal((await call('/api/admin/login', 'POST', { password: env.ADMIN_PASSWORD })).status, 429);
  env.ADMIN_PASSWORD = '';
  assert.equal((await call('/api/admin/login', 'POST', { password: '' })).status, 503);
  db.sqlite.close();
});
test('limpeza remove dados antigos sem reiniciar a sequência de pedidos', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-12T22:00:00Z') });
  const { call, db, env } = setup();
  const first = await call('/api/orders', 'POST', payload, { 'Idempotency-Key': crypto.randomUUID() });
  const { id } = await first.json() as { id: number };
  db.sqlite.prepare("UPDATE orders SET created_at = '2020-01-01T00:00:00.000Z'").run();
  await worker.scheduled({} as ScheduledController, env);
  assert.equal((db.sqlite.prepare('SELECT count(*) as n FROM orders').get() as { n: number }).n, 0);
  const second = await call('/api/orders', 'POST', payload, { 'Idempotency-Key': crypto.randomUUID() });
  assert.ok((await second.json() as { id: number }).id > id);
  db.sqlite.close();
});
test('tentativas simultâneas com a mesma chave criam um único registro', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-12T22:00:00Z') });
  const { call, db } = setup(); const key = crypto.randomUUID();
  const responses = await Promise.all([call('/api/orders', 'POST', payload, { 'Idempotency-Key': key }), call('/api/orders', 'POST', payload, { 'Idempotency-Key': key })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200,201]);
  const rows = await Promise.all(responses.map(r => r.json() as Promise<{ id: number }>));
  assert.equal(rows[0].id, rows[1].id);
  assert.equal((db.sqlite.prepare('SELECT count(*) as n FROM orders').get() as { n: number }).n, 1);
  db.sqlite.close();
});
