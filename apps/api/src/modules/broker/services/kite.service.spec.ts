import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { KiteService } from './kite.service';

describe('KiteService', () => {
  let service: KiteService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    httpService = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<HttpService>;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'KITE_REDIRECT_URL') {
          return 'http://localhost:3000/auth/kite/callback';
        }
        if (key === 'KITE_API_KEY') {
          return 'default-api-key';
        }
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new KiteService(httpService, configService);
  });

  it('builds login URL with redirect_uri when configured', () => {
    const url = service.generateLoginUrl('test-key');

    expect(url).toContain('api_key=test-key');
    expect(url).toContain('v=3');
    expect(url).toContain(
      encodeURIComponent('http://localhost:3000/auth/kite/callback'),
    );
  });

  it('sends form-encoded session payload', async () => {
    httpService.post.mockReturnValue(
      of({
        data: {
          status: 'success',
          data: {
            access_token: 'test-access-token',
          },
        },
      } as any),
    );

    const result = await service.generateSession('api-key', 'request-token', 'api-secret');

    expect(httpService.post).toHaveBeenCalledTimes(1);
    const [, payload, config] = httpService.post.mock.calls[0];
    expect(payload).toContain('api_key=api-key');
    expect(payload).toContain('request_token=request-token');
    expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(result.access_token).toBe('test-access-token');
  });

  it('fetches tradebook snapshot from /trades endpoint', async () => {
    httpService.get.mockReturnValue(
      of({
        data: {
          status: 'success',
          data: [{ order_id: 'order-1', quantity: 2, price: 101 }],
        },
      } as any),
    );

    const result = await service.getTrades('access-token', 'api-key');

    expect(httpService.get).toHaveBeenCalledWith(
      expect.stringContaining('/trades'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'token api-key:access-token',
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('fetches order trades from /orders/:id/trades endpoint', async () => {
    httpService.get.mockReturnValue(
      of({
        data: {
          status: 'success',
          data: [{ order_id: 'order-2', quantity: 5, price: 100.25 }],
        },
      } as any),
    );

    const result = await service.getOrderTrades('access-token', 'order-2', 'api-key');

    expect(httpService.get).toHaveBeenCalledWith(
      expect.stringContaining('/orders/order-2/trades'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'token api-key:access-token',
        }),
      }),
    );
    expect(result[0].order_id).toBe('order-2');
  });
});
