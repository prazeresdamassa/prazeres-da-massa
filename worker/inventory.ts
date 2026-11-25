import { stockCatalog, stockIssues, type StockItem } from '../shared/inventory';
import type { Cart } from '../shared/domain';
export async function unavailableStock(db: D1Database): Promise<string[]> {
  const rows=await db.prepare('SELECT key FROM inventory WHERE available = 0 ORDER BY key').all<{key:string}>();
  return rows.results.map(row=>row.key);
}
export async function inventoryList(db: D1Database): Promise<StockItem[]> {
  const unavailable=await unavailableStock(db);
  return stockCatalog.map(p=>({...p,available:!unavailable.includes(p.key)}));
}
export async function stockError(db: D1Database, cart: Cart) {
  const items=stockIssues(cart,await unavailableStock(db));
  return items.length ? `Itens esgotados: ${items.map(p=>p.name).join(', ')}. Revise seu carrinho para continuar.` : null;
}
