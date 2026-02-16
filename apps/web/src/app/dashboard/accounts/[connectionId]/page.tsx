'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { brokerApi } from '@/lib/api';
import { ArrowLeft, Wallet } from 'lucide-react';

export default function AccountDetailsPage() {
  const params = useParams<{ connectionId: string }>();
  const connectionId = params?.connectionId;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [positions, setPositions] = useState<any>(null);
  const [holdings, setHoldings] = useState<any>(null);

  useEffect(() => {
    if (!connectionId) {
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const [profileRes, positionsRes, holdingsRes] = await Promise.all([
          brokerApi.getKiteProfile(connectionId),
          brokerApi.getKitePositions(connectionId),
          brokerApi.getKiteHoldings(connectionId),
        ]);
        setProfile(profileRes.data);
        setPositions(positionsRes.data);
        setHoldings(holdingsRes.data);
      } catch (error: any) {
        console.error('account-details-fetch-error', error);
        setErrorMessage(error?.response?.data?.message ?? 'Failed to load account details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [connectionId]);

  const netPositions = useMemo(() => positions?.net ?? [], [positions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/dashboard/broker" className="inline-flex items-center space-x-2 text-blue-300 hover:text-blue-200 mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to accounts</span>
        </Link>

        <div className="flex items-center space-x-3 mb-8">
          <Wallet className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold">Account Details</h1>
            <p className="text-slate-400">Connection ID: {connectionId}</p>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-blue-500/20 bg-slate-900/60 p-6">
            Loading account details...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && (
          <div className="space-y-6">
            <section className="rounded-xl border border-blue-500/20 bg-slate-900/60 p-6">
              <h2 className="text-xl font-semibold mb-4">Profile</h2>
              <pre className="text-xs overflow-auto bg-slate-800 rounded-lg p-4 border border-slate-700">
                {JSON.stringify(profile, null, 2)}
              </pre>
            </section>

            <section className="rounded-xl border border-blue-500/20 bg-slate-900/60 p-6">
              <h2 className="text-xl font-semibold mb-4">Net Positions ({netPositions.length})</h2>
              {netPositions.length === 0 ? (
                <p className="text-slate-400">No positions found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-700">
                        <th className="py-2 pr-3">Symbol</th>
                        <th className="py-2 pr-3">Qty</th>
                        <th className="py-2 pr-3">Avg</th>
                        <th className="py-2 pr-3">LTP</th>
                        <th className="py-2 pr-3">PnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {netPositions.map((position: any) => (
                        <tr key={position.tradingsymbol} className="border-b border-slate-800">
                          <td className="py-2 pr-3">{position.tradingsymbol}</td>
                          <td className="py-2 pr-3">{position.quantity}</td>
                          <td className="py-2 pr-3">{position.average_price}</td>
                          <td className="py-2 pr-3">{position.last_price}</td>
                          <td className={`py-2 pr-3 ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {position.pnl}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-blue-500/20 bg-slate-900/60 p-6">
              <h2 className="text-xl font-semibold mb-4">Holdings ({holdings?.length ?? 0})</h2>
              <pre className="text-xs overflow-auto bg-slate-800 rounded-lg p-4 border border-slate-700">
                {JSON.stringify(holdings, null, 2)}
              </pre>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
