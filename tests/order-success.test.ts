import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderSuccess } from '../src/OrderSuccess';
import { SHOP, type Receipt } from '../shared/domain';

const receipt: Receipt = { payment: 'card', id: 1, label: '#00001', totalCents: 2199, status: 'pending', createdAt: '2026-11-10T12:00:00Z', whatsappUrl: 'https://wa.me/5598999999999?text=teste' };
test('produção conclui no painel sem oferecer link para enviar pedido no WhatsApp', () => {
  const html = renderToStaticMarkup(createElement(OrderSuccess, { receipt }));
  assert.match(html, /Seu pedido foi concluído e recebido!/);
  assert.match(html, /Aguarde a confirmação pelo WhatsApp/);
  assert.match(html, /#00001/);
  assert.doesNotMatch(html, /wa\.me|href=|Abrir pedido/);
});

test('confirmação Pix exibe chave copiável e cartão não exibe Pix', () => {
  const pix = renderToStaticMarkup(createElement(OrderSuccess, { receipt: { ...receipt, payment: 'pix' } }));
  assert.ok(pix.includes(SHOP.pix)); assert.ok(pix.includes(SHOP.pixOwner));
  assert.match(pix,/Copiar chave/); assert.match(pix,/Aguarde a confirmação da loja antes de pagar/);
  assert.doesNotMatch(pix,/Pagamento confirmado|wa\.me|href=/);
  const card = renderToStaticMarkup(createElement(OrderSuccess,{receipt}));
  assert.ok(!card.includes(SHOP.pix)); assert.doesNotMatch(card,/Copiar chave/);
});
