import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Cart, Customer, OrderStatus } from '../shared/domain';
import { preparedCourierMessage, COURIER_PHONE } from '../shared/courier-message';

const order = {
  id: 43, status: 'dispatched' as OrderStatus, totalCents: 1800,
  cart: { pancakes: [{ filling: 'frango', dough: 'verde', sauce: 'tomate', extras: ['queijo'], qty: 2 }], drinks: { coca: 1 } } as Cart,
  customer: { name: 'Ana & João', phone: '(98) 99999-9999', address: 'Rua Teste', number: '42-B', neighborhood: 'Centro', reference: 'Portão azul', notes: 'Sem orégano\nInterfone #2', payment: 'pix', privacy: true } as Customer,
};

test('motoboy recebe mensagem completa no número autorizado, com total histórico e localização opcional', () => {
  const withLocation = { ...order, customer: { ...order.customer, location: { latitude: -3.739373, longitude: -43.365434 } } };
  const message = preparedCourierMessage(withLocation)!;
  const url = new URL(message.url);
  assert.equal(COURIER_PHONE, '5598981667883');
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/5598981667883');
  assert.equal(url.searchParams.get('text'), message.text);
  for (const expected of ['#00043', 'Saiu para entrega', 'Ana & João', '(98) 99999-9999', 'Rua Teste, 42-B', 'Centro', 'Portão azul', '2× Frango cremoso', 'Queijo mussarela', '1× Coca-Cola tradicional', '18,00', 'Pagamento informado: Pix', 'Sem orégano\nInterfone #2', '-3.739373', '-43.365434']) assert.ok(message.text.includes(expected), expected);
  assert.match(message.text, /Confira com a loja se há valor a cobrar/);
  assert.doesNotMatch(message.text, /Pagamento confirmado|Pedido pago|27,99/);
});

test('envio ao motoboy é restrito a pedidos que saíram para entrega', () => {
  for (const status of ['pending', 'accepted', 'preparing', 'completed', 'cancelled'] as OrderStatus[]) assert.equal(preparedCourierMessage({ ...order, status }), null);
  assert.ok(preparedCourierMessage(order));
});

test('mensagem suporta entrega sem GPS e campos opcionais, bebida avulsa e cartão', () => {
  const message = preparedCourierMessage({ ...order, cart: { pancakes: [], drinks: { coca: 2 } } as Cart, customer: { ...order.customer, payment: 'card', reference: '', notes: '' } })!;
  assert.match(message.text, /2× Coca-Cola tradicional/);
  assert.match(message.text, /Pagamento informado: Cartão por aproximação/);
  assert.doesNotMatch(message.text, /Localização:|Referência:|Observações:|undefined/);
});
