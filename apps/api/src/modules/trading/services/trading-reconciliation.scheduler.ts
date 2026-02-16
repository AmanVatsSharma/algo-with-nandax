import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TradingService } from '../trading.service';
import { getErrorMessage } from '@/common/utils/error.utils';

interface ReconciliationSummary {
  scanned: number;
  groups: number;
  processed: number;
  executed: number;
  partiallyFilled: number;
  rejected: number;
  cancelled: number;
  open: number;
  failed: number;
}

@Injectable()
export class TradingReconciliationScheduler {
  private readonly logger = new Logger(TradingReconciliationScheduler.name);
  private readonly enabled: boolean;
  private readonly batchSize: number;

  constructor(
    private readonly tradingService: TradingService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.parseBoolean(
      this.configService.get<string>('TRADING_AUTO_RECONCILIATION_ENABLED', 'true'),
    );
    this.batchSize = this.parseNumber(
      this.configService.get<string>('TRADING_AUTO_RECONCILIATION_BATCH_SIZE', '100'),
      100,
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcilePendingTradesTick() {
    if (!this.enabled) {
      this.logger.debug('Auto trade reconciliation disabled by configuration');
      return;
    }

    const summary: ReconciliationSummary = {
      scanned: 0,
      groups: 0,
      processed: 0,
      executed: 0,
      partiallyFilled: 0,
      rejected: 0,
      cancelled: 0,
      open: 0,
      failed: 0,
    };

    const candidates = await this.tradingService.findPendingTradesForReconciliation(this.batchSize);
    summary.scanned = candidates.length;

    if (!candidates.length) {
      this.logger.debug('Auto reconciliation found no pending broker orders');
      return;
    }

    this.logger.log(
      `Auto reconciliation cycle started for ${candidates.length} pending orders`,
    );

    const groupedCandidates = this.groupByUserAndConnection(candidates);
    summary.groups = groupedCandidates.length;

    for (const candidateGroup of groupedCandidates) {
      try {
        const result = await this.tradingService.reconcileTradesFromOrdersSnapshot(
          candidateGroup.userId,
          {
            connectionId: candidateGroup.connectionId,
            maxItems: Math.min(candidateGroup.tradeIds.length, this.batchSize),
          },
        );

        summary.processed += result.processed;
        summary.executed += result.executed;
        summary.partiallyFilled += result.partiallyFilled ?? 0;
        summary.rejected += result.rejected;
        summary.cancelled += result.cancelled;
        summary.open += result.open;
        summary.failed += result.failed;
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(
          `Auto reconciliation failed for user=${candidateGroup.userId} connection=${candidateGroup.connectionId}: ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(
      `Auto reconciliation cycle completed scanned=${summary.scanned} groups=${summary.groups} processed=${summary.processed} executed=${summary.executed} partiallyFilled=${summary.partiallyFilled} rejected=${summary.rejected} cancelled=${summary.cancelled} open=${summary.open} failed=${summary.failed}`,
    );
  }

  private groupByUserAndConnection(
    candidates: Array<Pick<{ id: string; userId: string; connectionId: string }, 'id' | 'userId' | 'connectionId'>>,
  ) {
    const grouped = new Map<string, { userId: string; connectionId: string; tradeIds: string[] }>();
    for (const candidate of candidates) {
      const key = `${candidate.userId}:${candidate.connectionId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.tradeIds.push(candidate.id);
        continue;
      }
      grouped.set(key, {
        userId: candidate.userId,
        connectionId: candidate.connectionId,
        tradeIds: [candidate.id],
      });
    }
    return Array.from(grouped.values());
  }

  private parseBoolean(value: string | boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }

  private parseNumber(value: string | number, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(Math.max(parsed, 1), 500);
  }
}
