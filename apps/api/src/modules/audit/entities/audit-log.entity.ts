import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

export enum AuditStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('audit_logs')
@Index(['userId', 'action', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLog extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 200 })
  action: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resourceType?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resourceId?: string;

  @Column({ type: 'enum', enum: AuditStatus, default: AuditStatus.SUCCESS })
  status: AuditStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent?: string;
}
