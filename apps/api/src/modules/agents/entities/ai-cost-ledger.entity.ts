import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

@Entity('ai_cost_ledger')
@Index(['userId', 'ledgerDate', 'provider', 'mode'], { unique: true })
@Index(['ledgerDate', 'provider'])
export class AICostLedger extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'date' })
  ledgerDate: string;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 30 })
  mode: string;

  @Column({ type: 'int', default: 0 })
  decisionCount: number;

  @Column({ type: 'int', default: 0 })
  totalTokens: number;

  @Column({ type: 'decimal', precision: 14, scale: 6, default: 0 })
  totalCostUsd: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  avgConfidence: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  minConfidence: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  maxConfidence: number;
}
