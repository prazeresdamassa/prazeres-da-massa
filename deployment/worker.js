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
function validateLocation(value) {
  if (value === void 0 || value === null) return void 0;
  const p = record(value);
  if (typeof p.latitude !== "number" || typeof p.longitude !== "number" || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || p.latitude < -90 || p.latitude > 90 || p.longitude < -180 || p.longitude > 180) throw new ValidationError("Ponto de entrega inv\xE1lido. Marque novamente ou remova a localiza\xE7\xE3o.");
  return { latitude: Number(p.latitude.toFixed(6)), longitude: Number(p.longitude.toFixed(6)) };
}
__name(validateLocation, "validateLocation");
function locationUrl(location) {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}
__name(locationUrl, "locationUrl");
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
    ...c.location != null ? { location: validateLocation(c.location) } : {},
    name: text(c.name, "o nome", 2, 80),
    phone,
    address: text(c.address, "a rua", 2, 200),
    number: text(c.number, "o n\xFAmero", 1, 20),
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
function formatAddress(customer) {
  return customer.number ? `${customer.address}, ${customer.number}` : customer.address;
}
__name(formatAddress, "formatAddress");
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
    `Endere\xE7o: ${formatAddress(c)}`,
    `Bairro: ${c.neighborhood}`,
    `Cidade: ${SHOP.city}`,
    c.location ? `Ponto de entrega: ${locationUrl(c.location)}` : "",
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

// shared/management.ts
function managementDate(value) {
  return value.split("-").reverse().join("/");
}
__name(managementDate, "managementDate");
function nextDay(value) {
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
__name(nextDay, "nextDay");
function validDate(value) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return false;
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
__name(validDate, "validDate");
function managementPeriod(period) {
  if (typeof period !== "string") throw new ValidationError("Escolha um per\xEDodo v\xE1lido.");
  if (period.includes("_")) {
    const parts = period.split("_");
    const [start2, last] = parts;
    if (parts.length !== 2 || !validDate(start2) || !validDate(last) || last < start2) throw new ValidationError("Informe datas v\xE1lidas, com a data final igual ou posterior \xE0 inicial.");
    return { start: start2, end: nextDay(last), label: `${managementDate(start2)} a ${managementDate(last)}` };
  }
  if (validDate(period)) return { start: period, end: nextDay(period), label: managementDate(period) };
  let year, month, span;
  if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) {
    year = Number(period.slice(0, 4));
    month = Number(period.slice(5));
    span = 1;
  } else if (/^20\d{2}-Q[1-4]$/.test(period)) {
    year = Number(period.slice(0, 4));
    month = (Number(period.at(-1)) - 1) * 3 + 1;
    span = 3;
  } else throw new ValidationError("Escolha um dia, per\xEDodo, m\xEAs ou trimestre v\xE1lido.");
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month - 1 + span, 1)).toISOString().slice(0, 10);
  return { start, end, label: span === 3 ? `${period.at(-1)}\xBA trimestre de ${year}` : new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }) };
}
__name(managementPeriod, "managementPeriod");
function salesMetrics(daily) {
  const sum = /* @__PURE__ */ __name((key) => daily.reduce((n, row) => n + row[key], 0), "sum");
  const received = sum("received"), completed = sum("completed"), cancelled = sum("cancelled"), revenueCents = sum("revenue_cents");
  return { received, completed, cancelled, inProgress: received - completed - cancelled, revenueCents, averageCents: completed ? Math.round(revenueCents / completed) : 0, cancellationRate: received ? cancelled / received * 100 : 0, drinkRate: completed ? sum("drink_completed") / completed * 100 : 0, pixCompleted: sum("pix_completed"), cardCompleted: sum("card_completed") };
}
__name(salesMetrics, "salesMetrics");

// worker/analytics-bootstrap.ts
var bootstrapSql = [
  "DELETE FROM sales_daily WHERE (SELECT initialized FROM analytics_meta WHERE id = 1) = 0",
  "DELETE FROM sales_products_daily WHERE (SELECT initialized FROM analytics_meta WHERE id = 1) = 0",
  "DELETE FROM sales_hourly WHERE (SELECT initialized FROM analytics_meta WHERE id = 1) = 0",
  "INSERT INTO sales_daily(day, received, pending, accepted, preparing, dispatched, completed, cancelled, revenue_cents, drink_completed, pix_completed, card_completed) SELECT date(o.created_at, '-3 hours'), SUM(1), SUM((o.status = 'pending')), SUM((o.status = 'accepted')), SUM((o.status = 'preparing')), SUM((o.status = 'dispatched')), SUM((o.status = 'completed')), SUM((o.status = 'cancelled')), SUM(CASE WHEN o.status = 'completed' THEN o.total_cents ELSE 0 END), SUM((o.status = 'completed' AND EXISTS (SELECT 1 FROM json_each(o.items_json, '$.drinks') WHERE CAST(value AS INTEGER) > 0))), SUM((o.status = 'completed' AND json_extract(o.customer_json, '$.payment') = 'pix')), SUM((o.status = 'completed' AND json_extract(o.customer_json, '$.payment') = 'card')) FROM orders o WHERE (SELECT initialized FROM analytics_meta WHERE id = 1) = 0 GROUP BY date(o.created_at, '-3 hours')",
  "INSERT INTO sales_products_daily(day,kind,product_key,quantity) SELECT date(o.created_at, '-3 hours'), 'pancake', json_object('filling', json_extract(p.value, '$.filling'), 'dough', json_extract(p.value, '$.dough'), 'sauce', json_extract(p.value, '$.sauce'), 'extras', json(COALESCE(json_extract(p.value, '$.extras'), '[]'))), SUM(CAST(json_extract(p.value,'$.qty') AS INTEGER)) FROM orders o, json_each(o.items_json,'$.pancakes') p WHERE o.status = 'completed' AND (SELECT initialized FROM analytics_meta WHERE id = 1) = 0 GROUP BY 1,2,3",
  "INSERT INTO sales_products_daily(day,kind,product_key,quantity) SELECT date(o.created_at, '-3 hours'), 'drink', p.key, SUM(CAST(p.value AS INTEGER)) FROM orders o,json_each(o.items_json,'$.drinks') p WHERE o.status = 'completed' AND CAST(p.value AS INTEGER)>0 AND (SELECT initialized FROM analytics_meta WHERE id = 1) = 0 GROUP BY 1,2,3",
  "INSERT INTO sales_hourly(day,hour,received) SELECT date(o.created_at, '-3 hours'), CAST(strftime('%H',o.created_at,'-3 hours') AS INTEGER), COUNT(*) FROM orders o WHERE (SELECT initialized FROM analytics_meta WHERE id = 1) = 0 GROUP BY 1,2",
  "UPDATE analytics_meta SET coverage_from = COALESCE((SELECT MIN(date(o.created_at, '-3 hours')) FROM orders o), date('now','-3 hours')), initialized = 1 WHERE id = 1 AND (SELECT initialized FROM analytics_meta WHERE id = 1) = 0"
];

