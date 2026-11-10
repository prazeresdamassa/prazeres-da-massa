export type OrderPage<T> = { orders: T[]; nextBefore: number | null };

// Busca por cursor: não perde pedidos quando chegam mais de 50 entre verificações.
export async function readNewOrders<T extends { id: number }>(latestSeen: number, fetchPage: (before?: number) => Promise<OrderPage<T>>) {
  const collected = new Map<number, T>();
  let before: number | undefined;
  while (true) {
    const page = await fetchPage(before);
    for (const row of page.orders) if (row.id > latestSeen) collected.set(row.id, row);
    const oldest = page.orders.at(-1)?.id;
    if (oldest === undefined || oldest <= latestSeen || page.nextBefore === null) break;
    if (before !== undefined && page.nextBefore >= before) throw new Error('Cursor de pedidos inválido.');
    before = page.nextBefore;
  }
  return [...collected.values()].sort((a, b) => b.id - a.id);
}

export function includeNewOrders<T extends { id: number }>(previous: T[], incoming: T[]): T[] {
  if (!incoming.length) return previous;
  const rows = new Map(previous.map(row => [row.id, row]));
  for (const row of incoming) rows.set(row.id, row);
  return [...rows.values()].sort((a, b) => b.id - a.id);
}
