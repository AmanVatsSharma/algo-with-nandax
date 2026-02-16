import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentsService } from '../agents.service';
import { AgentStatus, AgentType } from '../entities/agent.entity';
import { getErrorMessage } from '@/common/utils/error.utils';

@Injectable()
export class AgentExecutor {
  private readonly logger = new Logger(AgentExecutor.name);

  constructor(
    @InjectQueue('agents') private readonly agentsQueue: Queue,
    private readonly agentsService: AgentsService,
  ) {}

  /**
   * Start an agent
   */
  async startAgent(agentId: string): Promise<void> {
    try {
      await this.agentsService.updateStatus(agentId, AgentStatus.RUNNING);
      this.logger.log(`Agent ${agentId} started`);
    } catch (error) {
      this.logger.error(`Error starting agent ${agentId}`, error);
      await this.agentsService.setError(agentId, getErrorMessage(error, 'Failed to start agent'));
      throw error;
    }
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: string): Promise<void> {
    try {
      await this.agentsService.updateStatus(agentId, AgentStatus.STOPPED);
      this.logger.log(`Agent ${agentId} stopped`);
    } catch (error) {
      this.logger.error(`Error stopping agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Pause an agent
   */
  async pauseAgent(agentId: string): Promise<void> {
    try {
      await this.agentsService.updateStatus(agentId, AgentStatus.PAUSED);
      this.logger.log(`Agent ${agentId} paused`);
    } catch (error) {
      this.logger.error(`Error pausing agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Execute agent logic - check for trading opportunities
   */
  async executeAgent(agentId: string): Promise<void> {
    const agent = await this.agentsService.findById(agentId);

    if (agent.status !== AgentStatus.RUNNING) {
      this.logger.warn(`Agent ${agentId} is not running, skipping execution`);
      return;
    }

    try {
      // Queue the agent execution
      await this.agentsQueue.add('execute-strategy', {
        agentId: agent.id,
        strategyId: agent.strategyId,
        agentType: agent.type,
        strategyConfig: agent.strategy.configuration,
      });

      this.logger.log(`Agent ${agentId} execution queued`);
    } catch (error) {
      this.logger.error(`Error executing agent ${agentId}`, error);
      await this.agentsService.setError(agentId, getErrorMessage(error, 'Failed to execute agent'));
    }
  }

  /**
   * Scheduled task to execute all running agents every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async executeAllRunningAgents() {
    try {
      const runningAgents = await this.agentsService.getRunningAgents();
      this.logger.log(`Executing ${runningAgents.length} running agents`);

      for (const agent of runningAgents) {
        await this.executeAgent(agent.id);
      }
    } catch (error) {
      this.logger.error('Error in scheduled agent execution', error);
    }
  }

  /**
   * AI-based decision making
   */
  async makeAIDecision(
    agentId: string,
    marketData: any,
    strategyConfig: any,
  ): Promise<{ action: 'buy' | 'sell' | 'hold'; confidence: number; metadata?: any }> {
    // This is a placeholder for AI/ML model integration
    // In production, this would call your trained AI model
    
    this.logger.log(`Making AI decision for agent ${agentId}`);
    
    // Simulate AI decision (replace with actual AI model)
    const decision = {
      action: 'hold' as 'buy' | 'sell' | 'hold',
      confidence: 0.5,
      metadata: {
        indicators: {},
        signals: [],
      },
    };

    return decision;
  }
}
