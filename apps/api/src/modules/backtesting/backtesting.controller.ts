import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BacktestingService } from './backtesting.service';
import { RunBacktestDto } from './dto/run-backtest.dto';
import { Audit } from '../audit/decorators/audit.decorator';

@Controller('backtesting')
@UseGuards(JwtAuthGuard)
export class BacktestingController {
  constructor(private readonly backtestingService: BacktestingService) {}

  @Post('run')
  @Audit({ action: 'backtesting.run', resourceType: 'backtest' })
  async runBacktest(@Request() req, @Body() dto: RunBacktestDto) {
    return this.backtestingService.runBacktest(req.user.userId, dto);
  }
}
