import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

@Injectable()
export class KiteService {
  private readonly logger = new Logger(KiteService.name);
  private readonly baseUrl = 'https://api.kite.trade';
  private readonly loginUrl = 'https://kite.zerodha.com/connect/login';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate Kite login URL for user authentication
   */
  generateLoginUrl(apiKey: string): string {
    const redirectUrl = this.configService.get('KITE_REDIRECT_URL');
    return `${this.loginUrl}?api_key=${apiKey}&v=3`;
  }

  /**
   * Generate session using request token
   */
  async generateSession(apiKey: string, requestToken: string, apiSecret: string) {
    try {
      const checksum = crypto
        .createHash('sha256')
        .update(apiKey + requestToken + apiSecret)
        .digest('hex');

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/session/token`, {
          api_key: apiKey,
          request_token: requestToken,
          checksum: checksum,
        }),
      );

      this.logger.log('Kite session generated successfully');
      return response.data.data;
    } catch (error) {
      this.logger.error('Error generating Kite session', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getProfile(accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/user/profile`, {
          headers: this.getHeaders(accessToken),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error fetching Kite profile', error);
      throw error;
    }
  }

  /**
   * Get user margins
   */
  async getMargins(accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/user/margins`, {
          headers: this.getHeaders(accessToken),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error fetching margins', error);
      throw error;
    }
  }

  /**
   * Get positions
   */
  async getPositions(accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/portfolio/positions`, {
          headers: this.getHeaders(accessToken),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error fetching positions', error);
      throw error;
    }
  }

  /**
   * Get holdings
   */
  async getHoldings(accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/portfolio/holdings`, {
          headers: this.getHeaders(accessToken),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error fetching holdings', error);
      throw error;
    }
  }

  /**
   * Get orders
   */
  async getOrders(accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/orders`, {
          headers: this.getHeaders(accessToken),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error fetching orders', error);
      throw error;
    }
  }

  /**
   * Place order
   */
  async placeOrder(accessToken: string, apiKey: string, orderData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/orders/regular`, orderData, {
          headers: {
            ...this.getHeaders(accessToken),
            'X-Kite-Version': '3',
          },
        }),
      );
      this.logger.log(`Order placed: ${response.data.data.order_id}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Error placing order', error);
      throw error;
    }
  }

  /**
   * Modify order
   */
  async modifyOrder(accessToken: string, orderId: string, orderData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.put(`${this.baseUrl}/orders/regular/${orderId}`, orderData, {
          headers: this.getHeaders(accessToken),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error modifying order', error);
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(accessToken: string, orderId: string, variety: string = 'regular') {
    try {
      const response = await firstValueFrom(
        this.httpService.delete(`${this.baseUrl}/orders/${variety}/${orderId}`, {
          headers: this.getHeaders(accessToken),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error cancelling order', error);
      throw error;
    }
  }

  /**
   * Get quotes for instruments
   */
  async getQuote(accessToken: string, instruments: string[]) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/quote`, {
          headers: this.getHeaders(accessToken),
          params: { i: instruments },
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error fetching quotes', error);
      throw error;
    }
  }

  /**
   * Get OHLC data
   */
  async getOHLC(accessToken: string, instruments: string[]) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/quote/ohlc`, {
          headers: this.getHeaders(accessToken),
          params: { i: instruments },
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error fetching OHLC', error);
      throw error;
    }
  }

  /**
   * Get historical data
   */
  async getHistoricalData(
    accessToken: string,
    instrumentToken: string,
    interval: string,
    fromDate: string,
    toDate: string,
  ) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/instruments/historical/${instrumentToken}/${interval}`,
          {
            headers: this.getHeaders(accessToken),
            params: {
              from: fromDate,
              to: toDate,
            },
          },
        ),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error fetching historical data', error);
      throw error;
    }
  }

  /**
   * Get instruments list
   */
  async getInstruments(accessToken: string, exchange?: string) {
    try {
      const url = exchange
        ? `${this.baseUrl}/instruments/${exchange}`
        : `${this.baseUrl}/instruments`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getHeaders(accessToken),
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching instruments', error);
      throw error;
    }
  }

  private getHeaders(accessToken: string) {
    return {
      'Authorization': `token ${accessToken}`,
      'X-Kite-Version': '3',
      'Content-Type': 'application/json',
    };
  }
}
