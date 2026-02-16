import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Trade, TradeStatus, OrderStatus, OrderSide } from './entities/trade.entity';

@Injectable()
export class TradingService {
  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
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
