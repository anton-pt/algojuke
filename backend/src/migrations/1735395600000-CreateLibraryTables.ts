import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateLibraryTables1735395600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create library_albums table
    await queryRunner.createTable(
      new Table({
        name: 'library_albums',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tidal_album_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'artist_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'cover_art_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'release_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'track_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'track_listing',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
            isNullable: true,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create indexes for library_albums
    await queryRunner.createIndex(
      'library_albums',
      new TableIndex({
        name: 'idx_library_albums_user_id',
        columnNames: ['user_id'],
      })
    );

    await queryRunner.createIndex(
      'library_albums',
      new TableIndex({
        name: 'idx_library_albums_sort',
        columnNames: ['artist_name', 'title'],
      })
    );

    // Create library_tracks table
    await queryRunner.createTable(
      new Table({
        name: 'library_tracks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tidal_track_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'artist_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'album_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'duration',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'cover_art_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
            isNullable: true,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create indexes for library_tracks
    await queryRunner.createIndex(
      'library_tracks',
      new TableIndex({
        name: 'idx_library_tracks_user_id',
        columnNames: ['user_id'],
      })
    );

    await queryRunner.createIndex(
      'library_tracks',
      new TableIndex({
        name: 'idx_library_tracks_sort',
        columnNames: ['artist_name', 'title'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('library_tracks');
    await queryRunner.dropTable('library_albums');
  }
}
