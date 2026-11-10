import { SHOP, type Customer, type OrderStatus } from './domain';

const updates = {
  accepted: 'confirmado.',
  preparing: 'está em preparo.',
  dispatched: 'saiu para entrega.',
  completed: 'concluído. Obrigado pela preferência!',
} as const;

export function preparedStatusMessage(order: { id: number; customer: Pick<Customer, 'name' | 'phone'> }, status: OrderStatus) {
  if (!Object.hasOwn(updates, status)) return null;
  let phone = order.customer.phone.replace(/\D/g, '');
  if (/^\d{10,11}$/.test(phone)) phone = `55${phone}`;
  if (!/^55\d{10,11}$/.test(phone)) return null;
  const name = order.customer.name.trim().replace(/[\r\n]+/g, ' ');
  const label = `#${String(order.id).padStart(5, '0')}`;
  const text = `Olá, ${name}! Seu pedido ${label} ${updates[status as keyof typeof updates]}\n${SHOP.name}`;
  return { text, url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` };
}
