export interface Stock {
  symbol: string;
  name: string;
  index_name: string; // 'NIFTY 50' | 'NIFTY NEXT 50' | 'NIFTY MIDCAP 50'
  sector: string;
  active: boolean;
  latest_price?: number;
  change_pct?: number;
  data_points?: number;
  first_date?: string;
  last_date?: string;
}

export interface HistoricalBar {
  symbol: string;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delivery_qty: number;
  delivery_pct: number;
  expiry_date?: string; // 'SPOT' or actual expiry (e.g., '27-AUG-2026')
  open_interest?: number;
  oi_change_pct?: number;
}

export type ZoneStatus = 'IN_ZONE' | 'BELOW_ZONE' | 'ABOVE_ZONE';

export type ThemeMode = 'dark' | 'light' | 'midnight' | 'emerald' | 'amber';

function calculateLastTuesday(year: number, month: number): string {
  const date = new Date(year, month + 1, 0); // Last day of month
  while (date.getDay() !== 2) { // 2 = Tuesday
    date.setDate(date.getDate() - 1);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${day}-${months[month]}-${year}`;
}

const startYear = 2026;
const startMonth = 7; // August
const generatedExpiries: string[] = [];
for (let i = 0; i < 12; i++) {
  const m = (startMonth + i) % 12;
  const y = startYear + Math.floor((startMonth + i) / 12);
  generatedExpiries.push(calculateLastTuesday(y, m));
}

export const DEFAULT_ACTIVE_EXPIRIES = generatedExpiries;

export const ALL_INDICES_LIST = [
  'ALL',
  // Broad Indices
  'NIFTY 50',
  'NIFTY NEXT 50',
  'NIFTY 100',
  'NIFTY 200',
  'NIFTY 500',
  'NIFTY MIDCAP 50',
  'NIFTY MIDCAP 100',
  'NIFTY SMALLCAP 100',
  'NIFTY TOTAL MARKET',
  // Derivatives Eligible Benchmark Indices
  'NIFTY BANK',
  'NIFTY FINANCIAL SERVICES',
  'NIFTY MIDCAP SELECT',
  // Sectoral Indices
  'NIFTY IT',
  'NIFTY AUTO',
  'NIFTY PHARMA',
  'NIFTY FMCG',
  'NIFTY METAL',
  'NIFTY REALTY',
  'NIFTY ENERGY',
  'NIFTY INFRA',
  'NIFTY MEDIA',
  'NIFTY PSU BANK',
  'NIFTY PRIVATE BANK',
  'NIFTY CONSUMER DURABLES',
  'NIFTY OIL & GAS',
  'NIFTY HEALTHCARE INDEX',
  // Thematic & Strategy Indices
  'NIFTY COMMODITIES',
  'NIFTY CPSE',
  'NIFTY MNC',
  'NIFTY INDIA DIGITAL',
  // Fixed Income / Debt Indices
  'NIFTY G-SEC 10 YEAR',
  'NIFTY COMPOSITE DEBT',
  'NIFTY 1D RATE',
] as const;

export interface ScanResult {
  symbol: string;
  name: string;
  index_name: string;
  sector: string;
  latest_close: number;
  latest_date: string;
  change_pct: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  period_low: number;
  period_low_date: string;
  period_high: number;
  period_high_date: string;
  zone_lower: number; // e.g. Lowest * 1.05
  zone_upper: number; // e.g. Lowest * 1.06
  distance_to_zone_pct: number; // 0 if IN_ZONE, negative if below, positive if above
  pct_from_low: number;
  pct_from_high: number;
  zone_status: ZoneStatus;
  delivery_pct: number;
  avg_delivery_pct_20: number;
  high_delivery_flag: boolean;
  volume: number;
  avg_volume_20: number;
  volume_ratio: number;
  sparkline: number[]; // recent 15-30 close prices
  accumulation_score: number; // 0-100 composite institutional accumulation score
  live_price?: number;
  live_change_pct?: number;
  is_live?: boolean;
  day_high?: number;
  day_low?: number;
  day_open?: number;
  live_timestamp?: string;
  tactical_plan?: {
    entry_zone: string;
    initial_stop_loss: number;
    initial_sl_pct: number;
    trailing_rule: string;
    target_price: number;
    target_pct: number;
    risk_reward: string;
  };
}

export interface ScanConfig {
  indexFilter: string; // 'ALL' | 'NIFTY 50' | 'NIFTY NEXT 50' | 'NIFTY MIDCAP 50'
  sectorFilter: string;
  lookbackDays: number; // 22 (1M), 66 (3M), 132 (6M), 252 (1Y), 504 (2Y), 756 (3Y)
  lowerPct: number; // default 5.0%
  upperPct: number; // default 6.0%
  minDeliveryPct: number; // e.g. 40%
  deliveryMultiplier: number; // e.g. 1.2x avg
  minVolume: number;
  priceField: 'close' | 'low';
  inZoneOnly: boolean;
  highDeliveryOnly: boolean;
  searchQuery: string;
  initialCapital: number;
  initialCapitalPerTrade: number;
  maxCapitalPerTrade: number;
  targetPct: number;
  stopLossPct: number;
  maxHoldingDays: number;
}

export interface BacktestConfig {
  lookbackDays: number;
  lowerPct: number;
  upperPct: number;
  minDeliveryPct: number;
  deliveryMultiplier: number;
  targetPct: number; // e.g. 5% or 10%
  stopLossPct: number; // e.g. 2.5%
  maxHoldingDays: number; // e.g. 20
  priorityResolution: 'STOP_LOSS_FIRST' | 'TARGET_FIRST';
  initialCapital: number; // e.g. 1000000
  initialCapitalPerTrade: number;
  maxCapitalPerTrade: number; // e.g. 100000
  maxSimultaneousTrades: number; // e.g. 10
  rankingMetric: 'DELIVERY_PCT' | 'VOLUME_RATIO' | 'PROXIMITY_TO_LOW' | 'ACCUMULATION_SCORE';
  indexFilter: string;
  startDate?: string;
  endDate?: string;
}

export interface Trade {
  id: string;
  symbol: string;
  name: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  investedAmount: number;
  exitAmount: number;
  pnl: number;
  pnlPct: number;
  holdingDays: number;
  exitReason: 'TARGET' | 'STOP_LOSS' | 'TIME_LIMIT' | 'OPEN';
  deliveryPctAtEntry: number;
  periodLowAtEntry: number;
  initialStopLossPrice?: number;
  finalStopLossPrice?: number;
  initialTargetPrice?: number;
  finalTargetPrice?: number;
  highestPriceReached?: number;
  maxGainPct?: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
  cash: number;
  invested: number;
  drawdownPct: number;
  benchmarkEquity: number;
  activeTrades: number;
}

export interface MonthlyReturn {
  year: number;
  month: number; // 1-12
  returnPct: number;
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number;
  totalPnl: number;
  totalRoiPct: number;
  cagrPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  avgTradePnlPct: number;
  avgWinPnlPct: number;
  avgLossPnlPct: number;
  winLossRatio: number;
  avgHoldingDays: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  expectancyPct: number;
  benchmarkRoiPct: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: EquityPoint[];
  monthlyReturns: MonthlyReturn[];
  yearlyReturns: { year: number; returnPct: number }[];
  symbolsTraded: number;
  timeframe: { start: string; end: string };
  generatedAt: string;
}

export interface DownloadLog {
  id: string;
  timestamp?: string;
  taskId?: string;
  indexName?: string;
  index_name?: string;
  symbol?: string;
  records_added?: number;
  totalStocks?: number;
  completedStocks?: number;
  recordsInserted?: number;
  failedStocks?: number;
  startDate?: string;
  endDate?: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'SUCCESS' | 'PARTIAL';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  error_message?: string;
}

export interface DownloadProgress {
  taskId: string;
  status: 'IDLE' | 'RUNNING' | 'DOWNLOADING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'ERROR';
  indexName: string;
  currentSymbol: string;
  completedSymbols?: number;
  completedStocks?: number;
  totalSymbols?: number;
  totalStocks?: number;
  recordsAdded?: number;
  recordsInserted?: number;
  percent?: number;
  progressPct?: number;
  startTime?: number;
  speedBarsPerSec?: number;
  estimatedTimeRemainingSec?: number;
  failedStocks?: number;
  errors: string[];
}

export interface DatabaseStats {
  totalStocks: number;
  totalBars: number;
  earliestDate?: string;
  latestDate?: string;
  dbSizeBytes?: number;
  dbSizeFormatted?: string;
  fileSizeBytes?: number;
  walSizeBytes?: number;
  tables?: {
    name: string;
    rowCount: number;
  }[];
  tableStats?: {
    name: string;
    rowCount: number;
  }[];
  integrityHealthy?: boolean;
  integrityStatus?: 'HEALTHY' | 'WARNING' | 'CORRUPTED';
  lastCheckpoint?: string;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  name?: string;
  targetPrice: number;
  condition: 'ENTERS_ACCUMULATION_ZONE' | 'PRICE_ABOVE' | 'PRICE_BELOW' | 'HIGH_DELIVERY_SPIKE';
  email: string;
  enablePush: boolean;
  enableEmail: boolean;
  triggerStatus: 'ACTIVE' | 'TRIGGERED' | 'DISABLED';
  createdAt: string;
  triggeredAt?: string;
  notes?: string;
  lastTriggerDetails?: string;
}

export interface SavedAnalysis {
  id: string;
  title: string;
  created_at?: string;
  createdAt?: string;
  type: 'SCAN' | 'BACKTEST' | 'AI_REPORT';
  configJson: string;
  resultsJson: string;
}

export interface AIAnalysisResponse {
  summary: string;
  keyInsights: string[];
  accumulationCandidates: {
    symbol: string;
    zoneQuality: 'A+' | 'A' | 'B' | 'C';
    breakoutProbabilityPct: number;
    recommendedStopLoss: number;
    recommendedTarget: number;
    riskRewardRatio: string;
    rationale: string;
  }[];
  sectorTrends: string[];
  riskWarnings: string[];
  strategyVerdict: string;
}

export interface DerivativeScanResult {
  symbol: string;
  name: string;
  index_name: string;
  sector: string;
  expiry_date: string;
  criteria_date: string; // The specific date on which the criteria (Close > Open & High OI) was followed
  contract_type: 'FUTIDX' | 'FUTSTK';
  spot_price: number;
  futures_price: number;
  price_change_pct: number;
  open_interest: number;
  oi_change_pct: number;
  volume: number;
  buildup_type: 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'SHORT_COVERING' | 'NEUTRAL';
  score: number;
  accumulated_zone?: string;
  is_in_accumulation_zone?: boolean;
  
  // Detailed Criteria Date Metrics (Close > Open & High Open Interest)
  criteria_open: number;
  criteria_close: number;
  criteria_high?: number;
  criteria_low?: number;
  criteria_price_change_pct: number;
  criteria_open_interest: number;
  criteria_oi_change_pct: number;
  criteria_volume: number;
  criteria_delivery_pct: number;
  criteria_status?: string;
  recent_bars?: HistoricalBar[];

  // Legacy field mappings for compatibility
  max_interest_date?: string;
  max_interest_open?: number;
  max_interest_close?: number;
  max_interest_delivery_pct?: number;
  max_interest_volume?: number;
}

export interface DerivativeScanConfig {
  indexFilter: string;
  expiryDate: string;
  strategyFilter: 'ALL' | 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'LONG_UNWINDING' | 'SHORT_COVERING';
  minOiChangePct: number;
  minPriceChangePct: number;
  initialCapitalPerTrade: number;
  maxCapitalPerTrade: number;
}

export interface LiveSyncConfig {
  autoSyncEnabled: boolean;
  syncIntervalSec: number; // 60, 300, 900, 1800
  universe: string;
  lastSyncTimestamp?: string;
  lastSyncStatus?: 'SUCCESS' | 'FAILED' | 'IDLE' | 'SYNCING';
  syncedStocksCount?: number;
  lastError?: string;
}

export interface DeleteDataRequest {
  type: 'SYMBOL' | 'DATE_RANGE' | 'INDEX' | 'TABLE' | 'PURGE';
  symbols?: string[];
  startDate?: string;
  endDate?: string;
  indexName?: string;
  tableName?: string;
}

export interface UploadDataResult {
  success: boolean;
  insertedCount: number;
  symbolsCount: number;
  dateRange: { start: string; end: string };
  errors: string[];
  message: string;
}

export type PositionProtectionStatus = 
  | 'BASE_RISK' 
  | 'RATCHET_ACTIVE' 
  | 'BREAKEVEN_LOCKED' 
  | 'PROFIT_SECURED' 
  | 'RUNNER_MODE' 
  | 'SL_TRIGGERED' 
  | 'TARGET_HIT';

export interface ActivePosition {
  id: string;
  symbol: string;
  name?: string;
  sector?: string;
  indexName?: string;
  entryDate: string;
  entryPrice: number;
  shares: number;
  investedAmount: number;
  initialStopLossPrice: number;
  initialStopLossPct: number; // e.g. 2.5%
  initialTargetPrice: number;
  initialTargetPct: number; // e.g. 8.0%
  currentPrice: number;
  currentPriceChangePct: number;
  highestPriceReached: number;
  maxGainFromEntryPct: number;
  dynamicTrailingStopLoss: number;
  dynamicTrailingStopLossPct: number;
  dynamicTargetPrice: number;
  dynamicTargetPct: number;
  dynamicTargetTier: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  lockedProfitAmount: number;
  lockedProfitPct: number;
  protectionStatus: PositionProtectionStatus;
  status: 'OPEN' | 'CLOSED';
  exitDate?: string;
  exitPrice?: number;
  realizedPnL?: number;
  notes?: string;
  isLive?: boolean;
  sparkline?: number[];
  lastUpdated?: string;
}

export interface TradingAccount {
  id: string;
  balance: number;
  total_capital: number;
  last_updated: string;
}

