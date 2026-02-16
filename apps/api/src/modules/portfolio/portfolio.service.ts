import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portfolio } from './entities/portfolio.entity';
import { Position, PositionStatus } from './entities/position.entity';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
  ) {}

  // Portfolio methods
  async createPortfolio(userId: string, portfolioData: Partial<Portfolio>): Promise<Portfolio> {
    const portfolio = this.portfolioRepository.create({
      ...portfolioData,
      userId,
      currentCapital: portfolioData.initialCapital,
    });
    return this.portfolioRepository.save(portfolio);
  }

  async findPortfoliosByUser(userId: string): Promise<Portfolio[]> {
    return this.portfolioRepository.find({
      where: { userId },
      relations: ['positions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findPortfolioById(id: string): Promise<Portfolio> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { id },
      relations: ['positions'],
    });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }
    return portfolio;
  }

  async findPortfolioByIdAndUser(id: string, userId: string): Promise<Portfolio> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { id, userId },
      relations: ['positions'],
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    return portfolio;
  }

  async updatePortfolio(id: string, userId: string, updateData: Partial<Portfolio>): Promise<Portfolio> {
    await this.findPortfolioByIdAndUser(id, userId);
    await this.portfolioRepository.update({ id, userId }, updateData);
    return this.findPortfolioByIdAndUser(id, userId);
  }

  // Position methods
  async createPosition(
    portfolioId: string,
    userId: string,
    positionData: Partial<Position>,
  ): Promise<Position> {
    await this.findPortfolioByIdAndUser(portfolioId, userId);

    const position = this.positionRepository.create({
      ...positionData,
      portfolioId,
      openedAt: new Date(),
    });
    return this.positionRepository.save(position);
  }

  async findPositionsByPortfolio(portfolioId: string, userId: string): Promise<Position[]> {
    await this.findPortfolioByIdAndUser(portfolioId, userId);
    return this.positionRepository.find({
      where: { portfolioId },
      order: { openedAt: 'DESC' },
    });
  }

  async findOpenPositions(portfolioId: string, userId: string): Promise<Position[]> {
    await this.findPortfolioByIdAndUser(portfolioId, userId);
    return this.positionRepository.find({
      where: {
        portfolioId,
        status: PositionStatus.OPEN,
      },
    });
  }

  async updatePosition(id: string, updateData: Partial<Position>): Promise<Position> {
    await this.positionRepository.update(id, updateData);
    const position = await this.positionRepository.findOne({ where: { id } });
    if (!position) {
      throw new NotFoundException('Position not found');
    }
    return position;
  }

  async closePosition(id: string, userId: string, currentPrice: number): Promise<Position> {
    const position = await this.positionRepository.findOne({
      where: { id },
      relations: ['portfolio'],
    });
    if (!position) {
      throw new NotFoundException('Position not found');
    }

    if (position.portfolio.userId !== userId) {
      throw new NotFoundException('Position not found');
    }

    const unrealizedPnL = (currentPrice - Number(position.averagePrice)) * position.quantity;

    await this.positionRepository.update(id, {
      status: PositionStatus.CLOSED,
      currentPrice,
      realizedPnL: unrealizedPnL,
      closedAt: new Date(),
    });

    return this.updatePosition(id, {});
  }

  async updateUnrealizedPnL(positionId: string, currentPrice: number): Promise<void> {
    const position = await this.positionRepository.findOne({ where: { id: positionId } });
    if (!position) {
      return;
    }

    const unrealizedPnL = (currentPrice - Number(position.averagePrice)) * position.quantity;

    await this.positionRepository.update(positionId, {
      currentPrice,
      unrealizedPnL,
    });
  }
}
