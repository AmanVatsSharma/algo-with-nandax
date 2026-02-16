import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AICostLedgerService } from './ai-cost-ledger.service';

@Injectable()
export class AICostLedgerScheduler {
  private readonly logger = new Logger(AICostLedgerScheduler.name);
  private readonly enabled: boolean;

  constructor(
    private readonly aiCostLedgerService: AICostLedgerService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.parseBoolean(
      this.configService.get<string>('AI_COST_LEDGER_SCHEDULER_ENABLED', 'true'),
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async rebuildRecentLedgerWindows() {
    if (!this.enabled) {
      this.logger.debug('AI cost ledger scheduler disabled by config');
      return;
    }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    await this.aiCostLedgerService.safeRebuildDailyLedgerForDate(yesterday);
    await this.aiCostLedgerService.safeRebuildDailyLedgerForDate(now);
  }

  private parseBoolean(value: string | boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
  }
}
