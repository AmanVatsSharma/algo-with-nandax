import Link from 'next/link';
import { ArrowRight, Bot, TrendingUp, Shield, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <Bot className="w-8 h-8 text-blue-400" />
              <span className="text-2xl font-bold text-white">Algo with NandaX</span>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/auth/login"
                className="px-4 py-2 text-white hover:text-blue-400 transition"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            AI-Powered
            <span className="block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Algorithmic Trading
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Build, test, and deploy intelligent trading agents powered by AI.
            Integrated with Zerodha Kite for seamless execution.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/auth/register"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2 text-lg font-semibold"
            >
              <span>Start Trading</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-lg font-semibold backdrop-blur-sm"
            >
              View Dashboard
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-24">
          <FeatureCard
            icon={<Bot className="w-8 h-8 text-blue-400" />}
            title="AI Agents"
            description="Deploy intelligent agents that learn and adapt to market conditions"
          />
          <FeatureCard
            icon={<TrendingUp className="w-8 h-8 text-green-400" />}
            title="Strategy Builder"
            description="Create and backtest custom trading strategies with ease"
          />
          <FeatureCard
            icon={<Shield className="w-8 h-8 text-purple-400" />}
            title="Risk Management"
            description="Built-in stop-loss, take-profit, and position sizing controls"
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8 text-yellow-400" />}
            title="Real-time Execution"
            description="Lightning-fast order execution through Zerodha Kite API"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: any) {
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-blue-400/50 transition">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
