import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildSchema } from 'graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('GraphQL Schema Contract Tests', () => {
  test('schema file exists and is valid GraphQL', () => {
    const schemaPath = join(__dirname, '../../src/schema/schema.graphql');
    const schemaContent = readFileSync(schemaPath, 'utf-8');

    expect(schemaContent).toBeTruthy();
    expect(() => buildSchema(schemaContent)).not.toThrow();
  });

  test('schema defines Query type with search field', () => {
    const schemaPath = join(__dirname, '../../src/schema/schema.graphql');
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = buildSchema(schemaContent);

    const queryType = schema.getQueryType();
    expect(queryType).toBeDefined();

    const searchField = queryType?.getFields().search;
    expect(searchField).toBeDefined();
  });

  test('search query accepts required parameters', () => {
    const schemaPath = join(__dirname, '../../src/schema/schema.graphql');
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = buildSchema(schemaContent);

    const queryType = schema.getQueryType();
    const searchField = queryType?.getFields().search;
    const args = searchField?.args;

    expect(args).toBeDefined();
    expect(args?.find(arg => arg.name === 'query')).toBeDefined();
    expect(args?.find(arg => arg.name === 'limit')).toBeDefined();
    expect(args?.find(arg => arg.name === 'offset')).toBeDefined();
    expect(args?.find(arg => arg.name === 'countryCode')).toBeDefined();
  });

  test('search returns SearchResults type with required fields', () => {
    const schemaPath = join(__dirname, '../../src/schema/schema.graphql');
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = buildSchema(schemaContent);

    const searchResultsType = schema.getType('SearchResults');
    expect(searchResultsType).toBeDefined();

    if (searchResultsType && 'getFields' in searchResultsType) {
      const fields = searchResultsType.getFields();
      expect(fields.albums).toBeDefined();
      expect(fields.tracks).toBeDefined();
      expect(fields.query).toBeDefined();
      expect(fields.total).toBeDefined();
      expect(fields.cached).toBeDefined();
      expect(fields.timestamp).toBeDefined();
    }
  });

  test('AlbumResult type has all required fields', () => {
    const schemaPath = join(__dirname, '../../src/schema/schema.graphql');
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = buildSchema(schemaContent);

    const albumResultType = schema.getType('AlbumResult');
    expect(albumResultType).toBeDefined();

    if (albumResultType && 'getFields' in albumResultType) {
      const fields = albumResultType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.title).toBeDefined();
      expect(fields.artist).toBeDefined();
      expect(fields.artworkUrl).toBeDefined();
      expect(fields.artworkThumbUrl).toBeDefined();
      expect(fields.explicit).toBeDefined();
      expect(fields.trackCount).toBeDefined();
      expect(fields.externalUrl).toBeDefined();
    }
  });

  test('TrackResult type has all required fields', () => {
    const schemaPath = join(__dirname, '../../src/schema/schema.graphql');
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = buildSchema(schemaContent);

    const trackResultType = schema.getType('TrackResult');
    expect(trackResultType).toBeDefined();

    if (trackResultType && 'getFields' in trackResultType) {
      const fields = trackResultType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.title).toBeDefined();
      expect(fields.artist).toBeDefined();
      expect(fields.albumTitle).toBeDefined();
      expect(fields.artworkUrl).toBeDefined();
      expect(fields.artworkThumbUrl).toBeDefined();
      expect(fields.externalUrl).toBeDefined();
    }
  });
});
