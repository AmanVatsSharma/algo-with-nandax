import { Injectable } from '@nestjs/common';
import { BrokerService } from '../broker/broker.service';
import { RunBacktestDto } from './dto/run-backtest.dto';

interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SimulatedTrade {
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  entryTime: string;
  exitTime: string;
}

@Injectable()
export class BacktestingService {
  constructor(private readonly brokerService: BrokerService) {}

  async runBacktest(userId: string, dto: RunBacktestDto) {
    const historicalData = await this.brokerService.getKiteHistoricalData(
      userId,
      dto.connectionId,
      dto.instrumentToken,
      dto.interval,
      dto.fromDate,
      dto.toDate,
    );

    const candles = this.normalizeCandles(historicalData?.candles ?? []);
    return this.simulateStrategy(candles, dto);
  }

  private normalizeCandles(rawCandles: any[]): Candle[] {
    return rawCandles
      .map((row) => ({
        timestamp: String(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5] ?? 0),
      }))
      .filter((candle) => Number.isFinite(candle.close) && candle.close > 0);
  }

  private simulateStrategy(candles: Candle[], dto: RunBacktestDto) {
    const quantity = dto.quantity ?? 1;
    const entryThresholdPercent = dto.entryThresholdPercent ?? 0.4;
    const exitThresholdPercent = dto.exitThresholdPercent ?? 0.2;
    const feePerTrade = dto.feePerTrade ?? 0;

    const trades: SimulatedTrade[] = [];
    const equityCurve: Array<{ timestamp: string; equity: number }> = [];

    let runningPnL = 0;
    let peakEquity = 0;
    let maxDrawdown = 0;

    let position: {
      side: 'buy' | 'sell';
      entryPrice: number;
      entryTime: string;
    } | null = null;

    for (let index = 1; index < candles.length; index++) {
      const prev = candles[index - 1];
      const current = candles[index];
      const changePercent = ((current.close - prev.close) / prev.close) * 100;

      if (!position) {
        if (changePercent >= entryThresholdPercent) {
          position = {
            side: 'buy',
            entryPrice: current.close,
            entryTime: current.timestamp,
          };
          continue;
        }

        if (changePercent <= -entryThresholdPercent) {
          position = {
            side: 'sell',
            entryPrice: current.close,
            entryTime: current.timestamp,
          };
          continue;
        }
      } else {
        const positionPnlPercent =
          position.side === 'buy'
            ? ((current.close - position.entryPrice) / position.entryPrice) * 100
            : ((position.entryPrice - current.close) / position.entryPrice) * 100;

        const shouldExit =
          Math.abs(positionPnlPercent) >= exitThresholdPercent || index === candles.length - 1;

        if (shouldExit) {
          const grossPnl =
            position.side === 'buy'
              ? (current.close - position.entryPrice) * quantity
              : (position.entryPrice - current.close) * quantity;
          const netPnl = grossPnl - feePerTrade;

          trades.push({
            side: position.side,
            entryPrice: position.entryPrice,
            exitPrice: current.close,
            quantity,
            pnl: netPnl,
            entryTime: position.entryTime,
            exitTime: current.timestamp,
          });

          runningPnL += netPnl;
          peakEquity = Math.max(peakEquity, runningPnL);
          maxDrawdown = Math.max(maxDrawdown, peakEquity - runningPnL);
          equityCurve.push({ timestamp: current.timestamp, equity: runningPnL });

          position = null;
        }
      }
    }

    const winningTrades = trades.filter((trade) => trade.pnl > 0).length;
    const losingTrades = trades.filter((trade) => trade.pnl < 0).length;
    const totalTrades = trades.length;
    const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      summary: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalPnL,
        maxDrawdown,
      },
      configUsed: {
        quantity,
        entryThresholdPercent,
        exitThresholdPercent,
        feePerTrade,
      },
      trades,
      equityCurve,
    };
  }
}
