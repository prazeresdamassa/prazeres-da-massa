var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// shared/domain.ts
var SHOP = {
  name: "Prazeres da Massa",
  whatsapp: "5598981997360",
  pix: "98982878794",
  pixOwner: "Romilly Sousa Prazeres",
  city: "Chapadinha\u2013MA",
  timezone: "America/Fortaleza"
};
var fillings = [
  { id: "frango", name: "Frango cremoso", description: "Frango desfiado com nosso tempero especial", icon: "\u{1F357}" },
  { id: "carne", name: "Carne mo\xEDda especial", description: "Carne refogada, bem temperadinha", icon: "\u{1F969}" }
];
var doughs = [
  { id: "tradicional", name: "Tradicional", description: "Leve e douradinha", icon: "\u{1F95E}" },
  { id: "verde", name: "Verde", description: "Com couve-folha", icon: "\u{1F33F}" }
];
var sauces = [
  { id: "tomate", name: "Tomate especial", description: "Artesanal e temperado", icon: "\u{1F345}" },
  { id: "batata", name: "Batata especial", description: "Cremoso e aveludado", icon: "\u{1F954}" },
  { id: "sem", name: "Sem molho", description: "Do seu jeitinho", icon: "\u2728" }
];
var extras = [
  { id: "oregano", name: "Or\xE9gano" },
  { id: "queijo", name: "Queijo mussarela" }
];
var drinks = [
  { id: "coca", name: "Coca-Cola tradicional", cents: 600 },
  { id: "coca-zero", name: "Coca-Cola zero", cents: 699 }
];
var prices = { pair: 2199, single: 1299 };
var statusLabels = {
  pending: "Aguardando confirma\xE7\xE3o",
  accepted: "Confirmado",
  preparing: "Em preparo",
  dispatched: "Saiu para entrega",
  completed: "Conclu\xEDdo",
  cancelled: "Cancelado"
};
var money = /* @__PURE__ */ __name((cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "money");
var ValidationError = class extends Error {
  static {
    __name(this, "ValidationError");
  }
};
function record(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ValidationError("Dados do pedido inv\xE1lidos.");
  return v;
}
__name(record, "record");
function text(v, label, min, max) {
  if (typeof v !== "string") throw new ValidationError(`Verifique ${label}.`);
  const s = v.trim().replace(/[\u0000-\u001f\u007f]/g, " ");
  if (s.length < min || s.length > max) throw new ValidationError(`${label}: use entre ${min} e ${max} caracteres.`);
  return s;
}
__name(text, "text");
function option(v, list) {
  if (typeof v !== "string" || !list.some((x) => x.id === v)) throw new ValidationError("Uma op\xE7\xE3o do card\xE1pio \xE9 inv\xE1lida. Atualize a p\xE1gina.");
  return v;
}
__name(option, "option");
function quantity(v, min = 0) {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > 99) throw new ValidationError("Quantidade inv\xE1lida (m\xE1ximo de 99).");
  return v;
}
__name(quantity, "quantity");
function validateCart(value) {
  const v = record(value);
  if (!Array.isArray(v.pancakes) || v.pancakes.length > 30) throw new ValidationError("Carrinho inv\xE1lido.");
  const pancakes = v.pancakes.map((item) => {
    const p = record(item);
    if (!Array.isArray(p.extras) || p.extras.length > 2) throw new ValidationError("Adicionais inv\xE1lidos.");
    const selected = p.extras.map((x) => option(x, extras));
    if (new Set(selected).size !== selected.length) throw new ValidationError("Adicionais repetidos.");
    return { filling: option(p.filling, fillings), dough: option(p.dough, doughs), sauce: option(p.sauce, sauces), extras: selected.sort(), qty: quantity(p.qty, 1) };
  });
  if (pancakes.reduce((n, p) => n + p.qty, 0) > 99) throw new ValidationError("O limite \xE9 de 99 panquecas por pedido.");
  const quantities = record(v.drinks);
  const result = {};
  for (const [key, qty] of Object.entries(quantities)) result[option(key, drinks)] = quantity(qty);
  return { pancakes, drinks: result };
}
__name(validateCart, "validateCart");
function validateOrder(value) {
  const v = record(value);
  const cart = validateCart(v.cart);
  const c = record(v.customer);
  if (!cart.pancakes.length) throw new ValidationError("Adicione pelo menos uma panqueca.");
  const phone = text(c.phone, "o WhatsApp", 10, 22).replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(phone)) throw new ValidationError("Informe seu WhatsApp com DDD (10 ou 11 d\xEDgitos).");
  if (c.payment !== "pix" && c.payment !== "card") throw new ValidationError("Escolha a forma de pagamento.");
  if (c.privacy !== true) throw new ValidationError("Confirme a leitura do aviso de privacidade.");
  return { cart, customer: {
    name: text(c.name, "o nome", 2, 80),
    phone,
    address: text(c.address, "o endere\xE7o", 5, 200),
    neighborhood: text(c.neighborhood, "o bairro", 2, 80),
    reference: text(c.reference, "a refer\xEAncia", 0, 200),
    notes: text(c.notes, "as observa\xE7\xF5es", 0, 500),
    payment: c.payment,
    privacy: true
  } };
}
__name(validateOrder, "validateOrder");
function totals(cart) {
  const count = cart.pancakes.reduce((n, p) => n + p.qty, 0);
  const pancakeCents = Math.floor(count / 2) * prices.pair + count % 2 * prices.single;
  const drinkCents = drinks.reduce((n, d) => n + (cart.drinks[d.id] ?? 0) * d.cents, 0);
  return { count, pancakeCents, drinkCents, totalCents: pancakeCents + drinkCents, savings: count * prices.single - pancakeCents };
}
__name(totals, "totals");
function describe(p) {
  return {
    name: fillings.find((x) => x.id === p.filling).name,
    details: [
      doughs.find((x) => x.id === p.dough)?.name ?? (p.dough === "vermelha" ? "Vermelha (beterraba \u2014 item descontinuado)" : p.dough),
      sauces.find((x) => x.id === p.sauce).name,
      ...p.extras.map((id) => extras.find((x) => x.id === id).name)
    ].join(" \xB7 ")
  };
}
__name(describe, "describe");
function whatsappMessage(id, order, createdAt, savedTotalCents = totals(order.cart).totalCents) {
  const label = `#${String(id).padStart(5, "0")}`;
  const c = order.customer;
  const t = totals(order.cart);
  const lines = [
    `\u{1F95E} *PRAZERES DA MASSA \u2014 ${label}*`,
    "Pedido registrado; aguardando confirma\xE7\xE3o da loja.",
    new Date(createdAt).toLocaleString("pt-BR", { timeZone: SHOP.timezone }),
    "",
    `Nome: ${c.name}`,
    `WhatsApp: ${c.phone}`,
    `Endere\xE7o: ${c.address}`,
    `Bairro: ${c.neighborhood}`,
    `Cidade: ${SHOP.city}`,
    c.reference ? `Refer\xEAncia: ${c.reference}` : "",
    "",
    "*Seu pedido*",
    ...order.cart.pancakes.map((p) => `${p.qty}\xD7 ${describe(p).name}
${describe(p).details}`),
    ...drinks.filter((d) => order.cart.drinks[d.id]).map((d) => `${order.cart.drinks[d.id]}\xD7 ${d.name}`),
    "",
    `Total: ${money(savedTotalCents)}`,
    "Entrega gr\xE1tis, sujeita \xE0 \xE1rea de atendimento.",
    `Pagamento: ${c.payment === "pix" ? "Pix" : "Cart\xE3o (cr\xE9dito/d\xE9bito por aproxima\xE7\xE3o)"}`,
    c.payment === "pix" ? `Chave Pix (celular): ${SHOP.pix}
Titular: ${SHOP.pixOwner}` : "",
    c.notes ? `Observa\xE7\xF5es: ${c.notes}` : "",
    "Por favor, confirme a disponibilidade e a entrega."
  ];
  return `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(lines.filter((x) => x !== "").join("\n"))}`;
}
__name(whatsappMessage, "whatsappMessage");

