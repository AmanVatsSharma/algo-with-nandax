import { Injectable, Logger } from '@nestjs/common';
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
  window: number;
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
  private readonly logger = new Logger(BacktestingService.name);

  constructor(private readonly brokerService: BrokerService) {}

  async runBacktest(userId: string, dto: RunBacktestDto) {
    this.logger.log(
      `backtesting-run-start: userId=${userId} instrument=${dto.instrumentToken} interval=${dto.interval}`,
    );
    const historicalData = await this.brokerService.getKiteHistoricalData(
      userId,
      dto.connectionId,
      dto.instrumentToken,
      dto.interval,
      dto.fromDate,
      dto.toDate,
    );

    const candles = this.normalizeCandles(historicalData?.candles ?? []);
    const result = this.simulateStrategy(candles, dto);
    this.logger.log(
      `backtesting-run-complete: userId=${userId} instrument=${dto.instrumentToken} totalTrades=${result.summary.totalTrades} totalPnL=${result.summary.totalPnL.toFixed(2)}`,
    );
    return result;
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
    const slippageBps = dto.slippageBps ?? 0;
    const stopLossPercent = dto.stopLossPercent ?? 0;
    const takeProfitPercent = dto.takeProfitPercent ?? 0;
    const walkForwardWindows = dto.walkForwardWindows ?? 1;
    const initialCapital = dto.initialCapital ?? 0;

    if (candles.length < 2) {
      return {
        summary: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          totalPnL: 0,
          maxDrawdown: 0,
          endingEquity: initialCapital,
        },
        configUsed: {
          quantity,
          entryThresholdPercent,
          exitThresholdPercent,
          feePerTrade,
          slippageBps,
          stopLossPercent,
          takeProfitPercent,
          walkForwardWindows,
          initialCapital,
        },
        trades: [],
        equityCurve: [],
        windows: [],
      };
    }

    const windows = this.createWalkForwardWindows(candles, walkForwardWindows);
    const allTrades: SimulatedTrade[] = [];
    const allEquityCurve: Array<{ timestamp: string; equity: number }> = [];
    const windowSummaries: Array<Record<string, unknown>> = [];
    let cumulativePnL = 0;

    windows.forEach((windowCandles, index) => {
      const windowResult = this.simulateSingleWindow({
        candles: windowCandles,
        quantity,
        entryThresholdPercent,
        exitThresholdPercent,
        feePerTrade,
        slippageBps,
        stopLossPercent,
        takeProfitPercent,
        cumulativePnL,
        windowNumber: index + 1,
      });

      cumulativePnL += windowResult.windowPnL;
      allTrades.push(...windowResult.trades);
      allEquityCurve.push(...windowResult.equityCurve);
      windowSummaries.push({
        window: index + 1,
        candleCount: windowCandles.length,
        totalTrades: windowResult.trades.length,
        windowPnL: windowResult.windowPnL,
      });
    });

    const totalPnL = allTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const winningTrades = allTrades.filter((trade) => trade.pnl > 0).length;
    const losingTrades = allTrades.filter((trade) => trade.pnl < 0).length;
    const totalTrades = allTrades.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const maxDrawdown = this.calculateMaxDrawdown(allEquityCurve, initialCapital);

    return {
      summary: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalPnL,
        maxDrawdown,
        endingEquity: initialCapital + totalPnL,
      },
      configUsed: {
        quantity,
        entryThresholdPercent,
        exitThresholdPercent,
        feePerTrade,
        slippageBps,
        stopLossPercent,
        takeProfitPercent,
        walkForwardWindows,
        initialCapital,
      },
      trades: allTrades,
      equityCurve: allEquityCurve,
      windows: windowSummaries,
    };
  }

  private simulateSingleWindow(input: {
    candles: Candle[];
    quantity: number;
    entryThresholdPercent: number;
    exitThresholdPercent: number;
    feePerTrade: number;
    slippageBps: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    cumulativePnL: number;
    windowNumber: number;
  }) {
    const trades: SimulatedTrade[] = [];
    const equityCurve: Array<{ timestamp: string; equity: number }> = [];
    let runningPnL = input.cumulativePnL;
    let windowPnL = 0;
    const slippageRate = input.slippageBps / 10_000;

    // Track one active position for deterministic baseline simulation.
    let position: {
      side: 'buy' | 'sell';
      entryPrice: number;
      entryTime: string;
    } | null = null;

    for (let index = 1; index < input.candles.length; index++) {
      const prev = input.candles[index - 1];
      const current = input.candles[index];
      const changePercent = ((current.close - prev.close) / prev.close) * 100;

      if (!position) {
        if (changePercent >= input.entryThresholdPercent) {
          position = {
            side: 'buy',
            entryPrice: current.close * (1 + slippageRate),
            entryTime: current.timestamp,
          };
          continue;
        }

        if (changePercent <= -input.entryThresholdPercent) {
          position = {
            side: 'sell',
            entryPrice: current.close * (1 - slippageRate),
            entryTime: current.timestamp,
          };
          continue;
        }
      } else {
        const positionPnlPercent =
          position.side === 'buy'
            ? ((current.close - position.entryPrice) / position.entryPrice) * 100
            : ((position.entryPrice - current.close) / position.entryPrice) * 100;

        const isStopLossTriggered =
          input.stopLossPercent > 0 && positionPnlPercent <= -input.stopLossPercent;
        const isTakeProfitTriggered =
          input.takeProfitPercent > 0 && positionPnlPercent >= input.takeProfitPercent;
        const shouldExit =
          Math.abs(positionPnlPercent) >= input.exitThresholdPercent ||
          isStopLossTriggered ||
          isTakeProfitTriggered ||
          index === input.candles.length - 1;

        if (shouldExit) {
          const exitPrice =
            position.side === 'buy'
              ? current.close * (1 - slippageRate)
              : current.close * (1 + slippageRate);
          const grossPnl =
            position.side === 'buy'
              ? (exitPrice - position.entryPrice) * input.quantity
              : (position.entryPrice - exitPrice) * input.quantity;
          const netPnl = grossPnl - input.feePerTrade;

          trades.push({
            window: input.windowNumber,
            side: position.side,
            entryPrice: position.entryPrice,
            exitPrice,
            quantity: input.quantity,
            pnl: netPnl,
            entryTime: position.entryTime,
            exitTime: current.timestamp,
          });

          runningPnL += netPnl;
          windowPnL += netPnl;
          equityCurve.push({ timestamp: current.timestamp, equity: runningPnL });

          position = null;
        }
      }
    }

    return {
      trades,
      equityCurve,
      windowPnL,
    };
  }

  private createWalkForwardWindows(candles: Candle[], requestedWindows: number): Candle[][] {
    const safeWindows = Math.min(Math.max(requestedWindows, 1), Math.max(candles.length - 1, 1));
    if (safeWindows === 1) {
      return [candles];
    }

    const windows: Candle[][] = [];
    const chunkSize = Math.max(Math.floor(candles.length / safeWindows), 2);
    let cursor = 0;

    while (cursor < candles.length) {
      const window = candles.slice(cursor, cursor + chunkSize);
      if (window.length >= 2) {
        windows.push(window);
      }
      cursor += chunkSize;
    }

    if (!windows.length) {
      return [candles];
    }

    const lastWindow = windows[windows.length - 1];
    if (lastWindow.length < 2 && windows.length > 1) {
      windows[windows.length - 2] = [...windows[windows.length - 2], ...lastWindow];
      windows.pop();
    }

    return windows;
  }

  private calculateMaxDrawdown(
    equityCurve: Array<{ timestamp: string; equity: number }>,
    initialCapital: number,
  ) {
    let peakEquity = initialCapital;
    let maxDrawdown = 0;

    for (const point of equityCurve) {
      peakEquity = Math.max(peakEquity, point.equity);
      maxDrawdown = Math.max(maxDrawdown, peakEquity - point.equity);
    }

    return maxDrawdown;
  }
}
