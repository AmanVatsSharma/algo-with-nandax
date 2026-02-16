import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { JobOptions, Queue } from 'bull';
import { TradingService } from '../trading.service';
import { OrderSide, OrderType } from '../entities/trade.entity';
import { randomUUID } from 'crypto';
import { RiskService } from '@/modules/risk/risk.service';

@Injectable()
export class TradeExecutor {
  private readonly logger = new Logger(TradeExecutor.name);
  private readonly queueJobOptions: JobOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1500,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  };

  constructor(
    @InjectQueue('trading') private readonly tradingQueue: Queue,
    private readonly tradingService: TradingService,
    private readonly riskService: RiskService,
  ) {}

  async executeTrade(
    userId: string,
    agentId: string,
    connectionId: string,
    tradeData: {
      symbol: string;
      side: OrderSide;
      quantity: number;
      orderType: OrderType;
      price?: number;
      stopLoss?: number;
      takeProfit?: number;
    },
  ) {
    try {
      const normalizedPrice = Number(tradeData.price ?? 0);
      const notionalValue = Math.max(normalizedPrice, 0) * tradeData.quantity;
      const openTradesForAgent = (await this.tradingService.findOpenTrades(agentId)).length;

      const riskEvaluation = await this.riskService.evaluateTradeRisk(userId, {
        connectionId,
        agentId,
        symbol: tradeData.symbol,
        notionalValue,
        openTradesForAgent,
      });

      if (!riskEvaluation.allowed) {
        throw new BadRequestException(riskEvaluation.reason ?? 'Trade blocked by risk policy');
      }

      // Create trade record
      const trade = await this.tradingService.create({
        userId,
        agentId,
        connectionId,
        ...tradeData,
        entryPrice: tradeData.price || 0,
      });

      // Queue the order execution
      await this.tradingQueue.add(
        'place-order',
        {
          tradeId: trade.id,
          orderData: {
            tradingsymbol: tradeData.symbol,
            exchange: 'NSE', // Default to NSE, can be made configurable
            transaction_type: tradeData.side.toUpperCase(),
            quantity: tradeData.quantity,
            order_type: this.mapOrderType(tradeData.orderType),
            product: 'MIS', // Intraday
            validity: 'DAY',
            price: tradeData.price || 0,
          },
        },
        {
          ...this.queueJobOptions,
          jobId: `place-order:${trade.id}`,
        },
      );

      this.logger.log(`Trade queued for execution: ${trade.id}`);
      return trade;
    } catch (error) {
      this.logger.error('Error executing trade', error);
      throw error;
    }
  }

  async executePaperTrade(
    userId: string,
    agentId: string,
    connectionId: string,
    tradeData: {
      symbol: string;
      side: OrderSide;
      quantity: number;
      orderType: OrderType;
      price: number;
      stopLoss?: number;
      takeProfit?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    try {
      const trade = await this.tradingService.create({
        userId,
        agentId,
        connectionId,
        symbol: tradeData.symbol,
        side: tradeData.side,
        quantity: tradeData.quantity,
        orderType: tradeData.orderType,
        entryPrice: tradeData.price,
        stopLoss: tradeData.stopLoss,
        takeProfit: tradeData.takeProfit,
        metadata: {
          ...(tradeData.metadata ?? {}),
          paperTrade: true,
        },
      });

      const paperOrderId = `paper-${randomUUID()}`;
      await this.tradingService.updateEntryExecution(trade.id, tradeData.price, paperOrderId);

      this.logger.log(
        `Paper trade executed for agent ${agentId}: ${tradeData.side} ${tradeData.quantity} ${tradeData.symbol} @ ${tradeData.price}`,
      );

      return this.tradingService.findById(trade.id);
    } catch (error) {
      this.logger.error('Error executing paper trade', error);
      throw error;
    }
  }

  async closeTrade(
    userId: string,
    tradeId: string,
    connectionId: string,
    exitReason?: string,
  ) {
    try {
      const trade = await this.tradingService.findByIdAndUser(tradeId, userId);

      if (trade.connectionId !== connectionId) {
        throw new BadRequestException('Trade does not belong to provided broker connection');
      }

      // Queue the exit order
      await this.tradingQueue.add(
        'close-trade',
        {
          tradeId: trade.id,
          exitReason,
          orderData: {
            tradingsymbol: trade.symbol,
            exchange: 'NSE',
            transaction_type: trade.side === OrderSide.BUY ? 'SELL' : 'BUY',
            quantity: trade.quantity,
            order_type: 'MARKET',
            product: 'MIS',
            validity: 'DAY',
          },
        },
        {
          ...this.queueJobOptions,
          jobId: `close-trade:${trade.id}`,
        },
      );

      this.logger.log(`Trade close queued: ${trade.id}`);
      return trade;
    } catch (error) {
      this.logger.error('Error closing trade', error);
      throw error;
    }
  }

  private mapOrderType(orderType: OrderType): string {
    const typeMap = {
      [OrderType.MARKET]: 'MARKET',
      [OrderType.LIMIT]: 'LIMIT',
      [OrderType.STOP_LOSS]: 'SL',
      [OrderType.STOP_LOSS_MARKET]: 'SL-M',
    };
    return typeMap[orderType] || 'MARKET';
  }
}
