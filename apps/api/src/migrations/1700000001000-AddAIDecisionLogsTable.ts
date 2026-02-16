import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAIDecisionLogsTable1700000001000 implements MigrationInterface {
  name = 'AddAIDecisionLogsTable1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_decision_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "deletedAt" timestamp NULL,
        "userId" uuid NOT NULL,
        "agentId" uuid NOT NULL,
        provider varchar(50) NOT NULL,
        mode varchar(30) NOT NULL DEFAULT 'deterministic',
        model varchar(120) NULL,
        action varchar(10) NOT NULL,
        confidence numeric(6, 4) NOT NULL,
        "estimatedTokens" integer NULL,
        "estimatedCostUsd" numeric(12, 6) NULL,
        reason varchar(500) NULL,
        metadata jsonb NULL
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_decision_logs_user_agent_created" ON ai_decision_logs ("userId", "agentId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_decision_logs_provider_created" ON ai_decision_logs (provider, "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_decision_logs_provider_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_decision_logs_user_agent_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_decision_logs`);
  }
}
