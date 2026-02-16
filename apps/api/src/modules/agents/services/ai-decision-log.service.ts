import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIDecisionLog } from '../entities/ai-decision-log.entity';
import { getErrorMessage } from '@/common/utils/error.utils';

@Injectable()
export class AIDecisionLogService {
  private readonly logger = new Logger(AIDecisionLogService.name);

  constructor(
    @InjectRepository(AIDecisionLog)
    private readonly aiDecisionLogRepository: Repository<AIDecisionLog>,
  ) {}

  async logDecision(payload: {
    userId: string;
    agentId: string;
    provider: string;
    mode: string;
    model?: string;
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    estimatedTokens?: number;
    estimatedCostUsd?: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      const log = this.aiDecisionLogRepository.create({
        userId: payload.userId,
        agentId: payload.agentId,
        provider: payload.provider,
        mode: payload.mode,
        model: payload.model,
        action: payload.action,
        confidence: payload.confidence,
        estimatedTokens: payload.estimatedTokens,
        estimatedCostUsd: payload.estimatedCostUsd,
        reason: payload.reason,
        metadata: payload.metadata,
      });
      await this.aiDecisionLogRepository.save(log);
      return log;
    } catch (error) {
      this.logger.warn(
        `Failed to persist AI decision log for agent=${payload.agentId}: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  async getRecentLogs(userId: string, agentId?: string, limit: number = 100) {
    return this.aiDecisionLogRepository.find({
      where: {
        userId,
        ...(agentId ? { agentId } : {}),
      },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }
}
