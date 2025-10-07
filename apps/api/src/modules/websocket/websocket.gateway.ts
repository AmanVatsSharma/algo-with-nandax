import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Remove socket from user mappings
    this.userSockets.forEach((sockets, userId) => {
      const index = sockets.indexOf(client.id);
      if (index > -1) {
        sockets.splice(index, 1);
        if (sockets.length === 0) {
          this.userSockets.delete(userId);
        }
      }
    });
  }

  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;
    
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, []);
    }
    
    const sockets = this.userSockets.get(userId);
    if (!sockets.includes(client.id)) {
      sockets.push(client.id);
    }

    this.logger.log(`User ${userId} authenticated on socket ${client.id}`);
    return { success: true, message: 'Authenticated successfully' };
  }

  @SubscribeMessage('subscribe-market-data')
  handleSubscribeMarketData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instruments: string[] },
  ) {
    const { instruments } = data;
    this.logger.log(`Client ${client.id} subscribed to: ${instruments.join(', ')}`);
    
    // Join rooms for each instrument
    instruments.forEach((instrument) => {
      client.join(`market:${instrument}`);
    });

    return { success: true, subscribed: instruments };
  }

  @SubscribeMessage('unsubscribe-market-data')
  handleUnsubscribeMarketData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instruments: string[] },
  ) {
    const { instruments } = data;
    this.logger.log(`Client ${client.id} unsubscribed from: ${instruments.join(', ')}`);
    
    // Leave rooms for each instrument
    instruments.forEach((instrument) => {
      client.leave(`market:${instrument}`);
    });

    return { success: true, unsubscribed: instruments };
  }

  // Emit methods to send data to clients

  /**
   * Send market tick data to all subscribers of an instrument
   */
  emitMarketTick(instrument: string, data: any) {
    this.server.to(`market:${instrument}`).emit('market-tick', {
      instrument,
      ...data,
    });
  }

  /**
   * Send trade update to a specific user
   */
  emitTradeUpdate(userId: string, tradeData: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('trade-update', tradeData);
      });
    }
  }

  /**
   * Send agent status update to a specific user
   */
  emitAgentUpdate(userId: string, agentData: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('agent-update', agentData);
      });
    }
  }

  /**
   * Send portfolio update to a specific user
   */
  emitPortfolioUpdate(userId: string, portfolioData: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('portfolio-update', portfolioData);
      });
    }
  }

  /**
   * Send notification to a specific user
   */
  emitNotification(userId: string, notification: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('notification', notification);
      });
    }
  }

  /**
   * Broadcast system message to all connected clients
   */
  broadcastSystemMessage(message: string) {
    this.server.emit('system-message', { message, timestamp: new Date() });
  }
}
