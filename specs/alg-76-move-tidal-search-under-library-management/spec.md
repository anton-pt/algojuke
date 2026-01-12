# Feature Specification: Move Tidal Search under Library Management

**Feature Branch**: `alg-76-move-tidal-search-under-library-management`
**Created**: 2026-01-12
**Status**: Draft
**Linear Issue**: [ALG-76](https://linear.app/algojuke/issue/ALG-76)
**Input**: The Tidal search feature introduced in [ALG-5](https://linear.app/algojuke/issue/ALG-5/feat-tidal-music-search-application) should be placed under the Library management screen introduced in [ALG-6](https://linear.app/algojuke/issue/ALG-6/feat-personal-music-library-management) rather than being a separate screen. It should live alongside the Tidal sync button introduced in [ALG-32](https://linear.app/algojuke/issue/ALG-32/tidal-library-synchronysation-flow).

## Clarifications

### Session 2026-01-12

- Q: Which Tidal search screen should be moved - basic keyword search or semantic discovery search? → A: Basic keyword search (/search)
- Q: Where should the search UI be positioned within the Library screen? → A: Place search in the header area next to the 'Sync with Tidal' button, display as modal similar to TidalSyncModal
- Q: Should the search results be displayed inline with library content or in a separate view? → A: Modal/overlay
- Q: What should happen to the current /search route after moving the search? → A: Remove completely

## User Scenarios & Testing

### User Story 1 - Search Button Visibility (Priority: P1)

As a user, I want to see a "Search Tidal" button in the Library screen header so that I can search for music to add to my library.

**Why this priority**: The search button is the entry point to the feature. Without it being visible, users cannot access the search functionality.

**Independent Test**: Navigate to /library and verify the "Search Tidal" button appears next to the "Sync with Tidal" button in the header. Click the button and verify a modal opens.

**Acceptance Scenarios**:

1. **Given** I am on the Library page (/library/albums or /library/tracks), **When** I look at the header, **Then** I see a "Search Tidal" button with a magnifying glass icon positioned next to the "Sync with Tidal" button
2. **Given** I am viewing my library on desktop, **When** I look at the button layout, **Then** both buttons appear horizontally side-by-side in the header
3. **Given** I am viewing my library on mobile, **When** I look at the button layout, **Then** both buttons stack vertically in the header (responsive design)
4. **Given** I don't have a Tidal connection, **When** I view the Library page, **Then** I don't see the "Search Tidal" button

---

### User Story 2 - Open Search Modal (Priority: P1)

As a user, I want to click the "Search Tidal" button to open a search modal so that I can search for albums and tracks without leaving the library screen.

**Why this priority**: This is the core interaction that enables the search functionality. Without being able to open the modal, no other features work.

**Independent Test**: Click the "Search Tidal" button and verify a modal appears with a search input, close button, and tabs for Albums/Tracks.

**Acceptance Scenarios**:

1. **Given** I am on the Library page, **When** I click the "Search Tidal" button, **Then** a modal dialog opens with the title "Search Tidal Catalog"
2. **Given** the search modal is open, **When** I view the modal, **Then** I see a search input field, a search button, and two tabs labeled "Albums" and "Tracks"
3. **Given** the search modal is open, **When** I click the close button (X), **Then** the modal closes and I return to the library view
4. **Given** the search modal is open, **When** I press the Escape key, **Then** the modal closes
5. **Given** the search modal is open, **When** I click outside the modal (on the overlay), **Then** the modal closes

---

### User Story 3 - Search for Music (Priority: P1)

As a user, I want to enter a search query and see matching albums and tracks so that I can find music to add to my library.

**Why this priority**: This is the core search functionality - the primary purpose of the feature.

**Independent Test**: Open the search modal, enter "radiohead" in the search input, click Search, and verify results appear in the Albums tab with album artwork and metadata.

**Acceptance Scenarios**:

1. **Given** the search modal is open, **When** I type "radiohead" in the search input and click the Search button (or press Enter), **Then** I see loading indicators followed by search results
2. **Given** search results have loaded, **When** I view the Albums tab, **Then** I see a list of matching albums with cover art, title, artist name, and an "Add to Library" button
3. **Given** search results have loaded, **When** I switch to the Tracks tab, **Then** I see a list of matching tracks with artwork, title, artist name, album name, duration, and an "Add to Library" button
4. **Given** search results have loaded, **When** I view the tab badges, **Then** I see the count of results for each tab (e.g., "Albums (5)")
5. **Given** I have performed a search, **When** I enter a new query and search again, **Then** the previous results are replaced with new results

---

### User Story 4 - Add Music to Library from Modal (Priority: P1)

As a user, I want to add albums and tracks to my library directly from the search modal so that I can quickly build my collection.

**Why this priority**: This connects the search functionality with the library management feature - the core value of having search in the library screen.

**Independent Test**: Search for an album, click the "Add to Library" button, verify the button shows success state, close the modal, and verify the album appears in the library.

**Acceptance Scenarios**:

1. **Given** I have search results in the Albums tab, **When** I click the "Add to Library" button on an album, **Then** the button shows a loading state followed by a success message ("Added!")
2. **Given** I have added an album from the search modal, **When** I close the modal and navigate to the Albums view, **Then** I see the newly added album in my library
3. **Given** I have search results in the Tracks tab, **When** I click the "+" button on a track, **Then** the button shows a success state and the track is added to my library
4. **Given** I click "Add to Library" on an album or track that's already in my library, **When** the operation completes, **Then** I see a message indicating the item is already in my library
5. **Given** I have added multiple items from the search modal, **When** I continue browsing search results, **Then** the modal remains open and I can add more items

---

### User Story 5 - Handle Search Errors (Priority: P2)

As a user, I want to see clear error messages when search fails or returns no results so that I understand what went wrong.

**Why this priority**: Essential for user experience but secondary to core search functionality. Prevents user confusion.

**Independent Test**: Search for a nonsense query like "xyzabc123notarealband" and verify a "No results found" message appears.

**Acceptance Scenarios**:

1. **Given** I search for content that doesn't exist on Tidal, **When** the search completes, **Then** I see a "No results found" message with suggestions to try different search terms
2. **Given** I submit an empty search query, **When** I click Search, **Then** the search is not submitted (input validation prevents empty queries)
3. **Given** the Tidal API is unavailable, **When** I perform a search, **Then** I see an error message indicating the service is unavailable
4. **Given** I have entered a very long query (200 characters), **When** I try to enter more characters, **Then** the input field prevents additional characters (maxLength validation)

---

### User Story 6 - Modal State Management (Priority: P3)

As a user, I want the search modal to reset when I close it so that I start fresh each time I search.

**Why this priority**: Nice-to-have quality of life improvement. Not critical for core functionality.

**Independent Test**: Perform a search, close the modal, reopen it, and verify the previous search query and results are cleared.

**Acceptance Scenarios**:

1. **Given** I have performed a search with results displayed, **When** I close the modal and reopen it, **Then** the search input is empty and no results are shown
2. **Given** the search modal is open with the Tracks tab selected, **When** I close the modal and reopen it, **Then** the Albums tab is selected by default
3. **Given** the search modal is open, **When** I click the Search button without entering a query, **Then** no search is performed and no error is shown (graceful no-op)

---

## Functional Requirements

**FR-001**: System MUST provide a "Search Tidal" button in the Library page header, positioned next to the "Sync with Tidal" button

**FR-002**: System MUST open a modal dialog when the "Search Tidal" button is clicked

**FR-003**: System MUST display a search input field, search button, and tab navigation (Albums/Tracks) in the modal

**FR-004**: System MUST execute a search query against the Tidal API when the user submits a search

**FR-005**: System MUST display album results with cover art, title, artist name, and "Add to Library" button in the Albums tab

**FR-006**: System MUST display track results with artwork, title, artist name, album name, duration, and "Add to Library" button in the Tracks tab

**FR-007**: System MUST allow users to add albums and tracks to their library directly from search results

**FR-008**: System MUST show result counts in tab badges (e.g., "Albums (5)")

**FR-009**: System MUST close the modal when the user clicks the close button, presses Escape, or clicks outside the modal

**FR-010**: System MUST display loading indicators during search operations

**FR-011**: System MUST display error messages when search fails or returns no results

**FR-012**: System MUST validate search input (non-empty, max 200 characters)

**FR-013**: System MUST reset modal state (clear query and results) when the modal closes

**FR-014**: System MUST keep the modal open after adding items to allow multiple additions in one session

**FR-015**: System MUST provide keyboard accessibility (Tab navigation, focus trap, Escape to close)

**FR-016**: System MUST remove the /search route and "Search" navigation link from the app

## Edge Cases

1. **Empty search query**: Prevent submission of empty queries via input validation
2. **Very long queries**: Enforce 200 character limit on search input
3. **No results found**: Display helpful message with suggestions
4. **Tidal API unavailable**: Show error message indicating service is unavailable
5. **Duplicate additions**: Show "Already in library" message when attempting to add existing items
6. **Rapid tab switching**: Ensure tab state updates correctly during quick switches
7. **Modal open during navigation**: Close modal automatically if user navigates away from library
8. **Focus management**: Focus search input when modal opens, trap focus within modal
9. **Mobile responsiveness**: Stack header buttons vertically on narrow screens
10. **Cached results**: Display cache indicator if results are served from cache

## Dependencies

- **@specs/alg-5-tidal-search**: Reuses SEARCH_QUERY GraphQL query, AlbumCard, TrackCard, NoResultsMessage, LoadingSkeleton components
- **@specs/alg-6-library-management**: Integrates into Library page header, uses existing "Add to Library" mutations
- **@specs/alg-32-tidal-library-sync**: Follows TidalSyncModal pattern for modal structure, styling, and behavior

## Out of Scope

- **Pagination**: Initial implementation displays up to 20 results (SEARCH_QUERY default limit) without "Load More" functionality
- **Advanced filters**: No filtering by year, genre, or other metadata
- **Search history**: No persistence of previous searches
- **Semantic search**: Only basic keyword search is included (semantic search remains in /discover/search)
- **Bulk operations**: No "Add All" functionality (items added individually)
- **Search suggestions**: No autocomplete or search term suggestions
- **Sorting options**: Results displayed in Tidal API default order
- **Preview playback**: No audio preview within search modal
