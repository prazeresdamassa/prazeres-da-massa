export const SHOP = {
  name: 'Prazeres da Massa', whatsapp: '5598981997360',
  pix: '98982878794', pixOwner: 'Romilly Sousa Prazeres',
  city: 'Chapadinha–MA', timezone: 'America/Fortaleza',
};
export const fillings = [
  { id: 'frango', name: 'Frango cremoso', description: 'Frango desfiado com nosso tempero especial', icon: '🍗' },
  { id: 'carne', name: 'Carne moída especial', description: 'Carne refogada, bem temperadinha', icon: '🥩' },
] as const;
export const doughs = [
  { id: 'tradicional', name: 'Tradicional', description: 'Leve e douradinha', icon: '🥞' },
  { id: 'verde', name: 'Verde', description: 'Com couve-folha', icon: '🌿' },
] as const;
export const sauces = [
  { id: 'tomate', name: 'Tomate especial', description: 'Artesanal e temperado', icon: '🍅' },
  { id: 'batata', name: 'Batata especial', description: 'Cremoso e aveludado', icon: '🥔' },
  { id: 'sem', name: 'Sem molho', description: 'Do seu jeitinho', icon: '✨' },
] as const;
export const extras = [
  { id: 'oregano', name: 'Orégano' }, { id: 'queijo', name: 'Queijo mussarela' },
] as const;
export const drinks = [
  { id: 'coca', name: 'Coca-Cola tradicional', cents: 600 },
  { id: 'coca-zero', name: 'Coca-Cola zero', cents: 699 },
] as const;
export const prices = { pair: 2199, single: 1299 };
// 0 = domingo; intervalos incluem abertura e excluem fechamento.
export const hours: Record<number, [number, number] | null> = {
  0: [18, 22], 1: null, 2: null, 3: [19, 23], 4: [18, 22], 5: [19, 23], 6: [18, 22],
};
export const statusLabels = {
  pending: 'Aguardando confirmação', accepted: 'Confirmado', preparing: 'Em preparo',
  dispatched: 'Saiu para entrega', completed: 'Concluído', cancelled: 'Cancelado',
} as const;
export type OrderStatus = keyof typeof statusLabels;
export type Pancake = { filling: string; dough: string; sauce: string; extras: string[]; qty: number };
export type Cart = { pancakes: Pancake[]; drinks: Record<string, number> };
export type Customer = { name: string; phone: string; address: string; neighborhood: string; reference: string; notes: string; payment: 'pix' | 'card'; privacy: boolean };
export type OrderInput = { cart: Cart; customer: Customer };
export type Receipt = { id: number; label: string; totalCents: number; status: OrderStatus; whatsappUrl: string; createdAt: string };
export const emptyCart = (): Cart => ({ pancakes: [], drinks: {} });
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export class ValidationError extends Error {}
export function shopStatus(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: SHOP.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday'));
  const schedule = hours[day];
  const minute = Number(get('hour')) * 60 + Number(get('minute'));
  return { open: !!schedule && minute >= schedule[0] * 60 && minute < schedule[1] * 60,
    today: schedule ? `${schedule[0]}h às ${schedule[1]}h` : 'Fechado hoje', timezone: SHOP.timezone };
}
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ValidationError('Dados do pedido inválidos.');
  return v as Record<string, unknown>;
}
function text(v: unknown, label: string, min: number, max: number) {
  if (typeof v !== 'string') throw new ValidationError(`Verifique ${label}.`);
  const s = v.trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
  if (s.length < min || s.length > max) throw new ValidationError(`${label}: use entre ${min} e ${max} caracteres.`);
  return s;
}
function option(v: unknown, list: readonly { id: string }[]) {
  if (typeof v !== 'string' || !list.some(x => x.id === v)) throw new ValidationError('Uma opção do cardápio é inválida. Atualize a página.');
  return v;
}
function quantity(v: unknown, min = 0) {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > 99) throw new ValidationError('Quantidade inválida (máximo de 99).');
  return v;
}
export function validateCart(value: unknown): Cart {
  const v = record(value);
  if (!Array.isArray(v.pancakes) || v.pancakes.length > 30) throw new ValidationError('Carrinho inválido.');
  const pancakes = v.pancakes.map(item => {
    const p = record(item);
    if (!Array.isArray(p.extras) || p.extras.length > 2) throw new ValidationError('Adicionais inválidos.');
    const selected = p.extras.map(x => option(x, extras));
    if (new Set(selected).size !== selected.length) throw new ValidationError('Adicionais repetidos.');
    return { filling: option(p.filling, fillings), dough: option(p.dough, doughs), sauce: option(p.sauce, sauces), extras: selected.sort(), qty: quantity(p.qty, 1) };
  });
  if (pancakes.reduce((n, p) => n + p.qty, 0) > 99) throw new ValidationError('O limite é de 99 panquecas por pedido.');
  const quantities = record(v.drinks);
  const result: Record<string, number> = {};
  for (const [key, qty] of Object.entries(quantities)) result[option(key, drinks)] = quantity(qty);
  return { pancakes, drinks: result };
}
export function validateOrder(value: unknown): OrderInput {
  const v = record(value); const cart = validateCart(v.cart); const c = record(v.customer);
  if (!cart.pancakes.length) throw new ValidationError('Adicione pelo menos uma panqueca.');
  const phone = text(c.phone, 'o WhatsApp', 10, 22).replace(/\D/g, '');
  if (!/^\d{10,11}$/.test(phone)) throw new ValidationError('Informe seu WhatsApp com DDD (10 ou 11 dígitos).');
  if (c.payment !== 'pix' && c.payment !== 'card') throw new ValidationError('Escolha a forma de pagamento.');
  if (c.privacy !== true) throw new ValidationError('Confirme a leitura do aviso de privacidade.');
  return { cart, customer: { name: text(c.name, 'o nome', 2, 80), phone,
    address: text(c.address, 'o endereço', 5, 200), neighborhood: text(c.neighborhood, 'o bairro', 2, 80),
    reference: text(c.reference, 'a referência', 0, 200), notes: text(c.notes, 'as observações', 0, 500),
    payment: c.payment, privacy: true } };
}
export function totals(cart: Cart) {
  const count = cart.pancakes.reduce((n, p) => n + p.qty, 0);
  const pancakeCents = Math.floor(count / 2) * prices.pair + count % 2 * prices.single;
  const drinkCents = drinks.reduce((n, d) => n + (cart.drinks[d.id] ?? 0) * d.cents, 0);
  return { count, pancakeCents, drinkCents, totalCents: pancakeCents + drinkCents, savings: count * prices.single - pancakeCents };
}
export function describe(p: Pancake) {
  return { name: fillings.find(x => x.id === p.filling)!.name,
    details: [(doughs.find(x => x.id === p.dough)?.name ?? (p.dough === 'vermelha' ? 'Vermelha (beterraba — item descontinuado)' : p.dough)), sauces.find(x => x.id === p.sauce)!.name,
      ...p.extras.map(id => extras.find(x => x.id === id)!.name)].join(' · ') };
}
export function whatsappMessage(id: number, order: OrderInput, createdAt: string, savedTotalCents = totals(order.cart).totalCents) {
  const label = `#${String(id).padStart(5, '0')}`;
  const c = order.customer; const t = totals(order.cart);
  const lines = [`🥞 *PRAZERES DA MASSA — ${label}*`, 'Pedido registrado; aguardando confirmação da loja.',
    new Date(createdAt).toLocaleString('pt-BR', { timeZone: SHOP.timezone }), '',
    `Nome: ${c.name}`, `WhatsApp: ${c.phone}`, `Endereço: ${c.address}`, `Bairro: ${c.neighborhood}`, `Cidade: ${SHOP.city}`,
    c.reference ? `Referência: ${c.reference}` : '', '', '*Seu pedido*',
    ...order.cart.pancakes.map(p => `${p.qty}× ${describe(p).name}\n${describe(p).details}`),
    ...drinks.filter(d => order.cart.drinks[d.id]).map(d => `${order.cart.drinks[d.id]}× ${d.name}`), '',
    `Total: ${money(savedTotalCents)}`, 'Entrega grátis, sujeita à área de atendimento.',
    `Pagamento: ${c.payment === 'pix' ? 'Pix' : 'Cartão (crédito/débito por aproximação)'}`,
    c.payment === 'pix' ? `Chave Pix (celular): ${SHOP.pix}\nTitular: ${SHOP.pixOwner}` : '',
    c.notes ? `Observações: ${c.notes}` : '', 'Por favor, confirme a disponibilidade e a entrega.'];
  return `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(lines.filter(x => x !== '').join('\n'))}`;
}
