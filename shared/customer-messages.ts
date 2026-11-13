import { SHOP, describe, drinks, money, formatAddress, locationUrl, type Cart, type Customer, type OrderStatus } from './domain';

const updates = {
  accepted: 'confirmado.',
  preparing: 'está em preparo.',
  dispatched: 'saiu para entrega.',
  completed: 'concluído. Obrigado pela preferência!',
} as const;

export function preparedStatusMessage(order: { id: number; customer: Customer; cart: Cart; totalCents: number }, status: OrderStatus) {
  if (!Object.hasOwn(updates, status)) return null;
  let phone = order.customer.phone.replace(/\D/g, '');
  if (/^\d{10,11}$/.test(phone)) phone = `55${phone}`;
  if (!/^55\d{10,11}$/.test(phone)) return null;
  const name = order.customer.name.trim().replace(/[\r\n]+/g, ' ');
  const label = `#${String(order.id).padStart(5, '0')}`;
  const lines = [`Olá, ${name}! Seu pedido ${label} ${updates[status as keyof typeof updates]}`];
  if (status === 'accepted') {
    lines.push('', '*Resumo do pedido*');
    for (const item of order.cart.pancakes) {
      const product = describe(item);
      lines.push(`${item.qty}× ${product.name}`, product.details);
    }
    for (const drink of drinks) {
      const quantity = order.cart.drinks[drink.id];
      if (quantity) lines.push(`${quantity}× ${drink.name}`);
    }
    lines.push('', `*Total: ${money(order.totalCents)}*`, `Forma de pagamento: ${order.customer.payment === 'pix' ? 'Pix' : 'Cartão por aproximação'}`,
      `Entrega: ${formatAddress(order.customer)} — ${order.customer.neighborhood}, ${SHOP.city}`);
    if (order.customer.payment === 'pix') lines.push(`Chave Pix (celular): ${SHOP.pix}`, `Titular: ${SHOP.pixOwner}`, 'Pagamento sujeito à conferência da loja.');
    if (order.customer.reference) lines.push(`Referência: ${order.customer.reference}`);
    if (order.customer.notes) lines.push(`Observações: ${order.customer.notes}`);
    if (order.customer.location) lines.push(`Ponto de entrega: ${locationUrl(order.customer.location)}`);
  }
  lines.push('', SHOP.name);
  const text = lines.join('\n');
  return { text, url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` };
}
