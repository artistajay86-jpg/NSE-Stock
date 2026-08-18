export interface NSEExpiryItem {
  date: string;
  type: 'STOCK_MONTHLY' | 'INDEX_WEEKLY' | 'INDEX_MONTHLY';
  label: string;
  badge?: string;
  monthName: string;
  year: number;
}

// Dynamically calculate the Last Tuesday of any given month and year
export function getLastTuesday(year: number, month: number): string {
  const date = new Date(year, month + 1, 0); // Last day of the month
  while (date.getDay() !== 2) { // 2 = Tuesday
    date.setDate(date.getDate() - 1);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${day}-${months[month]}-${year}`;
}

// Generate stock monthly expiries dynamically (last Tuesday of each month) starting from August 2026
export function generateStockExpiries(): NSEExpiryItem[] {
  const items: NSEExpiryItem[] = [];
  const startYear = 2026;
  const startMonth = 7; // August
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const cycles = ['Near Month', 'Next Month', 'Far Month'];

  for (let i = 0; i < 12; i++) {
    const m = (startMonth + i) % 12;
    const y = startYear + Math.floor((startMonth + i) / 12);
    const expiryDateStr = getLastTuesday(y, m);
    
    let badge = `${months[m]} ${y} Expiry`;
    if (i < 3) {
      badge = `${cycles[i]} (${months[m]} ${y})`;
    }

    items.push({
      date: expiryDateStr,
      type: 'STOCK_MONTHLY',
      label: `${expiryDateStr} (NSE Stock ${badge})`,
      badge,
      monthName: months[m],
      year: y,
    });
  }
  return items;
}

export const NSE_STOCK_FUTURES_EXPIRIES: NSEExpiryItem[] = generateStockExpiries();

// NSE Index Weekly Expiries (Every Thursday for NIFTY / BANKNIFTY)
export const NSE_INDEX_WEEKLY_EXPIRIES: NSEExpiryItem[] = [
  {
    date: '20-AUG-2026',
    type: 'INDEX_WEEKLY',
    label: '20-AUG-2026 (NIFTY Weekly Expiry)',
    badge: 'Weekly Index',
    monthName: 'AUG',
    year: 2026,
  },
  {
    date: '27-AUG-2026',
    type: 'INDEX_MONTHLY',
    label: '27-AUG-2026 (NIFTY Monthly Expiry)',
    badge: 'Monthly Index',
    monthName: 'AUG',
    year: 2026,
  },
  {
    date: '03-SEP-2026',
    type: 'INDEX_WEEKLY',
    label: '03-SEP-2026 (NIFTY Weekly Expiry)',
    badge: 'Weekly Index',
    monthName: 'SEP',
    year: 2026,
  },
  {
    date: '10-SEP-2026',
    type: 'INDEX_WEEKLY',
    label: '10-SEP-2026 (NIFTY Weekly Expiry)',
    badge: 'Weekly Index',
    monthName: 'SEP',
    year: 2026,
  },
  {
    date: '17-SEP-2026',
    type: 'INDEX_WEEKLY',
    label: '17-SEP-2026 (NIFTY Weekly Expiry)',
    badge: 'Weekly Index',
    monthName: 'SEP',
    year: 2026,
  },
  {
    date: '24-SEP-2026',
    type: 'INDEX_MONTHLY',
    label: '24-SEP-2026 (NIFTY Monthly Expiry)',
    badge: 'Monthly Index',
    monthName: 'SEP',
    year: 2026,
  },
];

export function getNSEStockExpiries(): string[] {
  return NSE_STOCK_FUTURES_EXPIRIES.map(item => item.date);
}

export function getNSEIndexExpiries(): string[] {
  return NSE_INDEX_WEEKLY_EXPIRIES.map(item => item.date);
}
