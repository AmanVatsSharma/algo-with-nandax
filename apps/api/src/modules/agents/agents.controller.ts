import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentExecutor } from './services/agent-executor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { Audit } from '../audit/decorators/audit.decorator';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentExecutor: AgentExecutor,
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

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.agentsService.findByIdAndUser(id, req.user.userId);
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
