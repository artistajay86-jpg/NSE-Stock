export interface Constituent {
  symbol: string;
  name: string;
  index_name: string;
  sector: string;
  basePrice: number; // reference accurate current market price for authentic seeding & fallback
  volatility: number; // annual volatility estimate
}

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

export const NIFTY_CONSTITUENTS: Constituent[] = [
  // --- NIFTY 50 (50 key constituents) ---
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', index_name: 'NIFTY 50', sector: 'Oil & Gas', basePrice: 1310, volatility: 0.22 },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd.', index_name: 'NIFTY 50', sector: 'Information Technology', basePrice: 2361, volatility: 0.19 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', index_name: 'NIFTY 50', sector: 'Financial Services', basePrice: 727, volatility: 0.20 },
  { symbol: 'INFY', name: 'Infosys Ltd.', index_name: 'NIFTY 50', sector: 'Information Technology', basePrice: 1169.2, volatility: 0.23 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', index_name: 'NIFTY 50', sector: 'Financial Services', basePrice: 1417, volatility: 0.22 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', index_name: 'NIFTY 50', sector: 'Telecommunication', basePrice: 1992.1, volatility: 0.21 },
  { symbol: 'SBIN', name: 'State Bank of India', index_name: 'NIFTY 50', sector: 'Financial Services', basePrice: 1067.7, volatility: 0.25 },
  { symbol: 'LICI', name: 'Life Insurance Corp of India', index_name: 'NIFTY 50', sector: 'Financial Services', basePrice: 413.5, volatility: 0.24 },
  { symbol: 'ITC', name: 'ITC Ltd.', index_name: 'NIFTY 50', sector: 'Fast Moving Consumer Goods', basePrice: 278.2, volatility: 0.17 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', index_name: 'NIFTY 50', sector: 'Fast Moving Consumer Goods', basePrice: 2077, volatility: 0.18 },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd.', index_name: 'NIFTY 50', sector: 'Construction & Capital Goods', basePrice: 4057, volatility: 0.23 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', index_name: 'NIFTY 50', sector: 'Financial Services', basePrice: 1087, volatility: 0.27 },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd.', index_name: 'NIFTY 50', sector: 'Information Technology', basePrice: 1360, volatility: 0.22 },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd.', index_name: 'NIFTY 50', sector: 'Financial Services', basePrice: 391.15, volatility: 0.21 },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd.', index_name: 'NIFTY 50', sector: 'Financial Services', basePrice: 1217.4, volatility: 0.24 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', index_name: 'NIFTY 50', sector: 'Automobile', basePrice: 985, volatility: 0.30 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd.', index_name: 'NIFTY 50', sector: 'Healthcare & Pharma', basePrice: 1930, volatility: 0.20 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd.', index_name: 'NIFTY 50', sector: 'Automobile', basePrice: 13834, volatility: 0.22 },
  { symbol: 'NTPC', name: 'NTPC Ltd.', index_name: 'NIFTY 50', sector: 'Power & Energy', basePrice: 340, volatility: 0.23 },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corp Ltd.', index_name: 'NIFTY 50', sector: 'Oil & Gas', basePrice: 236.4, volatility: 0.26 },
  { symbol: 'TITAN', name: 'Titan Company Ltd.', index_name: 'NIFTY 50', sector: 'Consumer Durables', basePrice: 5056.2, volatility: 0.23 },
  { symbol: 'POWERGRID', name: 'Power Grid Corp of India Ltd.', index_name: 'NIFTY 50', sector: 'Power & Energy', basePrice: 266.05, volatility: 0.19 },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd.', index_name: 'NIFTY 50', sector: 'Metals & Mining', basePrice: 183.5, volatility: 0.29 },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd.', index_name: 'NIFTY 50', sector: 'Metals & Mining', basePrice: 3035.1, volatility: 0.38 },
  { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ Ltd.', index_name: 'NIFTY 50', sector: 'Services & Logistics', basePrice: 1700, volatility: 0.29 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd.', index_name: 'NIFTY 50', sector: 'Consumer Durables', basePrice: 2696.3, volatility: 0.20 },
  { symbol: 'COALINDIA', name: 'Coal India Ltd.', index_name: 'NIFTY 50', sector: 'Metals & Mining', basePrice: 407.1, volatility: 0.26 },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd.', index_name: 'NIFTY 50', sector: 'Financial Services', basePrice: 2008.3, volatility: 0.25 },
  { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd.', index_name: 'NIFTY 50', sector: 'Automobile', basePrice: 3428.3, volatility: 0.26 },
  { symbol: 'WIPRO', name: 'Wipro Ltd.', index_name: 'NIFTY 50', sector: 'Information Technology', basePrice: 184, volatility: 0.23 },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd.', index_name: 'NIFTY 50', sector: 'Construction Materials', basePrice: 11619, volatility: 0.22 },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd.', index_name: 'NIFTY 50', sector: 'Metals & Mining', basePrice: 1270, volatility: 0.27 },
  { symbol: 'NESTLEIND', name: 'Nestle India Ltd.', index_name: 'NIFTY 50', sector: 'Fast Moving Consumer Goods', basePrice: 1499.1, volatility: 0.16 },
  { symbol: 'GRASIM', name: 'Grasim Industries Ltd.', index_name: 'NIFTY 50', sector: 'Construction Materials', basePrice: 3248.7, volatility: 0.24 },
  { symbol: 'TECHM', name: 'Tech Mahindra Ltd.', index_name: 'NIFTY 50', sector: 'Information Technology', basePrice: 1632.8, volatility: 0.25 },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd.', index_name: 'NIFTY 50', sector: 'Financial Services', basePrice: 1020.8, volatility: 0.28 },
  { symbol: 'HINDALCO', name: 'Hindalco Industries Ltd.', index_name: 'NIFTY 50', sector: 'Metals & Mining', basePrice: 1029.5, volatility: 0.29 },
  { symbol: 'CIPLA', name: 'Cipla Ltd.', index_name: 'NIFTY 50', sector: 'Healthcare & Pharma', basePrice: 1450, volatility: 0.19 },
  { symbol: 'DRREDDY', name: 'Dr. Reddys Laboratories Ltd.', index_name: 'NIFTY 50', sector: 'Healthcare & Pharma', basePrice: 1200, volatility: 0.21 },
  { symbol: 'DIVISLAB', name: 'Divis Laboratories Ltd.', index_name: 'NIFTY 50', sector: 'Healthcare & Pharma', basePrice: 8477, volatility: 0.25 },
  { symbol: 'BPCL', name: 'Bharat Petroleum Corp Ltd.', index_name: 'NIFTY 50', sector: 'Oil & Gas', basePrice: 319.45, volatility: 0.27 },
  { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd.', index_name: 'NIFTY 50', sector: 'Automobile', basePrice: 8066.5, volatility: 0.24 },
  { symbol: 'BRITANNIA', name: 'Britannia Industries Ltd.', index_name: 'NIFTY 50', sector: 'Fast Moving Consumer Goods', basePrice: 5558, volatility: 0.18 },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise Ltd.', index_name: 'NIFTY 50', sector: 'Healthcare & Pharma', basePrice: 8920.5, volatility: 0.23 },
  { symbol: 'TATACONSUM', name: 'Tata Consumer Products Ltd.', index_name: 'NIFTY 50', sector: 'Fast Moving Consumer Goods', basePrice: 1079.5, volatility: 0.21 },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd.', index_name: 'NIFTY 50', sector: 'Automobile', basePrice: 5790, volatility: 0.23 },
  { symbol: 'SBILIFE', name: 'SBI Life Insurance Company Ltd.', index_name: 'NIFTY 50', sector: 'Financial Services', basePrice: 1795, volatility: 0.22 },
  { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd.', index_name: 'NIFTY 50', sector: 'Automobile', basePrice: 11700, volatility: 0.24 },
  { symbol: 'BEL', name: 'Bharat Electronics Ltd.', index_name: 'NIFTY 50', sector: 'Capital Goods', basePrice: 410.8, volatility: 0.28 },
  { symbol: 'TRENT', name: 'Trent Ltd.', index_name: 'NIFTY 50', sector: 'Consumer Services', basePrice: 2978, volatility: 0.32 },

  // --- NIFTY NEXT 50 ---
  { symbol: 'HAL', name: 'Hindustan Aeronautics Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Capital Goods', basePrice: 5029.9, volatility: 0.31 },
  { symbol: 'VBL', name: 'Varun Beverages Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Fast Moving Consumer Goods', basePrice: 435, volatility: 0.26 },
  { symbol: 'VEDL', name: 'Vedanta Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Metals & Mining', basePrice: 267.5, volatility: 0.34 },
  { symbol: 'ZOMATO', name: 'Zomato Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Consumer Services', basePrice: 268, volatility: 0.36 },
  { symbol: 'JIOFIN', name: 'Jio Financial Services Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Financial Services', basePrice: 249.05, volatility: 0.30 },
  { symbol: 'CHOLAFIN', name: 'Cholamandalam Investment & Finance', index_name: 'NIFTY NEXT 50', sector: 'Financial Services', basePrice: 1894.4, volatility: 0.27 },
  { symbol: 'PFC', name: 'Power Finance Corporation Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Financial Services', basePrice: 376, volatility: 0.32 },
  { symbol: 'RECLTD', name: 'REC Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Financial Services', basePrice: 335, volatility: 0.33 },
  { symbol: 'SIEMENS', name: 'Siemens Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Capital Goods', basePrice: 3940, volatility: 0.27 },
  { symbol: 'ABB', name: 'ABB India Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Capital Goods', basePrice: 7649, volatility: 0.28 },
  { symbol: 'DLF', name: 'DLF Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Realty', basePrice: 665, volatility: 0.31 },
  { symbol: 'TORNTPHARM', name: 'Torrent Pharmaceuticals Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Healthcare & Pharma', basePrice: 4833, volatility: 0.22 },
  { symbol: 'GAIL', name: 'GAIL (India) Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Oil & Gas', basePrice: 174.9, volatility: 0.26 },
  { symbol: 'INDIGO', name: 'InterGlobe Aviation Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Services & Aviation', basePrice: 5310, volatility: 0.29 },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda', index_name: 'NIFTY NEXT 50', sector: 'Financial Services', basePrice: 248.22, volatility: 0.28 },
  { symbol: 'PNB', name: 'Punjab National Bank', index_name: 'NIFTY NEXT 50', sector: 'Financial Services', basePrice: 118, volatility: 0.32 },
  { symbol: 'CANBK', name: 'Canara Bank', index_name: 'NIFTY NEXT 50', sector: 'Financial Services', basePrice: 131.25, volatility: 0.30 },
  { symbol: 'HAVELLS', name: 'Havells India Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Consumer Durables', basePrice: 1298, volatility: 0.24 },
  { symbol: 'PIDILITIND', name: 'Pidilite Industries Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Chemicals', basePrice: 1693, volatility: 0.20 },
  { symbol: 'DABUR', name: 'Dabur India Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Fast Moving Consumer Goods', basePrice: 405.25, volatility: 0.17 },
  { symbol: 'SHREECEM', name: 'Shree Cement Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Construction Materials', basePrice: 24795, volatility: 0.24 },
  { symbol: 'MOTHERSON', name: 'Samvardhana Motherson International', index_name: 'NIFTY NEXT 50', sector: 'Automobile', basePrice: 168.3, volatility: 0.31 },
  { symbol: 'SRF', name: 'SRF Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Chemicals', basePrice: 2606, volatility: 0.26 },
  { symbol: 'ICICIPRULI', name: 'ICICI Prudential Life Insurance', index_name: 'NIFTY NEXT 50', sector: 'Financial Services', basePrice: 509.15, volatility: 0.24 },
  { symbol: 'BOSCHLTD', name: 'Bosch Ltd.', index_name: 'NIFTY NEXT 50', sector: 'Automobile', basePrice: 47100, volatility: 0.23 },

  // --- NIFTY MIDCAP 50 ---
  { symbol: 'POLYCAB', name: 'Polycab India Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Capital Goods', basePrice: 9240, volatility: 0.30 },
  { symbol: 'PERSISTENT', name: 'Persistent Systems Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Information Technology', basePrice: 5580, volatility: 0.32 },
  { symbol: 'COFORGE', name: 'Coforge Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Information Technology', basePrice: 1812, volatility: 0.33 },
  { symbol: 'LTTS', name: 'L&T Technology Services Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Information Technology', basePrice: 3476.8, volatility: 0.29 },
  { symbol: 'ASTRAL', name: 'Astral Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Building Products', basePrice: 1556.3, volatility: 0.28 },
  { symbol: 'ASHOKLEY', name: 'Ashok Leyland Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Automobile', basePrice: 171.64, volatility: 0.30 },
  { symbol: 'AUROPHARMA', name: 'Aurobindo Pharma Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Healthcare & Pharma', basePrice: 1622.1, volatility: 0.28 },
  { symbol: 'LUPIN', name: 'Lupin Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Healthcare & Pharma', basePrice: 2235, volatility: 0.27 },
  { symbol: 'FEDERALBNK', name: 'The Federal Bank Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Financial Services', basePrice: 351.3, volatility: 0.26 },
  { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Financial Services', basePrice: 85.69, volatility: 0.29 },
  { symbol: 'MAXHEALTH', name: 'Max Healthcare Institute Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Healthcare & Pharma', basePrice: 1008.6, volatility: 0.28 },
  { symbol: 'APLAPOLLO', name: 'APL Apollo Tubes Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Capital Goods', basePrice: 2083.3, volatility: 0.29 },
  { symbol: 'VOLTAS', name: 'Voltas Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Consumer Durables', basePrice: 1320.5, volatility: 0.29 },
  { symbol: 'DIXON', name: 'Dixon Technologies (India) Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Consumer Durables', basePrice: 14130, volatility: 0.35 },
  { symbol: 'MPHASIS', name: 'Mphasis Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Information Technology', basePrice: 2545, volatility: 0.28 },
  { symbol: 'DEEPAKNTR', name: 'Deepak Nitrite Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Chemicals', basePrice: 1723.2, volatility: 0.31 },
  { symbol: 'BALKRISIND', name: 'Balkrishna Industries Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Automobile', basePrice: 2363.6, volatility: 0.26 },
  { symbol: 'ESCORTS', name: 'Escorts Kubota Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Automobile', basePrice: 3113.7, volatility: 0.28 },
  { symbol: 'PAGEIND', name: 'Page Industries Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Textiles & Apparel', basePrice: 36750, volatility: 0.22 },
  { symbol: 'SUNDARMFIN', name: 'Sundaram Finance Ltd.', index_name: 'NIFTY MIDCAP 50', sector: 'Financial Services', basePrice: 4470.5, volatility: 0.25 },

  // --- NIFTY MIDCAP 100 & SMALLCAP 100 Constituents ---
  { symbol: 'SUZLON', name: 'Suzlon Energy Ltd.', index_name: 'NIFTY MIDCAP 100', sector: 'Power & Energy', basePrice: 75.4, volatility: 0.42 },
  { symbol: 'IDEA', name: 'Vodafone Idea Ltd.', index_name: 'NIFTY MIDCAP 100', sector: 'Telecommunication', basePrice: 9.8, volatility: 0.45 },
  { symbol: 'BHEL', name: 'Bharat Heavy Electricals Ltd.', index_name: 'NIFTY MIDCAP 100', sector: 'Capital Goods', basePrice: 242.6, volatility: 0.38 },
  { symbol: 'IREDA', name: 'Indian Renewable Energy Dev Agency', index_name: 'NIFTY MIDCAP 100', sector: 'Financial Services', basePrice: 188.5, volatility: 0.40 },
  { symbol: 'RVNL', name: 'Rail Vikas Nigam Ltd.', index_name: 'NIFTY MIDCAP 100', sector: 'Construction & Railways', basePrice: 412.0, volatility: 0.39 },
  { symbol: 'NHPC', name: 'NHPC Ltd.', index_name: 'NIFTY MIDCAP 100', sector: 'Power & Energy', basePrice: 92.4, volatility: 0.28 },
  { symbol: 'KALYANKJIL', name: 'Kalyan Jewellers India Ltd.', index_name: 'NIFTY MIDCAP 100', sector: 'Consumer Durables', basePrice: 620.0, volatility: 0.35 },
  { symbol: 'EXIDEIND', name: 'Exide Industries Ltd.', index_name: 'NIFTY MIDCAP 100', sector: 'Automobile', basePrice: 445.0, volatility: 0.32 },
  { symbol: 'CDSL', name: 'Central Depository Services (India) Ltd.', index_name: 'NIFTY SMALLCAP 100', sector: 'Financial Services', basePrice: 1450.0, volatility: 0.36 },
  { symbol: 'BSE', name: 'BSE Ltd.', index_name: 'NIFTY SMALLCAP 100', sector: 'Financial Services', basePrice: 4200.0, volatility: 0.40 },
  { symbol: 'HUDCO', name: 'Housing & Urban Dev Corp Ltd.', index_name: 'NIFTY SMALLCAP 100', sector: 'Financial Services', basePrice: 215.0, volatility: 0.37 },
  { symbol: 'NBCC', name: 'NBCC (India) Ltd.', index_name: 'NIFTY SMALLCAP 100', sector: 'Construction Materials', basePrice: 98.5, volatility: 0.38 },
  { symbol: 'IRFC', name: 'Indian Railway Finance Corp Ltd.', index_name: 'NIFTY MIDCAP 100', sector: 'Financial Services', basePrice: 154.2, volatility: 0.35 },
  { symbol: 'MAZDOCK', name: 'Mazagon Dock Shipbuilders Ltd.', index_name: 'NIFTY MIDCAP 100', sector: 'Capital Goods', basePrice: 3850.0, volatility: 0.42 },
  { symbol: 'COCHINSHIP', name: 'Cochin Shipyard Ltd.', index_name: 'NIFTY MIDCAP 100', sector: 'Capital Goods', basePrice: 1420.0, volatility: 0.43 },

  // --- NIFTY BANK / FINANCIAL SERVICES ---
  { symbol: 'AUBANK', name: 'AU Small Finance Bank Ltd.', index_name: 'NIFTY BANK', sector: 'Financial Services', basePrice: 645.0, volatility: 0.28 },
  { symbol: 'BANDHANBNK', name: 'Bandhan Bank Ltd.', index_name: 'NIFTY BANK', sector: 'Financial Services', basePrice: 168.0, volatility: 0.33 },
  { symbol: 'BANKINDIA', name: 'Bank of India', index_name: 'NIFTY BANK', sector: 'Financial Services', basePrice: 112.5, volatility: 0.32 },
  { symbol: 'UNIONBANK', name: 'Union Bank of India', index_name: 'NIFTY BANK', sector: 'Financial Services', basePrice: 122.0, volatility: 0.31 },

  // --- NIFTY REALTY ---
  { symbol: 'GODREJPROP', name: 'Godrej Properties Ltd.', index_name: 'NIFTY REALTY', sector: 'Realty', basePrice: 2850.0, volatility: 0.34 },
  { symbol: 'OBEROIRLTY', name: 'Oberoi Realty Ltd.', index_name: 'NIFTY REALTY', sector: 'Realty', basePrice: 1940.0, volatility: 0.31 },
  { symbol: 'PHOENIXLTD', name: 'The Phoenix Mills Ltd.', index_name: 'NIFTY REALTY', sector: 'Realty', basePrice: 1680.0, volatility: 0.29 },
  { symbol: 'BRIGADE', name: 'Brigade Enterprises Ltd.', index_name: 'NIFTY REALTY', sector: 'Realty', basePrice: 1250.0, volatility: 0.33 },
  { symbol: 'PRESTIGE', name: 'Prestige Estates Projects Ltd.', index_name: 'NIFTY REALTY', sector: 'Realty', basePrice: 1620.0, volatility: 0.35 },

  // --- NIFTY IT ---
  { symbol: 'LTIM', name: 'LTIMindtree Ltd.', index_name: 'NIFTY IT', sector: 'Information Technology', basePrice: 5740.0, volatility: 0.28 },
  { symbol: 'TATAELXSI', name: 'Tata Elxsi Ltd.', index_name: 'NIFTY IT', sector: 'Information Technology', basePrice: 6850.0, volatility: 0.30 },
  { symbol: 'KPITTECH', name: 'KPIT Technologies Ltd.', index_name: 'NIFTY IT', sector: 'Information Technology', basePrice: 1490.0, volatility: 0.36 },
  { symbol: 'CYIENT', name: 'Cyient Ltd.', index_name: 'NIFTY IT', sector: 'Information Technology', basePrice: 1820.0, volatility: 0.34 },

  // --- NIFTY PHARMA & HEALTHCARE ---
  { symbol: 'ZYDUSLIFE', name: 'Zydus Lifesciences Ltd.', index_name: 'NIFTY PHARMA', sector: 'Healthcare & Pharma', basePrice: 1040.0, volatility: 0.26 },
  { symbol: 'MANKIND', name: 'Mankind Pharma Ltd.', index_name: 'NIFTY PHARMA', sector: 'Healthcare & Pharma', basePrice: 2450.0, volatility: 0.25 },
  { symbol: 'BIOCON', name: 'Biocon Ltd.', index_name: 'NIFTY PHARMA', sector: 'Healthcare & Pharma', basePrice: 345.0, volatility: 0.29 },
  { symbol: 'ALKEM', name: 'Alkem Laboratories Ltd.', index_name: 'NIFTY PHARMA', sector: 'Healthcare & Pharma', basePrice: 5320.0, volatility: 0.24 },
  { symbol: 'GLENMARK', name: 'Glenmark Pharmaceuticals Ltd.', index_name: 'NIFTY PHARMA', sector: 'Healthcare & Pharma', basePrice: 1540.0, volatility: 0.30 },

  // --- NIFTY METAL ---
  { symbol: 'NMDC', name: 'NMDC Ltd.', index_name: 'NIFTY METAL', sector: 'Metals & Mining', basePrice: 228.0, volatility: 0.32 },
  { symbol: 'NATIONALUM', name: 'National Aluminium Co Ltd.', index_name: 'NIFTY METAL', sector: 'Metals & Mining', basePrice: 215.0, volatility: 0.36 },
  { symbol: 'JINDALSTEL', name: 'Jindal Steel & Power Ltd.', index_name: 'NIFTY METAL', sector: 'Metals & Mining', basePrice: 940.0, volatility: 0.31 },
  { symbol: 'SAIL', name: 'Steel Authority of India Ltd.', index_name: 'NIFTY METAL', sector: 'Metals & Mining', basePrice: 124.0, volatility: 0.34 },

  // --- NIFTY AUTO ---
  { symbol: 'TIINDIA', name: 'Tube Investments of India Ltd.', index_name: 'NIFTY AUTO', sector: 'Automobile', basePrice: 3820.0, volatility: 0.27 },
  { symbol: 'TVSMOTOR', name: 'TVS Motor Company Ltd.', index_name: 'NIFTY AUTO', sector: 'Automobile', basePrice: 2380.0, volatility: 0.28 },
  { symbol: 'SONACOMS', name: 'Sona BLW Precision Forgings', index_name: 'NIFTY AUTO', sector: 'Automobile', basePrice: 640.0, volatility: 0.30 },
  { symbol: 'BHARATFORG', name: 'Bharat Forge Ltd.', index_name: 'NIFTY AUTO', sector: 'Automobile', basePrice: 1380.0, volatility: 0.28 },

  // --- NIFTY FMCG ---
  { symbol: 'MARICO', name: 'Marico Ltd.', index_name: 'NIFTY FMCG', sector: 'Fast Moving Consumer Goods', basePrice: 625.0, volatility: 0.19 },
  { symbol: 'COLPAL', name: 'Colgate-Palmolive (India) Ltd.', index_name: 'NIFTY FMCG', sector: 'Fast Moving Consumer Goods', basePrice: 2980.0, volatility: 0.18 },
  { symbol: 'GODREJCP', name: 'Godrej Consumer Products Ltd.', index_name: 'NIFTY FMCG', sector: 'Fast Moving Consumer Goods', basePrice: 1240.0, volatility: 0.21 },
  { symbol: 'EMAMILTD', name: 'Emami Ltd.', index_name: 'NIFTY FMCG', sector: 'Fast Moving Consumer Goods', basePrice: 680.0, volatility: 0.22 },

  // --- NIFTY ENERGY & INFRA ---
  { symbol: 'ADANIGREEN', name: 'Adani Green Energy Ltd.', index_name: 'NIFTY ENERGY', sector: 'Power & Energy', basePrice: 1240.0, volatility: 0.42 },
  { symbol: 'ADANIPOWER', name: 'Adani Power Ltd.', index_name: 'NIFTY ENERGY', sector: 'Power & Energy', basePrice: 620.0, volatility: 0.40 },
  { symbol: 'TATAENERGY', name: 'Tata Power Company Ltd.', index_name: 'NIFTY ENERGY', sector: 'Power & Energy', basePrice: 395.0, volatility: 0.29 },
  { symbol: 'IOC', name: 'Indian Oil Corporation Ltd.', index_name: 'NIFTY ENERGY', sector: 'Oil & Gas', basePrice: 142.0, volatility: 0.26 },
  { symbol: 'OIL', name: 'Oil India Ltd.', index_name: 'NIFTY ENERGY', sector: 'Oil & Gas', basePrice: 485.0, volatility: 0.33 },
  { symbol: 'GMRINFRA', name: 'GMR Airports Infrastructure Ltd.', index_name: 'NIFTY INFRA', sector: 'Services & Logistics', basePrice: 84.5, volatility: 0.32 },
  { symbol: 'CONCOR', name: 'Container Corp of India Ltd.', index_name: 'NIFTY INFRA', sector: 'Services & Logistics', basePrice: 795.0, volatility: 0.28 }
];

