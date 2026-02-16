import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AIDecisionLog } from '../entities/ai-decision-log.entity';
import { AIGovernanceProfile } from '../entities/ai-governance-profile.entity';
import { UpdateAIGovernancePolicyDto } from '../dto/update-ai-governance-policy.dto';

@Injectable()
export class AIGovernancePolicyService {
  private readonly logger = new Logger(AIGovernancePolicyService.name);

  constructor(
    @InjectRepository(AIDecisionLog)
    private readonly aiDecisionLogRepository: Repository<AIDecisionLog>,
    @InjectRepository(AIGovernanceProfile)
    private readonly aiGovernanceProfileRepository: Repository<AIGovernanceProfile>,
    private readonly configService: ConfigService,
  ) {}

  async getOrCreatePolicyProfile(userId: string) {
    const existing = await this.aiGovernanceProfileRepository.findOne({
      where: { userId },
    });
    if (existing) {
      return existing;
    }

    const profile = this.aiGovernanceProfileRepository.create({
      userId,
      liveInferenceEnabled: true,
      dailyCostBudgetUsd: 0,
      dailyTokenBudget: 0,
      providerDailyCostBudgetUsd: 0,
      policyNote: null,
    });
    return this.aiGovernanceProfileRepository.save(profile);
  }

  async updatePolicyProfile(userId: string, dto: UpdateAIGovernancePolicyDto) {
    const profile = await this.getOrCreatePolicyProfile(userId);
    await this.aiGovernanceProfileRepository.update(profile.id, {
      ...(dto.liveInferenceEnabled !== undefined
        ? { liveInferenceEnabled: dto.liveInferenceEnabled }
        : {}),
      ...(dto.dailyCostBudgetUsd !== undefined ? { dailyCostBudgetUsd: dto.dailyCostBudgetUsd } : {}),
      ...(dto.dailyTokenBudget !== undefined ? { dailyTokenBudget: dto.dailyTokenBudget } : {}),
      ...(dto.providerDailyCostBudgetUsd !== undefined
        ? { providerDailyCostBudgetUsd: dto.providerDailyCostBudgetUsd }
        : {}),
      ...(dto.policyNote !== undefined ? { policyNote: dto.policyNote } : {}),
    });

    return this.getOrCreatePolicyProfile(userId);
  }

  async getEffectivePolicy(userId: string) {
    const profile = await this.getOrCreatePolicyProfile(userId);
    const envDefaults = this.getDefaultBudgetsFromEnv();
    return {
      profile,
      effective: {
        liveInferenceEnabled: profile.liveInferenceEnabled,
        dailyCostBudgetUsd:
          Number(profile.dailyCostBudgetUsd ?? 0) > 0
            ? Number(profile.dailyCostBudgetUsd)
            : envDefaults.dailyCostBudgetUsd,
        dailyTokenBudget:
          Number(profile.dailyTokenBudget ?? 0) > 0
            ? Number(profile.dailyTokenBudget)
            : envDefaults.dailyTokenBudget,
        providerDailyCostBudgetUsd:
          Number(profile.providerDailyCostBudgetUsd ?? 0) > 0
            ? Number(profile.providerDailyCostBudgetUsd)
            : envDefaults.providerDailyCostBudgetUsd,
      },
      defaults: envDefaults,
    };
  }

