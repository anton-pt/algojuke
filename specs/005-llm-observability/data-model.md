# Data Model: LLM Observability Infrastructure

**Feature**: 005-llm-observability
**Date**: 2025-12-29

## Overview

This feature is primarily infrastructure-focused. The data model is managed by Langfuse internally. This document describes the conceptual entities that application code will interact with through the Langfuse SDK.

## Langfuse Entities (SDK Interface)

### Trace

A logical grouping of related operations representing an end-to-end request flow.

| Attribute | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Unique trace identifier |
| name | string | Human-readable trace name |
| userId | string? | Optional user identifier for filtering |
| sessionId | string? | Optional session identifier for grouping |
| metadata | object? | Arbitrary key-value metadata |
| tags | string[]? | Searchable tags |
| input | any? | Trace-level input (optional override) |
| output | any? | Trace-level output (optional override) |

### Span

An individual operation within a trace.

| Attribute | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Unique span identifier |
| traceId | string (UUID) | Parent trace identifier |
| parentSpanId | string? | Parent span ID for nesting |
| name | string | Operation name |
| startTime | timestamp | When operation started |
| endTime | timestamp | When operation ended |
| input | any? | Operation input |
| output | any? | Operation output |
| metadata | object? | Additional context |
| status | enum | success / error |

### Generation

Langfuse's specialized span type for LLM API calls. Extends Span with:

| Attribute | Type | Description |
|-----------|------|-------------|
| model | string | Model identifier (e.g., "claude-opus-4-20250514") |
| modelParameters | object? | Temperature, max_tokens, etc. |
| input | Message[] | Input messages/prompt |
| output | Message | Completion response |
| usage | UsageDetails | Token counts |
| level | enum | DEBUG / DEFAULT / WARNING / ERROR |

#### UsageDetails

| Attribute | Type | Description |
|-----------|------|-------------|
| input | number | Input tokens |
| output | number | Output tokens |
| total | number? | Total tokens (computed) |
| inputCost | number? | Cost for input tokens |
| outputCost | number? | Cost for output tokens |
| totalCost | number? | Total cost |

### Custom Span Types (Application-Defined)

These are regular spans with specific naming conventions and metadata schemas for algojuke operations.

#### Vector Search Span

| Attribute | Type | Description |
|-----------|------|-------------|
| name | "vector-search" | Fixed span name |
| metadata.collection | string | Qdrant collection name |
| metadata.topK | number | Number of results requested |
| metadata.filters | object? | Search filters applied |
| input | object | Query parameters |
| output.resultCount | number | Number of results returned |
| output.topScores | number[] | Relevance scores of top results |

#### HTTP Span

| Attribute | Type | Description |
|-----------|------|-------------|
| name | "http-request" | Fixed span name |
| metadata.method | string | HTTP method |
| metadata.url | string | Request URL |
| metadata.statusCode | number | Response status code |
| input | object? | Request body |
| output | object? | Response body |

## Configuration Entities

### ObservabilityConfig

Runtime configuration for the observability service.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| baseUrl | string | http://localhost:3000 | Langfuse server URL |
| publicKey | string | (required) | Langfuse public key |
| secretKey | string | (required) | Langfuse secret key |
| enabled | boolean | true | Enable/disable tracing |
| flushIntervalMs | number | 1000 | Batch flush interval |
| exportMode | string | "batched" | Export mode: "batched" or "immediate" |

## Relationships

```
Trace 1 ──────── * Span
  │
  └── userId, sessionId, tags (for filtering)

Span 1 ──────── * Span (parent-child nesting via parentSpanId)

Generation extends Span (with model, usage details)
```

## Notes

- All entities are managed by Langfuse; application code only constructs them via SDK
- Trace/span IDs can be correlated with external systems via `createTraceId()` utility
- Langfuse handles persistence, indexing, and querying internally
- Data retention: Configured per-project via Langfuse dashboard (Project Settings → Data Retention). For local development, data is stored indefinitely by default; storage can be cleared by removing Docker volumes (`docker compose down -v`)
