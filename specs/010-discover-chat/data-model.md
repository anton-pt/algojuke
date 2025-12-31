# Data Model: Discover Chat Agent

**Feature**: 010-discover-chat
**Date**: 2025-12-31

## Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│   Conversation      │       │      Message        │
├─────────────────────┤       ├─────────────────────┤
│ id (PK, UUID)       │──────<│ id (PK, UUID)       │
│ user_id (UUID)      │       │ conversation_id (FK)│
│ created_at          │       │ role                │
│ updated_at          │       │ content (JSONB)     │
└─────────────────────┘       │ created_at          │
                              └─────────────────────┘
```

---

## Entities

### Conversation

Represents a chat session between the user and the AI assistant.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier, also used as Langfuse session ID |
| user_id | UUID | NOT NULL, indexed | Owner of the conversation (single-user: hardcoded UUID) |
| created_at | TIMESTAMP | NOT NULL, default NOW() | When the conversation was started |
| updated_at | TIMESTAMP | NOT NULL, auto-updated, indexed | Last interaction time (for sorting) |

**Indexes**:
- `idx_conversations_user_id` on `user_id`
- `idx_conversations_updated_at` on `updated_at` (for recent-first sorting)

**TypeORM Entity**:

```typescript
@Entity('conversations')
@Index(['userId'])
@Index(['updatedAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Message, (message) => message.conversation, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  messages!: Message[];
}
```

---

### Message

Represents a single communication (user input or AI response) within a conversation.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique message identifier |
| conversation_id | UUID | FK → Conversation.id, NOT NULL, indexed | Parent conversation |
| role | VARCHAR(20) | NOT NULL, CHECK IN ('user', 'assistant') | Message sender role |
| content | JSONB | NOT NULL, default '[]' | Array of content blocks (extensible for tools) |
| created_at | TIMESTAMP | NOT NULL, default NOW(), indexed | When the message was created |

**Indexes**:
- `idx_messages_conversation_id` on `conversation_id`
- `idx_messages_created_at` on `created_at` (for ordering within conversation)

**Content Block Schema** (JSONB array):

```typescript
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown };
```

**TypeORM Entity**:

```typescript
@Entity('messages')
@Index(['conversationId'])
@Index(['createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: 'user' | 'assistant';

  @Column({ type: 'jsonb', default: '[]' })
  content!: ContentBlock[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;
}
```

---

## Derived/Computed Fields

These fields are computed at query time, not stored:

### Conversation Preview

For sidebar display (FR-012: truncated text from first user message):

```typescript
// Computed in resolver/service
function getConversationPreview(conversation: Conversation): string {
  const firstUserMessage = conversation.messages.find(m => m.role === 'user');
  if (!firstUserMessage) return 'New conversation';

  const textBlock = firstUserMessage.content.find(c => c.type === 'text');
  if (!textBlock?.text) return 'New conversation';

  const maxLength = 50;
  return textBlock.text.length > maxLength
    ? textBlock.text.slice(0, maxLength) + '...'
    : textBlock.text;
}
```

### Message Count

```typescript
// Via TypeORM relation count
const conversationWithCount = await conversationRepo.findOne({
  where: { id },
  loadRelationIds: { relations: ['messages'] },
});
```

---

## Validation Rules

### Conversation

| Rule | Enforcement |
|------|-------------|
| user_id must be valid UUID | Database constraint + Zod validation |
| Cannot delete while streaming | Application logic (check in-flight status) |

### Message

| Rule | Enforcement |
|------|-------------|
| role must be 'user' or 'assistant' | Database CHECK constraint + Zod |
| content must be valid ContentBlock[] | Zod schema validation before insert |
| content cannot be empty for 'user' role | Application logic |
| conversation must exist | Foreign key constraint |

**Zod Schemas**:

```typescript
const ContentBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.unknown(),
  }),
]);

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.array(ContentBlockSchema).min(1),
});

const CreateMessageInputSchema = z.object({
  conversationId: z.string().uuid().optional(), // Optional for new conversations
  message: z.string().min(1).max(10000), // User text input
});
```

---

## State Transitions

### Conversation Lifecycle

```
[Created] ──send message──> [Active] ──delete──> [Deleted]
                               │
                               └──idle──> [Active] (conversations persist indefinitely)
```

### Message Lifecycle (Assistant)

```
[Pending] ──stream start──> [Streaming] ──complete──> [Completed]
                                │
                                └──interrupt──> [Interrupted] (partial content saved)
                                │
                                └──error──> [Failed] (error content saved)
```

---

## Migration Script

```typescript
import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class CreateChatTables1735600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create conversations table
    await queryRunner.createTable(
      new Table({
        name: "conversations",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "uuid_generate_v4()",
          },
          {
            name: "user_id",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "created_at",
            type: "timestamp with time zone",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp with time zone",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      "conversations",
      new TableIndex({ name: "idx_conversations_user_id", columnNames: ["user_id"] })
    );
    await queryRunner.createIndex(
      "conversations",
      new TableIndex({ name: "idx_conversations_updated_at", columnNames: ["updated_at"] })
    );

    // Create messages table
    await queryRunner.createTable(
      new Table({
        name: "messages",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "uuid_generate_v4()",
          },
          {
            name: "conversation_id",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "role",
            type: "varchar",
            length: "20",
            isNullable: false,
          },
          {
            name: "content",
            type: "jsonb",
            isNullable: false,
            default: "'[]'",
          },
          {
            name: "created_at",
            type: "timestamp with time zone",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        checks: [
          {
            name: "chk_messages_role",
            expression: "role IN ('user', 'assistant')",
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      "messages",
      new TableIndex({ name: "idx_messages_conversation_id", columnNames: ["conversation_id"] })
    );
    await queryRunner.createIndex(
      "messages",
      new TableIndex({ name: "idx_messages_created_at", columnNames: ["created_at"] })
    );

    await queryRunner.createForeignKey(
      "messages",
      new TableForeignKey({
        name: "fk_messages_conversation",
        columnNames: ["conversation_id"],
        referencedTableName: "conversations",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("messages", true, true);
    await queryRunner.dropTable("conversations", true, true);
  }
}
```

---

## Query Patterns

### List Conversations (sorted by recent)

```typescript
async getConversations(userId: string): Promise<Conversation[]> {
  return this.conversationRepo.find({
    where: { userId },
    order: { updatedAt: 'DESC' },
    take: 100, // Limit per SC-004
  });
}
```

### Get Conversation with Messages

```typescript
async getConversationWithMessages(id: string): Promise<Conversation | null> {
  return this.conversationRepo.findOne({
    where: { id },
    relations: ['messages'],
    order: { messages: { createdAt: 'ASC' } },
  });
}
```

### Create Message (with conversation update)

```typescript
async createMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: ContentBlock[]
): Promise<Message> {
  return this.dataSource.transaction(async (manager) => {
    const message = manager.create(Message, {
      conversationId,
      role,
      content,
    });
    await manager.save(message);

    // Touch conversation updatedAt
    await manager.update(Conversation, conversationId, {
      updatedAt: new Date(),
    });

    return message;
  });
}
```

### Delete Conversation (cascade)

```typescript
async deleteConversation(id: string): Promise<boolean> {
  const result = await this.conversationRepo.delete({ id });
  return (result.affected ?? 0) > 0;
}
```
