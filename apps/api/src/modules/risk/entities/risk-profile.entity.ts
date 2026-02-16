import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

@Entity('risk_profiles')
@Index(['userId'], { unique: true })
export class RiskProfile extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'boolean', default: false })
  killSwitchEnabled: boolean;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  maxPositionValuePerTrade: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  maxDailyLoss: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  maxDailyProfit: number;

  @Column({ type: 'int', default: 0 })
  maxOpenTradesPerAgent: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  killSwitchReason?: string;
}
