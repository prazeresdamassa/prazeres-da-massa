import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export class LocalDB {
  sqlite = new DatabaseSync(':memory:');
  constructor(legacy = false) { for (const name of (legacy ? ['0001_orders.sql','0002_shop_settings.sql'] : ['0001_orders.sql','0002_shop_settings.sql','0003_management.sql'])) this.sqlite.exec(readFileSync(new URL('../migrations/'+name, import.meta.url), 'utf8')); this.sqlite.exec('UPDATE shop_settings SET accepting_orders = 1'); }
  prepare(sql: string) {
    const query = this.sqlite.prepare(sql); let values: (string | number | null)[] = [];
    const statement = {
      bind(...args: (string | number | null)[]) { values = args; return statement; },
      async first() { return query.get(...values) ?? null; },
      async all() { return { results: query.all(...values) }; },
      async run() { return query.columns().length ? { results: query.all(...values) } : query.run(...values); },
    }; return statement;
  }
  async batch(statements: { run(): Promise<unknown> }[]) { this.sqlite.exec('BEGIN'); try { const rows = await Promise.all(statements.map(s => s.run())); this.sqlite.exec('COMMIT'); return rows; } catch (e) { this.sqlite.exec('ROLLBACK'); throw e; } }
}
