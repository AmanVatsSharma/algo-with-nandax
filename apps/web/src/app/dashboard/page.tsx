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
} from 'lucide-react';
import { agentsApi, tradesApi } from '@/lib/api';
import { wsService } from '@/lib/websocket';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      await Promise.all([fetchAgents(), fetchStats()]);
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Bot className="w-8 h-8 text-blue-400" />
              <h1 className="text-2xl font-bold text-white">Algo with NandaX</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">Welcome, {user?.name}</span>
              <Link
                href="/dashboard/settings"
                className="p-2 hover:bg-slate-700 rounded-lg transition"
              >
                <Settings className="w-5 h-5 text-gray-300" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<DollarSign className="w-8 h-8 text-green-400" />}
            title="Total P&L"
            value={`₹${stats?.totalPnL?.toFixed(2) || '0.00'}`}
            change="+12.5%"
            positive
          />
          <StatCard
            icon={<TrendingUp className="w-8 h-8 text-blue-400" />}
            title="Win Rate"
            value={`${stats?.winRate?.toFixed(1) || '0'}%`}
            change="+5.2%"
            positive
          />
          <StatCard
            icon={<Activity className="w-8 h-8 text-purple-400" />}
            title="Total Trades"
            value={stats?.totalTrades || 0}
            change="+23"
            positive
          />
          <StatCard
            icon={<Bot className="w-8 h-8 text-cyan-400" />}
            title="Active Agents"
            value={agents.filter((a) => a.status === 'running').length}
            change={`of ${agents.length}`}
            positive
          />
        </div>

        {/* Agents Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">AI Agents</h2>
            <Link
              href="/dashboard/agents/new"
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              <span>Create Agent</span>
            </Link>
          </div>

          {agents.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
              <Bot className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Agents Yet</h3>
              <p className="text-gray-400 mb-6">
                Create your first AI trading agent to get started
              </p>
              <Link
                href="/dashboard/agents/new"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5" />
                <span>Create Agent</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onStart={() => handleStartAgent(agent.id)}
                  onStop={() => handleStopAgent(agent.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickLinkCard
            title="Strategies"
            description="Manage your trading strategies"
            href="/dashboard/strategies"
            icon={<TrendingUp className="w-8 h-8 text-blue-400" />}
          />
          <QuickLinkCard
            title="Portfolio"
            description="View your positions and holdings"
            href="/dashboard/portfolio"
            icon={<DollarSign className="w-8 h-8 text-green-400" />}
          />
          <QuickLinkCard
            title="Broker Connection"
            description="Connect your Zerodha account"
            href="/dashboard/broker"
            icon={<Activity className="w-8 h-8 text-purple-400" />}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, change, positive }: any) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        {icon}
        <span className={`text-sm ${positive ? 'text-green-400' : 'text-red-400'}`}>
          {change}
        </span>
      </div>
      <h3 className="text-gray-400 text-sm mb-1">{title}</h3>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function AgentCard({ agent, onStart, onStop }: any) {
  const statusColors = {
    running: 'bg-green-500/10 text-green-400 border-green-500/50',
    idle: 'bg-gray-500/10 text-gray-400 border-gray-500/50',
    stopped: 'bg-red-500/10 text-red-400 border-red-500/50',
    paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50',
    error: 'bg-red-500/10 text-red-400 border-red-500/50',
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">{agent.name}</h3>
          <span
            className={`inline-block px-2 py-1 text-xs rounded-full border ${
              statusColors[agent.status as keyof typeof statusColors]
            }`}
          >
            {agent.status}
          </span>
        </div>
        <div className="flex space-x-2">
          {agent.status === 'running' ? (
            <button
              onClick={onStop}
              className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
            >
              <Pause className="w-4 h-4 text-white" />
            </button>
          ) : (
            <button
              onClick={onStart}
              className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition"
            >
              <Play className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">P&L:</span>
          <span
            className={`font-semibold ${
              agent.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            ₹{agent.totalPnL?.toFixed(2) || '0.00'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Trades:</span>
          <span className="text-white">{agent.totalTrades || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">ROI:</span>
          <span className="text-white">{agent.roi?.toFixed(2) || '0.00'}%</span>
        </div>
      </div>
    </div>
  );
}

function QuickLinkCard({ title, description, href, icon }: any) {
  return (
    <Link
      href={href}
      className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition group"
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition">
        {title}
      </h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </Link>
  );
}
