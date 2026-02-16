import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

export enum RiskAlertType {
  KILL_SWITCH_BLOCK = 'kill_switch_block',
  POSITION_NOTIONAL_LIMIT_BREACH = 'position_notional_limit_breach',
  DAILY_LOSS_LIMIT_BREACH = 'daily_loss_limit_breach',
  DAILY_PROFIT_CAP_REACHED = 'daily_profit_cap_reached',
  OPEN_TRADES_LIMIT_BREACH = 'open_trades_limit_breach',
}

@Entity('risk_alerts')
@Index(['userId', 'alertType', 'createdAt'])
export class RiskAlert extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: RiskAlertType })
  alertType: RiskAlertType;

  @Column({ type: 'varchar', length: 500 })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
