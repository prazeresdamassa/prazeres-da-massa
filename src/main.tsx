import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowRight, Check, CheckCircle2, ChefHat, ChevronRight, Clock3, Heart, Leaf, LockKeyhole, MapPin, Menu, MessageCircle, Minus, Plus, ShoppingBag, Printer, Trash2, Truck, X } from 'lucide-react';
import { SHOP, fillings, doughs, sauces, extras, drinks, emptyCart, totals, money, describe, validateCart, statusLabels, type Cart, type Customer, type Pancake, type Receipt, type OrderStatus } from '../shared/domain';
import './styles.css';
import './enhancements.css';
import { PrintReceipt } from './PrintReceipt';

const CART_KEY = 'pdm:cart:v1';
const ATTEMPT_KEY = 'pdm:attempt:v1';
function readCart(): Cart {
  try { const saved = localStorage.getItem(CART_KEY); if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed?.pancakes)) parsed.pancakes = parsed.pancakes.filter((p: Pancake) => p.dough !== 'vermelha'); return validateCart(parsed); } } catch { /* armazenamento pode estar indisponível */ }
  return emptyCart();
}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers }, signal: AbortSignal.timeout(20000) }); }
  catch { throw new Error('A conexão com a loja está indisponível. Aguarde alguns instantes e tente novamente.'); }
  let data: { error?: string };
  try { data = await res.json(); } catch { throw new Error('Não foi possível conectar à loja. Tente novamente em instantes.'); }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Não foi possível concluir a solicitação.'), { status: res.status });
  return data as T;
}
function Counter({ value, onChange, min = 0, max = 99, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return <div className="counter" aria-label={label}>
    <button type="button" aria-label={`Diminuir ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={15}/></button>
    <span aria-live="polite">{value}</span>
    <button type="button" aria-label={`Aumentar ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={15}/></button>
  </div>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement; const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; ref.current?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,textarea,select,[tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0]; const last = elements[elements.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} className="modal">
      <div className="modal-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X/></button></div>
      {children}
    </div>
  </div>;
}
function App() {
  const [cart, setCart] = useState<Cart>(readCart);
  const [addedItem, setAddedItem] = useState<string | null>(null);
  const [drinkQuantities, setDrinkQuantities] = useState<Record<string, number>>({});
  const [category, setCategory] = useState<'panquecas' | 'massas' | 'bebidas'>('panquecas');
  const [filling, setFilling] = useState('frango'); const [dough, setDough] = useState('tradicional'); const [sauce, setSauce] = useState('tomate');
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]); const [qty, setQty] = useState(1);
  const [toast, setToast] = useState(''); const [error, setError] = useState(''); const [storageWarning, setStorageWarning] = useState(false);
  const [info, setInfo] = useState<'hours' | 'privacy' | null>(null);
  const [checkout, setCheckout] = useState(false); const [receipt, setReceipt] = useState<Receipt | null>(null); const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ open: boolean; today: string; ready?: boolean } | null>(null); const [statusError, setStatusError] = useState(false);
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', address: '', neighborhood: '', reference: '', notes: '', payment: 'pix', privacy: false });
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const sending = useRef(false);
  const total = totals(cart);
  const units = total.count + Object.values(cart.drinks).reduce((a, b) => a + b, 0);
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { setStorageWarning(true); }
  }, [cart]);
  useEffect(() => {
    let active = true;
    const refresh = async () => { try { const s = await request<{ open: boolean; today: string }>('/api/status'); if (active) { setStatus(s); setStatusError(false); } } catch { if (active) { setStatusError(true); setStatus(null); } } };
    void refresh(); const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  function add() {
    if (total.count + qty > 99) { setToast('O limite é de 99 panquecas por pedido.'); return; }
    const item: Pancake = { filling, dough, sauce, extras: [...selectedExtras].sort(), qty };
    const key = (p: Pancake) => JSON.stringify([p.filling, p.dough, p.sauce, [...p.extras].sort()]);
    const existing = cart.pancakes.findIndex(p => key(p) === key(item));
    if (existing === -1 && cart.pancakes.length >= 30) { setToast('O limite é de 30 combinações diferentes.'); return; }
    setCart(c => ({ ...c, pancakes: existing < 0 ? [...c.pancakes, item] : c.pancakes.map((p, i) => i === existing ? { ...p, qty: p.qty + qty } : p) }));
    setQty(1); setAddedItem(`${qty}× ${describe(item).name}`);
  }
  function addDrink(id: string) {
    const drink = drinks.find(d => d.id === id);
    const amount = drinkQuantities[id] ?? 1;
    if (!drink || amount < 1) return;
    if ((cart.drinks[id] ?? 0) + amount > 99) { setToast('O limite é de 99 unidades de cada bebida por pedido.'); return; }
    setCart(c => ({ ...c, drinks: { ...c.drinks, [id]: (c.drinks[id] ?? 0) + amount } }));
    setDrinkQuantities(q => ({ ...q, [id]: 1 }));
    setAddedItem(`${amount}× ${drink.name}`);
  }
  function afterAdding(destination: 'cart' | 'menu') {
    setAddedItem(null);
    // Aguarda o fechamento do diálogo e a restauração do foco antes de navegar.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = document.getElementById(destination === 'cart' ? 'pedido' : 'categorias');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (sending.current) return;
    setError(''); sending.current = true; setBusy(true);
    try {
      const body = { cart, customer }; const raw = JSON.stringify(body);
      // O hash não contém os dados pessoais em texto e a chave sobrevive a reloads.
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))), b => b.toString(16).padStart(2, '0')).join('');
      if (!attempt.current) { try { attempt.current = JSON.parse(localStorage.getItem(ATTEMPT_KEY) || 'null'); } catch { /* opcional */ } }
      if (attempt.current?.signature !== hash) attempt.current = { signature: hash, key: crypto.randomUUID() };
      try { localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt.current)); } catch { /* ref ainda protege esta aba */ }
      const result = await request<Receipt>('/api/orders', { method: 'POST', headers: { 'Idempotency-Key': attempt.current!.key }, body: raw });
      setReceipt(result); setCheckout(false); setCart(emptyCart());
      setCustomer({ name: '', phone: '', address: '', neighborhood: '', reference: '', notes: '', payment: 'pix', privacy: false });
      attempt.current = null; try { localStorage.removeItem(ATTEMPT_KEY); } catch { /* opcional */ }
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível registrar o pedido. Tente novamente.'); }
    finally { setBusy(false); sending.current = false; }
  }
  return <>
    <a className="skip" href="#categorias" onClick={() => setCategory('panquecas')}>Ir para o cardápio</a>
    <div className="top-strip"><span><MapPin size={13}/> Chapadinha, MA</span><span>Da nossa cozinha, com carinho <Heart size={12}/></span></div>
    <header className="site-header"><a href="/" className="wordmark"><span className="brand-icon"><ChefHat size={26}/></span><span>Prazeres <i>da Massa</i></span></a>
      <nav aria-label="Navegação principal"><a href="#categorias" onClick={() => setCategory('panquecas')}>Cardápio</a><button onClick={() => setInfo('hours')}>Horários</button><a href={`https://wa.me/${SHOP.whatsapp}`} target="_blank" rel="noopener noreferrer">Fale com a gente <MessageCircle size={15}/></a></nav>
      <a className="bag-link" href="#pedido" aria-label={`Seu pedido, ${units} itens`}><ShoppingBag size={19}/><span>{units}</span></a>
    </header>
    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span/> Massas Artesanais</div><h1>Seu sabor.<br/>Suas escolhas.<br/><em>Seu pedido.</em></h1>
          <p>Na Prazeres da Massa, o pedido tem o seu toque. Explore o cardápio, escolha sua massa preferida e combine recheios, molhos e adicionais para criar uma combinação do seu jeito.</p>
          <a href="#categorias" onClick={() => setCategory('panquecas')} className="primary hero-cta">Monte seu pedido! <ArrowRight size={18}/></a>
          <div className="hero-foot"><span><Truck size={17}/> Entrega grátis*</span><span><Heart size={16}/> Feita com carinho</span></div>
        </div>
        <div className="hero-art"><img src="/logo.png" alt="Prazeres da Massa — Massas Artesanais" fetchPriority="high" width="1254" height="1254"/></div>
      </section>
      <div className="service-bar"><div className={`opening ${status?.open ? 'is-open' : ''}`}><span className="status-dot"/><strong>{statusError ? 'Horário indisponível' : !status ? 'Consultando horário…' : status.open ? 'Estamos abertos' : 'Fechado agora'}</strong><span className="today">{status?.today}</span></div><button onClick={() => setInfo('hours')}>Ver horários <ChevronRight size={15}/></button><div className="service-delivery"><Truck size={18}/><span>Entrega grátis em Chapadinha*</span></div></div>
      <div className="menu-layout">
        <div className="menu-main">
          <nav className="category-menu" aria-label="Categorias do cardápio" id="categorias" tabIndex={-1}>{(['panquecas', 'massas', 'bebidas'] as const).map(id => <button key={id} type="button" aria-pressed={category === id} aria-controls={`categoria-${id}`} className={category === id ? 'active' : ''} onClick={() => setCategory(id)}>{id === 'panquecas' ? 'Panquecas' : id === 'massas' ? 'Massas' : 'Bebidas'}</button>)}</nav>
          <div id="categoria-panquecas" hidden={category !== 'panquecas'}><section id="montar" className="builder">
            <div className="section-intro"><span className="overline">DO SEU JEITINHO</span><h2>Uma panqueca, mil possibilidades.</h2><p>Escolha seus favoritos. A gente capricha no resto.</p></div>
            <fieldset><legend><span className="step">01</span> Comece pelo recheio <span className="required">Escolha 1</span></legend><div className="choices fillings">{fillings.map(f => <label key={f.id} className={`choice ${filling === f.id ? 'selected' : ''}`}><input type="radio" name="filling" value={f.id} checked={filling === f.id} onChange={() => setFilling(f.id)}/><span className={`flavor-art ${f.id}`} aria-hidden="true">{f.icon}</span><span className="choice-text"><strong>{f.name}</strong><small>{f.description}</small></span><span className="radio-mark">{filling === f.id && <Check size={12}/>}</span></label>)}</div></fieldset>
            <fieldset><legend><span className="step">02</span> Sua massa favorita <span className="required">Escolha 1</span></legend><div className="choices three">{doughs.map(d => <label key={d.id} className={`choice compact ${dough === d.id ? 'selected' : ''}`}><input type="radio" name="dough" checked={dough === d.id} onChange={() => setDough(d.id)} value={d.id}/><span className="option-emoji" aria-hidden="true">{d.icon}</span><span className="choice-text"><strong>{d.name}</strong><small>{d.description}</small></span><span className="radio-mark">{dough === d.id && <Check size={12}/>}</span></label>)}</div></fieldset>
            <fieldset><legend><span className="step">03</span> Um toque de molho <span className="required">Escolha 1</span></legend><div className="choices three">{sauces.map(s => <label key={s.id} className={`choice compact ${sauce === s.id ? 'selected' : ''}`}><input type="radio" name="sauce" value={s.id} checked={sauce === s.id} onChange={() => setSauce(s.id)}/><span className="option-emoji" aria-hidden="true">{s.icon}</span><span className="choice-text"><strong>{s.name}</strong><small>{s.description}</small></span><span className="radio-mark">{sauce === s.id && <Check size={12}/>}</span></label>)}</div></fieldset>
            <fieldset><legend><span className="step">04</span> Um carinho a mais <span className="free-label">É por nossa conta</span></legend><div className="extra-options">{extras.map(ex => <label key={ex.id} className={`extra ${selectedExtras.includes(ex.id) ? 'checked' : ''}`}><input type="checkbox" checked={selectedExtras.includes(ex.id)} onChange={e => setSelectedExtras(old => e.target.checked ? [...old, ex.id] : old.filter(x => x !== ex.id))}/><span className="check-square">{selectedExtras.includes(ex.id) && <Check size={13}/>}</span><span className="extra-name">{ex.name}</span><small>Grátis</small></label>)}</div><p className="hint">Opcional. Você pode escolher os dois.</p></fieldset>
            <div className="add-row"><div><span className="quantity-label">Quantidade</span><Counter value={qty} min={1} label="quantidade desta combinação" onChange={setQty}/></div><button className="primary add-button" onClick={add}><Plus size={18}/> Adicionar ao pedido <span>{money(qty * 1299)}</span></button></div><p className="price-hint">Avulsa: R$ 12,99. A promoção de 2 por R$ 21,99 é aplicada no total, inclusive com sabores diferentes.</p>
          </section>
          </div><section id="categoria-massas" className="pasta-section" hidden={category !== 'massas'}><span className="overline">MASSAS</span><h2>Cardápio em breve</h2><p>Nosso cardápio de massas estará disponível em breve. Enquanto isso, conheça nossas panquecas artesanais.</p><button type="button" className="primary" onClick={() => setCategory('panquecas')}>Ver panquecas <ArrowRight size={18}/></button></section><section id="categoria-bebidas" className="drinks-section" hidden={category !== 'bebidas'}><div className="section-intro"><span className="overline">PRA ACOMPANHAR</span><h2>Seu jantar pede uma bebida.</h2></div><div className="drink-grid">{drinks.map(d => <article className="drink-card" key={d.id}><div className={`soda-can ${d.id === 'coca-zero' ? 'zero' : ''}`} aria-hidden="true"><span>Coca<br/><i>Cola</i></span></div><div className="drink-content"><h3>{d.name}</h3><p>{money(d.cents)}</p><div className="drink-purchase"><Counter value={drinkQuantities[d.id] ?? 1} min={1} max={Math.max(1, 99 - (cart.drinks[d.id] ?? 0))} label={`quantidade de ${d.name} para adicionar`} onChange={n => setDrinkQuantities(q => ({ ...q, [d.id]: n }))}/><button type="button" className="primary drink-add" disabled={(cart.drinks[d.id] ?? 0) >= 99} onClick={() => addDrink(d.id)}><Plus size={16}/> Adicionar <span>{money((drinkQuantities[d.id] ?? 1) * d.cents)}</span></button></div></div></article>)}</div></section>
          <section className="care-note"><Heart size={26}/><div><strong>Comida de verdade. Carinho em cada detalhe.</strong><p>Tem alguma restrição alimentar? Fale com a gente antes de pedir. As massas contêm glúten e podem conter leite e ovos.</p></div></section>
        </div>
        <aside className="order-panel" id="pedido" tabIndex={-1}><div className="cart-title"><h2><ShoppingBag size={21}/> Seu pedido</h2><span>{units} {units === 1 ? 'item' : 'itens'}</span></div><p className="cart-subtitle">Um jantar gostoso começa por aqui.</p>
          {storageWarning && <p className="warning">Seu navegador não permitiu salvar o carrinho. Mantenha esta página aberta.</p>}
          {!units ? <div className="empty-cart"><span><ShoppingBag size={34} strokeWidth={1.2}/></span><strong>Que tal começar com uma panqueca?</strong><p>Monte sua combinação favorita e adicione ao pedido.</p><a href="#categorias" onClick={() => setCategory('panquecas')}>Explorar o cardápio <ArrowDown size={14}/></a></div> : <div className="cart-items">{cart.pancakes.map((p, i) => <div className="cart-item" key={`${i}-${p.filling}-${p.dough}`}><div className="item-number">{p.qty}×</div><div className="cart-item-copy"><strong>{describe(p).name}</strong><p>{describe(p).details}</p><div className="item-controls"><Counter value={p.qty} min={1} max={99 - total.count + p.qty} label={`quantidade de ${describe(p).name}, ${describe(p).details}`} onChange={qty => setCart(c => ({ ...c, pancakes: c.pancakes.map((p, j) => j === i ? { ...p, qty } : p) }))}/><button className="remove" aria-label={`Remover ${describe(p).name}, ${describe(p).details}`} onClick={() => setCart(c => ({ ...c, pancakes: c.pancakes.filter((_, j) => j !== i) }))}><Trash2 size={15}/></button></div></div></div>)}{drinks.filter(d => cart.drinks[d.id]).map(d => <div className="cart-drink" key={d.id}><span>{d.name}</span><strong>{money(cart.drinks[d.id] * d.cents)}</strong><Counter value={cart.drinks[d.id]} label={`quantidade de ${d.name} no carrinho`} onChange={n => setCart(c => ({ ...c, drinks: { ...c.drinks, [d.id]: n } }))}/><button type="button" className="remove" aria-label={`Remover ${d.name} do carrinho`} onClick={() => setCart(c => { const remaining = { ...c.drinks }; delete remaining[d.id]; return { ...c, drinks: remaining }; })}><Trash2 size={18}/></button></div>)}</div>}
          <div className="cart-promo"><span>🥞</span><div><strong>Melhor em dupla</strong><p>2 panquecas por <b>R$ 21,99</b></p></div><span className="promo-tag">PROMO</span></div>
          <div className="cart-totals"><div><span>Panquecas</span><span>{money(total.pancakeCents)}</span></div>{total.drinkCents > 0 && <div><span>Bebidas</span><span>{money(total.drinkCents)}</span></div>}<div><span>Entrega*</span><span className="green">Grátis</span></div>{total.savings > 0 && <div className="savings"><CheckCircle2 size={14}/><span>Você economizou {money(total.savings)}</span></div>}<div className="grand-total"><strong>Total</strong><strong aria-live="polite">{money(total.totalCents)}</strong></div></div>
          <button className="primary checkout-button" disabled={!total.count || !status?.open} onClick={() => { setError(''); setCheckout(true); }}> {status?.open ? 'Continuar pedido' : statusError ? 'Horário indisponível' : !status ? 'Consultando horário…' : 'Voltamos no próximo horário'} <ArrowRight size={18}/></button>
          <p className="cart-disclaimer"><LockKeyhole size={12}/> Seus dados são enviados com segurança.</p><p className="coverage">*Entrega grátis em Chapadinha–MA, conforme área de atendimento. A loja confirma a disponibilidade.</p>
        </aside>
      </div>
      <section className="bottom-banner"><div><span className="overline">A GENTE ADORA UMA BOA CONVERSA</span><h2>Alguma dúvida antes de pedir?</h2><p>Estamos a uma mensagem de distância.</p></div><a className="outline-button" href={`https://wa.me/${SHOP.whatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Chamar no WhatsApp <ArrowRight size={17}/></a></section>
    </main>
    <footer className="footer"><a href="/" className="wordmark"><ChefHat size={25}/><span>Prazeres <i>da Massa</i></span></a><p>Feito em casa. Feito com amor. Feito pra você.</p><div><button onClick={() => setInfo('privacy')}>Privacidade</button><button onClick={() => setInfo('hours')}>Horários</button><a href="/admin">Área da loja</a></div><small>© {new Date().getFullYear()} Prazeres da Massa · Chapadinha, MA</small></footer>
    <a className="mobile-cart" href="#pedido"><ShoppingBag size={19}/><span>Ver pedido <b>{units}</b></span><strong>{money(total.totalCents)}</strong><ChevronRight size={17}/></a>
    <div className={`toast ${toast ? 'visible' : ''}`} role="status">{toast && <><CheckCircle2 size={18}/>{toast}</>}</div>
    {addedItem && <Modal title="Adicionado ao carrinho!" onClose={() => afterAdding('menu')}><div className="added-confirmation"><span className="added-check"><CheckCircle2 size={36}/></span><p><strong>{addedItem}</strong></p><p>Seu carrinho tem {units} {units === 1 ? 'item' : 'itens'}, com total de <strong>{money(total.totalCents)}</strong>.</p><div className="added-actions"><button type="button" className="primary full" onClick={() => afterAdding('cart')}><ShoppingBag size={18}/> Ir para o carrinho <ArrowRight size={18}/></button><button type="button" className="outline-button full" onClick={() => afterAdding('menu')}>Continuar comprando</button></div></div></Modal>}
    {info === 'hours' && <Modal title="Nosso horário" onClose={() => setInfo(null)}><p>Hora local de Chapadinha–MA.</p><ul className="hours-list"><li><span>Segunda e terça</span><strong>Fechado</strong></li><li><span>Quarta e sexta</span><strong>19h às 23h</strong></li><li><span>Quinta, sábado e domingo</span><strong>18h às 22h</strong></li></ul><p className="hint">Você pode montar seu carrinho a qualquer hora. O registro de novos pedidos fica disponível durante o atendimento.</p></Modal>}
    {info === 'privacy' && <Modal title="Sua privacidade importa" onClose={() => setInfo(null)}><Privacy/></Modal>}
    {checkout && <Modal title="Falta pouco pro seu jantar" onClose={() => { if (!busy) setCheckout(false); }}><p className="modal-description">Total de <strong>{money(total.totalCents)}</strong> · Entrega em Chapadinha–MA, sujeita à área de atendimento.</p><form onSubmit={submit}>
      <div className="form-grid"><label>Seu nome<input required autoComplete="name" maxLength={80} minLength={2} value={customer.name} onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}/></label><label>WhatsApp com DDD<input required type="tel" autoComplete="tel-national" maxLength={22} placeholder="(98) 99999-9999" value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))}/></label></div>
      <label>Rua e número<input required minLength={5} maxLength={200} autoComplete="street-address" placeholder="Rua, número e complemento" value={customer.address} onChange={e => setCustomer(c => ({ ...c, address: e.target.value }))}/></label>
      <div className="form-grid"><label>Bairro<input required minLength={2} maxLength={80} autoComplete="address-level3" value={customer.neighborhood} onChange={e => setCustomer(c => ({ ...c, neighborhood: e.target.value }))}/></label><label>Referência <span className="optional">(opcional)</span><input maxLength={200} value={customer.reference} onChange={e => setCustomer(c => ({ ...c, reference: e.target.value }))}/></label></div>
      <fieldset className="payment"><legend>Como prefere pagar?</legend><label><input type="radio" name="payment" checked={customer.payment === 'pix'} onChange={() => setCustomer(c => ({ ...c, payment: 'pix' }))}/> Pix</label><label><input type="radio" name="payment" checked={customer.payment === 'card'} onChange={() => setCustomer(c => ({ ...c, payment: 'card' }))}/> Cartão por aproximação</label></fieldset>
      {customer.payment === 'pix' && <p className="pix-notice">Chave Pix: <strong>{SHOP.pix}</strong><br/>Titular: {SHOP.pixOwner}. Aguarde a confirmação da loja antes de pagar.</p>}
      <label>Alguma observação? <span className="optional">(opcional)</span><textarea maxLength={500} rows={2} placeholder="Preferências de preparo ou instruções para entrega" value={customer.notes} onChange={e => setCustomer(c => ({ ...c, notes: e.target.value }))}/></label>
      <label className="privacy-consent"><input type="checkbox" required checked={customer.privacy} onChange={e => setCustomer(c => ({ ...c, privacy: e.target.checked }))}/><span>Li o aviso abaixo e estou ciente do uso dos meus dados para atender e entregar este pedido.</span></label>
      <details className="privacy-details"><summary>Aviso de privacidade</summary><Privacy/></details>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary full" disabled={busy} type="submit">{busy ? 'Registrando seu pedido…' : 'Registrar pedido'} {!busy && <ArrowRight size={17}/>}</button><p className="hint">Depois, envie a mensagem no WhatsApp para falar com a loja. O pagamento não é processado neste site.</p>
    </form></Modal>}
    {receipt && <Modal title="Seu pedido foi registrado!" onClose={() => setReceipt(null)}><div className="success"><span><CheckCircle2 size={38}/></span><h3>Pedido {receipt.label}</h3><p>Total: <strong>{money(receipt.totalCents)}</strong></p><div className="pending-badge"><Clock3 size={15}/> Aguardando confirmação da loja</div><p>Agora envie os detalhes pelo WhatsApp. A loja vai confirmar o preparo e a entrega com você.</p><a className="primary full" href={receipt.whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Abrir pedido no WhatsApp</a><p className="hint">Na conversa, toque em enviar. Abrir o WhatsApp não envia a mensagem automaticamente. Anote seu número antes de fechar esta janela.</p></div></Modal>}
  </>;
}
function Privacy() {
  return <div className="privacy-copy"><p>A Prazeres da Massa utiliza nome, telefone, endereço e observações para atender o pedido e realizar a entrega. O acesso aos registros é restrito à equipe da loja.</p><p>Os registros deste sistema são eliminados após 90 dias. Ao abrir a conversa, os detalhes do pedido são compartilhados com o WhatsApp, sujeito às regras desse serviço. Mensagens e eventuais comprovantes fora deste site têm retenção própria.</p><p>O navegador guarda somente o carrinho e um identificador técnico de tentativa. Não usamos cookies de publicidade. A área da loja utiliza um cookie de sessão.</p><p>Para solicitar acesso, correção ou exclusão dos seus dados, entre em contato pelo <a href={`https://wa.me/${SHOP.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp da loja</a>.</p></div>;
}

