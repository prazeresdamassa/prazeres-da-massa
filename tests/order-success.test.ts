import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderSuccess } from '../src/OrderSuccess';
import type { Receipt } from '../shared/domain';

const receipt: Receipt = { id: 1, label: '#00001', totalCents: 2199, status: 'pending', createdAt: '2026-11-10T12:00:00Z', whatsappUrl: 'https://wa.me/5598999999999?text=teste' };
test('teste conclui no painel sem oferecer link para enviar pedido no WhatsApp', () => {
  const html = renderToStaticMarkup(createElement(OrderSuccess, { receipt, panelOnly: true }));
  assert.match(html, /Seu pedido foi concluído e recebido!/);
  assert.match(html, /Aguarde a confirmação pelo WhatsApp/);
  assert.match(html, /#00001/);
  assert.doesNotMatch(html, /wa\.me|href=|Abrir pedido/);
});
test('fluxo normal preserva a mensagem preparada de envio do pedido', () => {
  const html = renderToStaticMarkup(createElement(OrderSuccess, { receipt, panelOnly: false }));
  assert.match(html, /Abrir pedido no WhatsApp/);
  assert.match(html, /wa\.me/);
});