// worker/index.ts
var configured = /* @__PURE__ */ __name((env) => !!env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 16 && !!env.SESSION_SECRET && env.SESSION_SECRET.length >= 32, "configured");
var encoder = new TextEncoder();
var json = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }), "json");
var fail = /* @__PURE__ */ __name((message, status) => json({ error: message }, status), "fail");
async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))), (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(digest, "digest");
function equal(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
__name(equal, "equal");
async function signature(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))), (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(signature, "signature");
async function authorized(req, env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16) return false;
  const cookie = req.headers.get("Cookie")?.split(";").map((x) => x.trim()).find((x) => x.startsWith("pdm_session="))?.slice(12);
  if (!cookie) return false;
  const [expiry, salt, sig] = cookie.split(".");
  if (!expiry || !salt || !sig || !/^\d+$/.test(expiry) || Number(expiry) < Date.now() || Number(expiry) > Date.now() + 8 * 36e5) return false;
  return equal(sig, await signature(`${expiry}.${salt}`, env.SESSION_SECRET));
}
__name(authorized, "authorized");
async function rateLimit(req, env, category, max, seconds) {
  const bucket = Math.floor(Date.now() / (seconds * 1e3));
  const ip = req.headers.get("CF-Connecting-IP") ?? "local";
  const key = await digest(`${category}:${bucket}:${ip}`);
  const row = await env.DB.prepare("INSERT INTO rate_limits (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts").bind(key, Date.now() + seconds * 1e3).first();
  return (row?.attempts ?? max + 1) <= max;
}
__name(rateLimit, "rateLimit");
async function readBody(req) {
  if (!req.headers.get("Content-Type")?.startsWith("application/json")) throw new ValidationError("Envie os dados em JSON.");
  if (Number(req.headers.get("Content-Length")) > 16384) throw new ValidationError("Pedido muito grande.");
  const reader = req.body?.getReader();
  if (!reader) throw new ValidationError("Dados ausentes.");
  let length = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16384) {
      await reader.cancel();
      throw new ValidationError("Pedido muito grande.");
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new ValidationError("Dados inv\xE1lidos.");
  }
}
__name(readBody, "readBody");
function receipt(row) {
  const order = { customer: JSON.parse(row.customer_json), cart: JSON.parse(row.items_json) };
  return {
    id: row.id,
    label: `#${String(row.id).padStart(5, "0")}`,
    totalCents: row.total_cents,
    status: row.status,
    createdAt: row.created_at,
    whatsappUrl: whatsappMessage(row.id, order, row.created_at, row.total_cents)
  };
}
__name(receipt, "receipt");
var transitions = {
  pending: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["dispatched", "cancelled"],
  dispatched: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};
