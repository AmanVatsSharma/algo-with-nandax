import { TradingService } from './trading.service';
import { OrderSide, OrderStatus, TradeStatus } from './entities/trade.entity';

describe('TradingService reconcileTrades', () => {
  const tradeRepositoryMock = {
    find: jest.fn(),
  };

  const brokerServiceMock = {
    getKiteLatestOrderState: jest.fn(),
    getKiteOrders: jest.fn(),
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

  it('marks pending entry trade as partially filled when broker reports partial fill', async () => {
    tradeRepositoryMock.find.mockResolvedValue([
      {
        id: 'trade-2',
        userId: 'user-1',
        connectionId: 'conn-1',
        entryOrderId: 'order-2',
        status: TradeStatus.OPEN,
        orderStatus: OrderStatus.PLACED,
        side: OrderSide.BUY,
        entryPrice: 100,
      },
    ]);
    brokerServiceMock.getKiteLatestOrderState.mockResolvedValue({
      status: 'OPEN',
      average_price: 100.5,
      filled_quantity: 4,
      pending_quantity: 6,
    });

    const partialSpy = jest
      .spyOn(service, 'markEntryOrderPartiallyFilled')
      .mockResolvedValue({} as any);

    const result = await service.reconcileTrades('user-1', {});

    expect(partialSpy).toHaveBeenCalledWith(
      'trade-2',
      expect.objectContaining({
        orderId: 'order-2',
        filledQuantity: 4,
        pendingQuantity: 6,
      }),
    );
    expect(result.partiallyFilled).toBe(1);
    expect(result.executed).toBe(0);
  });

  it('reconciles pending trades from single orders snapshot call', async () => {
    tradeRepositoryMock.find.mockResolvedValue([
      {
        id: 'trade-4',
        userId: 'user-1',
        connectionId: 'conn-1',
        entryOrderId: 'order-4',
        status: TradeStatus.OPEN,
        orderStatus: OrderStatus.PLACED,
        side: OrderSide.BUY,
        entryPrice: 100,
      },
    ]);
    brokerServiceMock.getKiteOrders.mockResolvedValue([
      {
        order_id: 'order-4',
        status: 'COMPLETE',
        average_price: 102,
        filled_quantity: 10,
        pending_quantity: 0,
      },
    ]);

    const updateEntryExecutionSpy = jest
      .spyOn(service, 'updateEntryExecution')
      .mockResolvedValue({} as any);

    const result = await service.reconcileTradesFromOrdersSnapshot('user-1', {
      connectionId: 'conn-1',
      maxItems: 50,
    });

    expect(brokerServiceMock.getKiteOrders).toHaveBeenCalledWith('user-1', 'conn-1');
    expect(updateEntryExecutionSpy).toHaveBeenCalledWith('trade-4', 102, 'order-4');
    expect(result.executed).toBe(1);
  });
});
