# Feature Specification: Per-User Music Library Storage

**Feature Branch**: `018-per-user-library`
**Created**: 2026-01-04
**Status**: Draft
**Input**: User description: "Per-user music library storage. Each authenticated user logged in via @specs/016-clerk-tidal-auth/spec.md should have their own music library that they can individually manage via the Tidal search and library management features @specs/001-tidal-search/spec.md / @specs/002-library-management/spec.md. The agent tools in @specs/011-agent-tools/spec.md should reflect the library status of each track for the currently logged in user. Additionally, each user should have their own conversation history for the agentic chat introduced in @specs/010-discover-chat/spec.md. The GraphQL queries and mutations related to all application features must require authentication via Clerk."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User-Specific Library Management (Priority: P1)

As an authenticated user, I want to add albums and tracks to my personal music library so that I can build and manage my own collection separately from other users.

**Why this priority**: This is the core value proposition - enabling multi-user support for the existing library management feature. Without user isolation, the library feature cannot support multiple users securely.

**Independent Test**: Can be fully tested by logging in as User A, adding an album to the library, logging out, logging in as User B, and verifying that User B's library does not contain User A's album. Delivers immediate value by enabling private library collections.

**Acceptance Scenarios**:

1. **Given** I am authenticated as User A, **When** I add an album to my library, **Then** the album is stored in my personal library and not visible to other users.
2. **Given** I am authenticated and have albums in my library, **When** I browse the Albums view, **Then** I see only albums that I have added to my library.
3. **Given** I am authenticated, **When** I remove a track from my library, **Then** only my library is affected and other users' libraries remain unchanged.
4. **Given** I am authenticated, **When** I add a track that another user has also added, **Then** both users have independent copies in their respective libraries.
5. **Given** I restart the application and sign in, **When** I navigate to my library, **Then** all previously added albums and tracks are present.

---

### User Story 2 - Protected Application Access (Priority: P1)

As a user, I expect all application features to require authentication so that my personal data remains secure and inaccessible to unauthenticated users.

**Why this priority**: Security is foundational - without authentication enforcement, user data isolation is meaningless. This must be in place for any multi-user feature to function securely.

**Independent Test**: Can be tested by attempting to access library, search, chat, or discover features without authentication and verifying that all requests are rejected with appropriate error messages.

**Acceptance Scenarios**:

1. **Given** I am not authenticated, **When** I attempt to access any library feature (add/remove/browse albums or tracks), **Then** the request is rejected with an authentication required error.
2. **Given** I am not authenticated, **When** I attempt to search for music on Tidal, **Then** the request is rejected with an authentication required error.
3. **Given** I am not authenticated, **When** I attempt to access the Discover section (search or chat), **Then** the request is rejected with an authentication required error.
4. **Given** I am authenticated, **When** I access any application feature, **Then** the request proceeds normally with my user context.
5. **Given** my authentication session expires, **When** I attempt to perform any action, **Then** I am redirected to sign in again.

---

### User Story 3 - User-Specific Conversation History (Priority: P2)

As an authenticated user, I want my chat conversations with the AI assistant to be private to me so that I can have personal discussions about music without other users seeing my conversation history.

**Why this priority**: Conversation history contains personal preferences and interactions. While library isolation is more critical for core functionality, conversation privacy is essential for user trust and a complete multi-user experience.

**Independent Test**: Can be tested by having a conversation as User A, switching to User B, and verifying that User B's conversation sidebar shows only their own conversations.

**Acceptance Scenarios**:

