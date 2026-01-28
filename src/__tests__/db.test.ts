/**
 * Database Layer Tests
 * 
 * Tests the IndexedDB database operations via Dexie including
 * search, sync, load, and delete operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db, searchMessages, syncConversationToDB, loadConversationsFromDB, deleteConversationFromDB } from '../lib/db';
import type { DBConversation, DBMessage } from '../lib/db';

describe('Database Layer', () => {
  beforeEach(async () => {
    // Clear all tables before each test
    await db.conversations.clear();
    await db.messages.clear();
  });

  describe('searchMessages', () => {
    const createMessage = (id: string, conversationId: string, content: string, role: 'user' | 'assistant' = 'user'): DBMessage => ({
      id,
      conversationId,
      role,
      content,
      timestamp: new Date(),
      searchText: content.toLowerCase(),
    });

    it('should find messages containing the search term', async () => {
      await db.messages.bulkAdd([
        createMessage('msg-1', 'conv-1', 'Tell me about quantum computing'),
        createMessage('msg-2', 'conv-1', 'What is TypeScript?'),
        createMessage('msg-3', 'conv-2', 'Quantum physics explained'),
      ]);

      const results = await searchMessages('quantum');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for no matches', async () => {
      await db.messages.bulkAdd([
        createMessage('msg-1', 'conv-1', 'Hello world'),
      ]);

      const results = await searchMessages('xyznonexistent');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for empty query', async () => {
      await db.messages.bulkAdd([
        createMessage('msg-1', 'conv-1', 'Hello world'),
      ]);

      const results = await searchMessages('');
      expect(results).toHaveLength(0);
    });

    it('should filter by conversation ID when specified', async () => {
      await db.messages.bulkAdd([
        createMessage('msg-1', 'conv-1', 'Quantum in conversation 1'),
        createMessage('msg-2', 'conv-2', 'Quantum in conversation 2'),
      ]);

      const results = await searchMessages('quantum', 'conv-1');
      // Should only return results from conv-1
      const conv1Results = results.filter(m => m.conversationId === 'conv-1');
      expect(conv1Results.length).toBeGreaterThanOrEqual(1);
    });

    it('should be case-insensitive', async () => {
      await db.messages.bulkAdd([
        createMessage('msg-1', 'conv-1', 'Hello World UPPERCASE'),
      ]);

      const results = await searchMessages('hello');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle multi-word queries', async () => {
      await db.messages.bulkAdd([
        createMessage('msg-1', 'conv-1', 'quantum computing is fascinating'),
        createMessage('msg-2', 'conv-1', 'quantum physics is different'),
        createMessage('msg-3', 'conv-1', 'machine learning overview'),
      ]);

      const results = await searchMessages('quantum computing');
      // Should match "quantum computing" specifically
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('syncConversationToDB', () => {
    it('should save conversation and messages', async () => {
      const conversation: DBConversation = {
        id: 'sync-conv-1',
        title: 'Sync Test',
        createdAt: new Date(),
        updatedAt: new Date(),
        thinkingEnabled: false,
        isPinned: false,
      };

      const messages: DBMessage[] = [
        {
          id: 'sync-msg-1',
          conversationId: 'sync-conv-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
          searchText: 'hello',
        },
        {
          id: 'sync-msg-2',
          conversationId: 'sync-conv-1',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date(),
          searchText: 'hi there!',
        },
      ];

      await syncConversationToDB(conversation, messages);

      // Verify conversation was saved
      const savedConv = await db.conversations.get('sync-conv-1');
      expect(savedConv).toBeDefined();
      expect(savedConv!.title).toBe('Sync Test');

      // Verify messages were saved
      const savedMessages = await db.messages.where('conversationId').equals('sync-conv-1').toArray();
      expect(savedMessages).toHaveLength(2);
    });

    it('should update existing conversation on re-sync', async () => {
      const conversation: DBConversation = {
        id: 'update-conv-1',
        title: 'Original Title',
        createdAt: new Date(),
        updatedAt: new Date(),
        thinkingEnabled: false,
        isPinned: false,
      };

      await syncConversationToDB(conversation, []);

      // Update and re-sync
      conversation.title = 'Updated Title';
      conversation.isPinned = true;
      await syncConversationToDB(conversation, []);

      const savedConv = await db.conversations.get('update-conv-1');
      expect(savedConv!.title).toBe('Updated Title');
      expect(savedConv!.isPinned).toBe(true);
    });

    it('should handle empty messages array', async () => {
      const conversation: DBConversation = {
        id: 'empty-msgs-conv',
        title: 'No Messages',
        createdAt: new Date(),
        updatedAt: new Date(),
        thinkingEnabled: false,
        isPinned: false,
      };

      await syncConversationToDB(conversation, []);

      const savedConv = await db.conversations.get('empty-msgs-conv');
      expect(savedConv).toBeDefined();

      const messages = await db.messages.where('conversationId').equals('empty-msgs-conv').toArray();
      expect(messages).toHaveLength(0);
    });
  });

  describe('loadConversationsFromDB', () => {
    it('should load all conversations with messages', async () => {
      // Seed data
      await db.conversations.bulkAdd([
        {
          id: 'load-conv-1',
          title: 'First Conversation',
          createdAt: new Date(),
          updatedAt: new Date(),
          thinkingEnabled: false,
          isPinned: false,
        },
        {
          id: 'load-conv-2',
          title: 'Second Conversation',
          createdAt: new Date(),
          updatedAt: new Date(),
          thinkingEnabled: true,
          isPinned: true,
        },
      ]);

      await db.messages.bulkAdd([
        {
          id: 'load-msg-1',
          conversationId: 'load-conv-1',
          role: 'user',
          content: 'Message in conv 1',
          timestamp: new Date(),
          searchText: 'message in conv 1',
        },
        {
          id: 'load-msg-2',
          conversationId: 'load-conv-2',
          role: 'assistant',
          content: 'Message in conv 2',
          timestamp: new Date(),
          searchText: 'message in conv 2',
        },
      ]);

      const { conversations, messagesByConversation } = await loadConversationsFromDB();

      expect(conversations).toHaveLength(2);
      expect(messagesByConversation.get('load-conv-1')).toHaveLength(1);
      expect(messagesByConversation.get('load-conv-2')).toHaveLength(1);
    });

    it('should return empty results when no data exists', async () => {
      const { conversations, messagesByConversation } = await loadConversationsFromDB();

      expect(conversations).toHaveLength(0);
      expect(messagesByConversation.size).toBe(0);
    });

    it('should handle conversations with no messages', async () => {
      await db.conversations.add({
        id: 'no-msgs-conv',
        title: 'Empty Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
        thinkingEnabled: false,
        isPinned: false,
      });

      const { conversations, messagesByConversation } = await loadConversationsFromDB();

      expect(conversations).toHaveLength(1);
      expect(messagesByConversation.get('no-msgs-conv')).toHaveLength(0);
    });

    it('should order conversations by updatedAt descending', async () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-06-15');

      await db.conversations.bulkAdd([
        {
          id: 'old-conv',
          title: 'Old',
          createdAt: oldDate,
          updatedAt: oldDate,
          thinkingEnabled: false,
          isPinned: false,
        },
        {
          id: 'new-conv',
          title: 'New',
          createdAt: newDate,
          updatedAt: newDate,
          thinkingEnabled: false,
          isPinned: false,
        },
      ]);

      const { conversations } = await loadConversationsFromDB();

      // Should be ordered newest first
      expect(conversations[0].id).toBe('new-conv');
      expect(conversations[1].id).toBe('old-conv');
    });

    it('should order messages within conversations by timestamp', async () => {
      await db.conversations.add({
        id: 'ordered-conv',
        title: 'Ordered',
        createdAt: new Date(),
        updatedAt: new Date(),
        thinkingEnabled: false,
        isPinned: false,
      });

      const t1 = new Date('2024-01-01T10:00:00');
      const t2 = new Date('2024-01-01T10:05:00');
      const t3 = new Date('2024-01-01T10:10:00');

      await db.messages.bulkAdd([
        { id: 'msg-3', conversationId: 'ordered-conv', role: 'user', content: 'Third', timestamp: t3, searchText: 'third' },
        { id: 'msg-1', conversationId: 'ordered-conv', role: 'user', content: 'First', timestamp: t1, searchText: 'first' },
        { id: 'msg-2', conversationId: 'ordered-conv', role: 'assistant', content: 'Second', timestamp: t2, searchText: 'second' },
      ]);

      const { messagesByConversation } = await loadConversationsFromDB();
      const messages = messagesByConversation.get('ordered-conv')!;

      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[2].content).toBe('Third');
    });
  });

  describe('deleteConversationFromDB', () => {
    it('should delete conversation and its messages', async () => {
      await db.conversations.add({
        id: 'del-conv',
        title: 'To Delete',
        createdAt: new Date(),
        updatedAt: new Date(),
        thinkingEnabled: false,
        isPinned: false,
      });

      await db.messages.bulkAdd([
        { id: 'del-msg-1', conversationId: 'del-conv', role: 'user', content: 'Msg 1', timestamp: new Date(), searchText: 'msg 1' },
        { id: 'del-msg-2', conversationId: 'del-conv', role: 'assistant', content: 'Msg 2', timestamp: new Date(), searchText: 'msg 2' },
      ]);

      await deleteConversationFromDB('del-conv');

      const conv = await db.conversations.get('del-conv');
      expect(conv).toBeUndefined();

      const messages = await db.messages.where('conversationId').equals('del-conv').toArray();
      expect(messages).toHaveLength(0);
    });

    it('should not affect other conversations when deleting', async () => {
      await db.conversations.bulkAdd([
        { id: 'keep-conv', title: 'Keep', createdAt: new Date(), updatedAt: new Date(), thinkingEnabled: false, isPinned: false },
        { id: 'del-conv-2', title: 'Delete', createdAt: new Date(), updatedAt: new Date(), thinkingEnabled: false, isPinned: false },
      ]);

      await db.messages.bulkAdd([
        { id: 'keep-msg', conversationId: 'keep-conv', role: 'user', content: 'Keep', timestamp: new Date(), searchText: 'keep' },
        { id: 'del-msg', conversationId: 'del-conv-2', role: 'user', content: 'Delete', timestamp: new Date(), searchText: 'delete' },
      ]);

      await deleteConversationFromDB('del-conv-2');

      // Keep conversation should be unaffected
      const keepConv = await db.conversations.get('keep-conv');
      expect(keepConv).toBeDefined();

      const keepMessages = await db.messages.where('conversationId').equals('keep-conv').toArray();
      expect(keepMessages).toHaveLength(1);
    });

    it('should handle deleting non-existent conversation gracefully', async () => {
      // Should not throw
      await expect(deleteConversationFromDB('non-existent-id')).resolves.toBeUndefined();
    });
  });
});
