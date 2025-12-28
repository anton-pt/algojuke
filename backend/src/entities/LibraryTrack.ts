import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('library_tracks')
@Index(['tidalTrackId'], { unique: true })
@Index(['userId'])
@Index(['artistName', 'title'])
export class LibraryTrack {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tidal_track_id', type: 'varchar', length: 255, unique: true })
  tidalTrackId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'artist_name', type: 'varchar', length: 255 })
  artistName!: string;

  @Column({ name: 'album_name', type: 'varchar', length: 255, nullable: true })
  albumName: string | null = null;

  @Column({ type: 'integer' })
  duration!: number;

  @Column({ name: 'cover_art_url', type: 'varchar', length: 500, nullable: true })
  coverArtUrl: string | null = null;

  @Column({ type: 'jsonb', nullable: true, default: () => "'{}'" })
  metadata: {
    isrc?: string;
    explicitContent?: boolean;
    popularity?: number;
    genres?: string[];
  } = {};

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
