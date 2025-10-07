import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

export enum EventType {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  AGENT_CREATED = 'agent_created',
  AGENT_STARTED = 'agent_started',
  AGENT_STOPPED = 'agent_stopped',
  TRADE_EXECUTED = 'trade_executed',
  TRADE_CLOSED = 'trade_closed',
  STRATEGY_CREATED = 'strategy_created',
  BROKER_CONNECTED = 'broker_connected',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  PAGE_VIEW = 'page_view',
  BUTTON_CLICK = 'button_click',
  ERROR_OCCURRED = 'error_occurred',
}

@Entity('analytics_events')
@Index(['userId', 'eventType', 'createdAt'])
@Index(['eventType', 'createdAt'])
export class AnalyticsEvent extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'enum', enum: EventType })
  eventType: EventType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  eventCategory?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  eventLabel?: string;

  @Column({ type: 'jsonb', nullable: true })
  properties?: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referrer?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sessionId?: string;
}
