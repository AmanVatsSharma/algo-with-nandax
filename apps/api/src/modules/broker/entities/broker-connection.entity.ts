import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { User } from '@/modules/users/entities/user.entity';

export enum BrokerType {
  ZERODHA_KITE = 'zerodha_kite',
  // Future brokers can be added here
}

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  EXPIRED = 'expired',
}

@Entity('broker_connections')
@Index(['userId', 'brokerType'])
export class BrokerConnection extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: BrokerType })
  brokerType: BrokerType;

  @Column({ type: 'varchar', length: 255 })
  apiKey: string;

  @Column({ type: 'text', nullable: true })
  accessToken?: string;

  @Column({ type: 'text', nullable: true })
  encryptedAccessToken?: string;

  @Column({ type: 'text', nullable: true })
  encryptedApiSecret?: string;

  @Column({ type: 'text', nullable: true })
  requestToken?: string;

  @Column({ type: 'enum', enum: ConnectionStatus, default: ConnectionStatus.DISCONNECTED })
  status: ConnectionStatus;

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.brokerConnections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
