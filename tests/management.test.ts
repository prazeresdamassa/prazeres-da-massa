import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LocalDB } from './local-db';
import { initializeAnalytics, buildManagementReport } from '../worker/management';
import { managementPeriod, managementRange } from '../shared/management';
import { managementWorkbook } from '../src/management-excel';

function insert(db: LocalDB, id: number, date: string, status: string, cents: number) {
  const items = { pancakes: [{ filling:'frango', dough:'tradicional', sauce:'tomate',extras:['queijo'],qty:2 }, { filling:'carne',dough:'verde',sauce:'batata',extras:[],qty:1 }], drinks:{coca:2} };
  db.sqlite.prepare('INSERT INTO orders(id,request_key,request_hash,created_at,status,customer_json,items_json,total_cents) VALUES (?,?,?,?,?,?,?,?)')
    .run(id,`test-${id}`,'hash',date,status,JSON.stringify({ name:'Cliente secreto',phone:'98988887777',address:'Endereço privado',notes:'Obs privada',payment:'pix' }),JSON.stringify(items),cents);
}

test('backfill é idempotente, respeita o horário local e não guarda dados pessoais', async () => {
  const db = new LocalDB(true);
  insert(db,1,'2026-11-01T02:30:00.000Z','completed',4000);
  insert(db,2,'2026-11-01T03:10:00.000Z','cancelled',999);
  db.sqlite.exec(readFileSync(new URL('../migrations/0003_management.sql',import.meta.url),'utf8'));
  const binding = db as unknown as D1Database;
  await initializeAnalytics(binding); await initializeAnalytics(binding);
  const october = await buildManagementReport(binding,'2026-10');
  assert.equal(october.metrics.revenueCents,4000); assert.equal(october.metrics.completed,1);
  assert.equal(october.metrics.received,1); assert.equal(october.metrics.drinkRate,100);
  assert.equal(october.daily[0].day,'2026-10-31'); assert.equal(october.hourly[0].hour,23);
  assert.equal(october.products.reduce((n,p)=>n+p.quantity,0),5);
  const serialized = JSON.stringify(october);
  for (const privateValue of ['Cliente secreto','98988887777','Endereço privado','Obs privada','customer_json']) assert.ok(!serialized.includes(privateValue));
  const november = await buildManagementReport(binding,'2026-11');
  assert.equal(november.metrics.received,1); assert.equal(november.metrics.cancelled,1);
  assert.equal(november.metrics.revenueCents,0); assert.equal(november.metrics.averageCents,0);
  db.sqlite.close();
});

test('agregados acompanham estados, não duplicam itens e sobrevivem à limpeza de 90 dias', async () => {
  const db = new LocalDB(); const binding = db as unknown as D1Database;
  await initializeAnalytics(binding);
  insert(db,1,'2026-11-12T21:00:00.000Z','pending',2199);
  let report = await buildManagementReport(binding,'2026-11');
  assert.equal(report.metrics.inProgress,1); assert.equal(report.metrics.revenueCents,0);
  for (const status of ['accepted','preparing','dispatched','completed']) db.sqlite.prepare('UPDATE orders SET status = ? WHERE id = 1').run(status);
  report = await buildManagementReport(binding,'2026-11');
  assert.equal(report.metrics.completed,1); assert.equal(report.metrics.inProgress,0);
  assert.equal(report.metrics.revenueCents,2199); assert.equal(report.metrics.pixCompleted,1);
  assert.equal(report.products.reduce((n,p)=>n+p.quantity,0),5);
  db.sqlite.prepare("UPDATE orders SET status = 'completed' WHERE id = 1").run();
  insert(db,2,'2026-11-12T22:00:00.000Z','pending',999);
  db.sqlite.prepare("UPDATE orders SET status = 'cancelled' WHERE id = 2").run();
  const quarter = await buildManagementReport(binding,'2026-Q4');
  assert.equal(quarter.metrics.received,2); assert.equal(quarter.metrics.cancelled,1);
  assert.equal(quarter.metrics.cancellationRate,50); assert.equal(quarter.metrics.averageCents,2199);
  db.sqlite.exec('DELETE FROM orders');
  await initializeAnalytics(binding);
  const after = await buildManagementReport(binding,'2026-Q4');
  assert.deepEqual(after.metrics,quarter.metrics); assert.deepEqual(after.products,quarter.products);
  db.sqlite.close();
});

