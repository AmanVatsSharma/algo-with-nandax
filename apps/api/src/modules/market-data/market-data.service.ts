import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BrokerService } from '../broker/broker.service';
import { getErrorMessage } from '@/common/utils/error.utils';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    @InjectQueue('market-data') private readonly marketDataQueue: Queue,
    private readonly brokerService: BrokerService,
  ) {}

  async getQuotes(userId: string, connectionId: string, instruments: string[]) {
    try {
      return await this.brokerService.getKiteQuotes(userId, connectionId, instruments);
    } catch (error) {
      this.logger.error(getErrorMessage(error, 'Error fetching quotes'), error);
      throw error;
    }
  }

  async getOHLC(userId: string, connectionId: string, instruments: string[]) {
    try {
      return await this.brokerService.getKiteOHLC(userId, connectionId, instruments);
    } catch (error) {
      this.logger.error(getErrorMessage(error, 'Error fetching OHLC'), error);
      throw error;
    }
  }

  async getHistoricalData(
    userId: string,
    connectionId: string,
    instrumentToken: string,
    interval: string,
    fromDate: string,
    toDate: string,
  ) {
    try {
      return await this.brokerService.getKiteHistoricalData(
        userId,
        connectionId,
        instrumentToken,
        interval,
        fromDate,
        toDate,
      );
    } catch (error) {
      this.logger.error(getErrorMessage(error, 'Error fetching historical data'), error);
      throw error;
    }
  }

  async subscribeToInstruments(instruments: string[]) {
    this.logger.log(`Subscribing to instruments: ${instruments.join(', ')}`);
    // Placeholder for WebSocket subscription logic
    return { success: true, instruments };
  }

  async unsubscribeFromInstruments(instruments: string[]) {
    this.logger.log(`Unsubscribing from instruments: ${instruments.join(', ')}`);
    // Placeholder for WebSocket unsubscription logic
    return { success: true, instruments };
  }
}
