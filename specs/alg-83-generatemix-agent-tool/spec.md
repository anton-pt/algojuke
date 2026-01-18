# Feature Specification: ALG-83 generateMix Agent Tool

**Feature Branch**: `alg-83-generatemix-agent-tool`
**Created**: 2025-01-18
**Status**: Draft

## Summary

Create `generateMix` agent tool in backend to trigger background mix generation from chat. The tool creates a Mix entity with "generating" status, sends an Inngest event with userId, and returns the mixId for the chat UI to track progress. The DJ agent in worker service processes the event asynchronously.

## Clarifications

- **Music input**: Tool accepts natural language music instructions for the DJ agent (not just musicQuery). Instructions can outline a narrative arc fitting articles or user mood.

## User Scenarios & Testing

### US-01: Generate mix with articles and music instructions (Priority: P1)

As a user chatting with the Discover agent, I want to request a radio mix with my selected articles and music preferences, so that the DJ agent can generate a personalized mix in the background.

**Why P1**: Core functionality - the primary use case for triggering mix generation from chat.

**Acceptance Scenarios**:

1. **Given** a user requests a mix with title "Evening Wind-Down", 2 articles, and music instructions "calm piano transitions building to ambient", **When** generateMix is called, **Then** a Mix entity is created with status "generating" and the Inngest event is sent with all inputs
2. **Given** a user requests a mix without description, **When** generateMix is called, **Then** description defaults to null and mix is created successfully
3. **Given** a user requests a mix, **When** the tool completes, **Then** it returns `{ mixId, status: "generating" }` with a human-readable summary

---

### US-02: Validate article array input (Priority: P1)

As the system, I want to validate the articles array, so that malformed input is rejected with clear error messages.

**Why P1**: Data integrity - invalid input would cause downstream failures in DJ agent.

**Acceptance Scenarios**:

1. **Given** an articles array with valid documentIds and contentModes, **When** input is validated, **Then** validation passes
2. **Given** an empty articles array, **When** input is validated, **Then** validation fails with "At least one article is required"
3. **Given** an article with invalid contentMode (not "summary" | "excerpt" | "full"), **When** input is validated, **Then** validation fails with "Invalid contentMode"
4. **Given** more than 10 articles, **When** input is validated, **Then** validation fails with "Maximum 10 articles per mix"

---

### US-03: Inngest event delivery (Priority: P1)

As the worker service, I want to receive the mix generation event with all required context, so that the DJ agent can process the mix independently.

**Why P1**: Cross-service communication - worker depends on complete event payload.

**Acceptance Scenarios**:

1. **Given** generateMix creates a mix successfully, **When** the Inngest event is sent, **Then** the event contains mixId, userId, title, articles array, and musicInstructions
2. **Given** the Inngest client fails to send, **When** an error occurs, **Then** the tool throws a retryable error (but Mix entity is still created)
3. **Given** the event is sent, **When** the DJ agent receives it, **Then** it can access the Mix via the returned mixId

---

### US-04: Link mix to conversation (Priority: P2)

As a user returning to the Radio screen, I want the mix to be linked to the conversation that created it, so that I have context about how the mix was generated.

**Why P2**: UX enhancement - useful but not blocking core functionality.

**Acceptance Scenarios**:

1. **Given** generateMix is called from a chat with conversationId, **When** the Mix is created, **Then** conversationId is stored in the Mix entity
2. **Given** conversationId is not provided (e.g., future API usage), **When** the Mix is created, **Then** conversationId is null and mix still works

---

## Edge Cases

1. **Inngest send fails after Mix creation**: Mix exists in "generating" status but event not sent. Requires manual intervention or retry mechanism.
2. **Duplicate mix requests**: No idempotency at tool level (but Inngest function may have it). User could create multiple mixes with same content.
3. **Very long musicInstructions**: Limit to 2000 characters to prevent abuse.
4. **Empty musicInstructions**: Allow empty/null - DJ agent can use article themes as fallback.

## Functional Requirements

- **FR-001**: Tool input schema includes: title (required), description (optional), articles array (1-10 items with documentId and contentMode), musicInstructions (optional, max 2000 chars)
- **FR-002**: Tool creates Mix entity via MixService.createMix() before sending Inngest event
- **FR-003**: Tool sends `mix/generation.requested` Inngest event with: mixId, userId, title, description, articles, musicInstructions
- **FR-004**: Tool returns GenerateMixOutput with mixId, status, and summary
- **FR-005**: Worker service defines event schemas: `mix/generation.requested`, `mix/generation.completed`, `mix/generation.failed`

## Dependencies

- **@specs/alg-77-expose-agent-tools-via-graphql-api**: Service API key auth for cross-service invocation
- **@specs/alg-78-mix-entity-and-service**: Mix entity and MixService CRUD operations

## Out of Scope

- DJ agent implementation (separate ticket)
- Mix generation logic (separate ticket)
- Frontend integration (separate ticket)
- ElevenLabs TTS calls (handled by DJ agent)
- Retry of failed Inngest sends (future enhancement)

## Files to Create/Modify

| File                                                        | Action | Purpose                           |
| ----------------------------------------------------------- | ------ | --------------------------------- |
| `backend/src/services/agentTools/generateMixTool.ts`        | Create | Tool implementation               |
| `backend/src/schemas/agentTools.ts`                         | Modify | Add GenerateMixInputSchema        |
| `backend/src/types/agentTools.ts`                           | Modify | Add GenerateMixOutput type        |
| `backend/src/services/agentTools/index.ts`                  | Modify | Export new tool                   |
| `services/worker/src/inngest/events.ts`                     | Modify | Add mix event schemas             |
| `backend/src/clients/inngestClient.ts`                      | Modify | Add sendMixGenerationEvent helper |
| `backend/tests/contract/agentTools/generateMixTool.test.ts` | Create | Unit tests                        |

## Verification

1. **Unit tests**: Run `npm test -- tests/contract/agentTools/generateMixTool.test.ts` in backend
2. **Schema validation**: Verify Zod schemas reject invalid input with correct error messages
3. **Inngest event**: Start Inngest dev server, trigger tool, verify event appears in dashboard (http://localhost:8288)
