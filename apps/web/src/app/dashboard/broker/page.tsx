'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Wallet, 
  Plus, 
  Check, 
  X, 
  RefreshCw, 
  ExternalLink,
  Shield,
  Zap,
  TrendingUp
} from 'lucide-react';
import { brokerApi } from '@/lib/api';

export default function BrokerPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);

  useEffect(() => {
    fetchData();

    const handleKiteConnectMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type !== 'kite-connect-result') {
        return;
      }

      console.log('Received kite connect message:', event.data);

      if (event.data.success) {
        fetchData();
        setShowConnectModal(false);
        return;
      }

      alert(event.data.message || 'Failed to connect Kite account');
    };

    window.addEventListener('message', handleKiteConnectMessage);

    return () => {
      window.removeEventListener('message', handleKiteConnectMessage);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [connectionsRes, accountsRes] = await Promise.all([
        brokerApi.getConnections(),
        brokerApi.getAllAccounts(),
      ]);
      setConnections(connectionsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-blue-400 text-xl font-semibold animate-pulse">Loading Accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white mb-6 flex items-center space-x-2 transition"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
                Trading Accounts
              </h1>
              <p className="text-gray-400">Connect and manage your Zerodha trading accounts</p>
            </div>
            <button
              onClick={() => setShowConnectModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 transform hover:scale-105 font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span>Connect New Account</span>
            </button>
          </div>
        </div>

        {/* Features Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <FeatureCard
            icon={<Shield className="w-8 h-8" />}
            title="Secure OAuth"
            description="Bank-level security with OAuth 2.0"
            color="blue"
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="Real-time Sync"
            description="Live position and margin updates"
            color="yellow"
          />
          <FeatureCard
            icon={<TrendingUp className="w-8 h-8" />}
            title="Multi-Account"
            description="Manage unlimited trading accounts"
            color="green"
          />
        </div>

        {/* Connected Accounts */}
        {accounts.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Connected Accounts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {accounts.map((account, index) => (
                <ConnectedAccountCard key={index} account={account} onRefresh={fetchData} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState onConnect={() => setShowConnectModal(true)} />
        )}

        {/* Pending Connections */}
        {connections.some(c => c.status !== 'connected') && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">Pending Connections</h2>
            <div className="space-y-4">
              {connections
                .filter(c => c.status !== 'connected')
                .map((connection) => (
                  <PendingConnectionCard
                    key={connection.id}
                    connection={connection}
                    onRefresh={fetchData}
                  />
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <ConnectAccountModal
          onClose={() => setShowConnectModal(false)}
          onSuccess={() => {
            setShowConnectModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function FeatureCard({ icon, title, description, color }: any) {
  const colors = {
    blue: 'from-blue-500 to-cyan-500',
    yellow: 'from-yellow-500 to-orange-500',
    green: 'from-green-500 to-emerald-500',
  };

  return (
    <div className="backdrop-blur-xl bg-slate-900/50 rounded-xl p-6 border border-blue-500/20">
      <div className={`inline-block p-3 rounded-lg bg-gradient-to-br ${colors[color as keyof typeof colors]} mb-4`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

function ConnectedAccountCard({ account, onRefresh }: any) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;
    
    setDeleting(true);
    try {
      await brokerApi.deleteConnection(account.connectionId);
      onRefresh();
    } catch (error) {
      console.error('Error deleting connection:', error);
    } finally {
      setDeleting(false);
    }
  };

  const hasError = account.status === 'error';
  
  return (
    <div className="group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-xl"></div>
      <div className="relative backdrop-blur-xl bg-slate-900/50 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                {account.profile?.user_name || account.profile?.email || 'Trading Account'}
              </h3>
              <p className="text-gray-400 text-sm">{account.profile?.user_id || 'Zerodha'}</p>
            </div>
          </div>
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
            hasError ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'
          }`}>
            {hasError ? (
              <X className="w-4 h-4 text-red-400" />
            ) : (
              <Check className="w-4 h-4 text-green-400" />
            )}
            <span className={`text-xs font-semibold ${hasError ? 'text-red-400' : 'text-green-400'}`}>
              {hasError ? 'Error' : 'Connected'}
            </span>
          </div>
        </div>

        {!hasError && account.margins ? (
          <>
            {/* Margins */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
                <p className="text-green-400 text-xs font-semibold mb-1">Available Funds</p>
                <p className="text-white font-bold text-2xl">
                  ₹{(account.margins.equity?.available?.live_balance || 0).toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/20">
                <p className="text-orange-400 text-xs font-semibold mb-1">Used Margin</p>
                <p className="text-white font-bold text-2xl">
                  ₹{(account.margins.equity?.utilised?.debits || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Positions</p>
                <p className="text-white font-bold text-lg">{account.positions?.net?.length || 0}</p>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Holdings</p>
                <p className="text-white font-bold text-lg">{account.holdings?.length || 0}</p>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Orders</p>
                <p className="text-white font-bold text-lg">0</p>
              </div>
            </div>
          </>
        ) : hasError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{account.error || 'Failed to fetch account data'}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={onRefresh}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition border border-blue-500/30"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="font-semibold">Refresh</span>
          </button>
          <button
            onClick={() => window.open(`/dashboard/accounts/${account.connectionId}`, '_blank')}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition border border-purple-500/30"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="font-semibold">View Details</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition border border-red-500/30 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Last Synced */}
        {account.lastSynced && (
          <p className="text-gray-500 text-xs mt-4 text-center">
            Last synced: {new Date(account.lastSynced).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

function PendingConnectionCard({ connection, onRefresh }: any) {
  return (
    <div className="backdrop-blur-xl bg-slate-900/50 rounded-xl p-6 border border-yellow-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-yellow-500/20 rounded-lg">
            <Wallet className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Pending Connection</h3>
            <p className="text-gray-400 text-sm">Status: {connection.status}</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition border border-yellow-500/30"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onConnect }: any) {
  return (
    <div className="backdrop-blur-xl bg-slate-900/50 rounded-xl p-16 text-center border border-purple-500/20">
      <div className="inline-block p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full mb-6">
        <Wallet className="w-24 h-24 text-purple-400" />
      </div>
      <h2 className="text-3xl font-bold text-white mb-4">No Accounts Connected</h2>
      <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
        Connect your Zerodha trading account to start automated trading with AI-powered agents.
        You can connect multiple accounts for diversified trading strategies.
      </p>
      <button
        onClick={onConnect}
        className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 transform hover:scale-105 font-semibold text-lg"
      >
        <Plus className="w-6 h-6" />
        <span>Connect Your First Account</span>
      </button>
    </div>
  );
}

function ConnectAccountModal({ onClose, onSuccess }: any) {
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionId, setConnectionId] = useState('');

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!apiSecret) {
      alert('Please enter your Zerodha API Secret');
      setLoading(false);
      return;
    }

    try {
      // Create connection
      const response = await brokerApi.createConnection({
        brokerType: 'zerodha_kite',
        apiKey,
      });
      setConnectionId(response.data.id);

      sessionStorage.setItem(
        'kite-connect-pending',
        JSON.stringify({
          connectionId: response.data.id,
          apiSecret,
        }),
      );

      setStep(2);
    } catch (error) {
      console.error('Error creating connection:', error);
      alert('Failed to create connection');
    } finally {
      setLoading(false);
    }
  };

  const handleGetLoginUrl = async () => {
    try {
      const response = await brokerApi.getKiteLoginUrl(apiKey);

      sessionStorage.setItem(
        'kite-connect-pending',
        JSON.stringify({
          connectionId,
          apiSecret,
        }),
      );

      window.open(
        response.data.loginUrl,
        '_blank',
        'popup=yes,width=540,height=760,left=200,top=120',
      );
      setStep(3);
    } catch (error) {
      console.error('Error getting login URL:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative max-w-2xl w-full">
        <div className="backdrop-blur-xl bg-slate-900/90 rounded-2xl p-8 border border-purple-500/30 shadow-2xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4">
              <Wallet className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Connect Zerodha Account</h2>
            <p className="text-gray-400">Step {step} of 3</p>
          </div>

          {/* Step 1: Enter API Key */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Zerodha API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  placeholder="Enter your Kite API Key"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  Get your API key from{' '}
                  <a
                    href="https://kite.trade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300"
                  >
                    Kite Connect
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Zerodha API Secret
                </label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  placeholder="Enter your Kite API Secret"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  This value is used once to exchange request token securely.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !apiKey || !apiSecret}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 disabled:opacity-50 font-semibold"
              >
                {loading ? 'Creating Connection...' : 'Continue'}
              </button>
            </form>
          )}

          {/* Step 2: OAuth Login */}
          {step === 2 && (
            <div className="text-center space-y-6">
              <p className="text-gray-300">
                Click the button below to login with your Zerodha account and authorize the connection.
              </p>
              <button
                onClick={handleGetLoginUrl}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 font-semibold text-lg flex items-center justify-center space-x-2"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Login with Zerodha</span>
              </button>
            </div>
          )}

          {/* Step 3: Waiting for OAuth */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-gray-300">
                Waiting for authorization... Complete the login in the popup window.
              </p>
              <p className="text-gray-500 text-sm">
                Once completed, your account will be connected automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
