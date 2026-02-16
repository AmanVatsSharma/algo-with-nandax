import { RiskService } from './risk.service';
import { RiskAlertType } from './entities/risk-alert.entity';

describe('RiskService', () => {
  let riskProfileRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  let riskAlertRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  let service: RiskService;
  let tradeRepository: {
    find: jest.Mock;
  };

  beforeEach(() => {
    riskProfileRepository = {
      findOne: jest.fn(),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => payload),
      update: jest.fn(async () => ({ affected: 1 })),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => []),
      })),
    };

    riskAlertRepository = {
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => payload),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
    };

    tradeRepository = {
      find: jest.fn(async () => []),
    };

    service = new RiskService(
      riskProfileRepository as any,
      riskAlertRepository as any,
      tradeRepository as any,
    );
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

  it('calculates risk analytics with value-at-risk output', async () => {
    tradeRepository.find
      .mockResolvedValueOnce([
        {
          netPnL: 150,
          createdAt: new Date('2026-02-10T10:00:00.000Z'),
          exitTime: new Date('2026-02-10T11:00:00.000Z'),
        },
        {
          netPnL: -50,
          createdAt: new Date('2026-02-11T10:00:00.000Z'),
          exitTime: new Date('2026-02-11T11:00:00.000Z'),
        },
        {
          netPnL: -120,
          createdAt: new Date('2026-02-12T10:00:00.000Z'),
          exitTime: new Date('2026-02-12T11:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          quantity: 10,
          entryPrice: 500,
          executedEntryPrice: 505,
        },
      ]);

    const result = await service.getRiskAnalytics('user-id', {
      days: 30,
      confidenceLevel: 95,
    });

    expect(result.tradeStats.closedTrades).toBe(3);
    expect(result.tradeStats.grossOpenExposure).toBe(5050);
    expect(result.riskMetrics.valueAtRisk).toBeGreaterThan(0);
    expect(result.riskMetrics.expectedShortfall).toBeGreaterThan(0);
    expect(Array.isArray(result.dailyPnL)).toBe(true);
  });

  it('computes today pnl from trade repository', async () => {
    tradeRepository.find.mockResolvedValue([
      { netPnL: 100 },
      { netPnL: -25.5 },
      { netPnL: 10 },
    ]);

    const pnl = await service.getTodayPnLForUser('user-id');

    expect(pnl).toBeCloseTo(84.5, 5);
    expect(tradeRepository.find).toHaveBeenCalledTimes(1);
  });
});
