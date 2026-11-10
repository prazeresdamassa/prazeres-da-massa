import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shopStatus, totals, validateCart, validateOrder, whatsappMessage, type OrderInput } from '../shared/domain';
const cart = { pancakes: [{ filling: 'frango', dough: 'tradicional', sauce: 'tomate', extras: ['queijo'], qty: 3 }], drinks: { coca: 1, 'coca-zero': 1 } };
export const valid: OrderInput = { cart, customer: { name: 'Cliente Teste', phone: '(98) 99999-9999', address: 'Rua de Teste', number: '10', neighborhood: 'Centro', reference: '', notes: '', payment: 'pix', privacy: true } };
test('promoção combina sabores e usa centavos inteiros', () => {
  assert.deepEqual(totals(cart), { count: 3, pancakeCents: 3498, drinkCents: 1299, totalCents: 4797, savings: 399 });
  assert.equal(totals({ pancakes: [{ ...cart.pancakes[0], qty: 1 }, { ...cart.pancakes[0], filling: 'carne', qty: 1 }], drinks: {} }).totalCents, 2199);
});
test('todos os dias e limites exatos usam o horário de Chapadinha', () => {
  // 2026-11-09 segunda; UTC = hora local + 3.
  const cases: [string, boolean][] = [
    ['2026-11-09T22:00:00Z',false], ['2026-11-10T22:00:00Z',false],
    ['2026-11-11T21:59:59Z',false], ['2026-11-11T22:00:00Z',true],
    ['2026-11-12T01:59:59Z',true], ['2026-11-12T02:00:00Z',false],
    ['2026-11-12T20:59:59Z',false], ['2026-11-12T21:00:00Z',true],
    ['2026-11-13T00:59:59Z',true], ['2026-11-13T01:00:00Z',false],
    ['2026-11-13T22:00:00Z',true], ['2026-11-14T02:00:00Z',false],
    ['2026-11-14T21:00:00Z',true], ['2026-11-15T01:00:00Z',false],
    ['2026-11-15T21:00:00Z',true], ['2026-11-16T01:00:00Z',false],
  ];
  for (const [date, open] of cases) assert.equal(shopStatus(new Date(date)).open, open, date);
});
test('valida cliente e ignora valores de preço enviados pelo cliente', () => {
  const result = validateOrder({ ...valid, totalCents: 1, cart: { ...cart, price: 1 } });
  assert.equal(result.customer.phone, '98999999999');
  assert.equal(totals(result.cart).totalCents, 4797);
});
test('rejeita opções desconhecidas, adicionais repetidos e quantidades abusivas', () => {
  for (const pancake of [{ ...cart.pancakes[0], filling: 'falso' }, { ...cart.pancakes[0], qty: -1 }, { ...cart.pancakes[0], qty: 1.5 }, { ...cart.pancakes[0], qty: 100 }, { ...cart.pancakes[0], extras: ['queijo','queijo'] }]) {
    assert.throws(() => validateCart({ pancakes: [pancake], drinks: {} }));
  }
  assert.throws(() => validateCart({ pancakes: [], drinks: { falso: 1 } }));
  assert.throws(() => validateOrder({ ...valid, customer: { ...valid.customer, privacy: false } }));
  assert.throws(() => validateOrder({ ...valid, customer: { ...valid.customer, phone: '123' } }));
  assert.throws(() => validateOrder({ ...valid, cart: { pancakes: [], drinks: { coca: 1 } } }));
});
test('mensagem não declara confirmação nem pagamento automático', () => {
  const text = decodeURIComponent(whatsappMessage(42, validateOrder(valid), '2026-11-12T22:00:00Z'));
  assert.match(text, /#00042/); assert.match(text, /aguardando confirmação/);
  assert.match(text, /47,97/); assert.match(text, /Romilly Sousa Prazeres/);
});

test('número é obrigatório para novos pedidos e aparece na mensagem', () => {
  assert.throws(() => validateOrder({ ...valid, customer: { ...valid.customer, number: '' } }));
  const order = validateOrder({ ...valid, customer: { ...valid.customer, number: '123-B' } });
  assert.match(decodeURIComponent(whatsappMessage(1, order, '2026-11-12T22:00:00Z')), /Rua de Teste, 123-B/);
  assert.equal(validateOrder({ ...valid, customer: { ...valid.customer, number: 'S\/N' } }).customer.number, 'S/N');
});
