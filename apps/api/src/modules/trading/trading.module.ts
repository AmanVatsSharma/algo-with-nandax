import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { TradingService } from './trading.service';
import { TradingController } from './trading.controller';
import { TradeExecutor } from './services/trade-executor.service';
import { TradingProcessor } from './processors/trading.processor';
import { Trade } from './entities/trade.entity';
import { BrokerModule } from '../broker/broker.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade]),
    BullModule.registerQueue({
      name: 'trading',
    }),
    BrokerModule,
    RiskModule,
  ],
  controllers: [TradingController],
  providers: [TradingService, TradeExecutor, TradingProcessor],
  exports: [TradingService, TradeExecutor],
})
export class TradingModule {}
