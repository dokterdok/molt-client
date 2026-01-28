/**
 * Message Flow Tests
 * 
 * Tests the complete message lifecycle: creation, streaming updates,
 * completion with usage stats, deletion, and message editing (deleteMessagesAfter).
 * These are critical paths that ensure conversations work correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore, type TokenUsage } from '../stores/store';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string) => {
    if (command === 'keychain_get') return Promise.reject(new Error('Key not found'));
    if (command === 'keychain_set') return Promise.resolve();
    if (command === 'keychain_delete') return Promise.resolve();
    return Promise.resolve();
  }),
}));

describe('Message Flow', () => {
  beforeEach(() => {
    const store = useStore.getState();
    store.conversations.forEach(c => store.deleteConversation(c.id));
    store.setConnected(false);
  });

  describe('basic message lifecycle', () => {
    it('should create a user message with all required fields', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const message = store.addMessage(conv.id, {
        role: 'user',
        content: 'Hello, world!',
      });

      expect(message.id).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.isStreaming).toBeUndefined();
      expect(message.isPending).toBeUndefined();
    });

    it('should create an assistant message', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const message = store.addMessage(conv.id, {
        role: 'assistant',
        content: 'Hi! How can I help?',
        modelUsed: 'anthropic/claude-sonnet-4-5',
      });

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hi! How can I help?');
      expect(message.modelUsed).toBe('anthropic/claude-sonnet-4-5');
    });

    it('should create a pending user message', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const message = store.addMessage(conv.id, {
        role: 'user',
        content: 'Pending message',
        isPending: true,
      });

      expect(message.isPending).toBe(true);
    });

    it('should create a message with attachments', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const message = store.addMessage(conv.id, {
        role: 'user',
        content: 'Look at this image',
        attachments: [
          {
            id: 'attach-1',
            filename: 'image.png',
            mimeType: 'image/png',
            data: 'base64data...',
          },
        ],
      });

      expect(message.attachments).toHaveLength(1);
      expect(message.attachments![0].filename).toBe('image.png');
    });

    it('should create a message with sources', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const message = store.addMessage(conv.id, {
        role: 'assistant',
        content: 'Based on research...',
        sources: [
          { title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Test' },
          { title: 'MDN', url: 'https://developer.mozilla.org' },
        ],
      });

      expect(message.sources).toHaveLength(2);
      expect(message.sources![0].title).toBe('Wikipedia');
    });
  });

  describe('streaming message flow', () => {
    it('should create a streaming message with empty content', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const message = store.addMessage(conv.id, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      expect(message.isStreaming).toBe(true);
      expect(message.content).toBe('');
      expect(useStore.getState().currentStreamingMessageId).toBe(message.id);
    });

    it('should append content to streaming message', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      store.addMessage(conv.id, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      store.appendToCurrentMessage('Hello');
      store.appendToCurrentMessage(', ');
      store.appendToCurrentMessage('world');
      store.appendToCurrentMessage('!');

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages[0].content).toBe('Hello, world!');
    });

    it('should complete streaming message and clear streaming state', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      store.addMessage(conv.id, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      store.appendToCurrentMessage('Final content');
      store.completeCurrentMessage();

      expect(useStore.getState().currentStreamingMessageId).toBeNull();
      
      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages[0].isStreaming).toBe(false);
      expect(updatedConv.messages[0].content).toBe('Final content');
    });

    it('should complete streaming message with token usage', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      store.addMessage(conv.id, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      store.appendToCurrentMessage('Response with usage');

      const usage: TokenUsage = {
        input: 50,
        output: 120,
        totalTokens: 170,
      };
      store.completeCurrentMessage(usage);

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages[0].usage).toEqual(usage);
      expect(updatedConv.messages[0].usage!.input).toBe(50);
      expect(updatedConv.messages[0].usage!.output).toBe(120);
      expect(updatedConv.messages[0].usage!.totalTokens).toBe(170);
    });

    it('should handle appending to non-existent streaming message gracefully', () => {
      const store = useStore.getState();

      // No streaming message exists
      expect(useStore.getState().currentStreamingMessageId).toBeNull();

      // Should not throw
      store.appendToCurrentMessage('orphan content');

      // State should be unchanged
      expect(useStore.getState().currentStreamingMessageId).toBeNull();
    });

    it('should handle completing non-existent streaming message gracefully', () => {
      const store = useStore.getState();
      
      // No streaming message exists  
      expect(useStore.getState().currentStreamingMessageId).toBeNull();

      // Should not throw
      store.completeCurrentMessage({ input: 10, output: 20 });

      // State should be unchanged
      expect(useStore.getState().currentStreamingMessageId).toBeNull();
    });

    it('should simulate a full user-assistant exchange with streaming', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      // User sends message
      const userMsg = store.addMessage(conv.id, {
        role: 'user',
        content: 'What is 2+2?',
        isPending: true,
      });

      // Mark as sent
      store.markMessageSent(conv.id, userMsg.id);
      const afterSent = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(afterSent.messages[0].isPending).toBe(false);

      // Assistant starts streaming
      store.addMessage(conv.id, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      // Stream arrives in chunks
      store.appendToCurrentMessage('The answer');
      store.appendToCurrentMessage(' is ');
      store.appendToCurrentMessage('4.');

      // Stream completes with usage
      store.completeCurrentMessage({ input: 15, output: 8, totalTokens: 23 });

      // Verify final state
      const finalConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(finalConv.messages).toHaveLength(2);
      expect(finalConv.messages[0].role).toBe('user');
      expect(finalConv.messages[0].content).toBe('What is 2+2?');
      expect(finalConv.messages[0].isPending).toBe(false);
      expect(finalConv.messages[1].role).toBe('assistant');
      expect(finalConv.messages[1].content).toBe('The answer is 4.');
      expect(finalConv.messages[1].isStreaming).toBe(false);
      expect(finalConv.messages[1].usage!.totalTokens).toBe(23);
    });
  });

  describe('message deletion', () => {
    it('should delete a specific message', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const msg1 = store.addMessage(conv.id, { role: 'user', content: 'First' });
      store.addMessage(conv.id, { role: 'assistant', content: 'Second' });
      store.addMessage(conv.id, { role: 'user', content: 'Third' });

      store.deleteMessage(conv.id, msg1.id);

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages).toHaveLength(2);
      expect(updatedConv.messages[0].content).toBe('Second');
      expect(updatedConv.messages[1].content).toBe('Third');
    });

    it('should delete the last message in a conversation', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const msg = store.addMessage(conv.id, { role: 'user', content: 'Only message' });
      store.deleteMessage(conv.id, msg.id);

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages).toHaveLength(0);
    });

    it('should handle deleting a non-existent message gracefully', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      store.addMessage(conv.id, { role: 'user', content: 'Existing' });

      // Should not throw
      store.deleteMessage(conv.id, 'non-existent-id');

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages).toHaveLength(1);
    });
  });

  describe('deleteMessagesAfter (message editing flow)', () => {
    it('should delete all messages after a given message', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const msg1 = store.addMessage(conv.id, { role: 'user', content: 'First' });
      store.addMessage(conv.id, { role: 'assistant', content: 'Second' });
      store.addMessage(conv.id, { role: 'user', content: 'Third' });
      store.addMessage(conv.id, { role: 'assistant', content: 'Fourth' });

      store.deleteMessagesAfter(conv.id, msg1.id);

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages).toHaveLength(1);
      expect(updatedConv.messages[0].content).toBe('First');
    });

    it('should keep the target message and only delete subsequent ones', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      store.addMessage(conv.id, { role: 'user', content: 'Keep this' });
      const msg2 = store.addMessage(conv.id, { role: 'assistant', content: 'Also keep' });
      store.addMessage(conv.id, { role: 'user', content: 'Delete this' });
      store.addMessage(conv.id, { role: 'assistant', content: 'Delete this too' });

      store.deleteMessagesAfter(conv.id, msg2.id);

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages).toHaveLength(2);
      expect(updatedConv.messages[0].content).toBe('Keep this');
      expect(updatedConv.messages[1].content).toBe('Also keep');
    });

    it('should handle deleting after the last message (no-op)', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      store.addMessage(conv.id, { role: 'user', content: 'First' });
      store.addMessage(conv.id, { role: 'assistant', content: 'Second' });
      const lastMsg = store.addMessage(conv.id, { role: 'user', content: 'Last' });

      store.deleteMessagesAfter(conv.id, lastMsg.id);

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages).toHaveLength(3); // All messages kept
    });

    it('should handle non-existent message ID gracefully', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      store.addMessage(conv.id, { role: 'user', content: 'First' });
      store.addMessage(conv.id, { role: 'assistant', content: 'Second' });

      // Should not throw or change anything
      store.deleteMessagesAfter(conv.id, 'non-existent-id');

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages).toHaveLength(2);
    });

    it('should handle non-existent conversation ID gracefully', () => {
      // Should not throw
      const store = useStore.getState();
      store.deleteMessagesAfter('non-existent-conv', 'some-msg-id');
    });

    it('should simulate a full edit-and-regenerate flow', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      // Original conversation
      const userMsg1 = store.addMessage(conv.id, { role: 'user', content: 'Original question' });
      store.addMessage(conv.id, { role: 'assistant', content: 'Original answer' });
      store.addMessage(conv.id, { role: 'user', content: 'Follow up' });
      store.addMessage(conv.id, { role: 'assistant', content: 'Follow up answer' });

      // User edits the first message: delete everything after it
      store.deleteMessagesAfter(conv.id, userMsg1.id);

      // Update the message content
      store.updateMessage(conv.id, userMsg1.id, 'Edited question');

      // New assistant response starts streaming
      store.addMessage(conv.id, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      store.appendToCurrentMessage('New answer to edited question');
      store.completeCurrentMessage({ input: 30, output: 40, totalTokens: 70 });

      // Verify final state
      const finalConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(finalConv.messages).toHaveLength(2);
      expect(finalConv.messages[0].content).toBe('Edited question');
      expect(finalConv.messages[1].content).toBe('New answer to edited question');
      expect(finalConv.messages[1].usage!.totalTokens).toBe(70);
    });
  });

  describe('updateMessage', () => {
    it('should update a message content', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const msg = store.addMessage(conv.id, { role: 'user', content: 'Original' });
      store.updateMessage(conv.id, msg.id, 'Updated content');

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages[0].content).toBe('Updated content');
    });

    it('should update only the target message, not others', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      store.addMessage(conv.id, { role: 'user', content: 'First' });
      const msg2 = store.addMessage(conv.id, { role: 'assistant', content: 'Second' });
      store.addMessage(conv.id, { role: 'user', content: 'Third' });

      store.updateMessage(conv.id, msg2.id, 'Updated Second');

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages[0].content).toBe('First');
      expect(updatedConv.messages[1].content).toBe('Updated Second');
      expect(updatedConv.messages[2].content).toBe('Third');
    });

    it('should update the conversation updatedAt timestamp', () => {
      const store = useStore.getState();
      const conv = store.createConversation();
      const originalUpdatedAt = conv.updatedAt;

      const msg = store.addMessage(conv.id, { role: 'user', content: 'Test' });

      // Small delay to ensure timestamp difference
      const timeBefore = new Date();
      store.updateMessage(conv.id, msg.id, 'Updated');

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.updatedAt).toBeInstanceOf(Date);
      expect(updatedConv.updatedAt.getTime()).toBeGreaterThanOrEqual(timeBefore.getTime());
    });
  });

  describe('markMessageSent', () => {
    it('should mark a pending message as sent', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const msg = store.addMessage(conv.id, {
        role: 'user',
        content: 'Pending message',
        isPending: true,
      });

      expect(useStore.getState().conversations.find(c => c.id === conv.id)!.messages[0].isPending).toBe(true);

      store.markMessageSent(conv.id, msg.id);

      expect(useStore.getState().conversations.find(c => c.id === conv.id)!.messages[0].isPending).toBe(false);
    });

    it('should not affect other messages when marking one as sent', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const msg1 = store.addMessage(conv.id, { role: 'user', content: 'First', isPending: true });
      store.addMessage(conv.id, { role: 'user', content: 'Second', isPending: true });

      store.markMessageSent(conv.id, msg1.id);

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.messages[0].isPending).toBe(false);
      expect(updatedConv.messages[1].isPending).toBe(true);
    });
  });

  describe('multi-conversation message isolation', () => {
    it('should keep messages isolated between conversations', () => {
      const store = useStore.getState();
      const conv1 = store.createConversation();
      const conv2 = store.createConversation();

      store.addMessage(conv1.id, { role: 'user', content: 'Conv1 message' });
      store.addMessage(conv2.id, { role: 'user', content: 'Conv2 message' });

      const c1 = useStore.getState().conversations.find(c => c.id === conv1.id)!;
      const c2 = useStore.getState().conversations.find(c => c.id === conv2.id)!;

      expect(c1.messages).toHaveLength(1);
      expect(c1.messages[0].content).toBe('Conv1 message');
      expect(c2.messages).toHaveLength(1);
      expect(c2.messages[0].content).toBe('Conv2 message');
    });

    it('should not affect other conversations when deleting messages', () => {
      const store = useStore.getState();
      const conv1 = store.createConversation();
      const conv2 = store.createConversation();

      const msg1 = store.addMessage(conv1.id, { role: 'user', content: 'Conv1' });
      store.addMessage(conv2.id, { role: 'user', content: 'Conv2' });

      store.deleteMessage(conv1.id, msg1.id);

      const c1 = useStore.getState().conversations.find(c => c.id === conv1.id)!;
      const c2 = useStore.getState().conversations.find(c => c.id === conv2.id)!;

      expect(c1.messages).toHaveLength(0);
      expect(c2.messages).toHaveLength(1);
    });

    it('should not affect other conversations with streaming', () => {
      const store = useStore.getState();
      const conv1 = store.createConversation();
      const conv2 = store.createConversation();

      // Add messages to conv2
      store.addMessage(conv2.id, { role: 'user', content: 'Conv2 stable' });

      // Stream in conv1
      store.selectConversation(conv1.id);
      store.addMessage(conv1.id, { role: 'assistant', content: '', isStreaming: true });
      store.appendToCurrentMessage('Streaming in conv1');
      store.completeCurrentMessage();

      // Conv2 should be unaffected
      const c2 = useStore.getState().conversations.find(c => c.id === conv2.id)!;
      expect(c2.messages).toHaveLength(1);
      expect(c2.messages[0].content).toBe('Conv2 stable');
    });
  });

  describe('title auto-generation', () => {
    it('should auto-generate title from first user message', () => {
      const store = useStore.getState();
      const conv = store.createConversation();
      expect(conv.title).toBe('New Chat');

      store.addMessage(conv.id, { role: 'user', content: 'Tell me about AI' });

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.title).toBe('Tell me about AI');
    });

    it('should not change title when assistant responds first', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      store.addMessage(conv.id, { role: 'assistant', content: 'System message' });

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.title).toBe('New Chat');
    });

    it('should truncate long titles to 40 chars + ellipsis', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const longMessage = 'A'.repeat(100);
      store.addMessage(conv.id, { role: 'user', content: longMessage });

      const updatedConv = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(updatedConv.title).toBe('A'.repeat(40) + '...');
      expect(updatedConv.title.length).toBe(43);
    });

    it('should not change title after first user message', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      store.addMessage(conv.id, { role: 'user', content: 'First message' });
      const titleAfterFirst = useStore.getState().conversations.find(c => c.id === conv.id)!.title;

      store.addMessage(conv.id, { role: 'assistant', content: 'Response' });
      store.addMessage(conv.id, { role: 'user', content: 'Second message that should not change title' });

      const finalTitle = useStore.getState().conversations.find(c => c.id === conv.id)!.title;
      expect(finalTitle).toBe(titleAfterFirst);
    });
  });

  describe('thinking content', () => {
    it('should preserve thinking content in messages', () => {
      const store = useStore.getState();
      const conv = store.createConversation();

      const msg = store.addMessage(conv.id, {
        role: 'assistant',
        content: 'The answer is 42.',
        thinkingContent: 'Let me think step by step... First, I need to...',
        modelUsed: 'anthropic/claude-opus-4-5',
      });

      expect(msg.thinkingContent).toBe('Let me think step by step... First, I need to...');
      
      const conv2 = useStore.getState().conversations.find(c => c.id === conv.id)!;
      expect(conv2.messages[0].thinkingContent).toBe('Let me think step by step... First, I need to...');
    });
  });
});
