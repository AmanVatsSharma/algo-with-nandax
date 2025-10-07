import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('market-data')
@UseGuards(JwtAuthGuard)
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('quotes')
  async getQuotes(
    @Query('accessToken') accessToken: string,
    @Query('instruments') instruments: string,
  ) {
    const instrumentList = instruments.split(',');
    return this.marketDataService.getQuotes(accessToken, instrumentList);
  }

  @Get('ohlc')
  async getOHLC(
    @Query('accessToken') accessToken: string,
    @Query('instruments') instruments: string,
  ) {
    const instrumentList = instruments.split(',');
    return this.marketDataService.getOHLC(accessToken, instrumentList);
  }

  @Get('historical')
  async getHistoricalData(
    @Query('accessToken') accessToken: string,
    @Query('instrumentToken') instrumentToken: string,
    @Query('interval') interval: string,
    @Query('from') fromDate: string,
    @Query('to') toDate: string,
  ) {
    return this.marketDataService.getHistoricalData(
      accessToken,
      instrumentToken,
      interval,
      fromDate,
      toDate,
    );
  }

  @Post('subscribe')
  async subscribe(@Body() body: { instruments: string[] }) {
    return this.marketDataService.subscribeToInstruments(body.instruments);
  }

  @Post('unsubscribe')
  async unsubscribe(@Body() body: { instruments: string[] }) {
    return this.marketDataService.unsubscribeFromInstruments(body.instruments);
  }
}
