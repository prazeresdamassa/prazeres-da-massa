import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparedStatusMessage } from '../shared/customer-messages';

test('cada etapa prepara uma mensagem objetiva para o número do cliente', () => {
  const order = { id: 43, customer: { name: 'Ana', phone: '(98) 99999-9999' } };
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
  const order = { id: 1, customer: { name: 'Teste', phone: '+55 (98) 99999-9999' } };
  assert.ok(preparedStatusMessage(order, 'accepted')!.url.startsWith('https://wa.me/5598999999999?'));
  assert.ok(preparedStatusMessage({ ...order, customer: { ...order.customer, phone: '55999999999' } }, 'accepted')!.url.startsWith('https://wa.me/5555999999999?'));
  assert.equal(preparedStatusMessage(order, 'cancelled'), null);
  assert.equal(preparedStatusMessage(order, 'pending'), null);
  assert.equal(preparedStatusMessage({ ...order, customer: { ...order.customer, phone: '123' } }, 'accepted'), null);
});
