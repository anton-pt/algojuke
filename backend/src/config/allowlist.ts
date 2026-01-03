/**
 * Allowlist configuration for approved beta users
 *
 * During private beta, only users with emails in this list
 * can connect their Tidal account and access the application.
 */

/**
 * List of approved Google email addresses for private beta access.
 * Emails are stored in lowercase for case-insensitive comparison.
 */
export const APPROVED_EMAILS = [
  'anton.tcholakov@gmail.com',
] as const;

export type ApprovedEmail = (typeof APPROVED_EMAILS)[number];

/**
 * Check if a user's email is on the allowlist
 *
 * @param email - User's email address (case-insensitive)
 * @returns true if user is approved for beta access
 */
export function isApprovedUser(email: string): boolean {
  return APPROVED_EMAILS.includes(
    email.toLowerCase() as ApprovedEmail
  );
}
