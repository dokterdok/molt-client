# NEXT_FEATURES.md - Feature Prioritization & Design

**Analysis Date:** 2025-01-28  
**Status:** Ready for implementation

---

## Executive Summary

Based on analysis of:
- ✅ **ROADMAP.md** — V1.0 must-haves and future plans
- ✅ **COMPETITIVE_ANALYSIS.md** — Gaps vs. ChatGPT/Claude desktop
- ✅ **Existing codebase** — Current implementation state
- ✅ **Testing infrastructure** — Vitest + Playwright already configured

**Key Findings:**
- **Strong foundation** — Core chat, streaming, encryption, search already solid
- **Clear V1.0 path** — 8 features block public release
- **3 quick wins** — High-impact features achievable in 1-2 days each
- **Autonomous testing** — Most features can be fully tested without human intervention

---

## 1. V1.0 Must-Haves Analysis

From ROADMAP.md, these features block public release:

### Critical (Blocking V1.0 Launch)

| Feature | Implementation Complexity | Testing Complexity | User Impact | Dependencies | Autonomous Testing |
|---------|--------------------------|-------------------|-------------|--------------|-------------------|
| **File Upload** | 🟡 Medium (2-3 days) | 🟢 Low | 🔥 Critical | Tauri fs plugin (✅ installed) | ✅ Yes |
| **Image Rendering** | 🟢 Low (4-6 hours) | 🟢 Low | 🔥 High | None | ✅ Yes |
| **Regenerate Response** | 🟢 Low (2-3 hours) | 🟢 Low | 🔥 High | None | ✅ Yes |
| **Edit & Retry Messages** | 🟡 Medium (1-2 days) | 🟡 Medium | 🔥 High | None | ✅ Yes |
| **Export Conversations** | 🟢 Low (4-6 hours) | 🟢 Low | 🟡 Medium | Tauri fs dialog (✅ installed) | ✅ Yes |
| **Error Handling Polish** | 🟢 Low (6-8 hours) | 🟡 Medium | 🔥 High | None | ✅ Yes |
| **Auto-update System** | 🔴 High (3-5 days) | 🔴 High | 🟡 Medium | GitHub releases, signing keys | ❌ No (needs release testing) |
| **Documentation** | 🟢 Low (1 day) | 🟢 Low | 🟡 Medium | None | ✅ Yes (linting/formatting) |

### Nice-to-Have (V1.0)

| Feature | Implementation | Testing | Impact | Dependencies | Autonomous |
|---------|---------------|---------|--------|--------------|------------|
| **Keyboard Navigation** | 🟡 Medium | 🟢 Low | 🟡 Medium | None | ✅ Yes |
| **Message Actions (Copy/Delete)** | 🟢 Low | 🟢 Low | 🟡 Medium | None | ✅ Yes |
| **Conversation Organization** | 🟡 Medium | 🟡 Medium | 🟡 Medium | None | ✅ Yes |
| **System Tray** | 🔴 High | 🔴 High | 🟢 Low | OS-specific APIs | ❌ No |

---

## 2. Competitive Gaps Analysis

From COMPETITIVE_ANALYSIS.md, what ChatGPT/Claude have that Molt doesn't:

### High Priority Gaps

| Feature | ChatGPT | Claude | Molt | Feasibility | Strategic Value |
|---------|---------|--------|------|-------------|-----------------|
| **Edit previous messages** | ✅ | ✅ | ❌ | 🟢 Easy | 🔥 Must-have |
| **Regenerate responses** | ✅ | ✅ | ❌ | 🟢 Easy | 🔥 Must-have |
| **File upload (images)** | ✅ | ✅ | ❌ | 🟡 Medium | 🔥 Must-have |
| **Export conversations** | ✅ | ✅ | ❌ | 🟢 Easy | 🔥 High |
| **Global keyboard shortcut** | ✅ | ⚠️ | ❌ | 🟡 Medium | 🔥 High |
| **Folder/tag organization** | ❌ | ❌ | ❌ | 🟡 Medium | 🔥 **Differentiator** |
| **Conversation branching** | ❌ | ❌ | ❌ | 🔴 Hard | 🔥 **Differentiator** |
| **Voice input** | ✅ | ⚠️ | ❌ | 🔴 Hard | 🟡 Medium |
| **Always-on-top mode** | ✅ | ⚠️ | ❌ | 🟢 Easy | 🟡 Medium |

### What Molt Already Does Better

✅ **Multi-model support** — Switch between GPT, Claude, Gemini (competitors lock to one provider)  
✅ **Lighter weight** — Tauri vs Electron (~50MB vs ~500MB RAM)  
✅ **Better context management** — Purpose-built for long conversations  
✅ **Local-first** — No cloud dependency, full encryption at rest

---

## 3. Feature Prioritization Matrix

### Methodology

Each feature evaluated on:
- **Implementation complexity** — Hours/days to build
- **Testing complexity** — Can it be tested autonomously?
- **User impact** — High/medium/low demand
- **Dependencies** — Gateway changes? OS features?
- **Strategic value** — Does it differentiate Molt or match table stakes?

### Priority Tiers

#### 🔥 DO NOW (High Impact, Low Complexity, Autonomous Testing)

**1. Regenerate Response** — *2-3 hours*
- Implementation: 🟢 Low (add button + re-send last user message)
- Testing: 🟢 Low (Playwright E2E + Vitest component tests)
- User Impact: 🔥 Critical (table stakes, users expect this)
- Dependencies: None
- Autonomous: ✅ Yes

**2. Export Conversations** — *4-6 hours*
- Implementation: 🟢 Low (Markdown/JSON export + Tauri file dialog)
- Testing: 🟢 Low (verify file output format)
- User Impact: 🔥 High (frequently requested, sharing use case)
- Dependencies: Tauri fs plugin (✅ already installed)
- Autonomous: ✅ Yes

