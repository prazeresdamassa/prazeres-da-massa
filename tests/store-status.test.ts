import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoreStatus } from '../src/StoreStatus';

test('disponibilidade diferencia aberto, fechado, consulta e falha sem anunciar estado incorreto', () => {
  const open=renderToStaticMarkup(createElement(StoreStatus,{open:true,error:false}));
  const closed=renderToStaticMarkup(createElement(StoreStatus,{open:false,error:false}));
  assert.match(open,/Estamos abertos/);assert.match(open,/store-status--open/);
  assert.match(closed,/Estamos fechados/);assert.match(closed,/store-status--closed/);
  for (const props of [{error:false},{open:true,error:true}]) {
    const html=renderToStaticMarkup(createElement(StoreStatus,props));
    assert.doesNotMatch(html,/Estamos abertos|Estamos fechados/);
    assert.match(html,props.error?/Atendimento indisponível/:/Consultando atendimento/);
  }
  for (const html of [open,closed]) {assert.match(html,/role="status"/);assert.match(html,/<svg/);}
});
