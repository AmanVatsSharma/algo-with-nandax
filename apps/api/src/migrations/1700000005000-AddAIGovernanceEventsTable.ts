import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAIGovernanceEventsTable1700000005000 implements MigrationInterface {
  name = 'AddAIGovernanceEventsTable1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_governance_events (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "deletedAt" timestamp NULL,
        "userId" uuid NOT NULL,
        "agentId" uuid NULL,
        provider varchar(50) NOT NULL,
        "eventType" varchar(80) NOT NULL,
        blocked boolean NOT NULL DEFAULT false,
        reason varchar(500) NULL,
        metadata jsonb NULL
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_governance_events_user_createdAt" ON ai_governance_events ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_governance_events_provider_createdAt" ON ai_governance_events (provider, "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_governance_events_provider_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_governance_events_user_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS ai_governance_events`);
  }
}
