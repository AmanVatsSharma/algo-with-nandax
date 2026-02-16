import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BrokerService } from '../broker/broker.service';
import { RunBacktestDto } from './dto/run-backtest.dto';
import { RunPortfolioBacktestDto } from './dto/run-portfolio-backtest.dto';
import { OptimizeBacktestDto } from './dto/optimize-backtest.dto';
import { OptimizePortfolioBacktestDto } from './dto/optimize-portfolio-backtest.dto';

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
  impactCost: number;
  entryTime: string;
  exitTime: string;
}

interface PortfolioTrade extends SimulatedTrade {
  instrumentToken: string;
  weight: number;
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

  async runPortfolioBacktest(userId: string, dto: RunPortfolioBacktestDto) {
    const uniqueTokens = Array.from(
      new Set((dto.instrumentTokens ?? []).map((token) => token.trim()).filter(Boolean)),
    );
    if (!uniqueTokens.length) {
      throw new BadRequestException('At least one instrument token is required');
    }

    const initialCapital = dto.initialCapital ?? 100000;
    const normalizedWeights = this.normalizeWeights(uniqueTokens, dto.weights);

    this.logger.log(
      `backtesting-portfolio-start: userId=${userId} instruments=${uniqueTokens.length} interval=${dto.interval} initialCapital=${initialCapital}`,
    );

    const portfolioTrades: PortfolioTrade[] = [];
    const instrumentSummaries: Array<Record<string, unknown>> = [];

    for (let index = 0; index < uniqueTokens.length; index++) {
      const instrumentToken = uniqueTokens[index];
      const weight = normalizedWeights[index];
      const historicalData = await this.brokerService.getKiteHistoricalData(
        userId,
        dto.connectionId,
        instrumentToken,
        dto.interval,
        dto.fromDate,
        dto.toDate,
      );
      const candles = this.normalizeCandles(historicalData?.candles ?? []);
      const allocatedCapital = initialCapital * weight;
      const derivedQuantity =
        dto.quantity ??
        this.deriveQuantityFromCapital(candles[0]?.close ?? 0, allocatedCapital);

      const instrumentResult = this.simulateStrategy(candles, {
        connectionId: dto.connectionId,
        instrumentToken,
        interval: dto.interval,
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        quantity: derivedQuantity,
        entryThresholdPercent: dto.entryThresholdPercent,
        exitThresholdPercent: dto.exitThresholdPercent,
        feePerTrade: dto.feePerTrade,
        slippageBps: dto.slippageBps,
        stopLossPercent: dto.stopLossPercent,
        takeProfitPercent: dto.takeProfitPercent,
        walkForwardWindows: dto.walkForwardWindows,
        initialCapital: allocatedCapital,
        impactBps: dto.impactBps,
        maxParticipationRate: dto.maxParticipationRate,
        impactModel: dto.impactModel,
        impactVolatilityWeight: dto.impactVolatilityWeight,
      });

      instrumentSummaries.push({
        instrumentToken,
        weight,
        allocatedCapital,
        ...instrumentResult.summary,
      });

      const taggedTrades = instrumentResult.trades.map((trade) => ({
        ...trade,
        instrumentToken,
        weight,
      }));
      portfolioTrades.push(...taggedTrades);
    }

    const sortedTrades = [...portfolioTrades].sort((left, right) =>
      left.exitTime.localeCompare(right.exitTime),
    );
    const totalPnL = sortedTrades.reduce((sum, trade) => sum + Number(trade.pnl ?? 0), 0);
    const totalImpactCost = sortedTrades.reduce(
      (sum, trade) => sum + Number(trade.impactCost ?? 0),
      0,
    );
    const winningTrades = sortedTrades.filter((trade) => trade.pnl > 0).length;
    const losingTrades = sortedTrades.filter((trade) => trade.pnl < 0).length;
    const totalTrades = sortedTrades.length;
    const winRate = totalTrades ? (winningTrades / totalTrades) * 100 : 0;

    const equityCurve = this.buildPortfolioEquityCurve(sortedTrades, initialCapital);
    const maxDrawdown = this.calculateMaxDrawdownFromPortfolioCurve(equityCurve, initialCapital);

    this.logger.log(
      `backtesting-portfolio-complete: userId=${userId} instruments=${uniqueTokens.length} totalTrades=${totalTrades} totalPnL=${totalPnL.toFixed(2)}`,
    );

    return {
      summary: {
        instrumentsTested: uniqueTokens.length,
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalPnL,
        maxDrawdown,
        totalImpactCost,
        initialCapital,
        endingEquity: initialCapital + totalPnL,
      },
      configUsed: {
        interval: dto.interval,
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        entryThresholdPercent: dto.entryThresholdPercent ?? 0.4,
        exitThresholdPercent: dto.exitThresholdPercent ?? 0.2,
        feePerTrade: dto.feePerTrade ?? 0,
        slippageBps: dto.slippageBps ?? 0,
        stopLossPercent: dto.stopLossPercent ?? 0,
        takeProfitPercent: dto.takeProfitPercent ?? 0,
        walkForwardWindows: dto.walkForwardWindows ?? 1,
        initialCapital,
        impactBps: dto.impactBps ?? 0,
        maxParticipationRate: dto.maxParticipationRate ?? 0,
        impactModel: dto.impactModel ?? 'linear',
        impactVolatilityWeight: dto.impactVolatilityWeight ?? 0,
      },
      instruments: instrumentSummaries,
      trades: sortedTrades,
      equityCurve,
    };
  }

