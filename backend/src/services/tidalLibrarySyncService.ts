/**
 * Tidal Library Sync Service
 *
 * Feature: ALG-32 - Tidal Library Synchronisation Flow
 *
 * Orchestrates fetching user's Tidal library, calculating diff against
 * existing AlgoJuke library, and importing missing items.
 */

import { Repository } from "typeorm";
import { LibraryAlbum } from "../entities/LibraryAlbum.js";
import { LibraryTrack } from "../entities/LibraryTrack.js";
import { TidalService } from "./tidalService.js";
import { LibraryService } from "./libraryService.js";
import {
  getTidalTokens,
  isTokenExpired,
  attemptTokenRefresh,
} from "./tidalAuthService.js";
import { DuplicateItemError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type {
  TidalUserAlbum,
  TidalUserTrack,
  TidalUserLibraryPage,
} from "../types/tidal.js";

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/**
 * Error thrown when user has no Tidal connection or token refresh fails
 */
export class TidalConnectionError extends Error {
  public readonly requiresReconnect: boolean;

  constructor(message: string, requiresReconnect: boolean = false) {
    super(message);
    this.name = "TidalConnectionError";
    this.requiresReconnect = requiresReconnect;
  }
}

/**
 * Error thrown when Tidal API calls fail
 */
export class TidalSyncApiError extends Error {
  public readonly retryable: boolean;

  constructor(message: string, retryable: boolean = true) {
    super(message);
    this.name = "TidalSyncApiError";
    this.retryable = retryable;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Album item for sync diff display
 */
export interface TidalSyncAlbum {
  tidalId: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  trackCount: number;
  releaseDate: string | null;
  addedToTidal: string;
}

/**
 * Track item for sync diff display
 */
export interface TidalSyncTrack {
  tidalId: string;
  title: string;
  artistName: string;
  albumName: string | null;
  coverArtUrl: string | null;
  duration: number;
  addedToTidal: string;
}

/**
 * Paginated diff result
 */
export interface TidalLibraryDiffResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Import item request
 */
export interface TidalImportItem {
  type: "album" | "track";
  tidalId: string;
}

/**
 * Individual import result
 */
export interface TidalImportItemResult {
  tidalId: string;
  type: "album" | "track";
  success: boolean;
  error?: string;
}

/**
 * Batch import result
 */
export interface TidalImportResult {
  imported: number;
  skipped: number;
  failed: number;
  results: TidalImportItemResult[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TidalLibrarySyncService {
  private albumRepository: Repository<LibraryAlbum>;
  private trackRepository: Repository<LibraryTrack>;
  private tidalService: TidalService;
  private libraryService: LibraryService;

  constructor(
    albumRepository: Repository<LibraryAlbum>,
    trackRepository: Repository<LibraryTrack>,
    tidalService: TidalService,
    libraryService: LibraryService,
  ) {
    this.albumRepository = albumRepository;
    this.trackRepository = trackRepository;
    this.tidalService = tidalService;
    this.libraryService = libraryService;
  }

  /**
   * Get a valid access token for the user, refreshing if necessary
   */
  private async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await getTidalTokens(userId);
    if (!tokens) {
      throw new TidalConnectionError("No Tidal connection", true);
    }

    const expired = await isTokenExpired(userId);
    if (expired) {
      const refreshedToken = await attemptTokenRefresh(userId);
      if (!refreshedToken) {
        throw new TidalConnectionError(
          "Tidal token expired and refresh failed",
          true,
        );
      }
      return refreshedToken;
    }

    return tokens.accessToken;
  }

  /**
   * Get album diff - albums in Tidal library but not in AlgoJuke
   *
   * @param userId - User identifier
   * @param options - Pagination options
   * @returns Paginated list of missing albums
   */
  async getAlbumDiff(
    userId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<TidalLibraryDiffResult<TidalSyncAlbum>> {
    const startTime = Date.now();
    const limit = options.limit ?? 50;

    logger.info("tidal_sync_album_diff_start", {
      userId,
      cursor: options.cursor,
      limit,
    });

    try {
      const accessToken = await this.getValidAccessToken(userId);

      // Fetch page from Tidal
      const tidalPage: TidalUserLibraryPage<TidalUserAlbum> =
        await this.tidalService.getUserAlbums(accessToken, {
          cursor: options.cursor,
          limit,
        });

      // Get existing album IDs for this user (indexed query)
      const existingAlbums = await this.albumRepository
        .createQueryBuilder("album")
        .select("album.tidalAlbumId")
        .where("album.userId = :userId", { userId })
        .getRawMany<{ album_tidalAlbumId: string }>();

      const existingIds = new Set(
        existingAlbums.map((r) => r.album_tidalAlbumId),
      );

      // Filter to missing items
      const missing = tidalPage.items.filter(
        (album) => !existingIds.has(album.id),
      );

      const duration = Date.now() - startTime;
      logger.info("tidal_sync_album_diff_complete", {
        userId,
        tidalCount: tidalPage.items.length,
        existingCount: existingIds.size,
        missingCount: missing.length,
        hasMore: tidalPage.hasMore,
        durationMs: duration,
      });

      return {
        items: missing.map(this.mapToSyncAlbum),
        nextCursor: tidalPage.nextCursor,
        hasMore: tidalPage.hasMore,
      };
    } catch (error) {
      if (error instanceof TidalConnectionError) {
        throw error;
      }

      logger.error("tidal_sync_album_diff_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new TidalSyncApiError("Failed to fetch Tidal library", true);
    }
  }

  /**
   * Get track diff - tracks in Tidal library but not in AlgoJuke
   *
   * @param userId - User identifier
   * @param options - Pagination options
   * @returns Paginated list of missing tracks
   */
  async getTrackDiff(
    userId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<TidalLibraryDiffResult<TidalSyncTrack>> {
    const startTime = Date.now();
    const limit = options.limit ?? 50;

    logger.info("tidal_sync_track_diff_start", {
      userId,
      cursor: options.cursor,
      limit,
    });

    try {
      const accessToken = await this.getValidAccessToken(userId);

      // Fetch page from Tidal
      const tidalPage: TidalUserLibraryPage<TidalUserTrack> =
        await this.tidalService.getUserTracks(accessToken, {
          cursor: options.cursor,
          limit,
        });

      // Get existing track IDs for this user (indexed query)
      const existingTracks = await this.trackRepository
        .createQueryBuilder("track")
        .select("track.tidalTrackId")
        .where("track.userId = :userId", { userId })
        .getRawMany<{ track_tidalTrackId: string }>();

      const existingIds = new Set(
        existingTracks.map((r) => r.track_tidalTrackId),
      );

      // Filter to missing items
      const missing = tidalPage.items.filter(
        (track) => !existingIds.has(track.id),
      );

      const duration = Date.now() - startTime;
      logger.info("tidal_sync_track_diff_complete", {
        userId,
        tidalCount: tidalPage.items.length,
        existingCount: existingIds.size,
        missingCount: missing.length,
        hasMore: tidalPage.hasMore,
        durationMs: duration,
      });

      return {
        items: missing.map(this.mapToSyncTrack),
        nextCursor: tidalPage.nextCursor,
        hasMore: tidalPage.hasMore,
      };
    } catch (error) {
      if (error instanceof TidalConnectionError) {
        throw error;
      }

      logger.error("tidal_sync_track_diff_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new TidalSyncApiError("Failed to fetch Tidal library", true);
    }
  }

  /**
   * Import items from Tidal to AlgoJuke library
   *
   * @param userId - User identifier
   * @param items - Items to import
   * @returns Import results with success/failure counts
   */
  async importItems(
    userId: string,
    items: TidalImportItem[],
  ): Promise<TidalImportResult> {
    const startTime = Date.now();
    const results: TidalImportItemResult[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    logger.info("tidal_sync_import_start", {
      userId,
      itemCount: items.length,
      albums: items.filter((i) => i.type === "album").length,
      tracks: items.filter((i) => i.type === "track").length,
    });

    for (const item of items) {
      try {
        if (item.type === "album") {
          await this.libraryService.addAlbumToLibrary(item.tidalId, userId);
        } else {
          await this.libraryService.addTrackToLibrary(item.tidalId, userId);
        }
        imported++;
        results.push({
          tidalId: item.tidalId,
          type: item.type,
          success: true,
        });
      } catch (error) {
        if (error instanceof DuplicateItemError) {
          // Item was added between diff and import - skip gracefully
          skipped++;
          results.push({
            tidalId: item.tidalId,
            type: item.type,
            success: true, // Not a failure - item exists
          });
        } else {
          failed++;
          results.push({
            tidalId: item.tidalId,
            type: item.type,
            success: false,
            error: error instanceof Error ? error.message : "Import failed",
          });
          logger.warn("tidal_sync_import_item_failed", {
            userId,
            tidalId: item.tidalId,
            type: item.type,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info("tidal_sync_import_complete", {
      userId,
      imported,
      skipped,
      failed,
      totalItems: items.length,
      durationMs: duration,
    });

    return { imported, skipped, failed, results };
  }

  /**
   * Map Tidal user album to sync display format
   */
  private mapToSyncAlbum = (album: TidalUserAlbum): TidalSyncAlbum => ({
    tidalId: album.id,
    title: album.title,
    artistName: album.artistName,
    coverArtUrl: album.coverArtUrl,
    trackCount: album.trackCount,
    releaseDate: album.releaseDate,
    addedToTidal: album.addedToTidal,
  });

  /**
   * Map Tidal user track to sync display format
   */
  private mapToSyncTrack = (track: TidalUserTrack): TidalSyncTrack => ({
    tidalId: track.id,
    title: track.title,
    artistName: track.artistName,
    albumName: track.albumName,
    coverArtUrl: track.coverArtUrl,
    duration: track.duration,
    addedToTidal: track.addedToTidal,
  });
}