1. **Given** I am authenticated as User A and have chat conversations, **When** User B logs in and views the Chat tab, **Then** User B sees only their own conversations (not User A's).
2. **Given** I am authenticated and start a new conversation, **When** I send messages and receive AI responses, **Then** the conversation is stored under my user account.
3. **Given** I am authenticated, **When** I delete a conversation, **Then** only my conversation is deleted and other users' conversations remain unaffected.
4. **Given** I sign out and sign back in, **When** I navigate to the Chat tab, **Then** my previous conversations are still available in my conversation history.
5. **Given** I am viewing my conversation history, **When** I select a past conversation, **Then** I can continue that conversation with full context preserved.

---

### User Story 4 - User-Aware Agent Tool Responses (Priority: P2)

As an authenticated user interacting with the AI agent, I want the agent tools to accurately reflect whether tracks are in my personal library so that I receive personalized recommendations and status information.

**Why this priority**: The agent tools provide real-time information about library status. Without user-specific awareness, the library flags would be incorrect or meaningless in a multi-user context, degrading the agent's usefulness.

**Independent Test**: Can be tested by adding a track to User A's library, then having User A ask the agent about that track (should show "in library"), then having User B ask about the same track (should show "not in library").

**Acceptance Scenarios**:

1. **Given** I am authenticated and have Track X in my library, **When** the agent performs a semantic search that includes Track X, **Then** the results show Track X with "in library" status.
2. **Given** I am authenticated and do NOT have Track Y in my library, **When** the agent searches Tidal and finds Track Y, **Then** the results show Track Y with "not in library" status.
3. **Given** User A has Track Z in their library but User B does not, **When** User B asks the agent about Track Z, **Then** the library status shows "not in library" for User B.
4. **Given** I am authenticated, **When** the agent uses batch metadata retrieval for ISRCs, **Then** the library membership flags reflect my personal library state.
5. **Given** I am in a conversation with the agent, **When** the agent suggests tracks, **Then** the library flags accurately distinguish between tracks I own and tracks I could discover.

---

### User Story 5 - Authenticated Tidal Search (Priority: P3)

As an authenticated user, I want to search for music on Tidal while signed in so that search results can reflect my library state and I can add discovered music to my personal collection.

**Why this priority**: Search is the entry point for discovering and adding music. While it builds on existing functionality, ensuring it works correctly with authentication completes the user journey from discovery to library management.

**Independent Test**: Can be tested by performing a Tidal search while authenticated, viewing results that include tracks in the user's library, and verifying the library status indicators are accurate.

**Acceptance Scenarios**:

1. **Given** I am authenticated, **When** I search for "Abbey Road", **Then** I see search results with accurate library status for each album and track based on my library.
2. **Given** I am authenticated and have an album in my library, **When** I search and that album appears in results, **Then** it shows an "Added" indicator.
3. **Given** I am authenticated, **When** I click to add an album from search results, **Then** it is added to my personal library (not a shared library).
4. **Given** I am authenticated, **When** I view search results, **Then** I can distinguish between albums/tracks in my library and those not yet added.

---

### Edge Cases

- What happens when a user tries to access another user's library data directly (e.g., via manipulated requests)? The system should validate user ownership and reject unauthorized access attempts.
- What happens when a user's Clerk session expires mid-operation? The operation should fail gracefully with an authentication error and prompt re-authentication.
- What happens when the same user is logged in on multiple devices? Both sessions should have consistent access to the same user's library and conversations.
- What happens when a user account is deleted from Clerk? The system cascade deletes all associated library data and conversation history.
- What happens when the authentication service (Clerk) is unavailable? The system should return a service unavailable error rather than allowing unauthenticated access.
- What happens when a user adds a track to their library that was previously deleted? The track should be added as a new entry with the current timestamp.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication Enforcement

- **FR-001**: System MUST require valid Clerk authentication for all library management operations (add, remove, browse albums and tracks).
- **FR-002**: System MUST require valid Clerk authentication for all Tidal search operations.
- **FR-003**: System MUST require valid Clerk authentication for all Discover section operations (semantic search, chat).
- **FR-004**: System MUST require valid Clerk authentication for all agent tool invocations.
- **FR-005**: System MUST return a clear authentication error when an unauthenticated request is made to any protected operation.
- **FR-006**: System MUST validate the user identity from Clerk tokens before processing any request.

#### User-Specific Library Storage

- **FR-007**: System MUST associate each saved album with the user who added it.
- **FR-008**: System MUST associate each saved track with the user who added it.
- **FR-009**: System MUST only return library items belonging to the authenticated user when browsing.
- **FR-010**: System MUST only allow users to remove items from their own library.
- **FR-011**: System MUST allow multiple users to independently have the same album or track in their respective libraries.
- **FR-012**: System MUST prevent users from accessing, viewing, or modifying other users' library data.

#### User-Specific Conversation History

- **FR-013**: System MUST associate each chat conversation with the user who created it.
- **FR-014**: System MUST only display conversations belonging to the authenticated user in the conversation sidebar.
- **FR-015**: System MUST only allow users to delete their own conversations.
- **FR-016**: System MUST maintain conversation context and history per user across sessions.
- **FR-017**: System MUST prevent users from accessing or viewing other users' conversations.

#### User-Aware Agent Tools

- **FR-018**: Semantic search tool MUST determine library membership based on the authenticated user's library.
- **FR-019**: Tidal search tool MUST determine library membership based on the authenticated user's library.
- **FR-020**: Batch metadata tool MUST determine library membership based on the authenticated user's library.
- **FR-021**: All agent tool responses MUST include accurate library status flags for the current user.

#### Search Integration

- **FR-022**: Tidal search results MUST indicate library status based on the authenticated user's library.
- **FR-023**: Adding items from search results MUST add them to the authenticated user's library.

#### Data Lifecycle

- **FR-024**: System MUST cascade delete all user library data (albums and tracks) when a user account is deleted from Clerk.
- **FR-025**: System MUST cascade delete all user conversation history when a user account is deleted from Clerk.

#### Security Logging

- **FR-026**: System MUST log all authentication failures with timestamp, attempted operation, and request origin.
- **FR-027**: System MUST log all unauthorized access attempts (requests to access another user's data) with timestamp, authenticated user, target resource, and request origin.

### Key Entities

- **User**: Represents an authenticated user identified by their Clerk user ID. Has relationships to their library items and conversations. Each user has a unique, isolated view of the application data.
- **Library Item (Album/Track)**: Represents a saved album or track in a user's library. Contains the user identifier, Tidal item identifier, and metadata. The same Tidal item can exist in multiple users' libraries as independent records.
- **Conversation**: Represents a chat session between a user and the AI assistant. Contains the user identifier, messages, and timestamps. Each conversation belongs to exactly one user.
- **Message**: Represents a single communication within a conversation. Inherits user ownership from its parent conversation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of unauthenticated requests to protected operations are rejected with appropriate error messages.
- **SC-002**: Users see only their own library items when browsing, with zero cross-user data leakage.
- **SC-003**: Users see only their own conversations in the chat sidebar, with zero cross-user data leakage.
- **SC-004**: Agent tool library status flags are accurate for the authenticated user in 100% of tool invocations.
- **SC-005**: Library operations (add, remove, browse) complete within <2 seconds after adding user filtering.
- **SC-006**: Conversation operations (list, view, delete) complete within <3 seconds after adding user filtering.
- **SC-007**: A user with 500 library items experiences the same browsing performance as in the single-user system.

## Clarifications

### Session 2026-01-04

- Q: How should existing library and conversation data be migrated? → A: All existing music library records and chat conversation records should be associated with the user anton.tcholakov@gmail.com during migration.
- Q: What happens when a user account is deleted from Clerk? → A: Cascade delete - Remove all library and conversation data when user is deleted.
- Q: Should the system log security-relevant events? → A: Log authentication failures and unauthorized access violations only.

## Assumptions

- The Clerk authentication system (from 016-clerk-tidal-auth) is already integrated and provides reliable user identity verification.
- The existing library management schema can be extended with a user identifier column without data loss.
- The existing conversation schema can be extended with a user identifier column without data loss.
- All existing library and conversation data will be migrated and associated with the user "anton.tcholakov@gmail.com".
- The Clerk user ID is a stable identifier that persists across sessions and can be used as a foreign key.
- All GraphQL resolvers have access to the authenticated user's identity from the request context.

## Dependencies

- **specs/016-clerk-tidal-auth**: Provides the authentication infrastructure and user identity.
- **specs/002-library-management**: Provides the existing library management functionality to be extended.
- **specs/010-discover-chat**: Provides the existing conversation history functionality to be extended.
- **specs/011-agent-tools**: Provides the agent tools that need user-aware library status.
- **specs/001-tidal-search**: Provides the search functionality that needs authentication and user-aware status.

## Scope Boundaries

### In Scope

- Adding user ownership to library albums and tracks
- Adding user ownership to chat conversations
- Enforcing Clerk authentication on all GraphQL queries and mutations
- Updating agent tools to use authenticated user context for library lookups
- Updating search results to reflect user-specific library status
- Migrating existing data to support user ownership

### Out of Scope

- User-to-user library sharing or collaborative features
- Admin interface for viewing all users' data
- User data export functionality
- Cross-device synchronization beyond standard database consistency
- User preferences or settings beyond library and conversation ownership
- Public/private library visibility toggles

### Deferred to Future Work

- **Clerk Webhook Integration**: FR-024 and FR-025 (cascade delete on user account deletion) require Clerk webhook infrastructure that is out of scope for MVP. These requirements will be addressed when webhook handling is implemented. In the interim, user data remains orphaned if a Clerk account is deleted directly through Clerk's admin interface.
