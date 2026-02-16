import { TradingProcessor } from './trading.processor';
import { OrderStatus } from '../entities/trade.entity';

describe('TradingProcessor order status mapping', () => {
  let processor: TradingProcessor;

  beforeEach(() => {
    processor = new TradingProcessor({} as any, {} as any);
  });

  it('maps COMPLETE to EXECUTED', () => {
    const status = (processor as any).mapKiteOrderStatus('COMPLETE');
    expect(status).toBe(OrderStatus.EXECUTED);
  });

  it('maps REJECTED to REJECTED', () => {
    const status = (processor as any).mapKiteOrderStatus('REJECTED');
    expect(status).toBe(OrderStatus.REJECTED);
  });

  it('maps OPEN to PLACED', () => {
    const status = (processor as any).mapKiteOrderStatus('OPEN');
    expect(status).toBe(OrderStatus.PLACED);
  });

  it('detects partial fill from open order state', () => {
    const partial = (processor as any).isKitePartiallyFilled({
      status: 'OPEN',
      filled_quantity: 3,
      pending_quantity: 7,
    });
    expect(partial).toBe(true);
  });
});
