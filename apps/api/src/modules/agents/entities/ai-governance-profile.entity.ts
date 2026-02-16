import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

@Entity('ai_governance_profiles')
@Index(['userId'], { unique: true })
export class AIGovernanceProfile extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'boolean', default: true })
  liveInferenceEnabled: boolean;

  @Column({ type: 'decimal', precision: 14, scale: 6, default: 0 })
  dailyCostBudgetUsd: number;

  @Column({ type: 'bigint', default: 0 })
  dailyTokenBudget: number;

  @Column({ type: 'decimal', precision: 14, scale: 6, default: 0 })
  providerDailyCostBudgetUsd: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  policyNote?: string | null;
}
