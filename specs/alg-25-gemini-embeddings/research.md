# Research: Switch to Gemini Embedding Model in Production

## Executive Summary

This feature introduces a provider abstraction for embedding generation, allowing production to use Google's `gemini-embedding-001` (3072 dimensions) via the `@google/genai` SDK while development continues using the local TEI service with `mxbai-embed-large-v1` (1024 dimensions). The implementation follows the existing TEI client pattern with a factory function that returns the appropriate provider based on the `EMBEDDING_PROVIDER` environment variable.

## Key Decisions

### D1: SDK Choice for Gemini Integration

**Decision**: Use `@google/genai` SDK (not `@google-cloud/vertexai`)

**Rationale**:

- The older `@google-cloud/vertexai` SDK is deprecated and won't receive Gemini 2.0+ features
- `@google/genai` supports both Gemini API and Vertex AI with the same interface
- Simpler API: `ai.models.embedContent()` vs complex vertex AI client setup
- Better TypeScript support

**Alternatives Considered**:

- `@google-cloud/vertexai`: Rejected - deprecated, no new features
- Direct REST API calls: Rejected - SDK handles auth, retries, types

### D2: Provider Abstraction Architecture

**Decision**: Create a unified `EmbeddingClient` interface with factory function

**Rationale**:

- Follows existing `TEIClient` pattern established in codebase
- Single interface allows seamless swapping between providers
- Factory pattern (`createEmbeddingClient()`) keeps instantiation logic centralized
- Both backend and worker services can share the same abstraction

**Pattern**:

```typescript
// services/worker/src/clients/embedding.ts (and similar in backend)
export interface EmbeddingClient {
  embed(text: string, taskType?: EmbeddingTaskType): Promise<number[]>;
  getDimensions(): number;
  isHealthy(): Promise<boolean>;
}

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export function createEmbeddingClient(): EmbeddingClient {
  const provider = process.env.EMBEDDING_PROVIDER || "local";

  if (provider === "gemini") {
    return createGeminiEmbeddingClient();
  }
  return createTEIEmbeddingClient();
}
```

### D3: Task Type Handling

**Decision**: Use Gemini's `task_type` parameter for asymmetric search optimization

**Rationale**:

- Gemini supports task types that optimize embeddings for their intended use
- `RETRIEVAL_DOCUMENT` for track interpretations (indexed content)
- `RETRIEVAL_QUERY` for search queries (user input)
- This matches the asymmetric search pattern already used with TEI's `embedWithInstruct()`

**Mapping**:
| Use Case | TEI Method | Gemini Task Type |
|----------|-----------|------------------|
| Track interpretation | `embed(text)` | `RETRIEVAL_DOCUMENT` |
| Search query | `embedWithInstruct(query, instruction)` | `RETRIEVAL_QUERY` |

### D4: Dimension Configuration

**Decision**: Use `EMBEDDING_DIMENSIONS` environment variable with provider-specific defaults

**Rationale**:

- Dimensions are provider-dependent (1024 for local, 3072 for Gemini)
- Qdrant collection must be created with matching dimensions
- Environment variable allows override if needed
- Default should match provider to prevent misconfiguration

**Pattern**:

```typescript
export function getEmbeddingDimensions(): number {
  const explicit = process.env.EMBEDDING_DIMENSIONS;
  if (explicit) return parseInt(explicit, 10);

  const provider = process.env.EMBEDDING_PROVIDER || "local";
  return provider === "gemini" ? 3072 : 1024;
}
```

### D5: Zero Vector Generation

**Decision**: Zero vector dimensions must match current provider configuration

**Rationale**:

- Instrumental tracks without lyrics need a zero vector placeholder
- Vector dimensions must match collection schema
- Existing `createZeroVector()` hardcodes 1024

**Change**:

```typescript
export function createZeroVector(): number[] {
  const dimensions = getEmbeddingDimensions();
  return new Array(dimensions).fill(0);
}
```

## Implementation Patterns

### Gemini Embedding Client

```typescript
// services/worker/src/clients/geminiEmbedding.ts
import { GoogleGenAI } from "@google/genai";

const GEMINI_DIMENSIONS = 3072;

export function createGeminiEmbeddingClient(): EmbeddingClient {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_REGION || "europe-west4",
  });

  return {
    async embed(
      text: string,
      taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
    ): Promise<number[]> {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
        config: {
          taskType,
        },
      });

      const embedding = response.embeddings?.[0]?.values;
      if (!embedding || embedding.length !== GEMINI_DIMENSIONS) {
        throw new Error(
          `Invalid embedding dimensions: expected ${GEMINI_DIMENSIONS}, got ${embedding?.length}`,
        );
      }
      return embedding;
    },

    getDimensions(): number {
      return GEMINI_DIMENSIONS;
    },

    async isHealthy(): Promise<boolean> {
      try {
        await ai.models.embedContent({
          model: "gemini-embedding-001",
          contents: "health check",
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}
```