async function api(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;
  if (req.method !== "GET" && req.headers.get("Origin") !== url.origin) return fail("Origem n\xE3o autorizada.", 403);
  if (path === "/api/status" && req.method === "GET") {
    const setting = await env.DB.prepare("SELECT accepting_orders FROM shop_settings WHERE id = 1").first();
    const open = configured(env) && setting?.accepting_orders === 1;
    return json({ open, ready: configured(env), today: open ? "Recebendo pedidos" : "Novos pedidos pausados", serverTime: (/* @__PURE__ */ new Date()).toISOString() });
  }
  if (path === "/api/orders" && req.method === "POST") {
    if (!configured(env)) return fail("A loja est\xE1 finalizando a configura\xE7\xE3o do atendimento. Tente mais tarde.", 503);
    const key = req.headers.get("Idempotency-Key") ?? "";
    if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(key)) return fail("Identificador do pedido inv\xE1lido.", 400);
    if (!await rateLimit(req, env, "order", 20, 600)) return fail("Muitas tentativas. Aguarde alguns minutos.", 429);
    const order = validateOrder(await readBody(req));
    const hash = await digest(JSON.stringify(order));
    const existing = await env.DB.prepare("SELECT * FROM orders WHERE request_key = ?").bind(key).first();
    if (existing) return existing.request_hash === hash ? json(receipt(existing)) : fail("Esta tentativa pertence a outro pedido. Atualize os dados para continuar.", 409);
    const setting = await env.DB.prepare("SELECT accepting_orders FROM shop_settings WHERE id = 1").first();
    if (setting?.accepting_orders !== 1) return fail("A loja pausou novos pedidos. Seu carrinho continua salvo.", 409);
    const row = await env.DB.prepare("INSERT INTO orders (request_key, request_hash, customer_json, items_json, total_cents) SELECT ?, ?, ?, ?, ? FROM shop_settings WHERE id = 1 AND accepting_orders = 1 ON CONFLICT(request_key) DO NOTHING RETURNING *").bind(key, hash, JSON.stringify(order.customer), JSON.stringify(order.cart), totals(order.cart).totalCents).first();
    const saved = row ?? await env.DB.prepare("SELECT * FROM orders WHERE request_key = ?").bind(key).first();
    if (!saved) return fail("A loja pausou novos pedidos. Seu carrinho continua salvo.", 409);
    if (saved.request_hash !== hash) return fail("Tentativa conflitante. Revise seu pedido.", 409);
    return json(receipt(saved), row ? 201 : 200);
  }
  if (path === "/api/admin/login" && req.method === "POST") {
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16 || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return fail("Configure a senha administrativa e o segredo de sess\xE3o na Cloudflare.", 503);
    if (!await rateLimit(req, env, "login", 5, 900)) return fail("Muitas tentativas. Aguarde 15 minutos.", 429);
    const body = await readBody(req);
    if (typeof body?.password !== "string" || body.password.length > 256 || !equal(await digest(body.password), await digest(env.ADMIN_PASSWORD))) return fail("Senha incorreta.", 401);
    const value = `${Date.now() + 8 * 36e5}.${crypto.randomUUID()}`;
    const res = json({ ok: true });
    res.headers.set("Set-Cookie", `pdm_session=${value}.${await signature(value, env.SESSION_SECRET)}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800`);
    return res;
  }
  if (path.startsWith("/api/admin/")) {
    if (!await authorized(req, env)) return fail("Fa\xE7a login para continuar.", 401);
    if (path === "/api/admin/settings" && req.method === "GET") {
      const row = await env.DB.prepare("SELECT accepting_orders FROM shop_settings WHERE id = 1").first();
      return json({ acceptingOrders: row?.accepting_orders === 1 });
    }
    if (path === "/api/admin/settings" && req.method === "PATCH") {
      const body = await readBody(req);
      if (typeof body?.acceptingOrders !== "boolean") return fail("Informe se deseja receber pedidos.", 400);
      await env.DB.prepare("UPDATE shop_settings SET accepting_orders = ? WHERE id = 1").bind(body.acceptingOrders ? 1 : 0).run();
      return json({ acceptingOrders: body.acceptingOrders });
    }
    if (path === "/api/admin/logout" && req.method === "POST") {
      const res = json({ ok: true });
      res.headers.set("Set-Cookie", "pdm_session=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0");
      return res;
    }
    if (path === "/api/admin/orders" && req.method === "GET") {
      const before = Number(url.searchParams.get("before") || Number.MAX_SAFE_INTEGER);
      if (!Number.isSafeInteger(before) || before <= 0) return fail("P\xE1gina inv\xE1lida.", 400);
      const rows = await env.DB.prepare("SELECT id, created_at, updated_at, status, customer_json, items_json, total_cents FROM orders WHERE id < ? ORDER BY id DESC LIMIT 50").bind(before).all();
      return json({ orders: rows.results.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
        customer: JSON.parse(row.customer_json),
        cart: JSON.parse(row.items_json),
        totalCents: row.total_cents
      })), nextBefore: rows.results.length === 50 ? rows.results[49].id : null });
    }
    const match = path.match(/^\/api\/admin\/orders\/(\d+)$/);
    if (match && req.method === "PATCH") {
      const body = await readBody(req);
      if (!body?.status || !(body.status in statusLabels) || !body.previousStatus || !Object.hasOwn(transitions, body.previousStatus) || !transitions[body.previousStatus].includes(body.status)) return fail("Mudan\xE7a de situa\xE7\xE3o inv\xE1lida.", 400);
      const row = await env.DB.prepare("UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = ? RETURNING id").bind(body.status, Number(match[1]), body.previousStatus).first();
      return row ? json({ ok: true }) : fail("O pedido foi atualizado em outra sess\xE3o. Atualize a lista.", 409);
    }
  }
  return fail("Recurso n\xE3o encontrado.", 404);
}
__name(api, "api");
var index_default = {
  async fetch(req, env) {
    let res;
    try {
      res = new URL(req.url).pathname.startsWith("/api/") ? await api(req, env) : await env.ASSETS.fetch(req);
    } catch (error) {
      res = error instanceof ValidationError ? fail(error.message, 400) : fail("Servi\xE7o indispon\xEDvel no momento. Seu carrinho permanece salvo; tente novamente.", 503);
    }
    const headers = new Headers(res.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    if (new URL(req.url).pathname.startsWith("/admin")) headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(res.body, { status: res.status, headers });
  },
  async scheduled(_event, env) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(Date.now()),
      env.DB.prepare("DELETE FROM orders WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')")
    ]);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
