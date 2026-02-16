import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AICostLedger } from '../entities/ai-cost-ledger.entity';
import { AIDecisionLog } from '../entities/ai-decision-log.entity';
import { getErrorMessage } from '@/common/utils/error.utils';

@Injectable()
export class AICostLedgerService {
  private readonly logger = new Logger(AICostLedgerService.name);

  constructor(
    @InjectRepository(AICostLedger)
    private readonly aiCostLedgerRepository: Repository<AICostLedger>,
    @InjectRepository(AIDecisionLog)
    private readonly aiDecisionLogRepository: Repository<AIDecisionLog>,
  ) {}

  async rebuildDailyLedgerForDate(targetDate: Date) {
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);
    const ledgerDate = dayStart.toISOString().slice(0, 10);

    const logs = await this.aiDecisionLogRepository.find({
      where: {
        createdAt: Between(dayStart, dayEnd),
      },
    });

    const grouped = new Map<
      string,
      {
        userId: string;
        provider: string;
        mode: string;
        decisionCount: number;
        totalTokens: number;
        totalCostUsd: number;
        confidenceValues: number[];
      }
    >();

    for (const log of logs) {
      const provider = String(log.provider ?? 'unknown').trim() || 'unknown';
      const mode = String(log.mode ?? 'unknown').trim() || 'unknown';
      const key = `${log.userId}:${provider}:${mode}`;
      const current = grouped.get(key) ?? {
        userId: log.userId,
        provider,
        mode,
        decisionCount: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        confidenceValues: [],
      };
      current.decisionCount += 1;
      current.totalTokens += Number(log.estimatedTokens ?? 0);
      current.totalCostUsd += Number(log.estimatedCostUsd ?? 0);
      current.confidenceValues.push(Number(log.confidence ?? 0));
      grouped.set(key, current);
    }

    const rows = Array.from(grouped.values()).map((item) => {
      const avgConfidence = item.confidenceValues.length
        ? item.confidenceValues.reduce((sum, value) => sum + value, 0) /
          item.confidenceValues.length
        : 0;
      const minConfidence = item.confidenceValues.length
        ? Math.min(...item.confidenceValues)
        : 0;
      const maxConfidence = item.confidenceValues.length
        ? Math.max(...item.confidenceValues)
        : 0;

      return {
        userId: item.userId,
        ledgerDate,
        provider: item.provider,
        mode: item.mode,
        decisionCount: item.decisionCount,
        totalTokens: item.totalTokens,
        totalCostUsd: item.totalCostUsd,
        avgConfidence,
        minConfidence,
        maxConfidence,
      };
    });

    await this.aiCostLedgerRepository.delete({ ledgerDate });
    if (rows.length) {
      await this.aiCostLedgerRepository.save(this.aiCostLedgerRepository.create(rows));
    }

    this.logger.log(
      `AI cost ledger rebuilt for date=${ledgerDate} rows=${rows.length} logs=${logs.length}`,
    );
    return {
      ledgerDate,
      rows: rows.length,
      logs: logs.length,
    };
  }

  async getUserLedger(userId: string, days: number = 30) {
    const lookbackDays = Math.min(Math.max(days, 1), 365);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - lookbackDays);
    const startDateValue = startDate.toISOString().slice(0, 10);
    const endDateValue = endDate.toISOString().slice(0, 10);

    const rows = await this.aiCostLedgerRepository.find({
      where: {
        userId,
        ledgerDate: Between(startDateValue, endDateValue),
      },
      order: {
        ledgerDate: 'ASC',
      },
    });

    const totals = rows.reduce(
      (accumulator, row) => {
        accumulator.decisionCount += Number(row.decisionCount ?? 0);
        accumulator.totalTokens += Number(row.totalTokens ?? 0);
        accumulator.totalCostUsd += Number(row.totalCostUsd ?? 0);
        return accumulator;
      },
      {
        decisionCount: 0,
        totalTokens: 0,
        totalCostUsd: 0,
      },
    );

    return {
      period: {
        lookbackDays,
        from: startDateValue,
        to: endDateValue,
      },
      totals,
      rows,
    };
  }

  async safeRebuildDailyLedgerForDate(targetDate: Date) {
    try {
      return await this.rebuildDailyLedgerForDate(targetDate);
    } catch (error) {
      this.logger.warn(
        `Failed rebuilding AI cost ledger for ${targetDate.toISOString()}: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }
}
