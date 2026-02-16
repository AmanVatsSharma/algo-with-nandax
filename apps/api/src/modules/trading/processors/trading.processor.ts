import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TradingService } from '../trading.service';
import { BrokerService } from '@/modules/broker/broker.service';
import { OrderStatus } from '../entities/trade.entity';
import { getErrorMessage } from '@/common/utils/error.utils';

@Processor('trading')
export class TradingProcessor {
  private readonly logger = new Logger(TradingProcessor.name);

  constructor(
    private readonly tradingService: TradingService,
    private readonly brokerService: BrokerService,
  ) {}

  @Process('place-order')
  async handlePlaceOrder(job: Job) {
    const { tradeId, connectionId, orderData } = job.data;
    this.logger.log(`Processing place order for trade: ${tradeId}`);

    try {
      // Place order via broker
      const orderResult = await this.brokerService.placeKiteOrder(connectionId, orderData);

      // Update trade with order details
      await this.tradingService.updateEntryExecution(
        tradeId,
        orderData.price || 0,
        orderResult.order_id,
      );

      this.logger.log(`Order placed successfully: ${orderResult.order_id}`);
      return { success: true, orderId: orderResult.order_id };
    } catch (error) {
      this.logger.error(`Error placing order for trade ${tradeId}`, error);
      
      // Update trade status to failed
      await this.tradingService.updateOrderStatus(
        tradeId,
        OrderStatus.FAILED,
        getErrorMessage(error, 'Failed to place order'),
      );

      throw error;
    }
  }

  @Process('close-trade')
  async handleCloseTrade(job: Job) {
    const { tradeId, connectionId, orderData, exitReason } = job.data;
    this.logger.log(`Processing close trade: ${tradeId}`);

    try {
      // Place exit order via broker
      const orderResult = await this.brokerService.placeKiteOrder(connectionId, orderData);

      // Update trade with exit details
      await this.tradingService.updateExitExecution(
        tradeId,
        orderData.price || 0,
        orderResult.order_id,
        exitReason,
      );

      this.logger.log(`Trade closed successfully: ${tradeId}`);
      return { success: true, orderId: orderResult.order_id };
    } catch (error) {
      this.logger.error(`Error closing trade ${tradeId}`, error);
      
      await this.tradingService.updateOrderStatus(
        tradeId,
        OrderStatus.FAILED,
        getErrorMessage(error, 'Failed to close trade'),
      );

      throw error;
    }
  }
}
