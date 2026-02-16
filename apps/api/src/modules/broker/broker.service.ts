import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrokerConnection, BrokerType, ConnectionStatus } from './entities/broker-connection.entity';
import { KiteOrderHistoryEntry, KiteService } from './services/kite.service';
import { getErrorMessage } from '@/common/utils/error.utils';
import { TokenCryptoService } from '@/common/services/token-crypto.service';

@Injectable()
export class BrokerService {
  constructor(
    @InjectRepository(BrokerConnection)
    private readonly brokerConnectionRepository: Repository<BrokerConnection>,
    private readonly kiteService: KiteService,
    private readonly tokenCryptoService: TokenCryptoService,
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
    const connections = await this.brokerConnectionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return connections.map((connection) => this.sanitizeConnection(connection));
  }

  async getActiveConnections(userId: string): Promise<BrokerConnection[]> {
    const connections = await this.getActiveConnectionsInternal(userId);
    return connections.map((connection) => this.sanitizeConnection(connection));
  }

  private async getActiveConnectionsInternal(userId: string): Promise<BrokerConnection[]> {
    const connections = await this.brokerConnectionRepository.find({
      where: {
        userId,
        status: ConnectionStatus.CONNECTED,
      },
      order: { createdAt: 'DESC' },
    });

    return connections.map((connection) => this.resolveAccessToken(connection));
  }

  async getAllAccountsData(userId: string): Promise<any[]> {
    const connections = await this.getActiveConnectionsInternal(userId);
    
    const accountsData = await Promise.all(
      connections.map(async (connection) => {
        try {
          const [profile, positions, holdings, margins] = await Promise.all([
            this.kiteService.getProfile(connection.accessToken, connection.apiKey),
            this.kiteService.getPositions(connection.accessToken, connection.apiKey),
            this.kiteService.getHoldings(connection.accessToken, connection.apiKey),
            this.kiteService.getMargins(connection.accessToken, connection.apiKey),
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
            error: getErrorMessage(error, 'Failed to fetch account snapshot'),
          };
        }
      }),
    );

    return accountsData;
  }

  async getConnectionById(connectionId: string, userId?: string): Promise<BrokerConnection> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
    return this.sanitizeConnection(connection);
  }

  private async getConnectionByIdInternal(
    connectionId: string,
    userId?: string,
  ): Promise<BrokerConnection> {
    const whereClause = userId ? { id: connectionId, userId } : { id: connectionId };
    const connection = await this.brokerConnectionRepository.findOne({
      where: whereClause,
    });

    if (!connection) {
      throw new NotFoundException('Broker connection not found');
    }

    return this.resolveAccessToken(connection);
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
      updateData.accessToken = null;
      updateData.encryptedAccessToken = this.tokenCryptoService.encrypt(accessToken);
      updateData.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    await this.brokerConnectionRepository.update(connectionId, updateData);
    return this.getConnectionByIdInternal(connectionId);
  }

  async updateRequestToken(connectionId: string, requestToken: string): Promise<void> {
    await this.brokerConnectionRepository.update(connectionId, { requestToken });
  }

  async deleteConnection(connectionId: string, userId: string): Promise<void> {
    const result = await this.brokerConnectionRepository.delete({
      id: connectionId,
      userId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Broker connection not found');
    }
  }

  // Broker-specific methods
  async generateKiteLoginUrl(apiKey: string): Promise<string> {
    return this.kiteService.generateLoginUrl(apiKey);
  }

  async connectKite(
    userId: string,
    connectionId: string,
    requestToken: string,
    apiSecret: string,
  ): Promise<any> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
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

    return {
      ...session,
      access_token: undefined,
      public_token: undefined,
    };
  }

  async getKiteProfile(userId: string, connectionId: string): Promise<any> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
    return this.kiteService.getProfile(this.requireAccessToken(connection), connection.apiKey);
  }

  async getKitePositions(userId: string, connectionId: string): Promise<any> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
    return this.kiteService.getPositions(this.requireAccessToken(connection), connection.apiKey);
  }

  async getKiteHoldings(userId: string, connectionId: string): Promise<any> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
    return this.kiteService.getHoldings(this.requireAccessToken(connection), connection.apiKey);
  }

  async placeKiteOrder(userId: string, connectionId: string, orderData: any): Promise<any> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
    return this.kiteService.placeOrder(this.requireAccessToken(connection), connection.apiKey, orderData);
  }

  async getKiteQuotes(userId: string, connectionId: string, instruments: string[]): Promise<any> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
    return this.kiteService.getQuote(
      this.requireAccessToken(connection),
      instruments,
      connection.apiKey,
    );
  }

  async getKiteOHLC(userId: string, connectionId: string, instruments: string[]): Promise<any> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
    return this.kiteService.getOHLC(this.requireAccessToken(connection), instruments, connection.apiKey);
  }

  async getKiteHistoricalData(
    userId: string,
    connectionId: string,
    instrumentToken: string,
    interval: string,
    fromDate: string,
    toDate: string,
  ): Promise<any> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
    return this.kiteService.getHistoricalData(
      this.requireAccessToken(connection),
      instrumentToken,
      interval,
      fromDate,
      toDate,
      connection.apiKey,
    );
  }

  async getKiteOrderHistory(
    userId: string,
    connectionId: string,
    orderId: string,
  ): Promise<KiteOrderHistoryEntry[]> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
    return this.kiteService.getOrderHistory(
      this.requireAccessToken(connection),
      orderId,
      connection.apiKey,
    );
  }

  async getKiteLatestOrderState(
    userId: string,
    connectionId: string,
    orderId: string,
  ): Promise<KiteOrderHistoryEntry | null> {
    const connection = await this.getConnectionByIdInternal(connectionId, userId);
    return this.kiteService.getLatestOrderState(
      this.requireAccessToken(connection),
      orderId,
      connection.apiKey,
    );
  }

  private requireAccessToken(connection: BrokerConnection): string {
    if (!connection.accessToken) {
      throw new NotFoundException('Active broker access token not found. Please reconnect broker.');
    }

    return connection.accessToken;
  }

  private resolveAccessToken(connection: BrokerConnection): BrokerConnection {
    if (connection.encryptedAccessToken) {
      connection.accessToken = this.tokenCryptoService.decrypt(connection.encryptedAccessToken);
      return connection;
    }

    // Backward compatibility for legacy rows where accessToken was stored in plaintext.
    if (connection.accessToken) {
      return connection;
    }

    return connection;
  }

  private sanitizeConnection(connection: BrokerConnection): BrokerConnection {
    const copy = { ...connection };
    copy.accessToken = undefined;
    copy.encryptedAccessToken = undefined;
    copy.encryptedApiSecret = undefined;
    copy.requestToken = undefined;
    return copy;
  }
}
