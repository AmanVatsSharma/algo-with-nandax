import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIGovernanceEvent } from '../entities/ai-governance-event.entity';
import { getErrorMessage } from '@/common/utils/error.utils';

@Injectable()
export class AIGovernanceEventService {
  private readonly logger = new Logger(AIGovernanceEventService.name);

  constructor(
    @InjectRepository(AIGovernanceEvent)
    private readonly aiGovernanceEventRepository: Repository<AIGovernanceEvent>,
  ) {}

  async logEvent(payload: {
    userId: string;
    agentId?: string;
    provider: string;
    eventType: string;
    blocked?: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      const event = this.aiGovernanceEventRepository.create({
        userId: payload.userId,
        agentId: payload.agentId,
        provider: payload.provider,
        eventType: payload.eventType,
        blocked: Boolean(payload.blocked),
        reason: payload.reason,
        metadata: payload.metadata,
      });
      return await this.aiGovernanceEventRepository.save(event);
    } catch (error) {
      this.logger.warn(
        `Failed to persist AI governance event user=${payload.userId} provider=${payload.provider}: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  async getRecentEvents(userId: string, limit: number = 100) {
    return this.aiGovernanceEventRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }
}
