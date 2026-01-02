/**
 * Retry Logic Contract Tests
 *
 * Feature: 011-agent-tools
 *
 * Tests retry behavior for agent tool execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeWithRetry, isRetryableError, getUserFriendlyMessage } from '../../../src/services/agentTools/retry.js';
import { createToolError } from '../../../src/types/agentTools.js';

// Note: Not using fake timers due to async handling complexity
// Tests that need timing use real timers with small delays

describe('isRetryableError', () => {
  describe('retryable errors', () => {
    it('returns true for ECONNREFUSED', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:6333');
      expect(isRetryableError(error)).toBe(true);
    });

    it('returns true for ETIMEDOUT', () => {
      const error = new Error('ETIMEDOUT');
      expect(isRetryableError(error)).toBe(true);
    });

    it('returns true for ENOTFOUND', () => {
      const error = new Error('getaddrinfo ENOTFOUND qdrant.local');
      expect(isRetryableError(error)).toBe(true);
    });

    it('returns true for socket hang up', () => {
      const error = new Error('socket hang up');
      expect(isRetryableError(error)).toBe(true);
    });

    it('returns true for timeout errors', () => {
      const error = new Error('Request timeout');
      expect(isRetryableError(error)).toBe(true);
    });

    it('returns true for rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      expect(isRetryableError(error)).toBe(true);
    });

    it('returns true for HTTP 429', () => {
      const error = new Error('Too Many Requests') as any;
      error.status = 429;
      expect(isRetryableError(error)).toBe(true);
    });

    it('returns true for HTTP 503', () => {
      const error = new Error('Service Unavailable') as any;
      error.status = 503;
      expect(isRetryableError(error)).toBe(true);
    });

    it('returns true for HTTP 504', () => {
      const error = new Error('Gateway Timeout') as any;
      error.status = 504;
      expect(isRetryableError(error)).toBe(true);
    });

    it('returns true for ToolError with retryable=true', () => {
      const error = createToolError('Temporary failure', true, false);
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('non-retryable errors', () => {
    it('returns false for validation errors', () => {
      const error = new Error('Validation failed: query is required');
      expect(isRetryableError(error)).toBe(false);
    });

    it('returns false for invalid input errors', () => {
      const error = new Error('Invalid ISRC format');
      expect(isRetryableError(error)).toBe(false);
    });

    it('returns false for HTTP 400', () => {
      const error = new Error('Bad Request') as any;
      error.status = 400;
      expect(isRetryableError(error)).toBe(false);
    });

    it('returns false for HTTP 401', () => {
      const error = new Error('Unauthorized') as any;
      error.status = 401;
      expect(isRetryableError(error)).toBe(false);
    });

    it('returns false for HTTP 403', () => {
      const error = new Error('Forbidden') as any;
      error.status = 403;
      expect(isRetryableError(error)).toBe(false);
    });

    it('returns false for HTTP 404', () => {
      const error = new Error('Not Found') as any;
      error.status = 404;
      expect(isRetryableError(error)).toBe(false);
    });

    it('returns false for ToolError with retryable=false', () => {
      const error = createToolError('Permanent failure', false, false);
      expect(isRetryableError(error)).toBe(false);
    });
  });
});

describe('getUserFriendlyMessage', () => {
  it('returns connection error message for ECONNREFUSED', () => {
    const error = new Error('connect ECONNREFUSED');
    const message = getUserFriendlyMessage(error, 'semanticSearch');
    expect(message).toBe('Vector search service is currently unavailable');
  });

  it('returns timeout message for ETIMEDOUT', () => {
    const error = new Error('ETIMEDOUT');
    const message = getUserFriendlyMessage(error, 'semanticSearch');
    expect(message).toBe('Vector search operation timed out');
  });

  it('returns rate limit message for 429 errors', () => {
    const error = new Error('Rate limit exceeded');
    const message = getUserFriendlyMessage(error, 'tidalSearch');
    expect(message).toBe('Rate limit exceeded. Please wait a moment and try again.');
  });

  it('returns validation message for invalid input', () => {
    const error = new Error('Invalid ISRC format');
    const message = getUserFriendlyMessage(error, 'batchMetadata');
    expect(message).toBe('Invalid ISRC format');
  });

  it('uses tool name in default message', () => {
    const error = new Error('Some unknown error');
    expect(getUserFriendlyMessage(error, 'semanticSearch')).toBe('Vector search is temporarily unavailable');
    expect(getUserFriendlyMessage(error, 'tidalSearch')).toBe('Tidal search is temporarily unavailable');
    expect(getUserFriendlyMessage(error, 'batchMetadata')).toBe('Metadata lookup is temporarily unavailable');
    expect(getUserFriendlyMessage(error, 'albumTracks')).toBe('Album tracks is temporarily unavailable');
  });
});

describe('executeWithRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const { result, wasRetried } = await executeWithRetry(fn, 'semanticSearch');

    expect(result).toBe('success');
    expect(wasRetried).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue('success');

    const { result, wasRetried } = await executeWithRetry(fn, 'semanticSearch');

    expect(result).toBe('success');
    expect(wasRetried).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  }, 5000); // Increase timeout to account for 1s retry delay

  it('does not retry on validation error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Validation failed'));

    await expect(executeWithRetry(fn, 'semanticSearch')).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on HTTP 400', async () => {
    const error = new Error('Bad Request') as any;
    error.status = 400;
    const fn = vi.fn().mockRejectedValue(error);

    await expect(executeWithRetry(fn, 'semanticSearch')).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws error with wasRetried=true after retry exhausted', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED again'));

    await expect(executeWithRetry(fn, 'semanticSearch')).rejects.toMatchObject({
      wasRetried: true,
    });
    expect(fn).toHaveBeenCalledTimes(2);
  }, 5000); // Increase timeout to account for 1s retry delay

  it('waits approximately 1000ms before retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue('success');

    const startTime = Date.now();
    await executeWithRetry(fn, 'semanticSearch');
    const duration = Date.now() - startTime;

    // Should wait at least 900ms (allowing for some timing variance)
    expect(duration).toBeGreaterThanOrEqual(900);
    expect(fn).toHaveBeenCalledTimes(2);
  }, 5000); // Increase timeout to account for 1s retry delay

  it('preserves ToolError retryable flag on retry failure', async () => {
    const toolError = createToolError('Service down', true, false);
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(toolError);

    await expect(executeWithRetry(fn, 'semanticSearch')).rejects.toMatchObject({
      wasRetried: true,
      message: 'Service down',
    });
  }, 5000); // Increase timeout to account for 1s retry delay
});
