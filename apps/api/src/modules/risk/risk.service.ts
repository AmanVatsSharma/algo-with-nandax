import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiskProfile } from './entities/risk-profile.entity';
import { RiskAlert, RiskAlertType } from './entities/risk-alert.entity';
import { UpdateRiskProfileDto } from './dto/update-risk-profile.dto';
import { SetKillSwitchDto } from './dto/set-kill-switch.dto';

interface TradeRiskContext {
  connectionId: string;
  agentId: string;
  symbol: string;
  notionalValue: number;
  openTradesForAgent: number;
}

interface TradeRiskEvaluation {
  allowed: boolean;
  reason?: string;
  profile: RiskProfile;
}

@Injectable()
export class RiskService {
  constructor(
    @InjectRepository(RiskProfile)
    private readonly riskProfileRepository: Repository<RiskProfile>,
    @InjectRepository(RiskAlert)
    private readonly riskAlertRepository: Repository<RiskAlert>,
  ) {}

  async getOrCreateProfile(userId: string): Promise<RiskProfile> {
    const existing = await this.riskProfileRepository.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    const profile = this.riskProfileRepository.create({
      userId,
      killSwitchEnabled: false,
      maxPositionValuePerTrade: 0,
      maxDailyLoss: 0,
      maxDailyProfit: 0,
      maxOpenTradesPerAgent: 0,
    });

    return this.riskProfileRepository.save(profile);
  }

  async updateProfile(userId: string, updateDto: UpdateRiskProfileDto): Promise<RiskProfile> {
    const profile = await this.getOrCreateProfile(userId);
    await this.riskProfileRepository.update(profile.id, updateDto);
    return this.getOrCreateProfile(userId);
  }

  async enableKillSwitch(userId: string, dto: SetKillSwitchDto): Promise<RiskProfile> {
    const profile = await this.getOrCreateProfile(userId);
    await this.riskProfileRepository.update(profile.id, {
      killSwitchEnabled: true,
      killSwitchReason: dto.reason ?? 'Manual kill switch enabled',
    });

    await this.createAlert(userId, {
      alertType: RiskAlertType.KILL_SWITCH_BLOCK,
      message: `Kill switch enabled${dto.reason ? `: ${dto.reason}` : ''}`,
      metadata: { reason: dto.reason },
    });

    return this.getOrCreateProfile(userId);
  }

  async disableKillSwitch(userId: string): Promise<RiskProfile> {
    const profile = await this.getOrCreateProfile(userId);
    await this.riskProfileRepository.update(profile.id, {
      killSwitchEnabled: false,
      killSwitchReason: null,
    });

    return this.getOrCreateProfile(userId);
  }

  async getAlerts(userId: string, limit: number = 50): Promise<RiskAlert[]> {
    return this.riskAlertRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async evaluateTradeRisk(
    userId: string,
    context: TradeRiskContext,
  ): Promise<TradeRiskEvaluation> {
    const profile = await this.getOrCreateProfile(userId);

    if (profile.killSwitchEnabled) {
      await this.createAlert(userId, {
        alertType: RiskAlertType.KILL_SWITCH_BLOCK,
        message: `Trade blocked by kill switch for symbol ${context.symbol}`,
        metadata: { ...context },
      });

      return {
        allowed: false,
        reason: profile.killSwitchReason || 'Kill switch is enabled',
        profile,
      };
    }

    if (
      Number(profile.maxPositionValuePerTrade) > 0 &&
      context.notionalValue > Number(profile.maxPositionValuePerTrade)
    ) {
      await this.createAlert(userId, {
        alertType: RiskAlertType.POSITION_NOTIONAL_LIMIT_BREACH,
        message: `Trade notional ${context.notionalValue.toFixed(2)} exceeds maxPositionValuePerTrade`,
        metadata: { ...context },
      });

      return {
        allowed: false,
        reason: 'Trade notional exceeds configured per-trade limit',
        profile,
      };
    }

    if (
      Number(profile.maxOpenTradesPerAgent) > 0 &&
      context.openTradesForAgent >= Number(profile.maxOpenTradesPerAgent)
    ) {
      await this.createAlert(userId, {
        alertType: RiskAlertType.OPEN_TRADES_LIMIT_BREACH,
        message: `Open trades limit reached for agent ${context.agentId}`,
        metadata: { ...context },
      });

      return {
        allowed: false,
        reason: 'Open trades per agent limit reached',
        profile,
      };
    }

    return {
      allowed: true,
      profile,
    };
  }

  async evaluateDailyPnL(userId: string, todayPnL: number) {
    const profile = await this.getOrCreateProfile(userId);

    if (Number(profile.maxDailyLoss) > 0 && todayPnL <= -Number(profile.maxDailyLoss)) {
      await this.createAlert(userId, {
        alertType: RiskAlertType.DAILY_LOSS_LIMIT_BREACH,
        message: `Daily loss limit breached: ${todayPnL.toFixed(2)}`,
        metadata: { todayPnL, maxDailyLoss: Number(profile.maxDailyLoss) },
      });

      return {
        allowed: false,
        reason: 'Daily loss limit breached',
        profile,
      };
    }

    if (Number(profile.maxDailyProfit) > 0 && todayPnL >= Number(profile.maxDailyProfit)) {
      await this.createAlert(userId, {
        alertType: RiskAlertType.DAILY_PROFIT_CAP_REACHED,
        message: `Daily profit cap reached: ${todayPnL.toFixed(2)}`,
        metadata: { todayPnL, maxDailyProfit: Number(profile.maxDailyProfit) },
      });

      return {
        allowed: false,
        reason: 'Daily profit cap reached',
        profile,
      };
    }

    return {
      allowed: true,
      profile,
    };
  }

  private async createAlert(
    userId: string,
    payload: {
      alertType: RiskAlertType;
      message: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const alert = this.riskAlertRepository.create({
      userId,
      alertType: payload.alertType,
      message: payload.message,
      metadata: payload.metadata,
    });
    await this.riskAlertRepository.save(alert);
  }
}
