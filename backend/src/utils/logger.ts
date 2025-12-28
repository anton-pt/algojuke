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
}

export const logger = new Logger();
