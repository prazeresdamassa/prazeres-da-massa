import { SHOP, formatAddress, describe, drinks, money, statusLabels, type Cart, type Customer, type OrderStatus } from '../shared/domain';
export type PrintableOrder = { id: number; createdAt: string; status: OrderStatus; customer: Customer; cart: Cart; totalCents: number };
export function PrintReceipt({ order }: { order: PrintableOrder }) {
  return <article className="print-receipt" aria-label={`Cupom do pedido ${order.id}`}>
    <header><h1>{SHOP.name}</h1><p>Panquecas artesanais · {SHOP.city}</p><p>WhatsApp: (98) 98199-7360</p>
      <h2>Pedido #{String(order.id).padStart(5, '0')}</h2><p>{new Date(order.createdAt).toLocaleString('pt-BR', { timeZone: SHOP.timezone })}</p><p><strong>{statusLabels[order.status]}</strong></p></header>
    <section><h3>Cliente e entrega</h3><p><strong>{order.customer.name}</strong></p><p>WhatsApp: {order.customer.phone}</p>
      <p>{formatAddress(order.customer)}</p><p>{order.customer.neighborhood} · {SHOP.city}</p>{order.customer.reference && <p>Referência: {order.customer.reference}</p>}</section>
    <section><h3>Itens do pedido</h3>{order.cart.pancakes.map((p, i) => <div className="receipt-item" key={i}><strong>{p.qty} × {describe(p).name}</strong><p>{describe(p).details}</p></div>)}
      {drinks.filter(d => order.cart.drinks[d.id]).map(d => <div className="receipt-item" key={d.id}><strong>{order.cart.drinks[d.id]} × {d.name}</strong></div>)}</section>
    {order.customer.notes && <section><h3>Observações</h3><p>{order.customer.notes}</p></section>}
    <section className="receipt-payment"><p>Entrega: grátis, conforme área de atendimento</p><p>Forma de pagamento: <strong>{order.customer.payment === 'pix' ? 'Pix' : 'Cartão por aproximação'}</strong></p>
      {order.customer.payment === 'pix' && <div className="receipt-pix"><p><strong>Chave Pix (celular): {SHOP.pix}</strong></p><p>Titular: {SHOP.pixOwner}</p></div>}
      <p className="receipt-total"><span>Total do pedido</span><strong>{money(order.totalCents)}</strong></p><p>Pagamento sujeito à conferência da loja.</p></section>
    <footer>Obrigado pela preferência!<br/>Comprovante de pedido — não é documento fiscal.</footer>
  </article>;
}
