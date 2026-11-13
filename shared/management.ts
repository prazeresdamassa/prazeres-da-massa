import { ValidationError } from './domain';
export type DailySales = { day: string; received: number; pending: number; accepted: number; preparing: number; dispatched: number; completed: number; cancelled: number; revenue_cents: number; drink_completed: number; pix_completed: number; card_completed: number };
export type ProductSales = { kind: string; product_key: string; quantity: number; label: string };
export type ManagementReport = { version: 1; period: string; label: string; start: string; end: string; generatedAt: string; coverageFrom: string; daily: DailySales[]; products: ProductSales[]; hourly: { hour: number; received: number }[]; metrics: { received: number; completed: number; cancelled: number; inProgress: number; revenueCents: number; averageCents: number; cancellationRate: number; drinkRate: number; pixCompleted: number; cardCompleted: number } };
export function managementDate(value: string) {
  return value.split('-').reverse().join('/');
}
function nextDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0,10);
}
function validDate(value: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
// A API mantém o fim exclusivo; a interface e o Excel exibem as datas inclusivas.
export function managementRange(start: string, end: string) {
  const last = new Date(`${end}T00:00:00Z`); last.setUTCDate(last.getUTCDate() - 1);
  const inclusiveEnd = last.toISOString().slice(0,10);
  return start === inclusiveEnd ? managementDate(start) : `${managementDate(start)} a ${managementDate(inclusiveEnd)}`;
}
export function managementPeriod(period: string) {
  if (typeof period !== 'string') throw new ValidationError('Escolha um período válido.');
  if (period.includes('_')) {
    const parts = period.split('_'); const [start, last] = parts;
    if (parts.length !== 2 || !validDate(start) || !validDate(last) || last < start) throw new ValidationError('Informe datas válidas, com a data final igual ou posterior à inicial.');
    return { start, end: nextDay(last), label: `${managementDate(start)} a ${managementDate(last)}` };
  }
  if (validDate(period)) return { start: period, end: nextDay(period), label: managementDate(period) };
  let year: number, month: number, span: number;
  if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) { year = Number(period.slice(0,4)); month = Number(period.slice(5)); span = 1; }
  else if (/^20\d{2}-Q[1-4]$/.test(period)) { year = Number(period.slice(0,4)); month = (Number(period.at(-1))-1)*3+1; span = 3; }
  else throw new ValidationError('Escolha um dia, período, mês ou trimestre válido.');
  const start = new Date(Date.UTC(year,month-1,1)).toISOString().slice(0,10);
  const end = new Date(Date.UTC(year,month-1+span,1)).toISOString().slice(0,10);
  return { start, end, label: span === 3 ? `${period.at(-1)}º trimestre de ${year}` : new Date(Date.UTC(year,month-1,15)).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}) };
}
export function salesMetrics(daily: DailySales[]) {
  const sum = (key: keyof Omit<DailySales,'day'>) => daily.reduce((n,row)=>n+row[key],0);
  const received=sum('received'), completed=sum('completed'), cancelled=sum('cancelled'), revenueCents=sum('revenue_cents');
  return { received, completed, cancelled, inProgress: received-completed-cancelled, revenueCents, averageCents: completed ? Math.round(revenueCents/completed) : 0, cancellationRate: received ? cancelled/received*100 : 0, drinkRate: completed ? sum('drink_completed')/completed*100 : 0, pixCompleted:sum('pix_completed'), cardCompleted:sum('card_completed') };
}