**3. Image Rendering in Messages** — *4-6 hours*
- Implementation: 🟢 Low (detect `![](url)` in markdown, render `<img>`)
- Testing: 🟢 Low (snapshot tests with sample images)
- User Impact: 🔥 High (enables vision model responses)
- Dependencies: None (pure frontend)
- Autonomous: ✅ Yes

#### 🟡 DO NEXT (High Impact, Medium Complexity)

**4. Edit & Retry Messages** — *1-2 days*
- Implementation: 🟡 Medium (edit UI, conversation state branching)
- Testing: 🟡 Medium (state mutations, edge cases)
- User Impact: 🔥 High (power users refine prompts)
- Dependencies: None
- Autonomous: ✅ Yes

**5. File Upload (Images/PDFs)** — *2-3 days*
- Implementation: 🟡 Medium (Tauri fs read, base64 encode, send to Gateway)
- Testing: 🟡 Medium (mock file system, test different formats)
- User Impact: 🔥 Critical (vision models, document analysis)
- Dependencies: Tauri fs plugin (✅ installed), Gateway must support attachments
- Autonomous: ✅ Yes (mock files in tests)

**6. Enhanced Keyboard Navigation** — *1-2 days*
- Implementation: 🟡 Medium (keyboard event handlers, focus management)
- Testing: 🟢 Low (Playwright keyboard interaction tests)
- User Impact: 🟡 Medium (power users love it)
- Dependencies: None
- Autonomous: ✅ Yes

**7. Message Copy/Delete Actions** — *6-8 hours*
- Implementation: 🟢 Low (context menu or hover buttons)
- Testing: 🟢 Low (click tests)
- User Impact: 🟡 Medium (nice-to-have QoL)
- Dependencies: None
- Autonomous: ✅ Yes

**8. Conversation Organization (Folders/Sort)** — *2-3 days*
- Implementation: 🟡 Medium (folder state, drag-drop, sort logic)
- Testing: 🟡 Medium (state mutations, persistence)
- User Impact: 🔥 High (differentiator, competitors lack this)
- Dependencies: None (extend existing store + IndexedDB)
- Autonomous: ✅ Yes

#### 🟠 PARK (Needs Human Testing or Gateway Changes)

**9. Auto-update System** — *3-5 days*
- Implementation: 🔴 High (Tauri updater, GitHub releases, signing)
- Testing: 🔴 High (must test on real OS environments)
- User Impact: 🟡 Medium (important for distribution, not core UX)
- Dependencies: GitHub release workflow, code signing certs
- Autonomous: ❌ No (requires manual release testing)

**10. System Tray Integration** — *2-3 days*
- Implementation: 🔴 High (OS-specific, Tauri tray API)
- Testing: 🔴 High (must verify on Windows/Mac/Linux)
- User Impact: 🟢 Low (nice-to-have, not essential)
- Dependencies: OS system tray APIs
- Autonomous: ❌ No (visual verification needed)

**11. Voice Input/Output** — *5-7 days*
- Implementation: 🔴 High (audio recording, Whisper API, TTS playback)
- Testing: 🔴 High (audio devices, permissions, playback)
- User Impact: 🟡 Medium (growing demand, but not V1.0 critical)
- Dependencies: Audio APIs, Whisper/TTS backend
- Autonomous: ❌ No (audio quality testing)

**12. Conversation Branching** — *4-5 days*
- Implementation: 🔴 High (conversation tree state, UI complexity)
- Testing: 🟡 Medium (state logic testable, UI needs validation)
- User Impact: 🔥 High (differentiator, power user feature)
- Dependencies: None (pure frontend, but complex)
- Autonomous: ⚠️ Partial (logic yes, UX needs human review)

#### ⛔ SKIP (Low Impact or Out of Scope for V1.0)

**Team Collaboration** — Different product, complex scope  
**Mobile Apps** — Tauri mobile still beta, desktop-first strategy  
**Plugin System** — V2.0 feature, needs architecture work  
**Browser Extension** — Different distribution channel  
**Multi-language UI** — Start English-only, localize later  
**AI Training/Fine-tuning** — Not core value prop

---

## 4. Top 3 "DO NOW" Features — Detailed Implementation Specs

These three features have:
- ✅ High user impact (critical or high demand)
- ✅ Low implementation complexity (hours, not days)
- ✅ Fully autonomous testing (no human verification needed)
- ✅ No external dependencies (pure frontend or existing plugins)

### Ship order: #1 → #2 → #3 (fastest wins first)

---

## Feature #1: Regenerate Response

### Overview
Allow users to regenerate the last assistant response without retyping their message. Standard feature in all AI chat apps.

### User Story
> "As a user, when I receive an unsatisfactory response, I want to regenerate it without retyping my prompt, so I can quickly get a better answer."

### Implementation Complexity
🟢 **Low** — 2-3 hours

### Testing Complexity
🟢 **Low** — Fully autonomous with Playwright + Vitest

### User Impact
🔥 **Critical** — Table stakes feature, users expect this

---

### Detailed Implementation Spec

#### Files to Modify

**1. `src/stores/store.ts`** — Add regenerate action
```typescript
// Add to Store interface
interface Store {
  // ... existing
  regenerateLastResponse: (conversationId: string) => void;
}

// Add implementation
regenerateLastResponse: (conversationId: string) => {
  const conversation = get().conversations.find(c => c.id === conversationId);
  if (!conversation) return;

  // Find last user message
  const lastUserMessageIndex = conversation.messages
    .map((m, i) => ({ ...m, index: i }))
    .reverse()
    .find(m => m.role === 'user')?.index;

  if (lastUserMessageIndex === undefined) return;

  // Remove assistant message(s) after last user message
  const newMessages = conversation.messages.slice(0, lastUserMessageIndex + 1);
  
  // Update conversation
  set(state => ({
    conversations: state.conversations.map(c =>
      c.id === conversationId
        ? { ...c, messages: newMessages, updatedAt: new Date() }
        : c
    )
  }));

  // Persist
  updatePersistedConversation(conversationId, { messages: newMessages });

  // Re-send last user message (trigger in App.tsx via event)
  window.dispatchEvent(new CustomEvent('molt:regenerate', { 
    detail: { conversationId, message: conversation.messages[lastUserMessageIndex] }
  }));
}
```

