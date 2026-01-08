# Switch to Gemini Embedding Model in Production

**GitHub Issue**: [#43](https://github.com/anton-pt/algojuke/issues/43)

## Summary

Replace the current embedding model with Google's `gemini-embedding-001` (3072 dimensions) for production deployments, while retaining the local TEI-based model (`mxbai-embed-large-v1`, 1024 dimensions) for development. An environment variable controls which provider is used. The Qdrant collection uses the same name in both environments since local development uses a local Docker instance and production uses Qdrant Cloud.

## User Stories

### US-001: Production Embedding Generation (P1)

As a system administrator, I want track ingestion in production to use Google's Gemini embedding model so that I benefit from state-of-the-art embedding quality without running local infrastructure.

**Acceptance Scenarios:**

```gherkin
Given EMBEDDING_PROVIDER=gemini is set
When a track is ingested via the pipeline
Then the interpretation embedding is generated using gemini-embedding-001

Given EMBEDDING_PROVIDER=gemini is set
When an embedding is generated
Then the resulting vector has 3072 dimensions

Given the Gemini API returns an error
When processing a track
Then the error is logged and the step retries with exponential backoff
```

### US-002: Local Development Embedding Generation (P1)

As a developer, I want to continue using the local TEI-based embedding model during development so that I don't need Gemini API credentials or incur API costs for local testing.

**Acceptance Scenarios:**

```gherkin
Given EMBEDDING_PROVIDER=local (or unset)
When a track is ingested via the pipeline
Then the interpretation embedding is generated using the local TEI service

Given EMBEDDING_PROVIDER=local
When an embedding is generated
Then the resulting vector has 1024 dimensions
```

### US-003: Semantic Search with Environment-Appropriate Embeddings (P1)

As a user performing semantic discovery search, I want query embeddings to be generated using the same model as the indexed tracks so that search results are accurate.

**Acceptance Scenarios:**

```gherkin
Given EMBEDDING_PROVIDER=gemini in production
When I perform a semantic search
Then the query embedding uses gemini-embedding-001 with 3072 dimensions

Given EMBEDDING_PROVIDER=local in development
When I perform a semantic search
Then the query embedding uses the local TEI service with 1024 dimensions
```

### US-004: Vector Index Dimension Configuration (P2)

As a system administrator, I want the Qdrant collection schema to use the correct vector dimensions based on the environment so that embeddings can be stored and searched correctly.

**Acceptance Scenarios:**

```gherkin
Given EMBEDDING_DIMENSIONS=3072 (production)
When the tracks collection is initialized
Then the interpretation_embedding field accepts 3072-dimensional vectors

Given EMBEDDING_DIMENSIONS=1024 (local development)
When the tracks collection is initialized
Then the interpretation_embedding field accepts 1024-dimensional vectors

Given a vector with incorrect dimensions is inserted
When the upsert operation runs
Then Qdrant rejects the document with a dimension mismatch error
```

## Functional Requirements

### Embedding Provider Abstraction

- **FR-001**: System MUST support an `EMBEDDING_PROVIDER` environment variable with values `gemini` or `local`
- **FR-002**: System MUST default to `local` provider when `EMBEDDING_PROVIDER` is not set
- **FR-003**: System MUST provide an embedding service abstraction that returns vectors regardless of provider
- **FR-004**: System MUST validate that generated embeddings match the expected dimensions for the configured provider

### Gemini Embedding Integration

- **FR-005**: System MUST integrate with Google's `gemini-embedding-001` model via Vertex AI API
- **FR-006**: System MUST use `RETRIEVAL_DOCUMENT` task type for track interpretation embeddings
- **FR-007**: System MUST use `RETRIEVAL_QUERY` task type for semantic search query embeddings
- **FR-008**: System MUST use the full 3072 dimensions (no dimensionality reduction)
- **FR-009**: System MUST handle API rate limits with exponential backoff retry
- **FR-010**: System MUST log embedding generation to Langfuse observability

### Local TEI Embedding Integration

- **FR-011**: System MUST continue to support the existing TEI-based embedding service using `mxbai-embed-large-v1`
- **FR-012**: System MUST generate 1024-dimensional vectors when using local provider

### Vector Index Configuration

- **FR-013**: System MUST support an `EMBEDDING_DIMENSIONS` environment variable (default: 1024)
- **FR-014**: System MUST configure the Qdrant collection's `interpretation_embedding` field with the specified dimensions
- **FR-015**: System MUST use the same collection name (`tracks`) in both environments

### Track Ingestion Pipeline Updates

- **FR-016**: System MUST use the configured embedding provider for generating track interpretation embeddings
- **FR-017**: System MUST use a zero vector of the correct dimensions for tracks without lyrics

### Semantic Discovery Search Updates

- **FR-018**: System MUST use the configured embedding provider for generating search query embeddings
- **FR-019**: System MUST ensure query embeddings match the dimensions of indexed track embeddings

## Scope

### In Scope

- Embedding provider abstraction with environment-based switching
- Gemini embedding-001 integration via Vertex AI
- Track ingestion pipeline updates to use provider abstraction
- Semantic search updates to use provider abstraction
- Vector index dimension parameterization
- Zero vector dimension handling for instrumentals
- Langfuse observability for Gemini API calls

### Out of Scope

- Migration of existing indexed tracks (requires re-ingestion)
- Fallback from Gemini to local provider on error
- Batch embedding API optimization
- Cost monitoring or quota management for Gemini API
- Dimensionality reduction options

## Dependencies

- **specs/006-track-ingestion-pipeline**: Track ingestion uses embedding service
- **specs/009-semantic-discovery-search**: Discovery search uses embedding service
- **specs/004-vector-search-index**: Vector index schema needs dimension configuration
- **External: Google Vertex AI**: Gemini embedding model API access

## Environment Variables

| Variable               | Values            | Default       | Description                          |
| ---------------------- | ----------------- | ------------- | ------------------------------------ |
| `EMBEDDING_PROVIDER`   | `gemini`, `local` | `local`       | Which embedding provider to use      |
| `EMBEDDING_DIMENSIONS` | `1024`, `3072`    | `1024`        | Vector dimensions for Qdrant schema  |
| `GOOGLE_CLOUD_PROJECT` | string            | -             | GCP project ID (required for Gemini) |
| `GOOGLE_CLOUD_REGION`  | string            | `us-central1` | Vertex AI region                     |

## Clarifications

**Q: Should we use the full 3072 dimensions from gemini-embedding-001 in production, or use a reduced dimension?**
A: Use full 3072 dimensions for maximum quality.

**Q: How should the system determine which embedding provider to use?**
A: Environment variable (`EMBEDDING_PROVIDER=gemini|local`).

**Q: Should there be separate Qdrant collections for different embedding dimensions?**
A: No, use the same collection name (`tracks`) since local dev uses a local Qdrant instance and production uses Qdrant Cloud - they are separate deployments.
