import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { PerformanceReport } from './entities/performance-report.entity';
import { Trade } from '../trading/entities/trade.entity';
import { Agent } from '../agents/entities/agent.entity';
import { Strategy } from '../strategy/entities/strategy.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnalyticsEvent,
      PerformanceReport,
      Trade,
      Agent,
      Strategy,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
