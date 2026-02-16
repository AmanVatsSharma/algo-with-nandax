import { RiskService } from './risk.service';
import { RiskAlertType } from './entities/risk-alert.entity';

describe('RiskService', () => {
  let riskProfileRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  let riskAlertRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };

  let service: RiskService;

  beforeEach(() => {
    riskProfileRepository = {
      findOne: jest.fn(),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => payload),
      update: jest.fn(async () => ({ affected: 1 })),
    };

    riskAlertRepository = {
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => payload),
      find: jest.fn(async () => []),
    };

    service = new RiskService(riskProfileRepository as any, riskAlertRepository as any);
  });

  it('creates default profile when missing', async () => {
    riskProfileRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'profile-id',
      userId: 'user-id',
      killSwitchEnabled: false,
      maxPositionValuePerTrade: 0,
      maxDailyLoss: 0,
      maxDailyProfit: 0,
      maxOpenTradesPerAgent: 0,
    });

    const profile = await service.getOrCreateProfile('user-id');
    expect(profile.userId).toBe('user-id');
    expect(riskProfileRepository.save).toHaveBeenCalled();
  });

  it('blocks trade when kill switch is enabled', async () => {
    riskProfileRepository.findOne.mockResolvedValue({
      id: 'profile-id',
      userId: 'user-id',
      killSwitchEnabled: true,
      killSwitchReason: 'manual stop',
      maxPositionValuePerTrade: 0,
      maxDailyLoss: 0,
      maxDailyProfit: 0,
      maxOpenTradesPerAgent: 0,
    });

    const result = await service.evaluateTradeRisk('user-id', {
      connectionId: 'conn-id',
      agentId: 'agent-id',
      symbol: 'NSE:SBIN',
      notionalValue: 2000,
      openTradesForAgent: 0,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('manual stop');
    expect(riskAlertRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: RiskAlertType.KILL_SWITCH_BLOCK,
      }),
    );
  });
});