### Updated TEI Client Wrapper

```typescript
// services/worker/src/clients/localEmbedding.ts
import { createTEIClient } from "./tei.js";

const LOCAL_DIMENSIONS = 1024;

export function createTEIEmbeddingClient(): EmbeddingClient {
  const tei = createTEIClient();

  return {
    async embed(
      text: string,
      taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
    ): Promise<number[]> {
      if (taskType === "RETRIEVAL_QUERY") {
        // Use instruction prefix for query embedding (asymmetric search)
        return tei.embedWithInstruct(
          text,
          "Instruct: Find music tracks matching this description\nQuery:",
        );
      }
      return tei.embed(text);
    },

    getDimensions(): number {
      return LOCAL_DIMENSIONS;
    },

    async isHealthy(): Promise<boolean> {
      return tei.isHealthy();
    },
  };
}
```

### Qdrant Collection Schema Update

```typescript
// services/search-index/src/schema/trackCollection.ts
import { getEmbeddingDimensions } from "../config.js";

export function getVectorConfig() {
  return {
    interpretation_embedding: {
      size: getEmbeddingDimensions(),
      distance: "Cosine",
      on_disk: false,
      datatype: "float16",
    },
  };
}
```

## Files to Modify

| File                                                      | Changes                                  |
| --------------------------------------------------------- | ---------------------------------------- |
| `services/worker/src/clients/embedding.ts`                | New - Provider abstraction and factory   |
| `services/worker/src/clients/geminiEmbedding.ts`          | New - Gemini provider implementation     |
| `services/worker/src/clients/localEmbedding.ts`           | New - TEI wrapper implementing interface |
| `services/worker/src/clients/tei.ts`                      | Keep existing, used by localEmbedding.ts |
| `services/worker/src/inngest/functions/trackIngestion.ts` | Use `createEmbeddingClient()`            |
| `services/worker/src/config.ts`                           | Add `getEmbeddingDimensions()`           |
| `backend/src/clients/embedding.ts`                        | New - Same abstraction for backend       |
| `backend/src/clients/geminiEmbedding.ts`                  | New - Gemini provider for backend        |
| `backend/src/clients/localEmbedding.ts`                   | New - TEI wrapper for backend            |
| `backend/src/services/discoveryService.ts`                | Use `createEmbeddingClient()`            |
| `services/search-index/src/schema/trackCollection.ts`     | Parameterize vector dimensions           |
| `services/search-index/src/schema/trackDocument.ts`       | Fix validation to use config             |
| `services/search-index/src/scripts/testUtils.ts`          | Fix vector generation dimensions         |
| `deploy/cloudrun/worker.yaml`                             | Add Gemini env vars                      |
| `deploy/cloudrun/backend.yaml`                            | Add Gemini env vars                      |
| `package.json` (worker + backend)                         | Add `@google/genai` dependency           |

## Environment Variables

### Production (Cloud Run)

```yaml
# deploy/cloudrun/worker.yaml and backend.yaml
env:
  - name: EMBEDDING_PROVIDER
    value: gemini
  - name: EMBEDDING_DIMENSIONS
    value: "3072"
  - name: GOOGLE_CLOUD_PROJECT
    valueFrom:
      secretKeyRef:
        name: gcp-project-id
        key: latest
  - name: GOOGLE_CLOUD_REGION
    value: europe-west4
```

### Local Development

```bash
# .env or docker-compose.yml (defaults)
EMBEDDING_PROVIDER=local
# EMBEDDING_DIMENSIONS defaults to 1024 when provider is local
```

## Authentication

Gemini on Vertex AI uses Application Default Credentials (ADC). In Cloud Run:

- The service account attached to the Cloud Run service must have `roles/aiplatform.user`
- No explicit API key needed - ADC handles authentication automatically

For local testing with Gemini (optional):

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=algojuke-prod
export EMBEDDING_PROVIDER=gemini
```

## Existing Issues Found

During research, dimension mismatches were found in the codebase:

| File                                                      | Current           | Should Be              |
| --------------------------------------------------------- | ----------------- | ---------------------- |
| `services/search-index/src/schema/trackDocument.ts`       | 4096              | Configurable           |
| `services/search-index/src/scripts/testUtils.ts`          | 4096              | Configurable           |
| `services/worker/src/inngest/functions/trackIngestion.ts` | Comment says 4096 | 1024 (or configurable) |

These should be fixed as part of this feature to use the centralized dimension configuration.
