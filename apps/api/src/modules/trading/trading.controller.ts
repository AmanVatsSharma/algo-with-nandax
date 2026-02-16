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
import { ExecuteTradeDto } from './dto/execute-trade.dto';
import { CloseTradeDto } from './dto/close-trade.dto';
import { Audit } from '../audit/decorators/audit.decorator';

@Controller('trades')
@UseGuards(JwtAuthGuard)
export class TradingController {
  constructor(
    private readonly tradingService: TradingService,
    private readonly tradeExecutor: TradeExecutor,
  ) {}

  @Post()
  @Audit({ action: 'trade.execute', resourceType: 'trade' })
  async executeTrade(@Request() req, @Body() body: ExecuteTradeDto) {
    return this.tradeExecutor.executeTrade(
      req.user.userId,
      body.agentId,
      body.connectionId,
      body.tradeData,
    );
  }

  @Post(':id/close')
  @Audit({ action: 'trade.close', resourceType: 'trade' })
  async closeTrade(
    @Request() req,
    @Param('id') id: string,
    @Body() body: CloseTradeDto,
  ) {
    return this.tradeExecutor.closeTrade(req.user.userId, id, body.connectionId, body.exitReason);
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
  async findByAgent(@Request() req, @Param('agentId') agentId: string) {
    return this.tradingService.findByAgentAndUser(agentId, req.user.userId);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.tradingService.findByIdAndUser(id, req.user.userId);
  }
}
