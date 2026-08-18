import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { BacktestResult, ScanConfig, ScanResult } from '../types';

/**
 * Export Scanner Results to Excel workbook
 */
export function exportScanToExcel(results: ScanResult[], config: ScanConfig, filename = 'Nifty_Accumulation_Scan.xlsx') {
  const wb = XLSX.utils.book_new();

  // 1. In-Zone Stocks Sheet
  const inZone = results.filter(r => r.zone_status === 'IN_ZONE');
  const inZoneData = inZone.map(r => ({
    Symbol: r.symbol,
    Company: r.name,
    Index: r.index_name,
    Sector: r.sector,
    'Latest Price (₹)': r.latest_close,
    'Period Low (₹)': r.period_low,
    'Low Date': r.period_low_date,
    'Zone Lower (+5%)': r.zone_lower,
    'Zone Upper (+6%)': r.zone_upper,
    'Status': r.zone_status,
    'Delivery %': r.delivery_pct,
    '20D Avg Delivery %': r.avg_delivery_pct_20,
    'Volume': r.volume,
    'Volume Ratio': r.volume_ratio,
    'Accumulation Score': r.accumulation_score,
  }));
  const wsInZone = XLSX.utils.json_to_sheet(inZoneData);
  XLSX.utils.book_append_sheet(wb, wsInZone, 'In-Zone Candidates');

  // 2. All Scanned Stocks Sheet
  const allData = results.map(r => ({
    Symbol: r.symbol,
    Company: r.name,
    Index: r.index_name,
    Sector: r.sector,
    'Latest Price (₹)': r.latest_close,
    'Period Low (₹)': r.period_low,
    'Zone Lower': r.zone_lower,
    'Zone Upper': r.zone_upper,
    'Distance to Zone (%)': r.distance_to_zone_pct,
    'Status': r.zone_status,
    'Delivery %': r.delivery_pct,
    '20D Avg Delivery %': r.avg_delivery_pct_20,
    'High Delivery Flag': r.high_delivery_flag ? 'YES' : 'NO',
    'Volume Ratio': r.volume_ratio,
    'Accumulation Score': r.accumulation_score,
  }));
  const wsAll = XLSX.utils.json_to_sheet(allData);
  XLSX.utils.book_append_sheet(wb, wsAll, 'All Stocks');

  // 3. Scan Configuration Sheet
  const configData = [
    { Parameter: 'Universe / Index', Value: config.indexFilter },
    { Parameter: 'Sector Filter', Value: config.sectorFilter },
    { Parameter: 'Lookback Period (Days)', Value: config.lookbackDays },
    { Parameter: 'Zone Lower Boundary', Value: `+${config.lowerPct}%` },
    { Parameter: 'Zone Upper Boundary', Value: `+${config.upperPct}%` },
    { Parameter: 'Min Delivery %', Value: `${config.minDeliveryPct}%` },
    { Parameter: 'Scan Date', Value: new Date().toLocaleString() },
  ];
  const wsConfig = XLSX.utils.json_to_sheet(configData);
  XLSX.utils.book_append_sheet(wb, wsConfig, 'Scan Parameters');

  XLSX.writeFile(wb, filename);
}

/**
 * Export Scanner Results to PDF Report
 */
