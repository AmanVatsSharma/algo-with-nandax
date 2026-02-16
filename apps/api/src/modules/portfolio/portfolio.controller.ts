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
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { ClosePositionDto } from './dto/close-position.dto';

@Controller('portfolios')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post()
  async createPortfolio(@Request() req, @Body() portfolioData: CreatePortfolioDto) {
    return this.portfolioService.createPortfolio(req.user.userId, portfolioData);
  }

  @Get()
  async findAll(@Request() req) {
    return this.portfolioService.findPortfoliosByUser(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.portfolioService.findPortfolioByIdAndUser(id, req.user.userId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Request() req, @Body() updateData: UpdatePortfolioDto) {
    return this.portfolioService.updatePortfolio(id, req.user.userId, updateData);
  }

  @Get(':id/positions')
  async getPositions(@Param('id') id: string, @Request() req) {
    return this.portfolioService.findPositionsByPortfolio(id, req.user.userId);
  }

  @Get(':id/positions/open')
  async getOpenPositions(@Param('id') id: string, @Request() req) {
    return this.portfolioService.findOpenPositions(id, req.user.userId);
  }

  @Post(':id/positions')
  async createPosition(
    @Param('id') portfolioId: string,
    @Request() req,
    @Body() positionData: CreatePositionDto,
  ) {
    return this.portfolioService.createPosition(portfolioId, req.user.userId, positionData);
  }

  @Post('positions/:positionId/close')
  async closePosition(
    @Param('positionId') positionId: string,
    @Request() req,
    @Body() body: ClosePositionDto,
  ) {
    return this.portfolioService.closePosition(positionId, req.user.userId, body.currentPrice);
  }
}
