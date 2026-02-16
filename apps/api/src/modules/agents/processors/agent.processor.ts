import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AgentsService } from '../agents.service';
import { AgentExecutor } from '../services/agent-executor.service';
import { TradingService } from '@/modules/trading/trading.service';
import { TradeExecutor } from '@/modules/trading/services/trade-executor.service';
import { StrategyService } from '@/modules/strategy/strategy.service';
import { AgentType } from '../entities/agent.entity';
import { OrderSide, OrderType } from '@/modules/trading/entities/trade.entity';
import { getErrorMessage } from '@/common/utils/error.utils';
import { BrokerService } from '@/modules/broker/broker.service';
import { RiskService } from '@/modules/risk/risk.service';

type AgentDecision = {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  symbol?: string;
  metadata?: Record<string, unknown>;
};

@Processor('agents')
export class AgentProcessor {
  private readonly logger = new Logger(AgentProcessor.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentExecutor: AgentExecutor,
    private readonly tradingService: TradingService,
    private readonly tradeExecutor: TradeExecutor,
    private readonly strategyService: StrategyService,
    private readonly brokerService: BrokerService,
    private readonly riskService: RiskService,
  ) {}

  @Process('execute-strategy')
  async handleExecuteStrategy(job: Job) {
    const { agentId, strategyId, agentType, strategyConfig } = job.data;
    this.logger.log(`Executing strategy for agent: ${agentId}`);

    try {
      const agent = await this.agentsService.findById(agentId);
      const strategy = await this.strategyService.findById(strategyId);

      // Check if agent has available capital
      if (agent.currentCapital <= 0) {
        this.logger.warn(`Agent ${agentId} has no capital available`);
        return;
      }

      // Check active trades count
      const openTrades = await this.tradingService.findOpenTrades(agentId);
      if (openTrades.length >= strategy.maxPositions) {
        this.logger.warn(`Agent ${agentId} has reached max positions`);
        return;
      }

      // Enforce daily trade budget from strategy.
      const todayTrades = await this.tradingService.findTodayTrades(agent.userId);
      const todayTradesForAgent = todayTrades.filter((trade) => trade.agentId === agent.id);
      if (todayTradesForAgent.length >= strategy.maxTradesPerDay) {
        this.logger.warn(
          `Agent ${agentId} reached daily trade limit (${strategy.maxTradesPerDay}), skipping`,
        );
        return;
      }

      const agentTodayPnL = todayTradesForAgent.reduce(
        (sum, trade) => sum + Number(trade.netPnL ?? 0),
        0,
      );

      const profilePnLEvaluation = await this.riskService.evaluateDailyPnL(
        agent.userId,
        agentTodayPnL,
      );
      if (!profilePnLEvaluation.allowed) {
        this.logger.warn(
          `Agent ${agentId} blocked by profile daily PnL guardrail: ${profilePnLEvaluation.reason}`,
        );
        return {
          success: true,
          executed: false,
          reason: profilePnLEvaluation.reason,
          todayPnL: agentTodayPnL,
        };
      }

      if (this.shouldBlockTradingByDailyPnL(strategyConfig ?? {}, agentTodayPnL)) {
        this.logger.warn(
          `Agent ${agentId} blocked by daily PnL guardrails. todayPnL=${agentTodayPnL}`,
        );
        return {
          success: true,
          executed: false,
          reason: 'daily-pnl-guardrail-triggered',
          todayPnL: agentTodayPnL,
        };
      }

      // Fetch live market data from broker connection.
      const marketData = await this.getMarketData(agent.userId, agent.connectionId, strategy.instruments);

      // Make trading decision based on agent type
      let decision: AgentDecision;
      if (agentType === AgentType.AI_POWERED) {
        const aiDecision = await this.agentExecutor.makeAIDecision(
          agentId,
          marketData,
          strategyConfig,
          {
            aiModelName: agent.aiModelName,
            aiModelConfig: agent.aiModelConfig,
          },
        );

        decision = {
          ...aiDecision,
          symbol:
            (aiDecision.metadata?.symbol as string | undefined) ?? strategy.instruments[0],
        };
      } else {
        decision = this.executeRuleBasedStrategy(marketData, strategyConfig);
      }

      // Execute trade if decision is buy or sell
      if (decision.action === 'buy' || decision.action === 'sell') {
        this.logger.log(
          `Agent ${agentId} decided to ${decision.action} ${decision.symbol ?? 'unknown-symbol'} with confidence ${decision.confidence}`,
        );
        
        // Only execute if confidence is above threshold
        if (decision.confidence >= 0.7) {
          if (!agent.autoTrade) {
            this.logger.warn(`Agent ${agentId} is autoTrade=false. Decision logged without execution.`);
            return { success: true, decision, executed: false, reason: 'auto-trade-disabled' };
          }

          const symbol = decision.symbol ?? strategy.instruments[0];
          const ltp = this.getInstrumentLtp(marketData, symbol);
          if (!ltp || ltp <= 0) {
            this.logger.warn(
              `Agent ${agentId} has invalid LTP for ${symbol}. Cannot calculate quantity safely.`,
            );
            return { success: true, decision, executed: false, reason: 'missing-ltp' };
          }

          const quantity = Math.max(1, Math.floor(Number(strategy.maxCapitalPerTrade) / ltp));

          if (agent.paperTrading) {
            await this.tradeExecutor.executePaperTrade(agent.userId, agent.id, agent.connectionId, {
              symbol,
              side: decision.action === 'buy' ? OrderSide.BUY : OrderSide.SELL,
              quantity,
              orderType: OrderType.MARKET,
              price: ltp,
              metadata: {
                reason: 'paper-trading-mode',
                decisionConfidence: decision.confidence,
              },
            });

            this.logger.warn(
              `Agent ${agentId} paper trade simulated: ${decision.action} ${quantity} ${symbol} @ ${ltp}`,
            );
            return { success: true, decision, executed: true, reason: 'paper-trading-simulated' };
          }

          await this.tradeExecutor.executeTrade(agent.userId, agent.id, agent.connectionId, {
            symbol,
            side: decision.action === 'buy' ? OrderSide.BUY : OrderSide.SELL,
            quantity,
            orderType: OrderType.MARKET,
            price: ltp,
          });

          this.logger.log(
            `Trade executed for agent ${agentId}: ${decision.action} ${quantity} ${symbol} @ ${ltp}`,
          );

          return { success: true, decision, executed: true };
        }
      }

      return { success: true, decision };
    } catch (error) {
      this.logger.error(`Error executing strategy for agent ${agentId}`, error);
      await this.agentsService.setError(
        agentId,
        getErrorMessage(error, 'Failed to execute strategy'),
      );
      throw error;
    }
  }

