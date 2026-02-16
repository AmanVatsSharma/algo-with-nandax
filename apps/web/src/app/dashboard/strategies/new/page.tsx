'use client';

import Link from 'next/link';
import { useState } from 'react';
import { strategiesApi } from '@/lib/api';
import { ArrowLeft, Target } from 'lucide-react';

export default function NewStrategyPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'momentum',
    timeFrame: '5min',
    instruments: 'NSE:SBIN,NSE:INFY',
    maxCapitalPerTrade: '25000',
    stopLossPercentage: '2',
    takeProfitPercentage: '5',
    maxPositions: '3',
    maxTradesPerDay: '5',
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        timeFrame: form.timeFrame,
        instruments: form.instruments
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        maxCapitalPerTrade: Number(form.maxCapitalPerTrade),
        stopLossPercentage: Number(form.stopLossPercentage),
        takeProfitPercentage: Number(form.takeProfitPercentage),
        maxPositions: Number(form.maxPositions),
        maxTradesPerDay: Number(form.maxTradesPerDay),
        configuration: {
          source: 'strategy-builder-v1',
        },
      };

      console.log('create-strategy-payload', payload);
      await strategiesApi.create(payload);
      setSuccessMessage('Strategy created successfully. You can attach it to an agent.');
      setForm((prev) => ({ ...prev, name: '', description: '' }));
    } catch (error: any) {
      console.error('create-strategy-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to create strategy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center space-x-2 text-blue-300 hover:text-blue-200 mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to dashboard</span>
        </Link>

        <div className="flex items-center space-x-3 mb-8">
          <Target className="w-8 h-8 text-cyan-400" />
          <div>
            <h1 className="text-3xl font-bold">Create Strategy</h1>
            <p className="text-slate-400">Define risk-aware strategy parameters for your agents.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5 rounded-xl border border-cyan-500/20 bg-slate-900/60 p-6">
          {errorMessage && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300">{errorMessage}</div>}
          {successMessage && <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-green-300">{successMessage}</div>}

          <Field label="Strategy name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
            />
          </Field>

          <Field label="Description">
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Strategy type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              >
                <option value="momentum">Momentum</option>
                <option value="mean_reversion">Mean Reversion</option>
                <option value="arbitrage">Arbitrage</option>
                <option value="scalping">Scalping</option>
                <option value="swing">Swing</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Timeframe">
              <select
                value={form.timeFrame}
                onChange={(e) => setForm({ ...form, timeFrame: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              >
                <option value="1min">1 Minute</option>
                <option value="5min">5 Minute</option>
                <option value="15min">15 Minute</option>
                <option value="30min">30 Minute</option>
                <option value="1hour">1 Hour</option>
                <option value="1day">1 Day</option>
              </select>
            </Field>
          </div>

          <Field label="Instruments (comma-separated)">
            <input
              value={form.instruments}
              onChange={(e) => setForm({ ...form, instruments: e.target.value })}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Max capital per trade">
              <input type="number" min={0} value={form.maxCapitalPerTrade} onChange={(e) => setForm({ ...form, maxCapitalPerTrade: e.target.value })} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2" />
            </Field>
            <Field label="Stop loss (%)">
              <input type="number" min={0} step="0.1" value={form.stopLossPercentage} onChange={(e) => setForm({ ...form, stopLossPercentage: e.target.value })} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2" />
            </Field>
            <Field label="Take profit (%)">
              <input type="number" min={0} step="0.1" value={form.takeProfitPercentage} onChange={(e) => setForm({ ...form, takeProfitPercentage: e.target.value })} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2" />
            </Field>
            <Field label="Max positions">
              <input type="number" min={1} value={form.maxPositions} onChange={(e) => setForm({ ...form, maxPositions: e.target.value })} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2" />
            </Field>
            <Field label="Max trades/day">
              <input type="number" min={1} value={form.maxTradesPerDay} onChange={(e) => setForm({ ...form, maxTradesPerDay: e.target.value })} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2" />
            </Field>
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-700 transition px-4 py-3 font-semibold disabled:opacity-50"
          >
            {loading ? 'Creating strategy...' : 'Create strategy'}
          </button>
        </form>
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
