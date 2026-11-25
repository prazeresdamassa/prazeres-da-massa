import { fillings, doughs, sauces, extras, drinks, type Cart } from './domain';
export type StockItem = { key: string; name: string; group: string; available: boolean };
export const stockCatalog = [
  ...fillings.map(p=>({key:`filling:${p.id}`,name:p.name,group:'Recheios'})),
  ...doughs.map(p=>({key:`dough:${p.id}`,name:p.name,group:'Massas de panqueca'})),
  ...sauces.filter(p=>p.id!=='sem').map(p=>({key:`sauce:${p.id}`,name:p.name,group:'Molhos'})),
  ...extras.map(p=>({key:`extra:${p.id}`,name:p.name,group:'Adicionais'})),
  ...drinks.map(p=>({key:`drink:${p.id}`,name:p.name,group:'Bebidas'})),
];
export function cartStockKeys(cart: Cart) {
  return [...new Set(cart.pancakes.flatMap(p=>[`filling:${p.filling}`,`dough:${p.dough}`,...(p.sauce==='sem'?[]:[`sauce:${p.sauce}`]),...p.extras.map(id=>`extra:${id}`)])
    .concat(Object.entries(cart.drinks).filter(([,qty])=>qty>0).map(([id])=>`drink:${id}`)))];
}
export function stockIssues(cart: Cart, unavailable: string[]) {
  const selected=new Set(cartStockKeys(cart));
  return stockCatalog.filter(p=>selected.has(p.key)&&unavailable.includes(p.key));
}
