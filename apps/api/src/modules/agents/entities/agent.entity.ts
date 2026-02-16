import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Strategy } from '@/modules/strategy/entities/strategy.entity';
import { Trade } from '@/modules/trading/entities/trade.entity';

export enum AgentStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error',
  STOPPED = 'stopped',
}

export enum AgentType {
  AI_POWERED = 'ai_powered',
  RULE_BASED = 'rule_based',
  HYBRID = 'hybrid',
}

@Entity('agents')
@Index(['userId', 'status'])
@Index(['strategyId'])
@Index(['connectionId'])
export class Agent extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  strategyId: string;

  @Column({ type: 'uuid' })
  connectionId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: AgentType, default: AgentType.AI_POWERED })
  type: AgentType;

  @Column({ type: 'enum', enum: AgentStatus, default: AgentStatus.IDLE })
  status: AgentStatus;

  // Agent Configuration
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  allocatedCapital: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  currentCapital: number;

  @Column({ type: 'boolean', default: true })
  autoTrade: boolean;

  @Column({ type: 'boolean', default: false })
  paperTrading: boolean; // For testing without real money

  // AI Model Info (if AI-powered)
  @Column({ type: 'varchar', length: 255, nullable: true })
  aiModelName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  aiModelVersion?: string;

  @Column({ type: 'jsonb', nullable: true })
  aiModelConfig?: Record<string, any>;

  // Performance Tracking
  @Column({ type: 'int', default: 0 })
  totalTrades: number;

  @Column({ type: 'int', default: 0 })
  activeTrades: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPnL: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  todayPnL: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  roi: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  sharpeRatio: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  maxDrawdown: number;

  // Runtime Info
  @Column({ type: 'timestamp', nullable: true })
  lastExecutionAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  stoppedAt?: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.agents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Strategy, (strategy) => strategy.agents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'strategyId' })
  strategy: Strategy;

  @OneToMany(() => Trade, (trade) => trade.agent)
  trades: Trade[];
}
