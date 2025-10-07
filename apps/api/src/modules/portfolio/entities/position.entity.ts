import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Portfolio } from './portfolio.entity';

export enum PositionType {
  LONG = 'long',
  SHORT = 'short',
}

export enum PositionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Entity('positions')
@Index(['portfolioId', 'symbol'])
@Index(['status'])
export class Position extends BaseEntity {
  @Column({ type: 'uuid' })
  portfolioId: string;

  @Column({ type: 'varchar', length: 100 })
  symbol: string;

  @Column({ type: 'enum', enum: PositionType })
  type: PositionType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  averagePrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  currentPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unrealizedPnL: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  realizedPnL: number;

  @Column({ type: 'enum', enum: PositionStatus, default: PositionStatus.OPEN })
  status: PositionStatus;

  @Column({ type: 'timestamp', nullable: true })
  openedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date;

  // Relations
  @ManyToOne(() => Portfolio, (portfolio) => portfolio.positions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolioId' })
  portfolio: Portfolio;
}
