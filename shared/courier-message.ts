import { SHOP, describe, drinks, money, formatAddress, locationUrl, type Cart, type Customer, type OrderStatus } from './domain';

export const COURIER_PHONE = '5598981667883';
export const COURIER_PHONE_LABEL = '(98) 98166-7883';

// Disponível somente depois que a loja salva o status Saiu para entrega.
export function preparedCourierMessage(order: { id: number; status: OrderStatus; customer: Customer; cart: Cart; totalCents: number }) {
  if (order.status !== 'dispatched') return null;
  const customer = order.customer;
  const lines = [
    `*${SHOP.name} — Entrega*`,
    `Pedido #${String(order.id).padStart(5, '0')} — Saiu para entrega`,
    '',
    `Cliente: ${customer.name}`,
    `Telefone: ${customer.phone}`,
    `Endereço: ${formatAddress(customer)} — ${customer.neighborhood}, ${SHOP.city}`,
  ];
  if (customer.reference) lines.push(`Referência: ${customer.reference}`);
  if (customer.location) lines.push(`Localização: ${locationUrl(customer.location)}`);
  lines.push('', '*Itens do pedido*');
  for (const item of order.cart.pancakes) {
    const product = describe(item);
    lines.push(`${item.qty}× ${product.name}`, product.details);
  }
  for (const drink of drinks) {
    const quantity = order.cart.drinks[drink.id];
    if (quantity) lines.push(`${quantity}× ${drink.name}`);
  }
  if (customer.notes) lines.push('', `Observações: ${customer.notes}`);
  lines.push('', `*Total do pedido: ${money(order.totalCents)}*`,
    `Pagamento informado: ${customer.payment === 'pix' ? 'Pix' : 'Cartão por aproximação'}`,
    'Confira com a loja se há valor a cobrar.');
  const text = lines.join('\n');
  return { text, url: `https://wa.me/${COURIER_PHONE}?text=${encodeURIComponent(text)}` };
}
