import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BrokerModule } from './modules/broker/broker.module';
import { StrategyModule } from './modules/strategy/strategy.module';
import { TradingModule } from './modules/trading/trading.module';
import { AgentsModule } from './modules/agents/agents.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { MarketDataModule } from './modules/market-data/market-data.module';
import { WebsocketModule } from './modules/websocket/websocket.module';

// Config
import { typeOrmConfig } from './config/typeorm.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => typeOrmConfig(configService),
      inject: [ConfigService],
    }),

    // Redis & Bull Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Rate Limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),

    // Feature Modules
    AuthModule,
    UsersModule,
    BrokerModule,
    StrategyModule,
    TradingModule,
    AgentsModule,
    PortfolioModule,
    MarketDataModule,
    WebsocketModule,
  ],
})
export class AppModule {}
