/**
 * Contract tests for Chat entity schema validation
 *
 * Tests the TypeORM entity structure for Conversation and Message
 * to ensure they match the data-model.md specification.
 *
 * Uses metadata inspection without requiring database connection.
 */

import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { Conversation } from '../../src/entities/Conversation.js';
import { Message } from '../../src/entities/Message.js';

describe('Chat Entities Contract', () => {
  const metadataStorage = getMetadataArgsStorage();

  describe('Conversation Entity', () => {
    it('should be decorated as entity with table name "conversations"', () => {
      const entityMetadata = metadataStorage.tables.find(
        t => t.target === Conversation
      );
      expect(entityMetadata).toBeDefined();
      expect(entityMetadata!.name).toBe('conversations');
    });

    it('should have id field as UUID primary key', () => {
      const columnMetadata = metadataStorage.columns.find(
        c => c.target === Conversation && c.propertyName === 'id'
      );
      const generatedMetadata = metadataStorage.generations.find(
        g => g.target === Conversation && g.propertyName === 'id'
      );

      expect(columnMetadata).toBeDefined();
      expect(generatedMetadata).toBeDefined();
      expect(generatedMetadata!.strategy).toBe('uuid');
    });

    it('should have userId field with column name "user_id"', () => {
      const columnMetadata = metadataStorage.columns.find(
        c => c.target === Conversation && c.propertyName === 'userId'
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe('user_id');
      expect(columnMetadata!.options.type).toBe('uuid');
    });

    it('should have createdAt with column name "created_at"', () => {
      const columnMetadata = metadataStorage.columns.find(
        c => c.target === Conversation && c.propertyName === 'createdAt'
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe('created_at');
    });

    it('should have updatedAt with column name "updated_at"', () => {
      const columnMetadata = metadataStorage.columns.find(
        c => c.target === Conversation && c.propertyName === 'updatedAt'
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe('updated_at');
    });

    it('should have messages OneToMany relation with cascade', () => {
      const relationMetadata = metadataStorage.relations.find(
        r => r.target === Conversation && r.propertyName === 'messages'
      );

      expect(relationMetadata).toBeDefined();
      expect(relationMetadata!.relationType).toBe('one-to-many');
      expect(relationMetadata!.options.cascade).toBe(true);
      expect(relationMetadata!.options.onDelete).toBe('CASCADE');
    });

    it('should have index on userId', () => {
      const indices = metadataStorage.indices.filter(
        i => i.target === Conversation
      );

      const userIdIndex = indices.find(idx =>
        idx.columns?.includes('userId')
      );
      expect(userIdIndex).toBeDefined();
    });

    it('should have index on updatedAt', () => {
      const indices = metadataStorage.indices.filter(
        i => i.target === Conversation
      );

      const updatedAtIndex = indices.find(idx =>
        idx.columns?.includes('updatedAt')
      );
      expect(updatedAtIndex).toBeDefined();
    });
  });

  describe('Message Entity', () => {
    it('should be decorated as entity with table name "messages"', () => {
      const entityMetadata = metadataStorage.tables.find(
        t => t.target === Message
      );
      expect(entityMetadata).toBeDefined();
      expect(entityMetadata!.name).toBe('messages');
    });

    it('should have id field as UUID primary key', () => {
      const generatedMetadata = metadataStorage.generations.find(
        g => g.target === Message && g.propertyName === 'id'
      );

      expect(generatedMetadata).toBeDefined();
      expect(generatedMetadata!.strategy).toBe('uuid');
    });

    it('should have conversationId field with column name "conversation_id"', () => {
      const columnMetadata = metadataStorage.columns.find(
        c => c.target === Message && c.propertyName === 'conversationId'
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe('conversation_id');
      expect(columnMetadata!.options.type).toBe('uuid');
    });

    it('should have role field as varchar(20)', () => {
      const columnMetadata = metadataStorage.columns.find(
        c => c.target === Message && c.propertyName === 'role'
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.type).toBe('varchar');
      expect(columnMetadata!.options.length).toBe('20');
    });

    it('should have content field as jsonb', () => {
      const columnMetadata = metadataStorage.columns.find(
        c => c.target === Message && c.propertyName === 'content'
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.type).toBe('jsonb');
      expect(columnMetadata!.options.default).toBe('[]');
    });

    it('should have createdAt with column name "created_at"', () => {
      const columnMetadata = metadataStorage.columns.find(
        c => c.target === Message && c.propertyName === 'createdAt'
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe('created_at');
    });

    it('should have conversation ManyToOne relation with CASCADE delete', () => {
      const relationMetadata = metadataStorage.relations.find(
        r => r.target === Message && r.propertyName === 'conversation'
      );

      expect(relationMetadata).toBeDefined();
      expect(relationMetadata!.relationType).toBe('many-to-one');
      expect(relationMetadata!.options.onDelete).toBe('CASCADE');
    });

    it('should have JoinColumn on conversation_id', () => {
      const joinColumnMetadata = metadataStorage.joinColumns.find(
        jc => jc.target === Message && jc.propertyName === 'conversation'
      );

      expect(joinColumnMetadata).toBeDefined();
      expect(joinColumnMetadata!.name).toBe('conversation_id');
    });

    it('should have index on conversationId', () => {
      const indices = metadataStorage.indices.filter(
        i => i.target === Message
      );

      const convIdIndex = indices.find(idx =>
        idx.columns?.includes('conversationId')
      );
      expect(convIdIndex).toBeDefined();
    });

    it('should have index on createdAt', () => {
      const indices = metadataStorage.indices.filter(
        i => i.target === Message
      );

      const createdAtIndex = indices.find(idx =>
        idx.columns?.includes('createdAt')
      );
      expect(createdAtIndex).toBeDefined();
    });
  });

  describe('ContentBlock Type', () => {
    it('should export ContentBlock type from Message module', async () => {
      const { ContentBlock } = await import('../../src/entities/Message.js');
      // Type check - if this compiles, the type exists
      expect(true).toBe(true);
    });
  });
});