// worker/management.ts
async function initializeAnalytics(db) {
  const meta = await db.prepare("SELECT initialized FROM analytics_meta WHERE id = 1").first();
  if (!meta?.initialized) await db.batch(bootstrapSql.map((sql) => db.prepare(sql)));
}
__name(initializeAnalytics, "initializeAnalytics");
async function buildManagementReport(db, period) {
  const window = managementPeriod(period);
  await initializeAnalytics(db);
  const snapshot = await db.batch([
    db.prepare("SELECT * FROM sales_daily WHERE day >= ? AND day < ? ORDER BY day").bind(window.start, window.end),
    db.prepare("SELECT kind, product_key, SUM(quantity) as quantity FROM sales_products_daily WHERE day >= ? AND day < ? GROUP BY kind, product_key HAVING SUM(quantity) > 0 ORDER BY quantity DESC, kind, product_key").bind(window.start, window.end),
    db.prepare("SELECT hour, SUM(received) as received FROM sales_hourly WHERE day >= ? AND day < ? GROUP BY hour ORDER BY hour").bind(window.start, window.end),
    db.prepare("SELECT coverage_from FROM analytics_meta WHERE id = 1")
  ]);
  const days = snapshot[0].results;
  const items = snapshot[1].results;
  const hours = snapshot[2].results;
  const meta = snapshot[3].results[0];
  const products = items.map((item) => {
    let label = item.product_key;
    if (item.kind === "drink") label = drinks.find((d) => d.id === item.product_key)?.name ?? "Bebida";
    else {
      try {
        const p = describe({ ...JSON.parse(item.product_key), qty: 1 });
        label = `${p.name} \u2014 ${p.details}`;
      } catch {
        label = "Combina\xE7\xE3o de panqueca";
      }
    }
    return { ...item, label };
  });
  return {
    version: 1,
    period,
    ...window,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    coverageFrom: meta?.coverage_from ?? window.start,
    daily: days,
    products,
    hourly: hours,
    metrics: salesMetrics(days)
  };
}
__name(buildManagementReport, "buildManagementReport");
async function managementApi(req, db, body) {
  const url = new URL(req.url);
  const path = url.pathname;
  const json2 = /* @__PURE__ */ __name((value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }), "json");
  if (path === "/api/admin/management" && req.method === "GET") return json2(await buildManagementReport(db, url.searchParams.get("period") ?? ""));
  if (path === "/api/admin/management/reports" && req.method === "GET") {
    const result = await db.prepare("SELECT period, generated_at FROM management_reports ORDER BY generated_at DESC LIMIT 120").all();
    return json2({ reports: result.results });
  }
  if (path === "/api/admin/management/reports" && req.method === "POST") {
    const input = await body();
    if (typeof input?.period !== "string") throw new ValidationError("Escolha o per\xEDodo do relat\xF3rio.");
    const report = await buildManagementReport(db, input.period);
    await db.prepare("INSERT INTO management_reports(period, generated_at, payload_json) VALUES (?, ?, ?) ON CONFLICT(period) DO UPDATE SET generated_at = excluded.generated_at, payload_json = excluded.payload_json").bind(report.period, report.generatedAt, JSON.stringify(report)).run();
    return json2(report, 201);
  }
  const prefix = "/api/admin/management/reports/";
  if (path.startsWith(prefix) && req.method === "GET") {
    const period = path.slice(prefix.length);
    managementPeriod(period);
    const record2 = await db.prepare("SELECT payload_json FROM management_reports WHERE period = ?").bind(period).first();
    return record2 ? json2(JSON.parse(record2.payload_json)) : json2({ error: "Relat\xF3rio salvo n\xE3o encontrado." }, 404);
  }
  return null;
}
__name(managementApi, "managementApi");

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
    payment: order.customer.payment,
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
    if (path.startsWith("/api/admin/management")) {
      const response = await managementApi(req, env.DB, () => readBody(req));
      if (response) return response;
    }
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
    if (path === "/api/admin/orders/latest" && req.method === "GET") {
      const row = await env.DB.prepare("SELECT id FROM orders ORDER BY id DESC LIMIT 1").first();
      return json({ latestId: row?.id ?? 0 });
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
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    if (new URL(req.url).pathname.startsWith("/admin")) headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(res.body, { status: res.status, headers });
  },
  async scheduled(_event, env) {
    await initializeAnalytics(env.DB);
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
