import { AICostLedgerScheduler } from './ai-cost-ledger.scheduler';

describe('AICostLedgerScheduler', () => {
  const aiCostLedgerServiceMock = {
    safeRebuildDailyLedgerForDate: jest.fn(async () => ({})),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips run when scheduler disabled', async () => {
    configServiceMock.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'AI_COST_LEDGER_SCHEDULER_ENABLED') {
        return 'false';
      }
      return fallback;
    });

    const scheduler = new AICostLedgerScheduler(
      aiCostLedgerServiceMock as any,
      configServiceMock as any,
    );
    await scheduler.rebuildRecentLedgerWindows();

    expect(aiCostLedgerServiceMock.safeRebuildDailyLedgerForDate).not.toHaveBeenCalled();
  });

  it('rebuilds yesterday and today ledgers when enabled', async () => {
    configServiceMock.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'AI_COST_LEDGER_SCHEDULER_ENABLED') {
        return 'true';
      }
      return fallback;
    });

    const scheduler = new AICostLedgerScheduler(
      aiCostLedgerServiceMock as any,
      configServiceMock as any,
    );
    await scheduler.rebuildRecentLedgerWindows();

    expect(aiCostLedgerServiceMock.safeRebuildDailyLedgerForDate).toHaveBeenCalledTimes(2);
  });
});
