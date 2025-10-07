import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Agent } from '@/modules/agents/entities/agent.entity';

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP_LOSS = 'stop_loss',
  STOP_LOSS_MARKET = 'stop_loss_market',
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderStatus {
  PENDING = 'pending',
  PLACED = 'placed',
  EXECUTED = 'executed',
  PARTIALLY_FILLED = 'partially_filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

export enum TradeStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

@Entity('trades')
@Index(['userId', 'status'])
@Index(['agentId', 'status'])
@Index(['symbol', 'createdAt'])
export class Trade extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  agentId: string;

  @Column({ type: 'varchar', length: 100 })
  symbol: string;

  @Column({ type: 'enum', enum: OrderSide })
  side: OrderSide;

  @Column({ type: 'enum', enum: OrderType })
  orderType: OrderType;

  @Column({ type: 'enum', enum: TradeStatus, default: TradeStatus.OPEN })
  status: TradeStatus;

  // Entry Order
  @Column({ type: 'varchar', length: 255, nullable: true })
  entryOrderId?: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  executedEntryPrice?: number;

  @Column({ type: 'timestamp', nullable: true })
  entryTime?: Date;

  // Exit Order
  @Column({ type: 'varchar', length: 255, nullable: true })
  exitOrderId?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  exitPrice?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  executedExitPrice?: number;

  @Column({ type: 'timestamp', nullable: true })
  exitTime?: Date;

  // Stop Loss & Take Profit
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  stopLoss?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  takeProfit?: number;

  // P&L
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  realizedPnL: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unrealizedPnL: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  fees: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  netPnL: number;

  // Order Status
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  orderStatus: OrderStatus;

  @Column({ type: 'text', nullable: true })
  orderError?: string;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  exitReason?: string;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Agent, (agent) => agent.trades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent: Agent;
}
