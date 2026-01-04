/**
 * Security logging utility for authentication failures and access violations
 *
 * Per FR-026: Log all authentication failures with timestamp, attempted operation, and request origin
 * Per FR-027: Log all unauthorized access attempts with timestamp, authenticated user, target resource, and request origin
 */

import { logger } from './logger.js';

export type SecurityEventType = 'AUTH_FAILURE' | 'ACCESS_VIOLATION';

export interface TargetResource {
  type: 'conversation' | 'album' | 'track';
  id: string;
}

export interface AuthFailureEvent {
  event: 'AUTH_FAILURE';
  attemptedOperation: string;
  requestOrigin?: string;
}

export interface AccessViolationEvent {
  event: 'ACCESS_VIOLATION';
  userId: string;
  targetResource: TargetResource;
  requestOrigin?: string;
}

/**
 * Log a security event for audit purposes
 *
 * @param eventType - The type of security event
 * @param details - Event-specific details
 */
export function logSecurityEvent(
  eventType: 'AUTH_FAILURE',
  details: Omit<AuthFailureEvent, 'event'>
): void;
export function logSecurityEvent(
  eventType: 'ACCESS_VIOLATION',
  details: Omit<AccessViolationEvent, 'event'>
): void;
export function logSecurityEvent(
  eventType: SecurityEventType,
  details: Omit<AuthFailureEvent, 'event'> | Omit<AccessViolationEvent, 'event'>
): void {
  const timestamp = new Date().toISOString();

  if (eventType === 'AUTH_FAILURE') {
    const authDetails = details as Omit<AuthFailureEvent, 'event'>;
    logger.warn('security_event', {
      event: 'AUTH_FAILURE',
      timestamp,
      attemptedOperation: authDetails.attemptedOperation,
      requestOrigin: authDetails.requestOrigin || 'unknown',
    });
  } else if (eventType === 'ACCESS_VIOLATION') {
    const accessDetails = details as Omit<AccessViolationEvent, 'event'>;
    logger.warn('security_event', {
      event: 'ACCESS_VIOLATION',
      timestamp,
      userId: accessDetails.userId,
      targetResource: accessDetails.targetResource,
      requestOrigin: accessDetails.requestOrigin || 'unknown',
    });
  }
}

/**
 * Helper to log authentication failure
 */
export function logAuthFailure(
  attemptedOperation: string,
  requestOrigin?: string
): void {
  logSecurityEvent('AUTH_FAILURE', {
    attemptedOperation,
    requestOrigin,
  });
}

/**
 * Helper to log access violation attempt
 */
export function logAccessViolation(
  userId: string,
  targetResource: TargetResource,
  requestOrigin?: string
): void {
  logSecurityEvent('ACCESS_VIOLATION', {
    userId,
    targetResource,
    requestOrigin,
  });
}
