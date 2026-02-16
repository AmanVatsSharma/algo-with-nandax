import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAIGovernancePolicyRequestsTable1700000006000 implements MigrationInterface {
  name = 'AddAIGovernancePolicyRequestsTable1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_governance_policy_requests (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "deletedAt" timestamp NULL,
        "requestedByUserId" uuid NOT NULL,
        "targetUserId" uuid NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        "requestedPolicy" jsonb NOT NULL,
        "requestNote" varchar(255) NULL,
        "reviewedByUserId" uuid NULL,
        "reviewNote" varchar(255) NULL,
        "reviewedAt" timestamp NULL
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_gov_policy_requests_target_status_created" ON ai_governance_policy_requests ("targetUserId", status, "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_gov_policy_requests_requestedBy_created" ON ai_governance_policy_requests ("requestedByUserId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_gov_policy_requests_requestedBy_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_gov_policy_requests_target_status_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS ai_governance_policy_requests`);
  }
}
