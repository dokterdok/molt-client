/**
 * Conversation Export Utilities
 * 
 * Converts conversations to various export formats:
 * - Markdown (.md) - Clean, readable format
 * - JSON (.json) - Complete data with all metadata
 * - Plain text (.txt) - Simple, no formatting
 * - HTML (.html) - Styled, shareable
 */

import { Conversation } from "../stores/store";
import { format } from "date-fns";

export type ExportFormat = "markdown" | "json" | "text" | "html";

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
  includeThinking?: boolean;
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(date: Date): string {
  return format(new Date(date), "yyyy-MM-dd HH:mm:ss");
}

/**
 * Sanitize filename by removing invalid characters
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 100);
}

/**
 * Get file extension for export format
 */
export function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case "markdown": return "md";
    case "json": return "json";
    case "text": return "txt";
    case "html": return "html";
  }
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: ExportFormat): string {
  switch (format) {
    case "markdown": return "text/markdown";
    case "json": return "application/json";
    case "text": return "text/plain";
    case "html": return "text/html";
  }
}

/**
 * Generate suggested filename for export
 */
export function generateFilename(conversation: Conversation, format: ExportFormat): string {
  const safeTitle = sanitizeFilename(conversation.title);
  const datePart = new Date(conversation.createdAt).toISOString().split("T")[0];
  const ext = getFileExtension(format);
  return `${safeTitle}_${datePart}.${ext}`;
}

/**
 * Convert conversation to Markdown format
 */
export function toMarkdown(conversation: Conversation, options: Partial<ExportOptions> = {}): string {
  const { includeMetadata = true, includeTimestamps = true, includeThinking = false } = options;
  const lines: string[] = [];

  // Header
  lines.push(`# ${conversation.title}`);
  lines.push("");

  // Metadata
  if (includeMetadata) {
    lines.push("## Metadata");
    lines.push("");
    lines.push(`- **Created:** ${formatTimestamp(conversation.createdAt)}`);
    lines.push(`- **Last Updated:** ${formatTimestamp(conversation.updatedAt)}`);
    if (conversation.model) {
      lines.push(`- **Model:** ${conversation.model}`);
    }
    lines.push(`- **Messages:** ${conversation.messages.length}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Messages
  lines.push("## Conversation");
  lines.push("");

  for (const message of conversation.messages) {
    const role = message.role === "user" ? "**User**" : message.role === "assistant" ? "**Assistant**" : "**System**";
    const timestamp = includeTimestamps ? ` _(${formatTimestamp(message.timestamp)})_` : "";
    const model = message.modelUsed && message.role === "assistant" ? ` [${message.modelUsed}]` : "";
    
    lines.push(`### ${role}${model}${timestamp}`);
    lines.push("");
    lines.push(message.content);
    
    // Include thinking content if requested
    if (includeThinking && message.thinkingContent) {
      lines.push("");
      lines.push("<details>");
      lines.push("<summary>Thinking</summary>");
      lines.push("");
      lines.push(message.thinkingContent);
      lines.push("");
      lines.push("</details>");
    }
    
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Convert conversation to JSON format (complete data)
 */
export function toJSON(conversation: Conversation): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    exportVersion: "1.0",
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      model: conversation.model,
      thinkingEnabled: conversation.thinkingEnabled,
      isPinned: conversation.isPinned,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        modelUsed: m.modelUsed,
        thinkingContent: m.thinkingContent,
        attachments: m.attachments,
        sources: m.sources,
      })),
    },
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Convert conversation to plain text format
 */
