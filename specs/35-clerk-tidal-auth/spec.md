# Feature Specification: Clerk Authentication with Tidal Account Connection

**Feature Branch**: `016-clerk-tidal-auth`
**Created**: 2026-01-03
**Status**: Draft
**Input**: User description: "User login with Google account via Clerk and ability to connect their Tidal account as a social connection with Tidal connection tokens stored in Clerk's private metadata. User signin flow that requires users to sign in with Google and then connect their Tidal account. Users must connect their Tidal account to use the application. A simple landing page explaining that AlgoJuke is an AI-powered music discovery service currently in private beta. Access is restricted to a hardcoded list of Google accounts which currently only includes anton.tcholakov@gmail.com. If another user signs in, don't allow them to connect their Tidal account and simply show them a page thanking them for their interest and notifying them that AlgoJuke is in private beta and they will be notified when access is more widely available."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Approved User Signs In and Connects Tidal (Priority: P1)

An approved user (on the allowlist) visits AlgoJuke for the first time. They see the landing page explaining the service, click "Sign in with Google," authenticate with their Google account, and are then prompted to connect their Tidal account. After completing the Tidal OAuth flow, they gain full access to the application.

**Why this priority**: This is the core happy path that enables the primary use case. Without this flow working, no user can access the application's music discovery features.

**Independent Test**: Can be fully tested by signing in with an allowlisted Google account, completing Tidal connection, and verifying access to the main application.

**Acceptance Scenarios**:

1. **Given** a user with email "anton.tcholakov@gmail.com" visits the landing page, **When** they click "Sign in with Google" and authenticate, **Then** they are shown the Tidal connection screen.
2. **Given** an approved user has authenticated with Google, **When** they complete the Tidal OAuth flow, **Then** their Tidal tokens are stored and they are redirected to the main application.
3. **Given** an approved user has connected their Tidal account, **When** they return to the application later, **Then** they are automatically signed in and have full access without re-connecting Tidal.

---

### User Story 2 - Non-Approved User Experience (Priority: P2)

A user not on the allowlist visits AlgoJuke, sees the landing page, and signs in with Google. Instead of being shown the Tidal connection flow, they see a waitlist page thanking them for their interest and informing them that the service is in private beta.

**Why this priority**: Essential for gracefully handling unauthorized users and preventing access to beta-only features while maintaining a positive brand impression.

**Independent Test**: Can be tested by signing in with any Google account not on the allowlist and verifying the waitlist page appears.

**Acceptance Scenarios**:

1. **Given** a user with email "randomuser@gmail.com" (not on allowlist) visits the landing page, **When** they sign in with Google, **Then** they see the waitlist/thank you page instead of the Tidal connection screen.
2. **Given** a non-approved user is on the waitlist page, **When** they view the page content, **Then** it clearly communicates that AlgoJuke is in private beta and they will be notified when access is available.
3. **Given** a non-approved user has seen the waitlist page, **When** they try to navigate directly to protected routes, **Then** they are redirected back to the waitlist page.

---

### User Story 3 - Landing Page Experience (Priority: P3)

Any visitor (signed in or not) can view the landing page that explains what AlgoJuke is: an AI-powered music discovery service currently in private beta.

**Why this priority**: The landing page is the first impression and explains the product value proposition. Important for marketing but not blocking core functionality.

**Independent Test**: Can be tested by visiting the application URL without being signed in and verifying the landing page content displays correctly.

**Acceptance Scenarios**:

1. **Given** a visitor is not signed in, **When** they visit the application root URL, **Then** they see the landing page with service description.
2. **Given** a visitor is viewing the landing page, **When** they read the content, **Then** they understand that AlgoJuke is an AI-powered music discovery service in private beta.
3. **Given** a visitor is viewing the landing page, **When** they look for a way to sign in, **Then** they see a clear "Sign in with Google" button.

---

### User Story 4 - Approved User Without Tidal Connection (Priority: P4)

An approved user signs in with Google but does not complete the Tidal connection (closes the window, navigates away, etc.). When they return, they are prompted to connect Tidal before accessing the main application.

**Why this priority**: Handles an edge case where the user flow is interrupted. Lower priority because it's a recovery scenario, not the primary path.

**Independent Test**: Can be tested by signing in with an allowlisted account, not completing Tidal connection, and verifying the Tidal connection prompt appears on subsequent visits.

**Acceptance Scenarios**:

