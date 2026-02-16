import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
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

  async getGovernanceSummary(userId: string, days: number = 30) {
    const lookbackDays = Math.min(Math.max(days, 1), 365);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - lookbackDays);

    const logs = await this.aiDecisionLogRepository.find({
      where: {
        userId,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'ASC' },
    });

    const providerStats = this.aggregateCountAndCost(logs, (log) => log.provider);
    const modeStats = this.aggregateCountAndCost(logs, (log) => log.mode);
    const actionBreakdown = this.aggregateCountAndCost(logs, (log) => log.action);
    const dailyCosts = this.aggregateDailyCost(logs);

    const totalDecisions = logs.length;
    const totalCostUsd = logs.reduce((sum, log) => sum + Number(log.estimatedCostUsd ?? 0), 0);
    const totalTokens = logs.reduce((sum, log) => sum + Number(log.estimatedTokens ?? 0), 0);
    const avgConfidence =
      totalDecisions > 0
        ? logs.reduce((sum, log) => sum + Number(log.confidence ?? 0), 0) / totalDecisions
        : 0;

    const topCostDay =
      dailyCosts.length > 0
        ? [...dailyCosts].sort((left, right) => right.costUsd - left.costUsd)[0]
        : null;

    return {
      period: {
        lookbackDays,
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      totals: {
        totalDecisions,
        totalCostUsd,
        totalTokens,
        avgConfidence,
      },
      providerStats,
      modeStats,
      actionBreakdown,
      dailyCosts,
      topCostDay,
    };
  }

  private aggregateCountAndCost(
    logs: AIDecisionLog[],
    keySelector: (log: AIDecisionLog) => string,
  ) {
    const map = new Map<
      string,
      {
        key: string;
        count: number;
        totalCostUsd: number;
        totalTokens: number;
      }
    >();

    for (const log of logs) {
      const key = String(keySelector(log) ?? 'unknown').trim() || 'unknown';
      const current = map.get(key) ?? {
        key,
        count: 0,
        totalCostUsd: 0,
        totalTokens: 0,
      };
      current.count += 1;
      current.totalCostUsd += Number(log.estimatedCostUsd ?? 0);
      current.totalTokens += Number(log.estimatedTokens ?? 0);
      map.set(key, current);
    }

    return Array.from(map.values()).sort((left, right) => right.count - left.count);
  }

  private aggregateDailyCost(logs: AIDecisionLog[]) {
    const map = new Map<string, { date: string; costUsd: number; decisions: number }>();
    for (const log of logs) {
      const date = log.createdAt.toISOString().slice(0, 10);
      const current = map.get(date) ?? { date, costUsd: 0, decisions: 0 };
      current.costUsd += Number(log.estimatedCostUsd ?? 0);
      current.decisions += 1;
      map.set(date, current);
    }

    return Array.from(map.values()).sort((left, right) => left.date.localeCompare(right.date));
  }
}
