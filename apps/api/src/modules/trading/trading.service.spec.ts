import { TradingService } from './trading.service';
import { OrderSide } from './entities/trade.entity';

describe('TradingService PnL direction', () => {
  let service: TradingService;

  beforeEach(() => {
    service = new TradingService({} as any);
  });

  it('calculates BUY pnl as exit minus entry', () => {
    const pnl = (service as any).calculatePnL(OrderSide.BUY, 100, 110, 5);
    expect(pnl).toBe(50);
  });

  it('calculates SELL pnl as entry minus exit', () => {
    const pnl = (service as any).calculatePnL(OrderSide.SELL, 110, 100, 5);
    expect(pnl).toBe(50);
  });
});
