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
});
