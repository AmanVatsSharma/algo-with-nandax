import { AIDecisionService } from './ai-decision.service';
import { of } from 'rxjs';

describe('AIDecisionService', () => {
  const httpServiceMock = {
    post: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(),
  };
  const aiGovernancePolicyServiceMock = {
    evaluateLiveInferencePolicy: jest.fn(async () => ({ allowed: true } as any)),
  };

  let service: AIDecisionService;

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'AI_PROVIDER_TIMEOUT_MS') {
        return '4000';
      }
      return fallback;
    });
    aiGovernancePolicyServiceMock.evaluateLiveInferencePolicy.mockResolvedValue({
      allowed: true,
    });
    service = new AIDecisionService(
      httpServiceMock as any,
      configServiceMock as any,
      aiGovernancePolicyServiceMock as any,
    );
  });

  it('uses openai provider when strategy requests it', async () => {
    const result = await service.decide({
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

  it('falls back to heuristic provider for unknown provider keys', async () => {
    const result = await service.decide({
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

  it('returns hold decision when market data is missing', async () => {
    const result = await service.decide({
      agentId: 'agent-3',
      strategyConfig: { aiProvider: 'anthropic' },
      marketData: { quotes: {} },
    });

    expect(result.action).toBe('hold');
    expect(result.metadata.provider).toBe('anthropic');
  });

  it('falls back to deterministic mode when live mode lacks api key', async () => {
    configServiceMock.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'AI_PROVIDER_TIMEOUT_MS') {
        return '4000';
      }
      if (key === 'OPENAI_API_KEY') {
        return '';
      }
      return fallback;
    });
    service = new AIDecisionService(
      httpServiceMock as any,
      configServiceMock as any,
      aiGovernancePolicyServiceMock as any,
    );

    const result = await service.decide({
      userId: 'user-1',
      agentId: 'agent-4',
      strategyConfig: { aiProvider: 'openai', aiLiveMode: true },
      marketData: {
        quotes: {
          'NSE:SBIN': {
            last_price: 110,
            ohlc: { open: 100, low: 99, high: 111 },
          },
        },
      },
    });

    expect(result.metadata.mode).toBe('deterministic');
    expect(httpServiceMock.post).not.toHaveBeenCalled();
  });

  it('uses live provider response when api key is configured', async () => {
    configServiceMock.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'AI_PROVIDER_TIMEOUT_MS') {
        return '4000';
      }
      if (key === 'OPENAI_API_KEY') {
        return 'test-openai-key';
      }
      if (key === 'OPENAI_ESTIMATED_COST_USD_PER_1K_TOKENS') {
        return '0.002';
      }
      return fallback;
    });
    httpServiceMock.post.mockReturnValue(
      of({
        data: {
          choices: [
            {
              message: {
                content: '{"action":"buy","confidence":0.88,"reason":"breakout-confirmed"}',
              },
            },
          ],
        },
      }),
    );

    service = new AIDecisionService(
      httpServiceMock as any,
      configServiceMock as any,
      aiGovernancePolicyServiceMock as any,
    );
    const result = await service.decide({
      userId: 'user-1',
      agentId: 'agent-5',
      strategyConfig: { aiProvider: 'openai', aiLiveMode: true },
      marketData: {
        quotes: {
          'NSE:SBIN': {
            last_price: 110,
            ohlc: { open: 100, low: 99, high: 111 },
          },
        },
      },
    });

    expect(result.metadata.mode).toBe('live');
    expect(result.action).toBe('buy');
    expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
  });

  it('blocks live mode when governance policy denies budget', async () => {
    configServiceMock.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'AI_PROVIDER_TIMEOUT_MS') {
        return '4000';
      }
      if (key === 'OPENAI_API_KEY') {
        return 'test-openai-key';
      }
      return fallback;
    });
    aiGovernancePolicyServiceMock.evaluateLiveInferencePolicy.mockResolvedValue({
      allowed: false,
      reason: 'daily-cost-budget-exceeded',
    });
    service = new AIDecisionService(
      httpServiceMock as any,
      configServiceMock as any,
      aiGovernancePolicyServiceMock as any,
    );

    const result = await service.decide({
      userId: 'user-1',
      agentId: 'agent-6',
      strategyConfig: { aiProvider: 'openai', aiLiveMode: true },
      marketData: {
        quotes: {
          'NSE:SBIN': {
            last_price: 110,
            ohlc: { open: 100, low: 99, high: 111 },
          },
        },
      },
    });

    expect(result.metadata.mode).toBe('deterministic');
    expect(httpServiceMock.post).not.toHaveBeenCalled();
  });
});
