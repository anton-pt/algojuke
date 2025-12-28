// Error types for the application

export interface ApiError extends Error {
  code: string;
  message: string;
  details?: string;
  retryAfter?: number;
}

export class InvalidQueryError extends Error implements ApiError {
  code = 'INVALID_QUERY';
  constructor(message = 'Search query must be 1-200 characters') {
    super(message);
    this.name = 'InvalidQueryError';
  }
}

export class EmptyQueryError extends Error implements ApiError {
  code = 'EMPTY_QUERY';
  constructor(message = 'Please enter a search term') {
    super(message);
    this.name = 'EmptyQueryError';
  }
}

export class RateLimitError extends Error implements ApiError {
  code = 'RATE_LIMIT_EXCEEDED';
  retryAfter?: number;

  constructor(retryAfter?: number) {
    super(
      retryAfter
        ? `Too many requests. Try again in ${retryAfter} seconds`
        : 'Too many requests. Please try again later.'
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class ApiUnavailableError extends Error implements ApiError {
  code = 'API_UNAVAILABLE';
  constructor(message = 'Music service unavailable. Try again soon.') {
    super(message);
    this.name = 'ApiUnavailableError';
  }
}

export class TimeoutError extends Error implements ApiError {
  code = 'TIMEOUT';
  constructor(message = 'Search took too long. Please try again.') {
    super(message);
    this.name = 'TimeoutError';
  }
}
