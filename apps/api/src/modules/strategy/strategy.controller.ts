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
import { StrategyService } from './strategy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StrategyStatus } from './entities/strategy.entity';

@Controller('strategies')
@UseGuards(JwtAuthGuard)
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Post()
  async create(@Request() req, @Body() strategyData: any) {
    return this.strategyService.create(req.user.userId, strategyData);
  }

  @Get()
  async findAll(@Request() req) {
    return this.strategyService.findAll(req.user.userId);
  }

  @Get('active')
  async getActiveStrategies(@Request() req) {
    return this.strategyService.getActiveStrategies(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.strategyService.findByIdAndUser(id, req.user.userId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Request() req, @Body() updateData: any) {
    return this.strategyService.update(id, req.user.userId, updateData);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { status: StrategyStatus },
  ) {
    return this.strategyService.updateStatus(id, req.user.userId, body.status);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    await this.strategyService.delete(id, req.user.userId);
    return { message: 'Strategy deleted successfully' };
  }
}
