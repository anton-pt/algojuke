# Tasks: Discover Chat Agent

**Input**: Design documents from `/specs/010-discover-chat/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`, `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema

### Contract Tests (Before Implementation)

- [x] T001-CT [P] Write contract test for Conversation entity schema validation in backend/tests/contract/chat-entities.test.ts
- [x] T002-CT [P] Write contract test for Message entity schema validation in backend/tests/contract/chat-entities.test.ts
- [x] T003-CT [P] Write contract test for ContentBlock Zod schema in backend/tests/contract/chat-schemas.test.ts
- [x] T004-CT [P] Write contract test for ChatStreamRequest Zod schema in backend/tests/contract/chat-schemas.test.ts

### Implementation

- [x] T001 Create Conversation entity in backend/src/entities/Conversation.ts per data-model.md
- [x] T002 Create Message entity in backend/src/entities/Message.ts per data-model.md
- [x] T003 Create Zod schemas for ContentBlock and message validation in backend/src/schemas/chat.ts
- [x] T004 Generate TypeORM migration for conversations and messages tables in backend/src/migrations/
- [x] T005 Run migration to create chat tables: npm run migration:run
- [x] T006 Add chat.graphql schema file to backend/src/schema/chat.graphql per contracts/chat.graphql
- [x] T007 Register chat schema in Apollo Server schema merge in backend/src/server.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Contract Tests (Before Implementation)

- [x] T005-CT [P] Write contract test for GraphQL conversations query response shape in backend/tests/contract/chat-graphql.test.ts (covered in chat-schemas.test.ts)
- [x] T006-CT [P] Write contract test for GraphQL conversation(id) query response shape in backend/tests/contract/chat-graphql.test.ts (covered in chat-schemas.test.ts)
- [x] T007-CT [P] Write contract test for GraphQL deleteConversation mutation response shape in backend/tests/contract/chat-graphql.test.ts (covered in chat-schemas.test.ts)
- [x] T008-CT [P] Write contract test for GraphQL createConversation mutation response shape in backend/tests/contract/chat-graphql.test.ts (covered in chat-schemas.test.ts)
- [x] T009-CT Write contract test for ChatService method signatures and return types in backend/tests/contract/chat-service.test.ts (covered in chat-entities.test.ts)

### Implementation

- [x] T008 Create ChatService class with conversation CRUD operations in backend/src/services/chatService.ts
- [x] T009 [P] Implement getConversations(userId) returning sorted list in chatService.ts
- [x] T010 [P] Implement getConversationWithMessages(id) with message ordering in chatService.ts
- [x] T011 [P] Implement createConversation(userId) in chatService.ts
- [x] T012 [P] Implement createMessage(conversationId, role, content) with updatedAt touch in chatService.ts
- [x] T013 [P] Implement deleteConversation(id) with cascade in chatService.ts
- [x] T014 Extend langfuse.ts with createChatTrace(conversationId, messageContent) using sessionId in backend/src/utils/langfuse.ts (integrated in chatStreamService.ts)
- [x] T015 Create chat GraphQL resolvers skeleton in backend/src/resolvers/chatResolver.ts
- [x] T016 [P] Implement conversations query resolver with union type handling in chatResolver.ts
- [x] T017 [P] Implement conversation(id) query resolver in chatResolver.ts
- [x] T018 [P] Implement deleteConversation mutation resolver in chatResolver.ts
- [x] T019 [P] Implement createConversation mutation resolver in chatResolver.ts
- [x] T020 Add computed preview field resolver using first user message in chatResolver.ts
- [x] T021 Add computed messageCount field resolver in chatResolver.ts
- [x] T022 Register chatResolver in Apollo Server resolver merge in backend/src/server.ts
- [x] T023 Inject chatService into Apollo context in backend/src/server.ts

**Checkpoint**: Foundation ready - GraphQL queries work, service layer complete

---

## Phase 3: User Story 1 - Chat with AI Assistant (Priority: P1) 🎯 MVP

**Goal**: User can send messages and receive streaming AI responses

**Independent Test**: Navigate to Chat tab, type message, see streaming response progressively appear

### Contract & Integration Tests (Before Implementation)

- [x] T010-CT [P] Write contract test for SSE message_start event format in backend/tests/contract/chat-sse.test.ts
- [x] T011-CT [P] Write contract test for SSE text_delta event format in backend/tests/contract/chat-sse.test.ts
- [x] T012-CT [P] Write contract test for SSE message_end event format in backend/tests/contract/chat-sse.test.ts
- [x] T013-CT [P] Write contract test for SSE error event format in backend/tests/contract/chat-sse.test.ts
- [x] T014-IT Write integration test for POST /api/chat/stream endpoint (new conversation) in backend/tests/integration/chat-stream.test.ts
- [x] T015-IT Write integration test for POST /api/chat/stream endpoint (existing conversation) in backend/tests/integration/chat-stream.test.ts
- [x] T016-IT Write integration test for message persistence after stream completes in backend/tests/integration/chat-stream.test.ts

### Backend Implementation for User Story 1

- [x] T024 [US1] Create Express router for chat SSE endpoint in backend/src/routes/chatRoutes.ts
- [x] T025 [US1] Implement POST /api/chat/stream route with SSE headers in chatRoutes.ts
- [x] T026 [US1] Add Zod validation for ChatStreamRequest (message, conversationId?) in chatRoutes.ts
- [x] T027 [US1] Implement streamChat function using Vercel AI SDK streamText in chatRoutes.ts (implemented in chatStreamService.ts)
- [x] T028 [US1] Configure Claude Sonnet model (claude-sonnet-4-5-20250929) with system prompt in chatRoutes.ts (implemented in chatStreamService.ts)
- [x] T029 [US1] Add system prompt focusing on music discovery and mood-based recommendations in chatRoutes.ts (implemented in chatStreamService.ts)
- [x] T030 [US1] Implement SSE event emission (message_start, text_delta, message_end) in chatRoutes.ts (implemented in chatStreamService.ts)
- [x] T031 [US1] Save user message to database before streaming starts in chatRoutes.ts (implemented in chatStreamService.ts)
- [x] T032 [US1] Save assistant message to database after stream completes in chatRoutes.ts (implemented in chatStreamService.ts)
- [x] T033 [US1] Add Langfuse trace with sessionId=conversationId for each chat request in chatRoutes.ts (implemented in chatStreamService.ts)
- [x] T034 [US1] Add generation span to trace with model, input, output, usage in chatRoutes.ts (implemented in chatStreamService.ts)
- [x] T035 [US1] Register chat routes in Express app before Apollo Server in backend/src/server.ts
- [x] T036 [US1] Add express.json() middleware for chat routes body parsing in server.ts

### Frontend Implementation for User Story 1

- [x] T037 [P] [US1] Create chat GraphQL queries and types in frontend/src/graphql/chat.ts
- [x] T038 [P] [US1] Create useChatStream hook for SSE consumption in frontend/src/hooks/useChatStream.ts
- [x] T039 [US1] Implement fetch with ReadableStream for SSE parsing in useChatStream.ts
- [x] T040 [US1] Add AbortController ref for stream cancellation in useChatStream.ts
- [x] T041 [US1] Implement message state accumulation from text_delta events in useChatStream.ts
- [x] T042 [P] [US1] Create ChatMessage component for single message display in frontend/src/components/chat/ChatMessage.tsx
- [x] T043 [US1] Style user/assistant messages with visual distinction in ChatMessage.tsx
- [x] T044 [P] [US1] Create ChatInput component with text area and send button in frontend/src/components/chat/ChatInput.tsx
- [x] T045 [US1] Add whitespace-only validation to prevent empty sends in ChatInput.tsx
- [x] T046 [US1] Disable input while response is generating (FR-008) in ChatInput.tsx
- [x] T047 [P] [US1] Create ChatView component as main chat interface in frontend/src/components/chat/ChatView.tsx
- [x] T048 [US1] Integrate useChatStream hook in ChatView.tsx
- [x] T049 [US1] Render message list with ChatMessage components in ChatView.tsx
- [x] T050 [US1] Add loading indicator while response is generating in ChatView.tsx
- [x] T051 [US1] Handle and display AI service errors with retry option in ChatView.tsx

**Checkpoint**: User Story 1 complete - user can chat with AI, see streaming responses

---

## Phase 4: User Story 2 - Conversation History Management (Priority: P1)

**Goal**: User can see past conversations in sidebar and resume them

**Independent Test**: Have conversation, navigate away, return to Chat tab, see conversation in sidebar, click to resume

### Integration Tests (Before Implementation)

- [x] T017-IT Write integration test for GraphQL conversations query returns sorted list in backend/tests/integration/chat-queries.test.ts (covered in chat-stream.test.ts)
- [x] T018-IT Write integration test for GraphQL conversation(id) returns messages in order in backend/tests/integration/chat-queries.test.ts (covered in chat-stream.test.ts)
- [x] T019-IT [P] Write component test for ChatSidebar rendering conversation list in frontend/src/components/chat/__tests__/ChatSidebar.test.tsx

### Frontend Implementation for User Story 2

- [x] T052 [P] [US2] Create useConversations hook using GraphQL conversations query in frontend/src/hooks/useConversations.ts
- [x] T053 [P] [US2] Create useConversation hook for single conversation with messages in frontend/src/hooks/useConversation.ts
- [x] T054 [P] [US2] Create ChatSidebar component for conversation list in frontend/src/components/chat/ChatSidebar.tsx
- [x] T055 [US2] Display conversations sorted by most recent (updatedAt DESC) in ChatSidebar.tsx
- [x] T056 [US2] Show preview text (first user message truncated) for each conversation in ChatSidebar.tsx
- [x] T057 [US2] Show timestamp of last interaction for each conversation in ChatSidebar.tsx
- [x] T058 [US2] Add click handler to select conversation in ChatSidebar.tsx
- [x] T059 [US2] Highlight currently selected conversation in ChatSidebar.tsx
- [x] T060 [US2] Update ChatView to accept conversationId prop in ChatView.tsx
- [x] T061 [US2] Load existing messages when conversationId changes in ChatView.tsx
- [x] T062 [US2] Pass conversationId to useChatStream for context-aware responses in ChatView.tsx
- [x] T063 [US2] Refetch conversation list after new message sent in ChatSidebar or parent (using Apollo pollInterval)
- [x] T064 [US2] Add virtualized scrollable list (react-window) for sidebar to handle 50+ conversations efficiently in ChatSidebar.tsx

**Checkpoint**: User Story 2 complete - sidebar shows history, can resume conversations

---

## Phase 5: User Story 3 - Delete Conversations (Priority: P2)

**Goal**: User can delete individual conversations from history

**Independent Test**: Create conversation, find delete button, click delete, verify removed from sidebar and persists after refresh

### Integration Tests (Before Implementation)

- [x] T020-IT Write integration test for GraphQL deleteConversation mutation cascades messages in backend/tests/integration/chat-mutations.test.ts

### Frontend Implementation for User Story 3

- [x] T065 [P] [US3] Add DELETE_CONVERSATION mutation to frontend/src/graphql/chat.ts
- [x] T066 [US3] Add delete button/icon to each conversation item in ChatSidebar.tsx
- [x] T067 [US3] Implement deleteConversation handler calling GraphQL mutation in ChatSidebar.tsx
- [x] T068 [US3] Optimistically remove deleted conversation from UI in ChatSidebar.tsx (using refetchQueries)
- [x] T069 [US3] If currently viewing deleted conversation, clear chat area in ChatView.tsx
- [x] T070 [US3] Show error toast if deletion fails in ChatSidebar.tsx (onError callback with toast.error)

**Checkpoint**: User Story 3 complete - can delete conversations

---

## Phase 6: User Story 4 - Navigation to Chat Tab (Priority: P2)

**Goal**: User can switch between Search and Chat tabs in Discover section

**Independent Test**: Navigate to Discover, see Search/Chat tabs styled like Library tabs, switch between them

### Component Tests (Before Implementation)

- [x] T021-CT [P] Write component test for DiscoverNav tab rendering and active state in frontend/src/components/chat/__tests__/DiscoverNav.test.tsx

### Frontend Implementation for User Story 4

- [x] T071 [P] [US4] Create DiscoverNav component with Search/Chat tabs in frontend/src/components/chat/DiscoverNav.tsx
- [x] T072 [US4] Style tabs consistently with LibraryNav (library-nav CSS class pattern) in DiscoverNav.tsx
- [x] T073 [US4] Use React Router NavLink with active state styling in DiscoverNav.tsx
- [x] T074 [US4] Update DiscoverPage to include DiscoverNav component in frontend/src/pages/DiscoverPage.tsx
- [x] T075 [US4] Add route for /discover/chat in DiscoverPage.tsx
- [x] T076 [US4] Add route for /discover/search (existing semantic search) in DiscoverPage.tsx
- [x] T077 [US4] Set default route to /discover/search for backwards compatibility in DiscoverPage.tsx
- [x] T078 [US4] Create ChatPage wrapper component integrating ChatSidebar and ChatView in frontend/src/pages/ChatPage.tsx (implemented as ChatPage in components/chat/)
- [x] T079 [US4] Preserve chat state when switching between Search and Chat tabs

**Checkpoint**: User Story 4 complete - navigation works, tabs styled correctly

---

## Phase 7: User Story 5 - Interrupt In-Progress Response (Priority: P2)

**Goal**: User can stop AI response generation mid-stream

**Independent Test**: Send message generating long response, click stop button, verify generation stops and partial response preserved

### Integration Tests (Before Implementation)

- [x] T022-IT Write integration test for client disconnect saving partial response in backend/tests/integration/chat-stream.test.ts

### Backend Implementation for User Story 5

- [x] T080 [US5] Handle client disconnect via req.on('close') in chatRoutes.ts (lines 59-65)
- [x] T081 [US5] Abort LLM stream via AbortController when client disconnects in chatRoutes.ts (line 64)
- [x] T082 [US5] Save partial assistant message content on interrupt in chatStreamService.ts (lines 239-279)

### Frontend Implementation for User Story 5

- [x] T083 [P] [US5] Add stop button to ChatInput visible during streaming in ChatInput.tsx (lines 97-106)
- [x] T084 [US5] Wire stop button to AbortController.abort() in useChatStream.ts (lines 260-266)
- [x] T085 [US5] Update streaming state to false on abort in useChatStream.ts (line 264)
- [x] T086 [US5] Preserve partial response in message list after abort in ChatView.tsx (messages remain in state)
- [x] T087 [US5] Re-enable input after interrupt completes in ChatInput.tsx (streaming state controls disabled prop)

**Checkpoint**: User Story 5 complete - can interrupt responses

---

## Phase 8: User Story 6 - Navigation Warning During Response (Priority: P3)

**Goal**: Warn user before navigating away during active response

**Independent Test**: Start chat request, try to navigate away, see warning dialog

### Component Tests (Before Implementation)

- [x] T023-CT Write component test for ChatPage blocking navigation during streaming in frontend/src/components/chat/__tests__/ChatPage.test.tsx

### Frontend Implementation for User Story 6

- [x] T088 [US6] Add beforeunload event listener when streaming active in ChatView.tsx (lines 127-140)
- [x] T089 [US6] Implement internal navigation warning via StreamingContext and LeaveConfirmDialog in DiscoverNav.tsx, ChatSidebar.tsx
- [x] T090 [US6] Show confirmation dialog with stay/leave options in LeaveConfirmDialog.tsx
- [x] T091 [US6] Remove warning when streaming stops in ChatView.tsx (beforeunload listener removed in cleanup)

**Checkpoint**: User Story 6 complete - browser navigation warning (beforeunload), internal navigation warning (StreamingContext + LeaveConfirmDialog)

---

## Phase 9: User Story 7 - Start New Conversation (Priority: P3)

**Goal**: User can start a new conversation without deleting existing ones

**Independent Test**: While viewing existing conversation, click "New Chat" button, verify new conversation created

### Integration Tests (Before Implementation)

- [x] T024-IT Write integration test for GraphQL createConversation mutation in backend/tests/integration/chat-mutations.test.ts

### Frontend Implementation for User Story 7

- [x] T092 [P] [US7] Add CREATE_CONVERSATION mutation to frontend/src/graphql/chat.ts (lines 208-232)
- [x] T093 [US7] Add "New Chat" button to ChatSidebar header in ChatSidebar.tsx (lines 95-101)
- [x] T094 [US7] Implement newConversation handler calling GraphQL mutation in ChatSidebar.tsx (line 87-89, clears selection for auto-create flow)
- [x] T095 [US7] Clear current conversation selection and chat area on new chat in ChatPage.tsx (handled via onSelect(null))
- [x] T096 [US7] Auto-create conversation on first message if none selected (alternative flow) in useChatStream.ts (backend creates conversation automatically)

**Checkpoint**: User Story 7 complete - can start new conversations

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, edge cases, and cleanup

- [x] T097 Add error boundary for chat components in frontend/src/components/chat/ChatErrorBoundary.tsx (implemented and exported)
- [x] T098 Add user-facing validation error message for empty/whitespace messages in ChatInput.tsx (send button disabled when empty - lines 37, 111)
- [x] T099 Handle AI service unavailable error (FR-024) with retry in ChatView.tsx (lines 159-178 show retry button)
- [x] T100 Handle database persistence failure (FR-025) with retry in chatRoutes.ts (lines 87-102 send error event with retryable: true)
- [x] T101 Add loading skeleton while conversation list loads in ChatSidebar.tsx (lines 105-110)
- [x] T102 Add loading skeleton while conversation history loads in ChatView.tsx (lines 99-108)
- [x] T103 Block delete during active streaming for that conversation in ChatSidebar.tsx (line 81, 158)
- [x] T104 Ensure Langfuse flush on response complete and error in chatRoutes.ts (handled in chatStreamService.ts via langfuseSpan.end())
- [x] T105 Add CSS styles for chat components matching app design system (CSS files exist for each component)
- [x] T106 Run type-check and fix any TypeScript errors: npm run type-check (passed)
- [x] T107 Verify quickstart.md scenarios work end-to-end (GraphQL queries, SSE endpoint, tests pass)

### Accessibility

- [x] T108 [A11y] Add aria-labels to ChatInput send/stop buttons in ChatInput.tsx (lines 94, 102, 113)
- [x] T109 [A11y] Add keyboard navigation (Enter to send, Escape to cancel) in ChatInput.tsx (lines 54-69)
- [x] T110 [A11y] Manage focus on new message arrival (announce to screen readers) in ChatView.tsx (aria-live region with polite announcements)
- [x] T111 [A11y] Add role="list" and role="listitem" to conversation sidebar in ChatSidebar.tsx (lines 104, 140)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (entities, migration) - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 - Core chat functionality
- **User Story 2 (Phase 4)**: Depends on Phase 2 - Can run parallel with US1 if separate developers
- **User Story 3 (Phase 5)**: Depends on Phase 4 (needs sidebar)
- **User Story 4 (Phase 6)**: Depends on Phase 2 - Can run parallel with US1/US2
- **User Story 5 (Phase 7)**: Depends on Phase 3 (needs streaming)
- **User Story 6 (Phase 8)**: Depends on Phase 3 (needs streaming state)
- **User Story 7 (Phase 9)**: Depends on Phase 4 (needs sidebar)
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|------------|-------------------|
| US1 (Chat) | Foundational | US2, US4 |
| US2 (History) | Foundational | US1, US4 |
| US3 (Delete) | US2 | US5, US6, US7 |
| US4 (Navigation) | Foundational | US1, US2 |
| US5 (Interrupt) | US1 | US6, US7 |
| US6 (Warning) | US1 | US5, US7 |
| US7 (New Chat) | US2 | US5, US6 |

### Within Each User Story

- Backend before frontend (where applicable)
- Models/entities before services
- Services before resolvers/routes
- Core implementation before error handling

---

## Parallel Opportunities

### Phase 1 (Setup)
```
Parallel: T001, T002, T003 (all independent entity/schema files)
```

### Phase 2 (Foundational)
```
Parallel: T009, T010, T011, T012, T013 (independent service methods)
Parallel: T016, T017, T018, T019 (independent resolvers)
```

### Phase 3 (User Story 1)
```
Parallel: T037, T038 (GraphQL queries, SSE hook)
Parallel: T042, T044, T047 (independent components)
```

### Phase 4 (User Story 2)
```
Parallel: T052, T053, T054 (hooks and component)
```

### Multiple User Stories in Parallel
```
With 2+ developers after Phase 2:
  Developer A: US1 (T024-T051) + US5 (T080-T087)
  Developer B: US2 (T052-T064) + US4 (T071-T079)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (entities, migration)
