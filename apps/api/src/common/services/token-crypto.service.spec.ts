import { ConfigService } from '@nestjs/config';
import { TokenCryptoService } from './token-crypto.service';

describe('TokenCryptoService', () => {
  it('encrypts and decrypts token values', () => {
    const configService = {
      get: jest.fn((key: string) => (key === 'ENCRYPTION_KEY' ? 'strong-key-1234567890' : undefined)),
    } as unknown as ConfigService;

    const service = new TokenCryptoService(configService);
    const cipherText = service.encrypt('sensitive-token');

    expect(cipherText).not.toEqual('sensitive-token');
    expect(service.decrypt(cipherText)).toEqual('sensitive-token');
  });
});
