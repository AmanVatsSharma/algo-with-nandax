import { AIDecisionService } from './ai-decision.service';

describe('AIDecisionService', () => {
  let service: AIDecisionService;

  beforeEach(() => {
    service = new AIDecisionService();
  });

  it('uses openai provider when strategy requests it', () => {
    const result = service.decide({
      agentId: 'agent-1',
      strategyConfig: { aiProvider: 'openai' },
      marketData: {
        quotes: {
          'NSE:SBIN': {
            last_price: 110,
            ohlc: { open: 100, low: 98, high: 112 },
          },
        },
      },
    });

    expect(['buy', 'sell', 'hold']).toContain(result.action);
    expect(result.metadata.provider).toBe('openai');
  });

  it('falls back to heuristic provider for unknown provider keys', () => {
    const result = service.decide({
      agentId: 'agent-2',
      strategyConfig: { aiProvider: 'unknown-provider' },
      marketData: {
        quotes: {
          'NSE:INFY': {
            last_price: 1498,
            ohlc: { open: 1500, low: 1490, high: 1510 },
          },
        },
      },
    });

    expect(result.metadata.provider).toBe('heuristic');
  });

  it('returns hold decision when market data is missing', () => {
    const result = service.decide({
      agentId: 'agent-3',
      strategyConfig: { aiProvider: 'anthropic' },
      marketData: { quotes: {} },
    });

    expect(result.action).toBe('hold');
    expect(result.metadata.provider).toBe('anthropic');
  });
});
