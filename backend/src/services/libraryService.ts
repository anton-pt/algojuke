import 'reflect-metadata';
import { Repository } from 'typeorm';
import { LibraryAlbum, TrackInfo } from '../entities/LibraryAlbum.js';
import { LibraryTrack } from '../entities/LibraryTrack.js';
import { TidalService } from './tidalService.js';
import { IngestionScheduler } from './ingestionScheduler.js';
import {
  LibraryError,
  DuplicateItemError,
  TidalApiError,
  isDuplicateError,
  mapPostgresError,
} from '../utils/errors.js';
import {
  TimeoutError,
  RateLimitError,
  ApiUnavailableError,
} from '../types/errors.js';
import { logger } from '../utils/logger.js';

export class LibraryService {
  private albumRepository: Repository<LibraryAlbum>;
  private trackRepository: Repository<LibraryTrack>;
  private tidalService: TidalService;
  private ingestionScheduler: IngestionScheduler | null;

  constructor(
    albumRepository: Repository<LibraryAlbum>,
    trackRepository: Repository<LibraryTrack>,
    tidalService: TidalService,
    ingestionScheduler?: IngestionScheduler
  ) {
    this.albumRepository = albumRepository;
    this.trackRepository = trackRepository;
    this.tidalService = tidalService;
    this.ingestionScheduler = ingestionScheduler ?? null;
  }

