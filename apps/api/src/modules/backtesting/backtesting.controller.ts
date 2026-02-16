import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BacktestingService } from './backtesting.service';
import { RunBacktestDto } from './dto/run-backtest.dto';
import { Audit } from '../audit/decorators/audit.decorator';
import { RunPortfolioBacktestDto } from './dto/run-portfolio-backtest.dto';
import { OptimizeBacktestDto } from './dto/optimize-backtest.dto';

@Controller('backtesting')
@UseGuards(JwtAuthGuard)
export class BacktestingController {
  constructor(private readonly backtestingService: BacktestingService) {}

  @Post('run')
  @Audit({ action: 'backtesting.run', resourceType: 'backtest' })
  async runBacktest(@Request() req, @Body() dto: RunBacktestDto) {
    return this.backtestingService.runBacktest(req.user.userId, dto);
  }

  @Post('run-portfolio')
  @Audit({ action: 'backtesting.run_portfolio', resourceType: 'backtest' })
  async runPortfolioBacktest(@Request() req, @Body() dto: RunPortfolioBacktestDto) {
    return this.backtestingService.runPortfolioBacktest(req.user.userId, dto);
  }

  @Post('optimize')
  @Audit({ action: 'backtesting.optimize', resourceType: 'backtest' })
  async optimizeBacktest(@Request() req, @Body() dto: OptimizeBacktestDto) {
    return this.backtestingService.optimizeBacktest(req.user.userId, dto);
  }
}
