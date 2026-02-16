import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditStatus } from './entities/audit-log.entity';

interface CreateAuditLogPayload {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  status: AuditStatus;
  message?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async createLog(payload: CreateAuditLogPayload): Promise<void> {
    const entity = this.auditLogRepository.create(payload);
    await this.auditLogRepository.save(entity);
  }

  async getUserLogs(userId: string, limit: number = 50): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
