import { dbManager } from './db';
import { marketDataService } from './marketData';
import { NIFTY_CONSTITUENTS } from './constituents';
import { ScanConfig, ScanResult, ZoneStatus } from '../src/types';

export class AccumulationScanner {
  public async runScan(config: ScanConfig): Promise<ScanResult[]> {
    const {
      indexFilter = 'ALL',
      sectorFilter = 'ALL',
      lookbackDays = 66,
      lowerPct = 0.0,
      upperPct = 1.0,
      minDeliveryPct = 40.0,
      deliveryMultiplier = 1.0,
      minVolume = 0,
      priceField = 'close',
      inZoneOnly = false,
      highDeliveryOnly = false,
      searchQuery = '',
    } = config;

    // Get candidate stocks
    const stocks = await dbManager.getStocks(indexFilter, sectorFilter);
    const results: ScanResult[] = [];

    // Fetch live quotes batch in background for all candidate symbols
    const candidateSymbols = stocks.map(s => s.symbol);
    let liveQuotesMap = new Map<string, { price: number; changePct: number; volume: number; high: number; low: number; open: number }>();
    try {
      liveQuotesMap = await marketDataService.fetchLiveQuotesBatch(candidateSymbols);
    } catch {
      // Quiet failover to constituent basePrice / DuckDB bars
    }

    // Process each stock using fast columnar DuckDB data
    for (const stock of stocks) {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!stock.symbol.toLowerCase().includes(q) && !stock.name.toLowerCase().includes(q)) {
          continue;
        }
      }

      // Fetch recent bars for lookback + buffer for 20-day delivery SMA
      const totalBarsNeeded = lookbackDays + 25;
      const barsSql = `
        SELECT 
          symbol, 
          strftime(date, '%Y-%m-%d') as date, 
          open, high, low, close, volume, delivery_qty, delivery_pct
        FROM historical_data
        WHERE symbol = ?
        ORDER BY date DESC
        LIMIT ?
      `;
      const rawBars = await dbManager.query(barsSql, [stock.symbol, totalBarsNeeded]);
      if (!rawBars || rawBars.length < Math.min(10, lookbackDays)) {
        continue;
      }

      // Constituent reference data for price reconciliation
      const constituent = NIFTY_CONSTITUENTS.find(c => c.symbol === stock.symbol);
      const liveQuote = liveQuotesMap.get(stock.symbol);

      // Bars are in descending order: rawBars[0] is latest
      const latestBar = rawBars[0];
      const lookbackBars = rawBars.slice(0, lookbackDays);

      // 1. Calculate Period Anchor Low & Period High with Dates
      let periodLow = Infinity;
      let periodLowDate = '';
      let periodHigh = -Infinity;
      let periodHighDate = '';

      for (const bar of lookbackBars) {
        const p = priceField === 'low' ? Number(bar.low) : Number(bar.close);
        if (p < periodLow) {
          periodLow = p;
          periodLowDate = bar.date;
        }
        const h = Number(bar.high);
        if (h > periodHigh) {
          periodHigh = h;
          periodHighDate = bar.date;
        }
      }

      if (periodLow === Infinity || periodLow <= 0) continue;

      // 2. Resolve Active Current Price (Live Quote > Constituent Base > Latest Bar Close)
      let activePrice = Number(latestBar.close);
      let isLive = false;
      let dayHigh = Number(latestBar.high);
      let dayLow = Number(latestBar.low);
      let dayOpen = Number(latestBar.open);
      let liveChangePct = 0;

      if (liveQuote && liveQuote.price > 0) {
        activePrice = liveQuote.price;
        isLive = true;
        dayHigh = liveQuote.high;
        dayLow = liveQuote.low;
        dayOpen = liveQuote.open;
        liveChangePct = liveQuote.changePct;
      } else if (constituent && constituent.basePrice > 0 && Math.abs(activePrice - constituent.basePrice) / constituent.basePrice > 0.04) {
        // Reconcile price if stored bar is discrepant from known current market benchmark
        activePrice = constituent.basePrice;
      }

      // Previous close
      const prevBar = rawBars[1];
      const prevClose = prevBar ? Number(prevBar.close) : +(activePrice / (1 + (liveChangePct || 0) / 100)).toFixed(2);

      // VWAP Calculation across recent session/bars
      // VWAP = Sum(Typical Price * Volume) / Sum(Volume)
      const vwapWindow = rawBars.slice(0, 5);
      let totalTypVol = 0;
      let totalVolSum = 0;
      for (const vb of vwapWindow) {
        const typPrice = (Number(vb.high) + Number(vb.low) + Number(vb.close)) / 3;
        const v = Math.max(1, Number(vb.volume || 1000));
        totalTypVol += typPrice * v;
        totalVolSum += v;
      }
      const calculatedVwap = totalVolSum > 0 ? +(totalTypVol / totalVolSum).toFixed(2) : +( (dayHigh + dayLow + 2 * activePrice) / 4 ).toFixed(2);

      // 3. Zone boundaries
      const zoneLower = +(periodLow * (1 + lowerPct / 100)).toFixed(2);
      const zoneUpper = +(periodLow * (1 + upperPct / 100)).toFixed(2);
      const latestClose = activePrice;

      // 4. Zone Status & Distances
      let zoneStatus: ZoneStatus = 'ABOVE_ZONE';
      let distanceToZonePct = 0;

