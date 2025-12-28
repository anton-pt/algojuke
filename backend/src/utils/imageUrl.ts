/**
 * Generates Tidal image URLs from cover UUIDs
 * Based on pattern: https://images.tidal.com/im/im?uuid={UUID}&w={width}&h={height}&q={quality}
 */

const TIDAL_IMAGE_BASE_URL = 'https://images.tidal.com/im/im';
const PLACEHOLDER_URL = '/images/placeholder-album.svg';

export interface ImageUrls {
  artworkUrl: string;
  artworkThumbUrl: string;
}

/**
 * Generates Tidal image URL from cover UUID
 *
 * @param coverUuid - Cover UUID from Tidal API
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param quality - JPEG quality (1-100)
 * @returns Full image URL
 */
export function getTidalImageUrl(
  coverUuid: string | null | undefined,
  width: number = 320,
  height: number = 320,
  quality: number = 80
): string {
  if (!coverUuid) {
    return PLACEHOLDER_URL;
  }

  return `${TIDAL_IMAGE_BASE_URL}?uuid=${coverUuid}&w=${width}&h=${height}&q=${quality}`;
}

/**
 * Generates both standard and thumbnail image URLs
 *
 * @param coverUuid - Cover UUID from Tidal API
 * @returns Object with artworkUrl (640x640) and artworkThumbUrl (320x320)
 */
export function buildImageUrls(coverUuid: string | null | undefined): ImageUrls {
  return {
    artworkUrl: getTidalImageUrl(coverUuid, 640, 640, 80),
    artworkThumbUrl: getTidalImageUrl(coverUuid, 320, 320, 80),
  };
}
