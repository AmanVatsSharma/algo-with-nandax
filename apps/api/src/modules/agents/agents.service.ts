import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent, AgentStatus } from './entities/agent.entity';
import { BrokerService } from '../broker/broker.service';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly brokerService: BrokerService,
  ) {}

  async create(userId: string, agentData: Partial<Agent>): Promise<Agent> {
    await this.brokerService.getConnectionById(agentData.connectionId, userId);

    const agent = this.agentRepository.create({
      ...agentData,
      userId,
      currentCapital: agentData.allocatedCapital,
    });
    return this.agentRepository.save(agent);
  }

  async findAll(userId: string): Promise<Agent[]> {
    return this.agentRepository.find({
      where: { userId },
      relations: ['strategy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { id },
      relations: ['strategy'],
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }

  async findByIdAndUser(id: string, userId: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { id, userId },
      relations: ['strategy'],
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }

  async update(id: string, userId: string, updateData: Partial<Agent>): Promise<Agent> {
    const agent = await this.findByIdAndUser(id, userId);
    
    if (agent.status === AgentStatus.RUNNING) {
      throw new ForbiddenException('Cannot update running agent. Please stop it first.');
    }

    if (updateData.connectionId) {
      await this.brokerService.getConnectionById(updateData.connectionId, userId);
    }

    await this.agentRepository.update(id, updateData);
    return this.findById(id);
  }

  async updateStatus(id: string, status: AgentStatus): Promise<Agent> {
    const updateData: any = { status };
    
    if (status === AgentStatus.RUNNING) {
      updateData.startedAt = new Date();
      updateData.stoppedAt = null;
      updateData.lastError = null;
    } else if (status === AgentStatus.STOPPED) {
      updateData.stoppedAt = new Date();
    }

    await this.agentRepository.update(id, updateData);
    return this.findById(id);
  }

  async updatePerformance(
    id: string,
    totalTrades: number,
    activeTrades: number,
    totalPnL: number,
    todayPnL: number,
  ): Promise<void> {
    const agent = await this.findById(id);
    const roi = agent.allocatedCapital > 0 
      ? (totalPnL / Number(agent.allocatedCapital)) * 100 
      : 0;

    await this.agentRepository.update(id, {
      totalTrades,
      activeTrades,
      totalPnL,
      todayPnL,
      roi,
      lastExecutionAt: new Date(),
    });
  }

  async updateCapital(id: string, currentCapital: number): Promise<void> {
    await this.agentRepository.update(id, { currentCapital });
  }

  async setError(id: string, error: string): Promise<void> {
    await this.agentRepository.update(id, {
      status: AgentStatus.ERROR,
      lastError: error,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const agent = await this.findByIdAndUser(id, userId);
    
    if (agent.status === AgentStatus.RUNNING) {
      throw new ForbiddenException('Cannot delete running agent. Please stop it first.');
    }

    await this.agentRepository.softDelete(id);
  }

  async getRunningAgents(): Promise<Agent[]> {
    return this.agentRepository.find({
      where: { status: AgentStatus.RUNNING },
      relations: ['strategy'],
    });
  }
}
