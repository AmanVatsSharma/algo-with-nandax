import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const userId = localStorage.getItem('userId');

        if (userId) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            userId,
          }, {
            withCredentials: true,
          });

          const { accessToken } = response.data;
          localStorage.setItem('accessToken', accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.clear();
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

// API methods
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.post('/auth/me'),
};

export const strategiesApi = {
  getAll: () => api.get('/strategies'),
  getById: (id: string) => api.get(`/strategies/${id}`),
  create: (data: any) => api.post('/strategies', data),
  update: (id: string, data: any) => api.patch(`/strategies/${id}`, data),
  delete: (id: string) => api.delete(`/strategies/${id}`),
  updateStatus: (id: string, status: string) =>
    api.patch(`/strategies/${id}/status`, { status }),
};

export const agentsApi = {
  getAll: () => api.get('/agents'),
  getById: (id: string) => api.get(`/agents/${id}`),
  getDecisionLogs: (id: string, limit: number = 100) =>
    api.get(`/agents/${id}/decision-logs?limit=${limit}`),
  create: (data: any) => api.post('/agents', data),
  update: (id: string, data: any) => api.patch(`/agents/${id}`, data),
  delete: (id: string) => api.delete(`/agents/${id}`),
  start: (id: string) => api.post(`/agents/${id}/start`),
  stop: (id: string) => api.post(`/agents/${id}/stop`),
  pause: (id: string) => api.post(`/agents/${id}/pause`),
};

export const tradesApi = {
  getAll: () => api.get('/trades'),
  getById: (id: string) => api.get(`/trades/${id}`),
  getByAgent: (agentId: string) => api.get(`/trades/agent/${agentId}`),
  getToday: () => api.get('/trades/today'),
  getStats: () => api.get('/trades/stats'),
  execute: (data: any) => api.post('/trades', data),
  close: (id: string, data: any) => api.post(`/trades/${id}/close`, data),
  reconcile: (data: { connectionId?: string; tradeId?: string; maxItems?: number }) =>
    api.post('/trades/reconcile', data),
};

export const brokerApi = {
  getConnections: () => api.get('/broker/connections'),
  getAllAccounts: () => api.get('/broker/accounts/all'),
  getActiveAccounts: () => api.get('/broker/accounts/active'),
  createConnection: (data: { brokerType: string; apiKey: string }) =>
    api.post('/broker/connection', data),
  deleteConnection: (id: string) => api.delete(`/broker/connection/${id}`),
  getKiteLoginUrl: (apiKey: string) => api.get(`/broker/kite/login-url?apiKey=${apiKey}`),
  connectKite: (data: { connectionId: string; requestToken: string; apiSecret: string }) =>
    api.post('/broker/kite/connect', data),
  getKiteProfile: (connectionId: string) => api.get(`/broker/kite/profile/${connectionId}`),
  getKitePositions: (connectionId: string) => api.get(`/broker/kite/positions/${connectionId}`),
  getKiteHoldings: (connectionId: string) => api.get(`/broker/kite/holdings/${connectionId}`),
};

export const portfolioApi = {
  getAll: () => api.get('/portfolios'),
  getById: (id: string) => api.get(`/portfolios/${id}`),
  create: (data: any) => api.post('/portfolios', data),
  update: (id: string, data: any) => api.patch(`/portfolios/${id}`, data),
  getPositions: (id: string) => api.get(`/portfolios/${id}/positions`),
  getOpenPositions: (id: string) => api.get(`/portfolios/${id}/positions/open`),
};

export const backtestingApi = {
  run: (data: {
    connectionId: string;
    instrumentToken: string;
    interval: string;
    fromDate: string;
    toDate: string;
    quantity?: number;
    entryThresholdPercent?: number;
    exitThresholdPercent?: number;
    feePerTrade?: number;
    slippageBps?: number;
    impactBps?: number;
    maxParticipationRate?: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    walkForwardWindows?: number;
    initialCapital?: number;
  }) => api.post('/backtesting/run', data),
  runPortfolio: (data: {
    connectionId: string;
    instrumentTokens: string[];
    weights?: number[];
    interval: string;
    fromDate: string;
    toDate: string;
    quantity?: number;
    entryThresholdPercent?: number;
    exitThresholdPercent?: number;
    feePerTrade?: number;
    slippageBps?: number;
    impactBps?: number;
    maxParticipationRate?: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    walkForwardWindows?: number;
    initialCapital?: number;
  }) => api.post('/backtesting/run-portfolio', data),
  optimize: (data: {
    connectionId: string;
    instrumentToken: string;
    interval: string;
    fromDate: string;
    toDate: string;
    quantity?: number;
    feePerTrade?: number;
    slippageBps?: number;
    impactBps?: number;
    maxParticipationRate?: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    walkForwardWindows?: number;
    initialCapital?: number;
    entryThresholdCandidates?: number[];
    exitThresholdCandidates?: number[];
    topN?: number;
  }) => api.post('/backtesting/optimize', data),
};

export const riskApi = {
  getProfile: () => api.get('/risk/profile'),
  updateProfile: (data: {
    maxPositionValuePerTrade?: number;
    maxDailyLoss?: number;
    maxDailyProfit?: number;
    maxOpenTradesPerAgent?: number;
    killSwitchEnabled?: boolean;
    killSwitchReason?: string;
  }) => api.patch('/risk/profile', data),
  enableKillSwitch: (reason?: string) => api.post('/risk/kill-switch/enable', { reason }),
  disableKillSwitch: () => api.post('/risk/kill-switch/disable'),
  getAlerts: (limit: number = 50) => api.get(`/risk/alerts?limit=${limit}`),
  getAnalytics: (params?: { days?: number; confidenceLevel?: number }) => {
    const search = new URLSearchParams();
    if (params?.days) {
      search.set('days', String(params.days));
    }
    if (params?.confidenceLevel) {
      search.set('confidenceLevel', String(params.confidenceLevel));
    }
    const queryString = search.toString();
    return api.get(`/risk/analytics${queryString ? `?${queryString}` : ''}`);
  },
};