  async optimizeBacktest(userId: string, dto: OptimizeBacktestDto) {
    const historicalData = await this.brokerService.getKiteHistoricalData(
      userId,
      dto.connectionId,
      dto.instrumentToken,
      dto.interval,
      dto.fromDate,
      dto.toDate,
    );
    const candles = this.normalizeCandles(historicalData?.candles ?? []);
    const entryCandidates = this.normalizeThresholdCandidates(
      dto.entryThresholdCandidates,
      [0.2, 0.3, 0.4, 0.5, 0.6],
    );
    const exitCandidates = this.normalizeThresholdCandidates(
      dto.exitThresholdCandidates,
      [0.15, 0.2, 0.25, 0.3, 0.35],
    );
    const topN = Math.min(Math.max(dto.topN ?? 5, 1), 30);

    const combinations: Array<Record<string, unknown>> = [];
    for (const entryThresholdPercent of entryCandidates) {
      for (const exitThresholdPercent of exitCandidates) {
        const result = this.simulateStrategy(candles, {
          connectionId: dto.connectionId,
          instrumentToken: dto.instrumentToken,
          interval: dto.interval,
          fromDate: dto.fromDate,
          toDate: dto.toDate,
          quantity: dto.quantity,
          feePerTrade: dto.feePerTrade,
          slippageBps: dto.slippageBps,
          stopLossPercent: dto.stopLossPercent,
          takeProfitPercent: dto.takeProfitPercent,
          walkForwardWindows: dto.walkForwardWindows,
          initialCapital: dto.initialCapital,
          impactBps: dto.impactBps,
          maxParticipationRate: dto.maxParticipationRate,
          impactModel: dto.impactModel,
          impactVolatilityWeight: dto.impactVolatilityWeight,
          entryThresholdPercent,
          exitThresholdPercent,
        });

        const score = Number(result.summary.totalPnL ?? 0) - Number(result.summary.maxDrawdown ?? 0) * 0.15;
        combinations.push({
          entryThresholdPercent,
          exitThresholdPercent,
          score,
          summary: result.summary,
        });
      }
    }

    const ranked = combinations.sort(
      (left, right) => Number(right.score) - Number(left.score),
    );
    const topStrategies = ranked.slice(0, topN);

    return {
      evaluatedCombinations: combinations.length,
      topStrategies,
      bestStrategy: topStrategies[0] ?? null,
      configUsed: {
        instrumentToken: dto.instrumentToken,
        interval: dto.interval,
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        topN,
        entryCandidates,
        exitCandidates,
        impactBps: dto.impactBps ?? 0,
        maxParticipationRate: dto.maxParticipationRate ?? 0,
        impactModel: dto.impactModel ?? 'linear',
        impactVolatilityWeight: dto.impactVolatilityWeight ?? 0,
      },
    };
  }

