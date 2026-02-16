import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

@Entity('ai_governance_events')
@Index(['userId', 'createdAt'])
@Index(['provider', 'createdAt'])
export class AIGovernanceEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  agentId?: string | null;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 80 })
  eventType: string;

  @Column({ type: 'boolean', default: false })
  blocked: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