  async evaluateLiveInferencePolicy(input: {
    userId: string;
    providerKey: string;
  }): Promise<{
    allowed: boolean;
    reason?: string;
    metrics: {
      totalCostUsd: number;
      totalTokens: number;
      providerCostUsd: number;
      dailyCostBudgetUsd: number;
      dailyTokenBudget: number;
      providerDailyCostBudgetUsd: number;
    };
  }> {
    const policy = await this.getEffectivePolicy(input.userId);
    const dailyCostBudgetUsd = policy.effective.dailyCostBudgetUsd;
    const dailyTokenBudget = policy.effective.dailyTokenBudget;
    const providerDailyCostBudgetUsd = policy.effective.providerDailyCostBudgetUsd;

    if (!policy.effective.liveInferenceEnabled) {
      this.logger.warn(
        `AI live policy denied by profile switch user=${input.userId} provider=${input.providerKey}`,
      );
      return {
        allowed: false,
        reason: 'live-inference-disabled-by-policy',
        metrics: {
          totalCostUsd: 0,
          totalTokens: 0,
          providerCostUsd: 0,
          dailyCostBudgetUsd,
          dailyTokenBudget,
          providerDailyCostBudgetUsd,
        },
      };
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const logs = await this.aiDecisionLogRepository.find({
      where: {
        userId: input.userId,
        createdAt: Between(dayStart, dayEnd),
      },
      select: {
        provider: true,
        estimatedCostUsd: true,
        estimatedTokens: true,
      } as any,
    });

    const totalCostUsd = logs.reduce((sum, log) => sum + Number(log.estimatedCostUsd ?? 0), 0);
    const totalTokens = logs.reduce((sum, log) => sum + Number(log.estimatedTokens ?? 0), 0);
    const providerCostUsd = logs
      .filter((log) => String(log.provider ?? '').toLowerCase() === input.providerKey.toLowerCase())
      .reduce((sum, log) => sum + Number(log.estimatedCostUsd ?? 0), 0);

    if (dailyCostBudgetUsd > 0 && totalCostUsd >= dailyCostBudgetUsd) {
      this.logger.warn(
        `AI live policy denied by daily cost budget user=${input.userId} provider=${input.providerKey} spent=${totalCostUsd.toFixed(6)} budget=${dailyCostBudgetUsd.toFixed(6)}`,
      );
      return {
        allowed: false,
        reason: 'daily-cost-budget-exceeded',
        metrics: {
          totalCostUsd,
          totalTokens,
          providerCostUsd,
          dailyCostBudgetUsd,
          dailyTokenBudget,
          providerDailyCostBudgetUsd,
        },
      };
    }

    if (dailyTokenBudget > 0 && totalTokens >= dailyTokenBudget) {
      this.logger.warn(
        `AI live policy denied by daily token budget user=${input.userId} provider=${input.providerKey} tokens=${totalTokens} budget=${dailyTokenBudget}`,
      );
      return {
        allowed: false,
        reason: 'daily-token-budget-exceeded',
        metrics: {
          totalCostUsd,
          totalTokens,
          providerCostUsd,
          dailyCostBudgetUsd,
          dailyTokenBudget,
          providerDailyCostBudgetUsd,
        },
      };
    }

    if (providerDailyCostBudgetUsd > 0 && providerCostUsd >= providerDailyCostBudgetUsd) {
      this.logger.warn(
        `AI live policy denied by provider cost budget user=${input.userId} provider=${input.providerKey} providerSpent=${providerCostUsd.toFixed(6)} budget=${providerDailyCostBudgetUsd.toFixed(6)}`,
      );
      return {
        allowed: false,
        reason: 'provider-daily-cost-budget-exceeded',
        metrics: {
          totalCostUsd,
          totalTokens,
          providerCostUsd,
          dailyCostBudgetUsd,
          dailyTokenBudget,
          providerDailyCostBudgetUsd,
        },
      };
    }

    return {
      allowed: true,
      metrics: {
        totalCostUsd,
        totalTokens,
        providerCostUsd,
        dailyCostBudgetUsd,
        dailyTokenBudget,
        providerDailyCostBudgetUsd,
      },
    };
  }

  private getDefaultBudgetsFromEnv() {
    const dailyCostBudgetUsd = this.parseNumber(
      this.configService.get<string>('AI_DAILY_COST_BUDGET_USD', '0'),
      0,
      0,
      1_000_000,
    );
    const dailyTokenBudget = Math.floor(
      this.parseNumber(
        this.configService.get<string>('AI_DAILY_TOKEN_BUDGET', '0'),
        0,
        0,
        10_000_000_000,
      ),
    );
    const providerDailyCostBudgetUsd = this.parseNumber(
      this.configService.get<string>('AI_PROVIDER_DAILY_COST_BUDGET_USD', '0'),
      0,
      0,
      1_000_000,
    );

    return {
      dailyCostBudgetUsd,
      dailyTokenBudget,
      providerDailyCostBudgetUsd,
    };
  }

  private parseNumber(
    value: string | number | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(Math.max(parsed, min), max);
  }
}
