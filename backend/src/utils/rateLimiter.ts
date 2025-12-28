import { logger } from './logger.js';

export interface RateLimiterConfig {
  requestsPerSecond: number;
  maxConcurrent: number;
  maxRetries: number;
  baseRetryDelay: number; // milliseconds
}

export interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retries: number;
}

/**
 * Rate limiter with exponential backoff retry logic
 * Prevents hitting API rate limits by queuing requests
 */
export class RateLimiter {
  private readonly config: RateLimiterConfig;
  private queue: QueuedRequest<unknown>[] = [];
  private activeRequests: number = 0;
  private lastRequestTime: number = 0;
  private processing: boolean = false;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      requestsPerSecond: config.requestsPerSecond || 5,
      maxConcurrent: config.maxConcurrent || 3,
      maxRetries: config.maxRetries || 3,
      baseRetryDelay: config.baseRetryDelay || 1000,
    };

    logger.info('rate_limiter_initialized', {
      requestsPerSecond: this.config.requestsPerSecond,
      maxConcurrent: this.config.maxConcurrent,
    });
  }

  /**
   * Execute a request with rate limiting and retry logic
   *
   * @param execute - Function to execute
   * @returns Promise that resolves with the result
   */
  async executeWithRetry<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest<unknown> = {
        execute,
        resolve: (value) => resolve(value as T),
        reject,
        retries: 0,
      };

      this.queue.push(queuedRequest);
      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return; // Already processing
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Check if we can start a new request
      if (this.activeRequests >= this.config.maxConcurrent) {
        // Wait for an active request to complete
        await this.waitForSlot();
        continue;
      }

      // Rate limiting: ensure we don't exceed requests per second
      const now = Date.now();
      const minInterval = 1000 / this.config.requestsPerSecond;
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < minInterval) {
        const waitTime = minInterval - timeSinceLastRequest;
        await this.sleep(waitTime);
      }

      // Get next request from queue
      const request = this.queue.shift();
      if (!request) {
        break;
      }

      // Execute request
      this.lastRequestTime = Date.now();
      this.activeRequests++;

      this.executeRequest(request).finally(() => {
        this.activeRequests--;
      });
    }

    this.processing = false;
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeRequest(request: QueuedRequest<unknown>): Promise<void> {
    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      // Check if it's a rate limit error (429)
      const is429 = this.isRateLimitError(error);

      if (is429 && request.retries < this.config.maxRetries) {
        // Retry with exponential backoff
        request.retries++;
        const delay = this.config.baseRetryDelay * Math.pow(2, request.retries - 1);

        logger.warn('rate_limit_retry', {
          retries: request.retries,
          maxRetries: this.config.maxRetries,
          delayMs: delay,
        });

        // Wait and re-queue
        await this.sleep(delay);
        this.queue.unshift(request); // Add back to front of queue
        this.processQueue(); // Resume processing
      } else {
        // Max retries exceeded or non-retriable error
        if (is429) {
          logger.error('rate_limit_exceeded', {
            retries: request.retries,
            maxRetries: this.config.maxRetries,
          });
        }
        request.reject(error as Error);
      }
    }
  }

  /**
   * Check if error is a rate limit error (429)
   */
  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const axiosError = error as { response?: { status?: number } };
      return axiosError.response?.status === 429;
    }
    return false;
  }

  /**
   * Wait for an active request slot to become available
   */
  private async waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.activeRequests < this.config.maxConcurrent) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50); // Check every 50ms
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current queue stats
   */
  getStats(): { queueLength: number; activeRequests: number } {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
    };
  }
}
