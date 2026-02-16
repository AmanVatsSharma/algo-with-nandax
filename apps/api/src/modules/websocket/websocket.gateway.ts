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
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { getErrorMessage } from '@/common/utils/error.utils';

interface JwtPayload {
  sub: string;
  email?: string;
}

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

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    const token = this.extractTokenFromHandshake(client);
    if (!token) {
      this.logger.warn(`Socket ${client.id} rejected: missing auth token`);
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      await this.usersService.findById(payload.sub);
      this.registerUserSocket(payload.sub, client.id);
      client.data.userId = payload.sub;

      this.logger.log(`Client connected and authenticated: socket=${client.id} userId=${payload.sub}`);
    } catch (error) {
      this.logger.warn(
        `Socket ${client.id} rejected: ${getErrorMessage(error, 'token verification failed')}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return;
    }

    const sockets = this.userSockets.get(userId) ?? [];
    const index = sockets.indexOf(client.id);
    if (index > -1) {
      sockets.splice(index, 1);
    }

    if (sockets.length === 0) {
      this.userSockets.delete(userId);
      return;
    }

    this.userSockets.set(userId, sockets);
  }

  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string },
  ) {
    // Compatibility handler: ignore client-provided userId and trust JWT-authenticated socket data.
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return { success: false, message: 'Socket not authenticated' };
    }

    this.registerUserSocket(userId, client.id);
    this.logger.debug(
      `Authenticate event acknowledged for userId=${userId} socket=${client.id} payloadUserId=${data.userId ?? 'none'}`,
    );
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

  private registerUserSocket(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, []);
    }

    const sockets = this.userSockets.get(userId)!;
    if (!sockets.includes(socketId)) {
      sockets.push(socketId);
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    const handshakeToken =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);

    if (handshakeToken) {
      return handshakeToken.replace(/^Bearer\s+/i, '').trim();
    }

    const authHeader = client.handshake.headers.authorization;
    if (authHeader && typeof authHeader === 'string') {
      return authHeader.replace(/^Bearer\s+/i, '').trim();
    }

    return null;
  }
}
