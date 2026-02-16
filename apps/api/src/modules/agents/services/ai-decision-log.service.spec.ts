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
});
