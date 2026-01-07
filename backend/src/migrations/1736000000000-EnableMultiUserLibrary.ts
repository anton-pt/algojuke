import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

/**
 * Migration: Enable Multi-User Library Support
 *
 * This migration:
 * 1. Updates existing library and conversation records to use the Clerk userId for anton.tcholakov@gmail.com
 * 2. Drops global unique constraints on tidal_album_id and tidal_track_id
 * 3. Creates composite unique constraints on (tidal_album_id, user_id) and (tidal_track_id, user_id)
 *
 * Per spec: All existing data will be associated with anton.tcholakov@gmail.com
 */
export class EnableMultiUserLibrary1736000000000 implements MigrationInterface {
  /**
   * Clerk User ID for anton.tcholakov@gmail.com
   *
   * This application was originally single-user. All existing library albums, tracks,
   * and chat conversations were created without user association. Per the feature 018
   * specification clarification (2026-01-04), all existing data is migrated to be owned
   * by the original user (anton.tcholakov@gmail.com) during the transition to multi-user.
   *
   * This ID is intentionally hardcoded as it represents the historical data owner,
   * not a configurable value.
   */
  private readonly ANTON_USER_ID = "user_37kEhnuC2FIotkGnoA4EQjMOsQn";

  // Old placeholder user ID that may exist in records
  private readonly OLD_PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 0: Alter user_id column type from uuid to varchar(255)
    // Clerk user IDs are strings like "user_37kEhnuC2FIotkGnoA4EQjMOsQn", not UUIDs
    await queryRunner.query(`
      ALTER TABLE library_albums
      ALTER COLUMN user_id TYPE varchar(255) USING user_id::text
    `);

    await queryRunner.query(`
      ALTER TABLE library_tracks
      ALTER COLUMN user_id TYPE varchar(255) USING user_id::text
    `);

    await queryRunner.query(`
      ALTER TABLE conversations
      ALTER COLUMN user_id TYPE varchar(255) USING user_id::text
    `);

    // Step 1: Update existing library_albums to use the correct Clerk userId
    // This handles both placeholder IDs and any other existing values
    await queryRunner.query(
      `
      UPDATE library_albums
      SET user_id = $1
      WHERE user_id != $1 OR user_id IS NULL
    `,
      [this.ANTON_USER_ID],
    );

    // Step 2: Update existing library_tracks to use the correct Clerk userId
    await queryRunner.query(
      `
      UPDATE library_tracks
      SET user_id = $1
      WHERE user_id != $1 OR user_id IS NULL
    `,
      [this.ANTON_USER_ID],
    );

    // Step 3: Update existing conversations to use the correct Clerk userId
    await queryRunner.query(
      `
      UPDATE conversations
      SET user_id = $1
      WHERE user_id != $1 OR user_id IS NULL
    `,
      [this.ANTON_USER_ID],
    );

    // Step 4: Drop the global unique constraint on library_albums.tidal_album_id
    // TypeORM creates these with a specific naming pattern
    try {
      await queryRunner.query(`
        ALTER TABLE library_albums
        DROP CONSTRAINT IF EXISTS "UQ_library_albums_tidal_album_id"
      `);
    } catch {
      // Constraint might have a different name, try the index approach
    }

    // Also try dropping the unique index that TypeORM creates
    try {
      await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_library_albums_tidal_album_id"
      `);
    } catch {
      // Index might not exist
    }

    // Drop the column-level unique constraint if it exists
    // PostgreSQL creates these with auto-generated names
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'library_albums'::regclass
          AND contype = 'u'
          AND array_length(conkey, 1) = 1
          AND conkey[1] = (
            SELECT attnum FROM pg_attribute
            WHERE attrelid = 'library_albums'::regclass
              AND attname = 'tidal_album_id'
          );

        IF constraint_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE library_albums DROP CONSTRAINT ' || quote_ident(constraint_name);
        END IF;
      END $$;
    `);

    // Step 5: Drop the global unique constraint on library_tracks.tidal_track_id
    try {
      await queryRunner.query(`
        ALTER TABLE library_tracks
        DROP CONSTRAINT IF EXISTS "UQ_library_tracks_tidal_track_id"
      `);
    } catch {
      // Constraint might have a different name
    }

    try {
      await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_library_tracks_tidal_track_id"
      `);
    } catch {
      // Index might not exist
    }

    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'library_tracks'::regclass
          AND contype = 'u'
          AND array_length(conkey, 1) = 1
          AND conkey[1] = (
            SELECT attnum FROM pg_attribute
            WHERE attrelid = 'library_tracks'::regclass
              AND attname = 'tidal_track_id'
          );

        IF constraint_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE library_tracks DROP CONSTRAINT ' || quote_ident(constraint_name);
        END IF;
      END $$;
    `);

    // Step 6: Create composite unique index on (tidal_album_id, user_id)
    await queryRunner.createIndex(
      "library_albums",
      new TableIndex({
        name: "IDX_library_albums_tidal_album_user",
        columnNames: ["tidal_album_id", "user_id"],
        isUnique: true,
      }),
    );

    // Step 7: Create composite unique index on (tidal_track_id, user_id)
    await queryRunner.createIndex(
      "library_tracks",
      new TableIndex({
        name: "IDX_library_tracks_tidal_track_user",
        columnNames: ["tidal_track_id", "user_id"],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Drop composite unique indexes
    await queryRunner.dropIndex(
      "library_albums",
      "IDX_library_albums_tidal_album_user",
    );
    await queryRunner.dropIndex(
      "library_tracks",
      "IDX_library_tracks_tidal_track_user",
    );

    // Step 2: Recreate global unique constraints
    // NOTE: This will fail if multiple users have the same album/track
    await queryRunner.query(`
      ALTER TABLE library_albums
      ADD CONSTRAINT "UQ_library_albums_tidal_album_id"
      UNIQUE (tidal_album_id)
    `);

    await queryRunner.query(`
      ALTER TABLE library_tracks
      ADD CONSTRAINT "UQ_library_tracks_tidal_track_id"
      UNIQUE (tidal_track_id)
    `);

    // Step 3: Update user_id to placeholder UUID before type change
    await queryRunner.query(
      `
      UPDATE library_albums SET user_id = $1
    `,
      [this.OLD_PLACEHOLDER_ID],
    );

    await queryRunner.query(
      `
      UPDATE library_tracks SET user_id = $1
    `,
      [this.OLD_PLACEHOLDER_ID],
    );

    await queryRunner.query(
      `
      UPDATE conversations SET user_id = $1
    `,
      [this.OLD_PLACEHOLDER_ID],
    );

    // Step 4: Revert user_id column type from varchar back to uuid
    await queryRunner.query(`
      ALTER TABLE library_albums
      ALTER COLUMN user_id TYPE uuid USING user_id::uuid
    `);

    await queryRunner.query(`
      ALTER TABLE library_tracks
      ALTER COLUMN user_id TYPE uuid USING user_id::uuid
    `);

    await queryRunner.query(`
      ALTER TABLE conversations
      ALTER COLUMN user_id TYPE uuid USING user_id::uuid
    `);
  }
}
