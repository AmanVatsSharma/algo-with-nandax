import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAIGovernanceProfilesTable1700000004000 implements MigrationInterface {
  name = 'AddAIGovernanceProfilesTable1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_governance_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "deletedAt" timestamp NULL,
        "userId" uuid NOT NULL,
        "liveInferenceEnabled" boolean NOT NULL DEFAULT true,
        "dailyCostBudgetUsd" numeric(14, 6) NOT NULL DEFAULT 0,
        "dailyTokenBudget" bigint NOT NULL DEFAULT 0,
        "providerDailyCostBudgetUsd" numeric(14, 6) NOT NULL DEFAULT 0,
        "policyNote" varchar(255) NULL
      );
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_governance_profiles_user" ON ai_governance_profiles ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_governance_profiles_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_governance_profiles`);
  }
}
