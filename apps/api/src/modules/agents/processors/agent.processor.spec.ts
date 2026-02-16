import { AgentProcessor } from './agent.processor';

describe('AgentProcessor daily PnL guardrails', () => {
  let processor: AgentProcessor;

  beforeEach(() => {
    processor = new AgentProcessor(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('blocks when maxDailyLoss is exceeded', () => {
    const blocked = (processor as any).shouldBlockTradingByDailyPnL(
      { maxDailyLoss: 1000 },
      -1200,
    );
    expect(blocked).toBe(true);
  });

  it('blocks when maxDailyProfit target reached', () => {
    const blocked = (processor as any).shouldBlockTradingByDailyPnL(
      { maxDailyProfit: 5000 },
      5400,
    );
    expect(blocked).toBe(true);
  });

  it('does not block when pnl is within configured range', () => {
    const blocked = (processor as any).shouldBlockTradingByDailyPnL(
      { maxDailyLoss: 1000, maxDailyProfit: 5000 },
      250,
    );
    expect(blocked).toBe(false);
  });
});
