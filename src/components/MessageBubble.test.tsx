import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../stores/store';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render user message', () => {
      const message: Message = {
        id: '1',
        role: 'user',
        content: 'Hello, Molt!',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Hello, Molt!')).toBeInTheDocument();
    });

    it('should render assistant message', () => {
      const message: Message = {
        id: '2',
        role: 'assistant',
        content: 'Hello! How can I help you?',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByText('Molt')).toBeInTheDocument();
      expect(screen.getByText(/Hello! How can I help you?/)).toBeInTheDocument();
    });

    it('should show correct avatar for user', () => {
      const message: Message = {
        id: '1',
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
      };

      const { container } = render(<MessageBubble message={message} />);
      
      // User avatar should have User icon
      const avatar = container.querySelector('.from-blue-500');
      expect(avatar).toBeInTheDocument();
    });

    it('should show correct avatar for assistant', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'Test',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      // Assistant avatar should have lobster emoji
      expect(screen.getByText('🦞')).toBeInTheDocument();
    });
  });

  describe('timestamp', () => {
    it('should show timestamp on hover', async () => {
      const message: Message = {
        id: '1',
        role: 'user',
        content: 'Test',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      };

      const { container } = render(<MessageBubble message={message} />);
      
      const messageContainer = container.querySelector('.group');
      expect(messageContainer).toBeInTheDocument();
      
      // Timestamp should be initially invisible
      const timestamp = screen.getByText(/5 minutes ago/);
      expect(timestamp).toHaveClass('opacity-0');
      
      // Hover should make it visible
      fireEvent.mouseEnter(messageContainer!);
      expect(timestamp).toHaveClass('opacity-100');
      
      // Mouse leave should hide it again
      fireEvent.mouseLeave(messageContainer!);
      expect(timestamp).toHaveClass('opacity-0');
    });
  });

  describe('markdown rendering', () => {
    it('should render bold text', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'This is **bold** text',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      const boldText = screen.getByText('bold');
      expect(boldText.tagName).toBe('STRONG');
    });

    it('should render inline code', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'Use `console.log()` to print',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      const code = screen.getByText('console.log()');
      expect(code.tagName).toBe('CODE');
    });

    it('should render code blocks with syntax highlighting', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: '```javascript\nconst x = 1;\nconsole.log(x);\n```',
        timestamp: new Date(),
      };

      const { container } = render(<MessageBubble message={message} />);
      
      expect(screen.getByText('javascript')).toBeInTheDocument();
      expect(container.querySelector('pre')).toBeInTheDocument();
      expect(container.querySelector('code')).toBeInTheDocument();
    });

    it('should render links with target blank', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'Check out [this link](https://example.com)',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      const link = screen.getByRole('link', { name: /this link/i });
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render lists', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: '- Item 1\n- Item 2\n- Item 3',
        timestamp: new Date(),
      };

      const { container } = render(<MessageBubble message={message} />);
      
      const list = container.querySelector('ul');
      expect(list).toBeInTheDocument();
      expect(list?.children.length).toBe(3);
    });
  });

  describe('streaming', () => {
    it('should show typing indicator when streaming without content', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByText(/Molt is typing.../i)).toBeInTheDocument();
    });

    it('should show streaming cursor when streaming with content', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'Hello, I am typing...',
        timestamp: new Date(),
        isStreaming: true,
      };

      const { container } = render(<MessageBubble message={message} />);
      
      const cursor = container.querySelector('.animate-pulse');
      expect(cursor).toBeInTheDocument();
    });

    it('should not show actions when streaming', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'Streaming...',
        timestamp: new Date(),
        isStreaming: true,
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.queryByTitle('Copy message')).not.toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('should copy message content when copy button is clicked', async () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'Copy me!',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      const copyButton = screen.getByTitle('Copy message');
      fireEvent.click(copyButton);
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copy me!');
      });
    });

    it('should copy code block when copy code button is clicked', async () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: '```js\nconst x = 1;\n```',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      const copyButton = screen.getByLabelText(/Copy code to clipboard/i);
      fireEvent.click(copyButton);
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const x = 1;');
      });
    });

    it('should show "Copied!" feedback after copying code', async () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: '```python\nprint("hello")\n```',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      const copyButton = screen.getByLabelText(/Copy code to clipboard/i);
      fireEvent.click(copyButton);
      
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });
  });

  describe('sources display', () => {
    it('should render sources when present', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'Here is some information',
        timestamp: new Date(),
        sources: [
          { title: 'Source 1', url: 'https://example.com/1' },
          { title: 'Source 2', url: 'https://example.com/2' },
        ],
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByText('Sources')).toBeInTheDocument();
      expect(screen.getByText('Source 1')).toBeInTheDocument();
      expect(screen.getByText('Source 2')).toBeInTheDocument();
      
      const link1 = screen.getByText('Source 1').closest('a');
      expect(link1).toHaveAttribute('href', 'https://example.com/1');
    });

    it('should not render sources section when no sources', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'No sources here',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.queryByText('Sources')).not.toBeInTheDocument();
    });
  });

  describe('model badge', () => {
    it('should show model name when present', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'Test',
        timestamp: new Date(),
        modelUsed: 'anthropic/claude-sonnet-4-5',
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByText('claude-sonnet-4-5')).toBeInTheDocument();
    });

    it('should not show model badge when not present', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'Test',
        timestamp: new Date(),
      };

      const { container } = render(<MessageBubble message={message} />);
      
      expect(container.querySelector('.text-muted-foreground')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      const message: Message = {
        id: '1',
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'Message from You');
    });

    it('should have accessible copy button', () => {
      const message: Message = {
        id: '1',
        role: 'assistant',
        content: 'Test',
        timestamp: new Date(),
      };

      render(<MessageBubble message={message} />);
      
      const copyButton = screen.getByLabelText('Copy message to clipboard');
      expect(copyButton).toBeInTheDocument();
    });
  });
});
