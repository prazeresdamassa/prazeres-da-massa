import { useEffect, useRef, useState } from 'react';
import { BarChart3, Download, Save, RefreshCw, FolderOpen } from 'lucide-react';
import { money, SHOP } from '../shared/domain';
import type { ManagementReport } from '../shared/management';
import './management.css';

type Archive = { period: string; generated_at: string };
function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-US',{ timeZone: SHOP.timezone, year:'numeric',month:'2-digit' }).formatToParts(new Date());
  return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}`;
}
const time = (value: string) => new Date(value).toLocaleString('pt-BR',{ timeZone:SHOP.timezone });
export default function ManagementPanel({ onSessionExpired }: { onSessionExpired: () => void }) {
  const initial = useRef(currentPeriod()).current;
  const [mode,setMode] = useState('month'); const [month,setMonth] = useState(initial);
  const [year,setYear] = useState(initial.slice(0,4)); const [quarter,setQuarter] = useState(String(Math.ceil(Number(initial.slice(5))/3)));
  const [report,setReport] = useState<ManagementReport|null>(null); const [archives,setArchives] = useState<Archive[]>([]);
  const [archiveError,setArchiveError] = useState('');
  const [source,setSource] = useState<'live'|'saved'>('live'); const [busy,setBusy] = useState('loading');
  const [error,setError] = useState(''); const [notice,setNotice] = useState('');
  const active = useRef(true); const sequence = useRef(0);
  const expired = useRef(onSessionExpired); expired.current = onSessionExpired;
  async function api<T>(path: string, options?: RequestInit): Promise<T> {
    let response: Response;
    try { response = await fetch(path,{ ...options,headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(25000) }); }
    catch { throw new Error('Conexão com a gestão indisponível. Aguarde alguns instantes e tente novamente.'); }
    let data: { error?: string };
    try { data = await response.json() as { error?: string }; }
    catch { throw new Error('Não foi possível carregar os dados da gestão. Tente novamente.'); }
    if (response.status === 401) { expired.current(); throw new Error('Sua sessão expirou. Entre novamente.'); }
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar a gestão.');
    return data as T;
  }
  async function refreshArchives() {
    try { const data = await api<{reports:Archive[]}>('/api/admin/management/reports'); if(active.current) { setArchives(data.reports); setArchiveError(''); } }
    catch { if(active.current) setArchiveError('Não foi possível carregar os relatórios salvos.'); }
  }
  async function analyze(period: string, saved = false) {
    if (saved) { if (period.includes('-Q')) { setMode('quarter');setYear(period.slice(0,4));setQuarter(period.slice(-1)); } else { setMode('month');setMonth(period); } }
    const id = ++sequence.current; setBusy('loading'); setError(''); setNotice('');
    try {
      const data = await api<ManagementReport>(saved ? `/api/admin/management/reports/${period}` : `/api/admin/management?period=${period}`);
      if(active.current && id===sequence.current) { setReport(data); setSource(saved?'saved':'live'); }
    } catch(e) { if(active.current && id===sequence.current) setError(e instanceof Error ? e.message : 'Conexão indisponível. Tente novamente.'); }
    finally { if(active.current && id===sequence.current) setBusy(''); }
  }
  useEffect(()=>{
    active.current=true; void analyze(initial); void refreshArchives();
    return ()=>{active.current=false;sequence.current++;};
  },[]);
  async function save() {
    if(!report || busy) return; setBusy('saving');setError('');setNotice('');
    try {
      const data=await api<ManagementReport>('/api/admin/management/reports',{method:'POST',body:JSON.stringify({period:report.period})});
      if(!active.current) return;setReport(data);setSource('saved');setNotice('Relatório salvo. Você pode abri-lo ou baixar o Excel na lista abaixo.');await refreshArchives();
    } catch(e) { if(active.current)setError(e instanceof Error?e.message:'Não foi possível salvar.'); }
    finally { if(active.current)setBusy(''); }
  }
  async function download(value: ManagementReport) {
    setBusy('exporting');setError('');
    try { const module=await import('./management-excel');await module.downloadManagementExcel(value); }
    catch { if(active.current)setError('Não foi possível gerar a planilha. Tente novamente.'); }
    finally { if(active.current)setBusy(''); }
  }
  const period=mode==='month'?month:`${year}-Q${quarter}`;
  const metrics=report?.metrics;
  const maxRevenue=Math.max(1,...(report?.daily.map(d=>d.revenue_cents)??[]));
  const maxHour=Math.max(1,...(report?.hourly.map(h=>h.received)??[]));
  return <main className="management-panel">
    <header className="management-heading"><div><span className="overline">GESTÃO DA LOJA</span><h1><BarChart3/> Seu negócio em números</h1><p>Acompanhe pedidos, vendas e preferências dos clientes.</p></div></header>
    <form className="management-filters" onSubmit={e=>{e.preventDefault();void analyze(period);}}>
      <label>Análise<select value={mode} disabled={!!busy} onChange={e=>setMode(e.target.value)}><option value="month">Mensal</option><option value="quarter">Trimestral</option></select></label>
      {mode==='month'?<label>Mês<input type="month" required value={month} min="2000-01" max="2099-12" disabled={!!busy} onChange={e=>setMonth(e.target.value)}/></label>:<><label>Ano<input type="number" min="2000" max="2099" required value={year} disabled={!!busy} onChange={e=>setYear(e.target.value)}/></label><label>Trimestre<select value={quarter} disabled={!!busy} onChange={e=>setQuarter(e.target.value)}>{[1,2,3,4].map(q=><option value={q} key={q}>{q}º trimestre</option>)}</select></label></>}
      <button className="primary" disabled={!!busy} type="submit"><RefreshCw size={16}/>{busy==='loading'?'Consultando…':'Analisar período'}</button>
    </form>
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="management-notice" role="status">{notice}</p>}
    {report&&metrics&&<>
      <div className="report-heading"><div><h2>{report.label}</h2><p>{source==='saved'?'Relatório salvo':'Dados atuais'} · Gerado em {time(report.generatedAt)}</p></div><div className="report-actions"><button className="outline-button" disabled={!!busy} onClick={()=>void save()}><Save size={17}/>{busy==='saving'?'Salvando…':'Salvar/atualizar relatório'}</button><button className="primary" disabled={!!busy} onClick={()=>void download(report)}><Download size={17}/>{busy==='exporting'?'Gerando Excel…':'Baixar Excel'}</button></div></div>
      <p className="management-method">Base: pedidos criados no período, no horário de Chapadinha. O valor de vendas usa apenas pedidos marcados como concluídos e não comprova pagamento recebido. Produtos e bebidas consideram unidades desses pedidos. As situações refletem o último registro disponível; relatórios salvos são retratos da data de geração.</p>
      {report.start<report.coverageFrom&&<p className="warning">Este período começa antes do histórico disponível ({report.coverageFrom}). Os resultados podem estar incompletos.</p>}
      <section className="kpi-grid" aria-label="Indicadores principais">{[
        ['Vendas concluídas',money(metrics.revenueCents),'Valor total dos pedidos concluídos'],['Pedidos recebidos',String(metrics.received),'Todos os pedidos criados no período'],['Ticket médio',money(metrics.averageCents),'Média por pedido concluído'],['Pedidos concluídos',String(metrics.completed),'Atendimento finalizado'],['Em andamento',String(metrics.inProgress),'Ainda sem conclusão ou cancelamento'],['Cancelamentos',`${metrics.cancellationRate.toFixed(1).replace('.',',')}%`,`${metrics.cancelled} pedidos cancelados`],['Pedidos com bebidas',`${metrics.drinkRate.toFixed(1).replace('.',',')}%`,'Entre os pedidos concluídos'],['Unidades vendidas',String(report.products.reduce((n,p)=>n+p.quantity,0)),'Panquecas e bebidas de pedidos concluídos'],
      ].map(([label,value,caption])=><article className="kpi-card" key={label}><h3>{label}</h3><strong>{value}</strong><p>{caption}</p></article>)}</section>
      {!metrics.received&&<p className="management-empty">Nenhum pedido encontrado neste período. Escolha outro mês ou trimestre.</p>}
      <div className="management-charts"><section className="management-card"><h2>Evolução das vendas</h2><p>Dias com pedidos · valor dos concluídos</p><div className="chart-scroll">{report.daily.map(d=><div className="chart-row" key={d.day}><span>{d.day.slice(8)}/{d.day.slice(5,7)}</span><div className="bar-track"><span style={{width:`${d.revenue_cents/maxRevenue*100}%`}}/></div><strong>{money(d.revenue_cents)}</strong></div>)}</div>{!report.daily.length&&<p className="hint">Sem dados para o gráfico.</p>}</section>
      <section className="management-card"><h2>Horários de maior movimento</h2><p>Todos os pedidos recebidos · hora local</p>{report.hourly.map(h=><div className="chart-row" key={h.hour}><span>{String(h.hour).padStart(2,'0')}h</span><div className="bar-track hour"><span style={{width:`${h.received/maxHour*100}%`}}/></div><strong>{h.received}</strong></div>)}{!report.hourly.length&&<p className="hint">Sem dados para o gráfico.</p>}</section></div>
      <div className="management-charts"><section className="management-card"><h2>Mais vendidos</h2><p>Combinações e bebidas por unidades concluídas</p><div className="management-table-wrap"><table><thead><tr><th>Produto / combinação</th><th>Unidades</th></tr></thead><tbody>{report.products.map(p=><tr key={p.kind+p.product_key}><td>{p.label}</td><td>{p.quantity}</td></tr>)}</tbody></table></div>{!report.products.length&&<p className="hint">Nenhum produto de pedido concluído neste período.</p>}</section><section className="management-card"><h2>Formas de pagamento</h2><p>Informadas em pedidos concluídos; conferência manual.</p><div className="payment-summary"><span>Pix</span><strong>{metrics.pixCompleted}</strong></div><div className="payment-summary"><span>Cartão</span><strong>{metrics.cardCompleted}</strong></div><div className="management-retention"><strong>Pedidos: 90 dias</strong><p>Os dados pessoais são apagados após 90 dias. Resumos agregados e relatórios salvos permanecem disponíveis sem nome, telefone, endereço ou localização.</p><p>Histórico disponível desde {report.coverageFrom}, com os pedidos que existiam na implantação.</p></div></section></div>
    </>}
    <section className="management-card archive-card"><h2><FolderOpen size={22}/> Relatórios salvos</h2><p>Um relatório por período. Salvar novamente atualiza o relatório com os dados atuais. Exibidos os 120 mais recentes.</p>{archiveError&&<p className="warning" role="status">{archiveError} <button className="text-button" onClick={()=>void refreshArchives()}>Tentar novamente</button></p>}{!archives.length?<p className="hint">Nenhum relatório salvo. Analise um período e escolha Salvar/atualizar relatório.</p>:<div className="management-table-wrap"><table><thead><tr><th>Período</th><th>Salvo em</th><th>Ação</th></tr></thead><tbody>{archives.map(a=><tr key={a.period}><td>{a.period}</td><td>{time(a.generated_at)}</td><td><button className="outline-button" disabled={!!busy} onClick={()=>void analyze(a.period,true)}>Abrir relatório</button></td></tr>)}</tbody></table></div>}</section>
  </main>;
}
