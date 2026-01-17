import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateMixesTable1737158400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "mixes",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "uuid_generate_v4()",
          },
          {
            name: "user_id",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "title",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "description",
            type: "text",
            isNullable: true,
          },
          {
            name: "status",
            type: "varchar",
            length: "20",
            isNullable: false,
            default: "'generating'",
          },
          {
            name: "failure_reason",
            type: "text",
            isNullable: true,
          },
          {
            name: "segments",
            type: "jsonb",
            isNullable: false,
            default: "'[]'",
          },
          {
            name: "total_duration_ms",
            type: "integer",
            isNullable: false,
            default: 0,
          },
          {
            name: "character_count",
            type: "integer",
            isNullable: false,
            default: 0,
          },
          {
            name: "conversation_id",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp with time zone",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp with time zone",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        checks: [
          {
            name: "chk_mixes_status",
            expression: "status IN ('generating', 'ready', 'failed')",
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      "mixes",
      new TableIndex({
        name: "idx_mixes_user_id",
        columnNames: ["user_id"],
      }),
    );

    await queryRunner.createIndex(
      "mixes",
      new TableIndex({
        name: "idx_mixes_status",
        columnNames: ["status"],
      }),
    );

    await queryRunner.createIndex(
      "mixes",
      new TableIndex({
        name: "idx_mixes_updated_at",
        columnNames: ["updated_at"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("mixes", true, true);
  }
}
