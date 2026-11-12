import { describe, drinks, ValidationError } from '../shared/domain';
import { managementPeriod, salesMetrics, type DailySales, type ProductSales, type ManagementReport } from '../shared/management';
import { bootstrapSql } from './analytics-bootstrap';

export async function initializeAnalytics(db: D1Database) {
  const meta = await db.prepare('SELECT initialized FROM analytics_meta WHERE id = 1').first<{ initialized: number }>();
  if (!meta?.initialized) await db.batch(bootstrapSql.map(sql => db.prepare(sql)));
}

export async function buildManagementReport(db: D1Database, period: string): Promise<ManagementReport> {
  const window = managementPeriod(period);
  await initializeAnalytics(db);
  // Um único lote mantém totais, produtos e horários no mesmo retrato do banco.
  const snapshot = await db.batch([
    db.prepare('SELECT * FROM sales_daily WHERE day >= ? AND day < ? ORDER BY day').bind(window.start, window.end),
    db.prepare('SELECT kind, product_key, SUM(quantity) as quantity FROM sales_products_daily WHERE day >= ? AND day < ? GROUP BY kind, product_key HAVING SUM(quantity) > 0 ORDER BY quantity DESC, kind, product_key').bind(window.start,window.end),
    db.prepare('SELECT hour, SUM(received) as received FROM sales_hourly WHERE day >= ? AND day < ? GROUP BY hour ORDER BY hour').bind(window.start,window.end),
    db.prepare('SELECT coverage_from FROM analytics_meta WHERE id = 1'),
  ]);
  const days = snapshot[0].results as DailySales[];
  const items = snapshot[1].results as Omit<ProductSales,'label'>[];
  const hours = snapshot[2].results as { hour: number; received: number }[];
  const meta = snapshot[3].results[0] as { coverage_from: string } | undefined;
  const products = items.map(item => {
    let label = item.product_key;
    if (item.kind === 'drink') label = drinks.find(d=>d.id===item.product_key)?.name ?? 'Bebida';
    else {
      try { const p = describe({ ...JSON.parse(item.product_key), qty: 1 }); label = `${p.name} — ${p.details}`; }
      catch { label = 'Combinação de panqueca'; }
    }
    return { ...item, label };
  });
  return { version: 1, period, ...window, generatedAt: new Date().toISOString(), coverageFrom: meta?.coverage_from ?? window.start,
    daily: days, products, hourly: hours, metrics: salesMetrics(days) };
}

export async function managementApi(req: Request, db: D1Database, body: () => Promise<unknown>): Promise<Response | null> {
  const url = new URL(req.url); const path = url.pathname;
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (path === '/api/admin/management' && req.method === 'GET') return json(await buildManagementReport(db, url.searchParams.get('period') ?? ''));
  if (path === '/api/admin/management/reports' && req.method === 'GET') {
    const result = await db.prepare('SELECT period, generated_at FROM management_reports ORDER BY generated_at DESC LIMIT 120').all();
    return json({ reports: result.results });
  }
  if (path === '/api/admin/management/reports' && req.method === 'POST') {
    const input = await body() as { period?: unknown };
    if (typeof input?.period !== 'string') throw new ValidationError('Escolha o período do relatório.');
    const report = await buildManagementReport(db, input.period);
    await db.prepare('INSERT INTO management_reports(period, generated_at, payload_json) VALUES (?, ?, ?) ON CONFLICT(period) DO UPDATE SET generated_at = excluded.generated_at, payload_json = excluded.payload_json')
      .bind(report.period, report.generatedAt, JSON.stringify(report)).run();
    return json(report, 201);
  }
  const prefix = '/api/admin/management/reports/';
  if (path.startsWith(prefix) && req.method === 'GET') {
    const period = path.slice(prefix.length); managementPeriod(period);
    const record = await db.prepare('SELECT payload_json FROM management_reports WHERE period = ?').bind(period).first<{ payload_json: string }>();
    return record ? json(JSON.parse(record.payload_json)) : json({ error: 'Relatório salvo não encontrado.' }, 404);
  }
  return null;
}
