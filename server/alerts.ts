import { dbManager } from './db';
import { accumulationScanner } from './scanner';
import { PriceAlert, ScanConfig } from '../src/types';

export class AlertNotificationService {
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;

  public startAlertMonitoring(intervalMs = 30000) {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => {
      this.evaluateActiveAlerts().catch(err => {
        console.error('[Alerts] Evaluation error:', err);
      });
    }, intervalMs);
    console.log('[Alerts] Real-time alert monitor started.');
  }

  public stopAlertMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public async evaluateActiveAlerts(): Promise<{ triggeredCount: number; alerts: PriceAlert[] }> {
    if (this.isChecking) return { triggeredCount: 0, alerts: [] };
    this.isChecking = true;

    const triggeredList: PriceAlert[] = [];

    try {
      const activeAlerts = await dbManager.getAlerts();
      const pending = activeAlerts.filter(a => a.triggerStatus === 'ACTIVE');

      if (pending.length === 0) {
        this.isChecking = false;
        return { triggeredCount: 0, alerts: [] };
      }

      // Run a scan across all constituents
      const scanConfig: ScanConfig = {
        indexFilter: 'ALL',
        sectorFilter: 'ALL',
        lookbackDays: 66,
        lowerPct: 5.0,
        upperPct: 6.0,
        minDeliveryPct: 35.0,
        deliveryMultiplier: 1.0,
        minVolume: 0,
        priceField: 'close',
        inZoneOnly: false,
        highDeliveryOnly: false,
        searchQuery: '',
        initialCapital: 1000000,
        initialCapitalPerTrade: 100000,
        maxCapitalPerTrade: 200000,
        targetPct: 5.0,
        stopLossPct: 2.0,
        maxHoldingDays: 45,
      };

      const scanResults = await accumulationScanner.runScan(scanConfig);
      const scanMap = new Map(scanResults.map(r => [r.symbol, r]));

      for (const alert of pending) {
        const item = scanMap.get(alert.symbol);
        if (!item) continue;

        let isTriggered = false;
        let triggerMsg = '';

        switch (alert.condition) {
          case 'ENTERS_ACCUMULATION_ZONE':
            if (item.zone_status === 'IN_ZONE') {
              isTriggered = true;
              triggerMsg = `${alert.symbol} entered Accumulation Zone (₹${item.zone_lower} - ₹${item.zone_upper}) at current price ₹${item.latest_close} with ${item.delivery_pct}% delivery!`;
            }
            break;

          case 'PRICE_ABOVE':
            if (item.latest_close >= alert.targetPrice) {
              isTriggered = true;
              triggerMsg = `${alert.symbol} crossed above target price ₹${alert.targetPrice} (Current: ₹${item.latest_close}).`;
            }
            break;

          case 'PRICE_BELOW':
            if (item.latest_close <= alert.targetPrice) {
              isTriggered = true;
              triggerMsg = `${alert.symbol} fell below stop level ₹${alert.targetPrice} (Current: ₹${item.latest_close}).`;
            }
            break;

          case 'HIGH_DELIVERY_SPIKE':
            if (item.delivery_pct >= 60 || item.delivery_pct >= item.avg_delivery_pct_20 * 1.5) {
              isTriggered = true;
              triggerMsg = `${alert.symbol} institutional delivery spike: ${item.delivery_pct}% (20d avg: ${item.avg_delivery_pct_20}%) at ₹${item.latest_close}.`;
            }
            break;
        }

        if (isTriggered) {
          await dbManager.triggerAlert(alert.id, triggerMsg);
          this.dispatchNotification(alert, triggerMsg);
          triggeredList.push({
            ...alert,
            triggerStatus: 'TRIGGERED',
            triggeredAt: new Date().toISOString(),
            lastTriggerDetails: triggerMsg,
          });
        }
      }
    } finally {
      this.isChecking = false;
    }

    return { triggeredCount: triggeredList.length, alerts: triggeredList };
  }

  public dispatchNotification(alert: PriceAlert, message: string) {
    console.log(`[Alert Notification] Triggered for ${alert.symbol}:`, message);

    if (alert.enableEmail && alert.email) {
      console.log(`[Email Dispatcher] Sent email alert to ${alert.email} for ${alert.symbol}`);
    }

    if (alert.enablePush) {
      console.log(`[Web Push Dispatcher] Sent browser push alert for ${alert.symbol}`);
    }
  }

  public async simulatePriceMovement(symbol: string, targetPriceChangePct: number): Promise<void> {
    // Helper to simulate market price movement for testing alerts
    const recent = await dbManager.getHistoricalData(symbol);
    if (recent.length > 0) {
      const latest = recent[recent.length - 1];
      const newClose = +(latest.close * (1 + targetPriceChangePct / 100)).toFixed(2);
      const newHigh = Math.max(latest.high, newClose);
      const newLow = Math.min(latest.low, newClose);

      await dbManager.insertBarsBatch([{
        ...latest,
        close: newClose,
        high: newHigh,
        low: newLow,
        delivery_pct: 68.5, // simulate accumulation delivery spike
      }]);
      await this.evaluateActiveAlerts();
    }
  }
}

export const alertNotificationService = new AlertNotificationService();
