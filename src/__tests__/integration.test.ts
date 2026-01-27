import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../stores/store';
import { db } from '../lib/db';
import { 
  persistConversation, 
  loadPersistedData, 
  deletePersistedConversation,
  persistMessage,
  searchPersistedMessages,
} from '../lib/persistence';

/**
 * Integration tests
 * Test interactions between store, persistence, and encryption
 */

// Mock Tauri keychain for encryption tests
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string) => {
    if (command === 'keychain_get') {
      throw new Error('Key not found'); // Simulate no existing key
    }
    if (command === 'keychain_set') {
      return Promise.resolve();
    }
    if (command === 'keychain_delete') {
      return Promise.resolve();
    }
    return Promise.reject(new Error('Unknown command'));
  }),
}));

describe('Integration Tests', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.conversations.clear();
    await db.messages.clear();
    
    // Reset store
    const store = useStore.getState();
    store.conversations.forEach(c => store.deleteConversation(c.id));
    store.setConnected(false);
  });

  describe('Store and Persistence Integration', () => {
    it('should persist conversation when created', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      // Wait for persistence to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify conversation was persisted
      const dbConversations = await db.conversations.toArray();
      expect(dbConversations).toHaveLength(1);
      expect(dbConversations[0].id).toBe(conversation.id);
    });

    it('should persist message when added', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'Hello, world!',
      });
      
      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dbMessages = await db.messages.toArray();
      expect(dbMessages).toHaveLength(1);
      expect(dbMessages[0].conversationId).toBe(conversation.id);
    });

    it('should delete persisted conversation when deleted from store', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      store.deleteConversation(conversation.id);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dbConversations = await db.conversations.toArray();
      expect(dbConversations).toHaveLength(0);
    });

    it('should update persisted conversation when title changes', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      store.updateConversation(conversation.id, { title: 'Updated Title' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dbConversations = await db.conversations.toArray();
      expect(dbConversations[0].title).toBeTruthy(); // Will be encrypted
    });
  });

  describe('Message Streaming Integration', () => {
    it('should handle streaming message updates', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      // Start streaming message
      store.addMessage(conversation.id, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });
      
      // Append content multiple times
      store.appendToCurrentMessage('Hello');
      store.appendToCurrentMessage(' ');
      store.appendToCurrentMessage('world');
      
      const currentConv = store.conversations[0];
      expect(currentConv.messages[0].content).toBe('Hello world');
      expect(currentConv.messages[0].isStreaming).toBe(true);
      
      // Complete streaming
      store.completeCurrentMessage();
      
      const updatedConv = store.conversations[0];
      expect(updatedConv.messages[0].isStreaming).toBe(false);
    });

    it('should persist streaming message updates with debouncing', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      store.addMessage(conversation.id, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });
      
      // Rapid updates (should be debounced)
      for (let i = 0; i < 10; i++) {
        store.appendToCurrentMessage('word ');
      }
      
      store.completeCurrentMessage();
      
      // Wait for final persistence
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const dbMessages = await db.messages.toArray();
      expect(dbMessages).toHaveLength(1);
    });
  });

  describe('Conversation Persistence Workflow', () => {
    it('should persist and load complete conversation', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      // Add multiple messages
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'What is TypeScript?',
      });
      
      store.addMessage(conversation.id, {
        role: 'assistant',
        content: 'TypeScript is a typed superset of JavaScript.',
      });
      
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'Thanks!',
      });
      
      // Wait for persistence
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify in database
      const dbMessages = await db.messages.toArray();
      expect(dbMessages).toHaveLength(3);
      
      // Load from database
      const loaded = await loadPersistedData();
      expect(loaded.conversations).toHaveLength(1);
      expect(loaded.conversations[0].messages).toHaveLength(3);
      expect(loaded.conversations[0].messages[0].content).toBe('What is TypeScript?');
    });

    it('should handle multiple conversations', async () => {
      const store = useStore.getState();
      
      const conv1 = store.createConversation();
      store.addMessage(conv1.id, { role: 'user', content: 'Message 1' });
      
      const conv2 = store.createConversation();
      store.addMessage(conv2.id, { role: 'user', content: 'Message 2' });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const loaded = await loadPersistedData();
      expect(loaded.conversations).toHaveLength(2);
    });
  });

  describe('Search Integration', () => {
    it('should search across conversations', async () => {
      const store = useStore.getState();
      
      const conv1 = store.createConversation();
      store.addMessage(conv1.id, { 
        role: 'user', 
        content: 'Tell me about quantum computing' 
      });
      
      const conv2 = store.createConversation();
      store.addMessage(conv2.id, { 
        role: 'user', 
        content: 'Explain TypeScript to me' 
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const results = await searchPersistedMessages('quantum');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('quantum');
    });

    it('should handle multi-word search queries', async () => {
      const store = useStore.getState();
      
      const conv = store.createConversation();
      store.addMessage(conv.id, { 
        role: 'assistant', 
        content: 'TypeScript is a strongly typed programming language' 
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const results = await searchPersistedMessages('strongly typed');
      expect(results).toHaveLength(1);
    });
  });

  describe('Encryption Integration', () => {
    it('should encrypt message content in database', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      const plaintext = 'Secret message content';
      store.addMessage(conversation.id, {
        role: 'user',
        content: plaintext,
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check database - content should be encrypted (not plaintext)
      const dbMessages = await db.messages.toArray();
      expect(dbMessages[0].content).not.toBe(plaintext);
      expect(dbMessages[0].content.length).toBeGreaterThan(plaintext.length);
      
      // But when loaded, it should decrypt correctly
      const loaded = await loadPersistedData();
      expect(loaded.conversations[0].messages[0].content).toBe(plaintext);
    });

    it('should encrypt conversation title', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      store.updateConversation(conversation.id, { 
        title: 'My Secret Project' 
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const dbConversations = await db.conversations.toArray();
      expect(dbConversations[0].title).not.toBe('My Secret Project');
      
      const loaded = await loadPersistedData();
      expect(loaded.conversations[0].title).toBe('My Secret Project');
    });
  });

  describe('Pin Conversation Integration', () => {
    it('should persist pin status', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      expect(conversation.isPinned).toBe(false);
      
      store.pinConversation(conversation.id);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const loaded = await loadPersistedData();
      expect(loaded.conversations[0].isPinned).toBe(true);
    });

    it('should toggle pin status', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      store.pinConversation(conversation.id);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      store.pinConversation(conversation.id);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const loaded = await loadPersistedData();
      expect(loaded.conversations[0].isPinned).toBe(false);
    });
  });

  describe('Auto-title Generation Integration', () => {
    it('should auto-generate title from first user message', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      expect(conversation.title).toBe('New Chat');
      
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'Tell me about quantum computing and its applications',
      });
      
      const updated = store.conversations[0];
      expect(updated.title).toBe('Tell me about quantum computing and...');
    });

    it('should not change title after first message', async () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'First message',
      });
      
      // Wait for store to update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const titleAfterFirst = store.conversations.find(c => c.id === conversation.id)?.title;
      
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'Second message that should not become title',
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const finalConv = store.conversations.find(c => c.id === conversation.id);
      expect(finalConv?.title).toBe(titleAfterFirst);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle persistence errors gracefully', async () => {
      const store = useStore.getState();
      
      // Create conversation
      const conversation = store.createConversation();
      
      // Wait for store to update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Even if persistence fails, store should still work
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'Test message',
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const conv = store.conversations.find(c => c.id === conversation.id);
      expect(conv?.messages).toHaveLength(1);
    });

    it('should handle corrupted data when loading', async () => {
      // Add corrupted data to database
      await db.messages.add({
        id: 'corrupt-1',
        conversationId: 'test-conv',
        role: 'user',
        content: 'not-valid-encrypted-data',
        timestamp: new Date(),
        searchText: 'test',
      });
      
      // Should not crash when loading
      const loaded = await loadPersistedData();
      expect(loaded).toBeDefined();
      expect(loaded.conversations).toBeDefined();
    });
  });
});
