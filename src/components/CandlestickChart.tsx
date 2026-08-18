import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { CandlestickChart as CandlestickIcon, TrendingUp, TrendingDown, Layers, BarChart2, Zap } from 'lucide-react';
import { HistoricalBar } from '../types';

interface CandlestickChartProps {
  data?: HistoricalBar[];
  bars?: HistoricalBar[];
  height?: number;
  isDark?: boolean;
  zoneLower?: number;
  zoneUpper?: number;
  anchorLow?: number;
  criteriaDate?: string;
  showVolume?: boolean;
  showDelivery?: boolean;
  title?: string;
  symbol?: string;
}

interface CustomCandleProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: any;
  yAxis?: any;
}

// Custom SVG Candlestick renderer for Recharts
const CandlestickBar: React.FC<any> = (props) => {
  const { x, width, payload, yAxis } = props;
  if (!payload || !yAxis || x === undefined) return null;

  const { open, close, high, low, date } = payload;
  if (open === undefined || close === undefined || high === undefined || low === undefined) return null;

  const isBullish = close >= open;
  const candleColor = isBullish ? '#10b981' : '#f43f5e';
  const wickColor = isBullish ? '#059669' : '#e11d48';

  const yOpen = yAxis.scale(open);
  const yClose = yAxis.scale(close);
  const yHigh = yAxis.scale(high);
  const yLow = yAxis.scale(low);

  const candleTop = Math.min(yOpen, yClose);
  const candleHeight = Math.max(Math.abs(yClose - yOpen), 1.5);
  const candleWidth = Math.max(Math.min(width * 0.7, 14), 3);
  const candleX = x + (width - candleWidth) / 2;
  const centerX = x + width / 2;

  return (
    <g className="recharts-candlestick">
      {/* High-Low Wick */}
      <line
        x1={centerX}
        y1={yHigh}
        x2={centerX}
        y2={yLow}
        stroke={wickColor}
        strokeWidth={1.25}
      />
      {/* Real Body */}
      <rect
        x={candleX}
        y={candleTop}
        width={candleWidth}
        height={candleHeight}
        fill={candleColor}
        stroke={wickColor}
        strokeWidth={1}
        rx={0.5}
        fillOpacity={isBullish ? 0.9 : 0.9}
      />
    </g>
  );
};

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  bars,
  height = 300,
  isDark = true,
  zoneLower,
  zoneUpper,
  anchorLow,
  criteriaDate,
  showVolume = true,
  showDelivery = true,
  title,
  symbol,
}) => {
  const [chartType, setChartType] = useState<'CANDLESTICK' | 'AREA' | 'LINE' | 'COMBINED'>('CANDLESTICK');

  const rawBars = bars || data || [];

  const processedData = useMemo(() => {
    if (!rawBars || rawBars.length === 0) return [];
    
    // Calculate 20-day delivery SMA & VWAP
    return rawBars.map((d, i, arr) => {
      let delSum = 0;
      let count = 0;
      for (let j = Math.max(0, i - 19); j <= i; j++) {
        if (arr[j].delivery_pct) {
          delSum += arr[j].delivery_pct;
          count++;
        }
      }
      const deliverySma = count > 0 ? +(delSum / count).toFixed(1) : d.delivery_pct || 0;
      const isBullish = (d.close || 0) >= (d.open || d.close || 0);
      const priceChgPct = d.open && d.open > 0 ? +(((d.close - d.open) / d.open) * 100).toFixed(2) : 0;

      return {
        ...d,
        deliverySma,
        isBullish,
        priceChgPct,
        // Range placeholder for Candlestick bar
        candleRange: [d.low, d.high],
      };
    });
  }, [rawBars]);

  const { minPrice, maxPrice } = useMemo(() => {
    if (!processedData.length) return { minPrice: 0, maxPrice: 100 };
    let min = Infinity;
    let max = -Infinity;
    for (const d of processedData) {
      if (d.low !== undefined && d.low < min) min = d.low;
      if (d.high !== undefined && d.high > max) max = d.high;
      if (d.close !== undefined && d.close < min) min = d.close;
      if (d.close !== undefined && d.close > max) max = d.close;
    }
    if (zoneLower && zoneLower < min) min = zoneLower;
    if (zoneUpper && zoneUpper > max) max = zoneUpper;
    if (anchorLow && anchorLow < min) min = anchorLow;

    const pad = (max - min) * 0.05 || 5;
    return {
      minPrice: Math.floor(min - pad),
      maxPrice: Math.ceil(max + pad),
    };
  }, [processedData, zoneLower, zoneUpper, anchorLow]);

  if (!processedData.length) {
    return (
      <div className={`flex items-center justify-center h-48 rounded border ${isDark ? 'bg-[#121214] border-[#27272a] text-[#71717a]' : 'bg-slate-50 border-slate-200 text-slate-400'} font-mono text-xs`}>
        No historical price bars available for charting.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Chart Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 font-mono text-xs font-bold text-emerald-400 uppercase">
            <CandlestickIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>{title || (symbol ? `${symbol} Candlestick & Volume Chart` : 'OHLC Candlestick Chart')}</span>
          </div>
          {criteriaDate && (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              ★ Criteria Date: {criteriaDate} (Close &gt; Open)
            </span>
          )}
        </div>

        {/* Chart View Mode Switcher */}
        <div className={`flex items-center space-x-0.5 p-0.5 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-100 border-slate-200'} text-[10px] font-mono`}>
          <button
            onClick={() => setChartType('CANDLESTICK')}
            className={`px-2 py-0.5 rounded font-bold transition-all flex items-center space-x-1 ${
              chartType === 'CANDLESTICK'
                ? 'bg-emerald-500 text-[#09090b]'
                : isDark
                ? 'text-[#71717a] hover:text-[#e4e4e7]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🕯️ Candlestick</span>
          </button>

          <button
            onClick={() => setChartType('COMBINED')}
            className={`px-2 py-0.5 rounded font-bold transition-all flex items-center space-x-1 ${
              chartType === 'COMBINED'
                ? 'bg-emerald-500 text-[#09090b]'
                : isDark
                ? 'text-[#71717a] hover:text-[#e4e4e7]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📊 Candle + Area</span>
          </button>

          <button
            onClick={() => setChartType('AREA')}
            className={`px-2 py-0.5 rounded font-bold transition-all ${
              chartType === 'AREA'
                ? 'bg-emerald-500 text-[#09090b]'
                : isDark
                ? 'text-[#71717a] hover:text-[#e4e4e7]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📈 Area</span>
          </button>

          <button
            onClick={() => setChartType('LINE')}
            className={`px-2 py-0.5 rounded font-bold transition-all ${
              chartType === 'LINE'
                ? 'bg-emerald-500 text-[#09090b]'
                : isDark
                ? 'text-[#71717a] hover:text-[#e4e4e7]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Line</span>
          </button>
        </div>
      </div>

      {/* Main Candlestick / Price Chart Container */}
      <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
        <div style={{ height: `${height}px`, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={processedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="candleAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <XAxis dataKey="date" stroke="#52525b" fontSize={9} tickLine={false} />
              <YAxis
                domain={[minPrice, maxPrice]}
                stroke="#52525b"
                fontSize={9}
                tickLine={false}
                tickFormatter={val => `₹${val}`}
                orientation="right"
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#121214' : '#ffffff',
                  borderColor: isDark ? '#27272a' : '#e2e8f0',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
                labelFormatter={label => `📅 Date: ${label}`}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  const isBull = (d.close || 0) >= (d.open || d.close || 0);
                  const isCritDate = criteriaDate && d.date === criteriaDate;

                  return (
                    <div className={`p-2 rounded font-mono text-[11px] space-y-1 ${isDark ? 'bg-[#121214] text-[#e4e4e7] border border-[#27272a]' : 'bg-white text-slate-800 border border-slate-200'} shadow-lg`}>
                      <div className="flex items-center justify-between border-b border-[#27272a]/50 pb-1">
                        <span className="font-bold">{label}</span>
                        {isCritDate && (
                          <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[9px] border border-emerald-500/30">
                            CRITERIA MET (Close &gt; Open)
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                        <div>Open: <strong className="text-slate-300">₹{d.open?.toFixed(2) || d.close?.toFixed(2)}</strong></div>
                        <div>High: <strong className="text-emerald-400">₹{d.high?.toFixed(2) || d.close?.toFixed(2)}</strong></div>
                        <div>Low: <strong className="text-rose-400">₹{d.low?.toFixed(2) || d.close?.toFixed(2)}</strong></div>
                        <div>Close: <strong className={isBull ? 'text-emerald-400' : 'text-rose-400'}>₹{d.close?.toFixed(2)}</strong></div>
                      </div>
                      <div className="pt-1 border-t border-[#27272a]/40 flex items-center justify-between text-[10px]">
                        <span className={`font-bold ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Candle: {isBull ? '▲ Bullish (+)' : '▼ Bearish (-)'} {d.priceChgPct}%
                        </span>
                        {d.delivery_pct && <span className="text-teal-400">Del: {d.delivery_pct}%</span>}
                      </div>
                      {d.open_interest && (
                        <div className="text-[10px] text-teal-300">
                          Open Interest: <strong>{Number(d.open_interest).toLocaleString('en-IN')}</strong>
                        </div>
                      )}
                    </div>
                  );
                }}
              />

              {/* Shaded Accumulation Corridor (+5% to +6%) */}
              {zoneLower && zoneUpper && (
                <>
                  {React.createElement(ReferenceArea as any, {
                    y1: zoneLower,
                    y2: zoneUpper,
                    fill: '#10b981',
                    fillOpacity: 0.12,
                    stroke: '#10b981',
                    strokeOpacity: 0.3,
                  })}
                  <ReferenceLine
                    y={zoneLower}
                    stroke="#10b981"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    label={{ value: `Zone Lower (+5%): ₹${zoneLower}`, position: 'insideTopRight', fill: '#10b981', fontSize: 9, fontFamily: 'monospace' }}
                  />
                  <ReferenceLine
                    y={zoneUpper}
                    stroke="#059669"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    label={{ value: `Zone Upper (+6%): ₹${zoneUpper}`, position: 'insideTopRight', fill: '#059669', fontSize: 9, fontFamily: 'monospace' }}
                  />
                </>
              )}

              {/* Anchor Lowest Price Line */}
              {anchorLow && (
                <ReferenceLine
                  y={anchorLow}
                  stroke="#f59e0b"
                  strokeWidth={1.2}
                  strokeDasharray="4 4"
                  label={{ value: `Anchor Low: ₹${anchorLow}`, position: 'insideBottomLeft', fill: '#f59e0b', fontSize: 9, fontFamily: 'monospace' }}
                />
              )}

              {/* Highlight Criteria Date Vertical Line */}
              {criteriaDate && (
                <ReferenceLine
                  x={criteriaDate}
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  label={{ value: `★ Criteria (Close > Open)`, position: 'top', fill: '#10b981', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}
                />
              )}

              {/* Area Underlay */}
              {(chartType === 'AREA' || chartType === 'COMBINED') && (
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="#10b981"
                  strokeWidth={chartType === 'COMBINED' ? 1 : 1.5}
                  fillOpacity={chartType === 'COMBINED' ? 0.15 : 0.35}
                  fill="url(#candleAreaGrad)"
                />
              )}

              {/* Line Chart */}
              {chartType === 'LINE' && (
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              )}

              {/* Native Candlesticks (Rendered via custom bar shapes) */}
              {(chartType === 'CANDLESTICK' || chartType === 'COMBINED') && (
                <Bar
                  dataKey="high"
                  shape={<CandlestickBar />}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Volume & Delivery Percentage Sub-Chart */}
        {(showVolume || showDelivery) && (
          <div className="mt-2 pt-2 border-t border-[#27272a]/60 h-24 w-full">
            <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <BarChart2 className="w-3 h-3 text-teal-400" />
                <span>Delivery % & Volume Distribution</span>
              </span>
              <span className="text-teal-400">Green line: 20-day Delivery SMA | Red line: 50% Benchmark</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={processedData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, 100]} stroke="#52525b" fontSize={9} tickLine={false} orientation="right" />
                <Tooltip
                  contentStyle={{ backgroundColor: isDark ? '#121214' : '#ffffff', borderColor: '#27272a', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace' }}
                  formatter={(val: any, name: any) => [
                    name === 'delivery_pct' ? `${val}%` : `${val}%`,
                    name === 'delivery_pct' ? 'Daily Delivery %' : '20D Delivery SMA',
                  ]}
                />
                <Bar dataKey="delivery_pct" fill="#0d9488" fillOpacity={0.65} radius={[1, 1, 0, 0]} />
                <Line type="monotone" dataKey="deliverySma" stroke="#2dd4bf" strokeWidth={1.5} dot={false} />
                <ReferenceLine y={50} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} />
                {criteriaDate && (
                  <ReferenceLine x={criteriaDate} stroke="#10b981" strokeWidth={1.5} strokeDasharray="2 2" />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
