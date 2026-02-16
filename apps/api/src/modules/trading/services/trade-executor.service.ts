import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { TradingService } from '../trading.service';
import { BrokerService } from '@/modules/broker/broker.service';
import { OrderSide, OrderType, OrderStatus } from '../entities/trade.entity';

@Injectable()
export class TradeExecutor {
  private readonly logger = new Logger(TradeExecutor.name);

  constructor(
    @InjectQueue('trading') private readonly tradingQueue: Queue,
    private readonly tradingService: TradingService,
    private readonly brokerService: BrokerService,
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
      // Create trade record
      const trade = await this.tradingService.create({
        userId,
        agentId,
        ...tradeData,
        entryPrice: tradeData.price || 0,
      });

      // Queue the order execution
      await this.tradingQueue.add('place-order', {
        tradeId: trade.id,
        connectionId,
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
      });

      this.logger.log(`Trade queued for execution: ${trade.id}`);
      return trade;
    } catch (error) {
      this.logger.error('Error executing trade', error);
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

      // Queue the exit order
      await this.tradingQueue.add('close-trade', {
        tradeId: trade.id,
        connectionId,
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
      });

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
