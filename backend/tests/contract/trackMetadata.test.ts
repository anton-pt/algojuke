/**
 * Contract test for trackMetadata.graphql schema validation
 *
 * Purpose: Verify that the GraphQL schema for track metadata display
 * adheres to the contract defined in contracts/track-metadata.graphql
 *
 * Tests:
 * - AudioFeatures type structure and fields
 * - ExtendedTrackMetadata type structure and fields
 * - getExtendedTrackMetadata query definition
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  buildSchema,
  GraphQLSchema,
  GraphQLObjectType,
} from 'graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Track Metadata GraphQL Schema Contract', () => {
  let schema: GraphQLSchema;

  beforeAll(() => {
    // Load the library.graphql schema first (for base types)
    const librarySchemaPath = join(__dirname, '../../src/schema/library.graphql');
    const librarySchemaString = readFileSync(librarySchemaPath, 'utf-8');

    // Load the trackMetadata.graphql schema
    const trackMetadataPath = join(__dirname, '../../src/schema/trackMetadata.graphql');
    const trackMetadataString = readFileSync(trackMetadataPath, 'utf-8');

    // Combine schemas (library provides Query type, trackMetadata extends it)
    schema = buildSchema(librarySchemaString + '\n' + trackMetadataString);
  });

  describe('AudioFeatures Type', () => {
    it('should have all 11 audio feature fields with correct nullable Float/Int types', () => {
      const audioFeaturesType = schema.getType('AudioFeatures') as GraphQLObjectType;
      expect(audioFeaturesType).toBeDefined();

      const fields = audioFeaturesType.getFields();

      // All float-based features (0.0 to 1.0 or similar)
      expect(fields.acousticness).toBeDefined();
      expect(fields.acousticness.type.toString()).toBe('Float');

      expect(fields.danceability).toBeDefined();
      expect(fields.danceability.type.toString()).toBe('Float');

      expect(fields.energy).toBeDefined();
      expect(fields.energy.type.toString()).toBe('Float');

      expect(fields.instrumentalness).toBeDefined();
      expect(fields.instrumentalness.type.toString()).toBe('Float');

      expect(fields.liveness).toBeDefined();
      expect(fields.liveness.type.toString()).toBe('Float');

      expect(fields.loudness).toBeDefined();
      expect(fields.loudness.type.toString()).toBe('Float');

      expect(fields.speechiness).toBeDefined();
      expect(fields.speechiness.type.toString()).toBe('Float');

      expect(fields.tempo).toBeDefined();
      expect(fields.tempo.type.toString()).toBe('Float');

      expect(fields.valence).toBeDefined();
      expect(fields.valence.type.toString()).toBe('Float');

      // Integer-based features
      expect(fields.key).toBeDefined();
      expect(fields.key.type.toString()).toBe('Int');

      expect(fields.mode).toBeDefined();
      expect(fields.mode.type.toString()).toBe('Int');
    });

    it('should have exactly 11 fields', () => {
      const audioFeaturesType = schema.getType('AudioFeatures') as GraphQLObjectType;
      const fields = Object.keys(audioFeaturesType.getFields());
      expect(fields).toHaveLength(11);
    });
  });

  describe('ExtendedTrackMetadata Type', () => {
    it('should have all required fields with correct types', () => {
      const metadataType = schema.getType('ExtendedTrackMetadata') as GraphQLObjectType;
      expect(metadataType).toBeDefined();

      const fields = metadataType.getFields();

      // Required field
      expect(fields.isrc).toBeDefined();
      expect(fields.isrc.type.toString()).toBe('String!');

      // Optional text fields
      expect(fields.lyrics).toBeDefined();
      expect(fields.lyrics.type.toString()).toBe('String');

      expect(fields.interpretation).toBeDefined();
      expect(fields.interpretation.type.toString()).toBe('String');

      // Optional audio features object
      expect(fields.audioFeatures).toBeDefined();
      expect(fields.audioFeatures.type.toString()).toBe('AudioFeatures');
    });

    it('should have exactly 4 fields', () => {
      const metadataType = schema.getType('ExtendedTrackMetadata') as GraphQLObjectType;
      const fields = Object.keys(metadataType.getFields());
      expect(fields).toHaveLength(4);
    });
  });

  describe('Query Type Extensions', () => {
    it('should define getExtendedTrackMetadata query with isrc parameter', () => {
      const queryType = schema.getQueryType();
      expect(queryType).toBeDefined();

      const fields = queryType!.getFields();
      expect(fields.getExtendedTrackMetadata).toBeDefined();

      // Return type should be nullable ExtendedTrackMetadata
      expect(fields.getExtendedTrackMetadata.type.toString()).toBe('ExtendedTrackMetadata');

      // Should have exactly one argument: isrc
      const args = fields.getExtendedTrackMetadata.args;
      expect(args).toHaveLength(1);
      expect(args[0].name).toBe('isrc');
      expect(args[0].type.toString()).toBe('String!');
    });

    it('should define checkIndexedStatus query with isrcs parameter (FR-017)', () => {
      const queryType = schema.getQueryType();
      expect(queryType).toBeDefined();

      const fields = queryType!.getFields();
      expect(fields.checkIndexedStatus).toBeDefined();

      // Return type should be non-nullable array of IndexedStatusResult
      expect(fields.checkIndexedStatus.type.toString()).toBe('[IndexedStatusResult!]!');

      // Should have exactly one argument: isrcs
      const args = fields.checkIndexedStatus.args;
      expect(args).toHaveLength(1);
      expect(args[0].name).toBe('isrcs');
      expect(args[0].type.toString()).toBe('[String!]!');
    });
  });

  describe('IndexedStatusResult Type', () => {
    it('should have isrc and isIndexed fields with correct types', () => {
      const resultType = schema.getType('IndexedStatusResult') as GraphQLObjectType;
      expect(resultType).toBeDefined();

      const fields = resultType.getFields();

      expect(fields.isrc).toBeDefined();
      expect(fields.isrc.type.toString()).toBe('String!');

      expect(fields.isIndexed).toBeDefined();
      expect(fields.isIndexed.type.toString()).toBe('Boolean!');
    });

    it('should have exactly 2 fields', () => {
      const resultType = schema.getType('IndexedStatusResult') as GraphQLObjectType;
      const fields = Object.keys(resultType.getFields());
      expect(fields).toHaveLength(2);
    });
  });
});
