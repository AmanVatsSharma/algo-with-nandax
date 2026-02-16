import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, FindOptionsWhere } from 'typeorm';
import { Trade, TradeStatus, OrderStatus, OrderSide } from './entities/trade.entity';
import { BrokerService } from '../broker/broker.service';
import { getErrorMessage } from '@/common/utils/error.utils';
import {
  KiteOrderEntry,
  KiteOrderHistoryEntry,
  KiteTradeEntry,
} from '../broker/services/kite.service';

const PENDING_RECONCILIATION_STATUSES: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.PARTIALLY_FILLED,
];

interface ReconciliationResult {
  processed: number;
  executed: number;
  partiallyFilled: number;
  rejected: number;
  cancelled: number;
  open: number;
  failed: number;
  details: Array<Record<string, unknown>>;
}

type KiteOrderStateLike = Pick<
  KiteOrderEntry,
  'status' | 'filled_quantity' | 'pending_quantity' | 'average_price' | 'status_message'
> &
  Partial<Pick<KiteOrderHistoryEntry, 'order_timestamp' | 'exchange_timestamp'>>;

interface AggregatedTradebookFill {
  filledQuantity: number;
  pendingQuantity: number;
  averagePrice?: number;
}

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

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
    const trade = await this.findById(tradeId);
    const metadata = this.mergeCompletionFillMetadata({
      trade,
      fillSide: 'entry',
      orderId,
      averagePrice: executedPrice,
    });

    await this.tradeRepository.update(tradeId, {
      entryOrderId: orderId,
      executedEntryPrice: executedPrice,
      entryTime: new Date(),
      orderStatus: OrderStatus.EXECUTED,
      metadata: metadata as unknown as Record<string, any>,
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

  async markEntryOrderPartiallyFilled(
    tradeId: string,
    payload: {
      orderId: string;
      averagePrice?: number;
      filledQuantity: number;
      pendingQuantity: number;
      statusMessage?: string;
    },
  ): Promise<Trade> {
    const trade = await this.findById(tradeId);
    const mergedMetadata = this.mergePartialFillMetadata({
      trade,
      fillSide: 'entry',
      payload,
    });

    await this.tradeRepository.update(tradeId, {
      entryOrderId: payload.orderId,
      orderStatus: OrderStatus.PARTIALLY_FILLED,
      executedEntryPrice:
        payload.averagePrice && payload.averagePrice > 0
          ? payload.averagePrice
          : trade.executedEntryPrice,
      orderError: payload.statusMessage,
      metadata: mergedMetadata as unknown as Record<string, any>,
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
    const mergedMetadata = this.mergeCompletionFillMetadata({
      trade,
      fillSide: 'exit',
      orderId,
      averagePrice: executedPrice,
    });

    await this.tradeRepository.update(tradeId, {
      exitOrderId: orderId,
      executedExitPrice: executedPrice,
      exitTime: new Date(),
      realizedPnL: pnl,
      netPnL,
      status: TradeStatus.CLOSED,
      orderStatus: OrderStatus.EXECUTED,
      exitReason,
      metadata: mergedMetadata as unknown as Record<string, any>,
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

  async markExitOrderPartiallyFilled(
    tradeId: string,
    payload: {
      orderId: string;
      averagePrice?: number;
      filledQuantity: number;
      pendingQuantity: number;
      statusMessage?: string;
      exitReason?: string;
    },
  ): Promise<Trade> {
    const trade = await this.findById(tradeId);
    const mergedMetadata = this.mergePartialFillMetadata({
      trade,
      fillSide: 'exit',
      payload,
    });

    await this.tradeRepository.update(tradeId, {
      exitOrderId: payload.orderId,
      orderStatus: OrderStatus.PARTIALLY_FILLED,
      executedExitPrice:
        payload.averagePrice && payload.averagePrice > 0
          ? payload.averagePrice
          : trade.executedExitPrice,
      orderError: payload.statusMessage,
      exitReason: payload.exitReason ?? trade.exitReason,
      metadata: mergedMetadata as unknown as Record<string, any>,
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

    const result = this.createReconciliationResult();
    this.logger.debug(
      `manual-reconcile-start: user=${userId} trades=${trades.length} scope=${payload.connectionId ?? 'all'}`,
    );

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
        const orderTrades = await this.getOrderTradesSafe(userId, trade.connectionId, orderId);
        if (!latestState) {
          result.open += 1;
          result.details.push({
            tradeId: trade.id,
            status: 'open',
            orderId,
            brokerStatus: 'missing',
          });
          result.processed += 1;
          continue;
        }

        await this.applyOrderStateToTrade({
          trade,
          orderId,
          isExitOrderPending,
          latestState,
          orderTrades,
          result,
        });
      } catch (error) {
        result.failed += 1;
        result.details.push({
          tradeId: trade.id,
          status: 'failed',
          reason: getErrorMessage(error),
        });
      }
    }

    this.logger.debug(
      `manual-reconcile-complete: user=${userId} processed=${result.processed} executed=${result.executed} partial=${result.partiallyFilled} failed=${result.failed}`,
    );
    return result;
  }

  async reconcileTradesFromOrdersSnapshot(
    userId: string,
    payload: {
      connectionId: string;
      maxItems?: number;
    },
  ) {
    const maxItems = Math.min(Math.max(payload.maxItems ?? 200, 1), 500);
    const trades = await this.tradeRepository.find({
      where: {
        userId,
        connectionId: payload.connectionId,
        orderStatus: In(PENDING_RECONCILIATION_STATUSES),
      },
      order: { updatedAt: 'ASC' },
      take: maxItems,
    });

    const result = this.createReconciliationResult();
    if (!trades.length) {
      return result;
    }

    const orders = await this.brokerService.getKiteOrders(userId, payload.connectionId);
    const tradesSnapshot = await this.getConnectionTradesSafe(userId, payload.connectionId);
    const latestStateByOrderId = this.buildLatestStateByOrderId(orders);
    const tradesByOrderId = this.groupTradesByOrderId(tradesSnapshot);

    this.logger.debug(
      `snapshot-reconcile-start: user=${userId} connection=${payload.connectionId} orders=${orders.length} tradebookRows=${tradesSnapshot.length} pending=${trades.length}`,
    );

    for (const trade of trades) {
      const isExitOrderPending = trade.status === TradeStatus.OPEN && Boolean(trade.exitOrderId);
      const orderId = isExitOrderPending ? trade.exitOrderId : trade.entryOrderId;

      if (!orderId) {
        result.failed += 1;
        result.details.push({
          tradeId: trade.id,
          status: 'failed',
          reason: 'Missing orderId for snapshot reconciliation',
        });
        continue;
      }

      const latestState = latestStateByOrderId.get(orderId);
      if (!latestState) {
        result.open += 1;
        result.details.push({
          tradeId: trade.id,
          status: 'open',
          orderId,
          brokerStatus: 'not-found-in-orders-snapshot',
        });
        result.processed += 1;
        continue;
      }

      try {
        await this.applyOrderStateToTrade({
          trade,
          orderId,
          isExitOrderPending,
          latestState,
          orderTrades: tradesByOrderId.get(orderId) ?? [],
          result,
        });
      } catch (error) {
        result.failed += 1;
        result.details.push({
          tradeId: trade.id,
          status: 'failed',
          orderId,
          reason: getErrorMessage(error),
        });
      }
    }

    this.logger.debug(
      `snapshot-reconcile-complete: user=${userId} connection=${payload.connectionId} processed=${result.processed} executed=${result.executed} partial=${result.partiallyFilled} failed=${result.failed}`,
    );
    return result;
  }

  private createReconciliationResult(): ReconciliationResult {
    return {
      processed: 0,
      executed: 0,
      partiallyFilled: 0,
      rejected: 0,
      cancelled: 0,
      open: 0,
      failed: 0,
      details: [],
    };
  }

  private async getConnectionTradesSafe(userId: string, connectionId: string) {
    try {
      return await this.brokerService.getKiteTrades(userId, connectionId);
    } catch (error) {
      this.logger.warn(
        `tradebook-snapshot-fetch-failed: user=${userId} connection=${connectionId} reason=${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  private async getOrderTradesSafe(userId: string, connectionId: string, orderId: string) {
    try {
      return await this.brokerService.getKiteOrderTrades(userId, connectionId, orderId);
    } catch (error) {
      this.logger.warn(
        `order-tradebook-fetch-failed: user=${userId} connection=${connectionId} orderId=${orderId} reason=${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  private groupTradesByOrderId(trades: KiteTradeEntry[]) {
    const grouped = new Map<string, KiteTradeEntry[]>();
    for (const trade of trades ?? []) {
      const orderId = String(trade.order_id ?? '').trim();
      if (!orderId) {
        continue;
      }
      const existing = grouped.get(orderId) ?? [];
      existing.push(trade);
      grouped.set(orderId, existing);
    }
    return grouped;
  }

  private buildLatestStateByOrderId(orders: KiteOrderEntry[]) {
    const map = new Map<string, KiteOrderStateLike>();
    for (const order of orders ?? []) {
      const orderId = String(order.order_id ?? '').trim();
      if (!orderId) {
        continue;
      }
      const existing = map.get(orderId);
      const candidateTimestamp = String(order.exchange_timestamp ?? order.order_timestamp ?? '');
      const existingTimestamp = String(
        (existing as KiteOrderEntry | undefined)?.exchange_timestamp ??
          (existing as KiteOrderEntry | undefined)?.order_timestamp ??
          '',
      );
      if (!existing || candidateTimestamp >= existingTimestamp) {
        map.set(orderId, order);
      }
    }
    return map;
  }

  private aggregateTradebookFill(input: {
    orderTrades: KiteTradeEntry[];
    fallbackFilledQuantity: number;
    fallbackPendingQuantity: number;
    fallbackAveragePrice: number;
  }): AggregatedTradebookFill {
    const validTrades = (input.orderTrades ?? []).filter((trade) => {
      const quantity = Number(trade.quantity ?? 0);
      return Number.isFinite(quantity) && quantity > 0;
    });

    if (!validTrades.length) {
      return {
        filledQuantity: input.fallbackFilledQuantity,
        pendingQuantity: input.fallbackPendingQuantity,
        averagePrice: input.fallbackAveragePrice,
      };
    }

    const filledQuantity = validTrades.reduce(
      (sum, trade) => sum + Number(trade.quantity ?? 0),
      0,
    );

    const weightedPriceAndQuantity = validTrades.reduce(
      (accumulator, trade) => {
        const quantity = Number(trade.quantity ?? 0);
        const tradePrice = Number(trade.price ?? trade.average_price ?? 0);
        if (quantity > 0 && Number.isFinite(tradePrice) && tradePrice > 0) {
          accumulator.priceQuantity += tradePrice * quantity;
          accumulator.quantity += quantity;
        }
        return accumulator;
      },
      { priceQuantity: 0, quantity: 0 },
    );

    const averagePrice =
      weightedPriceAndQuantity.quantity > 0
        ? weightedPriceAndQuantity.priceQuantity / weightedPriceAndQuantity.quantity
        : input.fallbackAveragePrice;
    const fallbackTotalQuantity =
      Number(input.fallbackFilledQuantity ?? 0) + Number(input.fallbackPendingQuantity ?? 0);
    const pendingQuantity =
      fallbackTotalQuantity > 0
        ? Math.max(fallbackTotalQuantity - filledQuantity, 0)
        : Math.max(Number(input.fallbackPendingQuantity ?? 0), 0);

    return {
      filledQuantity,
      pendingQuantity,
      averagePrice,
    };
  }

  private async applyOrderStateToTrade(input: {
    trade: Trade;
    orderId: string;
    isExitOrderPending: boolean;
    latestState: KiteOrderStateLike;
    orderTrades: KiteTradeEntry[];
    result: ReconciliationResult;
  }) {
    const status = String(input.latestState?.status ?? '').toLowerCase();
    const tradebookFill = this.aggregateTradebookFill({
      orderTrades: input.orderTrades,
      fallbackFilledQuantity: Number(input.latestState?.filled_quantity ?? 0),
      fallbackPendingQuantity: Number(input.latestState?.pending_quantity ?? 0),
      fallbackAveragePrice: Number(input.latestState?.average_price ?? 0),
    });
    const filledQuantity = Number(tradebookFill.filledQuantity ?? 0);
    const pendingQuantity = Number(tradebookFill.pendingQuantity ?? 0);
    const averagePrice = Number(tradebookFill.averagePrice ?? 0);
    const resolvedPrice =
      Number.isFinite(averagePrice) && averagePrice > 0
        ? averagePrice
        : Number(
            input.isExitOrderPending
              ? input.trade.executedExitPrice ?? input.trade.exitPrice ?? input.trade.entryPrice
              : input.trade.executedEntryPrice ?? input.trade.entryPrice,
          );
    const statusMessage = input.latestState?.status_message ?? undefined;

    if (
      (status === 'open' || status === 'trigger pending') &&
      filledQuantity > 0 &&
      pendingQuantity > 0
    ) {
      if (input.isExitOrderPending) {
        await this.markExitOrderPartiallyFilled(input.trade.id, {
          orderId: input.orderId,
          averagePrice: resolvedPrice,
          filledQuantity,
          pendingQuantity,
          statusMessage,
          exitReason: input.trade.exitReason,
        });
      } else {
        await this.markEntryOrderPartiallyFilled(input.trade.id, {
          orderId: input.orderId,
          averagePrice: resolvedPrice,
          filledQuantity,
          pendingQuantity,
          statusMessage,
        });
      }
      input.result.partiallyFilled += 1;
      input.result.details.push({
        tradeId: input.trade.id,
        status: 'partially_filled',
        orderId: input.orderId,
        filledQuantity,
        pendingQuantity,
      });
      input.result.processed += 1;
      return;
    }

    if (status === 'complete') {
      if (input.isExitOrderPending) {
        await this.updateExitExecution(
          input.trade.id,
          resolvedPrice,
          input.orderId,
          input.trade.exitReason,
        );
      } else {
        await this.updateEntryExecution(input.trade.id, resolvedPrice, input.orderId);
      }
      input.result.executed += 1;
      input.result.details.push({
        tradeId: input.trade.id,
        status: 'executed',
        orderId: input.orderId,
      });
      input.result.processed += 1;
      return;
    }

    if (status === 'rejected') {
      await this.updateOrderStatus(input.trade.id, OrderStatus.REJECTED, statusMessage);
      input.result.rejected += 1;
      input.result.details.push({
        tradeId: input.trade.id,
        status: 'rejected',
        orderId: input.orderId,
        statusMessage,
      });
      input.result.processed += 1;
      return;
    }

    if (status === 'cancelled' || status === 'canceled') {
      if (input.isExitOrderPending) {
        await this.updateOrderStatus(input.trade.id, OrderStatus.CANCELLED, statusMessage);
      } else {
        await this.cancelTrade(input.trade.id);
      }
      input.result.cancelled += 1;
      input.result.details.push({
        tradeId: input.trade.id,
        status: 'cancelled',
        orderId: input.orderId,
        statusMessage,
      });
      input.result.processed += 1;
      return;
    }

    input.result.open += 1;
    input.result.details.push({
      tradeId: input.trade.id,
      status: 'open',
      orderId: input.orderId,
      brokerStatus: status || 'unknown',
    });
    input.result.processed += 1;
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

  private mergePartialFillMetadata(input: {
    trade: Trade;
    fillSide: 'entry' | 'exit';
    payload: {
      orderId: string;
      averagePrice?: number;
      filledQuantity: number;
      pendingQuantity: number;
      statusMessage?: string;
    };
  }) {
    const baseMetadata = (input.trade.metadata ?? {}) as Record<string, any>;
    const fillStateKey = input.fillSide === 'entry' ? 'entryFillState' : 'exitFillState';
    const fillRollupKey = input.fillSide === 'entry' ? 'entryFillRollup' : 'exitFillRollup';
    const syncedAt = new Date().toISOString();

    const previousState = baseMetadata[fillStateKey] as
      | {
          filledQuantity?: number;
          pendingQuantity?: number;
        }
      | undefined;
    const previousFilledQuantity = Number(previousState?.filledQuantity ?? 0);
    const currentFilledQuantity = Number(input.payload.filledQuantity ?? 0);
    const currentPendingQuantity = Number(input.payload.pendingQuantity ?? 0);
    const deltaFilledQuantity = Math.max(currentFilledQuantity - previousFilledQuantity, 0);

    const fillEvent = {
      orderId: input.payload.orderId,
      filledQuantity: currentFilledQuantity,
      pendingQuantity: currentPendingQuantity,
      deltaFilledQuantity,
      averagePrice: input.payload.averagePrice ?? null,
      statusMessage: input.payload.statusMessage ?? null,
      syncedAt,
    };

    const existingRollup = Array.isArray(baseMetadata[fillRollupKey])
      ? (baseMetadata[fillRollupKey] as Array<Record<string, unknown>>)
      : [];
    const shouldAppendRollup =
      existingRollup.length === 0 ||
      deltaFilledQuantity > 0 ||
      Number(previousState?.pendingQuantity ?? -1) !== currentPendingQuantity;
    const updatedRollup = shouldAppendRollup
      ? [...existingRollup, fillEvent].slice(-50)
      : existingRollup;

    return {
      ...baseMetadata,
      [fillStateKey]: {
        orderId: input.payload.orderId,
        filledQuantity: currentFilledQuantity,
        pendingQuantity: currentPendingQuantity,
        averagePrice: input.payload.averagePrice ?? null,
        statusMessage: input.payload.statusMessage ?? null,
        syncedAt,
      },
      [fillRollupKey]: updatedRollup,
    };
  }

  private mergeCompletionFillMetadata(input: {
    trade: Trade;
    fillSide: 'entry' | 'exit';
    orderId: string;
    averagePrice?: number;
  }) {
    const completedState = this.mergePartialFillMetadata({
      trade: input.trade,
      fillSide: input.fillSide,
      payload: {
        orderId: input.orderId,
        averagePrice: input.averagePrice,
        filledQuantity: Number(input.trade.quantity ?? 0),
        pendingQuantity: 0,
        statusMessage: 'COMPLETE',
      },
    });

    return completedState;
  }
}
