'use client';

import { useEffect, useState } from 'react';
import { brokerApi } from '@/lib/api';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

type CallbackState = 'processing' | 'success' | 'error';

interface PendingKiteConnect {
  connectionId: string;
  apiSecret: string;
}

export default function KiteCallbackPage() {
  const [state, setState] = useState<CallbackState>('processing');
  const [message, setMessage] = useState('Finalizing your Kite connection...');

  useEffect(() => {
    const completeKiteConnection = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const requestToken = searchParams.get('request_token');
      const kiteStatus = searchParams.get('status');

      if (kiteStatus === 'error') {
        setState('error');
        setMessage('Kite authorization failed. Please retry from dashboard.');
        notifyParent(false, 'Kite authorization failed');
        return;
      }

      if (!requestToken) {
        setState('error');
        setMessage('Missing request token in Kite callback.');
        notifyParent(false, 'Missing request token');
        return;
      }

      const pendingRaw = sessionStorage.getItem('kite-connect-pending');
      if (!pendingRaw) {
        setState('error');
        setMessage('No pending account connection found. Please restart account setup.');
        notifyParent(false, 'No pending account connection found');
        return;
      }

      let pending: PendingKiteConnect;
      try {
        pending = JSON.parse(pendingRaw) as PendingKiteConnect;
      } catch (error) {
        console.error('Invalid pending kite payload:', error);
        setState('error');
        setMessage('Invalid connection state. Please restart setup.');
        notifyParent(false, 'Invalid pending connection state');
        return;
      }

      if (!pending.connectionId || !pending.apiSecret) {
        setState('error');
        setMessage('Incomplete connection details. Please restart setup.');
        notifyParent(false, 'Incomplete connection details');
        return;
      }

      try {
        await brokerApi.connectKite({
          connectionId: pending.connectionId,
          requestToken,
          apiSecret: pending.apiSecret,
        });

        sessionStorage.removeItem('kite-connect-pending');
        setState('success');
        setMessage('Kite account connected successfully! You can close this window.');
        notifyParent(true);

        setTimeout(() => {
          window.close();
        }, 1200);
      } catch (error: any) {
        console.error('Failed to complete kite connection:', error);
        const failureMessage =
          error?.response?.data?.message ?? 'Failed to complete Kite connection';
        setState('error');
        setMessage(failureMessage);
        notifyParent(false, failureMessage);
      }
    };

    completeKiteConnection();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-slate-700 bg-slate-900 p-8 text-center space-y-4">
        {state === 'processing' && <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-400" />}
        {state === 'success' && <CheckCircle2 className="mx-auto h-10 w-10 text-green-400" />}
        {state === 'error' && <XCircle className="mx-auto h-10 w-10 text-red-400" />}

        <h1 className="text-2xl font-semibold">Kite Account Linking</h1>
        <p className="text-slate-300">{message}</p>
      </div>
    </div>
  );
}

function notifyParent(success: boolean, message?: string) {
  if (!window.opener || window.opener.closed) {
    return;
  }

  window.opener.postMessage(
    {
      type: 'kite-connect-result',
      success,
      message,
    },
    window.location.origin,
  );
}