1. **Given** an approved user has signed in with Google but not connected Tidal, **When** they try to access the main application, **Then** they are redirected to the Tidal connection screen.
2. **Given** an approved user is on the Tidal connection screen, **When** they click "Connect Tidal," **Then** they are taken through the Tidal OAuth flow.

---

### Edge Cases

- What happens when the Tidal OAuth flow fails or is cancelled? → User is returned to the Tidal connection screen with an error message and option to retry.
- What happens when Tidal tokens expire? → User is prompted to reconnect their Tidal account when a token refresh fails.
- What happens if the allowlist is updated while a user is logged in? → User's access status is checked on each protected route access; if removed from allowlist, they see the waitlist page.
- What happens if a user's Google session expires? → User is redirected to sign in again with Google.
- What happens if a non-approved user tries to directly access the Tidal connection endpoint? → They are blocked and shown the waitlist page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a landing page accessible to all visitors explaining AlgoJuke as an AI-powered music discovery service in private beta.
- **FR-002**: System MUST allow users to sign in using their Google account.
- **FR-003**: System MUST maintain an allowlist of approved Google email addresses.
- **FR-004**: System MUST check authenticated users against the allowlist to determine access level.
- **FR-005**: Approved users MUST be prompted to connect their Tidal account after Google sign-in.
- **FR-006**: System MUST implement Tidal OAuth 2.1 authorization code flow with PKCE for account connection, requesting scopes: `collection.read`, `playlists.read`, `playlists.write`, `recommendations.read`, `search.read`, `user.read`.
- **FR-007**: System MUST store Tidal access tokens and refresh tokens in user-specific private metadata.
- **FR-008**: System MUST handle Tidal token refresh when access tokens expire.
- **FR-009**: Non-approved users MUST see a waitlist page thanking them for their interest and informing them of private beta status.
- **FR-010**: Non-approved users MUST NOT be able to access the Tidal connection flow or main application features.
- **FR-011**: Users who have completed both Google sign-in and Tidal connection MUST have full access to the main application.
- **FR-012**: Users MUST remain signed in across browser sessions (standard session persistence).
- **FR-013**: System MUST redirect unauthenticated users attempting to access protected routes to the landing page.
- **FR-014**: System MUST redirect approved users without Tidal connection to the Tidal connection screen.
- **FR-015**: The initial allowlist MUST include "anton.tcholakov@gmail.com" as the only approved email.
- **FR-016**: Users MUST be able to sign out from their Google session; Tidal connection persists after sign-out.

### Out of Scope

- Tidal account disconnect/reconnect functionality (deferred to future social connections management feature)
- Admin UI for managing the allowlist

### Key Entities

- **User**: Represents an authenticated user with Google identity, approval status (derived from allowlist), and optional Tidal connection status.
- **Tidal Connection**: Represents the link between a user and their Tidal account, including access token, refresh token, and token expiration.
- **Allowlist**: A configurable list of Google email addresses permitted to access the full application during private beta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Approved users can complete the full sign-in and Tidal connection flow in under 60 seconds (excluding time spent on external auth screens).
- **SC-002**: 100% of non-approved users are prevented from accessing protected application features.
- **SC-003**: Returning users (already signed in with Tidal connected) can access the main application within 3 seconds of page load.
- **SC-004**: Tidal token refresh succeeds automatically without user intervention at least 99% of the time during active sessions.
- **SC-005**: Landing page headline and subheadline clearly communicate the service purpose (AI-powered music discovery, private beta). This is a UX content goal verified via acceptance testing, not a timed metric.
- **SC-006**: Users experience zero data loss if they interrupt the Tidal connection flow and return later.

## Clarifications

### Session 2026-01-03

- Q: What Tidal OAuth scopes are required? → A: `collection.read`, `playlists.read`, `playlists.write`, `recommendations.read`, `search.read`, `user.read`
- Q: What sign-out capability is needed? → A: Sign-out from Google only; Tidal connection persists. Tidal disconnect is out of scope (future feature).

## Assumptions

- Users have a valid Google account to sign in with.
- Users have a valid Tidal account to connect (subscription status is not validated at this stage).
- The Tidal Developer Platform OAuth endpoints are available and functioning.
- Clerk's private metadata storage is sufficient for storing Tidal OAuth tokens.
- The allowlist is managed via code/configuration (no admin UI required for initial release).
- Standard web browser with cookies enabled is used for authentication.
