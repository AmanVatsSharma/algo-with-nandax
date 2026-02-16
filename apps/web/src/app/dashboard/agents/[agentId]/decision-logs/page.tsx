'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { agentsApi } from '@/lib/api';
import { ArrowLeft, BrainCircuit } from 'lucide-react';

export default function AgentDecisionLogsPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params?.agentId;
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [limit, setLimit] = useState('100');

  const fetchLogs = async () => {
    if (!agentId) {
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const response = await agentsApi.getDecisionLogs(agentId, Number(limit));
      console.log('agent-decision-logs-fetch-result', {
        agentId,
        count: response.data?.length ?? 0,
      });
      setLogs(response.data ?? []);
    } catch (error: any) {
      console.error('agent-decision-logs-fetch-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to load AI decision logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [agentId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-2 text-blue-300 hover:text-blue-200 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to dashboard</span>
        </Link>

        <div className="flex items-center space-x-3 mb-8">
          <BrainCircuit className="w-8 h-8 text-violet-400" />
          <div>
            <h1 className="text-3xl font-bold">AI Decision Logs</h1>
            <p className="text-slate-400">Agent ID: {agentId}</p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="mb-4 flex items-end gap-3">
          <label className="block">
            <p className="mb-2 text-sm text-slate-300">Rows to fetch</p>
            <input
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              className="w-32 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="rounded-lg bg-violet-600 hover:bg-violet-700 transition px-4 py-2 font-semibold disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh logs'}
          </button>
        </div>

        <div className="rounded-xl border border-violet-500/20 bg-slate-900/60 p-6">
          {loading ? (
            <p className="text-slate-400">Loading decision logs...</p>
          ) : logs.length === 0 ? (
            <p className="text-slate-400">No decision logs recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                    <span className="px-2 py-1 rounded bg-violet-500/20 text-violet-300">
                      {log.provider}
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-700 text-slate-300">{log.mode}</span>
                    <span className="px-2 py-1 rounded bg-slate-700 text-slate-300">
                      action: {log.action}
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-700 text-slate-300">
                      confidence: {Number(log.confidence ?? 0).toFixed(3)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200">
                    reason: {log.reason ?? 'n/a'}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    model: {log.model ?? 'n/a'} | tokens: {log.estimatedTokens ?? 0} | est cost: $
                    {Number(log.estimatedCostUsd ?? 0).toFixed(6)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                  <pre className="text-[10px] mt-3 overflow-auto bg-slate-900 border border-slate-700 rounded p-3">
                    {JSON.stringify(log.metadata ?? {}, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
