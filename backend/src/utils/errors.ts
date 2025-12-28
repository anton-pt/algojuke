/**
 * Storage failure detection and error handling utilities
 * Maps PostgreSQL error codes to user-friendly GraphQL errors
 */

/**
 * PostgreSQL error codes that indicate storage failures
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export enum PostgresErrorCode {
  // Class 08 - Connection Exception
  CONNECTION_EXCEPTION = '08000',
  CONNECTION_DOES_NOT_EXIST = '08003',
  CONNECTION_FAILURE = '08006',

  // Class 53 - Insufficient Resources
  INSUFFICIENT_RESOURCES = '53000',
  DISK_FULL = '53100',
  OUT_OF_MEMORY = '53200',
  TOO_MANY_CONNECTIONS = '53300',

  // Class 58 - System Error
  SYSTEM_ERROR = '58000',
  IO_ERROR = '58030',

  // Class 42 - Syntax Error or Access Rule Violation
  INSUFFICIENT_PRIVILEGE = '42501',

  // Class 23 - Integrity Constraint Violation
  UNIQUE_VIOLATION = '23505',
  FOREIGN_KEY_VIOLATION = '23503',
  NOT_NULL_VIOLATION = '23502',
  CHECK_VIOLATION = '23514',
}

/**
 * Error types for GraphQL responses
 */
export enum ErrorType {
  STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE',
  STORAGE_CORRUPTION = 'STORAGE_CORRUPTION',
  INSUFFICIENT_SPACE = 'INSUFFICIENT_SPACE',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  DUPLICATE_ITEM = 'DUPLICATE_ITEM',
  NOT_FOUND = 'NOT_FOUND',
  TIDAL_API_ERROR = 'TIDAL_API_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Base error class for library operations
 */
export class LibraryError extends Error {
  public readonly type: ErrorType;
  public readonly retryable: boolean;
  public readonly originalError?: Error;

  constructor(message: string, type: ErrorType, retryable: boolean = false, originalError?: Error) {
    super(message);
    this.name = 'LibraryError';
    this.type = type;
    this.retryable = retryable;
    this.originalError = originalError;
  }
}

/**
 * Error class for storage-related failures
 */
export class StorageError extends LibraryError {
  constructor(message: string, type: ErrorType, retryable: boolean = true, originalError?: Error) {
    super(message, type, retryable, originalError);
    this.name = 'StorageError';
  }
}

/**
 * Error class for duplicate library items
 */
export class DuplicateItemError extends LibraryError {
  public readonly existingItemId: string;

