import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnterpriseHardeningBaseline1700000000000 implements MigrationInterface {
  name = 'EnterpriseHardeningBaseline1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_status_enum') THEN
          CREATE TYPE audit_status_enum AS ENUM ('success', 'failed');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "deletedAt" timestamp NULL,
        "userId" uuid NULL,
        action varchar(200) NOT NULL,
        "resourceType" varchar(100) NULL,
        "resourceId" varchar(100) NULL,
        status audit_status_enum NOT NULL DEFAULT 'success',
        message varchar(500) NULL,
        metadata jsonb NULL,
        "ipAddress" varchar(100) NULL,
        "userAgent" varchar(255) NULL
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_action_created" ON audit_logs ("userId", action, "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action_created" ON audit_logs (action, "createdAt")`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_alert_type_enum') THEN
          CREATE TYPE risk_alert_type_enum AS ENUM (
            'kill_switch_block',
            'position_notional_limit_breach',
            'daily_loss_limit_breach',
            'daily_profit_cap_reached',
            'open_trades_limit_breach'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS risk_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "deletedAt" timestamp NULL,
        "userId" uuid NOT NULL,
        "killSwitchEnabled" boolean NOT NULL DEFAULT false,
        "maxPositionValuePerTrade" numeric(15, 2) NOT NULL DEFAULT 0,
        "maxDailyLoss" numeric(15, 2) NOT NULL DEFAULT 0,
        "maxDailyProfit" numeric(15, 2) NOT NULL DEFAULT 0,
        "maxOpenTradesPerAgent" integer NOT NULL DEFAULT 0,
        "killSwitchReason" varchar(500) NULL
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_risk_profiles_user" ON risk_profiles ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS risk_alerts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "deletedAt" timestamp NULL,
        "userId" uuid NOT NULL,
        "alertType" risk_alert_type_enum NOT NULL,
        message varchar(500) NOT NULL,
        metadata jsonb NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_risk_alerts_user_type_created" ON risk_alerts ("userId", "alertType", "createdAt")`,
    );

    await queryRunner.query(`
      ALTER TABLE broker_connections
      ADD COLUMN IF NOT EXISTS "encryptedAccessToken" text NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE agents
      ADD COLUMN IF NOT EXISTS "connectionId" uuid NULL;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agents_connectionId" ON agents ("connectionId")`,
    );

    await queryRunner.query(`
      ALTER TABLE trades
      ADD COLUMN IF NOT EXISTS "connectionId" uuid NULL;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_trades_connectionId" ON trades ("connectionId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trades_connectionId"`);
    await queryRunner.query(`ALTER TABLE trades DROP COLUMN IF EXISTS "connectionId"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agents_connectionId"`);
    await queryRunner.query(`ALTER TABLE agents DROP COLUMN IF EXISTS "connectionId"`);

    await queryRunner.query(`ALTER TABLE broker_connections DROP COLUMN IF EXISTS "encryptedAccessToken"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_risk_alerts_user_type_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS risk_alerts`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_risk_profiles_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS risk_profiles`);

    await queryRunner.query(`DROP TYPE IF EXISTS risk_alert_type_enum`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_action_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_user_action_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    await queryRunner.query(`DROP TYPE IF EXISTS audit_status_enum`);
  }
}