type AdminOrder = { id: number; createdAt: string; status: OrderStatus; customer: Customer; cart: Cart; totalCents: number };
const nextStates: Record<OrderStatus, OrderStatus[]> = { pending: ['accepted', 'cancelled'], accepted: ['preparing', 'cancelled'], preparing: ['dispatched', 'cancelled'], dispatched: ['completed', 'cancelled'], completed: [], cancelled: [] };
function Admin() {
  const [orders, setOrders] = useState<AdminOrder[]>([]); const [logged, setLogged] = useState(false);
  const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [printOrder, setPrintOrder] = useState<AdminOrder | null>(null);
  useEffect(() => {
    if (!printOrder) return;
    let active = true; let frame = 0;
    void document.fonts.ready.then(() => { if (active) frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { if (active) window.print(); }); }); });
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [printOrder]);
  const [filter, setFilter] = useState('active'); const [before, setBefore] = useState<number | null>(null); const [change, setChange] = useState<{ id: number; from: OrderStatus; to: OrderStatus } | null>(null);
  async function load(append = false) {
    try {
      const data = await request<{ orders: AdminOrder[]; nextBefore: number | null }>(`/api/admin/orders${append && before ? `?before=${before}` : ''}`);
      setOrders(old => append ? [...old, ...data.orders] : data.orders); setBefore(data.nextBefore); setLogged(true); setError('');
    } catch (err) { if ((err as { status: number }).status === 401) setLogged(false); else setError((err as Error).message); }
  }
  useEffect(() => { document.title = 'Área da loja | Prazeres da Massa'; void load(); }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }); setPassword(''); await load(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function update() {
    if (!change) return; setBusy(true); setError('');
    try { await request(`/api/admin/orders/${change.id}`, { method: 'PATCH', body: JSON.stringify({ status: change.to, previousStatus: change.from }) }); setChange(null); await load(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <><div className="admin-shell"><header className="admin-header"><a className="wordmark" href="/"><ChefHat/><span>Prazeres <i>da Massa</i></span></a><span>Área da loja</span></header>
    {!logged ? <form className="login-card" onSubmit={login}><div className="login-icon"><LockKeyhole size={28}/></div><span className="overline">BEM-VINDO DE VOLTA</span><h1>O sabor começa aqui.</h1><p>Entre para acompanhar os pedidos da sua cozinha.</p><label>Senha da loja<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy ? 'Entrando…' : 'Entrar no painel'}<ArrowRight size={17}/></button><a href="/" className="back-link">Voltar ao cardápio</a></form> : <main className="admin-main"><div className="admin-top"><div><span className="overline">SUA COZINHA EM DIA</span><h1>Pedidos da loja</h1><p>Registros recentes. A confirmação é feita por você.</p></div><div className="admin-actions"><button className="outline-button" onClick={() => void load()}>Atualizar lista</button><button className="text-button" onClick={async () => { try { await request('/api/admin/logout', { method: 'POST', body: '{}' }); setLogged(false); setOrders([]); } catch (err) { setError((err as Error).message); } }}>Sair</button></div></div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="admin-filters"><button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Em andamento</button><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos os carregados</button></div>
      <p className="hint">Atualize a lista para receber novos pedidos. Registros são mantidos por 90 dias. Os dados abaixo são pessoais: use apenas para o atendimento.</p>
      {orders.filter(o => filter === 'all' || !['completed','cancelled'].includes(o.status)).map(o => <article className="admin-order" key={o.id}><div className="admin-order-heading"><h2>#{String(o.id).padStart(5, '0')} <span>{o.customer.name}</span></h2><span className={`order-status ${o.status}`}>{statusLabels[o.status]}</span></div><p className="hint">{new Date(o.createdAt).toLocaleString('pt-BR', { timeZone: SHOP.timezone })}</p><div className="admin-order-grid"><div><h3>Entrega</h3><p>{o.customer.address}<br/>{o.customer.neighborhood} · {SHOP.city}</p>{o.customer.reference && <p>Referência: {o.customer.reference}</p>}<a href={`https://wa.me/55${o.customer.phone}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={14}/> {o.customer.phone}</a></div><div><h3>Pedido</h3>{o.cart.pancakes.map((p, i) => <p key={i}><strong>{p.qty}× {describe(p).name}</strong><br/>{describe(p).details}</p>)}{drinks.filter(d => o.cart.drinks[d.id]).map(d => <p key={d.id}>{o.cart.drinks[d.id]}× {d.name}</p>)}{o.customer.notes && <p><strong>Observação:</strong> {o.customer.notes}</p>}</div><div><h3>Pagamento</h3><strong className="admin-total">{money(o.totalCents)}</strong><p>{o.customer.payment === 'pix' ? 'Pix' : 'Cartão por aproximação'}</p><small>A confirmação de pagamento é manual.</small></div></div><div className="admin-order-buttons"><button type="button" className="outline-button print-button" onClick={() => setPrintOrder({ ...o })}><Printer size={17}/> Imprimir cupom</button>{nextStates[o.status].map(s => <button key={s} className={s === 'cancelled' ? 'text-button danger' : 'primary'} onClick={() => setChange({ id: o.id, from: o.status, to: s })}>{s === 'cancelled' ? 'Cancelar pedido' : statusLabels[s]}</button>)}</div></article>)}
      {!orders.length && <div className="empty-admin"><ShoppingBag size={32}/><h2>Nenhum pedido registrado.</h2><p>Os pedidos aparecerão aqui durante o atendimento.</p></div>}{before && <button className="outline-button" onClick={() => void load(true)}>Carregar pedidos anteriores</button>}
      {change && <Modal title="Confirmar atualização" onClose={() => { if (!busy) setChange(null); }}><p>Alterar o pedido #{String(change.id).padStart(5, '0')} para <strong>{statusLabels[change.to]}</strong>?</p><p className="hint">Avise o cliente pelo WhatsApp. Esta ação não envia mensagens automaticamente.</p><button className="primary full" disabled={busy} onClick={() => void update()}>{busy ? 'Salvando…' : 'Confirmar alteração'}</button></Modal>}
    </main>}
  </div>{logged && printOrder && <PrintReceipt order={printOrder}/>}</>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode>{location.pathname.startsWith('/admin') ? <Admin/> : <App/>}</React.StrictMode>);
