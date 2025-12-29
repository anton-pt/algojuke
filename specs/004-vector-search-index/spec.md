# Feature Specification: Vector Search Index Infrastructure

**Feature Branch**: `004-vector-search-index`
**Created**: 2025-12-29
**Status**: Draft
**Input**: User description: "An index for ingested tracks supporting vector and BM25 keyword search of songs, lyrics, and natural language summaries / interpretations of those lyrics. Each song in the index should include: title, artist, album, ISRC (unique track identifier), lyrics (text), interpretation (LLM-generated based on the lyrics), interpretation_embedding (generated from the interpretation with a state of the art embedding model). Additionally the following properties will be obtained from the reccobeats.com API where available based on the track's ISRC: acousticness, danceability, energy, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, valence. NOTE: this feature only implements the underlying infrastructure for storing data in the vector database along with the index definition, and not the ingestion pipeline, which will be implemented in a follow-up feature."

## Clarifications

### Session 2025-12-29

- Q: What level of observability should the index infrastructure provide? → A: Minimal - Only error logs when operations fail (comprehensive observability will be implemented with the ingestion pipeline using LLM tracing platform like Langfuse)
- Q: What are the data durability and backup expectations for the track index? → A: No explicit requirements - Rely on vector database default durability with Docker volume persistence (local prototype, no production deployment planned)
- Q: What concurrent access patterns must the index support? → A: Read-write concurrency - Multiple reads can happen during writes; writes are serialized (application may read track metadata while new tracks are being ingested in background)
- Q: What resource constraints should the vector database infrastructure operate within? → A: Moderate limits - Docker container limited to 4GB RAM, 2 CPU cores; suitable for typical developer laptop
- Q: How should the index handle schema changes as requirements evolve? → A: Additive changes only - New optional fields can be added without re-indexing; breaking changes require full re-indexing

## User Scenarios & Testing

### User Story 1 - Index Creation and Readiness (Priority: P1)

As a system administrator, I need to set up the vector search index infrastructure so that when the ingestion pipeline is implemented, it can immediately begin storing track data.

**Why this priority**: This is the foundational infrastructure that all other search capabilities depend on. Without the index structure, no data can be stored or searched.

**Independent Test**: Can be fully tested by verifying the index schema exists, is properly configured with vector and BM25 capabilities, and can accept test documents with all required fields.

**Acceptance Scenarios**:

1. **Given** the vector database system is running, **When** the index initialization runs, **Then** a new index is created with all required field definitions
2. **Given** the index has been created, **When** querying the index schema, **Then** all mandatory fields (title, artist, album, ISRC, lyrics, interpretation, interpretation_embedding) are present
3. **Given** the index has been created, **When** querying the index configuration, **Then** vector search is enabled for interpretation_embedding field
4. **Given** the index has been created, **When** querying the index configuration, **Then** BM25 text search is enabled for lyrics, title, artist, and interpretation fields
5. **Given** the index has been created, **When** a test document with all required fields is inserted, **Then** the document is successfully stored

---

### User Story 2 - Audio Feature Storage Support (Priority: P2)

As a system administrator, I need the index to support storing audio analysis metadata from the reccobeats.com API so that future search features can filter and rank tracks by musical characteristics.

**Why this priority**: While not required for basic search, these audio features enable advanced filtering and similarity matching. This is essential for music discovery features but can be implemented after basic index structure.

**Independent Test**: Can be tested by inserting test documents with audio feature fields (acousticness, danceability, etc.) and verifying all fields are stored and retrievable.

**Acceptance Scenarios**:

1. **Given** the index exists, **When** a document with all audio feature fields is inserted, **Then** all 11 audio features (acousticness, danceability, energy, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, valence) are stored
2. **Given** documents with partial audio feature data are inserted, **When** querying those documents, **Then** only populated fields are returned without errors
3. **Given** documents are stored with audio features, **When** querying by ISRC, **Then** all associated audio features are returned with correct data types (floats for metrics, integers for key/mode)

---

### User Story 3 - Hybrid Search Configuration (Priority: P1)