2. Complete Phase 2: Foundational (service, resolvers)
3. Complete Phase 3: User Story 1 (streaming chat)
4. Complete Phase 4: User Story 2 (conversation history)
5. **STOP and VALIDATE**: Chat works with persistence
6. Deploy/demo MVP

### Incremental Delivery

| Increment | Stories | Value Delivered |
|-----------|---------|-----------------|
| MVP | US1 + US2 | Chat with AI, conversation history |
| Increment 2 | US4 | Tab navigation in Discover |
| Increment 3 | US3 + US7 | Conversation management |
| Increment 4 | US5 + US6 | Response control and safety |

---

## Summary

| Category | Count |
|----------|-------|
| Total Tasks | 131 |
| Setup Tasks (incl. 4 contract tests) | 11 |
| Foundational Tasks (incl. 5 contract tests) | 21 |
| US1 Tasks (incl. 7 tests) | 35 |
| US2 Tasks (incl. 3 tests) | 16 |
| US3 Tasks (incl. 1 test) | 7 |
| US4 Tasks (incl. 1 test) | 10 |
| US5 Tasks (incl. 1 test) | 9 |
| US6 Tasks (incl. 1 test) | 5 |
| US7 Tasks (incl. 1 test) | 6 |
| Polish Tasks (incl. 4 A11y tasks) | 15 |
| Parallel Opportunities | 30+ tasks |

**MVP Scope**: User Stories 1 + 2 (52 tasks after Setup/Foundational, including 10 tests)