export function toPlainText(conversation: Conversation, options: Partial<ExportOptions> = {}): string {
  const { includeMetadata = true, includeTimestamps = true } = options;
  const lines: string[] = [];

  // Header
  lines.push(conversation.title);
  lines.push("=".repeat(conversation.title.length));
  lines.push("");

  // Metadata
  if (includeMetadata) {
    lines.push(`Created: ${formatTimestamp(conversation.createdAt)}`);
    lines.push(`Updated: ${formatTimestamp(conversation.updatedAt)}`);
    if (conversation.model) {
      lines.push(`Model: ${conversation.model}`);
    }
    lines.push(`Messages: ${conversation.messages.length}`);
    lines.push("");
    lines.push("-".repeat(40));
    lines.push("");
  }

  // Messages
  for (const message of conversation.messages) {
    const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
    const timestamp = includeTimestamps ? ` (${formatTimestamp(message.timestamp)})` : "";
    
    lines.push(`[${role}]${timestamp}`);
    lines.push(message.content);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Convert conversation to HTML format (styled, shareable)
 */
export function toHTML(conversation: Conversation, options: Partial<ExportOptions> = {}): string {
  const { includeMetadata = true, includeTimestamps = true, includeThinking = false } = options;
  
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br>");
  };

  const formatContent = (content: string): string => {
    // Basic markdown-like formatting
    let html = escapeHtml(content);
    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return html;
  };

  const messagesHtml = conversation.messages.map((message) => {
    const roleClass = message.role === "user" ? "user" : message.role === "assistant" ? "assistant" : "system";
    const roleName = message.role.charAt(0).toUpperCase() + message.role.slice(1);
    const timestamp = includeTimestamps 
      ? `<span class="timestamp">${formatTimestamp(message.timestamp)}</span>` 
      : "";
    const model = message.modelUsed && message.role === "assistant" 
      ? `<span class="model">${escapeHtml(message.modelUsed)}</span>` 
      : "";
    
    let thinkingHtml = "";
    if (includeThinking && message.thinkingContent) {
      thinkingHtml = `
        <details class="thinking">
          <summary>Thinking</summary>
          <div class="thinking-content">${formatContent(message.thinkingContent)}</div>
        </details>`;
    }

    return `
      <div class="message ${roleClass}">
        <div class="message-header">
          <span class="role">${roleName}</span>
          ${model}
          ${timestamp}
        </div>
        <div class="message-content">${formatContent(message.content)}</div>
        ${thinkingHtml}
      </div>`;
  }).join("\n");

  const metadataHtml = includeMetadata ? `
    <div class="metadata">
      <p><strong>Created:</strong> ${formatTimestamp(conversation.createdAt)}</p>
      <p><strong>Last Updated:</strong> ${formatTimestamp(conversation.updatedAt)}</p>
      ${conversation.model ? `<p><strong>Model:</strong> ${escapeHtml(conversation.model)}</p>` : ""}
      <p><strong>Messages:</strong> ${conversation.messages.length}</p>
    </div>
    <hr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(conversation.title)} - Molt Export</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #1a1a1a;
      --muted: #6b7280;
      --border: #e5e7eb;
      --user-bg: #f3f4f6;
      --assistant-bg: #fff7ed;
      --system-bg: #fef3c7;
      --code-bg: #f3f4f6;
      --accent: #f97316;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1a1a1a;
        --text: #f3f4f6;
        --muted: #9ca3af;
        --border: #374151;
        --user-bg: #1f2937;
        --assistant-bg: #292524;
        --system-bg: #422006;
        --code-bg: #1f2937;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1 { margin-bottom: 1rem; font-size: 1.75rem; }
    hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
    .metadata { color: var(--muted); font-size: 0.875rem; margin-bottom: 1rem; }
    .metadata p { margin: 0.25rem 0; }
    .message { padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; }
    .message.user { background: var(--user-bg); }
    .message.assistant { background: var(--assistant-bg); }
    .message.system { background: var(--system-bg); }
    .message-header { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .role { font-weight: 600; }
    .model { font-size: 0.75rem; color: var(--muted); background: var(--border); padding: 0.125rem 0.5rem; border-radius: 0.25rem; }
    .timestamp { font-size: 0.75rem; color: var(--muted); }
    .message-content { white-space: pre-wrap; word-wrap: break-word; }
    pre { background: var(--code-bg); padding: 1rem; border-radius: 0.375rem; overflow-x: auto; margin: 0.5rem 0; }
    code { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 0.875rem; }
    :not(pre) > code { background: var(--code-bg); padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
    .thinking { margin-top: 0.75rem; }
    .thinking summary { cursor: pointer; color: var(--muted); font-size: 0.875rem; }
    .thinking-content { margin-top: 0.5rem; padding: 0.75rem; background: var(--code-bg); border-radius: 0.375rem; font-size: 0.875rem; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.75rem; text-align: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(conversation.title)}</h1>
  ${metadataHtml}
  <div class="messages">
    ${messagesHtml}
  </div>
  <div class="footer">
    Exported from Molt on ${formatTimestamp(new Date())}
  </div>
</body>
</html>`;
}

/**
 * Convert conversation to specified format
 */
export function exportConversation(conversation: Conversation, options: ExportOptions): string {
  switch (options.format) {
    case "markdown":
      return toMarkdown(conversation, options);
    case "json":
      return toJSON(conversation);
    case "text":
      return toPlainText(conversation, options);
    case "html":
      return toHTML(conversation, options);
  }
}

/**
 * Export multiple conversations to JSON (for batch export)
 */
export function exportAllConversations(conversations: Conversation[]): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    exportVersion: "1.0",
    count: conversations.length,
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      model: c.model,
      thinkingEnabled: c.thinkingEnabled,
      isPinned: c.isPinned,
      messages: c.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        modelUsed: m.modelUsed,
        thinkingContent: m.thinkingContent,
        attachments: m.attachments,
        sources: m.sources,
      })),
    })),
  };

  return JSON.stringify(exportData, null, 2);
}
