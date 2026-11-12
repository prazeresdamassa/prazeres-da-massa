import { ValidationError } from './domain';
export type DailySales = { day: string; received: number; pending: number; accepted: number; preparing: number; dispatched: number; completed: number; cancelled: number; revenue_cents: number; drink_completed: number; pix_completed: number; card_completed: number };
export type ProductSales = { kind: string; product_key: string; quantity: number; label: string };
export type ManagementReport = { version: 1; period: string; label: string; start: string; end: string; generatedAt: string; coverageFrom: string; daily: DailySales[]; products: ProductSales[]; hourly: { hour: number; received: number }[]; metrics: { received: number; completed: number; cancelled: number; inProgress: number; revenueCents: number; averageCents: number; cancellationRate: number; drinkRate: number; pixCompleted: number; cardCompleted: number } };
export function managementPeriod(period: string) {
  let year: number, month: number, span: number;
  if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) { year = Number(period.slice(0,4)); month = Number(period.slice(5)); span = 1; }
  else if (/^20\d{2}-Q[1-4]$/.test(period)) { year = Number(period.slice(0,4)); month = (Number(period.at(-1))-1)*3+1; span = 3; }
  else throw new ValidationError('Escolha um mês ou trimestre válido.');
  const start = new Date(Date.UTC(year,month-1,1)).toISOString().slice(0,10);
  const end = new Date(Date.UTC(year,month-1+span,1)).toISOString().slice(0,10);
  return { start, end, label: span === 3 ? `${period.at(-1)}º trimestre de ${year}` : new Date(Date.UTC(year,month-1,15)).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}) };
}
export function salesMetrics(daily: DailySales[]) {
  const sum = (key: keyof Omit<DailySales,'day'>) => daily.reduce((n,row)=>n+row[key],0);
  const received=sum('received'), completed=sum('completed'), cancelled=sum('cancelled'), revenueCents=sum('revenue_cents');
  return { received, completed, cancelled, inProgress: received-completed-cancelled, revenueCents, averageCents: completed ? Math.round(revenueCents/completed) : 0, cancellationRate: received ? cancelled/received*100 : 0, drinkRate: completed ? sum('drink_completed')/completed*100 : 0, pixCompleted:sum('pix_completed'), cardCompleted:sum('card_completed') };
}
