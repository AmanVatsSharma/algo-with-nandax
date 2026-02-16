'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { agentsApi } from '@/lib/api';

export default function AIGovernancePage() {
  const [loading, setLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [policyRequests, setPolicyRequests] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [days, setDays] = useState('30');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored) {
        return;
      }
      const parsed = JSON.parse(stored);
      setCurrentUserRole(String(parsed?.role ?? 'user').toLowerCase());
    } catch (error) {
      console.warn('ai-governance-user-role-parse-warning', error);
    }
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const [
        summaryResponse,
        ledgerResponse,
        policyResponse,
        eventsResponse,
        policyRequestsResponse,
      ] = await Promise.all([
        agentsApi.getGovernanceSummary(Number(days)),
        agentsApi.getGovernanceLedger(Number(days)),
        agentsApi.getGovernancePolicy(),
        agentsApi.getGovernanceEvents(50),
        agentsApi.getGovernancePolicyRequests(100),
      ]);
      console.log('ai-governance-summary-fetch-result', {
        days: Number(days),
        totalDecisions: summaryResponse.data?.totals?.totalDecisions ?? 0,
        policyRequestCount: Array.isArray(policyRequestsResponse.data)
          ? policyRequestsResponse.data.length
          : 0,
      });
      setSummary(summaryResponse.data);
      setLedger(ledgerResponse.data);
      setPolicy(policyResponse.data);
      setEvents(eventsResponse.data ?? []);
      setPolicyRequests(policyRequestsResponse.data ?? []);
    } catch (error: any) {
      console.error('ai-governance-summary-fetch-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to load AI governance summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const savePolicy = async () => {
    if (!policy) {
      return;
    }
    setSavingPolicy(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const payload = {
        liveInferenceEnabled: Boolean(policy.profile?.liveInferenceEnabled),
        dailyCostBudgetUsd: Number(policy.profile?.dailyCostBudgetUsd ?? 0),
        dailyTokenBudget: Number(policy.profile?.dailyTokenBudget ?? 0),
        providerDailyCostBudgetUsd: Number(policy.profile?.providerDailyCostBudgetUsd ?? 0),
        policyNote: String(policy.profile?.policyNote ?? ''),
      };
      console.log('ai-governance-policy-save-payload', payload);
      const response = await agentsApi.updateGovernancePolicy(payload);
      if (response.data?.status === 'pending_approval') {
        setSuccessMessage('Policy change request submitted for admin approval.');
      } else {
        setSuccessMessage('Policy updated successfully.');
      }
      await fetchSummary();
    } catch (error: any) {
      console.error('ai-governance-policy-save-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to update governance policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  const reviewPolicyRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (action === 'approve') {
        await agentsApi.approveGovernancePolicyRequest(requestId);
        setSuccessMessage('Policy request approved.');
      } else {
        await agentsApi.rejectGovernancePolicyRequest(requestId);
        setSuccessMessage('Policy request rejected.');
      }
      await fetchSummary();
    } catch (error: any) {
      console.error('ai-governance-policy-request-review-error', { action, requestId, error });
      setErrorMessage(error?.response?.data?.message ?? 'Failed to review policy request');
    }
  };

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
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
          <div>
            <h1 className="text-3xl font-bold">AI Governance Summary</h1>
            <p className="text-slate-400">Monitor AI decision cost, confidence, and provider usage.</p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300">
            {successMessage}
          </div>
        )}

        <div className="mb-4 flex items-end gap-3">
          <label className="block">
            <p className="mb-2 text-sm text-slate-300">Lookback days</p>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="w-32 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 transition px-4 py-2 font-semibold disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-slate-900/60 p-6">
          {loading ? (
            <p className="text-slate-400">Loading governance summary...</p>
          ) : summary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <MetricCard
                  label="Total decisions"
                  value={String(summary.totals?.totalDecisions ?? 0)}
                />
                <MetricCard
                  label="Total cost (USD)"
                  value={`$${Number(summary.totals?.totalCostUsd ?? 0).toFixed(6)}`}
                />
                <MetricCard
                  label="Total tokens"
                  value={String(summary.totals?.totalTokens ?? 0)}
                />
                <MetricCard
                  label="Average confidence"
                  value={Number(summary.totals?.avgConfidence ?? 0).toFixed(3)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatBlock title="Provider stats" data={summary.providerStats ?? []} />
                <StatBlock title="Mode stats" data={summary.modeStats ?? []} />
                <StatBlock title="Action breakdown" data={summary.actionBreakdown ?? []} />
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <p className="text-sm font-semibold mb-2">AI cost ledger (daily rollup)</p>
                <pre className="text-xs overflow-auto bg-slate-900 border border-slate-700 rounded p-3">
                  {JSON.stringify(ledger, null, 2)}
                </pre>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
                <p className="text-sm font-semibold">Live AI governance policy</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(policy?.profile?.liveInferenceEnabled)}
                      onChange={(event) =>
                        setPolicy((previous: any) => ({
                          ...previous,
                          profile: {
                            ...previous?.profile,
                            liveInferenceEnabled: event.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Enable live inference</span>
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-300">Daily cost budget (USD)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={String(policy?.profile?.dailyCostBudgetUsd ?? 0)}
                      onChange={(event) =>
                        setPolicy((previous: any) => ({
                          ...previous,
                          profile: {
                            ...previous?.profile,
                            dailyCostBudgetUsd: event.target.value,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-300">Daily token budget</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={String(policy?.profile?.dailyTokenBudget ?? 0)}
                      onChange={(event) =>
                        setPolicy((previous: any) => ({
                          ...previous,
                          profile: {
                            ...previous?.profile,
                            dailyTokenBudget: event.target.value,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-300">Provider daily cost budget (USD)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={String(policy?.profile?.providerDailyCostBudgetUsd ?? 0)}
                      onChange={(event) =>
                        setPolicy((previous: any) => ({
                          ...previous,
                          profile: {
                            ...previous?.profile,
                            providerDailyCostBudgetUsd: event.target.value,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="text-slate-300">Policy note</span>
                    <input
                      type="text"
                      value={String(policy?.profile?.policyNote ?? '')}
                      onChange={(event) =>
                        setPolicy((previous: any) => ({
                          ...previous,
                          profile: {
                            ...previous?.profile,
                            policyNote: event.target.value,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={savePolicy}
                  disabled={savingPolicy}
                  className="rounded bg-violet-600 hover:bg-violet-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {savingPolicy ? 'Saving policy...' : 'Save policy'}
                </button>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <p className="text-sm font-semibold mb-2">Recent governance events</p>
                {events.length === 0 ? (
                  <p className="text-xs text-slate-400">No recent governance events.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-100">
                            {event.eventType}
                          </span>
                          <span
                            className={
                              event.blocked ? 'text-rose-300 font-semibold' : 'text-emerald-300'
                            }
                          >
                            {event.blocked ? 'BLOCKED' : 'ALLOWED'}
                          </span>
                        </div>
                        <p className="text-slate-300 mt-1">
                          provider={event.provider} {event.reason ? `| reason=${event.reason}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <p className="text-sm font-semibold mb-2">Policy approval workflow queue</p>
                {policyRequests.length === 0 ? (
                  <p className="text-xs text-slate-400">No policy requests in scope.</p>
                ) : (
                  <div className="space-y-2">
                    {policyRequests.map((request) => (
                      <div
                        key={request.id}
                        className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-100">
                            status={request.status}
                          </span>
                          <span className="text-slate-400">
                            requestedBy={request.requestedByUserId}
                          </span>
                        </div>
                        <pre className="mt-2 overflow-auto rounded border border-slate-700 bg-slate-950 p-2 text-[11px]">
                          {JSON.stringify(request.requestedPolicy ?? {}, null, 2)}
                        </pre>
                        {currentUserRole === 'admin' && request.status === 'pending' && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => reviewPolicyRequest(request.id, 'approve')}
                              className="rounded bg-emerald-700 px-3 py-1 font-semibold hover:bg-emerald-600"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => reviewPolicyRequest(request.id, 'reject')}
                              className="rounded bg-rose-700 px-3 py-1 font-semibold hover:bg-rose-600"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <pre className="text-xs overflow-auto bg-slate-800 rounded-lg p-4 border border-slate-700">
                {JSON.stringify(summary, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-slate-400">No governance summary available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  );
}

function StatBlock({ title, data }: { title: string; data: any[] }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <p className="text-sm font-semibold mb-2">{title}</p>
      {data.length === 0 ? (
        <p className="text-xs text-slate-400">No data</p>
      ) : (
        <div className="space-y-2 text-xs">
          {data.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-slate-300">{item.key}</span>
              <span className="text-slate-100">
                {item.count} | ${Number(item.totalCostUsd ?? 0).toFixed(6)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
