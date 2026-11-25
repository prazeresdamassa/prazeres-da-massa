import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP, type Cart, type Customer } from '../shared/domain';
import { preparedStatusMessage } from '../shared/customer-messages';

const base = { cart: { pancakes: [{ filling: 'frango', dough: 'verde', sauce: 'tomate', extras: ['queijo'], qty: 2 }], drinks: { coca: 1 } } as Cart, totalCents: 1800, customer: { name: 'Ana', phone: '(98) 99999-9999', address: 'Rua Teste', number: '42', neighborhood: 'Centro', reference: 'Portão azul', notes: 'Sem orégano', payment: 'pix', privacy: true } as Customer };

test('cada etapa prepara a mensagem solicitada e preserva emojis, negrito e quebras no link do cliente', () => {
  const order = { ...base, id: 43 };
  const phrases = { accepted: 'confirmado.', preparing: 'Pedido em Preparação', dispatched: 'Pedido em Rota de Entrega', completed: 'Pedido Entregue' };
  for (const status of ['accepted','preparing','dispatched','completed'] as const) {
    const message = preparedStatusMessage(order, status)!;
    const url = new URL(message.url);
    assert.equal(url.pathname, '/5598999999999');
    assert.equal(url.searchParams.get('text'), message.text);
    assert.ok(message.text.includes(phrases[status]));
    if (status === 'accepted') { assert.match(message.text, /Olá, Ana!/); assert.match(message.text, /#00043/); }
    else { assert.ok(message.text.startsWith('🥞 *PRAZERES DA MASSA |'));assert.doesNotMatch(message.text,/\(em negrito\)|Olá, Ana|#00043/); }
  }
  const preparing = preparedStatusMessage(order,'preparing')!.text;
  assert.ok(preparing.includes('✅ *Seu pedido já está sendo preparado!*'));
  assert.ok(preparing.includes('⏰ *Tempo estimado de preparo: 30 a 40 minutos.*'));
  assert.ok(preparing.endsWith('🛵 Avisaremos assim que seu pedido sair para entrega.'));
  const dispatched = preparedStatusMessage(order,'dispatched')!.text;
  assert.ok(dispatched.includes('🛵 *Seu pedido saiu para entrega e está a caminho!*'));
  assert.ok(dispatched.endsWith('📲 Por favor, mantenha seu telefone disponível para facilitar o recebimento.'));
  const completed = preparedStatusMessage(order,'completed')!.text;
  for (const expected of ['❤️ Agradecemos pela sua preferência!','⭐ *Sua opinião é importante!* Conte-nos como foi sua experiência com nossos produtos.','📲 *Acompanhe nossas novidades e promoções:*','📸 Instagram: *@prazeresdamassachap*\n📱 Status do WhatsApp','Será um prazer atender você novamente!']) assert.ok(completed.includes(expected));
  assert.ok(completed.endsWith('❤️ *Prazeres da Massa*\n*Massas Artesanais*'));
});

test('não duplica DDI, preserva DDD 55 e não prepara status não solicitados ou telefone inválido', () => {
  const order = { ...base, id: 1, customer: { ...base.customer, name: 'Teste', phone: '+55 (98) 99999-9999' } };
  assert.ok(preparedStatusMessage(order, 'accepted')!.url.startsWith('https://wa.me/5598999999999?'));
  assert.ok(preparedStatusMessage({ ...order, customer: { ...order.customer, phone: '55999999999' } }, 'accepted')!.url.startsWith('https://wa.me/5555999999999?'));
  assert.equal(preparedStatusMessage(order, 'cancelled'), null);
  assert.equal(preparedStatusMessage(order, 'pending'), null);
  assert.equal(preparedStatusMessage({ ...order, customer: { ...order.customer, phone: '123' } }, 'accepted'), null);
});

test('confirmação inclui resumo completo e total histórico; outras etapas usam os modelos de atualização', () => {
  const order = { ...base, id: 43 };
  const text = preparedStatusMessage(order, 'accepted')!.text;
  for (const expected of ['Resumo do pedido','2× Frango cremoso','Verde','Tomate especial','Queijo mussarela','1× Coca-Cola tradicional','18,00','Forma de pagamento: Pix','Rua Teste, 42','Centro','Portão azul','Sem orégano']) assert.ok(text.includes(expected), expected);
  assert.doesNotMatch(text, /27,99/);
  for (const status of ['preparing','dispatched','completed'] as const) {
    const short = preparedStatusMessage(order, status)!.text;
    assert.doesNotMatch(short, /Resumo do pedido|Rua Teste|Sem orégano|18,00/);

  }
});

test('confirmação ao cliente inclui chave Pix e titular somente no Pix', () => {
  const pix=preparedStatusMessage({...base,id:43},'accepted')!;
  assert.ok(pix.text.includes(SHOP.pix));assert.ok(pix.text.includes(SHOP.pixOwner));
  assert.match(pix.text,/Pagamento sujeito à conferência/);
  const card=preparedStatusMessage({...base,id:43,customer:{...base.customer,payment:'card'}},'accepted')!;
  assert.ok(!card.text.includes(SHOP.pix));
  for (const status of ['preparing','dispatched','completed'] as const) assert.ok(!preparedStatusMessage({...base,id:43},status)!.text.includes(SHOP.pix));
});
