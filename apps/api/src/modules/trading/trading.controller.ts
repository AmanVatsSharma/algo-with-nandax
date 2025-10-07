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
import { TradingService } from './trading.service';
import { TradeExecutor } from './services/trade-executor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('trades')
@UseGuards(JwtAuthGuard)
export class TradingController {
  constructor(
    private readonly tradingService: TradingService,
    private readonly tradeExecutor: TradeExecutor,
  ) {}

  @Post()
  async executeTrade(@Request() req, @Body() body: any) {
    return this.tradeExecutor.executeTrade(
      req.user.userId,
      body.agentId,
      body.connectionId,
      body.tradeData,
    );
  }

  @Post(':id/close')
  async closeTrade(@Param('id') id: string, @Body() body: { connectionId: string; exitReason?: string }) {
    return this.tradeExecutor.closeTrade(id, body.connectionId, body.exitReason);
  }

  @Get()
  async findAll(@Request() req) {
    return this.tradingService.findByUser(req.user.userId);
  }

  @Get('today')
  async findTodayTrades(@Request() req) {
    return this.tradingService.findTodayTrades(req.user.userId);
  }

  @Get('stats')
  async getStats(@Request() req) {
    return this.tradingService.getTradeStats(req.user.userId);
  }

  @Get('agent/:agentId')
  async findByAgent(@Param('agentId') agentId: string) {
    return this.tradingService.findByAgent(agentId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tradingService.findById(id);
  }
}
