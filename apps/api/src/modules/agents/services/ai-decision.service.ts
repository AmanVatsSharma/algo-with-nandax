import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { getErrorMessage } from '@/common/utils/error.utils';

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
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Register built-in deterministic providers. These providers are intentionally
    // lightweight so the system can run without external LLM dependencies.
    this.providers = new Map<string, AIDecisionProvider>([
      ['openai', this.createOpenAIStyleProvider()],
      ['anthropic', this.createAnthropicStyleProvider()],
      ['heuristic', this.createHeuristicProvider()],
    ]);
    this.requestTimeoutMs = this.parseNumber(
      this.configService.get<string>('AI_PROVIDER_TIMEOUT_MS', '4000'),
      4000,
      1000,
      15000,
    );
  }

  async decide(context: AIDecisionContext): Promise<AIDecisionResult> {
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

    if (this.shouldUseLiveProvider(context)) {
      const liveDecision = await this.tryLiveProviderDecision(providerKey, context);
      if (liveDecision) {
        this.logger.log(
          `ai-decision: agent=${context.agentId} provider=${providerKey} mode=live action=${liveDecision.action} confidence=${liveDecision.confidence.toFixed(3)}`,
        );
        return liveDecision;
      }
    }

    const decision = provider.decide(context);
    const normalizedDecision: AIDecisionResult = {
      ...decision,
      metadata: {
        mode: 'deterministic',
        ...decision.metadata,
      },
    };
    this.logger.log(
      `ai-decision: agent=${context.agentId} provider=${provider.key} mode=deterministic action=${normalizedDecision.action} confidence=${normalizedDecision.confidence.toFixed(3)}`,
    );
    return normalizedDecision;
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

  private shouldUseLiveProvider(context: AIDecisionContext): boolean {
    const strategyFlag = context.strategyConfig?.aiLiveMode;
    const modelFlag = context.aiModelConfig?.liveMode;
    return this.toBoolean(strategyFlag) || this.toBoolean(modelFlag);
  }

  private async tryLiveProviderDecision(
    providerKey: string,
    context: AIDecisionContext,
  ): Promise<AIDecisionResult | null> {
    if (providerKey !== 'openai' && providerKey !== 'anthropic') {
      return null;
    }

    const apiKey =
      providerKey === 'openai'
        ? this.configService.get<string>('OPENAI_API_KEY')
        : this.configService.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        `Live AI mode requested for provider=${providerKey} but API key is missing; using deterministic fallback`,
      );
      return null;
    }

    const marketSnapshot = this.extractPrimarySymbolSnapshot(context.marketData.quotes);
    if (!marketSnapshot) {
      return null;
    }

    const liveRequestPayload = {
      symbol: marketSnapshot.symbol,
      openPrice: marketSnapshot.openPrice,
      lastPrice: marketSnapshot.lastPrice,
      dayLow: marketSnapshot.dayLow,
      dayHigh: marketSnapshot.dayHigh,
      strategyConfig: context.strategyConfig ?? {},
    };
    const prompt = [
      'You are a strict trading decision engine.',
      'Return compact JSON only with shape: {"action":"buy|sell|hold","confidence":0..1,"reason":"..."}',
      'Never include markdown.',
      `Payload: ${JSON.stringify(liveRequestPayload)}`,
    ].join('\n');

    try {
      const liveDecision = await this.executeWithRetry(async () => {
        if (providerKey === 'openai') {
          return this.callOpenAI(apiKey, prompt, context);
        }
        return this.callAnthropic(apiKey, prompt, context);
      }, 2);

      if (!liveDecision) {
        return null;
      }

      return {
        action: liveDecision.action,
        confidence: liveDecision.confidence,
        metadata: {
          provider: providerKey,
          mode: 'live',
          symbol: marketSnapshot.symbol,
          reason: liveDecision.reason,
          model: liveDecision.model,
          estimatedTokens: liveDecision.estimatedTokens,
          estimatedCostUsd: liveDecision.estimatedCostUsd,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Live AI provider call failed for provider=${providerKey} agent=${context.agentId}: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  private async callOpenAI(
    apiKey: string,
    prompt: string,
    context: AIDecisionContext,
  ): Promise<{
    action: TradeAction;
    confidence: number;
    reason: string;
    model: string;
    estimatedTokens: number;
    estimatedCostUsd: number;
  }> {
    const model = this.resolveModelName(context, 'openai', 'gpt-4o-mini');
    const response = await firstValueFrom(
      this.httpService.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          temperature: 0.1,
          max_tokens: 160,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a cautious trading assistant. Return JSON only. Keep confidence grounded.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.requestTimeoutMs,
        },
      ),
    );

    const rawContent = String(response.data?.choices?.[0]?.message?.content ?? '');
    const parsed = this.parseProviderDecision(rawContent);
    const estimatedTokens = this.estimateTokens(prompt, rawContent);

    return {
      ...parsed,
      model,
      estimatedTokens,
      estimatedCostUsd: this.estimateCostUsd('openai', estimatedTokens),
    };
  }

  private async callAnthropic(
    apiKey: string,
    prompt: string,
    context: AIDecisionContext,
  ): Promise<{
    action: TradeAction;
    confidence: number;
    reason: string;
    model: string;
    estimatedTokens: number;
    estimatedCostUsd: number;
  }> {
    const model = this.resolveModelName(context, 'anthropic', 'claude-3-5-haiku-latest');
    const response = await firstValueFrom(
      this.httpService.post(
        'https://api.anthropic.com/v1/messages',
        {
          model,
          max_tokens: 160,
          temperature: 0.1,
          system:
            'Return only compact JSON with action/confidence/reason fields. No markdown output.',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: this.requestTimeoutMs,
        },
      ),
    );

    const rawContent = String(response.data?.content?.[0]?.text ?? '');
    const parsed = this.parseProviderDecision(rawContent);
    const estimatedTokens = this.estimateTokens(prompt, rawContent);

    return {
      ...parsed,
      model,
      estimatedTokens,
      estimatedCostUsd: this.estimateCostUsd('anthropic', estimatedTokens),
    };
  }

  private parseProviderDecision(rawContent: string) {
    const extracted = this.extractJsonCandidate(rawContent);
    const parsed = JSON.parse(extracted) as {
      action?: string;
      confidence?: number;
      reason?: string;
    };

    const action = String(parsed.action ?? 'hold').toLowerCase();
    const normalizedAction: TradeAction =
      action === 'buy' || action === 'sell' || action === 'hold' ? action : 'hold';
    const confidence = this.clamp(Number(parsed.confidence ?? 0.55), 0, 1);
    const reason = String(parsed.reason ?? 'provider-response');

    return {
      action: normalizedAction,
      confidence,
      reason,
    };
  }

  private extractJsonCandidate(rawContent: string): string {
    const trimmed = String(rawContent ?? '').trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    throw new Error('Provider response did not contain JSON');
  }

  private resolveModelName(
    context: AIDecisionContext,
    providerKey: 'openai' | 'anthropic',
    fallbackModel: string,
  ): string {
    const modelFromConfig = String(context.aiModelConfig?.model ?? '').trim();
    if (modelFromConfig) {
      return modelFromConfig;
    }

    const modelName = String(context.aiModelName ?? '').trim();
    if (!modelName) {
      return fallbackModel;
    }

    if (modelName.includes(':')) {
      const [providerPrefix, modelSuffix] = modelName.split(':');
      if (providerPrefix.toLowerCase() === providerKey && modelSuffix?.trim()) {
        return modelSuffix.trim();
      }
    }

    return modelName;
  }

  private estimateTokens(input: string, output: string): number {
    const chars = String(input).length + String(output).length;
    return Math.max(1, Math.ceil(chars / 4));
  }

  private estimateCostUsd(providerKey: 'openai' | 'anthropic', tokens: number): number {
    // Very rough budgetary estimate to aid operator observability.
    const usdPer1k =
      providerKey === 'openai'
        ? this.parseNumber(
            this.configService.get<string>('OPENAI_ESTIMATED_COST_USD_PER_1K_TOKENS', '0.002'),
            0.002,
            0,
            5,
          )
        : this.parseNumber(
            this.configService.get<string>(
              'ANTHROPIC_ESTIMATED_COST_USD_PER_1K_TOKENS',
              '0.0025',
            ),
            0.0025,
            0,
            5,
          );

    return Number(((tokens / 1000) * usdPer1k).toFixed(6));
  }

  private async executeWithRetry<T>(operation: () => Promise<T>, maxAttempts: number): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `AI provider attempt ${attempt}/${maxAttempts} failed: ${getErrorMessage(error)}`,
        );
      }
    }

    throw lastError ?? new Error('AI provider operation failed');
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
        mode: 'deterministic',
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

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }

  private parseNumber(
    value: string | number | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return this.clamp(parsed, min, max);
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }
}
