import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';
import { NIFTY_CONSTITUENTS } from './constituents';
import { DatabaseStats, HistoricalBar, PriceAlert, SavedAnalysis, ScanConfig, ScanResult, Stock } from '../src/types';

const DB_FILE_PATH = path.join(process.cwd(), 'market_data.duckdb');
const WAL_FILE_PATH = path.join(process.cwd(), 'market_data.duckdb.wal');

export class DuckDBManager {
  private db: duckdb.Database | null = null;
  private connection: duckdb.Connection | null = null;
  private isInitialized = false;

  constructor() {
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown() {
    const handleExit = async (signal: string) => {
      console.log(`[DuckDB] Received ${signal}. Running CHECKPOINT and closing database cleanly...`);
      try {
        await this.runCheckpoint();
        this.close();
      } catch (err) {
        console.error('[DuckDB] Error during graceful shutdown checkpoint:', err);
      }
      process.exit(0);
    };

    process.on('SIGINT', () => handleExit('SIGINT'));
    process.on('SIGTERM', () => handleExit('SIGTERM'));
  }

  public async init(): Promise<void> {
    if (this.isInitialized && this.connection) {
      return;
    }

    try {
      this.openDatabase();
      await this.createSchema();
      await this.seedConstituents();
      this.isInitialized = true;
      console.log('[DuckDB] Database successfully initialized at:', DB_FILE_PATH);
    } catch (err: any) {
      console.error('[DuckDB] Initialization failed, attempting WAL recovery...', err);
      this.recoverFromWalError();
      this.openDatabase();
      await this.createSchema();
      await this.seedConstituents();
      this.isInitialized = true;
    }
  }

  private openDatabase() {
    try {
      this.db = new duckdb.Database(DB_FILE_PATH);
      this.connection = this.db.connect();
    } catch (err) {
      throw err;
    }
  }

  private recoverFromWalError() {
    console.warn('[DuckDB] Executing WAL quarantine & recovery protocol...');
    try {
      this.close();
      if (fs.existsSync(WAL_FILE_PATH)) {
        const backupWal = `${WAL_FILE_PATH}.corrupt_${Date.now()}`;
        fs.renameSync(WAL_FILE_PATH, backupWal);
        console.warn(`[DuckDB] Quarantined corrupted WAL file to ${backupWal}`);
      }
    } catch (quarantineErr) {
      console.error('[DuckDB] Failed to quarantine WAL file:', quarantineErr);
    }
  }

  public close(): void {
    if (this.connection) {
      try {
        this.connection = null;
      } catch (e) {
        console.error('[DuckDB] Error closing connection:', e);
      }
    }
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
      } catch (e) {
        console.error('[DuckDB] Error closing DB:', e);
      }
    }
    this.isInitialized = false;
  }

  public query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        return reject(new Error('DuckDB connection is not open'));
      }
      this.connection.all(sql, ...params, (err: any, res: any) => {
        if (err) {
          return reject(err);
        }
        resolve(res as T[]);
      });
    });
  }

  public run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        return reject(new Error('DuckDB connection is not open'));
      }
      this.connection.run(sql, ...params, (err: any) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  private async createSchema(): Promise<void> {
    // Detect and upgrade old historical_data table schema
    try {
      const columns = await this.query(`PRAGMA table_info('historical_data')`);
      const hasExpiry = columns.some((c: any) => c.name === 'expiry_date');
      if (columns.length > 0 && !hasExpiry) {
        console.log('[DuckDB] Upgrading historical_data schema to support contract-wise expiries & OI...');
        await this.run(`DROP TABLE IF EXISTS historical_data;`);
      }
    } catch (e) {
      console.log('[DuckDB] Table historical_data does not exist yet, initializing new schema.');
    }

    // 1. Stocks table
    await this.run(`
      CREATE TABLE IF NOT EXISTS stocks (
        symbol VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        index_name VARCHAR NOT NULL,
        sector VARCHAR NOT NULL,
        active BOOLEAN DEFAULT TRUE
      );
    `);

    // 2. Historical Bars table
    await this.run(`
      CREATE TABLE IF NOT EXISTS historical_data (
        symbol VARCHAR,
        date DATE,
        open DOUBLE,
        high DOUBLE,
        low DOUBLE,
        close DOUBLE,
        volume BIGINT,
        delivery_qty BIGINT,
        delivery_pct DOUBLE,
        expiry_date VARCHAR DEFAULT 'SPOT',
        open_interest BIGINT DEFAULT 0,
        oi_change_pct DOUBLE DEFAULT 0.0,
        PRIMARY KEY (symbol, date, expiry_date)
      );
    `);

    // Create index on date & symbol for lightning queries
    await this.run(`
      CREATE INDEX IF NOT EXISTS idx_hist_symbol_date ON historical_data(symbol, date);
    `);

    // 3. Download Logs
    await this.run(`
      CREATE TABLE IF NOT EXISTS download_logs (
        id VARCHAR PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        index_name VARCHAR,
        symbol VARCHAR,
        records_added INTEGER,
        status VARCHAR,
        error_message VARCHAR
      );
    `);

    // 4. Saved Analyses
    await this.run(`
      CREATE TABLE IF NOT EXISTS saved_analyses (
        id VARCHAR PRIMARY KEY,
        title VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        type VARCHAR NOT NULL,
        config_json VARCHAR NOT NULL,
        results_json VARCHAR NOT NULL
      );
    `);

    // 5. Trade History / Backtest logs
    await this.run(`
      CREATE TABLE IF NOT EXISTS trade_history (
        id VARCHAR PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        backtest_id VARCHAR,
        symbol VARCHAR,
        entry_date DATE,
        exit_date DATE,
        entry_price DOUBLE,
        exit_price DOUBLE,
        pnl_pct DOUBLE,
        exit_reason VARCHAR,
        holding_days INTEGER
      );
    `);

    // 6. Price & Accumulation Alerts
    await this.run(`
      CREATE TABLE IF NOT EXISTS price_alerts (
        id VARCHAR PRIMARY KEY,
        symbol VARCHAR NOT NULL,
        name VARCHAR,
        target_price DOUBLE,
        condition VARCHAR NOT NULL,
        email VARCHAR,
        enable_push BOOLEAN DEFAULT TRUE,
        enable_email BOOLEAN DEFAULT FALSE,
        trigger_status VARCHAR DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        triggered_at TIMESTAMP,
        notes VARCHAR,
        last_trigger_details VARCHAR
      );
    `);

    // 7. Active Positions / Ongoing Trades with Dynamic Trailing Stop Loss
    await this.run(`
      CREATE TABLE IF NOT EXISTS active_positions (
        id VARCHAR PRIMARY KEY,
        symbol VARCHAR NOT NULL,
        entry_date DATE NOT NULL,
        entry_price DOUBLE NOT NULL,
        shares INTEGER DEFAULT 100,
        initial_stop_loss_pct DOUBLE DEFAULT 2.5,
        initial_target_pct DOUBLE DEFAULT 8.0,
        highest_price_reached DOUBLE,
        notes VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR DEFAULT 'OPEN',
        exit_date DATE,
        exit_price DOUBLE,
        realized_pnl DOUBLE
      );
    `);
    // 8. Trading Account / Virtual Wallet for Paper Trading
    await this.run(`
      CREATE TABLE IF NOT EXISTS trading_account (
        id VARCHAR PRIMARY KEY,
        balance DOUBLE DEFAULT 1000000.0,
        total_capital DOUBLE DEFAULT 1000000.0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure at least one account exists
    const accounts = await this.query('SELECT count(*) as cnt FROM trading_account');
    if (Number(accounts[0]?.cnt || 0) === 0) {
      await this.run(`INSERT INTO trading_account (id, balance, total_capital) VALUES ('main_account', 1000000.0, 1000000.0)`);
    }
  }

  private async seedConstituents(): Promise<void> {
    for (const c of NIFTY_CONSTITUENTS) {
      await this.run(
        `INSERT OR REPLACE INTO stocks (symbol, name, index_name, sector, active) VALUES (?, ?, ?, ?, ?)`,
        [c.symbol, c.name, c.index_name, c.sector, true]
      );
    }
  }

  public async runCheckpoint(): Promise<void> {
    try {
      await this.run('CHECKPOINT;');
      console.log('[DuckDB] CHECKPOINT completed successfully.');
    } catch (e) {
      console.error('[DuckDB] Checkpoint error:', e);
    }
  }

  public async getStocks(indexFilter?: string, sectorFilter?: string): Promise<Stock[]> {
    let sql = `
      SELECT 
        s.symbol, 
        s.name, 
        s.index_name, 
        s.sector, 
        s.active,
        (SELECT close FROM historical_data h WHERE h.symbol = s.symbol ORDER BY h.date DESC LIMIT 1) as latest_price,
        (SELECT strftime(h.date, '%Y-%m-%d') FROM historical_data h WHERE h.symbol = s.symbol ORDER BY h.date ASC LIMIT 1) as first_date,
        (SELECT strftime(h.date, '%Y-%m-%d') FROM historical_data h WHERE h.symbol = s.symbol ORDER BY h.date DESC LIMIT 1) as last_date,
        (SELECT count(*) FROM historical_data h WHERE h.symbol = s.symbol) as data_points
      FROM stocks s
      WHERE 1=1
    `;
    const params: any[] = [];
    if (indexFilter && indexFilter !== 'ALL') {
      if (indexFilter === 'NIFTY BANK') {
        sql += ` AND (s.index_name = 'NIFTY BANK' OR (s.sector = 'Financial Services' AND (s.name LIKE '%Bank%' OR s.symbol LIKE '%BK%' OR s.symbol LIKE '%BANK%')))`;
      } else if (indexFilter === 'NIFTY IT') {
        sql += ` AND (s.index_name = 'NIFTY IT' OR s.sector = 'Information Technology')`;
      } else if (indexFilter === 'NIFTY AUTO') {
        sql += ` AND (s.index_name = 'NIFTY AUTO' OR s.sector = 'Automobile')`;
      } else if (indexFilter === 'NIFTY PHARMA') {
        sql += ` AND (s.index_name = 'NIFTY PHARMA' OR s.sector = 'Healthcare & Pharma')`;
      } else if (indexFilter === 'NIFTY FMCG') {
        sql += ` AND (s.index_name = 'NIFTY FMCG' OR s.sector = 'Fast Moving Consumer Goods')`;
      } else if (indexFilter === 'NIFTY METAL') {
        sql += ` AND (s.index_name = 'NIFTY METAL' OR s.sector = 'Metals & Mining')`;
      } else if (indexFilter === 'NIFTY FINANCIAL SERVICES') {
        sql += ` AND (s.index_name = 'NIFTY FINANCIAL SERVICES' OR s.sector = 'Financial Services')`;
      } else if (indexFilter === 'NIFTY REALTY') {
        sql += ` AND (s.index_name = 'NIFTY REALTY' OR s.sector = 'Realty')`;
      } else if (indexFilter === 'NIFTY ENERGY') {
        sql += ` AND (s.index_name = 'NIFTY ENERGY' OR s.sector = 'Power & Energy' OR s.sector = 'Oil & Gas')`;
      } else if (indexFilter === 'NIFTY INFRA') {
        sql += ` AND (s.index_name = 'NIFTY INFRA' OR s.sector LIKE '%Capital Goods%' OR s.sector LIKE '%Construction%' OR s.sector LIKE '%Logistics%')`;
      } else {
        sql += ` AND s.index_name = ?`;
        params.push(indexFilter);
      }
    }
    if (sectorFilter && sectorFilter !== 'ALL') {
      sql += ` AND s.sector = ?`;
      params.push(sectorFilter);
    }
    sql += ` ORDER BY s.symbol ASC`;
    const rows = await this.query(sql, params);
    return rows.map(r => ({
      symbol: r.symbol,
      name: r.name,
      index_name: r.index_name,
      sector: r.sector,
      active: Boolean(r.active),
      latest_price: r.latest_price ? Number(r.latest_price) : undefined,
      first_date: r.first_date || undefined,
      last_date: r.last_date || undefined,
      data_points: Number(r.data_points || 0),
    }));
  }

  public async getHistoricalData(symbol: string, startDate?: string, endDate?: string, expiryDate: string = 'SPOT'): Promise<HistoricalBar[]> {
    let sql = `
      SELECT 
        symbol, 
        strftime(date, '%Y-%m-%d') as date, 
        open, high, low, close, volume, delivery_qty, delivery_pct,
        expiry_date, open_interest, oi_change_pct
      FROM historical_data 
      WHERE symbol = ? AND expiry_date = ?
    `;
    const params: any[] = [symbol, expiryDate];
    if (startDate) {
      sql += ` AND date >= CAST(? AS DATE)`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND date <= CAST(? AS DATE)`;
      params.push(endDate);
    }
    sql += ` ORDER BY date ASC`;
    const rows = await this.query(sql, params);
    return rows.map(r => ({
      symbol: r.symbol,
      date: r.date,
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
      delivery_qty: Number(r.delivery_qty || 0),
      delivery_pct: Number(r.delivery_pct || 0),
      expiry_date: r.expiry_date || 'SPOT',
      open_interest: Number(r.open_interest || 0),
      oi_change_pct: Number(r.oi_change_pct || 0),
    }));
  }

  public async insertBarsBatch(bars: HistoricalBar[]): Promise<number> {
    if (!bars.length) return 0;

    // Use prepared statement or bulk insert in batches of 500
    const chunkSize = 500;
    let totalInserted = 0;

    for (let i = 0; i < bars.length; i += chunkSize) {
      const chunk = bars.slice(i, i + chunkSize);
      const valuePlaceholders = chunk.map(() => `(?, CAST(? AS DATE), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(', ');
      const sql = `
        INSERT OR REPLACE INTO historical_data 
        (symbol, date, open, high, low, close, volume, delivery_qty, delivery_pct, expiry_date, open_interest, oi_change_pct) 
        VALUES ${valuePlaceholders}
      `;
      const flatParams: any[] = [];
      for (const bar of chunk) {
        flatParams.push(
          bar.symbol,
          bar.date,
          bar.open,
          bar.high,
          bar.low,
          bar.close,
          bar.volume,
          bar.delivery_qty,
          bar.delivery_pct,
          bar.expiry_date || 'SPOT',
          bar.open_interest || 0,
          bar.oi_change_pct || 0.0
        );
      }
      await this.run(sql, flatParams);
      totalInserted += chunk.length;
    }

    return totalInserted;
  }

  public async getRecentSparkline(symbol: string, limit = 25): Promise<number[]> {
    const rows = await this.query<{ close: number }>(`
      SELECT close FROM historical_data 
      WHERE symbol = ? 
      ORDER BY date DESC 
      LIMIT ?
    `, [symbol, limit]);
    return rows.map(r => Number(r.close)).reverse();
  }

  public async getDatabaseStats(): Promise<DatabaseStats> {
    let dbSizeBytes = 0;
    let walSizeBytes = 0;
    if (fs.existsSync(DB_FILE_PATH)) {
      dbSizeBytes = fs.statSync(DB_FILE_PATH).size;
    }
    if (fs.existsSync(WAL_FILE_PATH)) {
      walSizeBytes = fs.statSync(WAL_FILE_PATH).size;
    }

    const stockCountRes = await this.query<{ cnt: number }>('SELECT count(*) as cnt FROM stocks');
    const barCountRes = await this.query<{ cnt: number }>('SELECT count(*) as cnt FROM historical_data');
    const datesRes = await this.query<{ min_date: string; max_date: string }>(
      `SELECT strftime(min(date), '%Y-%m-%d') as min_date, strftime(max(date), '%Y-%m-%d') as max_date FROM historical_data`
    );

    const logCount = await this.query<{ cnt: number }>('SELECT count(*) as cnt FROM download_logs');
    const savedCount = await this.query<{ cnt: number }>('SELECT count(*) as cnt FROM saved_analyses');
    const tradeCount = await this.query<{ cnt: number }>('SELECT count(*) as cnt FROM trade_history');
    const alertCount = await this.query<{ cnt: number }>('SELECT count(*) as cnt FROM price_alerts');

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return {
      totalStocks: Number(stockCountRes[0]?.cnt || 0),
      totalBars: Number(barCountRes[0]?.cnt || 0),
      earliestDate: datesRes[0]?.min_date || 'N/A',
      latestDate: datesRes[0]?.max_date || 'N/A',
      dbSizeBytes,
      dbSizeFormatted: formatBytes(dbSizeBytes + walSizeBytes),
      walSizeBytes,
      tableStats: [
        { name: 'stocks', rowCount: Number(stockCountRes[0]?.cnt || 0) },
        { name: 'historical_data', rowCount: Number(barCountRes[0]?.cnt || 0) },
        { name: 'download_logs', rowCount: Number(logCount[0]?.cnt || 0) },
        { name: 'saved_analyses', rowCount: Number(savedCount[0]?.cnt || 0) },
        { name: 'trade_history', rowCount: Number(tradeCount[0]?.cnt || 0) },
        { name: 'price_alerts', rowCount: Number(alertCount[0]?.cnt || 0) },
      ],
      integrityStatus: 'HEALTHY',
      lastCheckpoint: new Date().toISOString(),
    };
  }

  public async validateDataIntegrity(): Promise<{
    status: 'HEALTHY' | 'WARNING' | 'CORRUPTED';
    checks: { name: string; status: 'PASSED' | 'FAILED'; details: string }[];
  }> {
    const checks: { name: string; status: 'PASSED' | 'FAILED'; details: string }[] = [];

    // 1. Check for negative prices
    const negPrices = await this.query<{ cnt: number }>(`
      SELECT count(*) as cnt FROM historical_data WHERE open <= 0 OR high <= 0 OR low <= 0 OR close <= 0
    `);
    const negCount = Number(negPrices[0]?.cnt || 0);
    checks.push({
      name: 'Non-positive Prices Check',
      status: negCount === 0 ? 'PASSED' : 'FAILED',
      details: negCount === 0 ? 'All prices are positive' : `Found ${negCount} records with non-positive prices`,
    });

    // 2. Check for High < Low anomalies
    const highLowAnomalies = await this.query<{ cnt: number }>(`
      SELECT count(*) as cnt FROM historical_data WHERE high < low OR high < open OR high < close OR low > open OR low > close
    `);
    const hlCount = Number(highLowAnomalies[0]?.cnt || 0);
    checks.push({
      name: 'OHLC Logic Consistency',
      status: hlCount === 0 ? 'PASSED' : 'FAILED',
      details: hlCount === 0 ? 'High/Low/Open/Close bounds are strictly valid' : `Found ${hlCount} bars with High < Low inconsistencies`,
    });

    // 3. Check for Delivery % bounds
    const deliveryBounds = await this.query<{ cnt: number }>(`
      SELECT count(*) as cnt FROM historical_data WHERE delivery_pct < 0 OR delivery_pct > 100
    `);
    const delCount = Number(deliveryBounds[0]?.cnt || 0);
    checks.push({
      name: 'Delivery Percentage Range [0-100%]',
      status: delCount === 0 ? 'PASSED' : 'FAILED',
      details: delCount === 0 ? 'Delivery metrics are within valid range' : `Found ${delCount} bars with out-of-range delivery %`,
    });

    // 4. Check for Orphan historical bars
    const orphans = await this.query<{ cnt: number }>(`
      SELECT count(*) as cnt FROM historical_data h WHERE NOT EXISTS (SELECT 1 FROM stocks s WHERE s.symbol = h.symbol)
    `);
    const orphanCount = Number(orphans[0]?.cnt || 0);
    checks.push({
      name: 'Foreign Key & Stock Referential Integrity',
      status: orphanCount === 0 ? 'PASSED' : 'FAILED',
      details: orphanCount === 0 ? 'All historical records match registered stocks' : `Found ${orphanCount} orphan historical records`,
    });

    const hasFailed = checks.some(c => c.status === 'FAILED');
    return {
      status: hasFailed ? 'WARNING' : 'HEALTHY',
      checks,
    };
  }

  // Saved Analyses methods
  public async saveAnalysis(analysis: { id: string; title: string; type: string; configJson: string; resultsJson: string }): Promise<void> {
    await this.run(`
      INSERT OR REPLACE INTO saved_analyses (id, title, type, config_json, results_json, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [analysis.id, analysis.title, analysis.type, analysis.configJson, analysis.resultsJson]);
  }

  public async getSavedAnalyses(): Promise<SavedAnalysis[]> {
    const rows = await this.query(`
      SELECT id, title, strftime(created_at, '%Y-%m-%d %H:%M:%S') as created_at, type, config_json, results_json 
      FROM saved_analyses 
      ORDER BY created_at DESC
    `);
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      type: r.type as any,
      configJson: r.config_json,
      resultsJson: r.results_json,
    }));
  }

  public async deleteSavedAnalysis(id: string): Promise<void> {
    await this.run('DELETE FROM saved_analyses WHERE id = ?', [id]);
  }

  // Price Alerts methods
  public async getAlerts(): Promise<PriceAlert[]> {
    const rows = await this.query(`
      SELECT 
        id, symbol, name, target_price, condition, email, 
        enable_push, enable_email, trigger_status, 
        strftime(created_at, '%Y-%m-%d %H:%M:%S') as created_at,
        strftime(triggered_at, '%Y-%m-%d %H:%M:%S') as triggered_at,
        notes, last_trigger_details
      FROM price_alerts 
      ORDER BY created_at DESC
    `);
    return rows.map(r => ({
      id: r.id,
      symbol: r.symbol,
      name: r.name || r.symbol,
      targetPrice: Number(r.target_price || 0),
      condition: r.condition as any,
      email: r.email || '',
      enablePush: Boolean(r.enable_push),
      enableEmail: Boolean(r.enable_email),
      triggerStatus: r.trigger_status as any,
      createdAt: r.created_at,
      triggeredAt: r.triggered_at || undefined,
      notes: r.notes || undefined,
      lastTriggerDetails: r.last_trigger_details || undefined,
    }));
  }

  public async createAlert(alert: Partial<PriceAlert>): Promise<PriceAlert> {
    const id = alert.id || `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await this.run(`
      INSERT INTO price_alerts 
      (id, symbol, name, target_price, condition, email, enable_push, enable_email, trigger_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `, [
      id,
      alert.symbol,
      alert.name || alert.symbol,
      alert.targetPrice || 0,
      alert.condition || 'ENTERS_ACCUMULATION_ZONE',
      alert.email || '',
      alert.enablePush ?? true,
      alert.enableEmail ?? false,
      alert.notes || '',
    ]);

    const created = await this.query(`SELECT * FROM price_alerts WHERE id = ?`, [id]);
    return {
      id,
      symbol: alert.symbol!,
      name: alert.name || alert.symbol!,
      targetPrice: alert.targetPrice || 0,
      condition: (alert.condition as any) || 'ENTERS_ACCUMULATION_ZONE',
      email: alert.email || '',
      enablePush: alert.enablePush ?? true,
      enableEmail: alert.enableEmail ?? false,
      triggerStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
      notes: alert.notes || '',
    };
  }

  public async triggerAlert(id: string, details: string): Promise<void> {
    await this.run(`
      UPDATE price_alerts 
      SET trigger_status = 'TRIGGERED', triggered_at = CURRENT_TIMESTAMP, last_trigger_details = ?
      WHERE id = ?
    `, [details, id]);
  }

  public async deleteAlert(id: string): Promise<void> {
    await this.run('DELETE FROM price_alerts WHERE id = ?', [id]);
  }

  public async addDownloadLog(log: { id: string; index_name: string; symbol: string; records_added: number; status: string; error_message?: string }): Promise<void> {
    await this.run(`
      INSERT INTO download_logs (id, index_name, symbol, records_added, status, error_message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [log.id, log.index_name, log.symbol, log.records_added, log.status, log.error_message || null]);
  }

  public async getDownloadLogs(limit = 50): Promise<any[]> {
    return this.query(`
      SELECT id, strftime(timestamp, '%Y-%m-%d %H:%M:%S') as timestamp, index_name, symbol, records_added, status, error_message
      FROM download_logs
      ORDER BY timestamp DESC
      LIMIT ?
    `, [limit]);
  }

  // ====================================================
  // DATA DELETION & PURGING METHODS
  // ====================================================

  /**
   * Deletes historical OHLCV bars for specified stock symbols
   */
  public async deleteHistoricalDataBySymbols(symbols: string[]): Promise<{ deletedBars: number }> {
    if (!symbols.length) return { deletedBars: 0 };
    const placeholders = symbols.map(() => '?').join(', ');
    const countBefore = await this.query<{ cnt: number }>(
      `SELECT count(*) as cnt FROM historical_data WHERE symbol IN (${placeholders})`,
      symbols
    );
    const deletedBars = Number(countBefore[0]?.cnt || 0);

    await this.run(`DELETE FROM historical_data WHERE symbol IN (${placeholders})`, symbols);
    await this.runCheckpoint();
    return { deletedBars };
  }

  /**
   * Deletes historical bars within or before date thresholds
   */
  public async deleteHistoricalDataByDateRange(startDate?: string, endDate?: string): Promise<{ deletedBars: number }> {
    let sql = 'DELETE FROM historical_data WHERE 1=1';
    let countSql = 'SELECT count(*) as cnt FROM historical_data WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      sql += ' AND date >= CAST(? AS DATE)';
      countSql += ' AND date >= CAST(? AS DATE)';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND date <= CAST(? AS DATE)';
      countSql += ' AND date <= CAST(? AS DATE)';
      params.push(endDate);
    }

    const countBefore = await this.query<{ cnt: number }>(countSql, params);
    const deletedBars = Number(countBefore[0]?.cnt || 0);

    await this.run(sql, params);
    await this.runCheckpoint();
    return { deletedBars };
  }

  /**
   * Deletes historical data for an entire index group (e.g. NIFTY 50, NIFTY NEXT 50)
   */
  public async deleteHistoricalDataByIndex(indexName: string): Promise<{ deletedBars: number; stocksAffected: number }> {
    const stocks = await this.query<{ symbol: string }>(
      'SELECT symbol FROM stocks WHERE index_name = ?',
      [indexName]
    );
    const symbols = stocks.map(s => s.symbol);
    if (!symbols.length) return { deletedBars: 0, stocksAffected: 0 };

    const { deletedBars } = await this.deleteHistoricalDataBySymbols(symbols);
    return { deletedBars, stocksAffected: symbols.length };
  }

  /**
   * Clears all rows in a specified table
   */
  public async clearTable(tableName: string): Promise<{ success: boolean; clearedTable: string; rowsDeleted: number }> {
    const allowedTables = ['historical_data', 'download_logs', 'trade_history', 'price_alerts', 'saved_analyses'];
    if (!allowedTables.includes(tableName)) {
      throw new Error(`Table ${tableName} is not allowed to be cleared directly`);
    }

    const countBefore = await this.query<{ cnt: number }>(`SELECT count(*) as cnt FROM ${tableName}`);
    const rowsDeleted = Number(countBefore[0]?.cnt || 0);

    await this.run(`DELETE FROM ${tableName}`);
    await this.runCheckpoint();
    return { success: true, clearedTable: tableName, rowsDeleted };
  }

  /**
   * Active Positions Management
   */
  public async getActivePositions(): Promise<any[]> {
    try {
      const positions = await this.query<any>(`
        SELECT 
          p.id,
          p.symbol,
          s.name,
          s.sector,
          s.index_name as indexName,
          strftime(p.entry_date, '%Y-%m-%d') as entryDate,
          p.entry_price as entryPrice,
          p.shares,
          p.initial_stop_loss_pct as initialStopLossPct,
          p.initial_target_pct as initialTargetPct,
          p.highest_price_reached as highestPriceReached,
          p.notes,
          p.status,
          strftime(p.created_at, '%Y-%m-%d %H:%M:%S') as createdAt,
          strftime(p.exit_date, '%Y-%m-%d') as exitDate,
          p.exit_price as exitPrice,
          p.realized_pnl as realizedPnL
        FROM active_positions p
        LEFT JOIN stocks s ON s.symbol = p.symbol
        ORDER BY p.status ASC, p.entry_date DESC
      `);

      if (positions.length === 0) {
        await this.seedSamplePositions();
        return this.getActivePositions();
      }

      return positions;
    } catch (e) {
      console.error('[DuckDB] Error fetching active positions:', e);
      return [];
    }
  }

  public async seedSamplePositions(): Promise<void> {
    const samplePositions = [
      {
        id: 'pos-bajaj-auto-1',
        symbol: 'BAJAJ-AUTO',
        entry_date: '2026-08-01',
        entry_price: 10250.00,
        shares: 50,
        initial_stop_loss_pct: 2.5,
        initial_target_pct: 8.0,
        highest_price_reached: 10780.00,
        notes: 'Institutional Volume Breakout above Resistance. Strong Q1 Auto Sales.',
        status: 'OPEN'
      },
      {
        id: 'pos-tatamotors-2',
        symbol: 'TATAMOTORS',
        entry_date: '2026-08-05',
        entry_price: 945.00,
        shares: 250,
        initial_stop_loss_pct: 2.5,
        initial_target_pct: 8.0,
        highest_price_reached: 992.50,
        notes: 'Long Buildup in Aug Futures with 48% Delivery Surge.',
        status: 'OPEN'
      },
      {
        id: 'pos-reliance-3',
        symbol: 'RELIANCE',
        entry_date: '2026-08-10',
        entry_price: 2980.00,
        shares: 100,
        initial_stop_loss_pct: 2.5,
        initial_target_pct: 8.0,
        highest_price_reached: 3028.00,
        notes: 'Fresh Accumulation Zone bounce off 20-DMA support.',
        status: 'OPEN'
      },
      {
        id: 'pos-hdfcbank-4',
        symbol: 'HDFCBANK',
        entry_date: '2026-08-14',
        entry_price: 1670.00,
        shares: 150,
        initial_stop_loss_pct: 2.5,
        initial_target_pct: 8.0,
        highest_price_reached: 1678.00,
        notes: 'Banking Index reversal play. Stop loss strictly capped at -2.5%.',
        status: 'OPEN'
      }
    ];

    for (const p of samplePositions) {
      await this.run(
        `INSERT OR REPLACE INTO active_positions (
          id, symbol, entry_date, entry_price, shares, 
          initial_stop_loss_pct, initial_target_pct, highest_price_reached, notes, status
        ) VALUES (?, ?, CAST(? AS DATE), ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id, p.symbol, p.entry_date, p.entry_price, p.shares,
          p.initial_stop_loss_pct, p.initial_target_pct, p.highest_price_reached, p.notes, p.status
        ]
      );
    }
  }

  public async addActivePosition(pos: {
    id?: string;
    symbol: string;
    entryDate?: string;
    entryPrice: number;
    shares?: number;
    initialStopLossPct?: number;
    initialTargetPct?: number;
    highestPriceReached?: number;
    notes?: string;
  }): Promise<string> {
    const id = pos.id || `pos-${pos.symbol.toLowerCase()}-${Date.now()}`;
    const entryDate = pos.entryDate || new Date().toISOString().split('T')[0];
    const shares = pos.shares || 100;
    const initialStopLossPct = pos.initialStopLossPct || 2.5;
    const initialTargetPct = pos.initialTargetPct || 8.0;
    const highestPriceReached = pos.highestPriceReached || pos.entryPrice;

    await this.run(
      `INSERT OR REPLACE INTO active_positions (
        id, symbol, entry_date, entry_price, shares, 
        initial_stop_loss_pct, initial_target_pct, highest_price_reached, notes, status
      ) VALUES (?, ?, CAST(? AS DATE), ?, ?, ?, ?, ?, ?, 'OPEN')`,
      [
        id, pos.symbol.toUpperCase(), entryDate, pos.entryPrice, shares,
        initialStopLossPct, initialTargetPct, highestPriceReached, pos.notes || ''
      ]
    );
    await this.runCheckpoint();
    return id;
  }

  public async updateActivePosition(id: string, updates: {
    shares?: number;
    highestPriceReached?: number;
    initialStopLossPct?: number;
    initialTargetPct?: number;
    notes?: string;
  }): Promise<boolean> {
    const existing = await this.query<any>('SELECT * FROM active_positions WHERE id = ?', [id]);
    if (!existing.length) return false;

    const current = existing[0];
    const shares = updates.shares !== undefined ? updates.shares : current.shares;
    const highest = updates.highestPriceReached !== undefined ? updates.highestPriceReached : current.highest_price_reached;
    const slPct = updates.initialStopLossPct !== undefined ? updates.initialStopLossPct : current.initial_stop_loss_pct;
    const targetPct = updates.initialTargetPct !== undefined ? updates.initialTargetPct : current.initial_target_pct;
    const notes = updates.notes !== undefined ? updates.notes : current.notes;

    await this.run(
      `UPDATE active_positions SET 
        shares = ?, 
        highest_price_reached = ?, 
        initial_stop_loss_pct = ?, 
        initial_target_pct = ?, 
        notes = ?
      WHERE id = ?`,
      [shares, highest, slPct, targetPct, notes, id]
    );
    await this.runCheckpoint();
    return true;
  }

  public async closeActivePosition(id: string, exitPrice: number, exitDate?: string): Promise<boolean> {
    const existing = await this.query<any>('SELECT * FROM active_positions WHERE id = ?', [id]);
    if (!existing.length) return false;

    const current = existing[0];
    const exitD = exitDate || new Date().toISOString().split('T')[0];
    const realizedPnL = +( (exitPrice - current.entry_price) * current.shares ).toFixed(2);

    await this.run(
      `UPDATE active_positions SET 
        status = 'CLOSED',
        exit_date = CAST(? AS DATE),
        exit_price = ?,
        realized_pnl = ?
      WHERE id = ?`,
      [exitD, exitPrice, realizedPnL, id]
    );
    await this.runCheckpoint();
    return true;
  }

  public async deleteActivePosition(id: string): Promise<boolean> {
    await this.run('DELETE FROM active_positions WHERE id = ?', [id]);
    await this.runCheckpoint();
    return true;
  }

  /**
   * Purges all historical data & caches while keeping constituent catalog intact
   */
  public async purgeAllMarketData(): Promise<{ success: boolean; message: string }> {
    await this.run('DELETE FROM historical_data');
    await this.run('DELETE FROM download_logs');
    await this.run('DELETE FROM trade_history');
    await this.seedConstituents();
    await this.runCheckpoint();
    return { success: true, message: 'DuckDB purged successfully. All historical bars and logs cleared.' };
  }

  /**
   * Registers a custom stock symbol if not present
   */
  public async ensureStockExists(symbol: string, name?: string, indexName = 'CUSTOM', sector = 'Diversified'): Promise<void> {
    await this.run(
      `INSERT OR REPLACE INTO stocks (symbol, name, index_name, sector, active) VALUES (?, ?, ?, ?, ?)`,
      [symbol.toUpperCase(), name || symbol.toUpperCase(), indexName, sector, true]
    );
  }

  // Trading Account methods
  public async getTradingAccount(): Promise<any> {
    const rows = await this.query('SELECT * FROM trading_account WHERE id = \'main_account\'');
    return rows[0];
  }

  public async updateBalance(amountChange: number): Promise<void> {
    await this.run(
      `UPDATE trading_account SET balance = balance + ?, last_updated = CURRENT_TIMESTAMP WHERE id = 'main_account'`,
      [amountChange]
    );
  }

  public async setTotalCapital(total: number): Promise<void> {
    const current = await this.getTradingAccount();
    const balanceDiff = total - current.total_capital;
    await this.run(
      `UPDATE trading_account SET total_capital = ?, balance = balance + ?, last_updated = CURRENT_TIMESTAMP WHERE id = 'main_account'`,
      [total, balanceDiff]
    );
  }
}

export const dbManager = new DuckDBManager();
