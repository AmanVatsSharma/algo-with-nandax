'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { agentsApi, brokerApi, strategiesApi } from '@/lib/api';
import { ArrowLeft, Bot } from 'lucide-react';

type AgentType = 'ai_powered' | 'rule_based' | 'hybrid';

export default function NewAgentPage() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingStrategies, setFetchingStrategies] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    strategyId: '',
    connectionId: '',
    type: 'ai_powered' as AgentType,
    allocatedCapital: '100000',
    autoTrade: true,
    paperTrading: false,
    aiModelName: 'baseline-v1',
  });

  useEffect(() => {
    const fetchStrategies = async () => {
      setFetchingStrategies(true);
      try {
        const response = await strategiesApi.getAll();
        setStrategies(response.data ?? []);

        const connectionsResponse = await brokerApi.getConnections();
        const activeConnections = (connectionsResponse.data ?? []).filter(
          (connection: any) => connection.status === 'connected',
        );
        setConnections(activeConnections);
      } catch (error: any) {
        console.error('fetch-strategies-for-agent-error', error);
        setErrorMessage(error?.response?.data?.message ?? 'Failed to fetch strategies');
      } finally {
        setFetchingStrategies(false);
      }
    };

    fetchStrategies();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!form.strategyId) {
        setErrorMessage('Please select a strategy');
        return;
      }
      if (!form.connectionId) {
        setErrorMessage('Please select an active broker connection');
        return;
      }

      const payload = {
        name: form.name,
        strategyId: form.strategyId,
        connectionId: form.connectionId,
        type: form.type,
        allocatedCapital: Number(form.allocatedCapital),
        autoTrade: form.autoTrade,
        paperTrading: form.paperTrading,
        aiModelName: form.aiModelName || undefined,
      };

      console.log('create-agent-payload', payload);
      await agentsApi.create(payload);
      setSuccessMessage('Agent created successfully. You can now start it from dashboard.');

      setForm((prev) => ({
        ...prev,
        name: '',
      }));
    } catch (error: any) {
      console.error('create-agent-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center space-x-2 text-blue-300 hover:text-blue-200 mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to dashboard</span>
        </Link>

        <div className="flex items-center space-x-3 mb-8">
          <Bot className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold">Deploy New Agent</h1>
            <p className="text-slate-400">Create a production-safe trading agent configuration.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5 rounded-xl border border-blue-500/20 bg-slate-900/60 p-6">
          {errorMessage && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300">{errorMessage}</div>}
          {successMessage && <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-green-300">{successMessage}</div>}

          <Field label="Agent name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
            />
          </Field>

          <Field label="Strategy">
            <select
              value={form.strategyId}
              onChange={(e) => setForm({ ...form, strategyId: e.target.value })}
              required
              disabled={fetchingStrategies}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
            >
              <option value="">{fetchingStrategies ? 'Loading strategies...' : 'Select strategy'}</option>
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name} ({strategy.type})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Broker connection">
            <select
              value={form.connectionId}
              onChange={(e) => setForm({ ...form, connectionId: e.target.value })}
              required
              disabled={fetchingStrategies}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
            >
              <option value="">Select active connection</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.brokerType} ({connection.id.slice(0, 8)}...)
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Agent type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as AgentType })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              >
                <option value="ai_powered">AI Powered</option>
                <option value="rule_based">Rule Based</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </Field>

            <Field label="Allocated capital">
              <input
                type="number"
                min={0}
                value={form.allocatedCapital}
                onChange={(e) => setForm({ ...form, allocatedCapital: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
          </div>

          <Field label="AI model name (optional)">
            <input
              value={form.aiModelName}
              onChange={(e) => setForm({ ...form, aiModelName: e.target.value })}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Checkbox
              label="Enable auto-trade"
              checked={form.autoTrade}
              onChange={(checked) => setForm({ ...form, autoTrade: checked })}
            />
            <Checkbox
              label="Paper trading mode"
              checked={form.paperTrading}
              onChange={(checked) => setForm({ ...form, paperTrading: checked })}
            />
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 transition px-4 py-3 font-semibold disabled:opacity-50"
          >
            {loading ? 'Creating agent...' : 'Create agent'}
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

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
