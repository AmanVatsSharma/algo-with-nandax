import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TradingService } from '../trading.service';
import { BrokerService } from '@/modules/broker/broker.service';
import { OrderStatus } from '../entities/trade.entity';
import { getErrorMessage } from '@/common/utils/error.utils';
import { KiteOrderHistoryEntry } from '@/modules/broker/services/kite.service';

@Processor('trading')
export class TradingProcessor {
  private readonly logger = new Logger(TradingProcessor.name);

  constructor(
    private readonly tradingService: TradingService,
    private readonly brokerService: BrokerService,
  ) {}

  @Process('place-order')
  async handlePlaceOrder(job: Job) {
    const { tradeId, orderData } = job.data;
    this.logger.log(`Processing place order for trade: ${tradeId}`);

    try {
      const trade = await this.tradingService.findById(tradeId);

      // Place order via broker
      const orderResult = await this.brokerService.placeKiteOrder(
        trade.userId,
        trade.connectionId,
        orderData,
      );

      const latestOrderState = await this.tryFetchLatestOrderState(
        trade.userId,
        trade.connectionId,
        orderResult.order_id,
      );

      if (!latestOrderState) {
        await this.tradingService.markEntryOrderPlaced(tradeId, orderResult.order_id);
        this.logger.warn(
          `Order ${orderResult.order_id} has no immediate history state. Marked as placed for trade ${tradeId}`,
        );
        return { success: true, orderId: orderResult.order_id, reconciled: false };
      }

      const mappedOrderStatus = this.mapKiteOrderStatus(latestOrderState.status);

      if (mappedOrderStatus === OrderStatus.EXECUTED) {
        const executedPrice =
          Number(latestOrderState.average_price) > 0
            ? Number(latestOrderState.average_price)
            : Number(orderData.price || 0);

        await this.tradingService.updateEntryExecution(
          tradeId,
          executedPrice,
          orderResult.order_id,
        );

        this.logger.log(
          `Entry order ${orderResult.order_id} executed at ${executedPrice} for trade ${tradeId}`,
        );
        return { success: true, orderId: orderResult.order_id, reconciled: true };
      }

      if (mappedOrderStatus === OrderStatus.REJECTED || mappedOrderStatus === OrderStatus.CANCELLED) {
        await this.tradingService.updateOrderStatus(
          tradeId,
          mappedOrderStatus,
          latestOrderState.status_message ?? 'Order rejected or cancelled at broker',
        );

        this.logger.warn(
          `Entry order ${orderResult.order_id} for trade ${tradeId} ended with status=${mappedOrderStatus}`,
        );
        return { success: false, orderId: orderResult.order_id, status: mappedOrderStatus };
      }

      await this.tradingService.markEntryOrderPlaced(tradeId, orderResult.order_id);
      this.logger.log(
        `Entry order ${orderResult.order_id} for trade ${tradeId} is currently ${mappedOrderStatus}. Marked as placed.`,
      );

      this.logger.log(`Order placed successfully: ${orderResult.order_id}`);
      return { success: true, orderId: orderResult.order_id, status: mappedOrderStatus };
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
    const { tradeId, orderData, exitReason } = job.data;
    this.logger.log(`Processing close trade: ${tradeId}`);

    try {
      const trade = await this.tradingService.findById(tradeId);

      // Place exit order via broker
      const orderResult = await this.brokerService.placeKiteOrder(
        trade.userId,
        trade.connectionId,
        orderData,
      );

      const latestOrderState = await this.tryFetchLatestOrderState(
        trade.userId,
        trade.connectionId,
        orderResult.order_id,
      );

      if (!latestOrderState) {
        await this.tradingService.markExitOrderPlaced(tradeId, orderResult.order_id, exitReason);
        this.logger.warn(
          `Exit order ${orderResult.order_id} has no immediate history state. Marked as placed for trade ${tradeId}`,
        );
        return { success: true, orderId: orderResult.order_id, reconciled: false };
      }

      const mappedOrderStatus = this.mapKiteOrderStatus(latestOrderState.status);

      if (mappedOrderStatus === OrderStatus.EXECUTED) {
        const executedPrice =
          Number(latestOrderState.average_price) > 0
            ? Number(latestOrderState.average_price)
            : Number(orderData.price || 0);

        await this.tradingService.updateExitExecution(
          tradeId,
          executedPrice,
          orderResult.order_id,
          exitReason,
        );

        this.logger.log(
          `Exit order ${orderResult.order_id} executed at ${executedPrice} for trade ${tradeId}`,
        );
        return { success: true, orderId: orderResult.order_id, reconciled: true };
      }

      if (mappedOrderStatus === OrderStatus.REJECTED || mappedOrderStatus === OrderStatus.CANCELLED) {
        await this.tradingService.updateOrderStatus(
          tradeId,
          mappedOrderStatus,
          latestOrderState.status_message ?? 'Exit order rejected or cancelled at broker',
        );

        this.logger.warn(
          `Exit order ${orderResult.order_id} for trade ${tradeId} ended with status=${mappedOrderStatus}`,
        );
        return { success: false, orderId: orderResult.order_id, status: mappedOrderStatus };
      }

      await this.tradingService.markExitOrderPlaced(tradeId, orderResult.order_id, exitReason);

      this.logger.log(`Trade closed successfully: ${tradeId}`);
      return { success: true, orderId: orderResult.order_id, status: mappedOrderStatus };
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

  private mapKiteOrderStatus(kiteStatus: string): OrderStatus {
    const normalized = kiteStatus?.toUpperCase?.() ?? '';
    if (normalized === 'COMPLETE') {
      return OrderStatus.EXECUTED;
    }
    if (normalized === 'REJECTED') {
      return OrderStatus.REJECTED;
    }
    if (normalized === 'CANCELLED') {
      return OrderStatus.CANCELLED;
    }
    if (normalized === 'OPEN' || normalized === 'TRIGGER PENDING') {
      return OrderStatus.PLACED;
    }
    return OrderStatus.PENDING;
  }

  private async tryFetchLatestOrderState(
    userId: string,
    connectionId: string,
    orderId: string,
  ): Promise<KiteOrderHistoryEntry | null> {
    try {
      return await this.brokerService.getKiteLatestOrderState(userId, connectionId, orderId);
    } catch (error) {
      this.logger.warn(
        `Order reconciliation failed for orderId=${orderId}: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }
}
