import { AICostLedgerService } from './ai-cost-ledger.service';

describe('AICostLedgerService', () => {
  const aiCostLedgerRepository = {
    find: jest.fn(async () => []),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => payload),
    delete: jest.fn(async () => ({ affected: 0 })),
  };

  const aiDecisionLogRepository = {
    find: jest.fn(async () => []),
  };

  let service: AICostLedgerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AICostLedgerService(
      aiCostLedgerRepository as any,
      aiDecisionLogRepository as any,
    );
  });

  it('rebuilds daily ledger from decision logs', async () => {
    aiDecisionLogRepository.find.mockResolvedValue([
      {
        userId: 'user-1',
        provider: 'openai',
        mode: 'live',
        estimatedTokens: 100,
        estimatedCostUsd: 0.002,
        confidence: 0.8,
      },
      {
        userId: 'user-1',
        provider: 'openai',
        mode: 'live',
        estimatedTokens: 120,
        estimatedCostUsd: 0.003,
        confidence: 0.7,
      },
    ]);

    const result = await service.rebuildDailyLedgerForDate(new Date('2026-02-16T12:00:00.000Z'));

    expect(result.rows).toBe(1);
    expect(aiCostLedgerRepository.delete).toHaveBeenCalledTimes(1);
    expect(aiCostLedgerRepository.save).toHaveBeenCalledTimes(1);
  });

  it('returns ledger totals scoped by lookback', async () => {
    aiCostLedgerRepository.find.mockResolvedValue([
      {
        decisionCount: 3,
        totalTokens: 220,
        totalCostUsd: 0.005,
      },
      {
        decisionCount: 2,
        totalTokens: 120,
        totalCostUsd: 0.002,
      },
    ]);

    const result = await service.getUserLedger('user-1', 30);
    expect(result.totals.decisionCount).toBe(5);
    expect(result.totals.totalTokens).toBe(340);
    expect(result.totals.totalCostUsd).toBeCloseTo(0.007, 6);
  });
});
