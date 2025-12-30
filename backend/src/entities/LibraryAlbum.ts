import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface TrackInfo {
  position: number;
  title: string;
  duration: number;
  tidalId?: string;
  explicit?: boolean;
  isrc?: string;
}

@Entity('library_albums')
@Index(['tidalAlbumId'], { unique: true })
@Index(['userId'])
@Index(['artistName', 'title'])
export class LibraryAlbum {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tidal_album_id', type: 'varchar', length: 255, unique: true })
  tidalAlbumId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'artist_name', type: 'varchar', length: 255 })
  artistName!: string;

  @Column({ name: 'cover_art_url', type: 'varchar', length: 500, nullable: true })
  coverArtUrl: string | null = null;

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: Date | null = null;

  @Column({ name: 'track_count', type: 'integer', default: 0 })
  trackCount!: number;

  @Column({ name: 'track_listing', type: 'jsonb', default: () => "'[]'" })
  trackListing!: TrackInfo[];

  @Column({ type: 'jsonb', nullable: true, default: () => "'{}'" })
  metadata: {
    label?: string;
    genres?: string[];
    explicitContent?: boolean;
    popularity?: number;
  } = {};

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
