import { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SHOP } from '../shared/domain';

export function PixPayment() {
  const key = useRef<HTMLInputElement>(null);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  async function copyKey() {
    setCopying(true); setMessage(''); setCopied(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(SHOP.pix);
      setCopied(true); setMessage('Chave Pix copiada!');
    } catch {
      key.current?.focus(); key.current?.select();
      setMessage('Não foi possível copiar automaticamente. Selecione e copie a chave acima.');
    } finally { setCopying(false); }
  }
  return <section className="pix-payment" aria-label="Pagamento por Pix">
    <h4>Chave Pix (celular)</h4>
    <div className="pix-key-row"><input ref={key} aria-label="Chave Pix" readOnly value={SHOP.pix} onFocus={e => e.currentTarget.select()}/><button type="button" className="outline-button" disabled={copying} onClick={() => void copyKey()}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copying ? 'Copiando…' : copied ? 'Copiada!' : 'Copiar chave'}</button></div>
    <p>Titular: <strong>{SHOP.pixOwner}</strong></p>
    <p>Aguarde a confirmação da loja antes de pagar. O pagamento é conferido manualmente.</p>
    <p className="pix-copy-feedback" role="status">{message}</p>
  </section>;
}
