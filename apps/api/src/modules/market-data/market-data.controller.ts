import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetMarketQuoteDto } from './dto/get-market-quote.dto';
import { GetHistoricalDataDto } from './dto/get-historical-data.dto';
import { InstrumentsSubscriptionDto } from './dto/instruments-subscription.dto';

@Controller('market-data')
@UseGuards(JwtAuthGuard)
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('quotes')
  async getQuotes(
    @Request() req,
    @Query() query: GetMarketQuoteDto,
  ) {
    const instrumentList = query.instruments.split(',');
    return this.marketDataService.getQuotes(req.user.userId, query.connectionId, instrumentList);
  }

  @Get('ohlc')
  async getOHLC(
    @Request() req,
    @Query() query: GetMarketQuoteDto,
  ) {
    const instrumentList = query.instruments.split(',');
    return this.marketDataService.getOHLC(req.user.userId, query.connectionId, instrumentList);
  }

  @Get('historical')
  async getHistoricalData(
    @Request() req,
    @Query() query: GetHistoricalDataDto,
  ) {
    return this.marketDataService.getHistoricalData(
      req.user.userId,
      query.connectionId,
      query.instrumentToken,
      query.interval,
      query.from,
      query.to,
    );
  }

  @Post('subscribe')
  async subscribe(@Body() body: InstrumentsSubscriptionDto) {
    return this.marketDataService.subscribeToInstruments(body.instruments);
  }

  @Post('unsubscribe')
  async unsubscribe(@Body() body: InstrumentsSubscriptionDto) {
    return this.marketDataService.unsubscribeFromInstruments(body.instruments);
  }
}
