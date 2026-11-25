import { useEffect, useState } from 'react';
import { Clock3, AlertCircle } from 'lucide-react';
import { preparationTiming, type PreparationOrder } from '../shared/preparation';

export function PreparationTimer({ order, clockOffset = 0 }: { order: PreparationOrder; clockOffset?: number }) {
  const [now,setNow]=useState(()=>Date.now()+clockOffset);
  useEffect(()=>{
    const tick=()=>setNow(Date.now()+clockOffset);tick();
    if (!preparationTiming(order,Date.now()+clockOffset)?.running) return;
    let timer:ReturnType<typeof setInterval>|undefined;
    const resume=()=>{if(timer)clearInterval(timer);timer=undefined;tick();if(document.visibilityState==='visible')timer=setInterval(tick,1000);};
    resume();document.addEventListener('visibilitychange',resume);
    return()=>{if(timer)clearInterval(timer);document.removeEventListener('visibilitychange',resume);};
  },[order.status,order.preparationStartedAt,order.preparationFinishedAt,clockOffset]);
  const timing=preparationTiming(order,now);
  if (!timing) {
    if (!order.preparationStartedAt && (order.status==='pending'||order.status==='accepted')) return <div className="preparation-timer is-on-time" role="timer" aria-live="off" aria-label="Tempo de preparo: não iniciado"><Clock3 size={22} aria-hidden="true"/><div><span>Tempo de preparo</span><strong>00:00</strong></div><p>Aguardando preparo<br/><span>Limite de 40 min após iniciar</span></p></div>;
    return <p className={order.status==='preparing'?'warning':'hint'}>Tempo de preparo não registrado{order.status==='preparing'?'. Atualize a lista.':' neste pedido anterior.'}</p>;
  }
  const Icon=timing.exceeded?AlertCircle:Clock3;
  return <div className={`preparation-timer ${timing.exceeded?'is-late':'is-on-time'}`} role="timer" aria-live="off" aria-label={`Tempo de preparo: ${timing.text}`}>
    <Icon size={22} aria-hidden="true"/><div><span>Tempo de preparo</span><strong>{timing.text}</strong></div>
    <p>{timing.running?'Contando':order.status==='cancelled'?'Preparo interrompido':'Preparo finalizado'}<br/><span>{timing.exceeded?'Prazo de 40 min ultrapassado':'Dentro do limite de 40 min'}</span></p>
  </div>;
}