      if (latestClose >= zoneLower && latestClose <= zoneUpper) {
        zoneStatus = 'IN_ZONE';
        distanceToZonePct = 0;
      } else if (latestClose < zoneLower) {
        zoneStatus = 'BELOW_ZONE';
        distanceToZonePct = +(((latestClose - zoneLower) / zoneLower) * 100).toFixed(2);
      } else {
        zoneStatus = 'ABOVE_ZONE';
        distanceToZonePct = +(((latestClose - zoneUpper) / zoneUpper) * 100).toFixed(2);
      }

      const pctFromLow = +(((latestClose - periodLow) / periodLow) * 100).toFixed(2);
      const pctFromHigh = periodHigh > 0 ? +(((latestClose - periodHigh) / periodHigh) * 100).toFixed(2) : 0;

      // 5. Delivery & Volume Metrics
      const recent20 = rawBars.slice(0, 20);
      const avgDeliveryPct20 = +(recent20.reduce((acc, b) => acc + Number(b.delivery_pct || 0), 0) / recent20.length).toFixed(2);
      const avgVolume20 = Math.round(recent20.reduce((acc, b) => acc + Number(b.volume || 0), 0) / recent20.length);

      const latestDeliveryPct = Number(latestBar.delivery_pct || 0);
      const latestVolume = liveQuote?.volume && liveQuote.volume > 0 ? liveQuote.volume : Number(latestBar.volume || 0);
      const volumeRatio = avgVolume20 > 0 ? +(latestVolume / avgVolume20).toFixed(2) : 1;

      const highDeliveryFlag = (latestDeliveryPct >= minDeliveryPct) || (latestDeliveryPct >= avgDeliveryPct20 * deliveryMultiplier && latestDeliveryPct >= 35);

      const changePct = isLive ? liveChangePct : prevBar ? +(((latestClose - Number(prevBar.close)) / Number(prevBar.close)) * 100).toFixed(2) : 0;

      // Filter checks
      if (inZoneOnly && zoneStatus !== 'IN_ZONE') {
        continue;
      }
      if (highDeliveryOnly && !highDeliveryFlag) {
        continue;
      }
      if (minVolume > 0 && latestVolume < minVolume) {
        continue;
      }

      // Sparkline (recent 25 bars in ascending chronological order with latest price appended)
      const rawSpark = rawBars.slice(0, 25).map(b => Number(b.close)).reverse();
      if (rawSpark.length > 0) {
        rawSpark[rawSpark.length - 1] = activePrice;
      }
      const sparkline = rawSpark;

      // Accumulation Quality Score (0 - 100)
      let accumulationScore = 50;
      if (zoneStatus === 'IN_ZONE') {
        accumulationScore += 30;
      } else if (zoneStatus === 'BELOW_ZONE' && Math.abs(distanceToZonePct) < 3) {
        accumulationScore += 20;
      } else if (zoneStatus === 'ABOVE_ZONE' && distanceToZonePct < 3) {
        accumulationScore += 15;
      }

      if (latestDeliveryPct >= 60) accumulationScore += 20;
      else if (latestDeliveryPct >= 50) accumulationScore += 15;
      else if (latestDeliveryPct >= 40) accumulationScore += 10;

      if (volumeRatio >= 1.5) accumulationScore += 10;
      if (pctFromLow <= 8) accumulationScore += 10;

      accumulationScore = Math.min(100, Math.max(0, accumulationScore));

      const initialSlPrice = +(latestClose * 0.975).toFixed(2);
      const targetPrice = +(latestClose * 1.08).toFixed(2);

      results.push({
        symbol: stock.symbol,
        name: stock.name,
        index_name: stock.index_name,
        sector: stock.sector,
        latest_close: latestClose,
        latest_date: latestBar.date,
        change_pct: changePct,
        prev_close: prevClose,
        open: dayOpen,
        high: dayHigh,
        low: dayLow,
        close: activePrice,
        vwap: calculatedVwap,
        period_low: periodLow,
        period_low_date: periodLowDate,
        period_high: periodHigh,
        period_high_date: periodHighDate,
        zone_lower: zoneLower,
        zone_upper: zoneUpper,
        distance_to_zone_pct: distanceToZonePct,
        pct_from_low: pctFromLow,
        pct_from_high: pctFromHigh,
        zone_status: zoneStatus,
        delivery_pct: latestDeliveryPct,
        avg_delivery_pct_20: avgDeliveryPct20,
        high_delivery_flag: highDeliveryFlag,
        volume: latestVolume,
        avg_volume_20: avgVolume20,
        volume_ratio: volumeRatio,
        sparkline,
        accumulation_score: accumulationScore,
        live_price: activePrice,
        live_change_pct: changePct,
        is_live: isLive,
        day_high: dayHigh,
        day_low: dayLow,
        day_open: dayOpen,
        live_timestamp: new Date().toLocaleTimeString(),
        tactical_plan: {
          entry_zone: `₹${zoneLower} - ₹${zoneUpper}`,
          initial_stop_loss: initialSlPrice,
          initial_sl_pct: 2.5,
          trailing_rule: 'For every +1% price rise, Stop Loss trails +1% up to lock in maximum profits',
          target_price: targetPrice,
          target_pct: 8.0,
          risk_reward: '1:3.2+ (Max Profit Trailing Runner)',
        },
      });
    }

    // Default sort: IN_ZONE first, then highest accumulation_score, then closest distance
    results.sort((a, b) => {
      if (a.zone_status === 'IN_ZONE' && b.zone_status !== 'IN_ZONE') return -1;
      if (b.zone_status === 'IN_ZONE' && a.zone_status !== 'IN_ZONE') return 1;
      return b.accumulation_score - a.accumulation_score;
    });

    return results;
  }
}

export const accumulationScanner = new AccumulationScanner();
