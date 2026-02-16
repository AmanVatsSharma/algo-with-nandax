import { TradingService } from './trading.service';
import { OrderSide, OrderStatus, TradeStatus } from './entities/trade.entity';

describe('TradingService reconcileTrades', () => {
  const tradeRepositoryMock = {
    find: jest.fn(),
  };

  const brokerServiceMock = {
    getKiteLatestOrderState: jest.fn(),
  };

  let service: TradingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TradingService(tradeRepositoryMock as any, brokerServiceMock as any);
  });

  it('marks pending entry trade as executed when broker status is complete', async () => {
    tradeRepositoryMock.find.mockResolvedValue([
      {
        id: 'trade-1',
        userId: 'user-1',
        connectionId: 'conn-1',
        entryOrderId: 'order-1',
        status: TradeStatus.OPEN,
        orderStatus: OrderStatus.PLACED,
        side: OrderSide.BUY,
        entryPrice: 100,
      },
    ]);
    brokerServiceMock.getKiteLatestOrderState.mockResolvedValue({
      status: 'COMPLETE',
      average_price: 101,
    });

    const updateEntryExecutionSpy = jest
      .spyOn(service, 'updateEntryExecution')
      .mockResolvedValue({} as any);

    const result = await service.reconcileTrades('user-1', {});

    expect(updateEntryExecutionSpy).toHaveBeenCalledWith('trade-1', 101, 'order-1');
    expect(result.executed).toBe(1);
    expect(result.failed).toBe(0);
  });
});