  private async getMarketData(userId: string, connectionId: string, instruments: string[]) {
    try {
      const quotes = await this.brokerService.getKiteQuotes(userId, connectionId, instruments);
      return {
        quotes,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch live market data for connection ${connectionId}. Using empty quotes fallback.`,
        error,
      );
      return {
        quotes: {},
        timestamp: new Date(),
      };
    }
  }

  private executeRuleBasedStrategy(
    marketData: { quotes: Record<string, any> },
    strategyConfig: any,
  ): AgentDecision {
    const symbol = Object.keys(marketData.quotes)[0];
    if (!symbol) {
      return {
        action: 'hold',
        confidence: 0.4,
        metadata: { reason: 'no-market-data' },
      };
    }

    const quote = marketData.quotes[symbol];
    const ltp = Number(quote?.last_price ?? 0);
    const open = Number(quote?.ohlc?.open ?? 0);

    if (ltp <= 0 || open <= 0) {
      return {
        action: 'hold',
        confidence: 0.4,
        symbol,
        metadata: { reason: 'invalid-price-points' },
      };
    }

    const changePercent = ((ltp - open) / open) * 100;
    const absoluteChange = Math.abs(changePercent);
    const confidence = Math.min(0.95, Math.max(0.55, absoluteChange / 2));

    if (changePercent >= 0.35) {
      return {
        action: 'buy',
        confidence,
        symbol,
        metadata: { changePercent, strategy: 'intraday-momentum-breakout' },
      };
    }

    if (changePercent <= -0.35) {
      return {
        action: 'sell',
        confidence,
        symbol,
        metadata: { changePercent, strategy: 'intraday-mean-reversal-entry' },
      };
    }

    return {
      action: 'hold',
      confidence: 0.55,
      symbol,
      metadata: { changePercent, strategyConfig },
    };
  }

  private getInstrumentLtp(
    marketData: { quotes: Record<string, any> },
    symbol: string,
  ): number | null {
    const quote = marketData.quotes?.[symbol];
    if (!quote) {
      return null;
    }

    const ltp = Number(quote.last_price ?? 0);
    if (!Number.isFinite(ltp) || ltp <= 0) {
      return null;
    }

    return ltp;
  }

  private shouldBlockTradingByDailyPnL(
    strategyConfig: Record<string, unknown>,
    todayPnL: number,
  ): boolean {
    const maxDailyLoss = this.toPositiveNumber(strategyConfig.maxDailyLoss);
    const maxDailyProfit = this.toPositiveNumber(strategyConfig.maxDailyProfit);

    if (maxDailyLoss !== null && todayPnL <= -maxDailyLoss) {
      return true;
    }

    if (maxDailyProfit !== null && todayPnL >= maxDailyProfit) {
      return true;
    }

    return false;
  }

  private toPositiveNumber(value: unknown): number | null {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return null;
    }

    return numericValue;
  }
}