**2. `src/components/MessageBubble.tsx`** — Add regenerate button
```typescript
// Add to MessageBubble props
interface MessageBubbleProps {
  // ... existing
  isLastAssistantMessage?: boolean;
  onRegenerate?: () => void;
}

// Add button in UI (only for last assistant message)
{isLastAssistantMessage && !isStreaming && (
  <button
    onClick={onRegenerate}
    className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
    aria-label="Regenerate response"
  >
    <RefreshCw className="w-4 h-4" />
    Regenerate
  </button>
)}
```

**3. `src/components/ChatView.tsx`** — Wire up regenerate logic
```typescript
// Detect last assistant message
const lastAssistantMessageIndex = conversation.messages
  .map((m, i) => ({ ...m, index: i }))
  .reverse()
  .find(m => m.role === 'assistant')?.index;

// Pass to MessageBubble
<MessageBubble
  message={msg}
  isLastAssistantMessage={i === lastAssistantMessageIndex}
  onRegenerate={() => regenerateLastResponse(conversation.id)}
/>

// Listen for regenerate event and re-send via WebSocket
useEffect(() => {
  const handleRegenerate = (e: CustomEvent) => {
    const { conversationId, message } = e.detail;
    if (conversationId === currentConversationId) {
      sendMessage(message.content); // existing send logic
    }
  };

  window.addEventListener('molt:regenerate', handleRegenerate);
  return () => window.removeEventListener('molt:regenerate', handleRegenerate);
}, [currentConversationId]);
```

**4. `src/App.tsx`** — No changes needed (WebSocket logic already handles re-sends)

---

### Acceptance Criteria

✅ **AC1:** Regenerate button appears only on the last assistant message  
✅ **AC2:** Clicking regenerate removes the assistant response  
✅ **AC3:** Last user message is re-sent to the Gateway  
✅ **AC4:** New response streams in and replaces the old one  
✅ **AC5:** Regenerate button disappears during streaming  
✅ **AC6:** Works correctly in conversations with multiple back-and-forth exchanges  
✅ **AC7:** Persists correctly to IndexedDB after regeneration  
✅ **AC8:** Keyboard shortcut: `Cmd/Ctrl+R` triggers regenerate (bonus)

---

### Test Plan

#### Unit Tests (`src/stores/store.test.ts`)

```typescript
describe('regenerateLastResponse', () => {
  it('should remove last assistant message', () => {
    const store = useStore.getState();
    const conv = store.createConversation();
    
    store.addMessage(conv.id, { role: 'user', content: 'Hello' });
    store.addMessage(conv.id, { role: 'assistant', content: 'Hi there!' });
    
    store.regenerateLastResponse(conv.id);
    
    const updated = store.conversations.find(c => c.id === conv.id);
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0].role).toBe('user');
  });

  it('should dispatch regenerate event', () => {
    const eventSpy = vi.fn();
    window.addEventListener('molt:regenerate', eventSpy);
    
    const store = useStore.getState();
    const conv = store.createConversation();
    store.addMessage(conv.id, { role: 'user', content: 'Test' });
    store.addMessage(conv.id, { role: 'assistant', content: 'Response' });
    
    store.regenerateLastResponse(conv.id);
    
    expect(eventSpy).toHaveBeenCalled();
  });

  it('should handle no assistant messages gracefully', () => {
    const store = useStore.getState();
    const conv = store.createConversation();
    store.addMessage(conv.id, { role: 'user', content: 'Hello' });
    
    // Should not crash
    expect(() => store.regenerateLastResponse(conv.id)).not.toThrow();
  });
});
```

#### Component Tests (`src/components/MessageBubble.test.tsx`)

```typescript
it('should show regenerate button for last assistant message', () => {
  render(
    <MessageBubble
      message={{ role: 'assistant', content: 'Test', id: '1', timestamp: new Date() }}
      isLastAssistantMessage={true}
    />
  );
  
  expect(screen.getByLabelText('Regenerate response')).toBeInTheDocument();
});

it('should not show regenerate button for user messages', () => {
  render(
    <MessageBubble
      message={{ role: 'user', content: 'Test', id: '1', timestamp: new Date() }}
      isLastAssistantMessage={false}
    />
  );
  
  expect(screen.queryByLabelText('Regenerate response')).not.toBeInTheDocument();
});

it('should call onRegenerate when clicked', () => {
  const mockRegenerate = vi.fn();
  render(
    <MessageBubble
      message={{ role: 'assistant', content: 'Test', id: '1', timestamp: new Date() }}
      isLastAssistantMessage={true}
      onRegenerate={mockRegenerate}
    />
  );
  
  fireEvent.click(screen.getByLabelText('Regenerate response'));
  expect(mockRegenerate).toHaveBeenCalled();
});
```

