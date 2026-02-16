import { ForbiddenException } from '@nestjs/common';
import { AIGovernancePolicyRequestService } from './ai-governance-policy-request.service';

describe('AIGovernancePolicyRequestService', () => {
  const policyRequestRepositoryMock = {
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: 'request-1', ...payload })),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    update: jest.fn(async () => ({ affected: 1 })),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  const aiGovernancePolicyServiceMock = {
    updatePolicyProfile: jest.fn(async () => ({ id: 'profile-1' })),
  };

  let service: AIGovernancePolicyRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockImplementation((_: string, fallback?: string) => fallback);
    service = new AIGovernancePolicyRequestService(
      policyRequestRepositoryMock as any,
      configServiceMock as any,
      aiGovernancePolicyServiceMock as any,
    );
  });

  it('creates pending policy request with normalized payload', async () => {
    const result = await service.createRequest({
      requestedByUserId: 'user-1',
      targetUserId: 'user-1',
      dto: {
        liveInferenceEnabled: false,
        dailyCostBudgetUsd: 2,
        requestNote: 'needs review',
      },
    });

    expect(result.status).toBe('pending');
    expect(result.requestNote).toBe('needs review');
    expect(result.requestedPolicy).toEqual({
      liveInferenceEnabled: false,
      dailyCostBudgetUsd: 2,
    });
  });

  it('lists all requests for admins', async () => {
    await service.listRequestsForUser({ userId: 'admin-1', role: 'admin', limit: 10 });

    expect(policyRequestRepositoryMock.find).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      }),
    );
  });

  it('rejects non-admin approval attempts', async () => {
    await expect(
      service.approveRequest({
        requestId: 'request-1',
        reviewerUserId: 'user-2',
        reviewerRole: 'user',
        dto: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('approves pending request and applies policy update', async () => {
    policyRequestRepositoryMock.findOne
      .mockResolvedValueOnce({
        id: 'request-1',
        status: 'pending',
        targetUserId: 'user-1',
        requestedPolicy: {
          liveInferenceEnabled: false,
          dailyTokenBudget: 1000,
        },
      })
      .mockResolvedValueOnce({
        id: 'request-1',
        status: 'approved',
        targetUserId: 'user-1',
        requestedPolicy: {
          liveInferenceEnabled: false,
          dailyTokenBudget: 1000,
        },
      });

    const result = await service.approveRequest({
      requestId: 'request-1',
      reviewerUserId: 'admin-1',
      reviewerRole: 'admin',
      dto: { reviewNote: 'looks good' },
    });

    expect(aiGovernancePolicyServiceMock.updatePolicyProfile).toHaveBeenCalledWith('user-1', {
      liveInferenceEnabled: false,
      dailyTokenBudget: 1000,
    });
    expect(policyRequestRepositoryMock.update).toHaveBeenCalledWith(
      'request-1',
      expect.objectContaining({ status: 'approved' }),
    );
    expect(result.status).toBe('approved');
  });
});
