import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('portfolios')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post()
  async createPortfolio(@Request() req, @Body() portfolioData: any) {
    return this.portfolioService.createPortfolio(req.user.userId, portfolioData);
  }

  @Get()
  async findAll(@Request() req) {
    return this.portfolioService.findPortfoliosByUser(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.portfolioService.findPortfolioById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    return this.portfolioService.updatePortfolio(id, updateData);
  }

  @Get(':id/positions')
  async getPositions(@Param('id') id: string) {
    return this.portfolioService.findPositionsByPortfolio(id);
  }

  @Get(':id/positions/open')
  async getOpenPositions(@Param('id') id: string) {
    return this.portfolioService.findOpenPositions(id);
  }

  @Post(':id/positions')
  async createPosition(@Param('id') portfolioId: string, @Body() positionData: any) {
    return this.portfolioService.createPosition(portfolioId, positionData);
  }

  @Post('positions/:positionId/close')
  async closePosition(@Param('positionId') positionId: string, @Body() body: { currentPrice: number }) {
    return this.portfolioService.closePosition(positionId, body.currentPrice);
  }
}
