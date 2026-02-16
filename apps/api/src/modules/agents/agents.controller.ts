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
import { AIGovernancePolicyRequestService } from './services/ai-governance-policy-request.service';
import { AIGovernanceEventService } from './services/ai-governance-event.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { Audit } from '../audit/decorators/audit.decorator';
import { GetAIGovernanceSummaryDto } from './dto/get-ai-governance-summary.dto';
import { UpdateAIGovernancePolicyDto } from './dto/update-ai-governance-policy.dto';
import { CreateAIGovernancePolicyRequestDto } from './dto/create-ai-governance-policy-request.dto';
import { ReviewAIGovernancePolicyRequestDto } from './dto/review-ai-governance-policy-request.dto';
import { UserRole } from '../users/entities/user.entity';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentExecutor: AgentExecutor,
    private readonly aiDecisionLogService: AIDecisionLogService,
    private readonly aiCostLedgerService: AICostLedgerService,
    private readonly aiGovernancePolicyService: AIGovernancePolicyService,
    private readonly aiGovernancePolicyRequestService: AIGovernancePolicyRequestService,
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
    if (
      this.aiGovernancePolicyRequestService.isApprovalRequired() &&
      req.user.role !== UserRole.ADMIN
    ) {
      const request = await this.aiGovernancePolicyRequestService.createRequest({
        requestedByUserId: req.user.userId,
        targetUserId: req.user.userId,
        dto,
      });
      return {
        status: 'pending_approval',
        message: 'Policy update submitted for admin approval',
        request,
      };
    }

    return this.aiGovernancePolicyService.updatePolicyProfile(req.user.userId, dto);
  }

  @Post('governance/policy/change-requests')
  @Audit({ action: 'ai-governance-policy.request', resourceType: 'ai-governance-policy-request' })
  async createAIGovernancePolicyChangeRequest(
    @Request() req,
    @Body() dto: CreateAIGovernancePolicyRequestDto,
  ) {
    return this.aiGovernancePolicyRequestService.createRequest({
      requestedByUserId: req.user.userId,
      targetUserId: req.user.userId,
      dto,
    });
  }

  @Get('governance/policy/change-requests')
  async getAIGovernancePolicyChangeRequests(@Request() req, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 100;
    return this.aiGovernancePolicyRequestService.listRequestsForUser({
      userId: req.user.userId,
      role: req.user.role,
      limit: parsedLimit,
    });
  }

  @Post('governance/policy/change-requests/:id/approve')
  @Audit({ action: 'ai-governance-policy.request.approve', resourceType: 'ai-governance-policy-request' })
  async approveAIGovernancePolicyChangeRequest(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ReviewAIGovernancePolicyRequestDto,
  ) {
    return this.aiGovernancePolicyRequestService.approveRequest({
      requestId: id,
      reviewerUserId: req.user.userId,
      reviewerRole: req.user.role,
      dto,
    });
  }

  @Post('governance/policy/change-requests/:id/reject')
  @Audit({ action: 'ai-governance-policy.request.reject', resourceType: 'ai-governance-policy-request' })
  async rejectAIGovernancePolicyChangeRequest(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ReviewAIGovernancePolicyRequestDto,
  ) {
    return this.aiGovernancePolicyRequestService.rejectRequest({
      requestId: id,
      reviewerUserId: req.user.userId,
      reviewerRole: req.user.role,
      dto,
    });
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
