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
});