export function exportScanToPDF(results: ScanResult[], config: ScanConfig, filename = 'Nifty_Accumulation_Report.pdf') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const inZone = results.filter(r => r.zone_status === 'IN_ZONE');

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 842, 60, 'F');

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('NIFTY ACCUMULATION ZONE SCANNER REPORT', 40, 36);

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated: ${new Date().toLocaleString()} | Lookback: ${config.lookbackDays}D | Zone: +${config.lowerPct}% to +${config.upperPct}%`, 40, 52);

  // Executive Summary Box
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`Executive Summary: ${results.length} Stocks Scanned, ${inZone.length} In Accumulation Zone`, 40, 85);

  const tableData = results.slice(0, 35).map(r => [
    r.symbol,
    r.name.length > 20 ? r.name.substring(0, 18) + '...' : r.name,
    r.sector,
    `₹${r.latest_close}`,
    `₹${r.period_low}`,
    `₹${r.zone_lower} - ₹${r.zone_upper}`,
    r.zone_status.replace('_', ' '),
    `${r.delivery_pct}%`,
    `${r.volume_ratio}x`,
    `${r.accumulation_score}/100`,
  ]);

  autoTable(doc, {
    startY: 98,
    head: [['Symbol', 'Company', 'Sector', 'Price', 'Anchor Low', 'Accumulation Zone', 'Status', 'Delivery %', 'Vol Ratio', 'Score']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename);
}

/**
 * Export Backtest Results to Excel workbook
 */
export function exportBacktestToExcel(result: BacktestResult, filename = 'Nifty_Backtest_Report.xlsx') {
  const wb = XLSX.utils.book_new();

  // 1. KPI Summary Sheet
  const summaryData = [
    { Metric: 'Total Trades', Value: result.metrics.totalTrades },
    { Metric: 'Winning Trades', Value: result.metrics.winningTrades },
    { Metric: 'Losing Trades', Value: result.metrics.losingTrades },
    { Metric: 'Win Rate (%)', Value: `${result.metrics.winRatePct}%` },
    { Metric: 'Profit Factor', Value: result.metrics.profitFactor },
    { Metric: 'Total ROI (%)', Value: `${result.metrics.totalRoiPct}%` },
    { Metric: 'CAGR (%)', Value: `${result.metrics.cagrPct}%` },
    { Metric: 'Max Drawdown (%)', Value: `${result.metrics.maxDrawdownPct}%` },
    { Metric: 'Sharpe Ratio', Value: result.metrics.sharpeRatio },
    { Metric: 'Expectancy (%)', Value: `${result.metrics.expectancyPct}%` },
    { Metric: 'Average Win (%)', Value: `+${result.metrics.avgWinPnlPct}%` },
    { Metric: 'Average Loss (%)', Value: `${result.metrics.avgLossPnlPct}%` },
    { Metric: 'Avg Holding (Days)', Value: result.metrics.avgHoldingDays },
    { Metric: 'Benchmark ROI (%)', Value: `${result.metrics.benchmarkRoiPct}%` },
    { Metric: 'Simulation Timeframe', Value: `${result.timeframe.start} to ${result.timeframe.end}` },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Strategy Metrics');

  // 2. Trade Log Sheet
  const tradeData = result.trades.map(t => ({
    'Trade ID': t.id,
    Symbol: t.symbol,
    Company: t.name,
    'Entry Date': t.entryDate,
    'Entry Price (₹)': t.entryPrice,
    'Exit Date': t.exitDate,
    'Exit Price (₹)': t.exitPrice,
    'Shares': t.shares,
    'Invested (₹)': t.investedAmount,
    'Exit Amount (₹)': t.exitAmount,
    'PnL (₹)': t.pnl,
    'PnL (%)': t.pnlPct,
    'Holding (Days)': t.holdingDays,
    'Exit Reason': t.exitReason,
    'Entry Delivery %': t.deliveryPctAtEntry,
    'Entry Period Low': t.periodLowAtEntry,
  }));
  const wsTrades = XLSX.utils.json_to_sheet(tradeData);
  XLSX.utils.book_append_sheet(wb, wsTrades, 'Trade Log');

  // 3. Equity Curve Sheet
  const equityData = result.equityCurve.map(e => ({
    Date: e.date,
    'Portfolio Equity (₹)': e.equity,
    'Cash (₹)': e.cash,
    'Invested (₹)': e.invested,
    'Drawdown (%)': e.drawdownPct,
    'Benchmark (₹)': e.benchmarkEquity,
    'Active Trades': e.activeTrades,
  }));
  const wsEquity = XLSX.utils.json_to_sheet(equityData);
  XLSX.utils.book_append_sheet(wb, wsEquity, 'Equity Curve');

  XLSX.writeFile(wb, filename);
}

/**
 * Export Backtest Results to PDF Report
 */
export function exportBacktestToPDF(result: BacktestResult, filename = 'Nifty_Backtest_Report.pdf') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 595, 60, 'F');

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('WALK-FORWARD BACKTEST PERFORMANCE REPORT', 35, 36);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Timeframe: ${result.timeframe.start} to ${result.timeframe.end} | Generated: ${new Date().toLocaleString()}`, 35, 50);

  // Performance Highlights Box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(35, 75, 525, 80, 4, 4, 'F');

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Performance Summary', 50, 95);

  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total Trades: ${result.metrics.totalTrades}`, 50, 115);
  doc.text(`Win Rate: ${result.metrics.winRatePct}% (${result.metrics.winningTrades}W / ${result.metrics.losingTrades}L)`, 50, 130);
  doc.text(`Profit Factor: ${result.metrics.profitFactor}`, 50, 145);

  doc.text(`Total ROI: +${result.metrics.totalRoiPct}%`, 220, 115);
  doc.text(`Max Drawdown: -${result.metrics.maxDrawdownPct}%`, 220, 130);
  doc.text(`Sharpe Ratio: ${result.metrics.sharpeRatio}`, 220, 145);

  doc.text(`Benchmark ROI: +${result.metrics.benchmarkRoiPct}%`, 390, 115);
  doc.text(`Avg Holding: ${result.metrics.avgHoldingDays} Days`, 390, 130);
  doc.text(`Expectancy: +${result.metrics.expectancyPct}%`, 390, 145);

  // Trade History Table
  const tableData = result.trades.slice(0, 30).map(t => [
    t.symbol,
    t.entryDate,
    `₹${t.entryPrice}`,
    t.exitDate,
    `₹${t.exitPrice}`,
    `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct}%`,
    `${t.holdingDays}d`,
    t.exitReason,
  ]);

  autoTable(doc, {
    startY: 170,
    head: [['Symbol', 'Entry Date', 'Entry Price', 'Exit Date', 'Exit Price', 'PnL %', 'Hold', 'Exit Reason']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 3.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 35, right: 35 },
  });

  doc.save(filename);
}
