import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentExecutor } from './services/agent-executor.service';
import { AgentProcessor } from './processors/agent.processor';
import { Agent } from './entities/agent.entity';
import { StrategyModule } from '../strategy/strategy.module';
import { TradingModule } from '../trading/trading.module';
import { BrokerModule } from '../broker/broker.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent]),
    BullModule.registerQueue({
      name: 'agents',
    }),
    StrategyModule,
    TradingModule,
    BrokerModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService, AgentExecutor, AgentProcessor],
  exports: [AgentsService, AgentExecutor],
})
export class AgentsModule {}
