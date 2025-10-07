import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BrokerService } from './broker.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BrokerType } from './entities/broker-connection.entity';

@Controller('broker')
@UseGuards(JwtAuthGuard)
export class BrokerController {
  constructor(private readonly brokerService: BrokerService) {}

  @Post('connection')
  async createConnection(
    @Request() req,
    @Body() body: { brokerType: BrokerType; apiKey: string },
  ) {
    return this.brokerService.createConnection(req.user.userId, body.brokerType, body.apiKey);
  }

  @Get('connections')
  async getConnections(@Request() req) {
    return this.brokerService.getConnectionsByUser(req.user.userId);
  }

  @Get('accounts/all')
  async getAllAccounts(@Request() req) {
    return this.brokerService.getAllAccountsData(req.user.userId);
  }

  @Get('accounts/active')
  async getActiveAccounts(@Request() req) {
    return this.brokerService.getActiveConnections(req.user.userId);
  }

  @Get('connection/:id')
  async getConnection(@Param('id') id: string) {
    return this.brokerService.getConnectionById(id);
  }

  @Delete('connection/:id')
  async deleteConnection(@Param('id') id: string) {
    await this.brokerService.deleteConnection(id);
    return { message: 'Connection deleted successfully' };
  }

  // Kite-specific endpoints
  @Get('kite/login-url')
  async getKiteLoginUrl(@Query('apiKey') apiKey: string) {
    const loginUrl = await this.brokerService.generateKiteLoginUrl(apiKey);
    return { loginUrl };
  }

  @Post('kite/connect')
  async connectKite(
    @Body() body: { connectionId: string; requestToken: string; apiSecret: string },
  ) {
    return this.brokerService.connectKite(
      body.connectionId,
      body.requestToken,
      body.apiSecret,
    );
  }

  @Get('kite/profile/:connectionId')
  async getKiteProfile(@Param('connectionId') connectionId: string) {
    return this.brokerService.getKiteProfile(connectionId);
  }

  @Get('kite/positions/:connectionId')
  async getKitePositions(@Param('connectionId') connectionId: string) {
    return this.brokerService.getKitePositions(connectionId);
  }

  @Get('kite/holdings/:connectionId')
  async getKiteHoldings(@Param('connectionId') connectionId: string) {
    return this.brokerService.getKiteHoldings(connectionId);
  }

  @Post('kite/order/:connectionId')
  async placeKiteOrder(@Param('connectionId') connectionId: string, @Body() orderData: any) {
    return this.brokerService.placeKiteOrder(connectionId, orderData);
  }
}
