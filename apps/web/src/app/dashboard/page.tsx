'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  TrendingUp,
  DollarSign,
  Activity,
  Plus,
  Play,
  Pause,
  Settings,
  Zap,
  Target,
  BarChart3,
  Eye,
  Wallet,
  Sparkles,
  FlaskConical,
  Shield,
} from 'lucide-react';
import { agentsApi, tradesApi, brokerApi } from '@/lib/api';
import { wsService } from '@/lib/websocket';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'agents' | 'accounts'>('overview');

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const userId = localStorage.getItem('userId');
    
    if (!userStr || !userId) {
      router.push('/auth/login');
      return;
    }

    setUser(JSON.parse(userStr));
    
    // Connect to WebSocket
    wsService.connect(userId);

    // Listen for real-time updates
    wsService.onAgentUpdate((data) => {
      console.log('Agent update:', data);
      fetchAgents();
    });

    wsService.onTradeUpdate((data) => {
      console.log('Trade update:', data);
      fetchStats();
    });

    fetchData();

    return () => {
      wsService.disconnect();
    };
  }, [router]);

  const fetchData = async () => {
    try {
      await Promise.all([fetchAgents(), fetchStats(), fetchAccounts()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await agentsApi.getAll();
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await tradesApi.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await brokerApi.getAllAccounts();
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleStartAgent = async (agentId: string) => {
    try {
      await agentsApi.start(agentId);
      fetchAgents();
    } catch (error) {
      console.error('Error starting agent:', error);
    }
  };

  const handleStopAgent = async (agentId: string) => {
    try {
      await agentsApi.stop(agentId);
      fetchAgents();
    } catch (error) {
      console.error('Error stopping agent:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-blue-400 text-xl font-semibold animate-pulse">Initializing Trading Terminal...</p>
        </div>
      </div>
    );
  }

  const totalPnL = stats?.totalPnL || 0;
  const runningAgents = agents.filter((a) => a.status === 'running').length;
  const activeAccounts = accounts.filter((a) => a.status === 'connected').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
        <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative border-b border-blue-500/20 backdrop-blur-xl bg-slate-900/50">
        <div className="max-w-[1920px] mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bot className="w-10 h-10 text-blue-400 animate-pulse" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  NandaX AI Terminal
                </h1>
                <p className="text-blue-400/60 text-sm">Next-Gen Trading Command Center</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 px-4 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-300 text-sm">Live</span>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Welcome back,</p>
                <p className="text-white font-semibold">{user?.name}</p>
              </div>
              <Link
                href="/dashboard/settings"
                className="p-3 hover:bg-blue-500/10 rounded-lg transition-all duration-300 border border-transparent hover:border-blue-500/30"
              >
                <Settings className="w-5 h-5 text-gray-300" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative max-w-[1920px] mx-auto px-8 py-8">
        {/* View Selector */}
        <div className="flex space-x-4 mb-8">
          <ViewButton
            active={activeView === 'overview'}
            onClick={() => setActiveView('overview')}
            icon={<BarChart3 className="w-5 h-5" />}
            label="Overview"
          />
          <ViewButton
            active={activeView === 'agents'}
            onClick={() => setActiveView('agents')}
            icon={<Bot className="w-5 h-5" />}
            label={`AI Agents (${runningAgents}/${agents.length})`}
          />
          <ViewButton
            active={activeView === 'accounts'}
            onClick={() => setActiveView('accounts')}
            icon={<Wallet className="w-5 h-5" />}
            label={`Accounts (${activeAccounts})`}
          />
        </div>

        {/* Stats Grid - Always Visible */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <FuturisticStatCard
            icon={<DollarSign className="w-10 h-10" />}
            title="Total P&L"
            value={`₹${totalPnL.toFixed(2)}`}
            change="+12.5%"
            positive={totalPnL >= 0}
            gradient="from-green-500 to-emerald-500"
          />
          <FuturisticStatCard
            icon={<TrendingUp className="w-10 h-10" />}
            title="Win Rate"
            value={`${stats?.winRate?.toFixed(1) || '0'}%`}
            change="+5.2%"
            positive
            gradient="from-blue-500 to-cyan-500"
          />
          <FuturisticStatCard
            icon={<Zap className="w-10 h-10" />}
            title="Active Agents"
            value={`${runningAgents}/${agents.length}`}
            change={`${runningAgents} running`}
            positive
            gradient="from-purple-500 to-pink-500"
            pulse
          />
          <FuturisticStatCard
            icon={<Wallet className="w-10 h-10" />}
            title="Connected Accounts"
            value={activeAccounts}
            change={`${accounts.length} total`}
            positive
            gradient="from-orange-500 to-red-500"
          />
        </div>

        {/* Dynamic Content Based on View */}
        {activeView === 'overview' && (
          <div className="space-y-8">
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <QuickActionCard
                title="Deploy AI Agent"
                description="Launch intelligent trading agents"
                icon={<Bot className="w-8 h-8" />}
                href="/dashboard/agents/new"
                color="blue"
              />
              <QuickActionCard
                title="Connect Account"
                description="Add new Zerodha account"
                icon={<Wallet className="w-8 h-8" />}
                href="/dashboard/broker"
                color="purple"
              />
              <QuickActionCard
                title="Create Strategy"
                description="Build custom trading strategies"
                icon={<Target className="w-8 h-8" />}
                href="/dashboard/strategies/new"
                color="cyan"
              />
              <QuickActionCard
                title="Run Backtest"
                description="Validate strategy on historical data"
                icon={<FlaskConical className="w-8 h-8" />}
                href="/dashboard/backtesting"
                color="emerald"
              />
              <QuickActionCard
                title="Risk Controls"
                description="Configure kill-switch and exposure limits"
                icon={<Shield className="w-8 h-8" />}
                href="/dashboard/risk"
                color="amber"
              />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ActivityPanel agents={agents.slice(0, 3)} />
              <LiveTradesPanel trades={stats} />
            </div>
          </div>
        )}

        {activeView === 'agents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-3">
                <Sparkles className="w-6 h-6 text-blue-400" />
                <span>AI Trading Agents</span>
              </h2>
              <Link
                href="/dashboard/agents/new"
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                <span className="font-semibold">Deploy New Agent</span>
              </Link>
            </div>

            {agents.length === 0 ? (
              <EmptyState
                icon={<Bot className="w-24 h-24" />}
                title="No AI Agents Deployed"
                description="Create your first intelligent trading agent to start automated trading"
                actionLabel="Create Agent"
                actionHref="/dashboard/agents/new"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <AIAgentCard
                    key={agent.id}
                    agent={agent}
                    onStart={() => handleStartAgent(agent.id)}
                    onStop={() => handleStopAgent(agent.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'accounts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-3">
                <Wallet className="w-6 h-6 text-blue-400" />
                <span>Trading Accounts</span>
              </h2>
              <Link
                href="/dashboard/broker"
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                <span className="font-semibold">Connect Account</span>
              </Link>
            </div>

            {accounts.length === 0 ? (
              <EmptyState
                icon={<Wallet className="w-24 h-24" />}
                title="No Accounts Connected"
                description="Connect your Zerodha trading account to start automated trading"
                actionLabel="Connect Account"
                actionHref="/dashboard/broker"
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {accounts.map((account, index) => (
                  <TradingAccountCard key={index} account={account} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Component definitions continue...
function ViewButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-300 ${
        active
          ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/30'
          : 'bg-slate-800/50 border-2 border-transparent text-gray-400 hover:border-blue-500/30 hover:text-gray-300'
      }`}
    >
      {icon}
      <span className="font-semibold">{label}</span>
    </button>
  );
}

function FuturisticStatCard({ icon, title, value, change, positive, gradient, pulse }: any) {
  return (
    <div className="group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-xl"></div>
      <div className="relative backdrop-blur-xl bg-slate-900/50 rounded-xl p-6 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 transform hover:scale-105">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg bg-gradient-to-br ${gradient} bg-opacity-20 ${pulse ? 'animate-pulse' : ''}`}>
            {icon}
          </div>
          <span className={`text-sm font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}>
            {change}
          </span>
        </div>
        <h3 className="text-gray-400 text-sm mb-2">{title}</h3>
        <p className="text-4xl font-bold text-white">{value}</p>
        {pulse && (
          <div className="absolute top-0 right-0 w-2 h-2 bg-green-400 rounded-full animate-ping m-2"></div>
        )}
      </div>
    </div>
  );
}

function QuickActionCard({ title, description, icon, href, color }: any) {
  const colors = {
    blue: 'from-blue-500 to-cyan-500 hover:shadow-blue-500/50',
    purple: 'from-purple-500 to-pink-500 hover:shadow-purple-500/50',
    cyan: 'from-cyan-500 to-teal-500 hover:shadow-cyan-500/50',
    emerald: 'from-emerald-500 to-lime-500 hover:shadow-emerald-500/50',
    amber: 'from-amber-500 to-orange-500 hover:shadow-amber-500/50',
  };

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl transition-all duration-300 transform hover:scale-105"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900"></div>
      <div className="relative p-6 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300">
        <div className={`inline-block p-3 rounded-lg bg-gradient-to-br ${colors[color as keyof typeof colors]} mb-4`}>
          {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400">{description}</p>
      </div>
    </Link>
  );
}

function AIAgentCard({ agent, onStart, onStop }: any) {
  const statusColors = {
    running: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/50', glow: 'shadow-green-500/50' },
    idle: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/50', glow: 'shadow-gray-500/50' },
    stopped: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/50', glow: 'shadow-red-500/50' },
    paused: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/50', glow: 'shadow-yellow-500/50' },
    error: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/50', glow: 'shadow-red-500/50' },
  };

  const status = statusColors[agent.status as keyof typeof statusColors];

  return (
    <div className="group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-xl"></div>
      <div className="relative backdrop-blur-xl bg-slate-900/50 rounded-xl p-6 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 transform hover:scale-105">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">{agent.name}</h3>
            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${status.bg} ${status.text} ${status.border}`}>
              {agent.status}
            </span>
          </div>
          <div className="flex space-x-2">
            {agent.status === 'running' ? (
              <button
                onClick={onStop}
                className="p-3 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-all duration-300 border border-red-500/30 hover:border-red-500/50 shadow-lg hover:shadow-red-500/50"
              >
                <Pause className="w-5 h-5 text-red-400" />
              </button>
            ) : (
              <button
                onClick={onStart}
                className="p-3 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-all duration-300 border border-green-500/30 hover:border-green-500/50 shadow-lg hover:shadow-green-500/50"
              >
                <Play className="w-5 h-5 text-green-400" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
            <span className="text-gray-400 text-sm">P&L</span>
            <span className={`font-bold text-lg ${agent.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ₹{agent.totalPnL?.toFixed(2) || '0.00'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <span className="text-gray-400 text-xs block mb-1">Trades</span>
              <span className="text-white font-semibold">{agent.totalTrades || 0}</span>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <span className="text-gray-400 text-xs block mb-1">ROI</span>
              <span className="text-white font-semibold">{agent.roi?.toFixed(2) || '0.00'}%</span>
            </div>
          </div>
          <div className="pt-1">
            <Link
              href={`/dashboard/agents/${agent.id}/decision-logs`}
              className="inline-flex items-center space-x-1 text-violet-300 hover:text-violet-200 text-sm"
            >
              <Eye className="w-4 h-4" />
              <span>View AI decision logs</span>
            </Link>
          </div>
        </div>

        {agent.status === 'running' && (
          <div className="absolute top-2 right-2 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
        )}
      </div>
    </div>
  );
}

function TradingAccountCard({ account }: any) {
  const hasError = account.status === 'error';
  
  return (
    <div className="group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-xl"></div>
      <div className="relative backdrop-blur-xl bg-slate-900/50 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {account.profile?.user_name || account.profile?.email || 'Trading Account'}
              </h3>
              <p className="text-gray-400 text-sm">{account.brokerType}</p>
            </div>
          </div>
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
            hasError ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${hasError ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`}></div>
            <span className={`text-xs font-semibold ${hasError ? 'text-red-400' : 'text-green-400'}`}>
              {hasError ? 'Error' : 'Active'}
            </span>
          </div>
        </div>

        {!hasError && account.margins && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Available Margin</p>
              <p className="text-white font-bold text-xl">
                ₹{account.margins.equity?.available?.live_balance?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Used Margin</p>
              <p className="text-white font-bold text-xl">
                ₹{account.margins.equity?.utilised?.debits?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        )}

        {!hasError && (
          <div className="mt-4 flex justify-between items-center text-sm">
            <span className="text-gray-400">
              {account.positions?.net?.length || 0} Positions
            </span>
            <span className="text-gray-400">
              {account.holdings?.length || 0} Holdings
            </span>
            <Link
              href={`/dashboard/accounts/${account.connectionId}`}
              className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition"
            >
              <Eye className="w-4 h-4" />
              <span>View Details</span>
            </Link>
          </div>
        )}

        {hasError && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{account.error || 'Failed to fetch account data'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description, actionLabel, actionHref }: any) {
  return (
    <div className="backdrop-blur-xl bg-slate-900/50 rounded-xl p-12 text-center border border-blue-500/20">
      <div className="inline-block text-gray-600 mb-6">{icon}</div>
      <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
      <p className="text-gray-400 mb-8 max-w-md mx-auto">{description}</p>
      <Link
        href={actionHref}
        className="inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 transform hover:scale-105 font-semibold"
      >
        <Plus className="w-5 h-5" />
        <span>{actionLabel}</span>
      </Link>
    </div>
  );
}

function ActivityPanel({ agents }: any) {
  return (
    <div className="backdrop-blur-xl bg-slate-900/50 rounded-xl p-6 border border-blue-500/20">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
        <Activity className="w-5 h-5 text-blue-400" />
        <span>Active Agents</span>
      </h3>
      <div className="space-y-3">
        {agents.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No active agents</p>
        ) : (
          agents.map((agent: any) => (
            <div key={agent.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${agent.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                <div>
                  <p className="text-white font-semibold">{agent.name}</p>
                  <p className="text-gray-400 text-sm">{agent.status}</p>
                </div>
              </div>
              <p className={`font-semibold ${agent.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ₹{agent.totalPnL?.toFixed(2) || '0.00'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LiveTradesPanel({ trades }: any) {
  return (
    <div className="backdrop-blur-xl bg-slate-900/50 rounded-xl p-6 border border-blue-500/20">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
        <TrendingUp className="w-5 h-5 text-blue-400" />
        <span>Trading Stats</span>
      </h3>
      <div className="space-y-4">
        <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-lg">
          <span className="text-gray-400">Total Trades</span>
          <span className="text-white font-bold text-xl">{trades?.totalTrades || 0}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-lg">
          <span className="text-gray-400">Winning Trades</span>
          <span className="text-green-400 font-bold text-xl">{trades?.winningTrades || 0}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-slate-800/50 rounded-lg">
          <span className="text-gray-400">Losing Trades</span>
          <span className="text-red-400 font-bold text-xl">{trades?.losingTrades || 0}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/30">
          <span className="text-blue-300 font-semibold">Win Rate</span>
          <span className="text-blue-400 font-bold text-2xl">{trades?.winRate?.toFixed(1) || '0'}%</span>
        </div>
      </div>
    </div>
  );
}
