import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  async getMyLogs(@Request() req, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 50;
    return this.auditService.getUserLogs(req.user.userId, parsedLimit);
  }
}
