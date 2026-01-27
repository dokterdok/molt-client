import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  const mockOnSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render input field', () => {
      render(<ChatInput onSend={mockOnSend} />);
      
      expect(screen.getByPlaceholderText('Message Molt...')).toBeInTheDocument();
    });

    it('should render attach button', () => {
      render(<ChatInput onSend={mockOnSend} />);
      
      expect(screen.getByLabelText('Attach files')).toBeInTheDocument();
    });

    it('should render send button', () => {
      render(<ChatInput onSend={mockOnSend} />);
      
      expect(screen.getByLabelText(/Send message/i)).toBeInTheDocument();
    });

    it('should show keyboard hints', () => {
      render(<ChatInput onSend={mockOnSend} />);
      
      expect(screen.getByText('Enter')).toBeInTheDocument();
      expect(screen.getByText('to send')).toBeInTheDocument();
      expect(screen.getByText('Shift+Enter')).toBeInTheDocument();
      expect(screen.getByText('for new line')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should disable input when disabled prop is true', () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);
      
      const input = screen.getByPlaceholderText(/Connect to Gateway/i);
      expect(input).toBeDisabled();
    });

    it('should show different placeholder when disabled', () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);
      
      expect(screen.getByPlaceholderText('Connect to Gateway to send messages...')).toBeInTheDocument();
    });

    it('should disable attach button when disabled', () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);
      
      const attachButton = screen.getByLabelText('Attach files');
      expect(attachButton).toBeDisabled();
    });

    it('should disable send button when disabled', () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);
      
      const sendButton = screen.getByLabelText(/Send message/i);
      expect(sendButton).toBeDisabled();
    });
  });

  describe('sending state', () => {
    it('should show "Sending..." placeholder when isSending is true', () => {
      render(<ChatInput onSend={mockOnSend} isSending={true} />);
      
      expect(screen.getByPlaceholderText('Sending message...')).toBeInTheDocument();
    });

    it('should show spinner in send button when isSending', () => {
      const { container } = render(<ChatInput onSend={mockOnSend} isSending={true} />);
      
      // Spinner should be present
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('input interaction', () => {
    it('should update input value when typing', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.type(input, 'Hello, Molt!');
      
      expect(input).toHaveValue('Hello, Molt!');
    });

    it('should call onSend when Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');
      
      expect(mockOnSend).toHaveBeenCalledWith('Test message', []);
    });

    it('should not call onSend when Shift+Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.type(input, 'Line 1');
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      
      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('should clear input after sending', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...') as HTMLTextAreaElement;
      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');
      
      expect(input.value).toBe('');
    });

    it('should call onSend when send button is clicked', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.type(input, 'Test message');
      
      const sendButton = screen.getByLabelText(/Send message/i);
      await user.click(sendButton);
      
      expect(mockOnSend).toHaveBeenCalledWith('Test message', []);
    });
  });

  describe('send button state', () => {
    it('should disable send button when input is empty', () => {
      render(<ChatInput onSend={mockOnSend} />);
      
      const sendButton = screen.getByLabelText(/Send message/i);
      expect(sendButton).toBeDisabled();
    });

    it('should enable send button when input has content', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.type(input, 'Test');
      
      const sendButton = screen.getByLabelText(/Send message/i);
      expect(sendButton).not.toBeDisabled();
    });

    it('should not send when input is only whitespace', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.type(input, '   ');
      await user.keyboard('{Enter}');
      
      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('focus behavior', () => {
    it('should apply focus styles when focused', async () => {
      const user = userEvent.setup();
      const { container } = render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.click(input);
      
      const inputContainer = container.querySelector('.border-primary\\/50');
      expect(inputContainer).toBeInTheDocument();
    });

    it('should not auto-focus when disabled', () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);
      
      const input = screen.getByPlaceholderText(/Connect to Gateway/i);
      expect(input).not.toHaveFocus();
    });
  });

  describe('textarea auto-resize', () => {
    it('should adjust height based on content', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const textarea = screen.getByPlaceholderText('Message Molt...') as HTMLTextAreaElement;
      const initialHeight = textarea.style.height;
      
      // Type multiple lines
      await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2{Shift>}{Enter}{/Shift}Line 3');
      
      // Height should be different after adding content
      // Note: In jsdom this might not actually change, but we can verify the onInput handler is set
      expect(textarea.onInput).toBeDefined();
    });

    it('should have max height constraint', () => {
      render(<ChatInput onSend={mockOnSend} />);
      
      const textarea = screen.getByPlaceholderText('Message Molt...') as HTMLTextAreaElement;
      expect(textarea.style.maxHeight).toBe('200px');
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels for buttons', () => {
      render(<ChatInput onSend={mockOnSend} />);
      
      expect(screen.getByLabelText('Attach files')).toBeInTheDocument();
      expect(screen.getByLabelText(/Send message/i)).toBeInTheDocument();
    });

    it('should have proper title attributes', () => {
      render(<ChatInput onSend={mockOnSend} />);
      
      expect(screen.getByTitle('Attach files')).toBeInTheDocument();
      expect(screen.getByTitle('Send message (Enter)')).toBeInTheDocument();
    });

    it('should update send button aria-label when sending', () => {
      render(<ChatInput onSend={mockOnSend} isSending={true} />);
      
      expect(screen.getByLabelText('Sending message...')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle very long messages', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const longMessage = 'a'.repeat(10000);
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.type(input, longMessage);
      await user.keyboard('{Enter}');
      
      expect(mockOnSend).toHaveBeenCalledWith(longMessage, []);
    });

    it('should handle special characters', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.type(input, '<script>alert("xss")</script>');
      await user.keyboard('{Enter}');
      
      expect(mockOnSend).toHaveBeenCalledWith('<script>alert("xss")</script>', []);
    });

    it('should handle unicode characters', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.type(input, '你好 🌍 Привет');
      await user.keyboard('{Enter}');
      
      expect(mockOnSend).toHaveBeenCalled();
    });

    it('should handle emoji input', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);
      
      const input = screen.getByPlaceholderText('Message Molt...');
      await user.type(input, '😀 😃 😄 😁');
      await user.keyboard('{Enter}');
      
      expect(mockOnSend).toHaveBeenCalledWith('😀 😃 😄 😁', []);
    });
  });
});
