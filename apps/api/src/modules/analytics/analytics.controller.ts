import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventType } from './entities/analytics-event.entity';
import { ReportType } from './entities/performance-report.entity';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  async trackEvent(
    @Request() req,
    @Body()
    body: {
      eventType: EventType;
      properties?: Record<string, any>;
    },
  ) {
    await this.analyticsService.trackEvent(
      body.eventType,
      req.user.userId,
      body.properties,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );

    return { success: true };
  }

  @Get('activity')
  async getUserActivity(
    @Request() req,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getUserActivity(
      req.user.userId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('platform')
  async getPlatformAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getPlatformAnalytics(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('reports/generate')
  async generateReport(
    @Request() req,
    @Body()
    body: {
      agentId?: string;
      strategyId?: string;
      reportType?: ReportType;
      customStart?: string;
      customEnd?: string;
    },
  ) {
    return this.analyticsService.generatePerformanceReport(
      req.user.userId,
      body.agentId,
      body.strategyId,
      body.reportType || ReportType.MONTHLY,
      body.customStart ? new Date(body.customStart) : undefined,
      body.customEnd ? new Date(body.customEnd) : undefined,
    );
  }

  @Get('reports')
  async getReports(
    @Request() req,
    @Query('agentId') agentId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getReports(
      req.user.userId,
      agentId,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('reports/:id')
  async getReport(@Param('id') id: string) {
    // Implementation to fetch specific report
    return { message: 'Report details' };
  }
}
