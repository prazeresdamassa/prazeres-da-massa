import { CheckCircle2, Clock3 } from 'lucide-react';
import { money, type Receipt } from '../shared/domain';

export function OrderSuccess({ receipt }: { receipt: Receipt }) {
  return <div className="success"><span><CheckCircle2 size={38}/></span><h3>Pedido {receipt.label}</h3>
    <p>Total: <strong>{money(receipt.totalCents)}</strong></p>
    <div className="pending-badge"><Clock3 size={15}/> Aguardando confirmação da loja</div>
    <p>Seu pedido foi concluído e recebido!</p><p><strong>Aguarde a confirmação pelo WhatsApp.</strong></p>
    <p className="hint">Anote o número do pedido. Não é necessário enviar uma mensagem.</p>
  </div>;
}
