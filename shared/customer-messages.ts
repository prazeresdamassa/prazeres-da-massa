import { SHOP, describe, drinks, money, formatAddress, locationUrl, type Cart, type Customer, type OrderStatus } from './domain';

const updates = {
  accepted: 'confirmado.',
  preparing: `🥞 *PRAZERES DA MASSA | Pedido em Preparação* 👨‍🍳

✅ *Seu pedido já está sendo preparado!*

⏰ *Tempo estimado de preparo: 30 a 40 minutos.*

🛵 Avisaremos assim que seu pedido sair para entrega.`,
  dispatched: `🥞 *PRAZERES DA MASSA | Pedido em Rota de Entrega*

🛵 *Seu pedido saiu para entrega e está a caminho!*

📲 Por favor, mantenha seu telefone disponível para facilitar o recebimento.`,
  completed: `🥞 *PRAZERES DA MASSA | Pedido Entregue* ✅

❤️ Agradecemos pela sua preferência!

⭐ *Sua opinião é importante!* Conte-nos como foi sua experiência com nossos produtos.

📲 *Acompanhe nossas novidades e promoções:*

📸 Instagram: *@prazeresdamassachap*
📱 Status do WhatsApp

Será um prazer atender você novamente!

❤️ *Prazeres da Massa*
*Massas Artesanais*`,
} as const;

export function preparedStatusMessage(order: { id: number; customer: Customer; cart: Cart; totalCents: number }, status: OrderStatus) {
  if (!Object.hasOwn(updates, status)) return null;
  let phone = order.customer.phone.replace(/\D/g, '');
  if (/^\d{10,11}$/.test(phone)) phone = `55${phone}`;
  if (!/^55\d{10,11}$/.test(phone)) return null;
  if (status !== 'accepted') {
    const text = updates[status as keyof typeof updates];
    return { text, url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` };
  }
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
