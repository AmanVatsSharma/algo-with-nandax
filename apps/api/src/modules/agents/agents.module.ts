import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentExecutor } from './services/agent-executor.service';
import { AIDecisionService } from './services/ai-decision.service';
import { AIDecisionLogService } from './services/ai-decision-log.service';
import { AgentProcessor } from './processors/agent.processor';
import { Agent } from './entities/agent.entity';
import { AIDecisionLog } from './entities/ai-decision-log.entity';
import { StrategyModule } from '../strategy/strategy.module';
import { TradingModule } from '../trading/trading.module';
import { BrokerModule } from '../broker/broker.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, AIDecisionLog]),
    BullModule.registerQueue({
      name: 'agents',
    }),
    HttpModule,
    StrategyModule,
    TradingModule,
    BrokerModule,
    RiskModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService, AgentExecutor, AgentProcessor, AIDecisionService, AIDecisionLogService],
  exports: [AgentsService, AgentExecutor],
})
export class AgentsModule {}
