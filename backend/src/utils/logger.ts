/**
 * Structured logging utility for API calls, errors, and cache operations
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };

    // In development, use pretty printing
    if (this.isDevelopment) {
      console[level === 'error' || level === 'warn' ? level : 'log'](
        `[${timestamp}] ${level.toUpperCase()}: ${message}`,
        context || ''
      );
    } else {
      // In production, use JSON for log aggregation
      console.log(JSON.stringify(logEntry));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  // Convenience methods for common scenarios
  searchRequest(query: string, limit: number, offset: number): void {
    this.info('search_request', { query, limit, offset });
  }

  searchResponse(
    query: string,
    albumCount: number,
    trackCount: number,
    cached: boolean
  ): void {
    this.info('search_response', {
      query,
      albumCount,
      trackCount,
      cached,
    });
  }

  cacheHit(key: string): void {
    this.debug('cache_hit', { key });
  }

  cacheMiss(key: string): void {
    this.debug('cache_miss', { key });
  }

  cacheSet(key: string, ttl: number): void {
    this.debug('cache_set', { key, ttl });
  }

  apiCall(endpoint: string, method: string): void {
    this.info('api_call', { endpoint, method });
  }

  apiError(endpoint: string, status: number, error: string): void {
    this.error('api_error', { endpoint, status, error });
  }

  // ============================================================================
  // Ingestion Scheduling Logging Methods
  // ============================================================================

  /**
   * Log successful ingestion scheduling
   */
  ingestionScheduled(
    isrc: string,
    trackTitle: string,
    durationMs: number
  ): void {
    this.info('ingestion_scheduled', {
      isrc,
      trackTitle,
      result: 'success',
      durationMs,
    });
  }

  /**
   * Log skipped ingestion (track already indexed or invalid)
   */
  ingestionSkipped(
    isrc: string,
    trackTitle: string | undefined,
    reason: 'already_indexed' | 'missing_isrc' | 'invalid_isrc'
  ): void {
    this.info('ingestion_skipped', {
      isrc,
      trackTitle,
      result: 'skipped',
      reason,
    });
  }

  /**
   * Log ingestion scheduling error
   */
  ingestionError(
    isrc: string | undefined,
    trackTitle: string | undefined,
    error: string,
    durationMs?: number
  ): void {
    this.error('ingestion_error', {
      isrc,
      trackTitle,
      result: 'error',
      error,
      durationMs,
    });
  }

  /**
   * Log album batch scheduling results
   */
  albumIngestionBatch(
    albumTitle: string,
    totalTracks: number,
    scheduledCount: number,
    skippedCount: number,
    durationMs: number
  ): void {
    this.info('album_ingestion_batch', {
      albumTitle,
      totalTracks,
      scheduledCount,
      skippedCount,
      durationMs,
    });
  }

  /**
   * Log album track listing error
   */
  albumTrackListingError(albumTitle: string, error: string): void {
    this.error('album_track_listing_error', {
      albumTitle,
      error,
    });
  }

  /**
   * Log Qdrant check error (fail-open scenario)
   */
  qdrantCheckError(isrcCount: number, error: string): void {
    this.warn('qdrant_check_error', {
      isrcCount,
      error,
    });
  }

  /**
   * Log Inngest send error
   */
  inngestSendError(isrc: string, error: string): void {
    this.error('inngest_send_error', {
      isrc,
      error,
    });
  }
}

export const logger = new Logger();
