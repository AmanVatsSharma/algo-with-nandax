import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { getErrorMessage } from '@/common/utils/error.utils';

interface KiteApiResponse<T> {
  status: string;
  data: T;
  message?: string;
  error_type?: string;
}

export interface KiteOrderHistoryEntry {
  order_id: string;
  status: string;
  average_price: number;
  filled_quantity: number;
  pending_quantity: number;
  cancelled_quantity: number;
  order_timestamp?: string;
  exchange_timestamp?: string;
  status_message?: string;
}

export interface KiteOrderEntry {
  order_id: string;
  status: string;
  average_price: number;
  filled_quantity: number;
  pending_quantity: number;
  cancelled_quantity: number;
  order_timestamp?: string;
  exchange_timestamp?: string;
  status_message?: string;
}

export interface KiteTradeEntry {
  order_id: string;
  trade_id?: string;
  quantity: number;
  price?: number;
  average_price?: number;
  fill_timestamp?: string;
  exchange_timestamp?: string;
  order_timestamp?: string;
}

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
    const redirectUrl = this.configService.get<string>('KITE_REDIRECT_URL');

    // Keep verbose logs to simplify integration troubleshooting.
    this.logger.debug(
      `Generating Kite login URL for apiKey=${apiKey} redirectUrl=${redirectUrl ?? 'not-configured'}`,
    );

    if (redirectUrl) {
      return `${this.loginUrl}?api_key=${apiKey}&v=3&redirect_uri=${encodeURIComponent(redirectUrl)}`;
    }

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

      const sessionPayload = new URLSearchParams({
        api_key: apiKey,
        request_token: requestToken,
        checksum,
      });

      const response = await firstValueFrom(
        this.httpService.post<KiteApiResponse<{ access_token: string }>>(
          `${this.baseUrl}/session/token`,
          sessionPayload.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Kite-Version': '3',
            },
          },
        ),
      );

      this.logger.log('Kite session generated successfully');
      return response.data.data;
    } catch (error) {
      this.logKiteError('generateSession', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getProfile(accessToken: string, apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<any>>>(
        this.httpService.get<KiteApiResponse<any>>(`${this.baseUrl}/user/profile`, {
          headers: this.getHeaders(accessToken, apiKey),
          params: { api_key: apiKey },
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logKiteError('getProfile', error);
      throw error;
    }
  }

  /**
   * Get user margins
   */
  async getMargins(accessToken: string, apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<any>>>(
        this.httpService.get<KiteApiResponse<any>>(`${this.baseUrl}/user/margins`, {
          headers: this.getHeaders(accessToken, apiKey),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logKiteError('getMargins', error);
      throw error;
    }
  }

  /**
   * Get positions
   */
  async getPositions(accessToken: string, apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<any>>>(
        this.httpService.get<KiteApiResponse<any>>(`${this.baseUrl}/portfolio/positions`, {
          headers: this.getHeaders(accessToken, apiKey),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logKiteError('getPositions', error);
      throw error;
    }
  }

  /**
   * Get holdings
   */
  async getHoldings(accessToken: string, apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<any>>>(
        this.httpService.get<KiteApiResponse<any>>(`${this.baseUrl}/portfolio/holdings`, {
          headers: this.getHeaders(accessToken, apiKey),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logKiteError('getHoldings', error);
      throw error;
    }
  }

  /**
   * Get orders
   */
  async getOrders(accessToken: string, apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<KiteOrderEntry[]>>>(
        this.httpService.get<KiteApiResponse<KiteOrderEntry[]>>(`${this.baseUrl}/orders`, {
          headers: this.getHeaders(accessToken, apiKey),
        }),
      );
      return response.data.data ?? [];
    } catch (error) {
      this.logKiteError('getOrders', error);
      throw error;
    }
  }

  /**
   * Get trades (tradebook snapshot for current day).
   */
  async getTrades(accessToken: string, apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<KiteTradeEntry[]>>>(
        this.httpService.get<KiteApiResponse<KiteTradeEntry[]>>(`${this.baseUrl}/trades`, {
          headers: this.getHeaders(accessToken, apiKey),
        }),
      );
      return response.data.data ?? [];
    } catch (error) {
      this.logKiteError('getTrades', error);
      throw error;
    }
  }

  /**
   * Get trades for a specific order id.
   */
  async getOrderTrades(accessToken: string, orderId: string, apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<KiteTradeEntry[]>>>(
        this.httpService.get<KiteApiResponse<KiteTradeEntry[]>>(
          `${this.baseUrl}/orders/${orderId}/trades`,
          {
            headers: this.getHeaders(accessToken, apiKey),
          },
        ),
      );
      return response.data.data ?? [];
    } catch (error) {
      this.logKiteError('getOrderTrades', error);
      throw error;
    }
  }

  /**
   * Get order history entries for a specific order id.
   */
  async getOrderHistory(accessToken: string, orderId: string, apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<KiteOrderHistoryEntry[]>>>(
        this.httpService.get<KiteApiResponse<KiteOrderHistoryEntry[]>>(
          `${this.baseUrl}/orders/${orderId}`,
          {
            headers: this.getHeaders(accessToken, apiKey),
          },
        ),
      );

      return response.data.data ?? [];
    } catch (error) {
      this.logKiteError('getOrderHistory', error);
      throw error;
    }
  }

  /**
   * Get latest known order state from order history.
   */
  async getLatestOrderState(accessToken: string, orderId: string, apiKey?: string) {
    const history = await this.getOrderHistory(accessToken, orderId, apiKey);
    if (!history.length) {
      return null;
    }

    return history[history.length - 1];
  }

  /**
   * Place order
   */
  async placeOrder(accessToken: string, apiKey: string, orderData: any) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<{ order_id: string }>>>(
        this.httpService.post<KiteApiResponse<{ order_id: string }>>(
          `${this.baseUrl}/orders/regular`,
          orderData,
          {
            headers: this.getHeaders(accessToken, apiKey),
          },
        ),
      );
      this.logger.log(`Order placed: ${response.data.data.order_id}`);
      return response.data.data;
    } catch (error) {
      this.logKiteError('placeOrder', error);
      throw error;
    }
  }

  /**
   * Modify order
   */
  async modifyOrder(accessToken: string, orderId: string, orderData: any, apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<any>>>(
        this.httpService.put<KiteApiResponse<any>>(
          `${this.baseUrl}/orders/regular/${orderId}`,
          orderData,
          {
            headers: this.getHeaders(accessToken, apiKey),
          },
        ),
      );
      return response.data.data;
    } catch (error) {
      this.logKiteError('modifyOrder', error);
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(
    accessToken: string,
    orderId: string,
    variety: string = 'regular',
    apiKey?: string,
  ) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<any>>>(
        this.httpService.delete<KiteApiResponse<any>>(`${this.baseUrl}/orders/${variety}/${orderId}`, {
          headers: this.getHeaders(accessToken, apiKey),
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logKiteError('cancelOrder', error);
      throw error;
    }
  }

  /**
   * Get quotes for instruments
   */
  async getQuote(accessToken: string, instruments: string[], apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<any>>>(
        this.httpService.get<KiteApiResponse<any>>(`${this.baseUrl}/quote`, {
          headers: this.getHeaders(accessToken, apiKey),
          params: { i: instruments },
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logKiteError('getQuote', error);
      throw error;
    }
  }

  /**
   * Get OHLC data
   */
  async getOHLC(accessToken: string, instruments: string[], apiKey?: string) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<any>>>(
        this.httpService.get<KiteApiResponse<any>>(`${this.baseUrl}/quote/ohlc`, {
          headers: this.getHeaders(accessToken, apiKey),
          params: { i: instruments },
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logKiteError('getOHLC', error);
      throw error;
    }
  }

  /**
   * Get quotes for instruments
   */
  async getHistoricalData(
    accessToken: string,
    instrumentToken: string,
    interval: string,
    fromDate: string,
    toDate: string,
    apiKey?: string,
  ) {
    try {
      const response = await firstValueFrom<AxiosResponse<KiteApiResponse<any>>>(
        this.httpService.get<KiteApiResponse<any>>(
          `${this.baseUrl}/instruments/historical/${instrumentToken}/${interval}`,
          {
            headers: this.getHeaders(accessToken, apiKey),
            params: {
              from: fromDate,
              to: toDate,
            },
          },
        ),
      );
      return response.data.data;
    } catch (error) {
      this.logKiteError('getHistoricalData', error);
      throw error;
    }
  }

  /**
   * Get instruments list
   */
  async getInstruments(accessToken: string, exchange?: string, apiKey?: string) {
    try {
      const url = exchange
        ? `${this.baseUrl}/instruments/${exchange}`
        : `${this.baseUrl}/instruments`;

      const response = await firstValueFrom<AxiosResponse<string>>(
        this.httpService.get<string>(url, {
          headers: this.getHeaders(accessToken, apiKey),
        }),
      );
      return response.data;
    } catch (error) {
      this.logKiteError('getInstruments', error);
      throw error;
    }
  }

  private getHeaders(accessToken: string, apiKey?: string) {
    const resolvedApiKey = apiKey ?? this.configService.get<string>('KITE_API_KEY');

    if (!resolvedApiKey) {
      this.logger.warn(
        'Kite API key is missing while building authorization headers. Requests may fail.',
      );
    }

    return {
      'Authorization': `token ${resolvedApiKey}:${accessToken}`,
      'X-Kite-Version': '3',
      'Content-Type': 'application/json',
    };
  }

  private logKiteError(operation: string, error: unknown) {
    const message = getErrorMessage(error, `Kite operation failed for ${operation}`);
    const statusCode = (error as AxiosError)?.response?.status;
    const responseData = (error as AxiosError)?.response?.data;

    this.logger.error(
      `${operation} failed | status=${statusCode ?? 'n/a'} | message=${message}`,
      JSON.stringify(responseData),
    );
  }
}
