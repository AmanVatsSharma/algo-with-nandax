import { AIGovernancePolicyService } from './ai-governance-policy.service';

describe('AIGovernancePolicyService', () => {
  const decisionLogRepositoryMock = {
    find: jest.fn(async () => []),
  };
  const profileRepositoryMock = {
    findOne: jest.fn(async () => null),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => payload),
    update: jest.fn(async () => ({ affected: 1 })),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  let service: AIGovernancePolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockImplementation((_: string, fallback?: string) => fallback);
    service = new AIGovernancePolicyService(
      decisionLogRepositoryMock as any,
      profileRepositoryMock as any,
      configServiceMock as any,
    );
  });

  it('allows live inference when budgets are disabled', async () => {
    profileRepositoryMock.findOne.mockResolvedValue({
      userId: 'user-1',
      liveInferenceEnabled: true,
      dailyCostBudgetUsd: 0,
      dailyTokenBudget: 0,
      providerDailyCostBudgetUsd: 0,
    });
    decisionLogRepositoryMock.find.mockResolvedValue([
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
    profileRepositoryMock.findOne.mockResolvedValue({
      userId: 'user-1',
      liveInferenceEnabled: true,
      dailyCostBudgetUsd: 0.001,
      dailyTokenBudget: 0,
      providerDailyCostBudgetUsd: 0,
    });

    service = new AIGovernancePolicyService(
      decisionLogRepositoryMock as any,
      profileRepositoryMock as any,
      configServiceMock as any,
    );
    decisionLogRepositoryMock.find.mockResolvedValue([
      { provider: 'openai', estimatedCostUsd: 0.002, estimatedTokens: 120 },
    ]);

    const result = await service.evaluateLiveInferencePolicy({
      userId: 'user-1',
      providerKey: 'openai',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('daily-cost-budget-exceeded');
  });

  it('updates and returns policy profile', async () => {
    profileRepositoryMock.findOne
      .mockResolvedValueOnce({
        id: 'profile-1',
        userId: 'user-1',
        liveInferenceEnabled: true,
        dailyCostBudgetUsd: 0,
        dailyTokenBudget: 0,
        providerDailyCostBudgetUsd: 0,
        policyNote: null,
      })
      .mockResolvedValueOnce({
        id: 'profile-1',
        userId: 'user-1',
        liveInferenceEnabled: false,
        dailyCostBudgetUsd: 2,
        dailyTokenBudget: 5000,
        providerDailyCostBudgetUsd: 1,
        policyNote: 'tighten budget',
      });

    const updated = await service.updatePolicyProfile('user-1', {
      liveInferenceEnabled: false,
      dailyCostBudgetUsd: 2,
      dailyTokenBudget: 5000,
      providerDailyCostBudgetUsd: 1,
      policyNote: 'tighten budget',
    });

    expect(profileRepositoryMock.update).toHaveBeenCalledTimes(1);
    expect(updated.liveInferenceEnabled).toBe(false);
    expect(updated.dailyTokenBudget).toBe(5000);
  });
});
