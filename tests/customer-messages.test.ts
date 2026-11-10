import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Cart, Customer } from '../shared/domain';
import { preparedStatusMessage } from '../shared/customer-messages';

const base = { cart: { pancakes: [{ filling: 'frango', dough: 'verde', sauce: 'tomate', extras: ['queijo'], qty: 2 }], drinks: { coca: 1 } } as Cart, totalCents: 1800, customer: { name: 'Ana', phone: '(98) 99999-9999', address: 'Rua Teste', number: '42', neighborhood: 'Centro', reference: 'Portão azul', notes: 'Sem orégano', payment: 'pix', privacy: true } as Customer };

test('cada etapa prepara uma mensagem objetiva para o número do cliente', () => {
  const order = { ...base, id: 43 };
  for (const [status, phrase] of Object.entries({ accepted: 'confirmado.', preparing: 'está em preparo.', dispatched: 'saiu para entrega.', completed: 'concluído.' }) as [ 'accepted'|'preparing'|'dispatched'|'completed', string][]) {
    const message = preparedStatusMessage(order, status)!;
    const url = new URL(message.url);
    assert.equal(url.pathname, '/5598999999999');
    assert.equal(url.searchParams.get('text'), message.text);
    assert.match(message.text, /Olá, Ana!/); assert.match(message.text, /#00043/);
    assert.ok(message.text.includes(phrase)); assert.match(message.text, /Prazeres da Massa/);
  }
});

test('não duplica DDI, preserva DDD 55 e não prepara status não solicitados ou telefone inválido', () => {
  const order = { ...base, id: 1, customer: { ...base.customer, name: 'Teste', phone: '+55 (98) 99999-9999' } };
  assert.ok(preparedStatusMessage(order, 'accepted')!.url.startsWith('https://wa.me/5598999999999?'));
  assert.ok(preparedStatusMessage({ ...order, customer: { ...order.customer, phone: '55999999999' } }, 'accepted')!.url.startsWith('https://wa.me/5555999999999?'));
  assert.equal(preparedStatusMessage(order, 'cancelled'), null);
  assert.equal(preparedStatusMessage(order, 'pending'), null);
  assert.equal(preparedStatusMessage({ ...order, customer: { ...order.customer, phone: '123' } }, 'accepted'), null);
});

test('confirmação inclui resumo completo e total histórico; outras etapas continuam objetivas', () => {
  const order = { ...base, id: 43 };
  const text = preparedStatusMessage(order, 'accepted')!.text;
  for (const expected of ['Resumo do pedido','2× Frango cremoso','Verde','Tomate especial','Queijo mussarela','1× Coca-Cola tradicional','18,00','Forma de pagamento: Pix','Rua Teste, 42','Centro','Portão azul','Sem orégano']) assert.ok(text.includes(expected), expected);
  assert.doesNotMatch(text, /27,99/);
  for (const status of ['preparing','dispatched','completed'] as const) {
    const short = preparedStatusMessage(order, status)!.text;
    assert.doesNotMatch(short, /Resumo do pedido|Rua Teste|Sem orégano|18,00/);
    assert.match(short, /#00043/);
  }
});
