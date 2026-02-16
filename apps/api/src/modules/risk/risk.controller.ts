import { Body, Controller, Get, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RiskService } from './risk.service';
import { UpdateRiskProfileDto } from './dto/update-risk-profile.dto';
import { SetKillSwitchDto } from './dto/set-kill-switch.dto';
import { Audit } from '../audit/decorators/audit.decorator';

@Controller('risk')
@UseGuards(JwtAuthGuard)
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('profile')
  async getProfile(@Request() req) {
    return this.riskService.getOrCreateProfile(req.user.userId);
  }

  @Patch('profile')
  @Audit({ action: 'risk.profile.update', resourceType: 'risk_profile' })
  async updateProfile(@Request() req, @Body() dto: UpdateRiskProfileDto) {
    return this.riskService.updateProfile(req.user.userId, dto);
  }

  @Post('kill-switch/enable')
  @Audit({ action: 'risk.kill_switch.enable', resourceType: 'risk_profile' })
  async enableKillSwitch(@Request() req, @Body() dto: SetKillSwitchDto) {
    return this.riskService.enableKillSwitch(req.user.userId, dto);
  }

  @Post('kill-switch/disable')
  @Audit({ action: 'risk.kill_switch.disable', resourceType: 'risk_profile' })
  async disableKillSwitch(@Request() req) {
    return this.riskService.disableKillSwitch(req.user.userId);
  }

  @Get('alerts')
  async getAlerts(@Request() req, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 50;
    return this.riskService.getAlerts(req.user.userId, parsedLimit);
  }
}