#### E2E Tests (`e2e/regenerate.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Regenerate Response', () => {
  test('should regenerate last response', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    // Wait for app to load
    await page.waitForSelector('[data-testid="chat-input"]');
    
    // Send a message
    await page.fill('[data-testid="chat-input"]', 'Tell me a joke');
    await page.press('[data-testid="chat-input"]', 'Enter');
    
    // Wait for response
    await page.waitForSelector('[data-testid="message-assistant"]');
    const firstResponse = await page.textContent('[data-testid="message-assistant"]');
    
    // Click regenerate
    await page.click('[aria-label="Regenerate response"]');
    
    // Wait for new response
    await page.waitForSelector('[data-testid="message-assistant"]');
    const newResponse = await page.textContent('[data-testid="message-assistant"]');
    
    // Response should be different (or at least re-streamed)
    expect(newResponse).toBeTruthy();
  });

  test('should only show regenerate on last assistant message', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    // Send multiple messages
    await page.fill('[data-testid="chat-input"]', 'First message');
    await page.press('[data-testid="chat-input"]', 'Enter');
    await page.waitForSelector('[data-testid="message-assistant"]');
    
    await page.fill('[data-testid="chat-input"]', 'Second message');
    await page.press('[data-testid="chat-input"]', 'Enter');
    await page.waitForSelector('[data-testid="message-assistant"]:nth-of-type(2)');
    
    // Only last assistant message should have regenerate button
    const regenerateButtons = await page.$$('[aria-label="Regenerate response"]');
    expect(regenerateButtons).toHaveLength(1);
  });
});
```

---

### Edge Cases to Handle

⚠️ **Empty conversation** — Don't show regenerate if no messages  
⚠️ **User message only** — Don't show regenerate if no assistant response yet  
⚠️ **Streaming in progress** — Hide regenerate button during streaming  
⚠️ **Connection lost** — Show error if Gateway disconnected during regenerate  
⚠️ **Rapid clicks** — Debounce regenerate button to prevent double-sends

---

### Success Metrics

📊 **Usage:** % of users who use regenerate in first week  
📊 **Frequency:** Average regenerations per conversation  
📊 **Error rate:** Regenerate failures due to connection issues

---

## Feature #2: Export Conversations

### Overview
Allow users to export conversations as Markdown or JSON files. Essential for sharing, archiving, and backup.

### User Story
> "As a user, I want to export my conversations so I can share insights with colleagues, archive important chats, or back up my data."

### Implementation Complexity
🟢 **Low** — 4-6 hours

### Testing Complexity
🟢 **Low** — Verify file content programmatically

### User Impact
🔥 **High** — Frequently requested, enables sharing use case

---

### Detailed Implementation Spec

#### Files to Modify

**1. `src/lib/export.ts`** — New file for export logic
```typescript
import { Conversation } from '../stores/store';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

/**
 * Export conversation to Markdown format
 */
export async function exportAsMarkdown(conversation: Conversation): Promise<void> {
  const markdown = conversationToMarkdown(conversation);
  
  const filePath = await save({
    defaultPath: `${sanitizeFilename(conversation.title)}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  
  if (filePath) {
    await writeTextFile(filePath, markdown);
  }
}

/**
 * Export conversation to JSON format
 */
export async function exportAsJSON(conversation: Conversation): Promise<void> {
  const json = JSON.stringify(conversation, null, 2);
  
  const filePath = await save({
    defaultPath: `${sanitizeFilename(conversation.title)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  
  if (filePath) {
    await writeTextFile(filePath, json);
  }
}

/**
 * Export conversation to plain text
 */
export async function exportAsText(conversation: Conversation): Promise<void> {
  const text = conversationToText(conversation);
  
  const filePath = await save({
    defaultPath: `${sanitizeFilename(conversation.title)}.txt`,
    filters: [{ name: 'Text', extensions: ['txt'] }]
  });
  
  if (filePath) {
    await writeTextFile(filePath, text);
  }
}

/**
 * Convert conversation to Markdown string
 */
function conversationToMarkdown(conversation: Conversation): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`# ${conversation.title}`);
  lines.push('');
  lines.push(`**Created:** ${conversation.createdAt.toLocaleString()}`);
  lines.push(`**Updated:** ${conversation.updatedAt.toLocaleString()}`);
  if (conversation.model) {
    lines.push(`**Model:** ${conversation.model}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Messages
  conversation.messages.forEach((msg, i) => {
    const roleLabel = msg.role === 'user' ? '👤 **You**' : '🤖 **Assistant**';
    const timestamp = msg.timestamp.toLocaleString();
    
    lines.push(`### ${roleLabel} · ${timestamp}`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    
    // Thinking content if present
    if (msg.thinkingContent) {
      lines.push('<details>');
      lines.push('<summary>💭 Thinking process</summary>');
      lines.push('');
      lines.push(msg.thinkingContent);
      lines.push('</details>');
      lines.push('');
    }
    
    // Model used
    if (msg.modelUsed) {
      lines.push(`*Model: ${msg.modelUsed}*`);
      lines.push('');
    }
    
    if (i < conversation.messages.length - 1) {
      lines.push('---');
      lines.push('');
    }
  });
  
  // Footer
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*Exported from Molt on ${new Date().toLocaleString()}*`);
  
  return lines.join('\n');
}

/**
 * Convert conversation to plain text
 */
function conversationToText(conversation: Conversation): string {
  const lines: string[] = [];
  
  lines.push(conversation.title);
  lines.push('='.repeat(conversation.title.length));
  lines.push('');
  lines.push(`Created: ${conversation.createdAt.toLocaleString()}`);
  lines.push(`Updated: ${conversation.updatedAt.toLocaleString()}`);
  lines.push('');
  
  conversation.messages.forEach(msg => {
    const roleLabel = msg.role === 'user' ? 'You' : 'Assistant';
    lines.push(`[${msg.timestamp.toLocaleTimeString()}] ${roleLabel}:`);
    lines.push(msg.content);
    lines.push('');
  });
  
  lines.push(`--`);
  lines.push(`Exported from Molt on ${new Date().toLocaleString()}`);
  
  return lines.join('\n');
}

/**
 * Sanitize filename to remove invalid characters
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Copy conversation to clipboard as Markdown
 */
export async function copyToClipboard(conversation: Conversation): Promise<void> {
  const markdown = conversationToMarkdown(conversation);
  await navigator.clipboard.writeText(markdown);
}
```

**2. `src/components/Sidebar.tsx`** — Add export button to conversation context menu
```typescript
// Add to conversation right-click menu or three-dot menu
<DropdownMenuItem onClick={() => handleExport(conversation)}>
  <Download className="w-4 h-4 mr-2" />
  Export
</DropdownMenuItem>

// Export handler
const handleExport = async (conversation: Conversation) => {
  // Show export format dialog
  setExportDialogOpen(true);
  setConversationToExport(conversation);
};
```

**3. `src/components/ExportDialog.tsx`** — New dialog for export format selection
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Conversation } from '../stores/store';
import { exportAsMarkdown, exportAsJSON, exportAsText, copyToClipboard } from '../lib/export';
import { Download, Copy, FileText, FileJson, FileCode } from 'lucide-react';

interface ExportDialogProps {
  conversation: Conversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ conversation, open, onOpenChange }: ExportDialogProps) {
  if (!conversation) return null;

  const handleExport = async (format: 'markdown' | 'json' | 'text') => {
    try {
      switch (format) {
        case 'markdown':
          await exportAsMarkdown(conversation);
          break;
        case 'json':
          await exportAsJSON(conversation);
          break;
        case 'text':
          await exportAsText(conversation);
          break;
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Export failed:', err);
      // Show error toast
    }
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(conversation);
      onOpenChange(false);
      // Show success toast
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Conversation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleExport('markdown')}
          >
            <FileText className="w-4 h-4 mr-2" />
            Markdown (.md)
            <span className="ml-auto text-xs text-gray-500">Best for sharing</span>
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleExport('json')}
          >
            <FileJson className="w-4 h-4 mr-2" />
            JSON (.json)
            <span className="ml-auto text-xs text-gray-500">Full metadata</span>
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleExport('text')}
          >
            <FileCode className="w-4 h-4 mr-2" />
            Plain Text (.txt)
            <span className="ml-auto text-xs text-gray-500">Simple format</span>
          </Button>
          
          <div className="border-t pt-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleCopy}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy to Clipboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**4. `src/components/ChatView.tsx`** — Add export button to chat header
