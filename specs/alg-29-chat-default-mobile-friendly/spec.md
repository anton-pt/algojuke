# Feature Specification: Make Chat Mode Default and Mobile-Friendly

**Feature Branch**: `alg-29-chat-default-mobile-friendly`
**Created**: 2026-01-08
**Status**: Draft
**Linear Issue**: [ALG-29](https://linear.app/algojuke/issue/ALG-29)
**Input**: The Discover screen currently has a Chat mode and a Search mode, with Search mode being the default. This issue is to switch the default to Chat. A pre-requisite for doing so is to ensure that the Chat experience is mobile-friendly. Currently, the user is not able to see the list of historical chats on narrow screen widths.

## Clarifications

### Session 2026-01-08

- Q: How should the conversation history be accessible on mobile? → A: Slide-out drawer - hamburger menu button that opens a slide-out drawer containing the conversation list
- Q: Should there be a way to toggle back to Search mode? → A: Keep both tabs - Search tab remains accessible but Chat is default when navigating to /discover
- Q: Should the conversation sidebar be collapsible on desktop? → A: Collapsible - add toggle button to hide/show sidebar on desktop

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Mobile Conversation Access (Priority: P1)

As a mobile user, I want to access my conversation history via a slide-out drawer so that I can switch between chats and start new conversations on narrow screens where the sidebar is not visible.

**Why this priority**: This is the core requirement for making Chat mobile-friendly. Without access to conversation history on mobile, users cannot switch between or manage their chats, making the mobile experience incomplete.

**Independent Test**: Can be fully tested by resizing browser below 768px, tapping the hamburger menu button, and verifying that a drawer slides in from the left showing the conversation list with the ability to select and delete conversations.

**Acceptance Scenarios**:

1. **Given** I am on the Chat page on a screen narrower than 768px, **When** I look at the chat interface, **Then** I see a hamburger menu button in the top-left area of the chat view
2. **Given** I see the hamburger menu button, **When** I tap it, **Then** a drawer slides in from the left edge showing my conversation history
3. **Given** the drawer is open, **When** I tap on a conversation, **Then** that conversation loads and the drawer automatically closes
4. **Given** the drawer is open, **When** I tap the "New Chat" button, **Then** a new empty chat starts and the drawer closes
5. **Given** the drawer is open, **When** I tap on a conversation's delete button, **Then** the delete confirmation appears within the drawer context
6. **Given** the drawer is open, **When** I tap on the semi-transparent overlay behind it, **Then** the drawer closes without changing the current conversation
7. **Given** a streaming response is in progress, **When** I open the drawer and try to switch conversations, **Then** I see the existing confirmation dialog about leaving during streaming

---

### User Story 2 - Default to Chat Tab (Priority: P1)

As a user navigating to the Discover section, I want Chat to be the default experience so that I can immediately start conversing with the AI assistant without having to manually switch tabs.

**Why this priority**: This is explicitly requested in the issue and is a simple routing change that directly addresses the core requirement of making Chat the default.

**Independent Test**: Can be tested by navigating to `/discover` and verifying that the page redirects to `/discover/chat` with the Chat tab visually active.

**Acceptance Scenarios**:

1. **Given** I am on any page in the app, **When** I navigate to `/discover`, **Then** I am redirected to `/discover/chat`
2. **Given** I am on the Discover page, **When** I view the navigation tabs, **Then** the "Chat" tab is visually indicated as active
3. **Given** I have previously visited `/discover/search`, **When** I navigate to `/discover` (not `/discover/search`), **Then** I still land on `/discover/chat` as the default
4. **Given** I am on the Chat tab, **When** I click the Search tab and then navigate away and back to `/discover`, **Then** I return to the Chat tab (the default)

---

### User Story 3 - Collapsible Desktop Sidebar (Priority: P2)

As a desktop user, I want to collapse the conversation sidebar to maximize chat space when I don't need to see my conversation history, and have my preference remembered.

**Why this priority**: This enhances the desktop experience but is not required for basic functionality. The sidebar already works on desktop; this adds a nice-to-have space optimization.

**Independent Test**: Can be tested by clicking the collapse toggle button on the sidebar and verifying it animates to a narrow icon-only state, and that refreshing the page preserves the collapsed state.

**Acceptance Scenarios**:

1. **Given** I am on the Chat page on a screen wider than 768px, **When** I view the sidebar, **Then** I see a collapse toggle button (chevron or similar icon) in the sidebar header
2. **Given** the sidebar is expanded (280px), **When** I click the collapse button, **Then** the sidebar smoothly animates to a collapsed state (~60px wide) showing only the "New Chat" button icon
3. **Given** the sidebar is collapsed, **When** I click the expand button, **Then** the sidebar smoothly animates back to the expanded state (280px) showing full conversation list
4. **Given** I have collapsed the sidebar, **When** I refresh the page, **Then** the sidebar remains collapsed (preference persisted in localStorage)
5. **Given** the sidebar is collapsed, **When** I hover over it or click on it, **Then** I can still access the expand button to restore it

---

### User Story 4 - Responsive Sidebar Transition (Priority: P2)

As a user resizing my browser window, I want the sidebar to smoothly transition between desktop and mobile states so that the experience feels polished as I resize.

**Why this priority**: This is a polish feature that improves the overall UX but is not critical for core functionality.

**Independent Test**: Can be tested by resizing the browser across the 768px breakpoint and verifying the sidebar transitions appropriately between desktop collapsed/expanded state and mobile hidden/drawer state.

**Acceptance Scenarios**:

1. **Given** I am on desktop (>768px) with sidebar expanded, **When** I resize below 768px, **Then** the sidebar hides and the hamburger button appears
2. **Given** I am on mobile (<768px) with drawer open, **When** I resize above 768px, **Then** the drawer closes and the sidebar appears in its persisted state (collapsed or expanded)
3. **Given** I am on desktop with sidebar collapsed, **When** I resize below 768px and back above 768px, **Then** the sidebar returns to its collapsed state (not reset to expanded)

---

## Edge Cases

- **Drawer open during resize**: If user has drawer open on mobile and resizes to desktop, drawer should close and desktop sidebar should appear
- **Streaming during drawer interaction**: Opening drawer and trying to switch conversations during active streaming should show existing LeaveConfirmDialog
- **Empty conversation list**: Drawer should show appropriate empty state message when no conversations exist
- **Long conversation titles**: In collapsed sidebar hover state, long titles should be truncated with ellipsis
- **Fast repeated toggles**: Rapid clicking of collapse button should not cause animation glitches

## Functional Requirements

| ID     | Requirement                                                                                  |
| ------ | -------------------------------------------------------------------------------------------- |
| FR-001 | Change default Discover route from `/discover/search` to `/discover/chat`                    |
| FR-002 | Add hamburger menu button visible only on mobile (<768px) positioned in the chat header area |
| FR-003 | Implement slide-out drawer component that renders the conversation list                      |
| FR-004 | Add semi-transparent overlay (rgba(0,0,0,0.5)) behind drawer when open                       |
| FR-005 | Close drawer automatically on conversation selection, new chat creation, or overlay tap      |
| FR-006 | Add collapse toggle button to sidebar header on desktop (>768px)                             |
| FR-007 | Animate sidebar width between 280px (expanded) and 60px (collapsed) with 0.2s transition     |
| FR-008 | Show only "New Chat" icon button in collapsed sidebar state                                  |
| FR-009 | Persist collapsed/expanded preference in localStorage key `chat-sidebar-collapsed`           |
| FR-010 | Drawer should slide in from left edge with transform animation (0.3s ease-out)               |

## Dependencies

- `@specs/alg-14-discover-chat` - Base Chat implementation with sidebar and streaming
- `@specs/alg-13-semantic-discovery-search` - Search tab and Discover section structure

## Out of Scope

- Removing the Search tab (both tabs remain accessible, Chat is just the default)
- Changes to Chat functionality beyond layout and navigation
- Desktop drawer (desktop uses collapsible sidebar, mobile uses drawer)
- Gesture-based drawer interactions (swipe to open/close)
- Conversation grouping or search within drawer
