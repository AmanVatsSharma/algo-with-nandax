import { Injectable, Logger } from '@nestjs/common';

type TradeAction = 'buy' | 'sell' | 'hold';

interface AIDecisionContext {
  agentId: string;
  marketData: { quotes: Record<string, any> };
  strategyConfig?: Record<string, unknown>;
  aiModelName?: string;
  aiModelConfig?: Record<string, unknown>;
}

interface AIDecisionResult {
  action: TradeAction;
  confidence: number;
  metadata: Record<string, unknown>;
}

interface AIDecisionProvider {
  key: string;
  decide(context: AIDecisionContext): AIDecisionResult;
}

@Injectable()
export class AIDecisionService {
  private readonly logger = new Logger(AIDecisionService.name);
  private readonly providers: Map<string, AIDecisionProvider>;

  constructor() {
    // Register built-in deterministic providers. These providers are intentionally
    // lightweight so the system can run without external LLM dependencies.
    this.providers = new Map<string, AIDecisionProvider>([
      ['openai', this.createOpenAIStyleProvider()],
      ['anthropic', this.createAnthropicStyleProvider()],
      ['heuristic', this.createHeuristicProvider()],
    ]);
  }

  decide(context: AIDecisionContext): AIDecisionResult {
    const providerKey = this.resolveProviderKey(context);
    const provider = this.providers.get(providerKey) ?? this.providers.get('heuristic');

    if (!provider) {
      this.logger.warn(`No AI providers registered. Falling back to HOLD for ${context.agentId}`);
      return {
        action: 'hold',
        confidence: 0.2,
        metadata: {
          reason: 'no-provider-registered',
          providerRequested: providerKey,
        },
      };
    }

    const decision = provider.decide(context);
    this.logger.log(
      `ai-decision: agent=${context.agentId} provider=${provider.key} action=${decision.action} confidence=${decision.confidence.toFixed(3)}`,
    );
    return decision;
  }

  private resolveProviderKey(context: AIDecisionContext): string {
    const strategyProvider = String(context.strategyConfig?.aiProvider ?? '').trim().toLowerCase();
    const modelName = String(context.aiModelName ?? '').trim().toLowerCase();
    const modelProvider = modelName.includes(':') ? modelName.split(':')[0] : modelName;
    const configProvider = String(context.aiModelConfig?.provider ?? '')
      .trim()
      .toLowerCase();

    const candidate = strategyProvider || configProvider || modelProvider || 'heuristic';
    if (!this.providers.has(candidate)) {
      this.logger.warn(
        `Unknown AI provider "${candidate}" for agent=${context.agentId}; using heuristic fallback`,
      );
      return 'heuristic';
    }
    return candidate;
  }

  private createOpenAIStyleProvider(): AIDecisionProvider {
    return {
      key: 'openai',
      decide: (context) => {
        const marketSnapshot = this.extractPrimarySymbolSnapshot(context.marketData.quotes);
        if (!marketSnapshot) {
          return this.holdDecision('missing-market-data', 'openai');
        }

        const { symbol, openPrice, lastPrice, dayLow, dayHigh } = marketSnapshot;
        const changePercent = ((lastPrice - openPrice) / openPrice) * 100;
        const intradayRange = dayHigh > dayLow ? ((dayHigh - dayLow) / openPrice) * 100 : 0;
        const volatilityPenalty = Math.min(intradayRange / 6, 0.25);
        const confidence = Math.max(0.5, Math.min(0.95, Math.abs(changePercent) / 2.2 - volatilityPenalty + 0.6));

        if (changePercent >= 0.45) {
          return {
            action: 'buy',
            confidence,
            metadata: {
              provider: 'openai',
              strategySignal: 'momentum-breakout',
              symbol,
              changePercent,
              intradayRange,
            },
          };
        }

        if (changePercent <= -0.45) {
          return {
            action: 'sell',
            confidence,
            metadata: {
              provider: 'openai',
              strategySignal: 'downtrend-continuation',
              symbol,
              changePercent,
              intradayRange,
            },
          };
        }

        return this.holdDecision('range-bound-market', 'openai', {
          symbol,
          changePercent,
          intradayRange,
        });
      },
    };
  }

