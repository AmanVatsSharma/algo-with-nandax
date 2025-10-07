import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

export enum ReportType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export enum ReportStatus {
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('performance_reports')
@Index(['userId', 'reportType', 'periodStart'])
@Index(['agentId', 'reportType', 'periodStart'])
export class PerformanceReport extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  agentId?: string;

  @Column({ type: 'uuid', nullable: true })
  strategyId?: string;

  @Column({ type: 'enum', enum: ReportType })
  reportType: ReportType;

  @Column({ type: 'timestamp' })
  periodStart: Date;

  @Column({ type: 'timestamp' })
  periodEnd: Date;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.GENERATING })
  status: ReportStatus;

  // Trading Metrics
  @Column({ type: 'int', default: 0 })
  totalTrades: number;

  @Column({ type: 'int', default: 0 })
  winningTrades: number;

  @Column({ type: 'int', default: 0 })
  losingTrades: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  winRate: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPnL: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  grossProfit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  grossLoss: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  profitFactor: number;

  // Risk Metrics
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  maxDrawdown: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  maxDrawdownPercent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  sharpeRatio: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  sortinoRatio: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  calmarRatio: number;

  // Statistical Metrics
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  avgWin: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  avgLoss: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  avgWinLossRatio: number;

  @Column({ type: 'int', default: 0 })
  largestWin: number;

  @Column({ type: 'int', default: 0 })
  largestLoss: number;

  @Column({ type: 'int', default: 0 })
  consecutiveWins: number;

  @Column({ type: 'int', default: 0 })
  consecutiveLosses: number;

  // Time-based Metrics
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgTradeDuration: number; // in minutes

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  avgTradesPerDay: number;

  // Detailed Data
  @Column({ type: 'jsonb', nullable: true })
  dailyPnL?: Array<{ date: string; pnl: number }>;

  @Column({ type: 'jsonb', nullable: true })
  tradeDistribution?: {
    bySymbol: Record<string, number>;
    byTimeOfDay: Record<string, number>;
    byDayOfWeek: Record<string, number>;
  };

  @Column({ type: 'jsonb', nullable: true })
  riskMetrics?: {
    valueAtRisk: number; // VaR
    conditionalVaR: number; // CVaR
    beta: number;
    alpha: number;
    correlation: number;
  };

  // Generated Report
  @Column({ type: 'text', nullable: true })
  reportUrl?: string; // S3/Cloud storage URL for PDF

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;
}
