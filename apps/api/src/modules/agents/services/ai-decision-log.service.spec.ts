import { AIDecisionLogService } from './ai-decision-log.service';

describe('AIDecisionLogService', () => {
  const repositoryMock = {
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => payload),
    find: jest.fn(async () => []),
  };

  let service: AIDecisionLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIDecisionLogService(repositoryMock as any);
  });

  it('persists AI decision logs with normalized payload', async () => {
    const result = await service.logDecision({
      userId: 'user-1',
      agentId: 'agent-1',
      provider: 'openai',
      mode: 'live',
      model: 'gpt-4o-mini',
      action: 'buy',
      confidence: 0.88,
      estimatedTokens: 140,
      estimatedCostUsd: 0.00028,
      reason: 'breakout-confirmed',
      metadata: { symbol: 'NSE:SBIN' },
    });

    expect(repositoryMock.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        provider: 'openai',
        mode: 'live',
      }),
    );
  });

  it('returns governance summary aggregated by provider and mode', async () => {
    repositoryMock.find.mockResolvedValue([
      {
        provider: 'openai',
        mode: 'live',
        action: 'buy',
        confidence: 0.8,
        estimatedTokens: 100,
        estimatedCostUsd: 0.002,
        createdAt: new Date('2026-02-10T10:00:00.000Z'),
      },
      {
        provider: 'openai',
        mode: 'deterministic',
        action: 'hold',
        confidence: 0.6,
        estimatedTokens: 0,
        estimatedCostUsd: 0,
        createdAt: new Date('2026-02-10T11:00:00.000Z'),
      },
      {
        provider: 'anthropic',
        mode: 'live',
        action: 'sell',
        confidence: 0.7,
        estimatedTokens: 90,
        estimatedCostUsd: 0.003,
        createdAt: new Date('2026-02-11T10:00:00.000Z'),
      },
    ]);

    const summary = await service.getGovernanceSummary('user-1', 30);

    expect(summary.totals.totalDecisions).toBe(3);
    expect(summary.totals.totalCostUsd).toBeCloseTo(0.005, 6);
    expect(summary.providerStats[0].key).toBe('openai');
    expect(summary.modeStats.some((item: any) => item.key === 'live')).toBe(true);
    expect(summary.dailyCosts.length).toBe(2);
  });
});
