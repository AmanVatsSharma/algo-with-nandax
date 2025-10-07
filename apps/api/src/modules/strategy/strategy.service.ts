import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, StrategyStatus } from './entities/strategy.entity';

@Injectable()
export class StrategyService {
  constructor(
    @InjectRepository(Strategy)
    private readonly strategyRepository: Repository<Strategy>,
  ) {}

  async create(userId: string, strategyData: Partial<Strategy>): Promise<Strategy> {
    const strategy = this.strategyRepository.create({
      ...strategyData,
      userId,
    });
    return this.strategyRepository.save(strategy);
  }

  async findAll(userId: string): Promise<Strategy[]> {
    return this.strategyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Strategy> {
    const strategy = await this.strategyRepository.findOne({ where: { id } });
    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }
    return strategy;
  }

  async findByIdAndUser(id: string, userId: string): Promise<Strategy> {
    const strategy = await this.strategyRepository.findOne({
      where: { id, userId },
    });
    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }
    return strategy;
  }

  async update(id: string, userId: string, updateData: Partial<Strategy>): Promise<Strategy> {
    const strategy = await this.findByIdAndUser(id, userId);
    
    // Prevent updating if strategy is active
    if (strategy.status === StrategyStatus.ACTIVE && updateData.status !== StrategyStatus.PAUSED) {
      throw new ForbiddenException('Cannot update active strategy. Please pause it first.');
    }

    await this.strategyRepository.update(id, updateData);
    return this.findById(id);
  }

  async updateStatus(id: string, userId: string, status: StrategyStatus): Promise<Strategy> {
    await this.findByIdAndUser(id, userId);
    await this.strategyRepository.update(id, { status });
    return this.findById(id);
  }

  async updatePerformance(
    id: string,
    totalTrades: number,
    winningTrades: number,
    losingTrades: number,
    totalPnL: number,
  ): Promise<void> {
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    await this.strategyRepository.update(id, {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnL,
      winRate,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const strategy = await this.findByIdAndUser(id, userId);
    
    if (strategy.status === StrategyStatus.ACTIVE) {
      throw new ForbiddenException('Cannot delete active strategy. Please stop it first.');
    }

    await this.strategyRepository.softDelete(id);
  }

  async getActiveStrategies(userId: string): Promise<Strategy[]> {
    return this.strategyRepository.find({
      where: {
        userId,
        status: StrategyStatus.ACTIVE,
      },
    });
  }
}
