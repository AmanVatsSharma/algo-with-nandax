'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { Bot, ArrowLeft, Shield, User, KeyRound } from 'lucide-react';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      setStatus('loading');
      setErrorMessage('');

      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          setUser(JSON.parse(userStr));
        } else {
          const response = await authApi.me();
          setUser(response.data);
        }
        setStatus('idle');
      } catch (error: any) {
        console.error('settings-bootstrap-error', error);
        setStatus('error');
        setErrorMessage(error?.response?.data?.message ?? 'Failed to load settings');
      }
    };

    bootstrap();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-2 text-blue-300 hover:text-blue-200 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to dashboard</span>
        </Link>

        <div className="flex items-center space-x-3 mb-8">
          <Bot className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <p className="text-slate-400">Manage your profile and security posture.</p>
          </div>
        </div>

        {status === 'loading' && (
          <div className="p-6 rounded-xl border border-blue-500/20 bg-slate-900/60">
            <p className="text-blue-300">Loading settings...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10">
            <p className="text-red-300">{errorMessage}</p>
          </div>
        )}

        {status === 'idle' && (
          <div className="space-y-6">
            <section className="p-6 rounded-xl border border-blue-500/20 bg-slate-900/60">
              <div className="flex items-center space-x-2 mb-4">
                <User className="w-5 h-5 text-blue-300" />
                <h2 className="text-xl font-semibold">Profile</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <InfoRow label="Name" value={user?.name ?? '-'} />
                <InfoRow label="Email" value={user?.email ?? '-'} />
                <InfoRow label="Role" value={user?.role ?? '-'} />
                <InfoRow label="Subscription" value={user?.subscriptionTier ?? '-'} />
              </div>
            </section>

            <section className="p-6 rounded-xl border border-blue-500/20 bg-slate-900/60">
              <div className="flex items-center space-x-2 mb-3">
                <Shield className="w-5 h-5 text-blue-300" />
                <h2 className="text-xl font-semibold">Security Recommendations</h2>
              </div>
              <ul className="list-disc list-inside text-slate-300 space-y-2 text-sm">
                <li>Rotate broker API secrets periodically.</li>
                <li>Use strong unique passwords and enable MFA at broker account.</li>
                <li>Monitor broker connection status before market open.</li>
              </ul>
            </section>

            <section className="p-6 rounded-xl border border-blue-500/20 bg-slate-900/60">
              <div className="flex items-center space-x-2 mb-3">
                <KeyRound className="w-5 h-5 text-blue-300" />
                <h2 className="text-xl font-semibold">Token Session</h2>
              </div>
              <p className="text-sm text-slate-300">
                If you suspect a compromised session, clear local session and login again.
              </p>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.href = '/auth/login';
                }}
                className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition text-sm font-semibold"
              >
                Sign out from this browser
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/70 p-3 border border-slate-700/80">
      <p className="text-slate-400">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
