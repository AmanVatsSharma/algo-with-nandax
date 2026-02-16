'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { riskApi } from '@/lib/api';

export default function RiskPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    days: '30',
    confidenceLevel: '95',
  });
  const [profile, setProfile] = useState({
    maxPositionValuePerTrade: '0',
    maxDailyLoss: '0',
    maxDailyProfit: '0',
    maxOpenTradesPerAgent: '0',
    killSwitchEnabled: false,
    killSwitchReason: '',
  });

  const loadData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const [profileRes, alertsRes, analyticsRes] = await Promise.all([
        riskApi.getProfile(),
        riskApi.getAlerts(25),
        riskApi.getAnalytics({
          days: Number(analyticsFilters.days),
          confidenceLevel: Number(analyticsFilters.confidenceLevel),
        }),
      ]);

      const profileData = profileRes.data;
      setProfile({
        maxPositionValuePerTrade: String(profileData.maxPositionValuePerTrade ?? 0),
        maxDailyLoss: String(profileData.maxDailyLoss ?? 0),
        maxDailyProfit: String(profileData.maxDailyProfit ?? 0),
        maxOpenTradesPerAgent: String(profileData.maxOpenTradesPerAgent ?? 0),
        killSwitchEnabled: Boolean(profileData.killSwitchEnabled),
        killSwitchReason: profileData.killSwitchReason ?? '',
      });
      setAlerts(alertsRes.data ?? []);
      setAnalytics(analyticsRes.data ?? null);
    } catch (error: any) {
      console.error('risk-page-load-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to load risk controls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [analyticsFilters.days, analyticsFilters.confidenceLevel]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await riskApi.updateProfile({
        maxPositionValuePerTrade: Number(profile.maxPositionValuePerTrade),
        maxDailyLoss: Number(profile.maxDailyLoss),
        maxDailyProfit: Number(profile.maxDailyProfit),
        maxOpenTradesPerAgent: Number(profile.maxOpenTradesPerAgent),
        killSwitchReason: profile.killSwitchReason || undefined,
      });
      setSuccessMessage('Risk profile updated successfully');
      await loadData();
    } catch (error: any) {
      console.error('risk-profile-save-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to update risk profile');
    } finally {
      setSaving(false);
    }
  };

  const toggleKillSwitch = async () => {
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (profile.killSwitchEnabled) {
        await riskApi.disableKillSwitch();
        setSuccessMessage('Kill switch disabled');
      } else {
        await riskApi.enableKillSwitch(profile.killSwitchReason || 'Manual risk override');
        setSuccessMessage('Kill switch enabled');
      }
      await loadData();
    } catch (error: any) {
      console.error('risk-killswitch-error', error);
      setErrorMessage(error?.response?.data?.message ?? 'Failed to update kill switch');
    } finally {
      setSaving(false);
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
          <ShieldAlert className="w-8 h-8 text-amber-400" />
          <div>
            <h1 className="text-3xl font-bold">Risk Controls</h1>
            <p className="text-slate-400">Configure kill-switch and live-trading exposure limits.</p>
          </div>
        </div>

        {errorMessage && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300">{errorMessage}</div>}
        {successMessage && <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-green-300">{successMessage}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={saveProfile} className="space-y-4 rounded-xl border border-amber-500/20 bg-slate-900/60 p-6">
            <h2 className="text-xl font-semibold">Risk Profile</h2>
            <Field label="Max position value per trade">
              <input
                type="number"
                min={0}
                value={profile.maxPositionValuePerTrade}
                onChange={(event) => setProfile({ ...profile, maxPositionValuePerTrade: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Max daily loss">
              <input
                type="number"
                min={0}
                value={profile.maxDailyLoss}
                onChange={(event) => setProfile({ ...profile, maxDailyLoss: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Max daily profit cap">
              <input
                type="number"
                min={0}
                value={profile.maxDailyProfit}
                onChange={(event) => setProfile({ ...profile, maxDailyProfit: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Max open trades per agent">
              <input
                type="number"
                min={0}
                value={profile.maxOpenTradesPerAgent}
                onChange={(event) => setProfile({ ...profile, maxOpenTradesPerAgent: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>
            <Field label="Kill switch reason">
              <input
                value={profile.killSwitchReason}
                onChange={(event) => setProfile({ ...profile, killSwitchReason: event.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
              />
            </Field>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || loading}
                className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 transition px-4 py-2 font-semibold disabled:opacity-50"
              >
                Save profile
              </button>
              <button
                type="button"
                disabled={saving || loading}
                onClick={toggleKillSwitch}
                className={`flex-1 rounded-lg transition px-4 py-2 font-semibold disabled:opacity-50 ${
                  profile.killSwitchEnabled
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {profile.killSwitchEnabled ? 'Disable kill switch' : 'Enable kill switch'}
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-6">
            <h2 className="text-xl font-semibold mb-3">Recent Risk Alerts</h2>
            {loading ? (
              <p className="text-slate-400">Loading alerts...</p>
            ) : alerts.length === 0 ? (
              <p className="text-slate-400">No alerts generated yet.</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                    <p className="font-medium text-amber-300">{alert.alertType}</p>
                    <p className="text-sm text-slate-200">{alert.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-amber-500/20 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-semibold">Risk Analytics Snapshot</h2>
            <div className="flex items-center gap-3">
              <FieldInline label="Days">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={analyticsFilters.days}
                  onChange={(event) =>
                    setAnalyticsFilters((prev) => ({ ...prev, days: event.target.value }))
                  }
                  className="w-24 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                />
              </FieldInline>
              <FieldInline label="Confidence %">
                <input
                  type="number"
                  min={80}
                  max={99.9}
                  step="0.1"
                  value={analyticsFilters.confidenceLevel}
                  onChange={(event) =>
                    setAnalyticsFilters((prev) => ({
                      ...prev,
                      confidenceLevel: event.target.value,
                    }))
                  }
                  className="w-28 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2"
                />
              </FieldInline>
            </div>
          </div>

          {loading ? (
            <p className="text-slate-400">Loading analytics...</p>
          ) : analytics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <MetricCard label="Value at Risk" value={Number(analytics.riskMetrics?.valueAtRisk ?? 0).toFixed(2)} />
                <MetricCard label="Expected shortfall" value={Number(analytics.riskMetrics?.expectedShortfall ?? 0).toFixed(2)} />
                <MetricCard label="Max drawdown" value={Number(analytics.riskMetrics?.maxDrawdown ?? 0).toFixed(2)} />
              </div>
              <pre className="text-xs overflow-auto bg-slate-800 rounded-lg p-4 border border-slate-700">
                {JSON.stringify(analytics, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-slate-400">No analytics available yet.</p>
          )}
        </div>
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

function FieldInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <span>{label}</span>
      {children}
    </label>
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
