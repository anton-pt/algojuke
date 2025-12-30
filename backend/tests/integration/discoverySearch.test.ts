/**
 * Integration tests for Semantic Discovery Search feature
 *
 * Feature: 009-semantic-discovery-search
 * Date: 2025-12-30
 *
 * Purpose: Test the complete search pipeline from GraphQL query to results
 *
 * Tests:
 * - DiscoveryService.search with mocked dependencies
 * - Query validation (empty, whitespace, too long)
 * - Query expansion via Anthropic client
 * - Embedding generation via TEI client
 * - Hybrid search via Qdrant client
 * - Error handling for service failures
 * - Pagination behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscoveryService } from '../../src/services/discoveryService.js';
import { BackendQdrantClient } from '../../src/clients/qdrantClient.js';
import type { AnthropicClient } from '../../src/clients/anthropicClient.js';
import type { TEIClient } from '../../src/clients/teiClient.js';
import {
  DiscoveryErrorCode,
  isDiscoverySearchError,
  type DiscoveryResult,
  type DiscoverySearchResponse,
} from '../../src/types/discovery.js';
import { AnthropicError } from '../../src/clients/anthropicClient.js';
import { TEIError } from '../../src/clients/teiClient.js';

describe('DiscoveryService Integration', () => {
  let service: DiscoveryService;
  let mockQdrantClient: {
    hybridSearch: ReturnType<typeof vi.fn>;
    getCollectionCount: ReturnType<typeof vi.fn>;
    isHealthy: ReturnType<typeof vi.fn>;
  };
  let mockAnthropicClient: AnthropicClient;
  let mockTeiClient: TEIClient;

  // Sample test data
  const mockResults: DiscoveryResult[] = [
    {
      id: 'uuid-1',
      isrc: 'USRC12345678',
      title: 'Hopeful Song',
      artist: 'Test Artist',
      album: 'Test Album',
      score: 0.95,
      artworkUrl: 'https://example.com/art1.jpg',
    },
    {
      id: 'uuid-2',
      isrc: 'USRC12345679',
      title: 'Uplifting Track',
      artist: 'Another Artist',
      album: 'Another Album',
      score: 0.85,
      artworkUrl: null,
    },
  ];

  const mockEmbedding = new Array(1024).fill(0.1);

  beforeEach(() => {
    // Create mock Qdrant client
    mockQdrantClient = {
      hybridSearch: vi.fn().mockResolvedValue(mockResults),
      getCollectionCount: vi.fn().mockResolvedValue(100),
      isHealthy: vi.fn().mockResolvedValue(true),
    };

    // Create mock Anthropic client
    mockAnthropicClient = {
      expandQuery: vi.fn().mockResolvedValue({
        queries: ['hopeful uplifting songs', 'music about overcoming challenges'],
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 50,
        outputTokens: 20,
      }),
      isHealthy: vi.fn().mockResolvedValue(true),
    };

    // Create mock TEI client
    mockTeiClient = {
      embed: vi.fn().mockResolvedValue(mockEmbedding),
      embedWithInstruct: vi.fn().mockResolvedValue(mockEmbedding),
      isHealthy: vi.fn().mockResolvedValue(true),
    };

    // Create service with mocked dependencies
    service = new DiscoveryService({
      qdrantClient: mockQdrantClient as unknown as BackendQdrantClient,
      anthropicClient: mockAnthropicClient,
      teiClient: mockTeiClient,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful search flow', () => {
    it('should return search results for valid query', async () => {
      const result = await service.search({
        query: 'uplifting songs about hope',
        page: 0,
        pageSize: 20,
      });

      expect(isDiscoverySearchError(result)).toBe(false);
      const response = result as DiscoverySearchResponse;

      expect(response.results).toHaveLength(2);
      expect(response.query).toBe('uplifting songs about hope');
      expect(response.expandedQueries).toEqual([
        'hopeful uplifting songs',
        'music about overcoming challenges',
      ]);
      expect(response.page).toBe(0);
      expect(response.pageSize).toBe(20);
    });

    it('should call query expansion with user query', async () => {
      await service.search({ query: 'sad songs', page: 0, pageSize: 20 });

      expect(mockAnthropicClient.expandQuery).toHaveBeenCalledWith('sad songs');
    });

    it('should generate embeddings for each expanded query', async () => {
      await service.search({ query: 'test query', page: 0, pageSize: 20 });

      // Should be called twice (once per expanded query)
      expect(mockTeiClient.embedWithInstruct).toHaveBeenCalledTimes(2);
    });

    it('should call hybrid search with prepared queries', async () => {
      await service.search({ query: 'test query', page: 0, pageSize: 20 });

      expect(mockQdrantClient.hybridSearch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.any(String),
            denseVector: mockEmbedding,
            sparseVector: expect.objectContaining({
              indices: expect.any(Array),
              values: expect.any(Array),
            }),
          }),
        ]),
        expect.objectContaining({
          limit: 20,
          offset: 0,
        })
      );
    });
  });

  describe('Query validation', () => {
    it('should return EMPTY_QUERY error for empty query', async () => {
      const result = await service.search({ query: '', page: 0, pageSize: 20 });

      expect(isDiscoverySearchError(result)).toBe(true);
      if (isDiscoverySearchError(result)) {
        expect(result.code).toBe(DiscoveryErrorCode.EMPTY_QUERY);
        expect(result.retryable).toBe(false);
      }
    });

    it('should return EMPTY_QUERY error for whitespace-only query', async () => {
      const result = await service.search({ query: '   \t\n  ', page: 0, pageSize: 20 });

      expect(isDiscoverySearchError(result)).toBe(true);
      if (isDiscoverySearchError(result)) {
        expect(result.code).toBe(DiscoveryErrorCode.EMPTY_QUERY);
      }
    });

    it('should trim whitespace from valid queries', async () => {
      await service.search({ query: '  test query  ', page: 0, pageSize: 20 });

      expect(mockAnthropicClient.expandQuery).toHaveBeenCalledWith('test query');
    });
  });

  describe('Pagination', () => {
    it('should use default page and pageSize', async () => {
      await service.search({ query: 'test' });

      expect(mockQdrantClient.hybridSearch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          limit: 20,
          offset: 0,
        })
      );
    });

    it('should calculate offset from page number', async () => {
      await service.search({ query: 'test', page: 2, pageSize: 20 });

      expect(mockQdrantClient.hybridSearch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          limit: 20,
          offset: 40, // page 2 * pageSize 20
        })
      );
    });

    it('should cap pageSize at maximum 20', async () => {
      await service.search({ query: 'test', page: 0, pageSize: 50 });

      expect(mockQdrantClient.hybridSearch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          limit: 20,
        })
      );
    });

    it('should return empty results when offset exceeds max results', async () => {
      const result = await service.search({ query: 'test', page: 10, pageSize: 20 });

      expect(isDiscoverySearchError(result)).toBe(false);
      const response = result as DiscoverySearchResponse;
      expect(response.results).toHaveLength(0);
      expect(response.hasMore).toBe(false);
    });

    it('should set hasMore based on result count and remaining capacity', async () => {
      // Mock returning full page (20 results)
      const fullPageResults = Array.from({ length: 20 }, (_, i) => ({
        id: `uuid-${i}`,
        isrc: `ISRC1234567${i.toString().padStart(1, '0')}`,
        title: `Track ${i}`,
        artist: 'Artist',
        album: 'Album',
        score: 1 - i * 0.01,
        artworkUrl: null,
      }));
      mockQdrantClient.hybridSearch.mockResolvedValue(fullPageResults);

      const result = await service.search({ query: 'test', page: 0, pageSize: 20 });

      expect(isDiscoverySearchError(result)).toBe(false);
      const response = result as DiscoverySearchResponse;
      expect(response.hasMore).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return LLM_UNAVAILABLE error when Anthropic fails', async () => {
      mockAnthropicClient.expandQuery = vi.fn().mockRejectedValue(
        new AnthropicError('Rate limit exceeded', 429, true)
      );

      const result = await service.search({ query: 'test', page: 0, pageSize: 20 });

      expect(isDiscoverySearchError(result)).toBe(true);
      if (isDiscoverySearchError(result)) {
        expect(result.code).toBe(DiscoveryErrorCode.LLM_UNAVAILABLE);
        expect(result.retryable).toBe(true);
      }
    });

    it('should return EMBEDDING_UNAVAILABLE error when TEI fails', async () => {
      mockTeiClient.embedWithInstruct = vi.fn().mockRejectedValue(
        new TEIError('TEI model not loaded', 503, true)
      );

      const result = await service.search({ query: 'test', page: 0, pageSize: 20 });

      expect(isDiscoverySearchError(result)).toBe(true);
      if (isDiscoverySearchError(result)) {
        expect(result.code).toBe(DiscoveryErrorCode.EMBEDDING_UNAVAILABLE);
        expect(result.retryable).toBe(true);
      }
    });

    it('should return INDEX_UNAVAILABLE error when Qdrant fails', async () => {
      mockQdrantClient.hybridSearch.mockRejectedValue(
        new Error('Qdrant connection refused')
      );

      const result = await service.search({ query: 'test', page: 0, pageSize: 20 });

      expect(isDiscoverySearchError(result)).toBe(true);
      if (isDiscoverySearchError(result)) {
        expect(result.code).toBe(DiscoveryErrorCode.INDEX_UNAVAILABLE);
        expect(result.retryable).toBe(true);
      }
    });

    it('should return INTERNAL_ERROR for unknown errors', async () => {
      mockAnthropicClient.expandQuery = vi.fn().mockRejectedValue(
        new Error('Unknown error')
      );

      const result = await service.search({ query: 'test', page: 0, pageSize: 20 });

      expect(isDiscoverySearchError(result)).toBe(true);
      if (isDiscoverySearchError(result)) {
        expect(result.code).toBe(DiscoveryErrorCode.INTERNAL_ERROR);
      }
    });
  });

  describe('Health check', () => {
    it('should return true when all services are healthy', async () => {
      const healthy = await service.isHealthy();
      expect(healthy).toBe(true);
    });

    it('should return false when TEI is unhealthy', async () => {
      mockTeiClient.isHealthy = vi.fn().mockResolvedValue(false);
      service = new DiscoveryService({
        qdrantClient: mockQdrantClient as unknown as BackendQdrantClient,
        anthropicClient: mockAnthropicClient,
        teiClient: mockTeiClient,
      });

      const healthy = await service.isHealthy();
      expect(healthy).toBe(false);
    });

    it('should return false when Qdrant is unhealthy', async () => {
      mockQdrantClient.isHealthy.mockResolvedValue(false);

      const healthy = await service.isHealthy();
      expect(healthy).toBe(false);
    });
  });

  describe('Index count', () => {
    it('should return indexed track count', async () => {
      const count = await service.getIndexedCount();
      expect(count).toBe(100);
      expect(mockQdrantClient.getCollectionCount).toHaveBeenCalled();
    });
  });
});

describe('Sparse Vector Generation', () => {
  it('should generate sparse vectors from query text', async () => {
    const { textToSparseVector } = await import('../../src/utils/sparseVector.js');

    const vector = textToSparseVector('uplifting songs about hope');

    expect(vector.indices).toBeInstanceOf(Array);
    expect(vector.values).toBeInstanceOf(Array);
    expect(vector.indices.length).toBe(vector.values.length);
    expect(vector.indices.length).toBeGreaterThan(0);

    // Values should be in BM25 TF range (0-1)
    for (const value of vector.values) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('should handle empty text', async () => {
    const { textToSparseVector } = await import('../../src/utils/sparseVector.js');

    const vector = textToSparseVector('');

    expect(vector.indices).toHaveLength(0);
    expect(vector.values).toHaveLength(0);
  });

  it('should filter single-character tokens', async () => {
    const { textToSparseVector } = await import('../../src/utils/sparseVector.js');

    const vector = textToSparseVector('a b c test');

    // Only 'test' should produce a token
    expect(vector.indices.length).toBe(1);
  });
});
