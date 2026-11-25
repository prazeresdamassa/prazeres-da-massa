import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalDB } from './local-db';
import worker, { type Env } from '../worker/index';
import type { OrderInput } from '../shared/domain';
const payload: OrderInput = { cart: { pancakes: [{ filling: 'frango', dough: 'verde', sauce: 'batata', extras: [], qty: 2 }], drinks: {} }, customer: { name: 'Teste de Integração', phone: '98999999999', address: 'Rua de Teste', number: '123', neighborhood: 'Centro', reference: '', notes: '', payment: 'card', privacy: true } };
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
  assert.equal(first.status, 201); const data = await first.json() as { id: number; totalCents: number; payment: string };
  assert.equal(data.totalCents, 2199);assert.equal(data.payment,'card');
  const retry = await call('/api/orders', 'POST', payload, { 'Idempotency-Key': key });
  assert.equal(retry.status, 200); assert.equal((await retry.json() as { id: number }).id, data.id);
  assert.equal((db.sqlite.prepare('SELECT count(*) as n FROM orders').get() as { n: number }).n, 1);
  const changed = structuredClone(payload); changed.customer.name = 'Outro cliente';
  assert.equal((await call('/api/orders', 'POST', changed, { 'Idempotency-Key': key })).status, 409);
  assert.equal((await call('/api/admin/orders')).status, 401);
  assert.equal((await call('/api/orders/1')).status, 404);
  t.mock.timers.setTime(new Date('2026-11-13T02:00:00Z').getTime());
  db.sqlite.exec('UPDATE shop_settings SET accepting_orders = 0');
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

test('chave exige login e controla pedidos fora de qualquer horário', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-09T12:00:00Z') });
  const { call, db } = setup();
  assert.equal((await call('/api/admin/settings', 'PATCH', { acceptingOrders: false })).status, 401);
  const login = await call('/api/admin/login', 'POST', { password: 'uma-senha-de-teste-comprida' });
  const headers = { Cookie: login.headers.get('Set-Cookie')!.split(';')[0] };
  assert.equal((await call('/api/orders', 'POST', payload, { 'Idempotency-Key': crypto.randomUUID() })).status, 201);
  assert.equal((await call('/api/admin/settings','PATCH',{ acceptingOrders: false },headers)).status, 200);
  assert.equal((await (await call('/api/status')).json() as { open: boolean }).open, false);
  assert.equal((await call('/api/orders','POST',payload,{ 'Idempotency-Key': crypto.randomUUID() })).status, 409);
  assert.equal((await call('/api/admin/settings','PATCH',{ acceptingOrders: true },headers)).status, 200);
  assert.equal((await (await call('/api/status')).json() as { open: boolean }).open, true);
  assert.equal((await call('/api/orders','POST',payload,{ 'Idempotency-Key': crypto.randomUUID() })).status, 201);
  db.sqlite.close();
});

test('sonda autenticada identifica apenas pedidos novos e não expõe dados pessoais', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-12T22:00:00Z') });
  const { call, db } = setup();
  assert.equal((await call('/api/admin/orders/latest')).status, 401);
  const login = await call('/api/admin/login', 'POST', { password: 'uma-senha-de-teste-comprida' });
  const headers = { Cookie: login.headers.get('Set-Cookie')!.split(';')[0] };
  assert.deepEqual(await (await call('/api/admin/orders/latest','GET',undefined,headers)).json(), { latestId: 0 });
  const created = await call('/api/orders','POST',payload,{ 'Idempotency-Key': crypto.randomUUID() });
  const { id } = await created.json() as { id: number };
  assert.deepEqual(await (await call('/api/admin/orders/latest','GET',undefined,headers)).json(), { latestId: id });
  await call(`/api/admin/orders/${id}`,'PATCH',{ previousStatus: 'pending', status: 'accepted' },headers);
  assert.deepEqual(await (await call('/api/admin/orders/latest','GET',undefined,headers)).json(), { latestId: id });
  const second = await call('/api/orders','POST',payload,{ 'Idempotency-Key': crypto.randomUUID() });
  const newer = await second.json() as { id: number };
  assert.ok(newer.id > id);
  assert.deepEqual(await (await call('/api/admin/orders/latest','GET',undefined,headers)).json(), { latestId: newer.id });
  db.sqlite.close();
});

