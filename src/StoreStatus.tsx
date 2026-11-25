import { CheckCircle2, CircleX, CircleHelp, LoaderCircle } from 'lucide-react';

export function StoreStatus({ open, error }: { open?: boolean; error: boolean }) {
  const state = error ? 'unavailable' : open === undefined ? 'loading' : open ? 'open' : 'closed';
  const Icon = state === 'open' ? CheckCircle2 : state === 'closed' ? CircleX : state === 'loading' ? LoaderCircle : CircleHelp;
  const title = state === 'open' ? 'Estamos abertos' : state === 'closed' ? 'Estamos fechados' : state === 'loading' ? 'Consultando atendimento…' : 'Atendimento indisponível';
  const detail = state === 'open' ? 'Recebendo pedidos. Escolha seus favoritos!' : state === 'closed' ? 'Novos pedidos estão pausados. Você pode explorar o cardápio.' : state === 'loading' ? 'Aguarde enquanto verificamos se a loja está recebendo pedidos.' : 'Não foi possível verificar a disponibilidade. Tentaremos novamente em instantes.';
  return <section className={`store-status store-status--${state}`} role="status" aria-live="polite" aria-atomic="true" aria-label="Disponibilidade da loja">
    <span className="store-status-icon" aria-hidden="true"><Icon size={26}/></span>
    <div><strong>{title}</strong><p>{detail}</p></div>
  </section>;
}
