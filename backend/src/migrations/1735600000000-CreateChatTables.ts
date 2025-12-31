import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateChatTables1735600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create conversations table
    await queryRunner.createTable(
      new Table({
        name: 'conversations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'conversations',
      new TableIndex({ name: 'idx_conversations_user_id', columnNames: ['user_id'] })
    );
    await queryRunner.createIndex(
      'conversations',
      new TableIndex({ name: 'idx_conversations_updated_at', columnNames: ['updated_at'] })
    );

    // Create messages table
    await queryRunner.createTable(
      new Table({
        name: 'messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'conversation_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'jsonb',
            isNullable: false,
            default: "'[]'",
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        checks: [
          {
            name: 'chk_messages_role',
            expression: "role IN ('user', 'assistant')",
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'messages',
      new TableIndex({ name: 'idx_messages_conversation_id', columnNames: ['conversation_id'] })
    );
    await queryRunner.createIndex(
      'messages',
      new TableIndex({ name: 'idx_messages_created_at', columnNames: ['created_at'] })
    );

    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({
        name: 'fk_messages_conversation',
        columnNames: ['conversation_id'],
        referencedTableName: 'conversations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('messages', true, true);
    await queryRunner.dropTable('conversations', true, true);
  }
}