  private createAnthropicStyleProvider(): AIDecisionProvider {
    return {
      key: 'anthropic',
      decide: (context) => {
        const marketSnapshot = this.extractPrimarySymbolSnapshot(context.marketData.quotes);
        if (!marketSnapshot) {
          return this.holdDecision('missing-market-data', 'anthropic');
        }

        const { symbol, openPrice, lastPrice, dayLow, dayHigh } = marketSnapshot;
        const changePercent = ((lastPrice - openPrice) / openPrice) * 100;
        const meanPrice = (dayLow + dayHigh) / 2;
        const reversionDistance = ((lastPrice - meanPrice) / openPrice) * 100;
        const confidence = Math.max(0.52, Math.min(0.9, Math.abs(reversionDistance) / 2 + 0.55));

        if (reversionDistance >= 0.6 && changePercent > 0) {
          return {
            action: 'sell',
            confidence,
            metadata: {
              provider: 'anthropic',
              strategySignal: 'mean-reversion-short',
              symbol,
              changePercent,
              reversionDistance,
            },
          };
        }

        if (reversionDistance <= -0.6 && changePercent < 0) {
          return {
            action: 'buy',
            confidence,
            metadata: {
              provider: 'anthropic',
              strategySignal: 'mean-reversion-long',
              symbol,
              changePercent,
              reversionDistance,
            },
          };
        }

        return this.holdDecision('no-high-conviction-reversion', 'anthropic', {
          symbol,
          changePercent,
          reversionDistance,
        });
      },
    };
  }

  private createHeuristicProvider(): AIDecisionProvider {
    return {
      key: 'heuristic',
      decide: (context) => {
        const marketSnapshot = this.extractPrimarySymbolSnapshot(context.marketData.quotes);
        if (!marketSnapshot) {
          return this.holdDecision('missing-market-data', 'heuristic');
        }

        const { symbol, openPrice, lastPrice } = marketSnapshot;
        const changePercent = ((lastPrice - openPrice) / openPrice) * 100;
        const confidence = Math.max(0.5, Math.min(0.85, Math.abs(changePercent) / 2 + 0.45));

        if (changePercent >= 0.5) {
          return {
            action: 'buy',
            confidence,
            metadata: {
              provider: 'heuristic',
              strategySignal: 'upside-breakout',
              symbol,
              changePercent,
            },
          };
        }

        if (changePercent <= -0.5) {
          return {
            action: 'sell',
            confidence,
            metadata: {
              provider: 'heuristic',
              strategySignal: 'downside-breakdown',
              symbol,
              changePercent,
            },
          };
        }

        return this.holdDecision('weak-directional-signal', 'heuristic', {
          symbol,
          changePercent,
        });
      },
    };
  }

  private holdDecision(
    reason: string,
    provider: string,
    metadata: Record<string, unknown> = {},
  ): AIDecisionResult {
    return {
      action: 'hold',
      confidence: 0.55,
      metadata: {
        provider,
        reason,
        ...metadata,
      },
    };
  }

  private extractPrimarySymbolSnapshot(quotes: Record<string, any>) {
    const symbol = Object.keys(quotes ?? {})[0];
    if (!symbol) {
      return null;
    }

    const quote = quotes[symbol] ?? {};
    const openPrice = Number(quote?.ohlc?.open ?? 0);
    const lastPrice = Number(quote?.last_price ?? 0);
    const dayLow = Number(quote?.ohlc?.low ?? 0);
    const dayHigh = Number(quote?.ohlc?.high ?? 0);

    if (
      !Number.isFinite(openPrice) ||
      !Number.isFinite(lastPrice) ||
      openPrice <= 0 ||
      lastPrice <= 0
    ) {
      return null;
    }

    return {
      symbol,
      openPrice,
      lastPrice,
      dayLow: Number.isFinite(dayLow) && dayLow > 0 ? dayLow : openPrice,
      dayHigh: Number.isFinite(dayHigh) && dayHigh > 0 ? dayHigh : lastPrice,
    };
  }
}