  async optimizePortfolioBacktest(userId: string, dto: OptimizePortfolioBacktestDto) {
    const uniqueTokens = Array.from(
      new Set((dto.instrumentTokens ?? []).map((token) => token.trim()).filter(Boolean)),
    );
    if (uniqueTokens.length < 2) {
      throw new BadRequestException('At least two unique instrument tokens are required');
    }

    const topN = Math.min(Math.max(dto.topN ?? 5, 1), 10);
    const candidateWeights = this.generateConstrainedPortfolioWeightCandidates(
      uniqueTokens.length,
      {
        minWeightPercent: dto.minWeightPercent,
        maxWeightPercent: dto.maxWeightPercent,
        maxActiveInstruments: dto.maxActiveInstruments,
        candidateCount: dto.candidateCount,
      },
    );

    const evaluations: Array<Record<string, unknown>> = [];
    for (const weights of candidateWeights) {
      const runResult = await this.runPortfolioBacktest(userId, {
        connectionId: dto.connectionId,
        instrumentTokens: uniqueTokens,
        weights,
        interval: dto.interval,
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        quantity: dto.quantity,
        entryThresholdPercent: 0.4,
        exitThresholdPercent: 0.2,
        feePerTrade: dto.feePerTrade,
        slippageBps: dto.slippageBps,
        impactBps: dto.impactBps,
        maxParticipationRate: dto.maxParticipationRate,
        impactModel: dto.impactModel,
        impactVolatilityWeight: dto.impactVolatilityWeight,
        stopLossPercent: dto.stopLossPercent,
        takeProfitPercent: dto.takeProfitPercent,
        walkForwardWindows: dto.walkForwardWindows,
        initialCapital: dto.initialCapital,
      });

      const score =
        Number(runResult.summary.totalPnL ?? 0) -
        Number(runResult.summary.maxDrawdown ?? 0) * 0.2;
      evaluations.push({
        weights,
        score,
        summary: runResult.summary,
      });
    }

    const ranked = evaluations.sort((left, right) => Number(right.score) - Number(left.score));
    const topPortfolios = ranked.slice(0, topN);

    return {
      evaluatedPortfolios: evaluations.length,
      topPortfolios,
      bestPortfolio: topPortfolios[0] ?? null,
      configUsed: {
        instrumentTokens: uniqueTokens,
        interval: dto.interval,
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        topN,
        candidatePortfolioCount: candidateWeights.length,
        minWeightPercent: dto.minWeightPercent ?? 0,
        maxWeightPercent: dto.maxWeightPercent ?? 100,
        maxActiveInstruments: dto.maxActiveInstruments ?? uniqueTokens.length,
        candidateCount: dto.candidateCount ?? 120,
        impactModel: dto.impactModel ?? 'linear',
        impactVolatilityWeight: dto.impactVolatilityWeight ?? 0,
      },
    };
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
    const impactBps = dto.impactBps ?? 0;
    const maxParticipationRate = dto.maxParticipationRate ?? 0;
    const impactModel = dto.impactModel ?? 'linear';
    const impactVolatilityWeight = dto.impactVolatilityWeight ?? 0;

    if (candles.length < 2) {
      return {
        summary: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          totalPnL: 0,
          maxDrawdown: 0,
          totalImpactCost: 0,
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
          impactBps,
          maxParticipationRate,
          impactModel,
          impactVolatilityWeight,
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
        impactBps,
        maxParticipationRate,
        impactModel,
        impactVolatilityWeight,
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
    const totalImpactCost = allTrades.reduce((sum, trade) => sum + Number(trade.impactCost ?? 0), 0);

    return {
      summary: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalPnL,
        maxDrawdown,
        totalImpactCost,
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
        impactBps,
        maxParticipationRate,
        impactModel,
        impactVolatilityWeight,
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
    impactBps: number;
    maxParticipationRate: number;
    impactModel: 'linear' | 'square_root';
    impactVolatilityWeight: number;
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
          const impactCost = this.calculateImpactCost({
            entryPrice: position.entryPrice,
            exitPrice,
            quantity: input.quantity,
            candleVolume: Number(current.volume ?? 0),
            impactBps: input.impactBps,
            maxParticipationRate: input.maxParticipationRate,
            impactModel: input.impactModel,
            impactVolatilityWeight: input.impactVolatilityWeight,
            candleRangePercent: this.deriveCandleRangePercent(current),
          });
          const netPnl = grossPnl - input.feePerTrade - impactCost;

          trades.push({
            window: input.windowNumber,
            side: position.side,
            entryPrice: position.entryPrice,
            exitPrice,
            quantity: input.quantity,
            pnl: netPnl,
            impactCost,
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

  private calculateImpactCost(input: {
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    candleVolume: number;
    impactBps: number;
    maxParticipationRate: number;
    impactModel: 'linear' | 'square_root';
    impactVolatilityWeight: number;
    candleRangePercent: number;
  }) {
    const baseImpactRate = Math.max(input.impactBps, 0) / 10_000;
    if (baseImpactRate <= 0) {
      return 0;
    }

    const tradedNotional = (Math.abs(input.entryPrice) + Math.abs(input.exitPrice)) * input.quantity;
    const participationRate =
      input.candleVolume > 0 ? Math.max(input.quantity / input.candleVolume, 0) : 0;
    const normalizedParticipation =
      input.maxParticipationRate > 0
        ? participationRate / input.maxParticipationRate
        : participationRate;
    const linearMultiplier = 1 + Math.max(normalizedParticipation - 1, 0);
    const squareRootMultiplier = 1 + Math.sqrt(Math.max(normalizedParticipation, 0));
    const modelMultiplier =
      input.impactModel === 'square_root' ? squareRootMultiplier : linearMultiplier;
    const volatilityMultiplier =
      1 + Math.max(input.impactVolatilityWeight, 0) * Math.max(input.candleRangePercent, 0);

    return tradedNotional * baseImpactRate * modelMultiplier * volatilityMultiplier;
  }

  private normalizeWeights(tokens: string[], providedWeights?: number[]) {
    if (!providedWeights?.length) {
      const equalWeight = 1 / tokens.length;
      return tokens.map(() => equalWeight);
    }

    if (providedWeights.length !== tokens.length) {
      throw new BadRequestException(
        'weights length must match instrumentTokens length when provided',
      );
    }

    const cleanWeights = providedWeights.map((weight) => Number(weight));
    if (cleanWeights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
      throw new BadRequestException('All weights must be non-negative numbers');
    }

    const totalWeight = cleanWeights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) {
      throw new BadRequestException('weights must sum to a positive value');
    }

    return cleanWeights.map((weight) => weight / totalWeight);
  }

  private deriveQuantityFromCapital(referencePrice: number, allocatedCapital: number) {
    if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
      return 1;
    }
    const quantity = Math.floor(allocatedCapital / referencePrice);
    return Math.max(quantity, 1);
  }

  private deriveCandleRangePercent(candle: Candle): number {
    const reference = Math.max(Math.abs(candle.close), 1e-9);
    const range = Math.max(Number(candle.high ?? 0) - Number(candle.low ?? 0), 0);
    return range / reference;
  }

  private buildPortfolioEquityCurve(trades: PortfolioTrade[], initialCapital: number) {
    const points: Array<{ timestamp: string; equity: number }> = [];
    let runningPnL = 0;
    for (const trade of trades) {
      runningPnL += Number(trade.pnl ?? 0);
      points.push({
        timestamp: trade.exitTime,
        equity: initialCapital + runningPnL,
      });
    }
    return points;
  }

  private calculateMaxDrawdownFromPortfolioCurve(
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

  private normalizeThresholdCandidates(
    values: number[] | undefined,
    fallback: number[],
  ): number[] {
    if (!values?.length) {
      return fallback;
    }
    const normalized = values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => Number(value.toFixed(4)));
    if (!normalized.length) {
      return fallback;
    }

    return Array.from(new Set(normalized)).sort((left, right) => left - right);
  }

  private generateConstrainedPortfolioWeightCandidates(
    instrumentCount: number,
    options: {
      minWeightPercent?: number;
      maxWeightPercent?: number;
      maxActiveInstruments?: number;
      candidateCount?: number;
    },
  ) {
    if (instrumentCount <= 0) {
      return [];
    }

    const minWeight = Math.max(options.minWeightPercent ?? 0, 0) / 100;
    const maxWeight = Math.min(Math.max(options.maxWeightPercent ?? 100, 0), 100) / 100;
    const maxActiveInstruments = Math.min(
      Math.max(options.maxActiveInstruments ?? instrumentCount, 1),
      instrumentCount,
    );
    const candidateCount = Math.min(Math.max(options.candidateCount ?? 120, 10), 500);

    if (minWeight > maxWeight) {
      throw new BadRequestException('minWeightPercent cannot be greater than maxWeightPercent');
    }

    const minRequiredActive = Math.ceil(1 / Math.max(maxWeight, 1e-9));
    if (maxActiveInstruments < minRequiredActive) {
      throw new BadRequestException(
        `Constraints are infeasible: maxActiveInstruments must be at least ${minRequiredActive} for maxWeightPercent=${(
          maxWeight * 100
        ).toFixed(2)}`,
      );
    }

    if (minWeight * minRequiredActive > 1 + 1e-9) {
      throw new BadRequestException('Constraints are infeasible: minWeightPercent is too high');
    }

    const unique = new Map<string, number[]>();

    const addCandidate = (candidate: number[]) => {
      const normalized = this.normalizeAndRoundWeights(candidate);
      if (
        this.isCandidateValidForConstraints(normalized, {
          minWeight,
          maxWeight,
          maxActiveInstruments,
        })
      ) {
        unique.set(normalized.join('|'), normalized);
      }
    };

    // Seed deterministic baseline candidates first.
    addCandidate(Array.from({ length: instrumentCount }, () => 1 / instrumentCount));
    for (let index = 0; index < instrumentCount; index++) {
      const concentrated = Array.from({ length: instrumentCount }, (_, itemIndex) =>
        itemIndex === index ? 1 : 0,
      );
      addCandidate(concentrated);
    }
    for (let leftIndex = 0; leftIndex < instrumentCount; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < instrumentCount; rightIndex++) {
        const pair = Array.from({ length: instrumentCount }, () => 0);
        pair[leftIndex] = 0.5;
        pair[rightIndex] = 0.5;
        addCandidate(pair);
      }
    }

    // Generate additional constrained candidates via deterministic pseudo-random sampling.
    let seed = 17;
    let iterations = 0;
    const maxIterations = candidateCount * 25;
    while (unique.size < candidateCount && iterations < maxIterations) {
      iterations += 1;
      seed = (seed * 48271 + 13) % 2147483647;

      const activeMin = Math.max(minRequiredActive, 1);
      const activeCount =
        activeMin + (seed % Math.max(maxActiveInstruments - activeMin + 1, 1));

      const activeIndexes = this.pickDeterministicActiveIndexes(
        instrumentCount,
        activeCount,
        seed,
      );
      const sampled = this.sampleConstrainedWeightsForIndexes({
        instrumentCount,
        activeIndexes,
        minWeight,
        maxWeight,
        seed,
      });

      if (sampled) {
        addCandidate(sampled);
      }
    }

    const candidates = Array.from(unique.values());
    if (!candidates.length) {
      throw new BadRequestException(
        'Unable to generate feasible portfolio candidates for supplied constraints',
      );
    }
    return candidates;
  }

  private normalizeAndRoundWeights(weights: number[]) {
    const sanitized = weights.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
    const total = sanitized.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return sanitized.map(() => 0);
    }
    return sanitized.map((value) => Number((value / total).toFixed(6)));
  }

  private isCandidateValidForConstraints(
    weights: number[],
    constraints: {
      minWeight: number;
      maxWeight: number;
      maxActiveInstruments: number;
    },
  ) {
    const activeWeights = weights.filter((value) => value > 1e-6);
    if (!activeWeights.length) {
      return false;
    }

    if (activeWeights.length > constraints.maxActiveInstruments) {
      return false;
    }

    if (
      activeWeights.some(
        (value) =>
          value < constraints.minWeight - 1e-6 || value > constraints.maxWeight + 1e-6,
      )
    ) {
      return false;
    }

    const sum = weights.reduce((total, value) => total + value, 0);
    return Math.abs(sum - 1) <= 1e-4;
  }

  private pickDeterministicActiveIndexes(
    instrumentCount: number,
    activeCount: number,
    seed: number,
  ) {
    return Array.from({ length: instrumentCount }, (_, index) => ({
      index,
      score:
        Math.abs(Math.sin((seed + 1) * (index + 1) * 1.61803398875)) +
        ((seed + index) % 7) * 0.001,
    }))
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.min(activeCount, instrumentCount))
      .map((item) => item.index);
  }

  private sampleConstrainedWeightsForIndexes(input: {
    instrumentCount: number;
    activeIndexes: number[];
    minWeight: number;
    maxWeight: number;
    seed: number;
  }) {
    const weights = Array.from({ length: input.instrumentCount }, () => 0);
    const activeCount = input.activeIndexes.length;
    if (activeCount <= 0) {
      return null;
    }

    const minimumBudget = input.minWeight * activeCount;
    if (minimumBudget > 1 + 1e-9) {
      return null;
    }

    const variableBudget = 1 - minimumBudget;
    const raw = input.activeIndexes.map((_, index) => {
      const value = Math.abs(Math.sin((input.seed + 1) * (index + 1) * 0.731)) + 0.01;
      return value;
    });
    const rawTotal = raw.reduce((sum, value) => sum + value, 0);
    if (rawTotal <= 0) {
      return null;
    }

    input.activeIndexes.forEach((tokenIndex, activeIndex) => {
      const scaled = input.minWeight + (raw[activeIndex] / rawTotal) * variableBudget;
      weights[tokenIndex] = scaled;
    });

    // Cap breaches of max weight and redistribute remaining budget iteratively.
    for (let iteration = 0; iteration < 12; iteration++) {
      const aboveLimit = input.activeIndexes.filter(
        (index) => weights[index] > input.maxWeight + 1e-9,
      );
      if (!aboveLimit.length) {
        break;
      }

      let excess = 0;
      for (const index of aboveLimit) {
        excess += weights[index] - input.maxWeight;
        weights[index] = input.maxWeight;
      }

      const belowLimit = input.activeIndexes.filter(
        (index) => weights[index] < input.maxWeight - 1e-9,
      );
      if (!belowLimit.length) {
        break;
      }

      const room = belowLimit.reduce((sum, index) => sum + (input.maxWeight - weights[index]), 0);
      if (room <= 0) {
        break;
      }

      for (const index of belowLimit) {
        const share = (input.maxWeight - weights[index]) / room;
        weights[index] += excess * share;
      }
    }

    return weights;
  }
}