```typescript
// Add to chat header toolbar
<Button
  variant="ghost"
  size="sm"
  onClick={() => setExportDialogOpen(true)}
  title="Export conversation"
>
  <Download className="w-4 h-4" />
</Button>

<ExportDialog
  conversation={conversation}
  open={exportDialogOpen}
  onOpenChange={setExportDialogOpen}
/>
```

---

### Acceptance Criteria

✅ **AC1:** Export button appears in conversation context menu and chat header  
✅ **AC2:** Export dialog offers Markdown, JSON, and Plain Text formats  
✅ **AC3:** File save dialog opens with correct default filename  
✅ **AC4:** Exported Markdown includes title, timestamps, messages, thinking content  
✅ **AC5:** Exported JSON matches Conversation interface schema  
✅ **AC6:** Copy to clipboard works without file dialog  
✅ **AC7:** Filename sanitizes invalid characters (e.g., `/`, `:`, `<`, `>`)  
✅ **AC8:** Export shows success toast on completion  
✅ **AC9:** Export shows error toast on failure (e.g., permission denied)

---

### Test Plan

#### Unit Tests (`src/lib/export.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { conversationToMarkdown, conversationToText, sanitizeFilename } from './export';
import { Conversation } from '../stores/store';

describe('Export utilities', () => {
  const mockConversation: Conversation = {
    id: '1',
    title: 'Test Chat',
    messages: [
      { id: 'm1', role: 'user', content: 'Hello', timestamp: new Date('2025-01-28T10:00:00') },
      { id: 'm2', role: 'assistant', content: 'Hi there!', timestamp: new Date('2025-01-28T10:00:05'), modelUsed: 'claude-sonnet-4-5' }
    ],
    createdAt: new Date('2025-01-28T10:00:00'),
    updatedAt: new Date('2025-01-28T10:00:05'),
    thinkingEnabled: false,
    isPinned: false
  };

  it('should convert conversation to Markdown', () => {
    const markdown = conversationToMarkdown(mockConversation);
    
    expect(markdown).toContain('# Test Chat');
    expect(markdown).toContain('👤 **You**');
    expect(markdown).toContain('🤖 **Assistant**');
    expect(markdown).toContain('Hello');
    expect(markdown).toContain('Hi there!');
    expect(markdown).toContain('Model: claude-sonnet-4-5');
  });

  it('should convert conversation to plain text', () => {
    const text = conversationToText(mockConversation);
    
    expect(text).toContain('Test Chat');
    expect(text).toContain('You:');
    expect(text).toContain('Assistant:');
    expect(text).toContain('Hello');
    expect(text).toContain('Hi there!');
  });

  it('should sanitize filenames', () => {
    expect(sanitizeFilename('Test/Chat:2025')).toBe('Test-Chat-2025');
    expect(sanitizeFilename('Test<>Chat')).toBe('Test--Chat');
    expect(sanitizeFilename('Test Chat')).toBe('Test_Chat');
  });

  it('should handle empty conversations', () => {
    const emptyConv: Conversation = {
      ...mockConversation,
      messages: []
    };
    
    const markdown = conversationToMarkdown(emptyConv);
    expect(markdown).toContain('# Test Chat');
  });

  it('should include thinking content in Markdown', () => {
    const convWithThinking: Conversation = {
      ...mockConversation,
      messages: [
        ...mockConversation.messages,
        {
          id: 'm3',
          role: 'assistant',
          content: 'Complex answer',
          timestamp: new Date(),
          thinkingContent: 'Let me think about this...'
        }
      ]
    };
    
    const markdown = conversationToMarkdown(convWithThinking);
    expect(markdown).toContain('💭 Thinking process');
    expect(markdown).toContain('Let me think about this...');
  });
});
```

#### E2E Tests (`e2e/export.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

