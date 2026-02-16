import { AIGovernanceEventService } from './ai-governance-event.service';

describe('AIGovernanceEventService', () => {
  const repositoryMock = {
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => payload),
    find: jest.fn(async () => []),
  };

  let service: AIGovernanceEventService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIGovernanceEventService(repositoryMock as any);
  });

  it('persists governance events', async () => {
    const result = await service.logEvent({
      userId: 'user-1',
      agentId: 'agent-1',
      provider: 'openai',
      eventType: 'live-policy-block',
      blocked: true,
      reason: 'daily-cost-budget-exceeded',
      metadata: { spent: 2 },
    });

    expect(repositoryMock.create).toHaveBeenCalledTimes(1);
    expect(repositoryMock.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        provider: 'openai',
        blocked: true,
      }),
    );
  });
});
