import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Agent } from '@/modules/agents/entities/agent.entity';

export enum StrategyType {
  MOMENTUM = 'momentum',
  MEAN_REVERSION = 'mean_reversion',
  ARBITRAGE = 'arbitrage',
  SCALPING = 'scalping',
  SWING = 'swing',
  CUSTOM = 'custom',
}

export enum StrategyStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  STOPPED = 'stopped',
}

export enum TimeFrame {
  ONE_MIN = '1min',
  FIVE_MIN = '5min',
  FIFTEEN_MIN = '15min',
  THIRTY_MIN = '30min',
  ONE_HOUR = '1hour',
  ONE_DAY = '1day',
}

@Entity('strategies')
@Index(['userId', 'status'])
export class Strategy extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: StrategyType })
  type: StrategyType;

  @Column({ type: 'enum', enum: StrategyStatus, default: StrategyStatus.DRAFT })
  status: StrategyStatus;

  @Column({ type: 'enum', enum: TimeFrame, default: TimeFrame.FIVE_MIN })
  timeFrame: TimeFrame;

  // Trading Parameters
  @Column({ type: 'jsonb' })
  instruments: string[]; // Array of trading symbols

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  maxCapitalPerTrade: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2 })
  stopLossPercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5 })
  takeProfitPercentage: number;

  @Column({ type: 'int', default: 3 })
  maxPositions: number;

  @Column({ type: 'int', default: 5 })
  maxTradesPerDay: number;

  // Strategy Configuration (AI/Algorithm params)
  @Column({ type: 'jsonb' })
  configuration: Record<string, any>;

  // Entry/Exit Rules
  @Column({ type: 'jsonb', nullable: true })
  entryRules?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  exitRules?: Record<string, any>;

  // Backtesting Results
  @Column({ type: 'jsonb', nullable: true })
  backtestResults?: Record<string, any>;

  // Performance Metrics
  @Column({ type: 'int', default: 0 })
  totalTrades: number;

  @Column({ type: 'int', default: 0 })
  winningTrades: number;

  @Column({ type: 'int', default: 0 })
  losingTrades: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPnL: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  winRate: number;

  // Relations
  @ManyToOne(() => User, (user) => user.strategies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Agent, (agent) => agent.strategy)
  agents: Agent[];
}
