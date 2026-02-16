import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

export type AIGovernancePolicyRequestStatus = 'pending' | 'approved' | 'rejected';

@Entity('ai_governance_policy_requests')
@Index(['targetUserId', 'status', 'createdAt'])
@Index(['requestedByUserId', 'createdAt'])
export class AIGovernancePolicyRequest extends BaseEntity {
  @Column({ type: 'uuid' })
  requestedByUserId: string;

  @Column({ type: 'uuid' })
  targetUserId: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: AIGovernancePolicyRequestStatus;

  @Column({ type: 'jsonb' })
  requestedPolicy: Record<string, unknown>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  requestNote?: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedByUserId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewNote?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date | null;
}
