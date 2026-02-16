'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { backtestingApi, brokerApi } from '@/lib/api';
import { useEffect } from 'react';

export default function BacktestingPage() {
  const [connections, setConnections] = useState<any[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [form, setForm] = useState({
    connectionId: '',
    instrumentToken: '',
    portfolioTokensCsv: '',
    portfolioWeightsCsv: '',
    entryCandidatesCsv: '0.2,0.3,0.4,0.5',
    exitCandidatesCsv: '0.15,0.2,0.25,0.3',
    topN: '5',
    interval: '5minute',
    fromDate: '',
    toDate: '',
    quantity: '1',
    entryThresholdPercent: '0.4',
    exitThresholdPercent: '0.2',
    feePerTrade: '0',
    slippageBps: '0',
    stopLossPercent: '0.6',
    takeProfitPercent: '1.2',
    walkForwardWindows: '1',
    initialCapital: '0',
  });

  useEffect(() => {
    const fetchConnections = async () => {
      setLoadingConnections(true);
      try {
        const response = await brokerApi.getConnections();
        const activeConnections = (response.data ?? []).filter(
          (connection: any) => connection.status === 'connected',
        );
        setConnections(activeConnections);
      } catch (error: any) {
        console.error('fetch-backtesting-connections-error', error);
      } finally {
        setLoadingConnections(false);
      }
    };

    fetchConnections();
  }, []);

  const runBacktest = async (event: React.FormEvent) => {
    event.preventDefault();
    setRunning(true);
    setResult(null);
    setErrorMessage('');

    try {
      const payload = {
        connectionId: form.connectionId,
        instrumentToken: form.instrumentToken,
        interval: form.interval,
        fromDate: form.fromDate,
        toDate: form.toDate,
        quantity: Number(form.quantity),
        entryThresholdPercent: Number(form.entryThresholdPercent),
        exitThresholdPercent: Number(form.exitThresholdPercent),
        feePerTrade: Number(form.feePerTrade),
        slippageBps: Number(form.slippageBps),
        stopLossPercent: Number(form.stopLossPercent),
        takeProfitPercent: Number(form.takeProfitPercent),
        walkForwardWindows: Number(form.walkForwardWindows),
        initialCapital: Number(form.initialCapital),
      };

      console.log('run-backtesting-payload', payload);
      const response = await backtestingApi.run(payload);
      setResult(response.data);
    } catch (error: any) {
      console.error('run-backtesting-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to run backtest');
    } finally {
      setRunning(false);
    }
  };

  const runPortfolioBacktest = async () => {
    setRunning(true);
    setResult(null);
    setErrorMessage('');

    try {
      const instrumentTokens = form.portfolioTokensCsv
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);
      if (!instrumentTokens.length) {
        setErrorMessage('Provide comma-separated instrument tokens for portfolio backtest');
        return;
      }

      const parsedWeights = form.portfolioWeightsCsv
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

      const payload = {
        connectionId: form.connectionId,
        instrumentTokens,
        weights:
          parsedWeights.length === instrumentTokens.length ? parsedWeights : undefined,
        interval: form.interval,
        fromDate: form.fromDate,
        toDate: form.toDate,
        quantity: Number(form.quantity),
        entryThresholdPercent: Number(form.entryThresholdPercent),
        exitThresholdPercent: Number(form.exitThresholdPercent),
        feePerTrade: Number(form.feePerTrade),
        slippageBps: Number(form.slippageBps),
        stopLossPercent: Number(form.stopLossPercent),
        takeProfitPercent: Number(form.takeProfitPercent),
        walkForwardWindows: Number(form.walkForwardWindows),
        initialCapital: Number(form.initialCapital),
      };

      console.log('run-portfolio-backtesting-payload', payload);
      const response = await backtestingApi.runPortfolio(payload);
      setResult(response.data);
    } catch (error: any) {
      console.error('run-portfolio-backtesting-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to run portfolio backtest');
    } finally {
      setRunning(false);
    }
  };

  const runOptimization = async () => {
    setRunning(true);
    setResult(null);
    setErrorMessage('');

    try {
      if (!form.instrumentToken) {
        setErrorMessage('Instrument token is required for optimization');
        return;
      }

      const entryThresholdCandidates = form.entryCandidatesCsv
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
      const exitThresholdCandidates = form.exitCandidatesCsv
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);

      const payload = {
        connectionId: form.connectionId,
        instrumentToken: form.instrumentToken,
        interval: form.interval,
        fromDate: form.fromDate,
        toDate: form.toDate,
        quantity: Number(form.quantity),
        feePerTrade: Number(form.feePerTrade),
        slippageBps: Number(form.slippageBps),
        stopLossPercent: Number(form.stopLossPercent),
        takeProfitPercent: Number(form.takeProfitPercent),
        walkForwardWindows: Number(form.walkForwardWindows),
        initialCapital: Number(form.initialCapital),
        entryThresholdCandidates,
        exitThresholdCandidates,
        topN: Number(form.topN),
      };

      console.log('run-backtesting-optimization-payload', payload);
      const response = await backtestingApi.optimize(payload);
      setResult(response.data);
    } catch (error: any) {
      console.error('run-backtesting-optimization-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to optimize backtest');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center space-x-2 text-blue-300 hover:text-blue-200 mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to dashboard</span>
        </Link>

        <div className="flex items-center space-x-3 mb-8">
          <FlaskConical className="w-8 h-8 text-cyan-400" />
          <div>
            <h1 className="text-3xl font-bold">Strategy Backtesting</h1>
            <p className="text-slate-400">Run deterministic historical simulations before live deployment.</p>
          </div>
        </div>

        <form onSubmit={runBacktest} className="space-y-4 rounded-xl border border-cyan-500/20 bg-slate-900/60 p-6">
          {errorMessage && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300">{errorMessage}</div>}

          <Field label="Broker connection">
            <select
              required
              disabled={loadingConnections}
              value={form.connectionId}
              onChange={(event) => setForm({ ...form, connectionId: event.target.value })}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
            >
              <option value="">{loadingConnections ? 'Loading connections...' : 'Select active connection'}</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.brokerType} ({connection.id.slice(0, 8)}...)
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Instrument token">
              <input
                required
                value={form.instrumentToken}
                onChange={(event) => setForm({ ...form, instrumentToken: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Interval">
              <select
                value={form.interval}
                onChange={(event) => setForm({ ...form, interval: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              >
                <option value="minute">1 minute</option>
                <option value="3minute">3 minute</option>
                <option value="5minute">5 minute</option>
                <option value="15minute">15 minute</option>
                <option value="30minute">30 minute</option>
                <option value="day">Day</option>
              </select>
            </Field>

            <Field label="From date (ISO)">
              <input
                required
                value={form.fromDate}
                onChange={(event) => setForm({ ...form, fromDate: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                placeholder="2026-01-01 09:15:00"
              />
            </Field>
            <Field label="To date (ISO)">
              <input
                required
                value={form.toDate}
                onChange={(event) => setForm({ ...form, toDate: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                placeholder="2026-01-30 15:30:00"
              />
            </Field>

            <Field label="Quantity">
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Portfolio tokens (comma-separated, optional)">
              <input
                value={form.portfolioTokensCsv}
                onChange={(event) => setForm({ ...form, portfolioTokensCsv: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                placeholder="12345, 67890, 11111"
              />
            </Field>
            <Field label="Portfolio weights (comma-separated, optional)">
              <input
                value={form.portfolioWeightsCsv}
                onChange={(event) => setForm({ ...form, portfolioWeightsCsv: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                placeholder="50,30,20"
              />
            </Field>
            <Field label="Optimization entry thresholds (comma-separated)">
              <input
                value={form.entryCandidatesCsv}
                onChange={(event) => setForm({ ...form, entryCandidatesCsv: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                placeholder="0.2,0.3,0.4,0.5"
              />
            </Field>
            <Field label="Optimization exit thresholds (comma-separated)">
              <input
                value={form.exitCandidatesCsv}
                onChange={(event) => setForm({ ...form, exitCandidatesCsv: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                placeholder="0.15,0.2,0.25,0.3"
              />
            </Field>
            <Field label="Entry threshold %">
              <input
                type="number"
                min={0.05}
                step="0.05"
                value={form.entryThresholdPercent}
                onChange={(event) => setForm({ ...form, entryThresholdPercent: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Exit threshold %">
              <input
                type="number"
                min={0.05}
                step="0.05"
                value={form.exitThresholdPercent}
                onChange={(event) => setForm({ ...form, exitThresholdPercent: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Fee per trade">
              <input
                type="number"
                min={0}
                step="0.1"
                value={form.feePerTrade}
                onChange={(event) => setForm({ ...form, feePerTrade: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Slippage (bps)">
              <input
                type="number"
                min={0}
                step="1"
                value={form.slippageBps}
                onChange={(event) => setForm({ ...form, slippageBps: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Stop loss %">
              <input
                type="number"
                min={0.05}
                step="0.05"
                value={form.stopLossPercent}
                onChange={(event) => setForm({ ...form, stopLossPercent: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Take profit %">
              <input
                type="number"
                min={0.05}
                step="0.05"
                value={form.takeProfitPercent}
                onChange={(event) => setForm({ ...form, takeProfitPercent: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Walk-forward windows">
              <input
                type="number"
                min={1}
                max={12}
                step="1"
                value={form.walkForwardWindows}
                onChange={(event) => setForm({ ...form, walkForwardWindows: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Initial capital">
              <input
                type="number"
                min={0}
                step="1000"
                value={form.initialCapital}
                onChange={(event) => setForm({ ...form, initialCapital: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Optimization top N">
              <input
                type="number"
                min={1}
                max={30}
                value={form.topN}
                onChange={(event) => setForm({ ...form, topN: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={running}
            className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-700 transition px-4 py-3 font-semibold disabled:opacity-50"
          >
            {running ? 'Running backtest...' : 'Run backtest'}
          </button>
          <button
            type="button"
            disabled={running}
            onClick={runPortfolioBacktest}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 transition px-4 py-3 font-semibold disabled:opacity-50"
          >
            {running ? 'Running portfolio backtest...' : 'Run portfolio backtest'}
          </button>
          <button
            type="button"
            disabled={running}
            onClick={runOptimization}
            className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 transition px-4 py-3 font-semibold disabled:opacity-50"
          >
            {running ? 'Optimizing...' : 'Optimize thresholds'}
          </button>
        </form>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-6">
              <h2 className="text-xl font-semibold mb-4">Summary</h2>
              <pre className="text-xs overflow-auto bg-slate-800 rounded-lg p-4 border border-slate-700">
                {JSON.stringify(result.summary, null, 2)}
              </pre>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-6">
              <h2 className="text-xl font-semibold mb-4">Walk-forward windows</h2>
              <pre className="text-xs overflow-auto bg-slate-800 rounded-lg p-4 border border-slate-700">
                {JSON.stringify(result.windows ?? [], null, 2)}
              </pre>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-6">
              <h2 className="text-xl font-semibold mb-4">Portfolio instruments</h2>
              <pre className="text-xs overflow-auto bg-slate-800 rounded-lg p-4 border border-slate-700">
                {JSON.stringify(result.instruments ?? [], null, 2)}
              </pre>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-6">
              <h2 className="text-xl font-semibold mb-4">Optimization top strategies</h2>
              <pre className="text-xs overflow-auto bg-slate-800 rounded-lg p-4 border border-slate-700">
                {JSON.stringify(result.topStrategies ?? [], null, 2)}
              </pre>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Trades ({result.trades?.length ?? 0})</h2>
              <pre className="text-xs overflow-auto bg-slate-800 rounded-lg p-4 border border-slate-700">
                {JSON.stringify(result.trades?.slice(0, 20) ?? [], null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <p className="mb-2 text-sm text-slate-300">{label}</p>
      {children}
    </label>
  );
}
