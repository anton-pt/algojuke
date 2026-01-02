/**
 * Agent Tools Schemas Contract Tests
 *
 * Feature: 011-agent-tools
 *
 * Tests all Zod input schemas for agent tools.
 */

import { describe, it, expect } from 'vitest';
import {
  SemanticSearchInputSchema,
  TidalSearchInputSchema,
  BatchMetadataInputSchema,
  AlbumTracksInputSchema,
  ToolName,
} from '../../../src/schemas/agentTools.js';

describe('SemanticSearchInputSchema', () => {
  it('validates minimal valid input', () => {
    const result = SemanticSearchInputSchema.safeParse({ query: 'test' });
    expect(result.success).toBe(true);
  });

  it('applies default limit of 50', () => {
    const result = SemanticSearchInputSchema.safeParse({ query: 'test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50); // feature 013: increased for better scanning
    }
  });

  it('rejects empty query', () => {
    const result = SemanticSearchInputSchema.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });

  it('rejects query over 2000 characters', () => {
    const result = SemanticSearchInputSchema.safeParse({ query: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('rejects limit below 1', () => {
    const result = SemanticSearchInputSchema.safeParse({ query: 'test', limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects limit above 50', () => {
    const result = SemanticSearchInputSchema.safeParse({ query: 'test', limit: 51 });
    expect(result.success).toBe(false);
  });
});

describe('TidalSearchInputSchema', () => {
  it('validates valid tracks search', () => {
    const result = TidalSearchInputSchema.safeParse({
      query: 'Radiohead',
      searchType: 'tracks',
    });
    expect(result.success).toBe(true);
  });

  it('validates valid albums search', () => {
    const result = TidalSearchInputSchema.safeParse({
      query: 'OK Computer',
      searchType: 'albums',
    });
    expect(result.success).toBe(true);
  });

  it('validates valid both search', () => {
    const result = TidalSearchInputSchema.safeParse({
      query: 'Coldplay',
      searchType: 'both',
    });
    expect(result.success).toBe(true);
  });

  it('applies default limit of 20', () => {
    const result = TidalSearchInputSchema.safeParse({
      query: 'test',
      searchType: 'tracks',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it('rejects empty query', () => {
    const result = TidalSearchInputSchema.safeParse({
      query: '',
      searchType: 'tracks',
    });
    expect(result.success).toBe(false);
  });

  it('rejects query over 500 characters', () => {
    const result = TidalSearchInputSchema.safeParse({
      query: 'x'.repeat(501),
      searchType: 'tracks',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid searchType', () => {
    const result = TidalSearchInputSchema.safeParse({
      query: 'test',
      searchType: 'artists',
    });
    expect(result.success).toBe(false);
  });

  it('accepts limit of 100', () => {
    const result = TidalSearchInputSchema.safeParse({
      query: 'test',
      searchType: 'tracks',
      limit: 100,
    });
    expect(result.success).toBe(true);
  });

  it('rejects limit above 100', () => {
    const result = TidalSearchInputSchema.safeParse({
      query: 'test',
      searchType: 'tracks',
      limit: 101,
    });
    expect(result.success).toBe(false);
  });
});

describe('BatchMetadataInputSchema', () => {
  const validIsrc = 'USRC12345678';
  const anotherValidIsrc = 'GBAYE9876543';

  it('validates empty array (per US3 acceptance scenario 4)', () => {
    const result = BatchMetadataInputSchema.safeParse({ isrcs: [] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isrcs).toEqual([]);
    }
  });

  it('validates single valid ISRC', () => {
    const result = BatchMetadataInputSchema.safeParse({ isrcs: [validIsrc] });
    expect(result.success).toBe(true);
  });

  it('validates multiple valid ISRCs', () => {
    const result = BatchMetadataInputSchema.safeParse({
      isrcs: [validIsrc, anotherValidIsrc],
    });
    expect(result.success).toBe(true);
  });

  it('accepts 100 ISRCs (maximum)', () => {
    const isrcs = Array.from({ length: 100 }, (_, i) =>
      `USRC${String(i).padStart(8, '0')}`
    );
    const result = BatchMetadataInputSchema.safeParse({ isrcs });
    expect(result.success).toBe(true);
  });

  it('rejects more than 100 ISRCs', () => {
    const isrcs = Array.from({ length: 101 }, (_, i) =>
      `USRC${String(i).padStart(8, '0')}`
    );
    const result = BatchMetadataInputSchema.safeParse({ isrcs });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('100');
    }
  });

  it('rejects invalid ISRC format (too short)', () => {
    const result = BatchMetadataInputSchema.safeParse({ isrcs: ['ABC123'] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('ISRC');
    }
  });

  it('rejects invalid ISRC format (too long)', () => {
    const result = BatchMetadataInputSchema.safeParse({ isrcs: ['USRC1234567890'] });
    expect(result.success).toBe(false);
  });

  it('rejects ISRC with special characters', () => {
    const result = BatchMetadataInputSchema.safeParse({ isrcs: ['USRC-1234567'] });
    expect(result.success).toBe(false);
  });

  it('accepts lowercase ISRCs (case insensitive)', () => {
    const result = BatchMetadataInputSchema.safeParse({ isrcs: ['usrc12345678'] });
    expect(result.success).toBe(true);
  });

  it('accepts mixed case ISRCs', () => {
    const result = BatchMetadataInputSchema.safeParse({ isrcs: ['UsRc12345678'] });
    expect(result.success).toBe(true);
  });
});

describe('AlbumTracksInputSchema', () => {
  it('validates valid album ID', () => {
    const result = AlbumTracksInputSchema.safeParse({ albumId: '12345678' });
    expect(result.success).toBe(true);
  });

  it('rejects empty album ID', () => {
    const result = AlbumTracksInputSchema.safeParse({ albumId: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('empty');
    }
  });

  it('accepts alphanumeric album IDs', () => {
    const result = AlbumTracksInputSchema.safeParse({ albumId: 'album-123-abc' });
    expect(result.success).toBe(true);
  });
});

describe('ToolName enum', () => {
  it('includes all expected tool names', () => {
    const names = ToolName.options;
    expect(names).toContain('semanticSearch');
    expect(names).toContain('tidalSearch');
    expect(names).toContain('batchMetadata');
    expect(names).toContain('albumTracks');
    expect(names).toHaveLength(4);
  });

  it('validates valid tool names', () => {
    expect(ToolName.safeParse('semanticSearch').success).toBe(true);
    expect(ToolName.safeParse('tidalSearch').success).toBe(true);
    expect(ToolName.safeParse('batchMetadata').success).toBe(true);
    expect(ToolName.safeParse('albumTracks').success).toBe(true);
  });

  it('rejects invalid tool names', () => {
    expect(ToolName.safeParse('invalidTool').success).toBe(false);
    expect(ToolName.safeParse('').success).toBe(false);
  });
});
