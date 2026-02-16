import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAICostLedgerTable1700000003000 implements MigrationInterface {
  name = 'AddAICostLedgerTable1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_cost_ledger (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "deletedAt" timestamp NULL,
        "userId" uuid NOT NULL,
        "ledgerDate" date NOT NULL,
        provider varchar(50) NOT NULL,
        mode varchar(30) NOT NULL,
        "decisionCount" integer NOT NULL DEFAULT 0,
        "totalTokens" integer NOT NULL DEFAULT 0,
        "totalCostUsd" numeric(14, 6) NOT NULL DEFAULT 0,
        "avgConfidence" numeric(8, 4) NOT NULL DEFAULT 0,
        "minConfidence" numeric(8, 4) NOT NULL DEFAULT 0,
        "maxConfidence" numeric(8, 4) NOT NULL DEFAULT 0
      );
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_cost_ledger_user_date_provider_mode" ON ai_cost_ledger ("userId", "ledgerDate", provider, mode)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_cost_ledger_date_provider" ON ai_cost_ledger ("ledgerDate", provider)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_cost_ledger_date_provider"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_cost_ledger_user_date_provider_mode"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_cost_ledger`);
  }
}
