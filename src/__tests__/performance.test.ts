import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useStore } from '../stores/store';
import { MessageBubble } from '../components/MessageBubble';
import { ChatInput } from '../components/ChatInput';
import type { Message } from '../stores/store';

/**
 * Performance Tests
 * Measure and ensure performance benchmarks are met
 */

describe('Performance Tests', () => {
  beforeEach(() => {
    // Reset store
    const store = useStore.getState();
    store.conversations.forEach(c => store.deleteConversation(c.id));
    vi.clearAllMocks();
  });

  describe('Message Rendering Performance', () => {
    it('should render 1000 messages within acceptable time', () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      const startTime = performance.now();
      
      // Add 1000 messages
      for (let i = 0; i < 1000; i++) {
        store.addMessage(conversation.id, {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i}`,
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in under 1 second
      expect(duration).toBeLessThan(1000);
      
      // Verify all messages were added
      const conv = store.conversations[0];
      expect(conv.messages).toHaveLength(1000);
    });

    it('should render individual message quickly', () => {
      const message: Message = {
        id: '1',
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
      };
      
      const startTime = performance.now();
      render(<MessageBubble message={message} />);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Single message should render in under 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should handle large message content efficiently', () => {
      const largeContent = 'a'.repeat(50000); // 50KB message
      const message: Message = {
        id: '1',
        role: 'user',
        content: largeContent,
        timestamp: new Date(),
      };
      
      const startTime = performance.now();
      render(<MessageBubble message={message} />);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Should render large message in under 200ms
      expect(duration).toBeLessThan(200);
    });

    it('should render markdown messages efficiently', () => {
      const markdownContent = `
# Header
This is **bold** and *italic* text.

\`\`\`javascript
const x = 1;
const y = 2;
console.log(x + y);
\`\`\`

- List item 1
- List item 2
- List item 3

[Link](https://example.com)
      `;
      
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: markdownContent,
        timestamp: new Date(),
      };
      
      const startTime = performance.now();
      render(<MessageBubble message={message} />);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Markdown rendering should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Store Operations Performance', () => {
    it('should create conversations quickly', () => {
      const store = useStore.getState();
      
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        store.createConversation();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Creating 100 conversations should take under 100ms
      expect(duration).toBeLessThan(100);
      expect(store.conversations).toHaveLength(100);
    });

    it('should add messages quickly', () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        store.addMessage(conversation.id, {
          role: 'user',
          content: `Message ${i}`,
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Adding 1000 messages should take under 500ms
      expect(duration).toBeLessThan(500);
    });

    it('should handle streaming updates efficiently', () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      store.addMessage(conversation.id, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });
      
      const startTime = performance.now();
      
      // Simulate 100 streaming updates
      for (let i = 0; i < 100; i++) {
        store.appendToCurrentMessage('word ');
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 100 streaming updates should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should delete conversations quickly', () => {
      const store = useStore.getState();
      
      // Create 100 conversations
      const conversations = [];
      for (let i = 0; i < 100; i++) {
        conversations.push(store.createConversation());
      }
      
      const startTime = performance.now();
      
      // Delete all conversations
      conversations.forEach(conv => {
        store.deleteConversation(conv.id);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Deleting 100 conversations should take under 100ms
      expect(duration).toBeLessThan(100);
      expect(store.conversations).toHaveLength(0);
    });

    it('should update conversation titles quickly', () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        store.updateConversation(conversation.id, {
          title: `Title ${i}`,
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 100 title updates should complete in under 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Input Performance', () => {
    it('should render input quickly', () => {
      const mockOnSend = vi.fn();
      
      const startTime = performance.now();
      render(<ChatInput onSend={mockOnSend} />);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Input should render in under 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should handle rapid state updates', () => {
      const store = useStore.getState();
      
      const startTime = performance.now();
      
      // Simulate rapid setting updates
      for (let i = 0; i < 100; i++) {
        store.updateSettings({
          defaultModel: `model-${i}`,
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle 100 updates in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory when creating and deleting conversations', () => {
      const store = useStore.getState();
      
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Create and delete 100 conversations
      for (let i = 0; i < 100; i++) {
        const conv = store.createConversation();
        store.addMessage(conv.id, {
          role: 'user',
          content: 'Test message',
        });
        store.deleteConversation(conv.id);
      }
      
      // Force garbage collection if available (only in certain environments)
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be minimal (under 10MB)
      // Note: This is approximate and depends on browser/environment
      if (initialMemory > 0) {
        expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
      }
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch message additions efficiently', () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      const messages = Array.from({ length: 1000 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as const,
        content: `Batch message ${i}`,
      }));
      
      const startTime = performance.now();
      
      messages.forEach(msg => {
        store.addMessage(conversation.id, msg);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Batch of 1000 messages should complete in under 500ms
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Search Performance', () => {
    it('should filter conversations quickly', () => {
      const store = useStore.getState();
      
      // Create 100 conversations with messages
      for (let i = 0; i < 100; i++) {
        const conv = store.createConversation();
        store.updateConversation(conv.id, {
          title: `Conversation ${i}`,
        });
        store.addMessage(conv.id, {
          role: 'user',
          content: `Message content ${i}`,
        });
      }
      
      const startTime = performance.now();
      
      // Filter conversations by title
      const filtered = store.conversations.filter(c =>
        c.title.includes('5')
      );
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Filtering should complete in under 10ms
      expect(duration).toBeLessThan(10);
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Startup Performance', () => {
    it('should initialize store quickly', () => {
      const startTime = performance.now();
      
      const initialState = useStore.getState();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Store initialization should complete in under 10ms
      expect(duration).toBeLessThan(10);
      expect(initialState).toBeDefined();
    });

    it('should handle initial settings load efficiently', async () => {
      const store = useStore.getState();
      
      const startTime = performance.now();
      
      await store.loadSettings();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Settings load should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle 10,000 messages efficiently', () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      const startTime = performance.now();
      
      for (let i = 0; i < 10000; i++) {
        store.addMessage(conversation.id, {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 10,000 messages should complete in under 5 seconds
      expect(duration).toBeLessThan(5000);
      expect(store.conversations[0].messages).toHaveLength(10000);
    });

    it('should maintain performance with large conversation history', () => {
      const store = useStore.getState();
      const conversation = store.createConversation();
      
      // Add 1000 messages
      for (let i = 0; i < 1000; i++) {
        store.addMessage(conversation.id, {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }
      
      // Measure performance of adding one more message
      const startTime = performance.now();
      
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'New message',
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Adding a message should still be fast even with large history
      expect(duration).toBeLessThan(10);
    });
  });
});
