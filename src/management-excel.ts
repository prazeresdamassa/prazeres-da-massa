import type { ManagementReport } from '../shared/management';

export async function managementWorkbook(report: ManagementReport) {
  const ExcelJS = (await import('exceljs')).default;
  const book = new ExcelJS.Workbook();
  book.creator = 'Prazeres da Massa'; book.created = new Date(report.generatedAt);
  const sheet = (name: string, headers: string[], widths: number[]) => {
    const tab = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    tab.addRow(headers); tab.columns = widths.map(width => ({ width }));
    const head = tab.getRow(1); head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D2B23' } }; head.height = 25;
    tab.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    return tab;
  };
  const summary = sheet('Resumo', ['Indicador', 'Valor', 'Critério'], [35, 30, 85]);
  summary.addRows([
    ['Período', report.label, `${report.start} até ${report.end} (fim exclusivo)`],
    ['Gerado em', report.generatedAt, 'Horário UTC'],
    ['Histórico disponível desde', report.coverageFrom, 'Pedidos disponíveis ao iniciar os agregados; períodos anteriores podem estar incompletos'],
    ['Pedidos recebidos', report.metrics.received, 'Data de criação no horário de Chapadinha'],
    ['Pedidos concluídos', report.metrics.completed, 'Situação concluído'],
    ['Valor das vendas concluídas', report.metrics.revenueCents / 100, 'Total registrado; não comprova recebimento do pagamento'],
    ['Ticket médio', report.metrics.averageCents / 100, 'Valor das vendas concluídas / pedidos concluídos'],
    ['Pedidos em andamento', report.metrics.inProgress, 'Recebidos menos concluídos e cancelados'],
    ['Pedidos cancelados', report.metrics.cancelled, 'Situação cancelado'],
    ['Taxa de cancelamento', report.metrics.cancellationRate / 100, 'Cancelados / recebidos'],
    ['Pedidos concluídos com bebidas', report.metrics.drinkRate / 100, 'Concluídos com pelo menos uma bebida / concluídos'],
  ]);
  for (const row of [7, 8]) summary.getCell(row, 2).numFmt = '"R$" #,##0.00';
  for (const row of [11, 12]) summary.getCell(row, 2).numFmt = '0.0%';
  const daily = sheet('Evolução diária', ['Data', 'Recebidos', 'Concluídos', 'Cancelados', 'Em andamento', 'Valor concluído (R$)'], [15, 16, 16, 16, 18, 25]);
  for (const row of report.daily) daily.addRow([row.day,row.received,row.completed,row.cancelled,row.received-row.completed-row.cancelled,row.revenue_cents/100]);
  daily.getColumn(6).numFmt = '"R$" #,##0.00';
  const products = sheet('Produtos', ['Categoria', 'Produto / combinação', 'Unidades'], [18, 100, 18]);
  for (const p of report.products) products.addRow([p.kind === 'drink' ? 'Bebida' : 'Panqueca',p.label,p.quantity]);
  const hours = sheet('Horários', ['Hora local', 'Pedidos recebidos'], [20, 24]);
  for (const h of report.hourly) hours.addRow([`${String(h.hour).padStart(2,'0')}:00`,h.received]);
  const payment = sheet('Pagamentos', ['Forma informada', 'Pedidos concluídos', 'Observação'], [30, 25, 75]);
  payment.addRows([['Pix',report.metrics.pixCompleted,'Forma escolhida no pedido; conferência de recebimento manual'],['Cartão',report.metrics.cardCompleted,'Forma escolhida no pedido; conferência de recebimento manual']]);
  return book;
}

export async function downloadManagementExcel(report: ManagementReport) {
  const book = await managementWorkbook(report);
  const buffer = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `prazeres-da-massa-${report.period}.xlsx`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url), 30000);
}
