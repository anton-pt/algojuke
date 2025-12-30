/**
 * Contract test for discovery.graphql schema validation
 *
 * Feature: 009-semantic-discovery-search
 * Date: 2025-12-30
 *
 * Purpose: Verify that the GraphQL schema for semantic discovery search
 * adheres to the contract defined in contracts/discovery.graphql
 *
 * Tests:
 * - DiscoveryResult type structure and fields
 * - DiscoverySearchResponse type structure and fields
 * - DiscoverySearchError type structure and fields
 * - DiscoverySearchResult union type
 * - DiscoverySearchInput input type
 * - discoverTracks query definition
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  buildSchema,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLUnionType,
  GraphQLEnumType,
} from 'graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Discovery GraphQL Schema Contract', () => {
  let schema: GraphQLSchema;

  beforeAll(() => {
    // Load the base schema (for Query type definition)
    const searchSchemaPath = join(__dirname, '../../src/schema/schema.graphql');
    const searchSchemaString = readFileSync(searchSchemaPath, 'utf-8');

    // Load the discovery.graphql schema
    const discoveryPath = join(__dirname, '../../src/schema/discovery.graphql');
    const discoveryString = readFileSync(discoveryPath, 'utf-8');

    // Combine schemas (search provides Query type, discovery extends it)
    schema = buildSchema(searchSchemaString + '\n' + discoveryString);
  });

  describe('DiscoveryResult Type', () => {
    it('should have all required fields with correct types', () => {
      const resultType = schema.getType('DiscoveryResult') as GraphQLObjectType;
      expect(resultType).toBeDefined();

      const fields = resultType.getFields();

      // Required fields
      expect(fields.id).toBeDefined();
      expect(fields.id.type.toString()).toBe('ID!');

      expect(fields.isrc).toBeDefined();
      expect(fields.isrc.type.toString()).toBe('String!');

      expect(fields.title).toBeDefined();
      expect(fields.title.type.toString()).toBe('String!');

      expect(fields.artist).toBeDefined();
      expect(fields.artist.type.toString()).toBe('String!');

      expect(fields.album).toBeDefined();
      expect(fields.album.type.toString()).toBe('String!');

      expect(fields.score).toBeDefined();
      expect(fields.score.type.toString()).toBe('Float!');

      // Optional field
      expect(fields.artworkUrl).toBeDefined();
      expect(fields.artworkUrl.type.toString()).toBe('String');
    });

    it('should have exactly 7 fields', () => {
      const resultType = schema.getType('DiscoveryResult') as GraphQLObjectType;
      const fields = Object.keys(resultType.getFields());
      expect(fields).toHaveLength(7);
    });
  });

  describe('DiscoverySearchResponse Type', () => {
    it('should have all required fields with correct types', () => {
      const responseType = schema.getType('DiscoverySearchResponse') as GraphQLObjectType;
      expect(responseType).toBeDefined();

      const fields = responseType.getFields();

      // Results array
      expect(fields.results).toBeDefined();
      expect(fields.results.type.toString()).toBe('[DiscoveryResult!]!');

      // Query info
      expect(fields.query).toBeDefined();
      expect(fields.query.type.toString()).toBe('String!');

      expect(fields.expandedQueries).toBeDefined();
      expect(fields.expandedQueries.type.toString()).toBe('[String!]!');

      // Pagination
      expect(fields.page).toBeDefined();
      expect(fields.page.type.toString()).toBe('Int!');

      expect(fields.pageSize).toBeDefined();
      expect(fields.pageSize.type.toString()).toBe('Int!');

      expect(fields.totalResults).toBeDefined();
      expect(fields.totalResults.type.toString()).toBe('Int!');

      expect(fields.hasMore).toBeDefined();
      expect(fields.hasMore.type.toString()).toBe('Boolean!');
    });

    it('should have exactly 7 fields', () => {
      const responseType = schema.getType('DiscoverySearchResponse') as GraphQLObjectType;
      const fields = Object.keys(responseType.getFields());
      expect(fields).toHaveLength(7);
    });
  });

  describe('DiscoverySearchError Type', () => {
    it('should have all required fields with correct types', () => {
      const errorType = schema.getType('DiscoverySearchError') as GraphQLObjectType;
      expect(errorType).toBeDefined();

      const fields = errorType.getFields();

      expect(fields.message).toBeDefined();
      expect(fields.message.type.toString()).toBe('String!');

      expect(fields.code).toBeDefined();
      expect(fields.code.type.toString()).toBe('DiscoveryErrorCode!');

      expect(fields.retryable).toBeDefined();
      expect(fields.retryable.type.toString()).toBe('Boolean!');
    });

    it('should have exactly 3 fields', () => {
      const errorType = schema.getType('DiscoverySearchError') as GraphQLObjectType;
      const fields = Object.keys(errorType.getFields());
      expect(fields).toHaveLength(3);
    });
  });

  describe('DiscoveryErrorCode Enum', () => {
    it('should have all expected error codes', () => {
      const enumType = schema.getType('DiscoveryErrorCode') as GraphQLEnumType;
      expect(enumType).toBeDefined();

      const values = enumType.getValues().map((v) => v.name);

      expect(values).toContain('EMPTY_QUERY');
      expect(values).toContain('LLM_UNAVAILABLE');
      expect(values).toContain('EMBEDDING_UNAVAILABLE');
      expect(values).toContain('INDEX_UNAVAILABLE');
      expect(values).toContain('TIMEOUT');
      expect(values).toContain('INTERNAL_ERROR');
    });

    it('should have exactly 6 error codes', () => {
      const enumType = schema.getType('DiscoveryErrorCode') as GraphQLEnumType;
      const values = enumType.getValues();
      expect(values).toHaveLength(6);
    });
  });

  describe('DiscoverySearchResult Union', () => {
    it('should be a union of DiscoverySearchResponse and DiscoverySearchError', () => {
      const unionType = schema.getType('DiscoverySearchResult') as GraphQLUnionType;
      expect(unionType).toBeDefined();

      const types = unionType.getTypes().map((t) => t.name);
      expect(types).toContain('DiscoverySearchResponse');
      expect(types).toContain('DiscoverySearchError');
      expect(types).toHaveLength(2);
    });
  });

  describe('DiscoverySearchInput Input Type', () => {
    it('should have all expected input fields with correct types', () => {
      const inputType = schema.getType('DiscoverySearchInput') as GraphQLInputObjectType;
      expect(inputType).toBeDefined();

      const fields = inputType.getFields();

      // Required query field
      expect(fields.query).toBeDefined();
      expect(fields.query.type.toString()).toBe('String!');

      // Optional pagination fields
      expect(fields.page).toBeDefined();
      expect(fields.page.type.toString()).toBe('Int');

      expect(fields.pageSize).toBeDefined();
      expect(fields.pageSize.type.toString()).toBe('Int');
    });

    it('should have exactly 3 fields', () => {
      const inputType = schema.getType('DiscoverySearchInput') as GraphQLInputObjectType;
      const fields = Object.keys(inputType.getFields());
      expect(fields).toHaveLength(3);
    });
  });

  describe('Query Type Extensions', () => {
    it('should define discoverTracks query with input parameter', () => {
      const queryType = schema.getQueryType();
      expect(queryType).toBeDefined();

      const fields = queryType!.getFields();
      expect(fields.discoverTracks).toBeDefined();

      // Return type should be non-nullable DiscoverySearchResult union
      expect(fields.discoverTracks.type.toString()).toBe('DiscoverySearchResult!');

      // Should have exactly one argument: input
      const args = fields.discoverTracks.args;
      expect(args).toHaveLength(1);
      expect(args[0].name).toBe('input');
      expect(args[0].type.toString()).toBe('DiscoverySearchInput!');
    });
  });
});
