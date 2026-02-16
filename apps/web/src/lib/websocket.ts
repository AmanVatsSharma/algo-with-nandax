import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

class WebSocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;

  connect(userId: string) {
    if (this.socket?.connected) {
      return;
    }

    this.userId = userId;
    const accessToken = localStorage.getItem('accessToken');

    this.socket = io(WS_URL, {
      auth: accessToken
        ? {
            token: `Bearer ${accessToken}`,
          }
        : undefined,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.authenticate();
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  private authenticate() {
    if (this.socket && this.userId) {
      this.socket.emit('authenticate', { userId: this.userId });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribeToMarketData(instruments: string[]) {
    if (this.socket) {
      this.socket.emit('subscribe-market-data', { instruments });
    }
  }

  unsubscribeFromMarketData(instruments: string[]) {
    if (this.socket) {
      this.socket.emit('unsubscribe-market-data', { instruments });
    }
  }

  onMarketTick(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('market-tick', callback);
    }
  }

  onTradeUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('trade-update', callback);
    }
  }

  onAgentUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('agent-update', callback);
    }
  }

  onPortfolioUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('portfolio-update', callback);
    }
  }

  onNotification(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('notification', callback);
    }
  }

  offMarketTick(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off('market-tick', callback);
    }
  }

  offTradeUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off('trade-update', callback);
    }
  }

  offAgentUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off('agent-update', callback);
    }
  }

  offPortfolioUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off('portfolio-update', callback);
    }
  }

  offNotification(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off('notification', callback);
    }
  }
}

export const wsService = new WebSocketService();
