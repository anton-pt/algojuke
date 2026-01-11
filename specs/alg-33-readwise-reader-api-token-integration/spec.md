# Feature Specification: Readwise Reader API Token Integration

**Feature Branch**: `alg-33-readwise-reader-api-token-integration`
**Created**: 2026-01-11
**Status**: Draft
**Linear Issue**: [ALG-33](https://linear.app/algojuke/issue/ALG-33)
**Input**: Set up Readwise Reader API integration to allow users to connect their Readwise account and sync saved articles. Create settings UI for users to enter their Readwise access token. Guide users to readwise.io/access_token to generate their token. Validate token via GET https://readwise.io/api/v2/auth/ (returns 204 if valid). Store token securely in Clerk private metadata. Handle invalid/revoked tokens gracefully with clear error messaging. Show connection status in settings.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Approved User Connects Readwise (Priority: P1)

An AlgoJuke user with a Readwise subscription navigates to the Settings page and connects their Readwise account by entering their API token. The system validates the token and stores it securely.

**Why this priority**: This is the core happy path that enables the primary use case. Without successful token storage, no Readwise integration is possible.

**Independent Test**: Can be fully tested by navigating to settings, entering a valid Readwise token, submitting, and verifying the connection status shows as connected.

**Acceptance Scenarios**:

1. **Given** a user navigates to the Settings page, **When** they view the Readwise section, **Then** they see a form to enter their API token and a link to generate one at readwise.io/access_token.
2. **Given** a user enters a valid Readwise API token and submits, **When** the system validates the token via Readwise API, **Then** the token is stored and the connection status shows "Connected".
3. **Given** a user has connected Readwise, **When** they return to the Settings page later, **Then** they see their connection status as connected with the connected timestamp.
4. **Given** a user is viewing the Readwise connection form, **When** they click the help link, **Then** they are directed to readwise.io/access_token in a new tab.

---

### User Story 2 - User Enters Invalid Token (Priority: P2)

A user attempting to connect Readwise enters an invalid or revoked token and receives clear feedback about the error.

**Why this priority**: Error handling is essential for a good user experience when dealing with manual token entry.

**Independent Test**: Can be tested by entering an invalid token string and verifying an appropriate error message is displayed.

**Acceptance Scenarios**:

1. **Given** a user enters an invalid token (wrong characters), **When** they submit the form, **Then** they see an error message "Invalid token. Please check your token and try again."
2. **Given** a user enters a revoked token, **When** the Readwise API returns 401, **Then** they see an error message "Token is invalid or has been revoked. Please generate a new token."
3. **Given** the Readwise API is temporarily unavailable, **When** validation fails with a network error, **Then** the user sees "Unable to verify token. Please try again later." with a retry option.

---

### User Story 3 - Settings Page Access and Navigation (Priority: P3)

An authenticated AlgoJuke user accesses the Settings page where they can manage their external service connections.

**Why this priority**: Navigation and page structure are important for usability but secondary to core functionality.

**Independent Test**: Can be tested by clicking the Settings option in the user menu and verifying the page loads with Tidal and Readwise sections.

**Acceptance Scenarios**:

1. **Given** a user is signed in, **When** they click on their user menu in the header, **Then** they see a "Settings" option.
2. **Given** a user navigates to /settings, **When** the page loads, **Then** they see sections for both "Tidal" and "Readwise" connections.
3. **Given** a user has connected Tidal, **When** they view the Tidal section in Settings, **Then** they see their connection status (connected with date).
4. **Given** a user has not connected Readwise, **When** they view the Readwise section, **Then** they see the token input form with instructions.

---

### User Story 4 - User Disconnects Readwise (Priority: P4)

A user who has connected Readwise wants to disconnect their account and revoke access.

**Why this priority**: Disconnect is a recovery/management scenario, not the primary path.

**Independent Test**: Can be tested by clicking disconnect on a connected Readwise integration and verifying the status changes to disconnected.

**Acceptance Scenarios**:

1. **Given** a user has connected Readwise, **When** they view the Readwise section in Settings, **Then** they see a "Disconnect" button.
2. **Given** a user clicks "Disconnect", **When** they confirm the action, **Then** the token is removed from Clerk metadata and status shows disconnected.
3. **Given** a user has disconnected Readwise, **When** they view the section, **Then** they see the token input form again to reconnect.

---

### Edge Cases

- What happens when the user submits an empty token? -> Form validation prevents submission with error "Token is required".
- What happens when the user submits a token with only whitespace? -> Token is trimmed; empty token triggers "Token is required" error.
- What happens when the network request times out? -> Display "Connection timed out. Please try again." with retry option (10-second timeout).
- What happens when the user's session expires during settings edit? -> Redirect to sign-in, preserve /settings as return URL.
- What happens when Readwise returns an unexpected status code? -> Log the error, display generic "Unable to verify token" message.
- What happens when a user without Readwise subscription enters a token? -> Readwise API returns 401; display "Token is invalid or has been revoked."
- What happens when the user pastes a token with extra whitespace? -> Token is trimmed before validation.
- What happens when the user clicks "Connect" while a validation is in progress? -> Button is disabled during validation to prevent duplicate requests.

## Requirements _(mandatory)_

### Functional Requirements

#### Settings Page UI

- **FR-001**: System MUST provide a Settings page accessible via the user menu at route `/settings`.
- **FR-002**: Settings page MUST display a section for Tidal connection status (read-only).
- **FR-003**: Settings page MUST display a section for Readwise connection status.
- **FR-004**: Settings page MUST be protected and require authenticated user.
- **FR-005**: Settings page MUST use consistent styling with the rest of the application (dark theme, CSS variables).

#### Readwise Token Form

- **FR-006**: Readwise section MUST display a text input for the API token when not connected.
- **FR-007**: Readwise section MUST display a link to `https://readwise.io/access_token` with text "Get your access token" that opens in a new tab.
- **FR-008**: Readwise section MUST inform users that "Readwise requires a paid subscription ($9.99+/month)".
- **FR-009**: System MUST validate that the token field is not empty before submission.
- **FR-010**: Token input MUST mask the value (type="password") for security.
- **FR-011**: System MUST trim whitespace from token input before validation.
- **FR-012**: Submit button MUST be disabled while validation is in progress.
- **FR-013**: Submit button MUST display a loading indicator during validation.

#### Token Validation

- **FR-014**: System MUST validate the token by calling `GET https://readwise.io/api/v2/auth/` with header `Authorization: Token <token>`.
- **FR-015**: System MUST treat HTTP 204 response as valid token.
- **FR-016**: System MUST treat HTTP 401 response as invalid/revoked token.
- **FR-017**: System MUST implement a 10-second timeout for the validation request.
- **FR-018**: System MUST handle network errors gracefully with user-friendly messages.

#### Token Storage

- **FR-019**: System MUST store valid tokens in Clerk private metadata at path `user.privateMetadata.readwise`.
- **FR-020**: Stored token object MUST include: `accessToken` (string), `connectedAt` (number, timestamp).
- **FR-021**: System MUST use the existing Clerk SDK pattern (`clerkClient.users.updateUserMetadata`).
- **FR-022**: Token storage operation MUST be logged for observability.

#### Connection Status Display

- **FR-023**: When connected, Readwise section MUST display "Connected" status with connection date.
- **FR-024**: When connected, Readwise section MUST display a "Disconnect" button.
- **FR-025**: When not connected, Readwise section MUST display the token input form.
- **FR-026**: Tidal section MUST display current connection status (connected with date, or not connected).

#### Disconnect Flow

- **FR-027**: Disconnect button MUST show a confirmation dialog before proceeding.
- **FR-028**: System MUST remove the token from Clerk private metadata on disconnect.
- **FR-029**: System MUST update the UI to show disconnected state after successful disconnect.

#### Error Handling

- **FR-030**: System MUST display clear error messages for invalid tokens.
- **FR-031**: System MUST display clear error messages for network failures.
- **FR-032**: System MUST provide retry capability for transient failures.
- **FR-033**: Error messages MUST NOT expose sensitive information (token values).

### Out of Scope

- Readwise article/highlight synchronization (deferred to ALG-35)
- Automatic token refresh (Readwise tokens are long-lived)
- Tidal disconnect functionality (deferred to future feature)
- Multiple Readwise accounts per user
- Token expiration warnings (Readwise tokens do not expire)
- Integration with the music discovery chat agent

### Key Entities

- **ReadwiseTokens**: Represents the stored Readwise credentials. Contains `accessToken` (string) and `connectedAt` (timestamp).
- **Settings Page**: New page component at /settings managing external service connections.
- **Connection Status**: Visual representation of whether an external service is connected, with metadata (connection date).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete the Readwise connection flow (enter token, validate, store) in under 15 seconds.
- **SC-002**: 100% of valid tokens are successfully stored and retrievable from Clerk metadata.
- **SC-003**: Users see clear feedback (loading indicator, success message, or error message) within 500ms of form submission.
- **SC-004**: Invalid tokens result in user-friendly error messages 100% of the time without exposing technical details.
- **SC-005**: Users can disconnect Readwise in under 5 seconds with confirmation.
- **SC-006**: Settings page loads and displays connection statuses within 2 seconds.
- **SC-007**: The link to readwise.io/access_token works and opens in a new tab.

## Clarifications

### Session 2026-01-11

- Q: Where should the Readwise token settings UI live? -> A: New /settings page with sections for different connections (Tidal, Readwise).
- Q: Should this feature include the actual article sync, or only the token setup? -> A: Token setup only; article sync is deferred to ALG-35.
- Q: How should the token be stored? -> A: Clerk private metadata at `user.privateMetadata.readwise`, following the Tidal pattern.
- Q: Does Readwise have OAuth? -> A: No; users manually copy their access token from readwise.io/access_token.
- Q: Does Readwise require a paid subscription? -> A: Yes, Readwise Reader requires a paid subscription ($9.99+/month).
- Q: Should we use REST or GraphQL for the backend? -> A: GraphQL queries and mutations, following the existing pattern.

## Assumptions

- Users have a valid Clerk authentication session before accessing Settings.
- Users understand what Readwise is and have (or will obtain) a subscription.
- The Readwise API endpoint `GET /api/v2/auth/` remains stable for token validation.
- Readwise tokens are long-lived and do not require refresh logic.
- Clerk private metadata has sufficient storage capacity for additional provider tokens.
- The existing application styling (CSS variables, dark theme) will be applied to the new page.

## Dependencies

- **@specs/alg-20-clerk-tidal-auth**: Provides the Clerk authentication framework and token storage patterns to follow.
- **ALG-35** (future): Will consume the Readwise token stored by this feature for article synchronization.
