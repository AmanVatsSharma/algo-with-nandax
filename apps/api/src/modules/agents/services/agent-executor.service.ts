import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { JobOptions, Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentsService } from '../agents.service';
import { AgentStatus, AgentType } from '../entities/agent.entity';
import { getErrorMessage } from '@/common/utils/error.utils';
import { AIDecisionService } from './ai-decision.service';

@Injectable()
export class AgentExecutor {
  private readonly logger = new Logger(AgentExecutor.name);
  private readonly agentExecutionJobOptions: JobOptions = {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  };

  constructor(
    @InjectQueue('agents') private readonly agentsQueue: Queue,
    private readonly agentsService: AgentsService,
    private readonly aiDecisionService: AIDecisionService,
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
      await this.agentsQueue.add(
        'execute-strategy',
        {
          agentId: agent.id,
          strategyId: agent.strategyId,
          agentType: agent.type,
          strategyConfig: agent.strategy.configuration,
        },
        {
          ...this.agentExecutionJobOptions,
          // Prevent overlapping execution for same agent in case previous job is still running.
          jobId: `execute-strategy:${agent.id}`,
        },
      );

      this.logger.log(`Agent ${agentId} execution queued`);
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Failed to execute agent');

      if (errorMessage.toLowerCase().includes('job') && errorMessage.toLowerCase().includes('exists')) {
        this.logger.debug(
          `Execution job already queued for agent ${agentId}; skipping duplicate enqueue`,
        );
        return;
      }

      this.logger.error(`Error executing agent ${agentId}`, error);
      await this.agentsService.setError(agentId, errorMessage);
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
    agentContext?: {
      aiModelName?: string;
      aiModelConfig?: Record<string, unknown>;
    },
  ): Promise<{ action: 'buy' | 'sell' | 'hold'; confidence: number; metadata?: any }> {
    this.logger.log(`Making AI decision for agent ${agentId}`);

    const decision = await this.aiDecisionService.decide({
      agentId,
      marketData,
      strategyConfig,
      aiModelName: agentContext?.aiModelName,
      aiModelConfig: agentContext?.aiModelConfig,
    });

    return {
      action: decision.action,
      confidence: decision.confidence,
      metadata: decision.metadata,
    };
  }
}
