import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

@Entity('ai_decision_logs')
@Index(['userId', 'agentId', 'createdAt'])
@Index(['provider', 'createdAt'])
export class AIDecisionLog extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  agentId: string;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 30, default: 'deterministic' })
  mode: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model?: string;

  @Column({ type: 'varchar', length: 10 })
  action: 'buy' | 'sell' | 'hold';

  @Column({ type: 'decimal', precision: 6, scale: 4 })
  confidence: number;

  @Column({ type: 'int', nullable: true })
  estimatedTokens?: number;

  @Column({ type: 'decimal', precision: 12, scale: 6, nullable: true })
  estimatedCostUsd?: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