  /**
   * Add an album to the user's library
   *
   * @param tidalAlbumId - Tidal album identifier
   * @param userId - User identifier
   * @returns The created LibraryAlbum entity
   * @throws DuplicateItemError if album already exists in library
   * @throws TidalApiError if Tidal API is unavailable
   * @throws LibraryError for other storage errors
   */
  async addAlbumToLibrary(tidalAlbumId: string, userId: string): Promise<LibraryAlbum> {
    const startTime = Date.now();
    logger.info('add_album_to_library_start', { tidalAlbumId, userId });

    try {
      // Check for duplicate by tidalAlbumId
      const existingAlbum = await this.albumRepository.findOne({
        where: { tidalAlbumId, userId },
      });

      if (existingAlbum) {
        logger.info('album_already_exists', { tidalAlbumId, userId, existingId: existingAlbum.id });
        throw new DuplicateItemError(
          'Album already exists in library',
          existingAlbum.id
        );
      }

      // Fetch album metadata from Tidal API
      let albumData;
      try {
        albumData = await this.tidalService.getAlbumById(tidalAlbumId);
      } catch (error: any) {
        logger.error('tidal_api_get_album_failed', {
          tidalAlbumId,
          error: String(error),
          message: error.message,
        });

        // Re-throw Tidal service errors as TidalApiError
        if (error instanceof TimeoutError || error instanceof RateLimitError || error instanceof ApiUnavailableError) {
          throw new TidalApiError(
            error.message || 'Tidal API is temporarily unavailable',
            error instanceof TimeoutError || error instanceof RateLimitError,
            error
          );
        }

        // For other errors, wrap as TidalApiError
        throw new TidalApiError(
          'Failed to fetch album from Tidal',
          false,
          error
        );
      }

      // Fetch track listing
      let trackListing: TrackInfo[] = [];
      try {
        trackListing = await this.tidalService.getAlbumTrackListing(tidalAlbumId);
      } catch (error: any) {
        logger.error('tidal_api_get_track_listing_failed', {
          tidalAlbumId,
          error: String(error),
        });

        // Re-throw Tidal service errors as TidalApiError
        if (error instanceof TimeoutError || error instanceof RateLimitError || error instanceof ApiUnavailableError) {
          throw new TidalApiError(
            error.message || 'Failed to fetch album track listing from Tidal',
            error instanceof TimeoutError || error instanceof RateLimitError,
            error
          );
        }

        // For other errors, wrap as TidalApiError
        throw new TidalApiError(
          'Failed to fetch album track listing from Tidal',
          false,
          error
        );
      }

      // Fetch ISRCs for all tracks in the album (for ingestion scheduling)
      const trackTidalIds = trackListing
        .filter(t => t.tidalId)
        .map(t => t.tidalId!);

      if (trackTidalIds.length > 0) {
        try {
          const isrcMap = await this.tidalService.batchFetchTrackIsrcs(trackTidalIds);

          // Update trackListing with ISRCs
          trackListing = trackListing.map(track => ({
            ...track,
            isrc: track.tidalId ? isrcMap.get(track.tidalId) : undefined,
          }));

          logger.info('album_isrcs_fetched', {
            tidalAlbumId,
            totalTracks: trackListing.length,
            isrcsFound: trackListing.filter(t => t.isrc).length,
          });
        } catch (error: any) {
          // Log error but don't fail the album addition - proceed without ISRCs
          logger.albumTrackListingError(
            albumData.title,
            `Failed to fetch ISRCs: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Create library album entity
      const libraryAlbum = new LibraryAlbum();
      libraryAlbum.tidalAlbumId = tidalAlbumId;
      libraryAlbum.title = albumData.title;
      libraryAlbum.artistName = albumData.artist.name;
      libraryAlbum.coverArtUrl = albumData.cover || null;
      libraryAlbum.releaseDate = albumData.releaseDate ? new Date(albumData.releaseDate) : null;
      libraryAlbum.trackCount = trackListing.length;
      libraryAlbum.trackListing = trackListing;
      libraryAlbum.userId = userId;

      // Optional metadata
      libraryAlbum.metadata = {
        explicitContent: albumData.explicit || false,
        popularity: albumData.popularity,
      };

      // Save to database
      try {
        const savedAlbum = await this.albumRepository.save(libraryAlbum);
        const duration = Date.now() - startTime;
        logger.info('album_added_to_library', {
          albumId: savedAlbum.id,
          tidalAlbumId,
          userId,
          durationMs: duration,
          performanceCheck: duration < 3000 ? 'PASS' : 'FAIL',
        });

        // Schedule ingestion for all album tracks (fire-and-forget pattern)
        // Library addition succeeds even if scheduling fails
        if (this.ingestionScheduler && trackListing.length > 0) {
          const tracksWithIsrcs = trackListing
            .filter(track => track.isrc)
            .map(track => ({
              isrc: track.isrc!,
              title: track.title,
              artworkUrl: savedAlbum.coverArtUrl,
            }));

          if (tracksWithIsrcs.length > 0) {
            try {
              await this.ingestionScheduler.scheduleAlbumTracks({
                albumTitle: savedAlbum.title,
                artistName: savedAlbum.artistName,
                tracks: tracksWithIsrcs,
              });
            } catch (error) {
              // Log error but don't fail the library addition
              logger.error('album_ingestion_scheduling_failed', {
                tidalAlbumId,
                albumTitle: savedAlbum.title,
                trackCount: tracksWithIsrcs.length,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          } else {
            logger.warn('album_no_isrcs_for_ingestion', {
              tidalAlbumId,
              albumTitle: savedAlbum.title,
              totalTracks: trackListing.length,
            });
          }
        }

        return savedAlbum;
      } catch (error: any) {
        logger.error('database_save_album_failed', {
          tidalAlbumId,
          userId,
          error: String(error),
        });

        // Map PostgreSQL errors to appropriate LibraryError types
        throw mapPostgresError(error, 'Failed to save album to library');
      }
    } catch (error) {
      // Re-throw library errors as-is
      if (error instanceof LibraryError) {
        throw error;
      }

      // Wrap unknown errors
      logger.error('add_album_to_library_unknown_error', {
        tidalAlbumId,
        userId,
        error: String(error),
      });
      throw new LibraryError(
        'An unexpected error occurred while adding album to library',
        'UNKNOWN_ERROR' as any,
        false,
        error as Error
      );
    }
  }

  /**
   * Add a track to the user's library
   *
   * @param tidalTrackId - Tidal track identifier
   * @param userId - User identifier
   * @returns The created LibraryTrack entity
   * @throws DuplicateItemError if track already exists in library
   * @throws TidalApiError if Tidal API is unavailable
   * @throws LibraryError for other storage errors
   */
  async addTrackToLibrary(tidalTrackId: string, userId: string): Promise<LibraryTrack> {
    const startTime = Date.now();
    logger.info('add_track_to_library_start', { tidalTrackId, userId });

    try {
      // Check for duplicate by tidalTrackId
      const existingTrack = await this.trackRepository.findOne({
        where: { tidalTrackId, userId },
      });

      if (existingTrack) {
        logger.info('track_already_exists', { tidalTrackId, userId, existingId: existingTrack.id });
        throw new DuplicateItemError(
          'Track already exists in library',
          existingTrack.id
        );
      }

      // Fetch track metadata from Tidal API
      let trackData;
      try {
        trackData = await this.tidalService.getTrackById(tidalTrackId);
      } catch (error: any) {
        logger.error('tidal_api_get_track_failed', {
          tidalTrackId,
          error: String(error),
        });

        // Re-throw Tidal service errors as TidalApiError
        if (error instanceof TimeoutError || error instanceof RateLimitError || error instanceof ApiUnavailableError) {
          throw new TidalApiError(
            error.message || 'Tidal API is temporarily unavailable',
            error instanceof TimeoutError || error instanceof RateLimitError,
            error
          );
        }

        // For other errors, wrap as TidalApiError
        throw new TidalApiError(
          'Failed to fetch track from Tidal',
          false,
          error
        );
      }

      // Create library track entity
      const libraryTrack = new LibraryTrack();
      libraryTrack.tidalTrackId = tidalTrackId;
      libraryTrack.title = trackData.title;
      libraryTrack.artistName = trackData.artist.name;
      libraryTrack.albumName = trackData.album?.title || null;
      libraryTrack.duration = trackData.duration;
      libraryTrack.coverArtUrl = trackData.album?.cover || null;
      libraryTrack.userId = userId;

      // Optional metadata
      libraryTrack.metadata = {
        isrc: trackData.isrc,
        explicitContent: trackData.explicit || false,
        popularity: trackData.popularity,
      };

      // Save to database
      try {
        const savedTrack = await this.trackRepository.save(libraryTrack);
        const duration = Date.now() - startTime;
        logger.info('track_added_to_library', {
          trackId: savedTrack.id,
          tidalTrackId,
          userId,
          durationMs: duration,
          performanceCheck: duration < 3000 ? 'PASS' : 'FAIL',
        });

        // Schedule ingestion (fire-and-forget pattern)
        // Library addition succeeds even if scheduling fails
        if (this.ingestionScheduler && trackData.isrc) {
          try {
            await this.ingestionScheduler.scheduleTrack({
              isrc: trackData.isrc,
              title: savedTrack.title,
              artist: savedTrack.artistName,
              album: savedTrack.albumName || 'Unknown Album',
              artworkUrl: savedTrack.coverArtUrl,
            });
          } catch (error) {
            // Log error but don't fail the library addition
            logger.error('ingestion_scheduling_failed', {
              tidalTrackId,
              isrc: trackData.isrc,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return savedTrack;
      } catch (error: any) {
        logger.error('database_save_track_failed', {
          tidalTrackId,
          userId,
          error: String(error),
        });

        // Map PostgreSQL errors to appropriate LibraryError types
        throw mapPostgresError(error, 'Failed to save track to library');
      }
    } catch (error) {
      // Re-throw library errors as-is
      if (error instanceof LibraryError) {
        throw error;
      }

      // Wrap unknown errors
      logger.error('add_track_to_library_unknown_error', {
        tidalTrackId,
        userId,
        error: String(error),
      });
      throw new LibraryError(
        'An unexpected error occurred while adding track to library',
        'UNKNOWN_ERROR' as any,
        false,
        error as Error
      );
    }
  }

  /**
   * Get all albums in the user's library, sorted alphabetically
   *
   * @param userId - User identifier
   * @returns Array of LibraryAlbum entities sorted by artistName ASC, title ASC
   */
  async getLibraryAlbums(userId: string): Promise<LibraryAlbum[]> {
    logger.info('get_library_albums', { userId });

    try {
      const albums = await this.albumRepository.find({
        where: { userId },
        order: {
          artistName: 'ASC',
          title: 'ASC',
        },
      });

      logger.info('get_library_albums_success', { userId, count: albums.length });
      return albums;
    } catch (error: any) {
      logger.error('get_library_albums_failed', { userId, error: String(error) });
      throw mapPostgresError(error, 'Failed to fetch library albums');
    }
  }

  /**
   * Get all tracks in the user's library, sorted alphabetically
   *
   * @param userId - User identifier
   * @returns Array of LibraryTrack entities sorted by artistName ASC, title ASC
   */
  async getLibraryTracks(userId: string): Promise<LibraryTrack[]> {
    logger.info('get_library_tracks', { userId });

    try {
      const tracks = await this.trackRepository.find({
        where: { userId },
        order: {
          artistName: 'ASC',
          title: 'ASC',
        },
      });

      logger.info('get_library_tracks_success', { userId, count: tracks.length });
      return tracks;
    } catch (error: any) {
      logger.error('get_library_tracks_failed', { userId, error: String(error) });
      throw mapPostgresError(error, 'Failed to fetch library tracks');
    }
  }

  /**
   * Get a specific album from the library by ID
   *
   * @param id - Album ID
   * @param userId - User identifier
   * @returns LibraryAlbum entity or null if not found
   */
  async getLibraryAlbum(id: string, userId: string): Promise<LibraryAlbum | null> {
    logger.info('get_library_album', { id, userId });

    try {
      const album = await this.albumRepository.findOne({
        where: { id, userId },
      });

      if (!album) {
        logger.info('library_album_not_found', { id, userId });
      }

      return album;
    } catch (error: any) {
      logger.error('get_library_album_failed', { id, userId, error: String(error) });
      throw mapPostgresError(error, 'Failed to fetch library album');
    }
  }

  /**
   * Get a specific track from the library by ID
   *
   * @param id - Track ID
   * @param userId - User identifier
   * @returns LibraryTrack entity or null if not found
   */
  async getLibraryTrack(id: string, userId: string): Promise<LibraryTrack | null> {
    logger.info('get_library_track', { id, userId });

    try {
      const track = await this.trackRepository.findOne({
        where: { id, userId },
      });

      if (!track) {
        logger.info('library_track_not_found', { id, userId });
      }

      return track;
    } catch (error: any) {
      logger.error('get_library_track_failed', { id, userId, error: String(error) });
      throw mapPostgresError(error, 'Failed to fetch library track');
    }
  }

  /**
   * Remove an album from the library
   *
   * @param id - Album ID
   * @param userId - User identifier
   * @returns true if album was removed
   * @throws NotFoundError if album doesn't exist
   */
  async removeAlbumFromLibrary(id: string, userId: string): Promise<boolean> {
    const startTime = Date.now();
    logger.info('remove_album_from_library_start', { id, userId });

    try {
      const result = await this.albumRepository.delete({ id, userId });

      if (result.affected === 0) {
        logger.info('album_not_found_for_removal', { id, userId });
        throw new LibraryError(
          'Album not found in library',
          'NOT_FOUND' as any,
          false
        );
      }

      const duration = Date.now() - startTime;
      logger.info('album_removed_from_library', {
        id,
        userId,
        durationMs: duration,
        performanceCheck: duration < 1000 ? 'PASS' : 'FAIL',
      });
      return true;
    } catch (error: any) {
      if (error instanceof LibraryError) {
        throw error;
      }

      logger.error('remove_album_from_library_failed', { id, userId, error: String(error) });
      throw mapPostgresError(error, 'Failed to remove album from library');
    }
  }

  /**
   * Remove a track from the library
   *
   * @param id - Track ID
   * @param userId - User identifier
   * @returns true if track was removed
   * @throws NotFoundError if track doesn't exist
   */
  async removeTrackFromLibrary(id: string, userId: string): Promise<boolean> {
    const startTime = Date.now();
    logger.info('remove_track_from_library_start', { id, userId });

    try {
      const result = await this.trackRepository.delete({ id, userId });

      if (result.affected === 0) {
        logger.info('track_not_found_for_removal', { id, userId });
        throw new LibraryError(
          'Track not found in library',
          'NOT_FOUND' as any,
          false
        );
      }

      const duration = Date.now() - startTime;
      logger.info('track_removed_from_library', {
        id,
        userId,
        durationMs: duration,
        performanceCheck: duration < 1000 ? 'PASS' : 'FAIL',
      });
      return true;
    } catch (error: any) {
      if (error instanceof LibraryError) {
        throw error;
      }

      logger.error('remove_track_from_library_failed', { id, userId, error: String(error) });
      throw mapPostgresError(error, 'Failed to remove track from library');
    }
  }
}
