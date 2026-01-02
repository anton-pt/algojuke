/**
 * Library Status Utilities for Agent Tools
 *
 * Feature: 011-agent-tools
 *
 * Shared utilities for checking library membership status of tracks.
 * Used by all agent tools that need to determine if tracks are in the user's library.
 */

import { Repository } from 'typeorm';
import { LibraryTrack } from '../../entities/LibraryTrack.js';
import { LibraryAlbum, TrackInfo } from '../../entities/LibraryAlbum.js';
import { logger } from '../../utils/logger.js';

/**
 * Check library status for a list of ISRCs
 *
 * Checks both standalone tracks and album track listings.
 * Returns a Set of ISRCs that are in the user's library.
 *
 * Fails open on database errors - returns empty set rather than throwing.
 *
 * @param isrcs - Array of ISRCs to check (will be normalized to uppercase)
 * @param libraryTrackRepository - TypeORM repository for LibraryTrack
 * @param libraryAlbumRepository - TypeORM repository for LibraryAlbum
 * @param userId - User ID to check library for
 * @param logContext - Optional context for logging (e.g., tool name)
 * @returns Set of ISRCs (uppercase) that are in the user's library
 */
export async function getLibraryIsrcs(
  isrcs: string[],
  libraryTrackRepository: Repository<LibraryTrack>,
  libraryAlbumRepository: Repository<LibraryAlbum>,
  userId: string,
  logContext: string = 'library_status'
): Promise<Set<string>> {
  const libraryIsrcs = new Set<string>();

  if (isrcs.length === 0) {
    return libraryIsrcs;
  }

  // Normalize input ISRCs to uppercase for consistent comparison
  const normalizedIsrcs = isrcs.map((isrc) => isrc.toUpperCase());

  try {
    // Check standalone library tracks
    const libraryTracks = await libraryTrackRepository
      .createQueryBuilder('track')
      .select(['track.metadata'])
      .where('track.userId = :userId', { userId })
      .andWhere("track.metadata->>'isrc' IS NOT NULL")
      .getMany();

    for (const track of libraryTracks) {
      const trackIsrc = track.metadata?.isrc?.toUpperCase();
      if (trackIsrc && normalizedIsrcs.includes(trackIsrc)) {
        libraryIsrcs.add(trackIsrc);
      }
    }

    // Check album track listings
    const libraryAlbums = await libraryAlbumRepository
      .createQueryBuilder('album')
      .select(['album.trackListing'])
      .where('album.userId = :userId', { userId })
      .getMany();

    for (const album of libraryAlbums) {
      if (!album.trackListing) continue;
      for (const track of album.trackListing as TrackInfo[]) {
        const trackIsrc = track.isrc?.toUpperCase();
        if (trackIsrc && normalizedIsrcs.includes(trackIsrc)) {
          libraryIsrcs.add(trackIsrc);
        }
      }
    }
  } catch (error) {
    logger.warn(`${logContext}_library_check_failed`, {
      isrcCount: isrcs.length,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail-open: return empty set on error
  }

  return libraryIsrcs;
}

/**
 * Check library status for albums by Tidal album ID
 *
 * Returns a Set of Tidal album IDs that are in the user's library.
 *
 * Fails open on database errors - returns empty set rather than throwing.
 *
 * @param tidalAlbumIds - Array of Tidal album IDs to check
 * @param libraryAlbumRepository - TypeORM repository for LibraryAlbum
 * @param userId - User ID to check library for
 * @param logContext - Optional context for logging (e.g., tool name)
 * @returns Set of Tidal album IDs that are in the user's library
 */
export async function getLibraryAlbumIds(
  tidalAlbumIds: string[],
  libraryAlbumRepository: Repository<LibraryAlbum>,
  userId: string,
  logContext: string = 'library_status'
): Promise<Set<string>> {
  const libraryAlbumIds = new Set<string>();

  if (tidalAlbumIds.length === 0) {
    return libraryAlbumIds;
  }

  try {
    const libraryAlbums = await libraryAlbumRepository
      .createQueryBuilder('album')
      .select(['album.tidalAlbumId'])
      .where('album.userId = :userId', { userId })
      .andWhere('album.tidalAlbumId IN (:...tidalAlbumIds)', { tidalAlbumIds })
      .getMany();

    for (const album of libraryAlbums) {
      if (album.tidalAlbumId) {
        libraryAlbumIds.add(album.tidalAlbumId);
      }
    }
  } catch (error) {
    logger.warn(`${logContext}_album_library_check_failed`, {
      albumCount: tidalAlbumIds.length,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail-open: return empty set on error
  }

  return libraryAlbumIds;
}
