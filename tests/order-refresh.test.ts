import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNewOrders, includeNewOrders } from '../shared/order-refresh';

test('busca todos os pedidos novos além de uma página, sem trazer histórico desnecessário', async () => {
  const rows = Array.from({ length: 120 }, (_, i) => ({ id: 120 - i }));
  const cursors: (number | undefined)[] = [];
  const fresh = await readNewOrders(10, async before => {
    cursors.push(before);
    const matching = rows.filter(row => before === undefined || row.id < before);
    const orders = matching.slice(0, 50);
    return { orders, nextBefore: orders.length === 50 ? orders[49].id : null };
  });
  assert.equal(fresh.length, 110); assert.equal(fresh[0].id, 120); assert.equal(fresh.at(-1)!.id, 11);
  assert.deepEqual(cursors, [undefined, 71, 21]);
});

test('inclusão de novos pedidos mantém registros antigos e referências, sem duplicar', () => {
  const older = { id: 1, status: 'preparing' };
  const previous = [{ id: 2, status: 'pending' }, older];
  const incoming = [{ id: 3, status: 'pending' }, { id: 3, status: 'pending' }];
  const combined = includeNewOrders(previous, incoming);
  assert.deepEqual(combined.map(row => row.id), [3, 2, 1]);
  assert.equal(combined[2], older);
  assert.equal(includeNewOrders(previous, []), previous);
});
