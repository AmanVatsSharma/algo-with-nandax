import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrokerConnection, BrokerType, ConnectionStatus } from './entities/broker-connection.entity';
import { KiteService } from './services/kite.service';

@Injectable()
export class BrokerService {
  constructor(
    @InjectRepository(BrokerConnection)
    private readonly brokerConnectionRepository: Repository<BrokerConnection>,
    private readonly kiteService: KiteService,
  ) {}

  async createConnection(
    userId: string,
    brokerType: BrokerType,
    apiKey: string,
  ): Promise<BrokerConnection> {
    const connection = this.brokerConnectionRepository.create({
      userId,
      brokerType,
      apiKey,
      status: ConnectionStatus.DISCONNECTED,
    });

    return this.brokerConnectionRepository.save(connection);
  }

  async getConnectionsByUser(userId: string): Promise<BrokerConnection[]> {
    return this.brokerConnectionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveConnections(userId: string): Promise<BrokerConnection[]> {
    return this.brokerConnectionRepository.find({
      where: {
        userId,
        status: ConnectionStatus.CONNECTED,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllAccountsData(userId: string): Promise<any[]> {
    const connections = await this.getActiveConnections(userId);
    
    const accountsData = await Promise.all(
      connections.map(async (connection) => {
        try {
          const [profile, positions, holdings, margins] = await Promise.all([
            this.kiteService.getProfile(connection.accessToken),
            this.kiteService.getPositions(connection.accessToken),
            this.kiteService.getHoldings(connection.accessToken),
            this.kiteService.getMargins(connection.accessToken),
          ]);

          return {
            connectionId: connection.id,
            brokerType: connection.brokerType,
            status: connection.status,
            profile,
            positions,
            holdings,
            margins,
            lastSynced: new Date(),
          };
        } catch (error) {
          return {
            connectionId: connection.id,
            brokerType: connection.brokerType,
            status: ConnectionStatus.ERROR,
            error: error.message,
          };
        }
      }),
    );

    return accountsData;
  }

  async getConnectionById(connectionId: string): Promise<BrokerConnection> {
    const connection = await this.brokerConnectionRepository.findOne({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('Broker connection not found');
    }

    return connection;
  }

  async getActiveConnection(userId: string, brokerType: BrokerType): Promise<BrokerConnection | null> {
    return this.brokerConnectionRepository.findOne({
      where: {
        userId,
        brokerType,
        status: ConnectionStatus.CONNECTED,
      },
    });
  }

  async updateConnectionStatus(
    connectionId: string,
    status: ConnectionStatus,
    accessToken?: string,
  ): Promise<BrokerConnection> {
    const updateData: any = { status };
    
    if (accessToken) {
      updateData.accessToken = accessToken;
      updateData.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    await this.brokerConnectionRepository.update(connectionId, updateData);
    return this.getConnectionById(connectionId);
  }

  async updateRequestToken(connectionId: string, requestToken: string): Promise<void> {
    await this.brokerConnectionRepository.update(connectionId, { requestToken });
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const result = await this.brokerConnectionRepository.delete(connectionId);
    if (result.affected === 0) {
      throw new NotFoundException('Broker connection not found');
    }
  }

  // Broker-specific methods
  async generateKiteLoginUrl(apiKey: string): Promise<string> {
    return this.kiteService.generateLoginUrl(apiKey);
  }

  async connectKite(connectionId: string, requestToken: string, apiSecret: string): Promise<any> {
    const connection = await this.getConnectionById(connectionId);
    const session = await this.kiteService.generateSession(
      connection.apiKey,
      requestToken,
      apiSecret,
    );

    await this.updateConnectionStatus(
      connectionId,
      ConnectionStatus.CONNECTED,
      session.access_token,
    );

    return session;
  }

  async getKiteProfile(connectionId: string): Promise<any> {
    const connection = await this.getConnectionById(connectionId);
    return this.kiteService.getProfile(connection.accessToken);
  }

  async getKitePositions(connectionId: string): Promise<any> {
    const connection = await this.getConnectionById(connectionId);
    return this.kiteService.getPositions(connection.accessToken);
  }

  async getKiteHoldings(connectionId: string): Promise<any> {
    const connection = await this.getConnectionById(connectionId);
    return this.kiteService.getHoldings(connection.accessToken);
  }

  async placeKiteOrder(connectionId: string, orderData: any): Promise<any> {
    const connection = await this.getConnectionById(connectionId);
    return this.kiteService.placeOrder(connection.accessToken, connection.apiKey, orderData);
  }
}
