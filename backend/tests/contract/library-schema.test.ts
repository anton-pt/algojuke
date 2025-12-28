/**
 * Contract test for library.graphql schema validation
 *
 * Purpose: Verify that the GraphQL schema for library management
 * adheres to the contract defined in contracts/library.graphql
 *
 * Tests:
 * - LibraryAlbum type structure and fields
 * - LibraryTrack type structure and fields
 * - TrackInfo type structure and fields
 * - AddAlbumToLibraryInput input type
 * - AddTrackToLibraryInput input type
 * - Error types (DuplicateLibraryItemError, TidalApiUnavailableError)
 * - Union types (AddAlbumToLibraryResult, AddTrackToLibraryResult)
 * - Query and Mutation definitions
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildSchema, GraphQLSchema, GraphQLObjectType, GraphQLUnionType, GraphQLInputObjectType } from 'graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Library GraphQL Schema Contract', () => {
  let schema: GraphQLSchema;

  beforeAll(() => {
    // Load the library.graphql schema
    const schemaPath = join(__dirname, '../../src/schema/library.graphql');
    const schemaString = readFileSync(schemaPath, 'utf-8');
    schema = buildSchema(schemaString);
  });

  describe('LibraryAlbum Type', () => {
    it('should have all required fields with correct types', () => {
      const libraryAlbumType = schema.getType('LibraryAlbum') as GraphQLObjectType;
      expect(libraryAlbumType).toBeDefined();

      const fields = libraryAlbumType.getFields();

      // Required fields
      expect(fields.id).toBeDefined();
      expect(fields.id.type.toString()).toBe('ID!');

      expect(fields.tidalAlbumId).toBeDefined();
      expect(fields.tidalAlbumId.type.toString()).toBe('String!');

      expect(fields.title).toBeDefined();
      expect(fields.title.type.toString()).toBe('String!');

      expect(fields.artistName).toBeDefined();
      expect(fields.artistName.type.toString()).toBe('String!');

      expect(fields.trackCount).toBeDefined();
      expect(fields.trackCount.type.toString()).toBe('Int!');

      expect(fields.trackListing).toBeDefined();
      expect(fields.trackListing.type.toString()).toBe('[TrackInfo!]!');

      expect(fields.createdAt).toBeDefined();
      expect(fields.createdAt.type.toString()).toBe('String!');

      // Optional fields
      expect(fields.coverArtUrl).toBeDefined();
      expect(fields.coverArtUrl.type.toString()).toBe('String');

      expect(fields.releaseDate).toBeDefined();
      expect(fields.releaseDate.type.toString()).toBe('String');
    });
  });

  describe('LibraryTrack Type', () => {
    it('should have all required fields with correct types', () => {
      const libraryTrackType = schema.getType('LibraryTrack') as GraphQLObjectType;
      expect(libraryTrackType).toBeDefined();

      const fields = libraryTrackType.getFields();

      // Required fields
      expect(fields.id).toBeDefined();
      expect(fields.id.type.toString()).toBe('ID!');

      expect(fields.tidalTrackId).toBeDefined();
      expect(fields.tidalTrackId.type.toString()).toBe('String!');

      expect(fields.title).toBeDefined();
      expect(fields.title.type.toString()).toBe('String!');

      expect(fields.artistName).toBeDefined();
      expect(fields.artistName.type.toString()).toBe('String!');

      expect(fields.duration).toBeDefined();
      expect(fields.duration.type.toString()).toBe('Int!');

      expect(fields.createdAt).toBeDefined();
      expect(fields.createdAt.type.toString()).toBe('String!');

      // Optional fields
      expect(fields.albumName).toBeDefined();
      expect(fields.albumName.type.toString()).toBe('String');

      expect(fields.coverArtUrl).toBeDefined();
      expect(fields.coverArtUrl.type.toString()).toBe('String');
    });
  });

  describe('TrackInfo Type', () => {
    it('should have all required fields with correct types', () => {
      const trackInfoType = schema.getType('TrackInfo') as GraphQLObjectType;
      expect(trackInfoType).toBeDefined();

      const fields = trackInfoType.getFields();

      // Required fields
      expect(fields.position).toBeDefined();
      expect(fields.position.type.toString()).toBe('Int!');

      expect(fields.title).toBeDefined();
      expect(fields.title.type.toString()).toBe('String!');

      expect(fields.duration).toBeDefined();
      expect(fields.duration.type.toString()).toBe('Int!');

      // Optional fields
      expect(fields.tidalId).toBeDefined();
      expect(fields.tidalId.type.toString()).toBe('String');

      expect(fields.explicit).toBeDefined();
      expect(fields.explicit.type.toString()).toBe('Boolean');
    });
  });

  describe('Input Types', () => {
    it('should define AddAlbumToLibraryInput with tidalAlbumId field', () => {
      const inputType = schema.getType('AddAlbumToLibraryInput') as GraphQLInputObjectType;
      expect(inputType).toBeDefined();

      const fields = inputType.getFields();
      expect(fields.tidalAlbumId).toBeDefined();
      expect(fields.tidalAlbumId.type.toString()).toBe('String!');
    });

    it('should define AddTrackToLibraryInput with tidalTrackId field', () => {
      const inputType = schema.getType('AddTrackToLibraryInput') as GraphQLInputObjectType;
      expect(inputType).toBeDefined();

      const fields = inputType.getFields();
      expect(fields.tidalTrackId).toBeDefined();
      expect(fields.tidalTrackId.type.toString()).toBe('String!');
    });
  });

  describe('Error Types', () => {
    it('should define DuplicateLibraryItemError type', () => {
      const errorType = schema.getType('DuplicateLibraryItemError') as GraphQLObjectType;
      expect(errorType).toBeDefined();

      const fields = errorType.getFields();
      expect(fields.message).toBeDefined();
      expect(fields.message.type.toString()).toBe('String!');

      expect(fields.existingItemId).toBeDefined();
      expect(fields.existingItemId.type.toString()).toBe('ID!');
    });

    it('should define TidalApiUnavailableError type', () => {
      const errorType = schema.getType('TidalApiUnavailableError') as GraphQLObjectType;
      expect(errorType).toBeDefined();

      const fields = errorType.getFields();
      expect(fields.message).toBeDefined();
      expect(fields.message.type.toString()).toBe('String!');

      expect(fields.retryable).toBeDefined();
      expect(fields.retryable.type.toString()).toBe('Boolean!');
    });
  });

  describe('Union Types', () => {
    it('should define AddAlbumToLibraryResult union with correct types', () => {
      const unionType = schema.getType('AddAlbumToLibraryResult') as GraphQLUnionType;
      expect(unionType).toBeDefined();

      const types = unionType.getTypes().map(t => t.name);
      expect(types).toContain('LibraryAlbum');
      expect(types).toContain('DuplicateLibraryItemError');
      expect(types).toContain('TidalApiUnavailableError');
      expect(types).toHaveLength(3);
    });

    it('should define AddTrackToLibraryResult union with correct types', () => {
      const unionType = schema.getType('AddTrackToLibraryResult') as GraphQLUnionType;
      expect(unionType).toBeDefined();

      const types = unionType.getTypes().map(t => t.name);
      expect(types).toContain('LibraryTrack');
      expect(types).toContain('DuplicateLibraryItemError');
      expect(types).toContain('TidalApiUnavailableError');
      expect(types).toHaveLength(3);
    });
  });

  describe('Query Type', () => {
    it('should define getLibraryAlbums query', () => {
      const queryType = schema.getQueryType();
      expect(queryType).toBeDefined();

      const fields = queryType!.getFields();
      expect(fields.getLibraryAlbums).toBeDefined();
      expect(fields.getLibraryAlbums.type.toString()).toBe('[LibraryAlbum!]!');
    });

    it('should define getLibraryTracks query', () => {
      const queryType = schema.getQueryType();
      const fields = queryType!.getFields();

      expect(fields.getLibraryTracks).toBeDefined();
      expect(fields.getLibraryTracks.type.toString()).toBe('[LibraryTrack!]!');
    });

    it('should define getLibraryAlbum query with id parameter', () => {
      const queryType = schema.getQueryType();
      const fields = queryType!.getFields();

      expect(fields.getLibraryAlbum).toBeDefined();
      expect(fields.getLibraryAlbum.type.toString()).toBe('LibraryAlbum');

      const args = fields.getLibraryAlbum.args;
      expect(args).toHaveLength(1);
      expect(args[0].name).toBe('id');
      expect(args[0].type.toString()).toBe('ID!');
    });

    it('should define getLibraryTrack query with id parameter', () => {
      const queryType = schema.getQueryType();
      const fields = queryType!.getFields();

      expect(fields.getLibraryTrack).toBeDefined();
      expect(fields.getLibraryTrack.type.toString()).toBe('LibraryTrack');

      const args = fields.getLibraryTrack.args;
      expect(args).toHaveLength(1);
      expect(args[0].name).toBe('id');
      expect(args[0].type.toString()).toBe('ID!');
    });
  });

  describe('Mutation Type', () => {
    it('should define addAlbumToLibrary mutation', () => {
      const mutationType = schema.getMutationType();
      expect(mutationType).toBeDefined();

      const fields = mutationType!.getFields();
      expect(fields.addAlbumToLibrary).toBeDefined();
      expect(fields.addAlbumToLibrary.type.toString()).toBe('AddAlbumToLibraryResult!');

      const args = fields.addAlbumToLibrary.args;
      expect(args).toHaveLength(1);
      expect(args[0].name).toBe('input');
      expect(args[0].type.toString()).toBe('AddAlbumToLibraryInput!');
    });

    it('should define addTrackToLibrary mutation', () => {
      const mutationType = schema.getMutationType();
      const fields = mutationType!.getFields();

      expect(fields.addTrackToLibrary).toBeDefined();
      expect(fields.addTrackToLibrary.type.toString()).toBe('AddTrackToLibraryResult!');

      const args = fields.addTrackToLibrary.args;
      expect(args).toHaveLength(1);
      expect(args[0].name).toBe('input');
      expect(args[0].type.toString()).toBe('AddTrackToLibraryInput!');
    });

    it('should define removeAlbumFromLibrary mutation', () => {
      const mutationType = schema.getMutationType();
      const fields = mutationType!.getFields();

      expect(fields.removeAlbumFromLibrary).toBeDefined();
      expect(fields.removeAlbumFromLibrary.type.toString()).toBe('Boolean!');

      const args = fields.removeAlbumFromLibrary.args;
      expect(args).toHaveLength(1);
      expect(args[0].name).toBe('id');
      expect(args[0].type.toString()).toBe('ID!');
    });

    it('should define removeTrackFromLibrary mutation', () => {
      const mutationType = schema.getMutationType();
      const fields = mutationType!.getFields();

      expect(fields.removeTrackFromLibrary).toBeDefined();
      expect(fields.removeTrackFromLibrary.type.toString()).toBe('Boolean!');

      const args = fields.removeTrackFromLibrary.args;
      expect(args).toHaveLength(1);
      expect(args[0].name).toBe('id');
      expect(args[0].type.toString()).toBe('ID!');
    });
  });
});
