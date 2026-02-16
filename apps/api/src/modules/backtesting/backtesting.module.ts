import { Module } from '@nestjs/common';
import { BacktestingController } from './backtesting.controller';
import { BacktestingService } from './backtesting.service';
import { BrokerModule } from '../broker/broker.module';

@Module({
  imports: [BrokerModule],
  controllers: [BacktestingController],
  providers: [BacktestingService],
  exports: [BacktestingService],
})
export class BacktestingModule {}
