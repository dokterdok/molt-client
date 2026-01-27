/**
 * Tests for conversation export utilities
 */

import { describe, it, expect } from "vitest";
import { Conversation, Message } from "../stores/store";
import {
  toMarkdown,
  toJSON,
  toPlainText,
  toHTML,
  exportConversation,
  sanitizeFilename,
  getFileExtension,
  getMimeType,
  generateFilename,
  exportAllConversations,
} from "./export";

// Test data
const createTestMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "msg-1",
  role: "user",
  content: "Hello, how are you?",
  timestamp: new Date("2024-01-15T10:30:00Z"),
  ...overrides,
});

const createTestConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: "conv-1",
  title: "Test Conversation",
  messages: [
    createTestMessage({ id: "msg-1", role: "user", content: "Hello, how are you?" }),
    createTestMessage({ id: "msg-2", role: "assistant", content: "I'm doing well, thank you!", modelUsed: "claude-sonnet-4" }),
  ],
  createdAt: new Date("2024-01-15T10:00:00Z"),
  updatedAt: new Date("2024-01-15T10:35:00Z"),
  model: "anthropic/claude-sonnet-4-5",
  thinkingEnabled: false,
  isPinned: false,
  ...overrides,
});

describe("sanitizeFilename", () => {
  it("should remove invalid characters", () => {
    expect(sanitizeFilename('test<>:"/\\|?*file')).toBe("testfile");
  });

  it("should replace spaces with underscores", () => {
    expect(sanitizeFilename("my test file")).toBe("my_test_file");
  });

  it("should truncate long filenames", () => {
    const longName = "a".repeat(150);
    expect(sanitizeFilename(longName).length).toBe(100);
  });
});

describe("getFileExtension", () => {
  it("should return correct extensions", () => {
    expect(getFileExtension("markdown")).toBe("md");
    expect(getFileExtension("json")).toBe("json");
    expect(getFileExtension("text")).toBe("txt");
    expect(getFileExtension("html")).toBe("html");
  });
});

describe("getMimeType", () => {
  it("should return correct MIME types", () => {
    expect(getMimeType("markdown")).toBe("text/markdown");
    expect(getMimeType("json")).toBe("application/json");
    expect(getMimeType("text")).toBe("text/plain");
    expect(getMimeType("html")).toBe("text/html");
  });
});

describe("generateFilename", () => {
  it("should generate filename with title and date", () => {
    const conversation = createTestConversation();
    const filename = generateFilename(conversation, "markdown");
    expect(filename).toMatch(/Test_Conversation_\d{4}-\d{2}-\d{2}\.md$/);
  });

  it("should handle special characters in title", () => {
    const conversation = createTestConversation({ title: "My <Test> Conversation?" });
    const filename = generateFilename(conversation, "json");
    expect(filename).not.toContain("<");
    expect(filename).not.toContain(">");
    expect(filename).not.toContain("?");
    expect(filename.endsWith(".json")).toBe(true);
  });
});

describe("toMarkdown", () => {
  it("should include title as heading", () => {
    const conversation = createTestConversation();
    const result = toMarkdown(conversation);
    expect(result).toContain("# Test Conversation");
  });

  it("should include metadata by default", () => {
    const conversation = createTestConversation();
    const result = toMarkdown(conversation);
    expect(result).toContain("## Metadata");
    expect(result).toContain("anthropic/claude-sonnet-4-5");
  });

  it("should exclude metadata when disabled", () => {
    const conversation = createTestConversation();
    const result = toMarkdown(conversation, { includeMetadata: false });
    expect(result).not.toContain("## Metadata");
  });

  it("should include timestamps by default", () => {
    const conversation = createTestConversation();
    const result = toMarkdown(conversation);
    expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });

  it("should exclude timestamps when disabled", () => {
    const conversation = createTestConversation();
    const result = toMarkdown(conversation, { includeTimestamps: false });
    // Should still have date in metadata but not in messages
    expect(result).toContain("**User**");
    expect(result).not.toContain("_(20");
  });

  it("should format messages correctly", () => {
    const conversation = createTestConversation();
    const result = toMarkdown(conversation);
    expect(result).toContain("**User**");
    expect(result).toContain("**Assistant**");
    expect(result).toContain("Hello, how are you?");
    expect(result).toContain("I'm doing well, thank you!");
  });

  it("should include thinking content when enabled", () => {
    const conversation = createTestConversation({
      messages: [
        createTestMessage({ 
          role: "assistant", 
          content: "Here is my answer",
          thinkingContent: "Let me think about this..."
        }),
      ],
    });
    const result = toMarkdown(conversation, { includeThinking: true });
    expect(result).toContain("Let me think about this...");
    expect(result).toContain("<details>");
  });
});