test('trimestre calendário contém todos os meses, inclusive anos bissextos', () => {
  assert.deepEqual(managementPeriod('2026-Q4'),{start:'2026-10-01',end:'2027-01-01',label:'4º trimestre de 2026'});
  assert.equal(managementPeriod('2024-Q1').end,'2024-04-01');
  assert.throws(()=>managementPeriod('2026-Q5')); assert.throws(()=>managementPeriod('2026-13'));
});

test('Excel contém números, abas e total histórico, sem informações pessoais', async () => {
  const db = new LocalDB(); const binding = db as unknown as D1Database;
  insert(db,1,'2026-11-12T21:00:00.000Z','completed',4000);
  const report = await buildManagementReport(binding,'2026-11');
  const book = await managementWorkbook(report);
  assert.equal(book.getWorksheet('Resumo')!.getCell('B7').value,40);
  assert.equal(book.getWorksheet('Resumo')!.getCell('B8').value,40);
  assert.equal(book.getWorksheet('Evolução diária')!.getCell('F2').value,40);
  assert.equal(book.getWorksheet('Produtos')!.rowCount,4);
  const buffer = await book.xlsx.writeBuffer();
  const ExcelJS = (await import('exceljs')).default; const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  assert.equal(reopened.worksheets.length,5);
  assert.equal(reopened.getWorksheet('Resumo')!.getCell('B7').value,40);
  assert.ok(!JSON.stringify(reopened.model).includes('Cliente secreto'));
  db.sqlite.close();
});

test('dia e período personalizado validam datas reais e incluem o último dia', () => {
  assert.deepEqual(managementPeriod('2026-11-12'),{start:'2026-11-12',end:'2026-11-13',label:'12/11/2026'});
  assert.deepEqual(managementPeriod('2026-12-31_2027-01-01'),{start:'2026-12-31',end:'2027-01-02',label:'31/12/2026 a 01/01/2027'});
  assert.equal(managementPeriod('2024-02-29').end,'2024-03-01');
  assert.equal(managementPeriod('2099-12-31').end,'2100-01-01');
  assert.equal(managementRange('2026-11-12','2026-11-13'),'12/11/2026');
  assert.equal(managementRange('2026-11-12','2026-11-14'),'12/11/2026 a 13/11/2026');
  for(const bad of ['2026-02-29','2026-04-31','2026-00-01','2026-01-00','2026-11-13_2026-11-12','2026-11-12_2026-02-30','2026-11-12_2026-11-13_extra','2026-11-12_','1999-12-31'])assert.throws(()=>managementPeriod(bad),bad);
});

test('dia e intervalo respeitam meia-noite de Chapadinha e Excel usa datas inclusivas',async()=>{
  const db=new LocalDB();const binding=db as unknown as D1Database;
  insert(db,1,'2026-11-12T02:59:59.999Z','completed',500);
  insert(db,2,'2026-11-12T03:00:00.000Z','completed',1000);
  insert(db,3,'2026-11-13T02:59:59.999Z','completed',2000);
  insert(db,4,'2026-11-13T03:00:00.000Z','completed',3000);
  insert(db,5,'2026-11-14T03:00:00.000Z','completed',5000);
  const day=await buildManagementReport(binding,'2026-11-12');
  assert.equal(day.metrics.received,2);assert.equal(day.metrics.revenueCents,3000);
  assert.deepEqual(day.daily.map(d=>d.day),['2026-11-12']);
  const range=await buildManagementReport(binding,'2026-11-12_2026-11-13');
  assert.equal(range.metrics.received,3);assert.equal(range.metrics.revenueCents,6000);assert.equal(range.metrics.averageCents,2000);
  assert.deepEqual(range.daily.map(d=>d.day),['2026-11-12','2026-11-13']);
  assert.deepEqual((await buildManagementReport(binding,'2026-11-12_2026-11-12')).metrics,day.metrics);
  const book=await managementWorkbook(range);
  assert.equal(book.getWorksheet('Resumo')!.getCell('B2').value,'12/11/2026 a 13/11/2026');
  assert.match(String(book.getWorksheet('Resumo')!.getCell('C2').value),/12\/11\/2026 a 13\/11\/2026/);
  assert.equal(book.getWorksheet('Resumo')!.getCell('B7').value,60);db.sqlite.close();
});
