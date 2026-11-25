import type { OrderStatus } from './domain';
export type PreparationOrder = { status: OrderStatus; preparationStartedAt?: string | null; preparationFinishedAt?: string | null };
export const PREPARATION_LIMIT_MS = 40 * 60 * 1000;
export function preparationTiming(order: PreparationOrder, now: number) {
  if (!order.preparationStartedAt) return null;
  const start=Date.parse(order.preparationStartedAt);
  const finished=order.preparationFinishedAt ? Date.parse(order.preparationFinishedAt) : null;
  if (!Number.isFinite(start) || (finished!==null&&!Number.isFinite(finished))) return null;
  // Um registro incompleto não deve continuar contando após a saída.
  if (finished===null&&order.status!=='preparing') return null;
  const elapsedMs=Math.max(0,(finished??now)-start);
  const seconds=Math.floor(elapsedMs/1000);
  return { elapsedMs, exceeded:elapsedMs>PREPARATION_LIMIT_MS, running:finished===null,
    text:`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}` };
}