test('gestão exige autenticação e salva somente relatórios calculados no servidor', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-12T22:00:00Z') });
  const { call, db } = setup();
  assert.equal((await call('/api/admin/management?period=2026-11')).status,401);
  const login=await call('/api/admin/login','POST',{password:'uma-senha-de-teste-comprida'});
  const headers={Cookie:login.headers.get('Set-Cookie')!.split(';')[0]};
  const created=await call('/api/orders','POST',payload,{'Idempotency-Key':crypto.randomUUID()});
  const {id}=await created.json() as {id:number};
  db.sqlite.prepare("UPDATE orders SET created_at='2026-11-12T22:00:00.000Z'").run();
  for (const [from,to] of [['pending','accepted'],['accepted','preparing'],['preparing','dispatched'],['dispatched','completed']]) assert.equal((await call(`/api/admin/orders/${id}`,'PATCH',{previousStatus:from,status:to},headers)).status,200);
  const saved=await call('/api/admin/management/reports','POST',{period:'2026-11',metrics:{revenueCents:1}},headers);
  assert.equal(saved.status,201);
  const report=await saved.json() as {metrics:{revenueCents:number;completed:number}};
  assert.equal(report.metrics.revenueCents,2199);assert.equal(report.metrics.completed,1);
  assert.ok(!JSON.stringify(report).includes('Teste de Integração'));
  db.sqlite.exec('DELETE FROM orders');
  const read=await call('/api/admin/management/reports/2026-11','GET',undefined,headers);
  assert.equal(read.status,200);assert.deepEqual((await read.json() as typeof report).metrics,report.metrics);
  assert.equal((await call('/api/admin/management?period=2026-Q9','GET',undefined,headers)).status,400);
  db.sqlite.close();
});

test('recibo preserva Pix em nova tentativa e API salva e reabre dias e períodos',async()=>{
  const {call,db}=setup();const input={...payload,customer:{...payload.customer,payment:'pix'}};
  const key=crypto.randomUUID();
  const first=await call('/api/orders','POST',input,{'Idempotency-Key':key});assert.equal(first.status,201);
  assert.equal((await first.json() as {payment:string}).payment,'pix');
  const retry=await call('/api/orders','POST',input,{'Idempotency-Key':key});assert.equal((await retry.json() as {payment:string}).payment,'pix');
  const login=await call('/api/admin/login','POST',{password:'uma-senha-de-teste-comprida'});
  const headers={Cookie:login.headers.get('Set-Cookie')!.split(';')[0]};
  for(const period of ['2026-11-12','2026-11-10_2026-11-15']){
    assert.equal((await call('/api/admin/management/reports','POST',{period},headers)).status,201);
    const reopened=await call('/api/admin/management/reports/'+period,'GET',undefined,headers);assert.equal(reopened.status,200);
    assert.equal((await reopened.json() as {period:string}).period,period);
  }
  assert.equal((await call('/api/admin/management?period=2026-11-15_2026-11-10','GET',undefined,headers)).status,400);db.sqlite.close();
});

test('API conclui pedido sem caixa de leitura do aviso e não registra consentimento presumido', async () => {
  const {call,db}=setup();const customer={...payload.customer};delete customer.privacy;
  const key=crypto.randomUUID();const input={...payload,customer};
  const response=await call('/api/orders','POST',input,{'Idempotency-Key':key});assert.equal(response.status,201);
  const row=db.sqlite.prepare('SELECT customer_json FROM orders').get() as {customer_json:string};
  assert.equal(Object.hasOwn(JSON.parse(row.customer_json),'privacy'),false);
  assert.equal((await call('/api/orders','POST',input,{'Idempotency-Key':key})).status,200);
  db.sqlite.close();
});

test('estoque exige login/origem e bloqueia opções e bebidas, preservando pedidos já recebidos',async()=>{
  const {call,db}=setup();
  assert.equal((await call('/api/admin/inventory')).status,401);
  const login=await call('/api/admin/login','POST',{password:'uma-senha-de-teste-comprida'});
  const headers={Cookie:login.headers.get('Set-Cookie')!.split(';')[0]};
  const patch=(key:string,available:boolean,previousAvailable:boolean)=>call('/api/admin/inventory','PATCH',{key,available,previousAvailable},headers);
  assert.equal((await call('/api/admin/inventory','PATCH',{key:'filling:frango',available:false,previousAvailable:true},{...headers,Origin:'https://outro.test'})).status,403);
  assert.equal((await patch('falso',false,true)).status,400);
  const key=crypto.randomUUID();const saved=await call('/api/orders','POST',payload,{'Idempotency-Key':key});assert.equal(saved.status,201);
  for(const stockKey of ['filling:frango','dough:verde','sauce:batata']){
    assert.equal((await patch(stockKey,false,true)).status,200);
    const status=await (await call('/api/status')).json() as {unavailable:string[]};assert.ok(status.unavailable.includes(stockKey));
    const denied=await call('/api/orders','POST',payload,{'Idempotency-Key':crypto.randomUUID()});assert.equal(denied.status,409);
    assert.match((await denied.json() as {error:string}).error,/esgotados/);
    assert.equal((await call('/api/orders','POST',payload,{'Idempotency-Key':key})).status,200);
    assert.equal((await patch(stockKey,true,true)).status,409);
    assert.equal((await patch(stockKey,true,false)).status,200);
  }
  assert.equal((await patch('drink:coca',false,true)).status,200);
  const drinkOrder={...payload,cart:{...payload.cart,drinks:{coca:1}}};
  assert.equal((await call('/api/orders','POST',drinkOrder,{'Idempotency-Key':crypto.randomUUID()})).status,409);
  const extraOrder={...payload,cart:{...payload.cart,pancakes:[{...payload.cart.pancakes[0],extras:['queijo']}]}};
  await patch('extra:queijo',false,true);
  assert.equal((await call('/api/orders','POST',extraOrder,{'Idempotency-Key':crypto.randomUUID()})).status,409);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM orders').get()!.n,1);
  const inventory=await (await call('/api/admin/inventory','GET',undefined,headers)).json() as {items:{key:string;available:boolean}[]};
  assert.equal(inventory.items.find(p=>p.key==='drink:coca')!.available,false);
  db.sqlite.close();
});

