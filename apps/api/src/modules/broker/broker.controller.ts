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
import { CreateConnectionDto } from './dto/create-connection.dto';
import { ConnectKiteDto } from './dto/connect-kite.dto';
import { PlaceKiteOrderDto } from './dto/place-kite-order.dto';
import { GetKiteLoginUrlDto } from './dto/get-kite-login-url.dto';
import { Audit } from '../audit/decorators/audit.decorator';

@Controller('broker')
@UseGuards(JwtAuthGuard)
export class BrokerController {
  constructor(private readonly brokerService: BrokerService) {}

  @Post('connection')
  @Audit({ action: 'broker.connection.create', resourceType: 'broker_connection' })
  async createConnection(
    @Request() req,
    @Body() body: CreateConnectionDto,
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
  async getConnection(@Param('id') id: string, @Request() req) {
    return this.brokerService.getConnectionById(id, req.user.userId);
  }

  @Delete('connection/:id')
  @Audit({ action: 'broker.connection.delete', resourceType: 'broker_connection' })
  async deleteConnection(@Param('id') id: string, @Request() req) {
    await this.brokerService.deleteConnection(id, req.user.userId);
    return { message: 'Connection deleted successfully' };
  }

  // Kite-specific endpoints
  @Get('kite/login-url')
  async getKiteLoginUrl(@Query() query: GetKiteLoginUrlDto) {
    const loginUrl = await this.brokerService.generateKiteLoginUrl(query.apiKey);
    return { loginUrl };
  }

  @Post('kite/connect')
  @Audit({ action: 'broker.kite.connect', resourceType: 'broker_connection' })
  async connectKite(
    @Request() req,
    @Body() body: ConnectKiteDto,
  ) {
    return this.brokerService.connectKite(
      req.user.userId,
      body.connectionId,
      body.requestToken,
      body.apiSecret,
    );
  }

  @Get('kite/profile/:connectionId')
  async getKiteProfile(@Param('connectionId') connectionId: string, @Request() req) {
    return this.brokerService.getKiteProfile(req.user.userId, connectionId);
  }

  @Get('kite/positions/:connectionId')
  async getKitePositions(@Param('connectionId') connectionId: string, @Request() req) {
    return this.brokerService.getKitePositions(req.user.userId, connectionId);
  }

  @Get('kite/holdings/:connectionId')
  async getKiteHoldings(@Param('connectionId') connectionId: string, @Request() req) {
    return this.brokerService.getKiteHoldings(req.user.userId, connectionId);
  }

  @Post('kite/order/:connectionId')
  @Audit({ action: 'broker.kite.order.place', resourceType: 'broker_order' })
  async placeKiteOrder(
    @Param('connectionId') connectionId: string,
    @Request() req,
    @Body() orderData: PlaceKiteOrderDto,
  ) {
    return this.brokerService.placeKiteOrder(req.user.userId, connectionId, orderData);
  }
}
