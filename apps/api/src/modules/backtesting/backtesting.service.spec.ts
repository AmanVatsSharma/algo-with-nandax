import { BacktestingService } from './backtesting.service';

describe('BacktestingService', () => {
  const brokerServiceMock = {
    getKiteHistoricalData: jest.fn(),
  };

  let service: BacktestingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BacktestingService(brokerServiceMock as any);
  });

  it('returns summary and trades from historical candles', async () => {
    brokerServiceMock.getKiteHistoricalData.mockResolvedValue({
      candles: [
        ['2026-01-01T09:15:00+0530', 100, 101, 99, 100, 1000],
        ['2026-01-01T09:20:00+0530', 100, 102, 100, 101, 1200],
        ['2026-01-01T09:25:00+0530', 101, 103, 100, 102, 900],
        ['2026-01-01T09:30:00+0530', 102, 103, 98, 99, 1500],
        ['2026-01-01T09:35:00+0530', 99, 100, 95, 96, 2000],
        ['2026-01-01T09:40:00+0530', 96, 99, 95, 98, 1100],
        ['2026-01-01T09:45:00+0530', 98, 101, 97, 100, 980],
      ],
    });

    const result = await service.runBacktest('user-1', {
      connectionId: 'conn-1',
      instrumentToken: '12345',
      interval: '5minute',
      fromDate: '2026-01-01',
      toDate: '2026-01-02',
      quantity: 10,
      entryThresholdPercent: 0.4,
      exitThresholdPercent: 0.3,
      feePerTrade: 0,
      slippageBps: 10,
      stopLossPercent: 0.6,
      takeProfitPercent: 1.2,
      walkForwardWindows: 2,
      initialCapital: 100000,
    });

    expect(result.summary.totalTrades).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.trades)).toBe(true);
    expect(Array.isArray(result.equityCurve)).toBe(true);
    expect(Array.isArray(result.windows)).toBe(true);
    expect(result.configUsed.slippageBps).toBe(10);
    expect(result.summary.endingEquity).toBeCloseTo(100000 + result.summary.totalPnL, 5);
    expect(brokerServiceMock.getKiteHistoricalData).toHaveBeenCalledTimes(1);
  });

  it('returns empty result shape when there are not enough candles', async () => {
    brokerServiceMock.getKiteHistoricalData.mockResolvedValue({
      candles: [['2026-01-01T09:15:00+0530', 100, 101, 99, 100, 1000]],
    });

    const result = await service.runBacktest('user-1', {
      connectionId: 'conn-1',
      instrumentToken: '12345',
      interval: '5minute',
      fromDate: '2026-01-01',
      toDate: '2026-01-02',
      initialCapital: 50000,
    });

    expect(result.summary.totalTrades).toBe(0);
    expect(result.summary.endingEquity).toBe(50000);
    expect(result.trades).toEqual([]);
  });

  it('runs portfolio backtest and aggregates per-instrument results', async () => {
    brokerServiceMock.getKiteHistoricalData
      .mockResolvedValueOnce({
        candles: [
          ['2026-01-01T09:15:00+0530', 100, 101, 99, 100, 1000],
          ['2026-01-01T09:20:00+0530', 100, 103, 99, 102, 1000],
          ['2026-01-01T09:25:00+0530', 102, 104, 101, 103, 1000],
          ['2026-01-01T09:30:00+0530', 103, 105, 102, 104, 1000],
        ],
      })
      .mockResolvedValueOnce({
        candles: [
          ['2026-01-01T09:15:00+0530', 200, 202, 199, 200, 1000],
          ['2026-01-01T09:20:00+0530', 200, 203, 198, 199, 1000],
          ['2026-01-01T09:25:00+0530', 199, 201, 197, 198, 1000],
          ['2026-01-01T09:30:00+0530', 198, 199, 195, 196, 1000],
        ],
      });

    const result = await service.runPortfolioBacktest('user-1', {
      connectionId: 'conn-1',
      instrumentTokens: ['111', '222'],
      weights: [60, 40],
      interval: '5minute',
      fromDate: '2026-01-01',
      toDate: '2026-01-02',
      quantity: 5,
      entryThresholdPercent: 0.4,
      exitThresholdPercent: 0.3,
      feePerTrade: 0,
      initialCapital: 200000,
    });

    expect(result.summary.instrumentsTested).toBe(2);
    expect(Array.isArray(result.instruments)).toBe(true);
    expect(result.instruments.length).toBe(2);
    expect(Array.isArray(result.trades)).toBe(true);
    expect(brokerServiceMock.getKiteHistoricalData).toHaveBeenCalledTimes(2);
  });

  it('optimizes thresholds and returns ranked strategies', async () => {
    brokerServiceMock.getKiteHistoricalData.mockResolvedValue({
      candles: [
        ['2026-01-01T09:15:00+0530', 100, 101, 99, 100, 1000],
        ['2026-01-01T09:20:00+0530', 100, 103, 99, 102, 1200],
        ['2026-01-01T09:25:00+0530', 102, 104, 101, 103, 900],
        ['2026-01-01T09:30:00+0530', 103, 105, 100, 101, 1500],
        ['2026-01-01T09:35:00+0530', 101, 102, 99, 100, 1100],
      ],
    });

    const result = await service.optimizeBacktest('user-1', {
      connectionId: 'conn-1',
      instrumentToken: '12345',
      interval: '5minute',
      fromDate: '2026-01-01',
      toDate: '2026-01-02',
      entryThresholdCandidates: [0.2, 0.4],
      exitThresholdCandidates: [0.15, 0.25],
      topN: 2,
    });

    expect(result.evaluatedCombinations).toBe(4);
    expect(Array.isArray(result.topStrategies)).toBe(true);
    expect(result.topStrategies.length).toBe(2);
    expect(result.bestStrategy).not.toBeNull();
  });
});
