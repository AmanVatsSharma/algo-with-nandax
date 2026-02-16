import { TradingService } from './trading.service';
import { OrderSide, OrderStatus, TradeStatus } from './entities/trade.entity';

describe('TradingService reconcileTrades', () => {
  const tradeRepositoryMock = {
    find: jest.fn(),
  };

  const brokerServiceMock = {
    getKiteLatestOrderState: jest.fn(),
    getKiteOrders: jest.fn(),
    getKiteTrades: jest.fn(),
    getKiteOrderTrades: jest.fn(),
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
    brokerServiceMock.getKiteOrderTrades.mockResolvedValue([
      {
        order_id: 'order-1',
        quantity: 10,
        price: 101,
      },
    ]);

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
    brokerServiceMock.getKiteOrderTrades.mockResolvedValue([
      {
        order_id: 'order-2',
        quantity: 4,
        price: 100.5,
      },
    ]);

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
    brokerServiceMock.getKiteTrades.mockResolvedValue([
      {
        order_id: 'order-4',
        quantity: 6,
        price: 101.5,
      },
      {
        order_id: 'order-4',
        quantity: 4,
        price: 102.75,
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
    expect(updateEntryExecutionSpy).toHaveBeenCalledWith('trade-4', expect.any(Number), 'order-4');
    const resolvedPrice = updateEntryExecutionSpy.mock.calls[0]?.[1] as number;
    expect(resolvedPrice).toBeCloseTo(102, 5);
    expect(result.executed).toBe(1);
    expect(brokerServiceMock.getKiteTrades).toHaveBeenCalledWith('user-1', 'conn-1');
  });

  it('uses tradebook snapshot to enrich partial fill quantities and price', async () => {
    tradeRepositoryMock.find.mockResolvedValue([
      {
        id: 'trade-5',
        userId: 'user-1',
        connectionId: 'conn-1',
        entryOrderId: 'order-5',
        status: TradeStatus.OPEN,
        orderStatus: OrderStatus.PLACED,
        side: OrderSide.BUY,
        entryPrice: 100,
      },
    ]);
    brokerServiceMock.getKiteOrders.mockResolvedValue([
      {
        order_id: 'order-5',
        status: 'OPEN',
        average_price: 0,
        filled_quantity: 2,
        pending_quantity: 8,
      },
    ]);
    brokerServiceMock.getKiteTrades.mockResolvedValue([
      {
        order_id: 'order-5',
        quantity: 1,
        price: 101,
      },
      {
        order_id: 'order-5',
        quantity: 3,
        price: 102,
      },
    ]);

    const partialSpy = jest
      .spyOn(service, 'markEntryOrderPartiallyFilled')
      .mockResolvedValue({} as any);

    const result = await service.reconcileTradesFromOrdersSnapshot('user-1', {
      connectionId: 'conn-1',
      maxItems: 50,
    });

    expect(partialSpy).toHaveBeenCalledWith(
      'trade-5',
      expect.objectContaining({
        orderId: 'order-5',
        filledQuantity: 4,
        pendingQuantity: 6,
      }),
    );
    const avgPrice = partialSpy.mock.calls[0]?.[1]?.averagePrice as number;
    expect(avgPrice).toBeCloseTo(101.75, 5);
    expect(result.partiallyFilled).toBe(1);
  });
});
