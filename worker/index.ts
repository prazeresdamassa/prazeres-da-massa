import { SHOP, ValidationError, shopStatus, validateOrder, totals, whatsappMessage, statusLabels, type OrderStatus, type OrderInput } from '../shared/domain';
export interface Env { DB: D1Database; ASSETS: Fetcher; ADMIN_PASSWORD?: string; SESSION_SECRET?: string }
type Row = { id: number; request_hash: string; created_at: string; status: OrderStatus; customer_json: string; items_json: string; total_cents: number; updated_at: string };
const configured = (env: Env) => !!env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 16 && !!env.SESSION_SECRET && env.SESSION_SECRET.length >= 32;
const encoder = new TextEncoder();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const fail = (message: string, status: number) => json({ error: message }, status);
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join(''); }
function equal(a: string, b: string) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }
async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
async function authorized(req: Request, env: Env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16) return false;
  const cookie = req.headers.get('Cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('pdm_session='))?.slice(12);
  if (!cookie) return false;
  const [expiry, salt, sig] = cookie.split('.');
  if (!expiry || !salt || !sig || !/^\d+$/.test(expiry) || Number(expiry) < Date.now() || Number(expiry) > Date.now() + 8 * 3600_000) return false;
  return equal(sig, await signature(`${expiry}.${salt}`, env.SESSION_SECRET));
}
async function rateLimit(req: Request, env: Env, category: string, max: number, seconds: number) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  // CF-Connecting-IP é definido pela Cloudflare; não utilizamos X-Forwarded-For.
  const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
  const key = await digest(`${category}:${bucket}:${ip}`);
  const row = await env.DB.prepare('INSERT INTO rate_limits (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts')
    .bind(key, Date.now() + seconds * 1000).first<{ attempts: number }>();
  return (row?.attempts ?? max + 1) <= max;
}
async function readBody(req: Request): Promise<unknown> {
  if (!req.headers.get('Content-Type')?.startsWith('application/json')) throw new ValidationError('Envie os dados em JSON.');
  if (Number(req.headers.get('Content-Length')) > 16384) throw new ValidationError('Pedido muito grande.');
  const reader = req.body?.getReader();
  if (!reader) throw new ValidationError('Dados ausentes.');
  let length = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 16384) { await reader.cancel(); throw new ValidationError('Pedido muito grande.'); }
    chunks.push(value);
  }
  const buffer = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(buffer)); } catch { throw new ValidationError('Dados inválidos.'); }
}
function receipt(row: Row) {
  const order: OrderInput = { customer: JSON.parse(row.customer_json), cart: JSON.parse(row.items_json) };
  return { id: row.id, label: `#${String(row.id).padStart(5, '0')}`, totalCents: row.total_cents,
    status: row.status, createdAt: row.created_at, whatsappUrl: whatsappMessage(row.id, order, row.created_at, row.total_cents) };
}
const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'cancelled'], accepted: ['preparing', 'cancelled'],
  preparing: ['dispatched', 'cancelled'], dispatched: ['completed', 'cancelled'], completed: [], cancelled: [],
};
async function api(req: Request, env: Env) {
  const url = new URL(req.url); const path = url.pathname;
  if (req.method !== 'GET' && req.headers.get('Origin') !== url.origin) return fail('Origem não autorizada.', 403);
  if (path === '/api/status' && req.method === 'GET') {
    const setting = await env.DB.prepare('SELECT accepting_orders FROM shop_settings WHERE id = 1').first<{ accepting_orders: number }>();
    const open = configured(env) && setting?.accepting_orders === 1;
    return json({ open, ready: configured(env), today: open ? 'Recebendo pedidos' : 'Novos pedidos pausados', serverTime: new Date().toISOString() });
  }
  if (path === '/api/orders' && req.method === 'POST') {
    if (!configured(env)) return fail('A loja está finalizando a configuração do atendimento. Tente mais tarde.', 503);
    const key = req.headers.get('Idempotency-Key') ?? '';
    if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(key)) return fail('Identificador do pedido inválido.', 400);
    if (!await rateLimit(req, env, 'order', 20, 600)) return fail('Muitas tentativas. Aguarde alguns minutos.', 429);
    const order = validateOrder(await readBody(req));
    const hash = await digest(JSON.stringify(order));
    const existing = await env.DB.prepare('SELECT * FROM orders WHERE request_key = ?').bind(key).first<Row>();
    if (existing) return existing.request_hash === hash ? json(receipt(existing)) : fail('Esta tentativa pertence a outro pedido. Atualize os dados para continuar.', 409);
    const setting = await env.DB.prepare('SELECT accepting_orders FROM shop_settings WHERE id = 1').first<{ accepting_orders: number }>();
    if (setting?.accepting_orders !== 1) return fail('A loja pausou novos pedidos. Seu carrinho continua salvo.', 409);
    const row = await env.DB.prepare('INSERT INTO orders (request_key, request_hash, customer_json, items_json, total_cents) SELECT ?, ?, ?, ?, ? FROM shop_settings WHERE id = 1 AND accepting_orders = 1 ON CONFLICT(request_key) DO NOTHING RETURNING *')
      .bind(key, hash, JSON.stringify(order.customer), JSON.stringify(order.cart), totals(order.cart).totalCents).first<Row>();
    const saved = row ?? await env.DB.prepare('SELECT * FROM orders WHERE request_key = ?').bind(key).first<Row>();
    if (!saved) return fail('A loja pausou novos pedidos. Seu carrinho continua salvo.', 409);
    if (saved.request_hash !== hash) return fail('Tentativa conflitante. Revise seu pedido.', 409);
    return json(receipt(saved), row ? 201 : 200);
  }
  if (path === '/api/admin/login' && req.method === 'POST') {
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16 || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return fail('Configure a senha administrativa e o segredo de sessão na Cloudflare.', 503);
    if (!await rateLimit(req, env, 'login', 5, 900)) return fail('Muitas tentativas. Aguarde 15 minutos.', 429);
    const body = await readBody(req) as { password?: unknown };
    if (typeof body?.password !== 'string' || body.password.length > 256 || !equal(await digest(body.password), await digest(env.ADMIN_PASSWORD))) return fail('Senha incorreta.', 401);
    const value = `${Date.now() + 8 * 3600_000}.${crypto.randomUUID()}`;
    const res = json({ ok: true });
    res.headers.set('Set-Cookie', `pdm_session=${value}.${await signature(value, env.SESSION_SECRET)}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800`);
    return res;
  }
  if (path.startsWith('/api/admin/')) {
    if (!await authorized(req, env)) return fail('Faça login para continuar.', 401);
    if (path === '/api/admin/settings' && req.method === 'GET') {
      const row = await env.DB.prepare('SELECT accepting_orders FROM shop_settings WHERE id = 1').first<{ accepting_orders: number }>();
      return json({ acceptingOrders: row?.accepting_orders === 1 });
    }
    if (path === '/api/admin/settings' && req.method === 'PATCH') {
      const body = await readBody(req) as { acceptingOrders?: unknown };
      if (typeof body?.acceptingOrders !== 'boolean') return fail('Informe se deseja receber pedidos.', 400);
      await env.DB.prepare('UPDATE shop_settings SET accepting_orders = ? WHERE id = 1').bind(body.acceptingOrders ? 1 : 0).run();
      return json({ acceptingOrders: body.acceptingOrders });
    }
    if (path === '/api/admin/logout' && req.method === 'POST') {
      const res = json({ ok: true }); res.headers.set('Set-Cookie', 'pdm_session=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0'); return res;
    }
    if (path === '/api/admin/orders' && req.method === 'GET') {
      const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
      if (!Number.isSafeInteger(before) || before <= 0) return fail('Página inválida.', 400);
      const rows = await env.DB.prepare('SELECT id, created_at, updated_at, status, customer_json, items_json, total_cents FROM orders WHERE id < ? ORDER BY id DESC LIMIT 50').bind(before).all<Row>();
      return json({ orders: rows.results.map(row => ({ id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, status: row.status,
        customer: JSON.parse(row.customer_json), cart: JSON.parse(row.items_json), totalCents: row.total_cents })), nextBefore: rows.results.length === 50 ? rows.results[49].id : null });
    }
    const match = path.match(/^\/api\/admin\/orders\/(\d+)$/);
    if (match && req.method === 'PATCH') {
      const body = await readBody(req) as { status?: OrderStatus; previousStatus?: OrderStatus };
      if (!body?.status || !(body.status in statusLabels) || !body.previousStatus || !Object.hasOwn(transitions, body.previousStatus) || !transitions[body.previousStatus].includes(body.status)) return fail('Mudança de situação inválida.', 400);
      const row = await env.DB.prepare("UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = ? RETURNING id")
        .bind(body.status, Number(match[1]), body.previousStatus).first();
      return row ? json({ ok: true }) : fail('O pedido foi atualizado em outra sessão. Atualize a lista.', 409);
    }
  }
  return fail('Recurso não encontrado.', 404);
}
export default {
  async fetch(req: Request, env: Env) {
    let res: Response;
    try { res = new URL(req.url).pathname.startsWith('/api/') ? await api(req, env) : await env.ASSETS.fetch(req); }
    catch (error) { res = error instanceof ValidationError ? fail(error.message, 400) : fail('Serviço indisponível no momento. Seu carrinho permanece salvo; tente novamente.', 503); }
    const headers = new Headers(res.headers);
    headers.set('X-Content-Type-Options', 'nosniff'); headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Frame-Options', 'DENY'); headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    if (new URL(req.url).pathname.startsWith('/admin')) headers.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(res.body, { status: res.status, headers });
  },
  async scheduled(_event: ScheduledController, env: Env) {
    // Minimização de dados: eliminar pedidos e dados pessoais após 90 dias.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Date.now()),
      env.DB.prepare("DELETE FROM orders WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')"),
    ]);
  },
} satisfies ExportedHandler<Env>;