test.describe('Export Conversations', () => {
  test('should export conversation as Markdown', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    // Create a conversation
    await page.fill('[data-testid="chat-input"]', 'Test message');
    await page.press('[data-testid="chat-input"]', 'Enter');
    await page.waitForSelector('[data-testid="message-assistant"]');
    
    // Open export dialog
    await page.click('[title="Export conversation"]');
    await page.waitForSelector('text=Export Conversation');
    
    // Mock file save dialog (in real app, this opens native dialog)
    // In tests, we can verify the export function was called
    await page.click('text=Markdown (.md)');
    
    // Verify export dialog closed
    await expect(page.locator('text=Export Conversation')).not.toBeVisible();
  });

  test('should copy conversation to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    await page.goto('http://localhost:1420');
    
    // Create conversation
    await page.fill('[data-testid="chat-input"]', 'Clipboard test');
    await page.press('[data-testid="chat-input"]', 'Enter');
    await page.waitForSelector('[data-testid="message-assistant"]');
    
    // Export to clipboard
    await page.click('[title="Export conversation"]');
    await page.click('text=Copy to Clipboard');
    
    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('Clipboard test');
    expect(clipboardText).toContain('👤 **You**');
  });
});
```

---

### Edge Cases to Handle

⚠️ **Very long conversations** — Test with 100+ messages (performance)  
⚠️ **Special characters in title** — Ensure filename sanitization works  
⚠️ **Empty conversations** — Export should still work with header/footer  
⚠️ **Thinking content** — Include in Markdown, exclude from plain text  
⚠️ **Attachments** — Handle image/file attachments in export (future)  
⚠️ **Permission denied** — Graceful error if user can't write to location

---

### Success Metrics

📊 **Usage:** % of users who export at least one conversation  
📊 **Format preference:** Markdown vs JSON vs Text usage  
📊 **Frequency:** Exports per user per week

---

## Feature #3: Image Rendering in Messages

### Overview
Render images inline in chat messages. Enables viewing AI-generated images and uploaded image attachments.

### User Story
> "As a user, when the AI sends an image URL or I upload an image, I want to see it rendered inline so I don't have to copy-paste URLs into a browser."

### Implementation Complexity
🟢 **Low** — 4-6 hours

### Testing Complexity
🟢 **Low** — Snapshot tests with sample images

### User Impact
🔥 **High** — Essential for vision models and image generation

---

### Detailed Implementation Spec

#### Files to Modify

**1. `src/components/MessageBubble.tsx`** — Add image rendering logic
```typescript
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { ImageRenderer } from './ImageRenderer';

// Custom component for images
const components = {
  img: ImageRenderer,
  // ... existing code components
};

// In MessageBubble component
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeHighlight, rehypeSanitize]}
  components={components}
>
  {message.content}
</ReactMarkdown>
```

**2. `src/components/ImageRenderer.tsx`** — New component for image handling
```typescript
import { useState } from 'react';
import { ZoomIn, ZoomOut, X, Download } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageRendererProps {
  src?: string;
  alt?: string;
  title?: string;
}

export function ImageRenderer({ src, alt, title }: ImageRendererProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (!src) {
    return <span className="text-red-500">❌ Image source missing</span>;
  }

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = alt || 'image.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (hasError) {
    return (
      <div className="border border-red-300 dark:border-red-700 rounded p-4 text-sm">
        <p className="text-red-600 dark:text-red-400">❌ Failed to load image</p>
        {alt && <p className="text-gray-600 dark:text-gray-400 mt-1">{alt}</p>}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline mt-2 inline-block"
        >
          Open in new tab
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="relative inline-block max-w-full my-2">
        {/* Image */}
        <img
          src={src}
          alt={alt || 'Image'}
          title={title}
          className={cn(
            "max-w-full h-auto rounded-lg cursor-pointer transition-opacity",
            isLoading && "opacity-0"
          )}
          onLoad={handleLoad}
          onError={handleError}
          onClick={() => setIsLightboxOpen(true)}
          loading="lazy"
        />

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}

        {/* Hover overlay with actions */}
        {!isLoading && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors rounded-lg group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLightboxOpen(true);
                }}
                className="p-2 bg-white/90 dark:bg-black/90 rounded-full hover:bg-white dark:hover:bg-black transition-colors"
                title="Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="p-2 bg-white/90 dark:bg-black/90 rounded-full hover:bg-white dark:hover:bg-black transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setIsLightboxOpen(false)}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <img
            src={src}
            alt={alt || 'Image'}
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
```

**3. `src/stores/store.ts`** — Add image attachment support to Message interface
```typescript
// Already defined in the store:
export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  data?: string; // base64
  url?: string;
}

// Message interface already has:
export interface Message {
  // ... existing fields
  attachments?: Attachment[];
}

// No code changes needed, just validate the interface is used
```

**4. `src/components/AttachmentRenderer.tsx`** — Render attachments in messages
```typescript
import { Attachment } from '../stores/store';
import { ImageRenderer } from './ImageRenderer';
import { FileText, File } from 'lucide-react';

interface AttachmentRendererProps {
  attachments: Attachment[];
}

