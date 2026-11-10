import { CheckCircle2, Clock3, MessageCircle } from 'lucide-react';
import { money, type Receipt } from '../shared/domain';

export function OrderSuccess({ receipt, panelOnly }: { receipt: Receipt; panelOnly: boolean }) {
  return <div className="success"><span><CheckCircle2 size={38}/></span><h3>Pedido {receipt.label}</h3>
    <p>Total: <strong>{money(receipt.totalCents)}</strong></p>
    <div className="pending-badge"><Clock3 size={15}/> Aguardando confirmação da loja</div>
    {panelOnly ? <><p>Seu pedido foi concluído e recebido!</p><p><strong>Aguarde a confirmação pelo WhatsApp.</strong></p><p className="hint">Anote o número do pedido. Não é necessário enviar uma mensagem.</p></> : <>
      <p>Agora envie os detalhes pelo WhatsApp. A loja vai confirmar o preparo e a entrega com você.</p>
      <a className="primary full" href={receipt.whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Abrir pedido no WhatsApp</a>
      <p className="hint">Na conversa, toque em enviar. Abrir o WhatsApp não envia a mensagem automaticamente. Anote seu número antes de fechar esta janela.</p>
    </>}
  </div>;
}
