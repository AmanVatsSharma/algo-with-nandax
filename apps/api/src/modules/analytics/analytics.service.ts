import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsEvent, EventType } from './entities/analytics-event.entity';
import { PerformanceReport, ReportType, ReportStatus } from './entities/performance-report.entity';
import { Trade, TradeStatus } from '../trading/entities/trade.entity';
import dayjs from 'dayjs';
import { getErrorMessage } from '@/common/utils/error.utils';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsEventRepository: Repository<AnalyticsEvent>,
    @InjectRepository(PerformanceReport)
    private readonly performanceReportRepository: Repository<PerformanceReport>,
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
  ) {}

  /**
   * Track any event in the system
   */
  async trackEvent(
    eventType: EventType,
    userId?: string,
    properties?: Record<string, any>,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      sessionId?: string;
    },
  ): Promise<void> {
    try {
      const event = this.analyticsEventRepository.create({
        userId,
        eventType,
        properties,
        ...metadata,
      });

      await this.analyticsEventRepository.save(event);
    } catch (error) {
      this.logger.error('Failed to track event', error);
    }
  }

  /**
   * Get user activity events
   */
  async getUserActivity(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AnalyticsEvent[]> {
    return this.analyticsEventRepository.find({
      where: {
        userId,
        createdAt: Between(startDate, endDate),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Get platform-wide analytics
   */
  async getPlatformAnalytics(startDate: Date, endDate: Date) {
    const [
      totalUsers,
      activeUsers,
      totalTrades,
      totalEvents,
      eventsByType,
    ] = await Promise.all([
      // Total unique users
      this.analyticsEventRepository
        .createQueryBuilder('event')
        .select('COUNT(DISTINCT event.userId)', 'count')
        .where('event.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
        .getRawOne(),

      // Active users (logged in)
      this.analyticsEventRepository
        .createQueryBuilder('event')
        .select('COUNT(DISTINCT event.userId)', 'count')
        .where('event.eventType = :type', { type: EventType.USER_LOGIN })
        .andWhere('event.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
        .getRawOne(),

      // Total trades
      this.tradeRepository.count({
        where: {
          createdAt: Between(startDate, endDate),
        },
      }),

      // Total events
      this.analyticsEventRepository.count({
        where: {
          createdAt: Between(startDate, endDate),
        },
      }),

      // Events by type
      this.analyticsEventRepository
        .createQueryBuilder('event')
        .select('event.eventType', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('event.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
        .groupBy('event.eventType')
        .getRawMany(),
    ]);

    return {
      totalUsers: parseInt(totalUsers.count),
      activeUsers: parseInt(activeUsers.count),
      totalTrades,
      totalEvents,
      eventsByType,
      period: {
        start: startDate,
        end: endDate,
      },
    };
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(
    userId: string,
    agentId?: string,
    strategyId?: string,
    reportType: ReportType = ReportType.MONTHLY,
    customStart?: Date,
    customEnd?: Date,
  ): Promise<PerformanceReport> {
    const { periodStart, periodEnd } = this.getReportPeriod(reportType, customStart, customEnd);

    // Create report record
    const report = this.performanceReportRepository.create({
      userId,
      agentId,
      strategyId,
      reportType,
      periodStart,
      periodEnd,
      status: ReportStatus.GENERATING,
    });

    await this.performanceReportRepository.save(report);

    try {
      // Fetch trades
      const whereClause: any = {
        userId,
        status: TradeStatus.CLOSED,
        exitTime: Between(periodStart, periodEnd),
      };

      if (agentId) whereClause.agentId = agentId;

      const trades = await this.tradeRepository.find({
        where: whereClause,
        order: { exitTime: 'ASC' },
      });

      // Calculate metrics
      const metrics = this.calculateMetrics(trades);

      // Update report
      await this.performanceReportRepository.update(report.id, {
        ...metrics,
        status: ReportStatus.COMPLETED,
      });

      return this.performanceReportRepository.findOne({ where: { id: report.id } });
    } catch (error) {
      this.logger.error('Failed to generate performance report', error);
      
      await this.performanceReportRepository.update(report.id, {
        status: ReportStatus.FAILED,
        errorMessage: getErrorMessage(error, 'Failed to generate report'),
      });

      throw error;
    }
  }

  /**
   * Calculate comprehensive trading metrics
   */
  private calculateMetrics(trades: Trade[]) {
    if (trades.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => Number(t.netPnL) > 0);
    const losingTrades = trades.filter((t) => Number(t.netPnL) < 0);

    const totalPnL = trades.reduce((sum, t) => sum + Number(t.netPnL), 0);
    const grossProfit = winningTrades.reduce((sum, t) => sum + Number(t.netPnL), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + Number(t.netPnL), 0));

    const winRate = (winningTrades.length / totalTrades) * 100;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + Number(t.netPnL), 0) / winningTrades.length 
      : 0;

    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + Number(t.netPnL), 0) / losingTrades.length)
      : 0;

    const avgWinLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Drawdown calculation
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    trades.forEach((trade) => {
      runningPnL += Number(trade.netPnL);
      if (runningPnL > peak) peak = runningPnL;
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    const initialCapital = 100000; // Should come from user settings
    const maxDrawdownPercent = (maxDrawdown / initialCapital) * 100;

    // Sharpe Ratio (simplified)
    const returns = trades.map((t) => Number(t.netPnL) / initialCapital);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length,
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    // Sortino Ratio (downside deviation)
    const downsideReturns = returns.filter((r) => r < 0);
    const downsideStdDev = downsideReturns.length > 0
      ? Math.sqrt(
          downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length,
        )
      : 0;
    const sortinoRatio = downsideStdDev > 0 ? (avgReturn / downsideStdDev) * Math.sqrt(252) : 0;

    // Calmar Ratio
    const annualizedReturn = avgReturn * 252;
    const calmarRatio = maxDrawdownPercent > 0 ? annualizedReturn / maxDrawdownPercent : 0;

    // Largest wins/losses
    const largestWin = Math.max(...winningTrades.map((t) => Number(t.netPnL)));
    const largestLoss = Math.min(...losingTrades.map((t) => Number(t.netPnL)));

    // Consecutive wins/losses
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    trades.forEach((trade) => {
      if (Number(trade.netPnL) > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
      }
    });

    // Time-based metrics
    const totalDuration = trades.reduce((sum, t) => {
      if (t.entryTime && t.exitTime) {
        return sum + (new Date(t.exitTime).getTime() - new Date(t.entryTime).getTime());
      }
      return sum;
    }, 0);
    const avgTradeDuration = totalDuration / trades.length / (1000 * 60); // in minutes

    // Daily P&L
    const dailyPnL = this.calculateDailyPnL(trades);

    // Trade distribution
    const tradeDistribution = this.calculateTradeDistribution(trades);

    return {
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalPnL,
      grossProfit,
      grossLoss,
      profitFactor,
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      avgWin,
      avgLoss,
      avgWinLossRatio,
      largestWin,
      largestLoss,
      consecutiveWins: maxConsecutiveWins,
      consecutiveLosses: maxConsecutiveLosses,
      avgTradeDuration,
      avgTradesPerDay: this.calculateAvgTradesPerDay(trades),
      dailyPnL,
      tradeDistribution,
    };
  }

  private getEmptyMetrics() {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      avgWin: 0,
      avgLoss: 0,
      avgWinLossRatio: 0,
      largestWin: 0,
      largestLoss: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      avgTradeDuration: 0,
      avgTradesPerDay: 0,
      dailyPnL: [],
      tradeDistribution: null,
    };
  }

  private calculateDailyPnL(trades: Trade[]) {
    const dailyMap = new Map<string, number>();

    trades.forEach((trade) => {
      if (trade.exitTime) {
        const date = dayjs(trade.exitTime).format('YYYY-MM-DD');
        const currentPnL = dailyMap.get(date) || 0;
        dailyMap.set(date, currentPnL + Number(trade.netPnL));
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateTradeDistribution(trades: Trade[]) {
    const bySymbol: Record<string, number> = {};
    const byTimeOfDay: Record<string, number> = {};
    const byDayOfWeek: Record<string, number> = {};

    trades.forEach((trade) => {
      // By symbol
      bySymbol[trade.symbol] = (bySymbol[trade.symbol] || 0) + 1;

      // By time of day
      if (trade.entryTime) {
        const hour = dayjs(trade.entryTime).hour();
        const timeSlot = `${hour}:00`;
        byTimeOfDay[timeSlot] = (byTimeOfDay[timeSlot] || 0) + 1;
      }

      // By day of week
      if (trade.entryTime) {
        const dayOfWeek = dayjs(trade.entryTime).format('dddd');
        byDayOfWeek[dayOfWeek] = (byDayOfWeek[dayOfWeek] || 0) + 1;
      }
    });

    return {
      bySymbol,
      byTimeOfDay,
      byDayOfWeek,
    };
  }

  private calculateAvgTradesPerDay(trades: Trade[]) {
    if (trades.length === 0) return 0;

    const firstTrade = trades[0];
    const lastTrade = trades[trades.length - 1];

    if (!firstTrade.exitTime || !lastTrade.exitTime) return 0;

    const days = dayjs(lastTrade.exitTime).diff(dayjs(firstTrade.exitTime), 'day');
    return days > 0 ? trades.length / days : trades.length;
  }

  private getReportPeriod(
    reportType: ReportType,
    customStart?: Date,
    customEnd?: Date,
  ): { periodStart: Date; periodEnd: Date } {
    if (reportType === ReportType.CUSTOM && customStart && customEnd) {
      return { periodStart: customStart, periodEnd: customEnd };
    }

    const now = dayjs();
    let periodStart: dayjs.Dayjs;
    let periodEnd: dayjs.Dayjs = now;

    switch (reportType) {
      case ReportType.DAILY:
        periodStart = now.startOf('day');
        break;
      case ReportType.WEEKLY:
        periodStart = now.subtract(7, 'day');
        break;
      case ReportType.MONTHLY:
        periodStart = now.subtract(1, 'month');
        break;
      case ReportType.QUARTERLY:
        periodStart = now.subtract(3, 'month');
        break;
      case ReportType.YEARLY:
        periodStart = now.subtract(1, 'year');
        break;
      default:
        periodStart = now.subtract(1, 'month');
    }

    return {
      periodStart: periodStart.toDate(),
      periodEnd: periodEnd.toDate(),
    };
  }

  /**
   * Scheduled job to generate daily reports for all users
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async generateDailyReportsForAllUsers() {
    this.logger.log('Starting daily report generation for all users');
    
    // This would be optimized in production with proper batch processing
    // For now, it's a placeholder for the enterprise feature
  }

  /**
   * Get reports for a user
   */
  async getReports(
    userId: string,
    agentId?: string,
    limit: number = 10,
  ): Promise<PerformanceReport[]> {
    const where: any = { userId };
    if (agentId) where.agentId = agentId;

    return this.performanceReportRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
