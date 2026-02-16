import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, FindOptionsWhere } from 'typeorm';
import { Trade, TradeStatus, OrderStatus, OrderSide } from './entities/trade.entity';
import { BrokerService } from '../broker/broker.service';
import { getErrorMessage } from '@/common/utils/error.utils';

const PENDING_RECONCILIATION_STATUSES: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.PARTIALLY_FILLED,
];

@Injectable()
export class TradingService {
  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    private readonly brokerService: BrokerService,
  ) {}

  async create(tradeData: Partial<Trade>): Promise<Trade> {
    const trade = this.tradeRepository.create(tradeData);
    return this.tradeRepository.save(trade);
  }

  async findById(id: string): Promise<Trade> {
    const trade = await this.tradeRepository.findOne({ where: { id } });
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }
    return trade;
  }

  async findByIdAndUser(id: string, userId: string): Promise<Trade> {
    const trade = await this.tradeRepository.findOne({
      where: { id, userId },
    });
    if (!trade) {
      throw new NotFoundException('Trade not found');
    }
    return trade;
  }

  async findByUser(userId: string): Promise<Trade[]> {
    return this.tradeRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByAgent(agentId: string): Promise<Trade[]> {
    return this.tradeRepository.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByAgentAndUser(agentId: string, userId: string): Promise<Trade[]> {
    return this.tradeRepository.find({
      where: { agentId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOpenTrades(agentId: string): Promise<Trade[]> {
    return this.tradeRepository.find({
      where: {
        agentId,
        status: TradeStatus.OPEN,
      },
    });
  }

  async findTodayTrades(userId: string): Promise<Trade[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.tradeRepository.find({
      where: {
        userId,
        createdAt: Between(startOfDay, endOfDay),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async updateOrderStatus(
    tradeId: string,
    orderStatus: OrderStatus,
    orderError?: string,
  ): Promise<Trade> {
    await this.tradeRepository.update(tradeId, {
      orderStatus,
      orderError,
    });
    return this.findById(tradeId);
  }

  async updateEntryExecution(
    tradeId: string,
    executedPrice: number,
    orderId: string,
  ): Promise<Trade> {
    await this.tradeRepository.update(tradeId, {
      entryOrderId: orderId,
      executedEntryPrice: executedPrice,
      entryTime: new Date(),
      orderStatus: OrderStatus.EXECUTED,
    });
    return this.findById(tradeId);
  }

  async markEntryOrderPlaced(tradeId: string, orderId: string): Promise<Trade> {
    await this.tradeRepository.update(tradeId, {
      entryOrderId: orderId,
      orderStatus: OrderStatus.PLACED,
    });
    return this.findById(tradeId);
  }

  async updateExitExecution(
    tradeId: string,
    executedPrice: number,
    orderId: string,
    exitReason?: string,
  ): Promise<Trade> {
    const trade = await this.findById(tradeId);
    
    // Calculate P&L
    const quantity = trade.quantity;
    const entryPrice = trade.executedEntryPrice || trade.entryPrice;
    const pnl = this.calculatePnL(trade.side, entryPrice, executedPrice, quantity);
    const netPnL = pnl - Number(trade.fees);

    await this.tradeRepository.update(tradeId, {
      exitOrderId: orderId,
      executedExitPrice: executedPrice,
      exitTime: new Date(),
      realizedPnL: pnl,
      netPnL,
      status: TradeStatus.CLOSED,
      orderStatus: OrderStatus.EXECUTED,
      exitReason,
    });

    return this.findById(tradeId);
  }

  async markExitOrderPlaced(tradeId: string, orderId: string, exitReason?: string): Promise<Trade> {
    await this.tradeRepository.update(tradeId, {
      exitOrderId: orderId,
      orderStatus: OrderStatus.PLACED,
      exitReason,
    });
    return this.findById(tradeId);
  }

  async updateUnrealizedPnL(tradeId: string, currentPrice: number): Promise<void> {
    const trade = await this.findById(tradeId);
    
    if (trade.status !== TradeStatus.OPEN) {
      return;
    }

    const entryPrice = trade.executedEntryPrice || trade.entryPrice;
    const unrealizedPnL = this.calculatePnL(
      trade.side,
      entryPrice,
      currentPrice,
      trade.quantity,
    );

    await this.tradeRepository.update(tradeId, { unrealizedPnL });
  }

  async cancelTrade(tradeId: string): Promise<Trade> {
    await this.tradeRepository.update(tradeId, {
      status: TradeStatus.CANCELLED,
      orderStatus: OrderStatus.CANCELLED,
    });
    return this.findById(tradeId);
  }

  async getTradeStats(userId: string) {
    const trades = await this.findByUser(userId);
    const closedTrades = trades.filter((t) => t.status === TradeStatus.CLOSED);

    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter((t) => t.netPnL > 0).length;
    const losingTrades = closedTrades.filter((t) => t.netPnL < 0).length;
    const totalPnL = closedTrades.reduce((sum, t) => sum + Number(t.netPnL), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnL,
      winRate,
    };
  }

  async findPendingTradesForReconciliation(
    maxItems: number = 100,
  ): Promise<Array<Pick<Trade, 'id' | 'userId' | 'connectionId'>>> {
    const safeMaxItems = Math.min(Math.max(maxItems, 1), 500);
    const trades = await this.tradeRepository.find({
      select: {
        id: true,
        userId: true,
        connectionId: true,
      },
      where: {
        orderStatus: In(PENDING_RECONCILIATION_STATUSES),
      },
      order: { updatedAt: 'ASC' },
      take: safeMaxItems,
    });

    return trades.map((trade) => ({
      id: trade.id,
      userId: trade.userId,
      connectionId: trade.connectionId,
    }));
  }

  async reconcileTrades(
    userId: string,
    payload: {
      tradeId?: string;
      connectionId?: string;
      maxItems?: number;
    },
  ) {
    const maxItems = Math.min(Math.max(payload.maxItems ?? 50, 1), 200);
    const baseWhere: FindOptionsWhere<Trade> = {
      userId,
      orderStatus: In(PENDING_RECONCILIATION_STATUSES),
      ...(payload.connectionId ? { connectionId: payload.connectionId } : {}),
    };
    const trades = payload.tradeId
      ? [await this.findByIdAndUser(payload.tradeId, userId)]
      : await this.tradeRepository.find({
          where: baseWhere,
          order: { createdAt: 'DESC' },
          take: maxItems,
        });

    const result = {
      processed: 0,
      executed: 0,
      rejected: 0,
      cancelled: 0,
      open: 0,
      failed: 0,
      details: [] as Array<Record<string, unknown>>,
    };

    for (const trade of trades) {
      const isExitOrderPending = trade.status === TradeStatus.OPEN && Boolean(trade.exitOrderId);
      const orderId = isExitOrderPending ? trade.exitOrderId : trade.entryOrderId;

      if (!orderId || !trade.connectionId) {
        result.failed += 1;
        result.details.push({
          tradeId: trade.id,
          status: 'failed',
          reason: 'Missing orderId or connectionId for reconciliation',
        });
        continue;
      }

      try {
        const latestState = await this.brokerService.getKiteLatestOrderState(
          userId,
          trade.connectionId,
          orderId,
        );
        const status = String(latestState?.status ?? '').toLowerCase();
        const averagePrice = Number(latestState?.average_price ?? 0);
        const resolvedPrice = Number.isFinite(averagePrice) && averagePrice > 0
          ? averagePrice
          : Number(isExitOrderPending ? trade.executedExitPrice ?? trade.exitPrice ?? trade.entryPrice : trade.executedEntryPrice ?? trade.entryPrice);
        const statusMessage = latestState?.status_message ?? undefined;

        if (status === 'complete') {
          if (isExitOrderPending) {
            await this.updateExitExecution(trade.id, resolvedPrice, orderId, trade.exitReason);
          } else {
            await this.updateEntryExecution(trade.id, resolvedPrice, orderId);
          }
          result.executed += 1;
          result.details.push({ tradeId: trade.id, status: 'executed', orderId });
        } else if (status === 'rejected') {
          await this.updateOrderStatus(trade.id, OrderStatus.REJECTED, statusMessage);
          result.rejected += 1;
          result.details.push({ tradeId: trade.id, status: 'rejected', orderId, statusMessage });
        } else if (status === 'cancelled' || status === 'canceled') {
          if (isExitOrderPending) {
            await this.updateOrderStatus(trade.id, OrderStatus.CANCELLED, statusMessage);
          } else {
            await this.cancelTrade(trade.id);
          }
          result.cancelled += 1;
          result.details.push({ tradeId: trade.id, status: 'cancelled', orderId, statusMessage });
        } else {
          result.open += 1;
          result.details.push({ tradeId: trade.id, status: 'open', orderId, brokerStatus: status || 'unknown' });
        }

        result.processed += 1;
      } catch (error) {
        result.failed += 1;
        result.details.push({
          tradeId: trade.id,
          status: 'failed',
          reason: getErrorMessage(error),
        });
      }
    }

    return result;
  }

  private calculatePnL(
    side: OrderSide,
    entryPrice: number,
    exitPrice: number,
    quantity: number,
  ): number {
    // BUY profit when price increases, SELL (short) profit when price decreases.
    if (side === OrderSide.SELL) {
      return (entryPrice - exitPrice) * quantity;
    }

    return (exitPrice - entryPrice) * quantity;
  }
}
