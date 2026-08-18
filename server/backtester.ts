import { dbManager } from './db';
import { BacktestConfig, BacktestMetrics, BacktestResult, EquityPoint, HistoricalBar, MonthlyReturn, Trade } from '../src/types';

interface OpenPosition {
  tradeId: string;
  symbol: string;
  name: string;
  entryDate: string;
  entryPrice: number;
  shares: number;
  investedAmount: number;
  initialTargetPrice: number;
  targetPrice: number;
  initialStopLossPrice: number;
  stopLossPrice: number;
  highestPriceReached: number;
  maxHoldingDateIndex: number;
  entryBarIndex: number;
  deliveryPctAtEntry: number;
  periodLowAtEntry: number;
}

export class WalkForwardBacktester {
  public async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    const {
      lookbackDays = 66,
      lowerPct = 5.0,
      upperPct = 6.0,
      minDeliveryPct = 40.0,
      deliveryMultiplier = 1.0,
      targetPct = 5.0,
      stopLossPct = 2.5,
      maxHoldingDays = 20,
      priorityResolution = 'STOP_LOSS_FIRST',
      initialCapital = 1000000,
      initialCapitalPerTrade = 50000,
      maxCapitalPerTrade = 100000,
      maxSimultaneousTrades = 10,
      rankingMetric = 'DELIVERY_PCT',
      indexFilter = 'ALL',
      startDate,
      endDate,
    } = config;

    // 1. Fetch relevant stock universe
    const stocks = await dbManager.getStocks(indexFilter);
    if (stocks.length === 0) {
      throw new Error('No stocks available for backtest universe');
    }

    const stockMap = new Map<string, string>();
    stocks.forEach(s => stockMap.set(s.symbol, s.name));

    // 2. Fetch all historical bars for these stocks up to endDate to ensure warm-up history is available
    const allBarsBySymbol = new Map<string, HistoricalBar[]>();
    const allUniqueDatesSet = new Set<string>();

    for (const stock of stocks) {
      const bars = await dbManager.getHistoricalData(stock.symbol, undefined, endDate);
      if (bars.length > 0) {
        allBarsBySymbol.set(stock.symbol, bars);
        bars.forEach(b => allUniqueDatesSet.add(b.date));
      }
    }

    const sortedDates = Array.from(allUniqueDatesSet).sort();
    if (sortedDates.length < 5) {
      throw new Error('Insufficient historical data range to perform backtest (at least 5 trading days required). Please download historical data first.');
    }

    // Map each symbol to a date-indexed lookup
    const symbolDateBarMap = new Map<string, Map<string, HistoricalBar>>();
    allBarsBySymbol.forEach((bars, symbol) => {
      const map = new Map<string, HistoricalBar>();
      bars.forEach(b => map.set(b.date, b));
      symbolDateBarMap.set(symbol, map);
    });

    // 3. Simulation State
    let cash = initialCapital;
    let peakEquity = initialCapital;
    const closedTrades: Trade[] = [];
    const openPositions: OpenPosition[] = [];
    const equityCurve: EquityPoint[] = [];

    // Benchmark tracking (Equal weight of available universe)
    const benchmarkInitial = initialCapital;
    let benchmarkUnits: { [symbol: string]: number } = {};
    let benchmarkInitialized = false;

    // Determine simulation start and end indices based on startDate and endDate
    let simulationStartIndex = lookbackDays;
    if (startDate) {
      const foundIdx = sortedDates.findIndex(d => d >= startDate);
      if (foundIdx !== -1) {
        simulationStartIndex = Math.max(0, foundIdx);
      } else {
        simulationStartIndex = Math.min(lookbackDays, sortedDates.length - 1);
      }
    } else {
      simulationStartIndex = Math.min(lookbackDays, Math.max(1, Math.floor(sortedDates.length * 0.2)));
    }

    let simulationEndIndex = sortedDates.length;
    if (endDate) {
      const foundEndIdx = sortedDates.findIndex(d => d > endDate);
      if (foundEndIdx !== -1) {
        simulationEndIndex = foundEndIdx;
      }
    }