export function AttachmentRenderer({ attachments }: AttachmentRendererProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      {attachments.map(attachment => {
        // Image attachments
        if (attachment.mimeType.startsWith('image/')) {
          const src = attachment.url || `data:${attachment.mimeType};base64,${attachment.data}`;
          return (
            <ImageRenderer
              key={attachment.id}
              src={src}
              alt={attachment.filename}
            />
          );
        }

        // Non-image attachments (PDF, etc.)
        return (
          <div
            key={attachment.id}
            className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800"
          >
            {attachment.mimeType.includes('pdf') ? (
              <FileText className="w-5 h-5 text-red-500" />
            ) : (
              <File className="w-5 h-5 text-gray-500" />
            )}
            <span className="text-sm font-medium">{attachment.filename}</span>
            {attachment.url && (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-blue-600 dark:text-blue-400 text-sm underline"
              >
                Open
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**5. Update `MessageBubble.tsx`** to render attachments
```typescript
import { AttachmentRenderer } from './AttachmentRenderer';

// In MessageBubble component, after markdown content:
{message.attachments && message.attachments.length > 0 && (
  <AttachmentRenderer attachments={message.attachments} />
)}
```

---

### Acceptance Criteria

✅ **AC1:** Images in markdown (`![alt](url)`) render inline  
✅ **AC2:** Base64 data URIs render correctly  
✅ **AC3:** External URLs (https://) load and display  
✅ **AC4:** Click image opens lightbox (fullscreen view)  
✅ **AC5:** Lightbox has close button and click-outside-to-close  
✅ **AC6:** Loading spinner shows while image loads  
✅ **AC7:** Error state shows if image fails to load  
✅ **AC8:** Hover shows zoom/download buttons  
✅ **AC9:** Download button saves image to user's Downloads folder  
✅ **AC10:** Images lazy-load (don't block initial render)  
✅ **AC11:** Images respect max-width (don't overflow chat bubble)  
✅ **AC12:** Works in both light and dark themes

---

### Test Plan

#### Component Tests (`src/components/ImageRenderer.test.tsx`)

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageRenderer } from './ImageRenderer';

describe('ImageRenderer', () => {
  it('should render image with alt text', () => {
    render(<ImageRenderer src="https://example.com/image.png" alt="Test image" />);
    
    const img = screen.getByAltText('Test image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/image.png');
  });

  it('should show loading spinner initially', () => {
    render(<ImageRenderer src="https://example.com/image.png" />);
    
    // Image starts with opacity-0 while loading
    const img = screen.getByRole('img');
    expect(img).toHaveClass('opacity-0');
  });

  it('should open lightbox on click', async () => {
    render(<ImageRenderer src="https://example.com/image.png" alt="Test" />);
    
    const img = screen.getByAltText('Test');
    fireEvent.click(img);
    
    // Lightbox should appear
    await waitFor(() => {
      expect(screen.getAllByAltText('Test')).toHaveLength(2); // Original + lightbox
    });
  });

  it('should close lightbox on close button', async () => {
    render(<ImageRenderer src="https://example.com/image.png" alt="Test" />);
    
    // Open lightbox
    fireEvent.click(screen.getByAltText('Test'));
    
    // Close lightbox
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    
    await waitFor(() => {
      expect(screen.getAllByAltText('Test')).toHaveLength(1); // Only original
    });
  });

  it('should show error state on load failure', async () => {
    render(<ImageRenderer src="https://invalid-url.com/image.png" alt="Broken" />);
    
    const img = screen.getByAltText('Broken');
    fireEvent.error(img);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load image/i)).toBeInTheDocument();
    });
  });

  it('should handle base64 data URIs', () => {
    const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    render(<ImageRenderer src={base64} alt="Base64" />);
    
    const img = screen.getByAltText('Base64');
    expect(img).toHaveAttribute('src', base64);
  });
});
```

#### E2E Tests (`e2e/images.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Image Rendering', () => {
  test('should render images in markdown', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    // Simulate AI response with image
    // (In real app, this would come from Gateway)
    const markdownWithImage = 'Here is an image:\n\n![Test](https://via.placeholder.com/300)';
    
    // Mock the response (inject into store)
    await page.evaluate((md) => {
      const store = (window as any).__MOLT_STORE__;
      const conv = store.createConversation();
      store.addMessage(conv.id, { role: 'assistant', content: md });
    }, markdownWithImage);
    
    // Verify image rendered
    const img = page.locator('img[alt="Test"]');
    await expect(img).toBeVisible();
  });

  test('should open lightbox on image click', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    // Create message with image (similar to above)
    await page.evaluate(() => {
      const store = (window as any).__MOLT_STORE__;
      const conv = store.createConversation();
      store.addMessage(conv.id, {
        role: 'assistant',
        content: '![Test](https://via.placeholder.com/300)'
      });
    });
    
    // Click image
    await page.click('img[alt="Test"]');
    
    // Verify lightbox opened (z-50 fixed overlay)
    await expect(page.locator('.fixed.z-50')).toBeVisible();
  });

  test('should close lightbox with Escape key', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    // Open lightbox (same setup as above)
    await page.evaluate(() => {
      const store = (window as any).__MOLT_STORE__;
      const conv = store.createConversation();
      store.addMessage(conv.id, {
        role: 'assistant',
        content: '![Test](https://via.placeholder.com/300)'
      });
    });
    
    await page.click('img[alt="Test"]');
    await expect(page.locator('.fixed.z-50')).toBeVisible();
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Lightbox should close
    await expect(page.locator('.fixed.z-50')).not.toBeVisible();
  });
});
```

---

### Edge Cases to Handle

⚠️ **Very large images** — Add max-height to prevent layout issues  
⚠️ **Broken image URLs** — Show error state with fallback link  
⚠️ **CORS issues** — Can't download cross-origin images  
⚠️ **Base64 extremely long** — Ensure doesn't crash renderer  
⚠️ **Multiple images in one message** — Should all render correctly  
⚠️ **Animated GIFs** — Should animate, not static  
⚠️ **SVG images** — Should render (but sanitize for XSS)

---

### Success Metrics

📊 **Usage:** % of messages containing images  
📊 **Lightbox usage:** % of images clicked to zoom  
📊 **Load failures:** Error rate for image loading  
📊 **Performance:** Time to render images (P95 < 500ms)

---

## 5. Implementation Order & Timeline

### Phase 1: Quick Wins (Week 1)
**Goal:** Ship 3 high-impact features in 1 week

| Day | Feature | Hours | Deliverable |
|-----|---------|-------|-------------|
| **Mon** | #1 Regenerate Response | 3h | Implementation complete |
| **Mon** | #1 Regenerate Response | 2h | Tests written & passing |
| **Tue** | #2 Export Conversations | 4h | Implementation complete |
| **Tue** | #2 Export Conversations | 2h | Tests written & passing |
| **Wed** | #3 Image Rendering | 4h | Implementation complete |
| **Wed** | #3 Image Rendering | 2h | Tests written & passing |
| **Thu** | Integration Testing | 4h | E2E tests, bug fixes |
| **Fri** | Polish & Documentation | 4h | Update docs, edge cases |

**Total:** ~25 hours (1 week of focused work)

### Phase 2: Medium Complexity (Week 2-3)
**Goal:** Ship edit messages, file upload, keyboard nav

- **Edit & Retry Messages** — 1-2 days
- **File Upload (Images)** — 2-3 days
- **Enhanced Keyboard Navigation** — 1-2 days
- **Message Copy/Delete** — 1 day

**Total:** ~7-9 days

### Phase 3: V1.0 Blockers (Week 4-5)
**Goal:** Address remaining V1.0 must-haves

- **Error Handling Polish** — 1 day
- **Documentation** — 1 day
- **Bug fixes & QA** — 3 days

**Total:** ~5 days

### Phase 4: Advanced Features (Post-V1.0)
**Goal:** Differentiation features

- **Conversation Organization** (folders/tags) — 2-3 days
- **Auto-update System** — 3-5 days (needs manual testing)
- **Conversation Branching** — 4-5 days

---

## 6. Risk Assessment

### Low Risk ✅
- Regenerate response — Straightforward, existing patterns
- Export conversations — File I/O well-documented
- Image rendering — Standard markdown feature

### Medium Risk ⚠️
- Edit messages — State mutations could introduce bugs
- File upload — File system permissions, encoding issues
- Keyboard navigation — Browser compatibility, focus management

### High Risk 🔴
- Auto-update — Code signing, release infrastructure
- System tray — OS-specific, hard to test
- Voice I/O — Audio device access, quality issues

---

## 7. Dependencies & Blockers

### No Blockers (Ready to Start)
✅ Regenerate response  
✅ Export conversations  
✅ Image rendering  
✅ Message copy/delete  
✅ Keyboard navigation

### Minor Dependencies (Plugins Installed)
⚠️ File upload — Tauri fs plugin (✅ already in package.json)  
⚠️ Export file dialog — Tauri dialog plugin (✅ already in package.json)

### Major Dependencies (Need Setup)
🔴 Auto-update — GitHub Actions, code signing certificates  
🔴 System tray — OS-specific testing environments  
🔴 Voice — Audio backend (Whisper API, TTS service)

---

## 8. Testing Strategy

### Unit Tests (Vitest)
- **Store actions** — State mutations, persistence
- **Utilities** — Export formatting, sanitization
- **Components** — Isolated UI logic

### Component Tests (React Testing Library)
- **User interactions** — Clicks, keyboard input
- **Conditional rendering** — Error states, loading states
- **Props validation** — Edge cases

### E2E Tests (Playwright)
- **User flows** — Full journeys (send message → regenerate → export)
- **Integration** — Components working together
- **Visual regression** — Screenshot comparison (optional)

### Coverage Goals
- **Critical paths** — 90%+ coverage (chat, persistence, encryption)
- **UI components** — 70%+ coverage
- **Utilities** — 80%+ coverage

---

## 9. Success Criteria for V1.0 Launch

### Feature Completeness
✅ All "DO NOW" features shipped  
✅ All "DO NEXT" features shipped (except branching)  
✅ Error handling polished  
✅ Documentation complete

### Quality Metrics
✅ Test coverage >70%  
✅ E2E tests cover critical flows  
✅ No P0/P1 bugs in backlog  
✅ Performance: Cold start <2s, message render <100ms

### User Readiness
✅ User guide published  
✅ Troubleshooting docs complete  
✅ GitHub releases configured  
✅ Privacy policy published

---

## 10. Next Steps

### Immediate Actions (This Week)
1. ✅ Review this document with main agent
2. ⏭️ Implement Feature #1 (Regenerate Response)
3. ⏭️ Write tests for Feature #1
4. ⏭️ Ship to `main` branch
5. ⏭️ Repeat for Features #2 and #3

### Questions for Main Agent
- **Prioritization:** Agree with DO NOW → DO NEXT order?
- **Timeline:** Is 1 week for Phase 1 realistic?
- **Testing:** Should we add visual regression tests (Percy/Chromatic)?
- **Gateway:** Does current Gateway support file attachments? (For Feature #5)
- **Auto-update:** Do we have code signing certs? (For Phase 3)

---

## Appendix A: Feature Scoring Matrix

| Feature | Implementation | Testing | Impact | Dependencies | Score |
|---------|---------------|---------|--------|--------------|-------|
| Regenerate Response | 2h | 🟢 | 🔥 | None | **9.5** |
| Export Conversations | 6h | 🟢 | 🔥 | Tauri ✅ | **9.0** |
| Image Rendering | 6h | 🟢 | 🔥 | None | **9.0** |
| Message Copy/Delete | 8h | 🟢 | 🟡 | None | **7.5** |
| Edit Messages | 16h | 🟡 | 🔥 | None | **8.5** |
| File Upload | 24h | 🟡 | 🔥 | Tauri ✅ | **8.0** |
| Keyboard Nav | 16h | 🟢 | 🟡 | None | **7.0** |
| Conversation Org | 24h | 🟡 | 🔥 | None | **8.0** |
| Auto-update | 40h | 🔴 | 🟡 | Infra | **5.0** |
| System Tray | 24h | 🔴 | 🟢 | OS APIs | **4.0** |
| Voice I/O | 56h | 🔴 | 🟡 | Backend | **4.5** |
| Branching | 40h | 🟡 | 🔥 | None | **7.0** |

**Scoring formula:**  
`Score = (Impact × 3) + (10 - Implementation hrs / 4) + (Testing complexity bonus) - (Dependency penalty)`

Higher score = higher priority

---

## Appendix B: Competitor Feature Parity Checklist

### Table Stakes (Must Match)
- [x] Real-time streaming
- [x] Conversation history
- [x] Search
- [x] Model selection
- [ ] **Regenerate response** ← Feature #1
- [ ] **Edit messages** ← Feature #4
- [ ] **File upload** ← Feature #5
- [ ] **Export** ← Feature #2
- [x] Dark mode
- [x] Keyboard shortcuts (basic)

### Differentiation (Better Than Competitors)
- [x] Multi-model support ✨
- [x] Lightweight (Tauri) ✨
- [x] Better encryption ✨
- [ ] **Folders/tags** ← Feature #8 ✨
- [ ] **Conversation branching** ← Parked ✨
- [x] Local-first ✨

### Nice-to-Have (Post-V1.0)
- [ ] Voice input/output
- [ ] System tray
- [ ] Always-on-top
- [ ] Mobile apps
- [ ] Plugin system

---

**End of NEXT_FEATURES.md**

*This document is a living plan. Update as priorities shift, new features are proposed, or technical constraints change.*
