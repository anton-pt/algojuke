/**
 * Langfuse Tracing Contract Tests
 *
 * Feature: 011-agent-tools
 *
 * Tests the tracing wrapper for agent tool invocations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createToolSpan, executeToolWithTracing } from '../../../src/services/agentTools/tracing.js';

describe('createToolSpan', () => {
  describe('with null trace', () => {
    it('returns no-op wrapper', () => {
      const wrapper = createToolSpan(null, {
        toolName: 'semanticSearch',
        toolCallId: 'tc_123',
        input: { query: 'test' },
      });

      // Should not throw
      expect(() => wrapper.endSuccess({
        summary: 'Found 5 tracks',
        resultCount: 5,
        durationMs: 100,
      })).not.toThrow();

      expect(() => wrapper.endError({
        error: 'Test error',
        retryable: true,
        wasRetried: false,
        durationMs: 50,
      })).not.toThrow();
    });
  });

  describe('with mock trace', () => {
    const mockSpan = {
      end: vi.fn(),
    };

    const mockTrace = {
      span: vi.fn().mockReturnValue(mockSpan),
    } as any;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates span with correct input', () => {
      createToolSpan(mockTrace, {
        toolName: 'semanticSearch',
        toolCallId: 'tc_123',
        input: { query: 'melancholic songs', limit: 10 },
      });

      expect(mockTrace.span).toHaveBeenCalledWith({
        name: 'tool-semanticSearch',
        input: {
          toolCallId: 'tc_123',
          toolName: 'semanticSearch',
          input: { query: 'melancholic songs', limit: 10 },
        },
        metadata: {
          toolType: 'agent_tool',
        },
      });
    });

    it('endSuccess calls span.end with success data', () => {
      const wrapper = createToolSpan(mockTrace, {
        toolName: 'tidalSearch',
        toolCallId: 'tc_456',
        input: { query: 'Radiohead' },
      });

      wrapper.endSuccess({
        summary: 'Found 20 tracks',
        resultCount: 20,
        durationMs: 500,
        metadata: { searchType: 'tracks' },
      });

      expect(mockSpan.end).toHaveBeenCalledWith({
        output: {
          summary: 'Found 20 tracks',
          resultCount: 20,
        },
        metadata: {
          searchType: 'tracks',
          durationMs: 500,
          status: 'success',
        },
      });
    });

    it('endError calls span.end with error data', () => {
      const wrapper = createToolSpan(mockTrace, {
        toolName: 'batchMetadata',
        toolCallId: 'tc_789',
        input: { isrcs: ['ABC123456789'] },
      });

      wrapper.endError({
        error: 'Qdrant unavailable',
        retryable: true,
        wasRetried: true,
        durationMs: 1500,
      });

      expect(mockSpan.end).toHaveBeenCalledWith({
        output: {
          error: 'Qdrant unavailable',
        },
        level: 'ERROR',
        metadata: {
          durationMs: 1500,
          retryable: true,
          wasRetried: true,
          status: 'error',
        },
      });
    });

    it('truncates long query strings in input', () => {
      const longQuery = 'a'.repeat(600);

      createToolSpan(mockTrace, {
        toolName: 'semanticSearch',
        toolCallId: 'tc_long',
        input: { query: longQuery },
      });

      const call = mockTrace.span.mock.calls[0][0];
      expect(call.input.input.query.length).toBeLessThan(600);
      expect(call.input.input.query).toContain('[truncated]');
    });

    it('summarizes large arrays in input', () => {
      const largeArray = Array.from({ length: 50 }, (_, i) => `ISRC${i}`);

      createToolSpan(mockTrace, {
        toolName: 'batchMetadata',
        toolCallId: 'tc_batch',
        input: { isrcs: largeArray },
      });

      const call = mockTrace.span.mock.calls[0][0];
      expect(call.input.input.isrcs._type).toBe('array');
      expect(call.input.input.isrcs._length).toBe(50);
      expect(call.input.input.isrcs._sample).toHaveLength(5);
    });
  });
});

describe('executeToolWithTracing', () => {
  const mockSpan = {
    end: vi.fn(),
  };

  const mockTrace = {
    span: vi.fn().mockReturnValue(mockSpan),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns result on success', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      tracks: [{ isrc: 'ABC123', title: 'Test' }],
      summary: 'Found 1 track',
      durationMs: 100,
    });

    const result = await executeToolWithTracing(
      mockTrace,
      'semanticSearch',
      'tc_success',
      { query: 'test' },
      mockFn
    );

    expect(result.summary).toBe('Found 1 track');
    expect(mockFn).toHaveBeenCalledWith({ query: 'test' });
  });

  it('ends span with success on completion', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      tracks: [{ isrc: 'A' }, { isrc: 'B' }],
      summary: 'Found 2 tracks',
      durationMs: 200,
    });

    await executeToolWithTracing(
      mockTrace,
      'semanticSearch',
      'tc_test',
      { query: 'test' },
      mockFn
    );

    expect(mockSpan.end).toHaveBeenCalled();
    const endCall = mockSpan.end.mock.calls[0][0];
    expect(endCall.output.summary).toBe('Found 2 tracks');
    expect(endCall.output.resultCount).toBe(2);
    expect(endCall.metadata.status).toBe('success');
  });

  it('ends span with error on failure', async () => {
    const error = new Error('Search failed') as any;
    error.retryable = true;
    error.wasRetried = false;

    const mockFn = vi.fn().mockRejectedValue(error);

    await expect(
      executeToolWithTracing(
        mockTrace,
        'tidalSearch',
        'tc_error',
        { query: 'fail' },
        mockFn
      )
    ).rejects.toThrow('Search failed');

    expect(mockSpan.end).toHaveBeenCalled();
    const endCall = mockSpan.end.mock.calls[0][0];
    expect(endCall.output.error).toBe('Search failed');
    expect(endCall.level).toBe('ERROR');
    expect(endCall.metadata.retryable).toBe(true);
    expect(endCall.metadata.wasRetried).toBe(false);
    expect(endCall.metadata.status).toBe('error');
  });

  it('extracts result count from tracks array', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      tracks: [{ a: 1 }, { a: 2 }, { a: 3 }],
      summary: 'Test',
      durationMs: 100,
    });

    await executeToolWithTracing(mockTrace, 'test', 'tc_1', {}, mockFn);

    const endCall = mockSpan.end.mock.calls[0][0];
    expect(endCall.output.resultCount).toBe(3);
  });

  it('extracts result count from albums array', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      albums: [{ a: 1 }, { a: 2 }],
      summary: 'Test',
      durationMs: 100,
    });

    await executeToolWithTracing(mockTrace, 'test', 'tc_2', {}, mockFn);

    const endCall = mockSpan.end.mock.calls[0][0];
    expect(endCall.output.resultCount).toBe(2);
  });

  it('extracts result count from totalFound', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      totalFound: 100,
      summary: 'Test',
      durationMs: 100,
    });

    await executeToolWithTracing(mockTrace, 'test', 'tc_3', {}, mockFn);

    const endCall = mockSpan.end.mock.calls[0][0];
    expect(endCall.output.resultCount).toBe(100);
  });

  it('works with null trace', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      tracks: [],
      summary: 'No results',
      durationMs: 50,
    });

    const result = await executeToolWithTracing(
      null,
      'semanticSearch',
      'tc_null',
      { query: 'test' },
      mockFn
    );

    expect(result.summary).toBe('No results');
  });
});
