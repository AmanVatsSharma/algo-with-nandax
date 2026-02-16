import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentExecutor } from './services/agent-executor.service';
import { AIDecisionLogService } from './services/ai-decision-log.service';
import { AICostLedgerService } from './services/ai-cost-ledger.service';
import { AIGovernancePolicyService } from './services/ai-governance-policy.service';
import { AIGovernanceEventService } from './services/ai-governance-event.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { Audit } from '../audit/decorators/audit.decorator';
import { GetAIGovernanceSummaryDto } from './dto/get-ai-governance-summary.dto';
import { UpdateAIGovernancePolicyDto } from './dto/update-ai-governance-policy.dto';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentExecutor: AgentExecutor,
    private readonly aiDecisionLogService: AIDecisionLogService,
    private readonly aiCostLedgerService: AICostLedgerService,
    private readonly aiGovernancePolicyService: AIGovernancePolicyService,
    private readonly aiGovernanceEventService: AIGovernanceEventService,
  ) {}

  @Post()
  @Audit({ action: 'agent.create', resourceType: 'agent' })
  async create(@Request() req, @Body() agentData: CreateAgentDto) {
    return this.agentsService.create(req.user.userId, agentData);
  }

  @Get()
  async findAll(@Request() req) {
    return this.agentsService.findAll(req.user.userId);
  }

  @Get('governance/summary')
  async getAIGovernanceSummary(@Request() req, @Query() query: GetAIGovernanceSummaryDto) {
    return this.aiDecisionLogService.getGovernanceSummary(req.user.userId, query.days ?? 30);
  }

  @Get('governance/ledger')
  async getAICostLedger(@Request() req, @Query() query: GetAIGovernanceSummaryDto) {
    return this.aiCostLedgerService.getUserLedger(req.user.userId, query.days ?? 30);
  }

  @Get('governance/policy')
  async getAIGovernancePolicy(@Request() req) {
    return this.aiGovernancePolicyService.getEffectivePolicy(req.user.userId);
  }

  @Get('governance/events')
  async getAIGovernanceEvents(@Request() req, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 100;
    return this.aiGovernanceEventService.getRecentEvents(req.user.userId, parsedLimit);
  }

  @Patch('governance/policy')
  @Audit({ action: 'ai-governance-policy.update', resourceType: 'ai-governance-policy' })
  async updateAIGovernancePolicy(
    @Request() req,
    @Body() dto: UpdateAIGovernancePolicyDto,
  ) {
    return this.aiGovernancePolicyService.updatePolicyProfile(req.user.userId, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.agentsService.findByIdAndUser(id, req.user.userId);
  }

  @Get(':id/decision-logs')
  async findDecisionLogs(@Param('id') id: string, @Request() req, @Query('limit') limit?: string) {
    await this.agentsService.findByIdAndUser(id, req.user.userId);
    const parsedLimit = limit ? Number(limit) : 100;
    return this.aiDecisionLogService.getRecentLogs(req.user.userId, id, parsedLimit);
  }

  @Patch(':id')
  @Audit({ action: 'agent.update', resourceType: 'agent' })
  async update(@Param('id') id: string, @Request() req, @Body() updateData: UpdateAgentDto) {
    return this.agentsService.update(id, req.user.userId, updateData);
  }

  @Post(':id/start')
  @Audit({ action: 'agent.start', resourceType: 'agent' })
  async startAgent(@Param('id') id: string, @Request() req) {
    await this.agentsService.findByIdAndUser(id, req.user.userId);
    await this.agentExecutor.startAgent(id);
    return { message: 'Agent started successfully' };
  }

  @Post(':id/stop')
  @Audit({ action: 'agent.stop', resourceType: 'agent' })
  async stopAgent(@Param('id') id: string, @Request() req) {
    await this.agentsService.findByIdAndUser(id, req.user.userId);
    await this.agentExecutor.stopAgent(id);
    return { message: 'Agent stopped successfully' };
  }

  @Post(':id/pause')
  @Audit({ action: 'agent.pause', resourceType: 'agent' })
  async pauseAgent(@Param('id') id: string, @Request() req) {
    await this.agentsService.findByIdAndUser(id, req.user.userId);
    await this.agentExecutor.pauseAgent(id);
    return { message: 'Agent paused successfully' };
  }

  @Delete(':id')
  @Audit({ action: 'agent.delete', resourceType: 'agent' })
  async delete(@Param('id') id: string, @Request() req) {
    await this.agentsService.delete(id, req.user.userId);
    return { message: 'Agent deleted successfully' };
  }
}
