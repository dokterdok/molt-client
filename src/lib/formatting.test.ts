import { describe, it, expect } from 'vitest';
import { formatDistanceToNow } from 'date-fns';

/**
 * Message formatting and display tests
 */

describe('Message Formatting', () => {
  describe('timestamp formatting', () => {
    it('should format recent timestamps', () => {
      const now = new Date();
      const result = formatDistanceToNow(now, { addSuffix: true });
      expect(result).toContain('less than a minute ago');
    });

    it('should format timestamps from minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatDistanceToNow(fiveMinutesAgo, { addSuffix: true });
      expect(result).toContain('5 minutes ago');
    });

    it('should format timestamps from hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = formatDistanceToNow(twoHoursAgo, { addSuffix: true });
      expect(result).toContain('2 hours ago');
    });

    it('should format timestamps from days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = formatDistanceToNow(threeDaysAgo, { addSuffix: true });
      expect(result).toContain('3 days ago');
    });
  });

  describe('message content truncation', () => {
    function truncateForTitle(content: string, maxLength = 40): string {
      if (content.length <= maxLength) return content;
      return content.slice(0, maxLength) + '...';
    }

    it('should not truncate short messages', () => {
      const short = 'Hello world';
      expect(truncateForTitle(short)).toBe('Hello world');
    });

    it('should truncate long messages', () => {
      const long = 'This is a very long message that should be truncated for display purposes';
      const result = truncateForTitle(long);
      expect(result).toBe('This is a very long message that should...');
      expect(result.length).toBe(43); // 40 + '...'
    });

    it('should handle exact length', () => {
      const exact = 'a'.repeat(40);
      expect(truncateForTitle(exact)).toBe(exact);
    });

    it('should handle custom max length', () => {
      const text = 'This is a test message for truncation';
      const result = truncateForTitle(text, 10);
      expect(result).toBe('This is a ...');
    });
  });

  describe('markdown detection', () => {
    function containsMarkdown(content: string): boolean {
      const markdownPatterns = [
        /^#{1,6}\s/, // Headers
        /\*\*.*\*\*/, // Bold
        /_.*_/, // Italic
        /`.*`/, // Inline code
        /```[\s\S]*```/, // Code blocks
        /\[.*\]\(.*\)/, // Links
        /^[-*+]\s/, // Lists
        /^\d+\.\s/, // Numbered lists
      ];
      
      return markdownPatterns.some(pattern => pattern.test(content));
    }

    it('should detect headers', () => {
      expect(containsMarkdown('# Title')).toBe(true);
      expect(containsMarkdown('## Subtitle')).toBe(true);
    });

    it('should detect bold text', () => {
      expect(containsMarkdown('This is **bold** text')).toBe(true);
    });

    it('should detect italic text', () => {
      expect(containsMarkdown('This is _italic_ text')).toBe(true);
    });

    it('should detect inline code', () => {
      expect(containsMarkdown('Use `console.log()` to print')).toBe(true);
    });

    it('should detect code blocks', () => {
      expect(containsMarkdown('```js\nconst x = 1;\n```')).toBe(true);
    });

    it('should detect links', () => {
      expect(containsMarkdown('[Link](https://example.com)')).toBe(true);
    });

    it('should detect lists', () => {
      expect(containsMarkdown('- Item 1')).toBe(true);
      expect(containsMarkdown('* Item 1')).toBe(true);
      expect(containsMarkdown('+ Item 1')).toBe(true);
    });

    it('should detect numbered lists', () => {
      expect(containsMarkdown('1. First item')).toBe(true);
    });

    it('should not detect plain text', () => {
      expect(containsMarkdown('Just plain text')).toBe(false);
    });
  });

  describe('code extraction', () => {
    function extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
      const pattern = /```(\w+)?\n([\s\S]*?)```/g;
      const blocks: Array<{ language: string; code: string }> = [];
      let match;
      
      while ((match = pattern.exec(content)) !== null) {
        blocks.push({
          language: match[1] || 'text',
          code: match[2].trim(),
        });
      }
      
      return blocks;
    }

    it('should extract code blocks with language', () => {
      const content = '```js\nconst x = 1;\n```';
      const blocks = extractCodeBlocks(content);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('js');
      expect(blocks[0].code).toBe('const x = 1;');
    });

    it('should extract code blocks without language', () => {
      const content = '```\nplain code\n```';
      const blocks = extractCodeBlocks(content);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('text');
      expect(blocks[0].code).toBe('plain code');
    });

    it('should extract multiple code blocks', () => {
      const content = `
Here's some JavaScript:
\`\`\`js
const x = 1;
\`\`\`

And some Python:
\`\`\`python
x = 1
\`\`\`
      `;
      
      const blocks = extractCodeBlocks(content);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0].language).toBe('js');
      expect(blocks[1].language).toBe('python');
    });

    it('should handle empty code blocks', () => {
      const content = '```js\n\n```';
      const blocks = extractCodeBlocks(content);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe('');
    });
  });

  describe('model name formatting', () => {
    function formatModelName(modelId: string): string {
      // Extract model name from format "provider/model-name"
      const parts = modelId.split('/');
      return parts[parts.length - 1];
    }

    it('should extract model name from full ID', () => {
      expect(formatModelName('anthropic/claude-sonnet-4-5')).toBe('claude-sonnet-4-5');
      expect(formatModelName('openai/gpt-4')).toBe('gpt-4');
    });

    it('should handle model IDs without provider', () => {
      expect(formatModelName('claude-opus-4')).toBe('claude-opus-4');
    });

    it('should handle empty strings', () => {
      expect(formatModelName('')).toBe('');
    });
  });

  describe('sanitization', () => {
    function sanitizeInput(input: string): string {
      return input
        .trim()
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/\s+/g, ' '); // Normalize whitespace
    }

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('should remove control characters', () => {
      expect(sanitizeInput('hello\x00\x01world')).toBe('helloworld');
    });

    it('should normalize multiple spaces', () => {
      expect(sanitizeInput('hello    world')).toBe('hello world');
    });

    it('should handle newlines', () => {
      expect(sanitizeInput('hello\n\n\nworld')).toBe('hello world');
    });

    it('should handle tabs', () => {
      expect(sanitizeInput('hello\t\tworld')).toBe('hello world');
    });

    it('should handle mixed whitespace', () => {
      expect(sanitizeInput('  hello \n\t world  ')).toBe('hello world');
    });
  });
});