describe("toJSON", () => {
  it("should return valid JSON", () => {
    const conversation = createTestConversation();
    const result = toJSON(conversation);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("should include export metadata", () => {
    const conversation = createTestConversation();
    const result = JSON.parse(toJSON(conversation));
    expect(result).toHaveProperty("exportedAt");
    expect(result).toHaveProperty("exportVersion", "1.0");
  });

  it("should include all conversation data", () => {
    const conversation = createTestConversation();
    const result = JSON.parse(toJSON(conversation));
    expect(result.conversation.id).toBe("conv-1");
    expect(result.conversation.title).toBe("Test Conversation");
    expect(result.conversation.messages).toHaveLength(2);
  });

  it("should include message details", () => {
    const conversation = createTestConversation();
    const result = JSON.parse(toJSON(conversation));
    const firstMessage = result.conversation.messages[0];
    expect(firstMessage).toHaveProperty("id");
    expect(firstMessage).toHaveProperty("role");
    expect(firstMessage).toHaveProperty("content");
    expect(firstMessage).toHaveProperty("timestamp");
  });
});

describe("toPlainText", () => {
  it("should include title as header", () => {
    const conversation = createTestConversation();
    const result = toPlainText(conversation);
    expect(result).toContain("Test Conversation");
    expect(result).toContain("=".repeat("Test Conversation".length));
  });

  it("should format messages simply", () => {
    const conversation = createTestConversation();
    const result = toPlainText(conversation);
    expect(result).toContain("[User]");
    expect(result).toContain("[Assistant]");
    expect(result).toContain("Hello, how are you?");
  });

  it("should exclude metadata when disabled", () => {
    const conversation = createTestConversation();
    const result = toPlainText(conversation, { includeMetadata: false });
    expect(result).not.toContain("Model:");
  });
});

describe("toHTML", () => {
  it("should return valid HTML document", () => {
    const conversation = createTestConversation();
    const result = toHTML(conversation);
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<html");
    expect(result).toContain("</html>");
  });

  it("should include title in head and body", () => {
    const conversation = createTestConversation();
    const result = toHTML(conversation);
    expect(result).toContain("<title>Test Conversation - Moltzer Export</title>");
    expect(result).toContain("<h1>Test Conversation</h1>");
  });

  it("should escape HTML in content", () => {
    const conversation = createTestConversation({
      messages: [createTestMessage({ content: "<script>alert('xss')</script>" })],
    });
    const result = toHTML(conversation);
    expect(result).not.toContain("<script>alert");
    expect(result).toContain("&lt;script&gt;");
  });

  it("should include CSS styles", () => {
    const conversation = createTestConversation();
    const result = toHTML(conversation);
    expect(result).toContain("<style>");
    expect(result).toContain("--bg:");
    expect(result).toContain("prefers-color-scheme: dark");
  });

  it("should include message styling classes", () => {
    const conversation = createTestConversation();
    const result = toHTML(conversation);
    expect(result).toContain('class="message user"');
    expect(result).toContain('class="message assistant"');
  });
});

describe("exportConversation", () => {
  it("should export in correct format based on option", () => {
    const conversation = createTestConversation();
    
    const md = exportConversation(conversation, { format: "markdown" });
    expect(md).toContain("# Test Conversation");
    
    const json = exportConversation(conversation, { format: "json" });
    expect(() => JSON.parse(json)).not.toThrow();
    
    const txt = exportConversation(conversation, { format: "text" });
    expect(txt).toContain("[User]");
    
    const html = exportConversation(conversation, { format: "html" });
    expect(html).toContain("<!DOCTYPE html>");
  });
});

describe("exportAllConversations", () => {
  it("should export multiple conversations", () => {
    const conversations = [
      createTestConversation({ id: "conv-1", title: "First" }),
      createTestConversation({ id: "conv-2", title: "Second" }),
    ];
    const result = JSON.parse(exportAllConversations(conversations));
    
    expect(result.count).toBe(2);
    expect(result.conversations).toHaveLength(2);
    expect(result.conversations[0].title).toBe("First");
    expect(result.conversations[1].title).toBe("Second");
  });

  it("should include export metadata", () => {
    const conversations = [createTestConversation()];
    const result = JSON.parse(exportAllConversations(conversations));
    
    expect(result).toHaveProperty("exportedAt");
    expect(result).toHaveProperty("exportVersion", "1.0");
  });
});
