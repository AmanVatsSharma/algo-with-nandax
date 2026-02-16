import { AIGovernancePolicyService } from './ai-governance-policy.service';

describe('AIGovernancePolicyService', () => {
  const repositoryMock = {
    find: jest.fn(async () => []),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  let service: AIGovernancePolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockImplementation((_: string, fallback?: string) => fallback);
    service = new AIGovernancePolicyService(
      repositoryMock as any,
      configServiceMock as any,
    );
  });

  it('allows live inference when budgets are disabled', async () => {
    repositoryMock.find.mockResolvedValue([
      { provider: 'openai', estimatedCostUsd: 0.001, estimatedTokens: 100 },
    ]);

    const result = await service.evaluateLiveInferencePolicy({
      userId: 'user-1',
      providerKey: 'openai',
    });

    expect(result.allowed).toBe(true);
    expect(result.metrics.totalTokens).toBe(100);
  });

  it('blocks when daily total cost budget is exceeded', async () => {
    configServiceMock.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'AI_DAILY_COST_BUDGET_USD') {
        return '0.001';
      }
      return fallback;
    });

    service = new AIGovernancePolicyService(
      repositoryMock as any,
      configServiceMock as any,
    );
    repositoryMock.find.mockResolvedValue([
      { provider: 'openai', estimatedCostUsd: 0.002, estimatedTokens: 120 },
    ]);

    const result = await service.evaluateLiveInferencePolicy({
      userId: 'user-1',
      providerKey: 'openai',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('daily-cost-budget-exceeded');
  });
});