  constructor(message: string, existingItemId: string, originalError?: Error) {
    super(message, ErrorType.DUPLICATE_ITEM, false, originalError);
    this.name = 'DuplicateItemError';
    this.existingItemId = existingItemId;
  }
}

/**
 * Error class for items not found in library
 */
export class NotFoundError extends LibraryError {
  constructor(message: string, originalError?: Error) {
    super(message, ErrorType.NOT_FOUND, false, originalError);
    this.name = 'NotFoundError';
  }
}

/**
 * Error class for Tidal API failures
 */
export class TidalApiError extends LibraryError {
  constructor(message: string, retryable: boolean = true, originalError?: Error) {
    super(message, ErrorType.TIDAL_API_ERROR, retryable, originalError);
    this.name = 'TidalApiError';
  }
}

/**
 * Checks if an error indicates a PostgreSQL storage failure
 */
export function isStorageFailure(error: any): boolean {
  if (!error) return false;

  const code = error.code || error.errorCode;
  if (!code) return false;

  // Check against known storage failure codes
  const storageFailureCodes = [
    PostgresErrorCode.CONNECTION_EXCEPTION,
    PostgresErrorCode.CONNECTION_DOES_NOT_EXIST,
    PostgresErrorCode.CONNECTION_FAILURE,
    PostgresErrorCode.INSUFFICIENT_RESOURCES,
    PostgresErrorCode.DISK_FULL,
    PostgresErrorCode.OUT_OF_MEMORY,
    PostgresErrorCode.TOO_MANY_CONNECTIONS,
    PostgresErrorCode.SYSTEM_ERROR,
    PostgresErrorCode.IO_ERROR,
  ];

  return storageFailureCodes.includes(code);
}

/**
 * Checks if an error indicates storage corruption
 */
export function isStorageCorruption(error: any): boolean {
  if (!error) return false;

  const code = error.code || error.errorCode;
  const message = error.message?.toLowerCase() || '';

  // IO errors or specific corruption indicators
  if (code === PostgresErrorCode.IO_ERROR) return true;
  if (code === PostgresErrorCode.SYSTEM_ERROR && message.includes('corrupt')) return true;

  // Check error message for corruption keywords
  const corruptionKeywords = ['corrupt', 'invalid', 'damaged', 'inconsistent'];
  return corruptionKeywords.some(keyword => message.includes(keyword));
}

/**
 * Checks if an error indicates insufficient storage space
 */
export function isInsufficientSpace(error: any): boolean {
  if (!error) return false;

  const code = error.code || error.errorCode;
  return code === PostgresErrorCode.DISK_FULL;
}

/**
 * Checks if an error indicates permission issues
 */
export function isPermissionError(error: any): boolean {
  if (!error) return false;

  const code = error.code || error.errorCode;
  return code === PostgresErrorCode.INSUFFICIENT_PRIVILEGE;
}

/**
 * Checks if an error indicates a duplicate item
 */
export function isDuplicateError(error: any): boolean {
  if (!error) return false;

  const code = error.code || error.errorCode;
  return code === PostgresErrorCode.UNIQUE_VIOLATION;
}

/**
 * Maps a PostgreSQL error to a user-friendly LibraryError
 */
export function mapPostgresError(error: any, context?: string): LibraryError {
  const contextPrefix = context ? `${context}: ` : '';

  // Check for duplicate violations first
  if (isDuplicateError(error)) {
    return new LibraryError(
      `${contextPrefix}Item already exists in library`,
      ErrorType.DUPLICATE_ITEM,
      false,
      error
    );
  }

  // Check for storage corruption
  if (isStorageCorruption(error)) {
    return new StorageError(
      `${contextPrefix}Storage corruption detected. Please contact support.`,
      ErrorType.STORAGE_CORRUPTION,
      false,
      error
    );
  }

  // Check for insufficient space
  if (isInsufficientSpace(error)) {
    return new StorageError(
      `${contextPrefix}Insufficient storage space available`,
      ErrorType.INSUFFICIENT_SPACE,
      false,
      error
    );
  }

  // Check for permission errors
  if (isPermissionError(error)) {
    return new StorageError(
      `${contextPrefix}Database permission error. Please contact support.`,
      ErrorType.PERMISSION_ERROR,
      false,
      error
    );
  }

  // Check for general storage failures (retryable)
  if (isStorageFailure(error)) {
    return new StorageError(
      `${contextPrefix}Database temporarily unavailable. Please try again.`,
      ErrorType.STORAGE_UNAVAILABLE,
      true,
      error
    );
  }

  // Unknown error
  return new LibraryError(
    `${contextPrefix}An unexpected error occurred`,
    ErrorType.UNKNOWN_ERROR,
    false,
    error
  );
}

/**
 * Extracts the existing item ID from a duplicate error constraint violation
 */
export async function getExistingItemId(
  error: any,
  tableName: string,
  uniqueField: string,
  queryRunner: any
): Promise<string | null> {
  if (!isDuplicateError(error)) return null;

  try {
    // Extract the value that caused the duplicate from error details
    const detail = error.detail || '';
    const match = detail.match(/Key \(([^)]+)\)=\(([^)]+)\)/);

    if (!match) return null;

    const fieldName = match[1];
    const fieldValue = match[2];

    // Query to find the existing item
    const result = await queryRunner.query(
      `SELECT id FROM ${tableName} WHERE ${fieldName} = $1 LIMIT 1`,
      [fieldValue]
    );

    return result.length > 0 ? result[0].id : null;
  } catch (err) {
    // If we can't determine the existing ID, return null
    return null;
  }
}
