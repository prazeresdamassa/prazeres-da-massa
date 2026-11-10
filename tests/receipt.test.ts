import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintReceipt, type PrintableOrder } from '../src/PrintReceipt';
import { describe, validateCart } from '../shared/domain';

test('massa retirada é rejeitada em novos pedidos e continua legível no histórico', () => {
  const old = { filling: 'frango', dough: 'vermelha', sauce: 'tomate', extras: [], qty: 1 };
  assert.throws(() => validateCart({ pancakes: [old], drinks: {} }));
  assert.match(describe(old).details, /beterraba.*descontinuado/);
});

test('cupom mostra total histórico, observações, complementos e escapa dados do cliente', () => {
  const order: PrintableOrder = { id: 43, createdAt: '2026-11-12T22:00:00Z', status: 'accepted', totalCents: 1800,
    cart: { pancakes: [{ filling: 'frango', dough: 'vermelha', sauce: 'tomate', extras: ['queijo'], qty: 1 }], drinks: { coca: 2 } },
    customer: { name: '<script>Teste</script>', phone: '98999999999', address: 'Rua Teste, 42', neighborhood: 'Centro', reference: 'Portão azul', notes: 'Sem orégano', payment: 'pix', privacy: true } };
  const html = renderToStaticMarkup(createElement(PrintReceipt, { order }));
  assert.match(html, /#00043/); assert.match(html, /18,00/); assert.doesNotMatch(html, /24,99/);
  assert.match(html, /Sem orégano/); assert.match(html, /Portão azul/); assert.match(html, /2 × Coca-Cola/);
  assert.match(html, /Queijo mussarela/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  assert.match(html, /não é documento fiscal/);
});
