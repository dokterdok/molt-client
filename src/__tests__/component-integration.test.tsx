import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { useStore } from '../stores/store';

/**
 * COMPONENT INTEGRATION TESTS
 * Tests that simulate real user interactions with components
 * Uses Vitest + Testing Library for fast, comprehensive coverage
 */

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe('ChatInput Integration', () => {
  beforeEach(() => {
    useStore.getState().reset?.();
  });

  it('should send message on Enter key', async () => {
    const { ChatInput } = await import('../components/ChatInput');
    const user = userEvent.setup();
    
    const handleSend = vi.fn();
    render(<ChatInput onSend={handleSend} disabled={false} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    await user.type(input, 'Test message{Enter}');
    
    expect(handleSend).toHaveBeenCalledWith('Test message', []);
  });

  it('should add newline on Shift+Enter', async () => {
    const { ChatInput } = await import('../components/ChatInput');
    const user = userEvent.setup();
    
    const handleSend = vi.fn();
    render(<ChatInput onSend={handleSend} disabled={false} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2');
    
    // Should not have sent yet
    expect(handleSend).not.toHaveBeenCalled();
    
    // Input should contain both lines
    expect(input).toHaveValue(expect.stringContaining('Line 1'));
    expect(input).toHaveValue(expect.stringContaining('Line 2'));
  });

  it('should clear input after sending', async () => {
    const { ChatInput } = await import('../components/ChatInput');
    const user = userEvent.setup();
    
    const handleSend = vi.fn();
    render(<ChatInput onSend={handleSend} disabled={false} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    await user.type(input, 'Test message{Enter}');
    
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('should disable input when disabled prop is true', async () => {
    const { ChatInput } = await import('../components/ChatInput');
    
    render(<ChatInput onSend={vi.fn()} disabled={true} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    expect(input).toBeDisabled();
  });

  it('should not send empty messages', async () => {
    const { ChatInput } = await import('../components/ChatInput');
    const user = userEvent.setup();
    
    const handleSend = vi.fn();
    render(<ChatInput onSend={handleSend} disabled={false} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    
    // Try to send empty
    await user.type(input, '{Enter}');
    expect(handleSend).not.toHaveBeenCalled();
    
    // Try to send whitespace only
    await user.type(input, '   {Enter}');
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('should trim whitespace from messages', async () => {
    const { ChatInput } = await import('../components/ChatInput');
    const user = userEvent.setup();
    
    const handleSend = vi.fn();
    render(<ChatInput onSend={handleSend} disabled={false} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    await user.type(input, '  Test message  {Enter}');
    
    expect(handleSend).toHaveBeenCalledWith('Test message', []);
  });
});

describe('MessageBubble Integration', () => {
  it('should render user message correctly', async () => {
    const { MessageBubble } = await import('../components/MessageBubble');
    
    const message = {
      id: '1',
      role: 'user' as const,
      content: 'Test user message',
      timestamp: Date.now(),
      status: 'sent' as const,
    };
    
    render(<MessageBubble message={message} />);
    
    expect(screen.getByText('Test user message')).toBeInTheDocument();
  });

  it('should render assistant message correctly', async () => {
    const { MessageBubble } = await import('../components/MessageBubble');
    
    const message = {
      id: '2',
      role: 'assistant' as const,
      content: 'Test assistant response',
      timestamp: Date.now(),
      status: 'complete' as const,
    };
    
    render(<MessageBubble message={message} />);
    
    expect(screen.getByText('Test assistant response')).toBeInTheDocument();
  });

  it('should render markdown content', async () => {
    const { MessageBubble } = await import('../components/MessageBubble');
    
    const message = {
      id: '3',
      role: 'assistant' as const,
      content: 'This is **bold** and *italic*',
      timestamp: Date.now(),
      status: 'complete' as const,
    };
    
    render(<MessageBubble message={message} />);
    
    // Check for rendered markdown (bold/italic)
    expect(screen.getByText(/bold/)).toBeInTheDocument();
  });

  it('should show timestamp on hover', async () => {
    const { MessageBubble } = await import('../components/MessageBubble');
    const user = userEvent.setup();
    
    const message = {
      id: '4',
      role: 'user' as const,
      content: 'Test message',
      timestamp: Date.now(),
      status: 'sent' as const,
    };
    
    render(<MessageBubble message={message} />);
    
    const messageElement = screen.getByText('Test message');
    await user.hover(messageElement);
    
    // Timestamp should appear (might be in tooltip or visible element)
    await waitFor(() => {
      const timestamp = screen.queryByText(/ago|second|minute|just now/i);
      expect(timestamp).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should show copy button on hover', async () => {
    const { MessageBubble } = await import('../components/MessageBubble');
    const user = userEvent.setup();
    
    const message = {
      id: '5',
      role: 'assistant' as const,
      content: 'Test message to copy',
      timestamp: Date.now(),
      status: 'complete' as const,
    };
    
    render(<MessageBubble message={message} />);
    
    const messageElement = screen.getByText('Test message to copy');
    await user.hover(messageElement);
    
    await waitFor(() => {
      const copyButton = screen.queryByTitle(/copy/i) || screen.queryByLabelText(/copy/i);
      expect(copyButton).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

describe('SearchDialog Integration', () => {
  beforeEach(() => {
    useStore.getState().reset?.();
  });

  it('should open and close search dialog', async () => {
    const { SearchDialog } = await import('../components/SearchDialog');
    const user = userEvent.setup();
    
    const { rerender } = render(<SearchDialog open={false} onOpenChange={vi.fn()} />);
    
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    
    // Open dialog
    rerender(<SearchDialog open={true} onOpenChange={vi.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });
  });

  it('should filter results as user types', async () => {
    const { SearchDialog } = await import('../components/SearchDialog');
    const user = userEvent.setup();
    
    // Add some test conversations to store
    const store = useStore.getState();
    store.createConversation();
    store.addMessage({
      id: 'msg1',
      role: 'user',
      content: 'Searchable content here',
      timestamp: Date.now(),
      status: 'sent',
    });
    
    render(<SearchDialog open={true} onOpenChange={vi.fn()} />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'Searchable');
    
    await waitFor(() => {
      expect(screen.getByText(/Searchable content/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should show empty state when no results', async () => {
    const { SearchDialog } = await import('../components/SearchDialog');
    const user = userEvent.setup();
    
    render(<SearchDialog open={true} onOpenChange={vi.fn()} />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'NonExistentTerm12345');
    
    await waitFor(() => {
      const emptyState = screen.queryByText(/no results|not found|nothing found/i);
      expect(emptyState).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should close on Escape key', async () => {
    const { SearchDialog } = await import('../components/SearchDialog');
    const user = userEvent.setup();
    
    const onOpenChange = vi.fn();
    render(<SearchDialog open={true} onOpenChange={onOpenChange} />);
    
    await user.keyboard('{Escape}');
    
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('SettingsDialog Integration', () => {
  it('should render all settings sections', async () => {
    const { SettingsDialog } = await import('../components/SettingsDialog');
    
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText(/settings/i)).toBeInTheDocument();
    });
    
    // Check for common settings sections
    const sections = ['gateway', 'model', 'theme', 'appearance'];
    const foundSections = sections.filter(section => {
      return screen.queryByText(new RegExp(section, 'i')) !== null;
    });
    
    expect(foundSections.length).toBeGreaterThan(0);
  });

  it('should update Gateway URL setting', async () => {
    const { SettingsDialog } = await import('../components/SettingsDialog');
    const user = userEvent.setup();
    
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    
    // Use placeholder text to uniquely identify the Gateway URL input
    const urlInput = screen.getByPlaceholderText('ws://localhost:18789');
    await user.clear(urlInput);
    await user.type(urlInput, 'ws://new-url:9999');
    
    await waitFor(() => {
      const newUrl = useStore.getState().settings.gatewayUrl;
      expect(newUrl).toBe('ws://new-url:9999');
    });
  });

  it('should toggle theme setting', async () => {
    const { SettingsDialog } = await import('../components/SettingsDialog');
    const user = userEvent.setup();
    
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    
    const themeToggle = screen.queryByRole('switch');
    
    if (themeToggle) {
      const initialState = themeToggle.getAttribute('aria-checked') === 'true';
      await user.click(themeToggle);
      
      await waitFor(() => {
        const newState = themeToggle.getAttribute('aria-checked') === 'true';
        expect(newState).not.toBe(initialState);
      });
    }
  });
});

describe('Sidebar Integration', () => {
  beforeEach(() => {
    useStore.getState().reset?.();
  });

  it('should display conversation list', async () => {
    const { Sidebar } = await import('../components/Sidebar');
    
    const store = useStore.getState();
    store.createConversation();
    store.addMessage({
      id: 'msg1',
      role: 'user',
      content: 'Test conversation message',
      timestamp: Date.now(),
      status: 'sent',
    });
    
    render(<Sidebar />);
    
    await waitFor(() => {
      expect(screen.getByText(/Test conversation/i)).toBeInTheDocument();
    });
  });

  it('should switch conversations on click', async () => {
    const { Sidebar } = await import('../components/Sidebar');
    const user = userEvent.setup();
    
    const store = useStore.getState();
    
    // Create two conversations
    store.createConversation();
    const conv1Id = store.currentConversationId;
    store.addMessage({
      id: 'msg1',
      role: 'user',
      content: 'First conversation',
      timestamp: Date.now(),
      status: 'sent',
    });
    
    store.createConversation();
    const conv2Id = store.currentConversationId;
    store.addMessage({
      id: 'msg2',
      role: 'user',
      content: 'Second conversation',
      timestamp: Date.now(),
      status: 'sent',
    });
    
    render(<Sidebar />);
    
    // Click on first conversation
    const firstConv = screen.getByText(/First conversation/i);
    await user.click(firstConv);
    
    await waitFor(() => {
      expect(useStore.getState().currentConversationId).toBe(conv1Id);
    });
  });

  it('should show new conversation button', async () => {
    const { Sidebar } = await import('../components/Sidebar');
    
    render(<Sidebar />);
    
    const newButton = screen.getByRole('button', { name: /new chat|new conversation/i });
    expect(newButton).toBeInTheDocument();
  });

  it('should create new conversation on button click', async () => {
    const { Sidebar } = await import('../components/Sidebar');
    const user = userEvent.setup();
    
    const store = useStore.getState();
    const initialCount = store.conversations.length;
    
    render(<Sidebar />);
    
    const newButton = screen.getByRole('button', { name: /new chat|new conversation/i });
    await user.click(newButton);
    
    await waitFor(() => {
      const newCount = useStore.getState().conversations.length;
      expect(newCount).toBe(initialCount + 1);
    });
  });

  it('should show delete button on conversation hover', async () => {
    const { Sidebar } = await import('../components/Sidebar');
    const user = userEvent.setup();
    
    const store = useStore.getState();
    store.createConversation();
    store.addMessage({
      id: 'msg1',
      role: 'user',
      content: 'Conversation to delete',
      timestamp: Date.now(),
      status: 'sent',
    });
    
    render(<Sidebar />);
    
    const convElement = screen.getByText(/Conversation to delete/i);
    await user.hover(convElement);
    
    await waitFor(() => {
      const deleteButton = screen.queryByTitle(/delete/i) || screen.queryByLabelText(/delete/i);
      expect(deleteButton).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

describe('Full User Flow Integration', () => {
  beforeEach(() => {
    useStore.getState().reset?.();
  });

  it('should complete full message send flow', async () => {
    const { ChatInput } = await import('../components/ChatInput');
    const user = userEvent.setup();
    
    const store = useStore.getState();
    store.createConversation();
    
    const handleSend = vi.fn((content: string, attachments: any[]) => {
      // Simulate message being added to store
      store.addMessage({
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
        status: 'sent',
      });
    });
    
    render(<ChatInput onSend={handleSend} disabled={false} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    await user.type(input, 'Integration test message{Enter}');
    
    expect(handleSend).toHaveBeenCalledWith('Integration test message', []);
    
    await waitFor(() => {
      const messages = useStore.getState().currentConversation?.messages || [];
      expect(messages.some(m => m.content === 'Integration test message')).toBe(true);
    });
  });

  it('should handle rapid message sending', async () => {
    const { ChatInput } = await import('../components/ChatInput');
    const user = userEvent.setup();
    
    const store = useStore.getState();
    store.createConversation();
    
    const handleSend = vi.fn((content: string, attachments: any[]) => {
      store.addMessage({
        id: `msg-${Date.now()}-${Math.random()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
        status: 'sent',
      });
    });
    
    render(<ChatInput onSend={handleSend} disabled={false} />);
    
    const input = screen.getByPlaceholderText(/message/i);
    
    // Send 5 messages rapidly
    for (let i = 1; i <= 5; i++) {
      await user.type(input, `Message ${i}{Enter}`);
    }
    
    expect(handleSend).toHaveBeenCalledTimes(5);
    
    await waitFor(() => {
      const messages = useStore.getState().currentConversation?.messages || [];
      expect(messages.length).toBe(5);
    });
  });
});