As a developer implementing search features, I need the index to support both vector similarity and keyword matching so that users can find tracks through semantic meaning or specific lyrics.

**Why this priority**: This is core to the feature's value proposition - supporting both semantic (vector) and keyword (BM25) search. Both search modes must be available from day one.

**Independent Test**: Can be tested by inserting sample documents and executing test queries using both vector similarity search and BM25 keyword search, verifying both return expected results.

**Acceptance Scenarios**:

1. **Given** test documents are indexed, **When** a vector similarity search is executed against interpretation_embedding, **Then** results are returned ranked by cosine similarity
2. **Given** test documents are indexed, **When** a BM25 keyword search is executed against lyrics field, **Then** results are returned ranked by relevance score
3. **Given** test documents are indexed, **When** a BM25 keyword search is executed against multiple fields (lyrics, title, artist, interpretation), **Then** all matching documents are found regardless of which field matched

---

### Edge Cases

- What happens when a track has no lyrics (instrumental track)? Index should accept null/empty lyrics field
- What happens when reccobeats.com API returns partial or missing audio features? Index should accept documents with missing optional audio feature fields
- What happens when the same ISRC is indexed multiple times? Index should enforce ISRC uniqueness and update existing documents
- How does the system handle malformed embedding vectors? Index should validate vector dimensions match expected size
- What happens when searching before any documents are indexed? Search returns empty results without errors
- How does the system handle special characters in lyrics (multilingual text, emojis, symbols)? Index should support UTF-8 encoding for all text fields
- What happens when a search query runs while a document is being inserted? Search results may or may not include the in-progress document depending on transaction isolation; completed documents are always searchable
- What happens when multiple write operations attempt to update the same ISRC simultaneously? Writes are serialized; last write wins with proper ISRC uniqueness enforcement
- What happens when a new optional field is added to the schema? Existing documents without the field remain valid; new documents can include the field; queries handle missing field gracefully
- What happens when a breaking schema change is needed (e.g., changing vector dimensions)? System requires explicit re-indexing operation; old index remains operational until migration completes

## Requirements

### Functional Requirements

- **FR-001**: System MUST define an index schema supporting all core track metadata fields (title, artist, album, ISRC, lyrics, interpretation, interpretation_embedding)
- **FR-002**: System MUST configure the ISRC field as a unique identifier to prevent duplicate track entries
- **FR-003**: System MUST configure interpretation_embedding field for vector similarity search with 4096 dimensions
- **FR-004**: System MUST configure BM25 full-text search on lyrics, title, artist, and interpretation fields
- **FR-005**: System MUST define schema fields for all 11 audio features from reccobeats.com API (acousticness, danceability, energy, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, valence)
- **FR-006**: System MUST define appropriate data types for all fields (text for strings, float for decimal metrics, integer for categorical values, vector for embeddings)
- **FR-007**: System MUST mark audio feature fields as optional to handle cases where reccobeats.com data is unavailable
- **FR-008**: System MUST mark lyrics field as optional to support instrumental tracks
- **FR-009**: System MUST provide index initialization capability to create the index structure
- **FR-010**: System MUST validate that inserted documents conform to the schema (correct data types, required fields present)
- **FR-011**: System MUST support updating existing documents by ISRC if the same track is re-indexed
- **FR-012**: System MUST support retrieving documents by ISRC for lookup operations
- **FR-013**: System MUST log errors when index operations fail (initialization failures, schema validation errors, document insertion/update failures, malformed data)
- **FR-014**: System MUST support concurrent read operations (search, retrieval) while write operations (insert, update) are in progress
- **FR-015**: System MUST serialize write operations to maintain data consistency when multiple writes occur
- **FR-016**: System MUST support adding new optional fields to the schema without requiring re-indexing of existing documents
- **FR-017**: System MUST require full re-indexing when breaking schema changes occur (modifying existing field types, changing required fields, altering vector dimensions)

### Key Entities

