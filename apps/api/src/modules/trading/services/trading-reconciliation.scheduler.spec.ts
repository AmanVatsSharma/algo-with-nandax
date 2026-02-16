import { TradingReconciliationScheduler } from './trading-reconciliation.scheduler';

describe('TradingReconciliationScheduler', () => {
  const tradingServiceMock = {
    findPendingTradesForReconciliation: jest.fn(),
    reconcileTrades: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips reconciliation cycle when feature is disabled', async () => {
    configServiceMock.get.mockImplementation((key: string, fallback: string) => {
      if (key === 'TRADING_AUTO_RECONCILIATION_ENABLED') {
        return 'false';
      }
      return fallback;
    });

    const scheduler = new TradingReconciliationScheduler(
      tradingServiceMock as any,
      configServiceMock as any,
    );

    await scheduler.reconcilePendingTradesTick();

    expect(tradingServiceMock.findPendingTradesForReconciliation).not.toHaveBeenCalled();
    expect(tradingServiceMock.reconcileTrades).not.toHaveBeenCalled();
  });

  it('reconciles all pending candidates when feature is enabled', async () => {
    configServiceMock.get.mockImplementation((key: string, fallback: string) => {
      if (key === 'TRADING_AUTO_RECONCILIATION_ENABLED') {
        return 'true';
      }
      if (key === 'TRADING_AUTO_RECONCILIATION_BATCH_SIZE') {
        return '25';
      }
      return fallback;
    });

    tradingServiceMock.findPendingTradesForReconciliation.mockResolvedValue([
      { id: 'trade-1', userId: 'user-1', connectionId: 'conn-1' },
      { id: 'trade-2', userId: 'user-2', connectionId: 'conn-2' },
    ]);
    tradingServiceMock.reconcileTrades.mockResolvedValue({
      processed: 1,
      executed: 1,
      partiallyFilled: 0,
      rejected: 0,
      cancelled: 0,
      open: 0,
      failed: 0,
    });

    const scheduler = new TradingReconciliationScheduler(
      tradingServiceMock as any,
      configServiceMock as any,
    );

    await scheduler.reconcilePendingTradesTick();

    expect(tradingServiceMock.findPendingTradesForReconciliation).toHaveBeenCalledWith(25);
    expect(tradingServiceMock.reconcileTrades).toHaveBeenCalledTimes(2);
    expect(tradingServiceMock.reconcileTrades).toHaveBeenCalledWith('user-1', {
      tradeId: 'trade-1',
      connectionId: 'conn-1',
      maxItems: 1,
    });
  });
});
