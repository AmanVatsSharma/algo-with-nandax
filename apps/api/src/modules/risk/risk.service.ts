import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThan, Repository } from 'typeorm';
import { RiskProfile } from './entities/risk-profile.entity';
import { RiskAlert, RiskAlertType } from './entities/risk-alert.entity';
import { UpdateRiskProfileDto } from './dto/update-risk-profile.dto';
import { SetKillSwitchDto } from './dto/set-kill-switch.dto';
import { Trade, TradeStatus } from '../trading/entities/trade.entity';
import { GetRiskAnalyticsDto } from './dto/get-risk-analytics.dto';

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
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
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

  async getProfilesForDailyPnLMonitoring(limit: number = 200): Promise<RiskProfile[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    return this.riskProfileRepository
      .createQueryBuilder('profile')
      .where('profile.killSwitchEnabled = :killSwitchEnabled', { killSwitchEnabled: false })
      .andWhere('(profile.maxDailyLoss > 0 OR profile.maxDailyProfit > 0)')
      .orderBy('profile.updatedAt', 'ASC')
      .limit(safeLimit)
      .getMany();
  }

  async getTodayPnLForUser(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const trades = await this.tradeRepository.find({
      where: {
        userId,
        createdAt: Between(startOfDay, endOfDay),
      },
    });

    return trades.reduce((sum, trade) => sum + Number(trade.netPnL ?? 0), 0);
  }

  async getRiskAnalytics(userId: string, dto: GetRiskAnalyticsDto) {
    const lookbackDays = Math.min(Math.max(dto.days ?? 30, 1), 365);
    const confidenceLevel = Math.min(Math.max(dto.confidenceLevel ?? 95, 80), 99.9);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - lookbackDays);

    const closedTrades = await this.tradeRepository.find({
      where: {
        userId,
        status: TradeStatus.CLOSED,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'ASC' },
    });

    const openTrades = await this.tradeRepository.find({
      where: {
        userId,
        status: TradeStatus.OPEN,
      },
    });

    const tradePnLs = closedTrades.map((trade) => Number(trade.netPnL ?? 0));
    const totalNetPnL = tradePnLs.reduce((sum, value) => sum + value, 0);
    const averageTradePnL = closedTrades.length ? totalNetPnL / closedTrades.length : 0;

    const variance = closedTrades.length
      ? tradePnLs.reduce((sum, value) => sum + (value - averageTradePnL) ** 2, 0) /
        closedTrades.length
      : 0;
    const pnlStdDev = Math.sqrt(variance);

    const sortedPnL = [...tradePnLs].sort((a, b) => a - b);
    const tailProbability = 1 - confidenceLevel / 100;
    const percentileIndex = sortedPnL.length
      ? Math.max(Math.ceil(sortedPnL.length * tailProbability) - 1, 0)
      : 0;
    const valueAtRisk = sortedPnL.length
      ? Math.max(0, -Math.min(sortedPnL[percentileIndex], 0))
      : 0;
    const tailTrades = sortedPnL.length ? sortedPnL.slice(0, percentileIndex + 1) : [];
    const expectedShortfall = tailTrades.length
      ? Math.max(
          0,
          -Math.min(
            tailTrades.reduce((sum, value) => sum + value, 0) / tailTrades.length,
            0,
          ),
        )
      : 0;

    const dailyPnLMap = new Map<string, number>();
    for (const trade of closedTrades) {
      const tradeDate = (trade.exitTime ?? trade.createdAt).toISOString().slice(0, 10);
      const runningDayPnL = dailyPnLMap.get(tradeDate) ?? 0;
      dailyPnLMap.set(tradeDate, runningDayPnL + Number(trade.netPnL ?? 0));
    }

    const dailyPnL = Array.from(dailyPnLMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, pnl]) => ({ date, pnl }));

    let cumulativePnL = 0;
    let peakPnL = 0;
    let maxDrawdown = 0;
    const equityCurve = dailyPnL.map((point) => {
      cumulativePnL += point.pnl;
      peakPnL = Math.max(peakPnL, cumulativePnL);
      maxDrawdown = Math.max(maxDrawdown, peakPnL - cumulativePnL);
      return {
        date: point.date,
        equity: cumulativePnL,
      };
    });

    const grossOpenExposure = openTrades.reduce((sum, trade) => {
      const price = Number(trade.executedEntryPrice ?? trade.entryPrice ?? 0);
      const quantity = Number(trade.quantity ?? 0);
      return sum + Math.abs(price * quantity);
    }, 0);

    return {
      period: {
        lookbackDays,
        confidenceLevel,
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      tradeStats: {
        closedTrades: closedTrades.length,
        openTrades: openTrades.length,
        totalNetPnL,
        averageTradePnL,
        pnlStdDev,
        maxProfitTrade: closedTrades.length ? Math.max(...tradePnLs) : 0,
        maxLossTrade: closedTrades.length ? Math.min(...tradePnLs) : 0,
        grossOpenExposure,
      },
      riskMetrics: {
        valueAtRisk,
        expectedShortfall,
        maxDrawdown,
      },
      dailyPnL,
      equityCurve,
    };
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
    // Alert dedupe window prevents repeated identical alerts on every cron tick.
    const dedupeWindowStart = new Date(Date.now() - 5 * 60 * 1000);
    const existingRecentAlert = await this.riskAlertRepository.findOne({
      where: {
        userId,
        alertType: payload.alertType,
        message: payload.message,
        createdAt: MoreThan(dedupeWindowStart),
      },
      order: { createdAt: 'DESC' },
    });
    if (existingRecentAlert) {
      return;
    }

    const alert = this.riskAlertRepository.create({
      userId,
      alertType: payload.alertType,
      message: payload.message,
      metadata: payload.metadata,
    });
    await this.riskAlertRepository.save(alert);
  }
}
