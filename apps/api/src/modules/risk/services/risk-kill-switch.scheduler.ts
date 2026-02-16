import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RiskService } from '../risk.service';
import { getErrorMessage } from '@/common/utils/error.utils';

@Injectable()
export class RiskKillSwitchScheduler {
  private readonly logger = new Logger(RiskKillSwitchScheduler.name);
  private readonly enabled: boolean;
  private readonly batchSize: number;

  constructor(
    private readonly riskService: RiskService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.parseBoolean(
      this.configService.get<string>('RISK_AUTO_KILL_SWITCH_ENABLED', 'true'),
    );
    this.batchSize = this.parseNumber(
      this.configService.get<string>('RISK_AUTO_KILL_SWITCH_BATCH_SIZE', '200'),
      200,
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluateDailyPnLAndKillSwitch() {
    if (!this.enabled) {
      this.logger.debug('Risk auto kill-switch scheduler disabled by config');
      return;
    }

    const profiles = await this.riskService.getProfilesForDailyPnLMonitoring(this.batchSize);
    if (!profiles.length) {
      this.logger.debug('Risk auto kill-switch scheduler found no monitorable profiles');
      return;
    }

    let autoEnabledCount = 0;
    let evaluationFailures = 0;

    for (const profile of profiles) {
      try {
        const todayPnL = await this.riskService.getTodayPnLForUser(profile.userId);
        const evaluation = await this.riskService.evaluateDailyPnL(profile.userId, todayPnL);

        if (!evaluation.allowed && !profile.killSwitchEnabled) {
          await this.riskService.enableKillSwitch(profile.userId, {
            reason: `Auto kill-switch: ${evaluation.reason} (todayPnL=${todayPnL.toFixed(2)})`,
          });
          autoEnabledCount += 1;
          this.logger.warn(
            `Auto kill-switch enabled for user=${profile.userId} reason=${evaluation.reason}`,
          );
        }
      } catch (error) {
        evaluationFailures += 1;
        this.logger.warn(
          `Risk auto kill-switch evaluation failed for user=${profile.userId}: ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(
      `Risk auto kill-switch cycle complete profiles=${profiles.length} autoEnabled=${autoEnabledCount} failures=${evaluationFailures}`,
    );
  }

  private parseBoolean(value: string | boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
  }

  private parseNumber(value: string | number, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(Math.max(parsed, 1), 1000);
  }
}