test('checagem de estoque no INSERT impede venda quando item esgota após a verificação inicial',async()=>{
  const {call,db,env}=setup();const prepare=db.prepare.bind(db);let intercepted=false;
  env.DB={...env.DB,prepare(sql:string){if(sql.startsWith('INSERT INTO orders')&&!intercepted){intercepted=true;db.sqlite.exec("UPDATE inventory SET available=0 WHERE key='filling:frango'");}return prepare(sql);}} as unknown as D1Database;
  const response=await call('/api/orders','POST',payload,{'Idempotency-Key':crypto.randomUUID()});
  assert.equal(response.status,409);assert.match((await response.json() as {error:string}).error,/Frango/);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM orders').get()!.n,0);db.sqlite.close();
});

test('horários de preparo são persistidos pelo servidor e congelados na saída ou cancelamento',async t=>{
  const {call,db}=setup();t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-25T19:00:00.000Z')});
  const login=await call('/api/admin/login','POST',{password:'uma-senha-de-teste-comprida'});
  const headers={Cookie:login.headers.get('Set-Cookie')!.split(';')[0]};
  const created=await call('/api/orders','POST',payload,{'Idempotency-Key':crypto.randomUUID()});const {id}=await created.json() as {id:number};
  const change=(previousStatus:string,status:string)=>call(`/api/admin/orders/${id}`,'PATCH',{previousStatus,status},headers);
  const accepted=await (await change('pending','accepted')).json() as {preparationStartedAt:string|null};assert.equal(accepted.preparationStartedAt,null);
  const start=await (await change('accepted','preparing')).json() as {preparationStartedAt:string;preparationFinishedAt:string|null};
  assert.equal(start.preparationStartedAt,'2026-11-25T19:00:00.000Z');assert.equal(start.preparationFinishedAt,null);
  t.mock.timers.setTime(new Date('2026-11-25T19:10:00.000Z').getTime());
  assert.equal((await change('accepted','preparing')).status,409);
  const list=await (await call('/api/admin/orders','GET',undefined,headers)).json() as {orders:{preparationStartedAt:string;preparationFinishedAt:string|null}[];serverTime:string};
  assert.equal(list.orders[0].preparationStartedAt,start.preparationStartedAt);assert.equal(list.orders[0].preparationFinishedAt,null);assert.equal(list.serverTime,'2026-11-25T19:10:00.000Z');
  t.mock.timers.setTime(new Date('2026-11-25T19:40:01.000Z').getTime());
  const end=await (await change('preparing','dispatched')).json() as {preparationStartedAt:string;preparationFinishedAt:string};
  assert.equal(end.preparationStartedAt,start.preparationStartedAt);assert.equal(end.preparationFinishedAt,'2026-11-25T19:40:01.000Z');
  t.mock.timers.setTime(new Date('2026-11-25T20:00:00.000Z').getTime());
  const complete=await (await change('dispatched','completed')).json() as {preparationFinishedAt:string};assert.equal(complete.preparationFinishedAt,end.preparationFinishedAt);
  const another=await (await call('/api/orders','POST',payload,{'Idempotency-Key':crypto.randomUUID()})).json() as {id:number};
  for(const [previousStatus,status] of [['pending','accepted'],['accepted','preparing'],['preparing','cancelled']])assert.equal((await call(`/api/admin/orders/${another.id}`,'PATCH',{previousStatus,status},headers)).status,200);
  const cancelled=db.sqlite.prepare('SELECT preparation_finished_at FROM orders WHERE id=?').get(another.id);assert.equal(cancelled!.preparation_finished_at,'2026-11-25T20:00:00.000Z');
  db.sqlite.close();
});
