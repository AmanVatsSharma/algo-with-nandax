import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MarketDataService } from './market-data.service';
import { MarketDataController } from './market-data.controller';
import { BrokerModule } from '../broker/broker.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'market-data',
    }),
    BrokerModule,
  ],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
