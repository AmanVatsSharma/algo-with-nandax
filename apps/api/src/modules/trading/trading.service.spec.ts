import { TradingService } from './trading.service';
import { OrderSide } from './entities/trade.entity';

describe('TradingService PnL direction', () => {
  let service: TradingService;

  beforeEach(() => {
    service = new TradingService({} as any, {} as any);
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

describe('TradingService partial fill rollups', () => {
  const tradeRepositoryMock = {
    findOne: jest.fn(),
    update: jest.fn(async () => ({ affected: 1 })),
  };

  let service: TradingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TradingService(tradeRepositoryMock as any, {} as any);
  });

  it('appends entry fill rollup metadata on partial fill updates', async () => {
    tradeRepositoryMock.findOne
      .mockResolvedValueOnce({
        id: 'trade-1',
        quantity: 10,
        metadata: {},
      })
      .mockResolvedValueOnce({
        id: 'trade-1',
        quantity: 10,
        metadata: {},
      });

    await service.markEntryOrderPartiallyFilled('trade-1', {
      orderId: 'order-1',
      averagePrice: 101.5,
      filledQuantity: 4,
      pendingQuantity: 6,
      statusMessage: 'OPEN',
    });

    expect(tradeRepositoryMock.update).toHaveBeenCalledTimes(1);
    const updatePayload = (tradeRepositoryMock.update as jest.Mock).mock.lastCall?.[1] as any;
    expect(updatePayload.metadata.entryFillState.filledQuantity).toBe(4);
    expect(updatePayload.metadata.entryFillRollup).toHaveLength(1);
    expect(updatePayload.metadata.entryFillRollup[0].deltaFilledQuantity).toBe(4);
  });

  it('records completion rollup snapshot on entry execution', async () => {
    tradeRepositoryMock.findOne
      .mockResolvedValueOnce({
        id: 'trade-2',
        quantity: 12,
        metadata: {
          entryFillState: {
            orderId: 'order-2',
            filledQuantity: 5,
            pendingQuantity: 7,
          },
          entryFillRollup: [],
        },
      })
      .mockResolvedValueOnce({
        id: 'trade-2',
        quantity: 12,
        metadata: {},
      });

    await service.updateEntryExecution('trade-2', 102.25, 'order-2');

    expect(tradeRepositoryMock.update).toHaveBeenCalledTimes(1);
    const updatePayload = (tradeRepositoryMock.update as jest.Mock).mock.lastCall?.[1] as any;
    expect(updatePayload.metadata.entryFillState.pendingQuantity).toBe(0);
    expect(updatePayload.metadata.entryFillState.filledQuantity).toBe(12);
    expect(updatePayload.metadata.entryFillRollup[0].deltaFilledQuantity).toBe(7);
  });
});
