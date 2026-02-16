import { TradeExecutor } from './trade-executor.service';
import { OrderSide, OrderType } from '../entities/trade.entity';

describe('TradeExecutor paper trade', () => {
  const queueMock = {
    add: jest.fn(),
  };

  const tradingServiceMock = {
    create: jest.fn(),
    updateEntryExecution: jest.fn(),
    findById: jest.fn(),
    findByIdAndUser: jest.fn(),
  };

  let executor: TradeExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new TradeExecutor(queueMock as any, tradingServiceMock as any);
  });

  it('creates and marks paper trade as executed', async () => {
    tradingServiceMock.create.mockResolvedValue({ id: 'trade-1' });
    tradingServiceMock.updateEntryExecution.mockResolvedValue({});
    tradingServiceMock.findById.mockResolvedValue({ id: 'trade-1', metadata: { paperTrade: true } });

    const result = await executor.executePaperTrade('user-1', 'agent-1', 'connection-1', {
      symbol: 'NSE:SBIN',
      side: OrderSide.BUY,
      quantity: 10,
      orderType: OrderType.MARKET,
      price: 500,
    });

    expect(tradingServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        agentId: 'agent-1',
        connectionId: 'connection-1',
      }),
    );
    expect(tradingServiceMock.updateEntryExecution).toHaveBeenCalled();
    expect(result.id).toBe('trade-1');
  });
});
