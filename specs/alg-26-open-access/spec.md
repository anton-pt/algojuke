# Feature Specification: Open Access to All Google + Tidal Users

**Feature Branch**: `045-open-access`
**Created**: 2026-01-08
**Status**: Draft
**GitHub Issue**: [#45](https://github.com/anton-pt/algojuke/issues/45)
**Supersedes**: Feature 016 (Clerk Authentication with Tidal Account Connection) - allowlist functionality only

## Summary

Remove the email allowlist restriction so that any user with a Google account and Tidal connection can access AlgoJuke. The waitlist page and all allowlist checking logic will be removed entirely, while the landing page will retain its "private beta" messaging for expectation-setting.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Any User Signs In and Connects Tidal (Priority: P1)

Any user visits AlgoJuke, sees the landing page, clicks "Sign in with Google," authenticates with their Google account, and is prompted to connect their Tidal account. After completing the Tidal OAuth flow, they gain full access to the application.

**Why this priority**: This is the core happy path. With the allowlist removed, this becomes the universal flow for all users.

**Independent Test**: Sign in with any Google account, complete Tidal connection, verify full access to the main application.

**Acceptance Scenarios**:

1. **Given** any user visits the landing page, **When** they click "Sign in with Google" and authenticate, **Then** they are shown the Tidal connection screen.
2. **Given** a user has authenticated with Google, **When** they complete the Tidal OAuth flow, **Then** their Tidal tokens are stored and they are redirected to the main application.
3. **Given** a user has connected their Tidal account, **When** they return to the application later, **Then** they are automatically signed in and have full access without re-connecting Tidal.

---

### User Story 2 - Landing Page Experience (Priority: P2)

Any visitor (signed in or not) can view the landing page that explains what AlgoJuke is: an AI-powered music discovery service currently in private beta.

**Why this priority**: The landing page is the first impression. The "private beta" messaging is retained for expectation-setting despite open access.

**Independent Test**: Visit the application URL without being signed in, verify the landing page displays correctly.

**Acceptance Scenarios**:

1. **Given** a visitor is not signed in, **When** they visit the application root URL, **Then** they see the landing page with service description.
2. **Given** a visitor is viewing the landing page, **When** they read the content, **Then** they understand that AlgoJuke is an AI-powered music discovery service in private beta.
3. **Given** a visitor is viewing the landing page, **When** they look for a way to sign in, **Then** they see a clear "Sign in with Google" button.

---

### User Story 3 - User Without Tidal Connection (Priority: P3)

A user signs in with Google but does not complete the Tidal connection (closes the window, navigates away, etc.). When they return, they are prompted to connect Tidal before accessing the main application.

**Why this priority**: Handles an edge case where the user flow is interrupted. Lower priority because it's a recovery scenario.

**Independent Test**: Sign in with a Google account, not complete Tidal connection, verify the Tidal connection prompt appears on subsequent visits.

**Acceptance Scenarios**:

1. **Given** a user has signed in with Google but not connected Tidal, **When** they try to access the main application, **Then** they are redirected to the Tidal connection screen.
2. **Given** a user is on the Tidal connection screen, **When** they click "Connect Tidal," **Then** they are taken through the Tidal OAuth flow.

---

### Edge Cases

- What happens when the Tidal OAuth flow fails or is cancelled? → User is returned to the Tidal connection screen with an error message and option to retry.
- What happens when Tidal tokens expire? → User is prompted to reconnect their Tidal account when a token refresh fails.
- What happens if a user's Google session expires? → User is redirected to sign in again with Google.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow any user to sign in using their Google account (no allowlist check).
- **FR-002**: System MUST prompt all authenticated users to connect their Tidal account after Google sign-in.
- **FR-003**: System MUST NOT perform any allowlist checking against user email addresses.
- **FR-004**: System MUST NOT display or redirect to any waitlist page.
- **FR-005**: System MUST remove all allowlist-related code and configuration from the codebase.
- **FR-006**: System MUST retain the landing page with existing "private beta" messaging.
- **FR-007**: System MUST continue to implement Tidal OAuth 2.1 authorization code flow with PKCE (unchanged from Feature 016).
- **FR-008**: System MUST continue to store Tidal tokens in Clerk private metadata (unchanged from Feature 016).
- **FR-009**: System MUST continue to handle Tidal token refresh when access tokens expire (unchanged from Feature 016).
- **FR-010**: Users who have completed both Google sign-in and Tidal connection MUST have full access to the main application.
- **FR-011**: Users MUST remain signed in across browser sessions (unchanged from Feature 016).

### Out of Scope

- Changing the landing page copy (retains "private beta" messaging)
- Adding any new authentication methods
- Tidal account disconnect/reconnect functionality (deferred to future feature)
- Admin UI for user management

### Code Removal Scope

The following code artifacts from Feature 016 must be removed:

- Allowlist configuration file or constants
- Allowlist checking middleware/logic
- Waitlist page component and route
- Any conditional rendering based on allowlist status

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Any user with a Google account can complete the sign-in and Tidal connection flow.
- **SC-002**: No waitlist page is displayed to any user under any circumstances.
- **SC-003**: No code references to allowlist checking remain in the codebase (verified via grep).
- **SC-004**: All existing Feature 016 acceptance tests for approved users continue to pass (with allowlist checks removed).
- **SC-005**: Returning users (already signed in with Tidal connected) can access the main application within 3 seconds of page load (unchanged from Feature 016).

## Clarifications

### Session 2026-01-08

- Q: Should the landing page messaging change to reflect public access? → A: No, keep "private beta" messaging for expectation-setting.
- Q: What should happen to the waitlist page? → A: Remove the waitlist flow entirely.
- Q: Should the allowlist code remain feature-flagged? → A: No, remove all allowlist code completely.

## Dependencies

- Feature 016 (Clerk Authentication with Tidal Account Connection) - this feature modifies and simplifies the authentication flow established in Feature 016.
