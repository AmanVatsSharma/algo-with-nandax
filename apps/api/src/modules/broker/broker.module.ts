import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BrokerService } from './broker.service';
import { BrokerController } from './broker.controller';
import { KiteService } from './services/kite.service';
import { BrokerConnection } from './entities/broker-connection.entity';
import { TokenCryptoService } from '@/common/services/token-crypto.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BrokerConnection]),
    HttpModule,
  ],
  controllers: [BrokerController],
  providers: [BrokerService, KiteService, TokenCryptoService],
  exports: [BrokerService, KiteService, TokenCryptoService],
})
export class BrokerModule {}