- **Track Document**: Represents a single music track in the search index
  - Core metadata: title, artist, album, ISRC (unique identifier)
  - Search content: lyrics (full text), interpretation (AI-generated summary), interpretation_embedding (vector representation)
  - Audio features: acousticness, danceability, energy, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, valence (all optional)
  - Relationships: ISRC links to external music databases and APIs

- **Search Index**: The container for all track documents
  - Supports hybrid search: vector similarity (on interpretation_embedding) and BM25 keyword search (on text fields)
  - Enforces ISRC uniqueness constraint
  - Maintains inverted indices for text search and vector indices for similarity search

## Success Criteria

### Measurable Outcomes

- **SC-001**: Index successfully stores 10,000 test track documents without errors
- **SC-002**: Vector similarity searches return results in under 500ms for a corpus of 10,000 documents
- **SC-003**: BM25 keyword searches return results in under 200ms for a corpus of 10,000 documents
- **SC-004**: 100% of documents with valid data types are successfully indexed on first attempt
- **SC-005**: Documents with missing optional fields (lyrics, audio features) are successfully stored without errors
- **SC-006**: ISRC uniqueness is enforced - attempting to insert duplicate ISRCs results in update rather than duplicate entry
- **SC-007**: System operates within 4GB RAM and 2 CPU core limits enforced via Docker container resource constraints

## Assumptions

- Vector embedding model: Qwen3-Embedding-8B producing 4096-dimensional vectors (https://huggingface.co/Qwen/Qwen3-Embedding-8B)
- Vector database system selection will be made during planning phase (candidates: Elasticsearch with vector support, Weaviate, Qdrant, Milvus, PostgreSQL with pgvector)
- Vector database will run in Docker container with attached volume for data persistence
- Docker container resource limits: 4GB RAM, 2 CPU cores (typical developer laptop environment)
- Deployment is local-only prototype with no production or internet-facing deployment planned
- Data durability relies on vector database default settings and Docker volume persistence (no explicit backup/recovery requirements)
- Concurrency control (read-write isolation, write serialization) will be handled by the vector database's native transaction mechanisms
- Schema evolution follows additive-only pattern: new optional fields can be added; breaking changes require full re-indexing
- BM25 ranking uses Qdrant's sparse vector IDF modifier (explicitly enabled) with default word tokenizer and case-insensitive matching (verified suitable for song lyrics and music metadata per Qdrant documentation)
- Load testing beyond 10k document corpus is deferred to future performance optimization work
- Text fields will use UTF-8 encoding to support international lyrics
- ISRC format follows ISO 3901 standard (12 alphanumeric characters)
- Audio feature ranges match Spotify/reccobeats.com API specifications (floats 0.0-1.0 for most metrics, -60 to 0 dB for loudness, 0-250 for tempo, -1 to 11 for key, 0 or 1 for mode)
- Ingestion pipeline implementation is explicitly out of scope for this feature
- Initial deployment will handle corpus size up to 100,000 tracks (can be validated through load testing during implementation)

## Dependencies

- Availability of a vector database system or database with vector search capabilities
- Access to reccobeats.com API for audio features (for future ingestion, not required for infrastructure setup)
- Embedding model selection for determining vector dimensions (affects index schema)

## Scope Boundaries

### In Scope

- Index schema definition with all required fields
- Vector search configuration for interpretation_embedding field
- BM25 text search configuration for text fields
- ISRC uniqueness constraint
- Data type validation for all fields
- Index initialization scripts/code
- Support for optional fields (lyrics, audio features)
- Document update capability by ISRC

### Out of Scope

- Track ingestion pipeline (future feature)
- LLM integration for generating interpretations (future feature)
- Embedding model selection and configuration (future feature)
- reccobeats.com API integration (future feature)
- Search query API or user interface
- Search ranking algorithms beyond default BM25 and vector similarity
- Data migration from existing track databases
- Automated schema migration tools for breaking changes (manual re-indexing required)
- Backup and disaster recovery procedures (relying on Docker volume persistence for local prototype)
- Comprehensive observability (metrics, tracing, performance monitoring - will be implemented with ingestion pipeline)
- Index health monitoring and performance tuning (to be addressed operationally)
- Production deployment or internet-facing deployment
