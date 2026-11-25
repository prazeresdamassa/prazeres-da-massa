import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LocalDB} from './local-db';
import {preparationTiming,PREPARATION_LIMIT_MS} from '../shared/preparation';
import {cartStockKeys,stockIssues,stockCatalog} from '../shared/inventory';

test('timer é verde até 40 minutos e vermelho depois, sem reiniciar após saída',()=>{
  const start=Date.parse('2026-11-25T19:00:00Z');
  const preparing={status:'preparing' as const,preparationStartedAt:new Date(start).toISOString(),preparationFinishedAt:null};
  assert.equal(preparationTiming(preparing,start)!.text,'00:00');
  assert.equal(preparationTiming(preparing,start+PREPARATION_LIMIT_MS)!.exceeded,false);
  assert.equal(preparationTiming(preparing,start+PREPARATION_LIMIT_MS+1000)!.exceeded,true);
  assert.equal(preparationTiming(preparing,start+PREPARATION_LIMIT_MS+1000)!.text,'40:01');
  const done={...preparing,status:'dispatched' as const,preparationFinishedAt:new Date(start+35*60000).toISOString()};
  assert.equal(preparationTiming(done,start+3*3600000)!.text,'35:00');
  assert.equal(preparationTiming(done,start+3*3600000)!.running,false);
  assert.equal(preparationTiming(done,start+3*3600000)!.exceeded,false);
  assert.equal(preparationTiming({...done,preparationFinishedAt:null},start+3*3600000),null);
  assert.equal(preparationTiming({status:'pending'},start),null);
  assert.equal(preparationTiming({...preparing,preparationStartedAt:'inválido'},start),null);
  assert.equal(preparationTiming(preparing,start-1000)!.text,'00:00');
});

test('migração recupera início de pedidos em preparo e não inventa tempo de pedidos históricos',()=>{
  const db=new LocalDB(true);
  for(const [id,status] of [[1,'preparing'],[2,'dispatched'],[3,'pending']] as const)db.sqlite.prepare('INSERT INTO orders(id,request_key,request_hash,status,customer_json,items_json,total_cents,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id,'key'+id,'hash',status,'{}','{}',0,'2026-11-25T19:00:00.000Z');
  db.sqlite.exec(readFileSync(new URL('../migrations/0004_inventory_preparation.sql',import.meta.url),'utf8'));
  const rows=db.sqlite.prepare('SELECT id,preparation_started_at,preparation_finished_at FROM orders ORDER BY id').all();
  assert.equal(rows[0].preparation_started_at,'2026-11-25T19:00:00.000Z');
  assert.equal(rows[1].preparation_started_at,null);assert.equal(rows[2].preparation_started_at,null);
  assert.ok(rows.every(row=>row.preparation_finished_at===null));
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM inventory WHERE available=1').get()!.n,stockCatalog.length);
  db.sqlite.exec("UPDATE orders SET status='preparing', updated_at='2026-11-25T20:00:00.000Z' WHERE id=3");
  assert.equal(db.sqlite.prepare('SELECT preparation_started_at FROM orders WHERE id=3').get()!.preparation_started_at,'2026-11-25T20:00:00.000Z');
  db.sqlite.exec("UPDATE orders SET status='dispatched', updated_at='2026-11-25T20:25:00.000Z' WHERE id=3");
  assert.equal(db.sqlite.prepare('SELECT preparation_finished_at FROM orders WHERE id=3').get()!.preparation_finished_at,'2026-11-25T20:25:00.000Z');
  db.sqlite.close();
});

test('estoque considera opções e bebidas selecionadas, ignora Sem molho e bebidas zeradas',()=>{
  const cart={pancakes:[{filling:'frango',dough:'verde',sauce:'sem',extras:['queijo'],qty:2}],drinks:{coca:1,'coca-zero':0}};
  assert.deepEqual(cartStockKeys(cart),['filling:frango','dough:verde','extra:queijo','drink:coca']);
  assert.deepEqual(stockIssues(cart,['filling:frango','drink:coca-zero']).map(p=>p.key),['filling:frango']);
});
