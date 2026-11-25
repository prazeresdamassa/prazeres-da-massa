import { useEffect, useRef, useState } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import type { StockItem } from '../shared/inventory';

export default function StockPanel({onSessionExpired}:{onSessionExpired:()=>void}) {
  const [items,setItems]=useState<StockItem[]>([]);const [busy,setBusy]=useState('loading');
  const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const revision=useRef(0);const active=useRef(true);const changing=useRef(false);const expired=useRef(onSessionExpired);expired.current=onSessionExpired;
  async function api(options?:RequestInit) {
    let response:Response;
    try{response=await fetch('/api/admin/inventory',{...options,headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});}
    catch{throw new Error('Não foi possível conectar ao estoque. Tente novamente.');}
    if(response.status===401){expired.current();throw new Error('Sua sessão expirou. Entre novamente.');}
    let data:{items:StockItem[];error?:string};
    try{data=await response.json();}catch{throw new Error('Não foi possível ler o estoque. Atualize e tente novamente.');}
    if(!response.ok)throw new Error(data.error??'Não foi possível atualizar o estoque.');
    if(!Array.isArray(data.items))throw new Error('Não foi possível carregar os itens do estoque.');
    return data.items;
  }
  async function load(){if(changing.current)return;const id=++revision.current;setBusy('loading');setError('');try{const data=await api();if(active.current&&id===revision.current)setItems(data);}catch(e){if(active.current&&id===revision.current)setError((e as Error).message);}finally{if(active.current&&id===revision.current)setBusy('');}}
  useEffect(()=>{active.current=true;void load();return()=>{active.current=false;revision.current++;};},[]);
  async function toggle(item:StockItem){
    if(changing.current||busy)return;revision.current++;changing.current=true;setBusy(item.key);setError('');setNotice('');
    try{
      const data=await api({method:'PATCH',body:JSON.stringify({key:item.key,available:!item.available,previousAvailable:item.available})});
      if(active.current){setItems(data);setNotice(`${item.name}: ${item.available?'marcado como esgotado. Novos pedidos deste item estão bloqueados.':'disponível novamente.'}`);}
    }catch(e){if(active.current){setError((e as Error).message);try{const data=await api();if(active.current)setItems(data);}catch{/* erro original permanece visível */}}}
    finally{changing.current=false;if(active.current)setBusy('');}
  }
  const groups=[...new Set(items.map(p=>p.group))];
  return <main className="stock-panel"><div className="stock-heading"><div><span className="overline">DISPONIBILIDADE DO CARDÁPIO</span><h1><Package size={28}/> Estoque da loja</h1><p>Marque os itens esgotados para bloquear novos pedidos.</p></div><button type="button" className="outline-button" disabled={!!busy} onClick={()=>void load()}><RefreshCw size={17}/>{busy==='loading'?'Carregando…':'Atualizar estoque'}</button></div>
    <p className="stock-explanation">Controle manual por disponibilidade, sem contagem de unidades. Itens esgotados ficam sinalizados no cardápio e bloqueados em novos pedidos, inclusive em carrinhos já montados. Pedidos já recebidos são preservados.</p>
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="stock-notice" role="status">{notice}</p>}
    <div className="stock-groups">{groups.map(group=><section className="stock-group" key={group}><h2>{group}</h2>{items.filter(p=>p.group===group).map(item=><div className="stock-row" key={item.key}><div><strong>{item.name}</strong><span className={`stock-badge ${item.available?'available':'unavailable'}`}>{item.available?'Disponível':'Esgotado'}</span></div><button type="button" role="switch" aria-label={`Disponibilidade de ${item.name} (${item.group})`} aria-checked={item.available} disabled={!!busy} className={`stock-toggle ${item.available?'on':''}`} onClick={()=>void toggle(item)}><span aria-hidden="true"/>{busy===item.key?'Salvando…':item.available?'Disponível':'Esgotado'}</button></div>)}</section>)}</div>
  </main>;
}