    if (simulationStartIndex >= simulationEndIndex) {
      simulationStartIndex = Math.max(0, simulationEndIndex - 5);
    }

    for (let d = simulationStartIndex; d < simulationEndIndex; d++) {
      const currentDate = sortedDates[d];
      const prevDate = sortedDates[d - 1];

      // --- A. Process Exits for open positions on currentDate ---
      for (let i = openPositions.length - 1; i >= 0; i--) {
        const pos = openPositions[i];
        const barMap = symbolDateBarMap.get(pos.symbol);
        const currentBar = barMap?.get(currentDate);

        if (!currentBar) continue;

        pos.highestPriceReached = Math.max(pos.highestPriceReached, currentBar.high);
        const maxGainFromEntryPct = ((pos.highestPriceReached - pos.entryPrice) / pos.entryPrice) * 100;

        let exitPrice: number | null = null;
        let exitReason: 'TARGET' | 'STOP_LOSS' | 'TIME_LIMIT' | null = null;

        const isTimeLimit = (d - pos.entryBarIndex) >= maxHoldingDays;

        if (priorityResolution === 'STOP_LOSS_FIRST') {
          // Check Fixed Stop Loss first
          if (currentBar.low <= pos.stopLossPrice) {
            exitPrice = pos.stopLossPrice;
            exitReason = 'STOP_LOSS';
          } else if (currentBar.high >= pos.targetPrice) {
            exitPrice = Math.max(currentBar.open, pos.targetPrice);
            exitReason = 'TARGET';
          } else if (isTimeLimit) {
            if (currentBar.close <= pos.stopLossPrice || currentBar.low <= pos.stopLossPrice) {
              exitPrice = pos.stopLossPrice;
              exitReason = 'STOP_LOSS';
            } else {
              exitPrice = Math.max(pos.stopLossPrice, currentBar.close);
              exitReason = 'TIME_LIMIT';
            }
          }
        } else {
          // Check Target first
          if (currentBar.high >= pos.targetPrice) {
            exitPrice = Math.max(currentBar.open, pos.targetPrice);
            exitReason = 'TARGET';
          } else if (currentBar.low <= pos.stopLossPrice) {
            exitPrice = pos.stopLossPrice;
            exitReason = 'STOP_LOSS';
          } else if (isTimeLimit) {
            if (currentBar.close <= pos.stopLossPrice || currentBar.low <= pos.stopLossPrice) {
              exitPrice = pos.stopLossPrice;
              exitReason = 'STOP_LOSS';
            } else {
              exitPrice = Math.max(pos.stopLossPrice, currentBar.close);
              exitReason = 'TIME_LIMIT';
            }
          }
        }

        if (exitPrice !== null && exitReason !== null) {
          // Safety verification: Stop loss exit must NEVER be worse than fixed stopLossPct
          if (exitReason === 'STOP_LOSS') {
            exitPrice = pos.initialStopLossPrice;
          } else {
            exitPrice = Math.max(pos.stopLossPrice, exitPrice);
          }

          // Close position
          const exitAmount = pos.shares * exitPrice;
          const pnl = +(exitAmount - pos.investedAmount).toFixed(2);
          let pnlPct = +(((exitPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2);

          // Absolute guard: STOP_LOSS pnlPct can never be worse than -stopLossPct
          if (exitReason === 'STOP_LOSS') {
            pnlPct = -Math.abs(stopLossPct);
          }

          cash += exitAmount;

          closedTrades.push({
            id: pos.tradeId,
            symbol: pos.symbol,
            name: pos.name,
            entryDate: pos.entryDate,
            entryPrice: pos.entryPrice,
            exitDate: currentDate,
            exitPrice: +exitPrice.toFixed(2),
            shares: pos.shares,
            investedAmount: +pos.investedAmount.toFixed(2),
            exitAmount: +exitAmount.toFixed(2),
            pnl: +pnl.toFixed(2),
            pnlPct,
            holdingDays: d - pos.entryBarIndex,
            exitReason,
            deliveryPctAtEntry: pos.deliveryPctAtEntry,
            periodLowAtEntry: pos.periodLowAtEntry,
            initialStopLossPrice: pos.initialStopLossPrice,
            finalStopLossPrice: pos.stopLossPrice,
            initialTargetPrice: pos.initialTargetPrice,
            finalTargetPrice: pos.targetPrice,
            highestPriceReached: pos.highestPriceReached,
            maxGainPct: +maxGainFromEntryPct.toFixed(2),
          });

          openPositions.splice(i, 1);
        }
      }

      // --- B. Scan for New Entry Signals based on prevDate bar ---
      let openPositionsValue = 0;
      for (const pos of openPositions) {
        const bar = symbolDateBarMap.get(pos.symbol)?.get(currentDate);
        const curPrice = bar ? bar.close : pos.entryPrice;
        openPositionsValue += pos.shares * curPrice;
      }
      const totalEquity = cash + openPositionsValue;
      const dynamicTradeAllocation = Math.min(
        maxCapitalPerTrade, 
        (totalEquity / initialCapital) * initialCapitalPerTrade
      );

      const availableTradeSlots = maxSimultaneousTrades - openPositions.length;
      if (availableTradeSlots > 0 && cash >= 500) {
        const candidateSignals: {
          symbol: string;
          name: string;
          entryPrice: number;
          deliveryPct: number;
          volumeRatio: number;
          score: number;
          periodLow: number;
        }[] = [];

        // Check each symbol
        for (const [symbol, barMap] of symbolDateBarMap.entries()) {
          // Don't open duplicate position for same stock
          if (openPositions.some(p => p.symbol === symbol)) continue;

          const currentBar = barMap.get(currentDate);
          const prevBar = barMap.get(prevDate);
          if (!currentBar || !prevBar) continue;

          // Get past lookback bars up to prevDate
          const historicalBars = allBarsBySymbol.get(symbol) || [];
          const prevBarIdx = historicalBars.findIndex(b => b.date === prevDate);
          if (prevBarIdx < lookbackDays + 20) continue;

          const lookbackWindow = historicalBars.slice(prevBarIdx - lookbackDays + 1, prevBarIdx + 1);
          if (lookbackWindow.length < lookbackDays) continue;

          // Calculate period anchor lowest close
          let anchorLow = Infinity;
          for (const b of lookbackWindow) {
            if (b.close < anchorLow) anchorLow = b.close;
          }

          if (anchorLow === Infinity || anchorLow <= 0) continue;

          const zoneLower = anchorLow * (1 + lowerPct / 100);
          const zoneUpper = anchorLow * (1 + upperPct / 100);

          // Check if prevBar closed inside accumulation zone
          if (prevBar.close >= zoneLower && prevBar.close <= zoneUpper) {
            // Check Delivery & Volume confirmation
            const recent20 = historicalBars.slice(prevBarIdx - 19, prevBarIdx + 1);
            const avgDeliv = recent20.reduce((s, b) => s + b.delivery_pct, 0) / recent20.length;
            const avgVol = recent20.reduce((s, b) => s + b.volume, 0) / recent20.length;

            const qualifyingDelivery = (prevBar.delivery_pct >= minDeliveryPct) || 
                                       (prevBar.delivery_pct >= avgDeliv * deliveryMultiplier && prevBar.delivery_pct >= 35);

            if (qualifyingDelivery) {
              const volRatio = avgVol > 0 ? prevBar.volume / avgVol : 1;
              const proximity = (prevBar.close - zoneLower) / (zoneUpper - zoneLower);
              const score = (prevBar.delivery_pct * 0.5) + (volRatio * 15) + ((1 - proximity) * 20);

              candidateSignals.push({
                symbol,
                name: stockMap.get(symbol) || symbol,
                entryPrice: currentBar.open, // enter at current open
                deliveryPct: prevBar.delivery_pct,
                volumeRatio: volRatio,
                score,
                periodLow: anchorLow,
              });
            }
          }
        }

        // Rank candidates
        candidateSignals.sort((a, b) => {
          if (rankingMetric === 'DELIVERY_PCT') return b.deliveryPct - a.deliveryPct;
          if (rankingMetric === 'VOLUME_RATIO') return b.volumeRatio - a.volumeRatio;
          if (rankingMetric === 'PROXIMITY_TO_LOW') return a.entryPrice - b.entryPrice;
          return b.score - a.score;
        });

        // Execute top signals
        const signalsToTake = candidateSignals.slice(0, availableTradeSlots);
        for (const sig of signalsToTake) {
          const allocation = Math.min(dynamicTradeAllocation, cash / signalsToTake.length);
          if (allocation >= 500 && sig.entryPrice > 0) {
            const shares = Math.floor(allocation / sig.entryPrice);
            if (shares > 0) {
              const invested = shares * sig.entryPrice;
              cash -= invested;

              const targetPrice = +(sig.entryPrice * (1 + targetPct / 100)).toFixed(2);
              const stopLossPrice = +(sig.entryPrice * (1 - stopLossPct / 100)).toFixed(2);

              openPositions.push({
                tradeId: `tr_${Date.now()}_${sig.symbol}_${Math.random().toString(36).substring(2, 6)}`,
                symbol: sig.symbol,
                name: sig.name,
                entryDate: currentDate,
                entryPrice: sig.entryPrice,
                shares,
                investedAmount: invested,
                initialTargetPrice: targetPrice,
                targetPrice,
                initialStopLossPrice: stopLossPrice,
                stopLossPrice,
                highestPriceReached: sig.entryPrice,
                maxHoldingDateIndex: d + maxHoldingDays,
                entryBarIndex: d,
                deliveryPctAtEntry: sig.deliveryPct,
                periodLowAtEntry: sig.periodLow,
              });
            }
          }
        }
      }

      // --- C. Benchmark Initialization & Calculation ---
      if (!benchmarkInitialized) {
        let activeCount = 0;
        for (const [sym, barMap] of symbolDateBarMap.entries()) {
          const b = barMap.get(currentDate);
          if (b && b.close > 0) activeCount++;
        }
        if (activeCount > 0) {
          const perStock = benchmarkInitial / activeCount;
          for (const [sym, barMap] of symbolDateBarMap.entries()) {
            const b = barMap.get(currentDate);
            if (b && b.close > 0) {
              benchmarkUnits[sym] = perStock / b.close;
            }
          }
          benchmarkInitialized = true;
        }
      }

      let currentBenchmarkValue = 0;
      for (const [sym, units] of Object.entries(benchmarkUnits)) {
        const b = symbolDateBarMap.get(sym)?.get(currentDate);
        if (b) {
          currentBenchmarkValue += units * b.close;
        }
      }

      // --- D. Mark-to-Market Total Portfolio Equity ---
      if (totalEquity > peakEquity) {
        peakEquity = totalEquity;
      }
      const drawdownPct = peakEquity > 0 ? +(((peakEquity - totalEquity) / peakEquity) * 100).toFixed(2) : 0;

      equityCurve.push({
        date: currentDate,
        equity: +totalEquity.toFixed(2),
        cash: +cash.toFixed(2),
        invested: +openPositionsValue.toFixed(2),
        drawdownPct,
        benchmarkEquity: +(currentBenchmarkValue || benchmarkInitial).toFixed(2),
        activeTrades: openPositions.length,
      });
    }

    // Close remaining open positions at final bar close for trade reporting
    const finalDate = sortedDates[sortedDates.length - 1];
    for (const pos of openPositions) {
      const bar = symbolDateBarMap.get(pos.symbol)?.get(finalDate);
      let exitPrice = bar ? bar.close : pos.entryPrice;
      let exitReason: 'OPEN' | 'STOP_LOSS' = 'OPEN';

      if (exitPrice <= pos.stopLossPrice) {
        exitPrice = pos.stopLossPrice;
        exitReason = 'STOP_LOSS';
      }

      // Ensure loss never exceeds fixed stopLossPct
      exitPrice = Math.max(pos.initialStopLossPrice, exitPrice);

      const exitAmount = pos.shares * exitPrice;
      const pnl = +(exitAmount - pos.investedAmount).toFixed(2);
      let pnlPct = +(((exitPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2);
      if (exitReason === 'STOP_LOSS') {
        pnlPct = -Math.abs(stopLossPct);
      }

      closedTrades.push({
        id: pos.tradeId,
        symbol: pos.symbol,
        name: pos.name,
        entryDate: pos.entryDate,
        entryPrice: pos.entryPrice,
        exitDate: finalDate,
        exitPrice: +exitPrice.toFixed(2),
        shares: pos.shares,
        investedAmount: +pos.investedAmount.toFixed(2),
        exitAmount: +exitAmount.toFixed(2),
        pnl: +pnl.toFixed(2),
        pnlPct,
        holdingDays: sortedDates.length - 1 - pos.entryBarIndex,
        exitReason,
        deliveryPctAtEntry: pos.deliveryPctAtEntry,
        periodLowAtEntry: pos.periodLowAtEntry,
        initialStopLossPrice: pos.initialStopLossPrice,
        finalStopLossPrice: pos.stopLossPrice,
        initialTargetPrice: pos.initialTargetPrice,
        finalTargetPrice: pos.targetPrice,
        highestPriceReached: pos.highestPriceReached,
        maxGainPct: +(((pos.highestPriceReached - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2),
      });
    }

    // 4. Calculate Backtest Metrics
    const metrics = this.computeMetrics(closedTrades, equityCurve, initialCapital);

    // 5. Monthly & Yearly Returns Heatmap
    const { monthlyReturns, yearlyReturns } = this.computePeriodicReturns(equityCurve);

    const tradedSymbolsSet = new Set(closedTrades.map(t => t.symbol));

    return {
      config,
      metrics,
      trades: closedTrades.sort((a, b) => b.entryDate.localeCompare(a.entryDate)),
      equityCurve,
      monthlyReturns,
      yearlyReturns,
      symbolsTraded: tradedSymbolsSet.size,
      timeframe: {
        start: sortedDates[simulationStartIndex] || sortedDates[0],
        end: finalDate,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private computeMetrics(trades: Trade[], equityCurve: EquityPoint[], initialCapital: number): BacktestMetrics {
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);

    const totalWinAmount = wins.reduce((s, t) => s + t.pnl, 0);
    const totalLossAmount = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const totalRoiPct = +((totalPnl / initialCapital) * 100).toFixed(2);

    const winRatePct = totalTrades > 0 ? +((wins.length / totalTrades) * 100).toFixed(2) : 0;
    const profitFactor = totalLossAmount > 0 ? +(totalWinAmount / totalLossAmount).toFixed(2) : totalWinAmount > 0 ? 99.9 : 0;

    const maxDrawdownPct = equityCurve.length > 0 ? Math.max(...equityCurve.map(e => e.drawdownPct)) : 0;

    const avgTradePnlPct = totalTrades > 0 ? +(trades.reduce((s, t) => s + t.pnlPct, 0) / totalTrades).toFixed(2) : 0;
    const avgWinPnlPct = wins.length > 0 ? +(wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length).toFixed(2) : 0;
    const avgLossPnlPct = losses.length > 0 ? +(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length).toFixed(2) : 0;
    const winLossRatio = Math.abs(avgLossPnlPct) > 0 ? +(avgWinPnlPct / Math.abs(avgLossPnlPct)).toFixed(2) : avgWinPnlPct;

    const avgHoldingDays = totalTrades > 0 ? +(trades.reduce((s, t) => s + t.holdingDays, 0) / totalTrades).toFixed(1) : 0;

    // Consecutive streaks
    let maxConsecWins = 0;
    let maxConsecLosses = 0;
    let curWins = 0;
    let curLosses = 0;

    // Sorted chronologically for streak calculation
    const chronoTrades = [...trades].sort((a, b) => a.exitDate.localeCompare(b.exitDate));
    for (const t of chronoTrades) {
      if (t.pnl > 0) {
        curWins++;
        curLosses = 0;
        if (curWins > maxConsecWins) maxConsecWins = curWins;
      } else {
        curLosses++;
        curWins = 0;
        if (curLosses > maxConsecLosses) maxConsecLosses = curLosses;
      }
    }

    // Expectancy % = (Win% * AvgWin%) - (Loss% * AvgLoss%)
    const winProb = winRatePct / 100;
    const lossProb = (100 - winRatePct) / 100;
    const expectancyPct = +((winProb * avgWinPnlPct) - (lossProb * Math.abs(avgLossPnlPct))).toFixed(2);

    // Sharpe Ratio
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].equity;
      const cur = equityCurve[i].equity;
      if (prev > 0) dailyReturns.push((cur - prev) / prev);
    }

    let sharpeRatio = 0;
    if (dailyReturns.length > 5) {
      const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (dailyReturns.length - 1);
      const std = Math.sqrt(variance);
      if (std > 0) {
        // Annualized Sharpe (assuming 0% risk free rate)
        sharpeRatio = +((mean / std) * Math.sqrt(252)).toFixed(2);
      }
    }

    // CAGR %
    const daysTotal = equityCurve.length;
    const years = Math.max(0.1, daysTotal / 252);
    const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : initialCapital;
    const cagrPct = +((Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100).toFixed(2);

    // Benchmark ROI
    const finalBenchmark = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].benchmarkEquity : initialCapital;
    const benchmarkRoiPct = +(((finalBenchmark - initialCapital) / initialCapital) * 100).toFixed(2);

    return {
      totalTrades,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRatePct,
      profitFactor,
      totalPnl: +totalPnl.toFixed(2),
      totalRoiPct,
      cagrPct,
      maxDrawdownPct: +maxDrawdownPct.toFixed(2),
      sharpeRatio,
      avgTradePnlPct,
      avgWinPnlPct,
      avgLossPnlPct,
      winLossRatio,
      avgHoldingDays,
      maxConsecutiveWins: maxConsecWins,
      maxConsecutiveLosses: maxConsecLosses,
      expectancyPct,
      benchmarkRoiPct,
    };
  }

  private computePeriodicReturns(equityCurve: EquityPoint[]): {
    monthlyReturns: MonthlyReturn[];
    yearlyReturns: { year: number; returnPct: number }[];
  } {
    if (equityCurve.length === 0) return { monthlyReturns: [], yearlyReturns: [] };

    const monthlyMap = new Map<string, { start: number; end: number; year: number; month: number }>();
    const yearlyMap = new Map<number, { start: number; end: number }>();

    for (const point of equityCurve) {
      const d = new Date(point.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const monthKey = `${year}-${month}`;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { start: point.equity, end: point.equity, year, month });
      } else {
        monthlyMap.get(monthKey)!.end = point.equity;
      }

      if (!yearlyMap.has(year)) {
        yearlyMap.set(year, { start: point.equity, end: point.equity });
      } else {
        yearlyMap.get(year)!.end = point.equity;
      }
    }

    const monthlyReturns: MonthlyReturn[] = [];
    monthlyMap.forEach(val => {
      const returnPct = val.start > 0 ? +(((val.end - val.start) / val.start) * 100).toFixed(2) : 0;
      monthlyReturns.push({ year: val.year, month: val.month, returnPct });
    });

    const yearlyReturns: { year: number; returnPct: number }[] = [];
    yearlyMap.forEach((val, year) => {
      const returnPct = val.start > 0 ? +(((val.end - val.start) / val.start) * 100).toFixed(2) : 0;
      yearlyReturns.push({ year, returnPct });
    });

    return {
      monthlyReturns: monthlyReturns.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month)),
      yearlyReturns: yearlyReturns.sort((a, b) => a.year - b.year),
    };
  }
}

export const walkForwardBacktester = new WalkForwardBacktester();
