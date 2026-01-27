# Moltzer Features

Complete documentation of all Moltzer features, keyboard shortcuts, and settings.

---

## Table of Contents

- [Chat Features](#chat-features)
- [Conversation Management](#conversation-management)
- [Search](#search)
- [Model Selection](#model-selection)
- [Thinking Mode](#thinking-mode)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Settings](#settings)
- [Data & Storage](#data--storage)

---

## Chat Features

### Streaming Responses

**What it does:** See AI responses appear in real-time as they're generated.

- No waiting for the full response
- Cancel mid-stream if needed (close conversation or start new message)
- Smooth, typewriter-like effect
- Automatic scroll to bottom as content arrives

**Visual indicators:**
- Pulsing cursor while streaming
- "AI is typing..." animation
- Progress indicator for long responses

### Rich Markdown Rendering

Moltzer supports full GitHub-flavored markdown:

**Text formatting:**
- **Bold** (`**text**`)
- *Italic* (`*text*`)
- ~~Strikethrough~~ (`~~text~~`)
- `Inline code` (`` `code` ``)

**Code blocks with syntax highlighting:**
````markdown
```python
def hello_world():
    print("Hello from Moltzer!")
```
````

Supported languages: Python, JavaScript, TypeScript, Rust, Go, Java, C++, SQL, Shell, and 50+ more.

**Lists:**
- Unordered lists (bullets)
1. Ordered lists (numbered)
- [x] Task lists with checkboxes

**Tables:**
| Feature | Supported |
|---------|-----------|
| Tables | ✅ |
| Alignment | ✅ |

**Links and images:**
- [Clickable links](https://example.com)
- Auto-linked URLs
- Embedded images *(coming soon)*

**Blockquotes:**
> Quoted text with proper formatting

### Code Block Features

**Copy button:**
- Hover over any code block
- Click copy icon in top-right
- Automatic clipboard copy with success feedback

**Syntax highlighting:**
- Automatic language detection
- Over 50 languages supported
- Dark/light theme aware

**Line numbers:** *(coming soon)*
- Optional line numbers
- Click to select range

### Message Actions

**Per-message actions:**
- **Copy message** — Copy full markdown content
- **Copy code** — Extract all code blocks
- **Regenerate** *(coming soon)* — Re-run the query
- **Edit** *(coming soon)* — Modify and resubmit

### Input Features

**Multi-line input:**
- **Enter** to send
- **Shift+Enter** for new line
- Auto-expanding textarea (up to 10 lines)
- Preserves formatting

**Smart paste:**
- Paste code blocks automatically formatted
- Multi-line paste support
- Preserve indentation

**Draft persistence:** *(coming soon)*
- Unsent messages saved automatically
- Resume typing after restart

### File Attachments

**Status:** UI implemented, functionality coming in v1.1

**Planned support:**
- Images (PNG, JPG, WebP, GIF)
- Documents (PDF, TXT, MD)
- Code files (Python, JS, etc.)
- Drag & drop upload
- Preview before sending

---

## Conversation Management

### Creating Conversations

**New conversation:**
- Click "New Chat" button
- Press **⌘N** (Mac) or **Ctrl+N** (Windows/Linux)
- Automatically selects the new conversation

**Auto-generated titles:**
- First user message becomes the conversation title
- Truncated to 40 characters
- Editable *(coming soon)*

### Organizing Conversations

**Pinned conversations:**
- Pin important chats to the top
- Click pin icon in conversation list
- Pinned section stays visible even with filters
- Unpin by clicking again

**Sorting:**
- Recent conversations sorted by last update
- Pinned conversations sorted separately
- No manual sorting yet *(coming soon)*

### Deleting Conversations

**Delete a conversation:**
1. Hover over conversation in sidebar
2. Click "..." menu
3. Select "Delete"
4. Confirm deletion *(if enabled in settings)*

**Keyboard shortcut:**
- Select conversation
- Press **Delete** or **Backspace**

**⚠️ Warning:** Deletion is permanent! Encrypted data cannot be recovered.

### Conversation Context

**Preserved context:**
- Full message history maintained
- Model used for each message
- Timestamps
- Thinking mode state

**Context window:**
- Gateway manages context limits
- Older messages may be summarized by Gateway
- No artificial limits in Moltzer

---

## Search

### Quick Filter

**Location:** Top of sidebar

**What it does:** Filter conversations by title or content

**How to use:**
1. Type in "Filter conversations..." input
2. Results update instantly
3. Searches both titles and message content
4. Case-insensitive

**Example:**
```
Type "python" → Shows all conversations mentioning Python
```

### Global Search

**Open search:** Press **⌘K** (Mac) or **Ctrl+K** (Windows/Linux)

**Features:**
- Full-text search across ALL messages
- Instant results as you type
- Shows matching messages with context
- Click result to jump to conversation
- Highlights matching text

**Search tips:**
- Multiple words: `python code review`
- Exact phrases: Use quotes *(coming soon)*
- Exclude words: Use `-word` *(coming soon)*

**Performance:**
- IndexedDB-powered
- Handles 100,000+ messages
- Sub-100ms search times
- Respects encrypted data (searches decrypted content)

### Search Results

**Result display:**
- Conversation title
- Message preview with highlighted match
- Timestamp (relative: "2 hours ago")
- User vs AI indicator

**Navigation:**
- **↑/↓** arrows to navigate results
- **Enter** to jump to conversation
- **Esc** to close search

---

## Model Selection

### Choosing Models

**Where:** Settings → Default Model

**Available models:**
- Fetched automatically from your Gateway
- Falls back to common models if Gateway unreachable
- Grouped by provider (Anthropic, OpenAI, Google, etc.)

**Popular models:**
- **Claude Sonnet 4.5** — Balanced intelligence and speed
- **Claude Opus 4.5** — Maximum intelligence for complex tasks
- **Claude Haiku 4** — Fast and affordable
- **GPT-4o** — OpenAI's latest
- **Gemini 2.5 Pro** — Google's flagship

### Per-Conversation Models

**Status:** Coming in v1.1

**Planned:**
- Switch models mid-conversation
- Model indicator in message bubble
- Compare responses across models

### Default Model

**Setting the default:**
1. Open Settings (**⌘,**)
2. Go to "Chat Settings"
3. Select from dropdown
4. Save changes

**Effect:**
- All new conversations use this model
- Existing conversations keep their original model

---

## Thinking Mode

### What is Thinking Mode?

Extended reasoning mode that allows Claude to "think" before responding.

**Use cases:**
- Complex problem-solving
- Multi-step reasoning
- Code review and debugging
- Mathematical proofs
- Strategic planning

**How it works:**
1. Enable "Thinking" for conversation
2. Claude shows its thought process
3. Separate "thinking" and "response" sections
4. Takes longer but produces better results

### Enabling Thinking Mode

**Default for all conversations:**
1. Settings → Chat Settings
2. Toggle "Enable Thinking by Default"
3. Save changes

**Per-conversation:** *(coming soon)*
- Toggle in chat header
- Only affects current conversation

### Thinking Display

**Visual indicators:**
- 🧠 Thinking indicator during response
- Collapsible "Thinking" section
- Final response highlighted
- Token usage displayed *(if Gateway provides)*

---

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| **⌘N** / **Ctrl+N** | New conversation | Anywhere |
| **⌘K** / **Ctrl+K** | Search messages | Anywhere |
| **⌘,** / **Ctrl+,** | Open settings | Anywhere |
| **⌘\\** / **Ctrl+\\** | Toggle sidebar | Anywhere |
| **⌘W** / **Ctrl+W** | Close window | Anywhere |
| **⌘Q** / **Ctrl+Q** | Quit Moltzer | Anywhere |

### Chat Input Shortcuts

| Shortcut | Action |
|----------|--------|
| **Enter** | Send message |
| **Shift+Enter** | New line (multi-line) |
| **Esc** | Clear input |
| **⌘V** / **Ctrl+V** | Paste (smart formatting) |

### Conversation List Shortcuts

| Shortcut | Action |
|----------|--------|
| **↑** / **↓** | Navigate conversations |
| **Enter** | Open selected conversation |
| **Delete** / **Backspace** | Delete conversation |
| **Space** | Pin/unpin conversation |

### Search Dialog Shortcuts

| Shortcut | Action |
|----------|--------|
| **↑** / **↓** | Navigate results |
| **Enter** | Jump to conversation |
| **Esc** | Close search |
| **⌘K** / **Ctrl+K** | Focus search input |

### macOS-Specific

| Shortcut | Action |
|----------|--------|
| **⌘H** | Hide Moltzer |
| **⌘M** | Minimize window |
| **⌘⌥I** | Open developer tools |

### Windows/Linux-Specific

| Shortcut | Action |
|----------|--------|
| **Alt+F4** | Close window |
| **F11** | Fullscreen |
| **Ctrl+Shift+I** | Open developer tools |

---

## Settings

### Gateway Connection

**Gateway URL:**
- WebSocket endpoint (e.g., `ws://localhost:18789`)
- Automatic `wss://` fallback if `ws://` fails
- Validates format on save

**Authentication Token:**
- Optional (required if Gateway has auth enabled)
- Stored securely in OS keychain
- Never displayed in plain text after entry
- Password field with reveal toggle

**Test Connection:**
- Verifies Gateway is reachable
- Checks authentication
- Fetches available models
- Shows protocol used (ws:// or wss://)

### Chat Settings

**Default Model:**
- Model used for new conversations
- Dropdown populated from Gateway
- Falls back to common models if offline

**Enable Thinking by Default:**
- Toggle on/off
- Applies to new conversations only
- Can be overridden per-conversation *(coming soon)*

### Appearance

**Theme:**
- **Light** — Always light mode
- **Dark** — Always dark mode
- **System** — Follows OS preference (recommended)

**Theme switching:**
- Instant theme change on selection
- Persists across restarts
- Applies to all windows

**Customization:** *(coming soon)*
- Custom accent colors
- Font size adjustment
- Compact/comfortable density

### Advanced Settings

**Developer Tools:**
- **⌘⌥I** (Mac) or **Ctrl+Shift+I** (Windows/Linux)
- Inspect UI, debug issues
- View console logs

**Storage:**
- View encrypted data size
- Export conversations *(coming soon)*
- Clear local data (⚠️ permanent!)

**Updates:**
- Auto-check for updates *(coming soon)*
- Download in background
- Prompt to install on restart

---

## Data & Storage

### Local Storage

**What's stored locally:**
- All conversations (encrypted)
- All messages (encrypted)
- Settings (NOT encrypted — no sensitive data)
- Model preferences
- UI state (sidebar, theme, etc.)

**Storage size:**
- Minimal: ~100KB for 100 messages
- Typical: 1-5MB for active users
- No hard limits — IndexedDB can handle gigabytes

**Location:**
- **macOS:** `~/Library/Application Support/com.moltzer.client/`
- **Windows:** `%APPDATA%\com.moltzer.client\`
- **Linux:** `~/.local/share/com.moltzer.client/`

### Encryption

**What's encrypted:**
- Conversation titles
- Message content
- Thinking content
- Any user-generated text

**What's NOT encrypted:**
- Settings (Gateway URL, model preferences, theme)
- Metadata (timestamps, message IDs)
- Search index (plaintext for performance)

**Encryption method:**
- AES-GCM 256-bit
- Unique IV (nonce) per message
- Master key stored in OS keychain

**See [SECURITY.md](SECURITY.md) for full details.**

### Sync & Backup

**Current status:**
- No cloud sync (local-only)
- No automatic backups

**Planned features:**
- Export conversations to Markdown
- Import/export encrypted backups
- Optional cloud sync (end-to-end encrypted)

**Manual backup:**
1. Copy the data directory (see "Location" above)
2. Restore by copying back

### Data Privacy

**What leaves your device:**
- Messages sent to Gateway (encrypted in transit)
- Model selections (for inference)
- **Nothing else!**

**What does NOT leave your device:**
- Conversation history (except current message)
- Search queries
- Settings
- Encryption keys

**No telemetry:**
- Moltzer does not track usage
- No analytics or crash reports (unless you opt in)
- No ads, ever

---

## Accessibility

### Screen Reader Support

**Status:** Partial (improving)

**What works:**
- Conversation list navigation
- Message reading
- Button labels and hints

**What needs improvement:**
- Code block navigation
- Search results
- Real-time streaming announcements

### Keyboard Navigation

**Fully keyboard-navigable:**
- All actions accessible via keyboard
- No mouse required
- Focus indicators on all interactive elements

### Visual Accessibility

**High contrast mode:**
- Respects OS high contrast settings
- Sufficient color contrast (WCAG AA)

**Font scaling:** *(coming soon)*
- Respects OS font size settings
- Manual font size override

---

## Performance

### Optimization Features

**Debounced persistence:**
- Messages saved every 500ms during streaming
- Prevents excessive database writes
- No data loss on crash

**Virtual scrolling:** *(coming soon)*
- Render only visible messages
- Handle 10,000+ message conversations
- Smooth 60fps scrolling

**Lazy loading:**
- Load conversations on demand
- Decrypt only when needed
- Instant startup even with 1000+ conversations

### Performance Tips

**For large conversations:**
- Use search instead of scrolling
- Archive old conversations *(coming soon)*

**For slow devices:**
- Disable animations *(coming soon)*
- Use light theme (slightly faster rendering)

---

## Upcoming Features

### Planned for v1.1
- [ ] File attachments (images, PDFs, documents)
- [ ] Per-conversation model switching
- [ ] Edit and regenerate messages
- [ ] Export to Markdown/PDF
- [ ] Voice input

### Planned for v1.2
- [ ] Voice output (TTS)
- [ ] System tray integration
- [ ] Global hotkey (show/hide Moltzer)
- [ ] Multi-window support
- [ ] Conversation sharing

### Future (v2.0+)
- [ ] Plugins/extensions
- [ ] Custom themes
- [ ] Mobile apps (iOS, Android)
- [ ] End-to-end encrypted sync
- [ ] Collaborative conversations

---

## Limitations

### Current Limitations

**File attachments:**
- UI exists but not functional
- Planned for v1.1

**Voice input/output:**
- Not yet implemented
- Planned for v1.1/v1.2

**Image generation:**
- Gateway may support it
- Moltzer doesn't display images yet
- Planned for v1.2

**Context limits:**
- Managed by Gateway, not Moltzer
- No visual indicator of context usage
- Planned for v1.1

### Known Issues

See [GitHub Issues](https://github.com/dokterdok/moltzer-client/issues) for full list.

---

## Tips & Tricks

### Power User Tips

1. **Quick new chat:** **⌘N** is your friend — use it liberally!
2. **Search everything:** **⌘K** to find any past conversation
3. **Pin important chats:** Keep your most-used conversations at the top
4. **Multi-line messages:** Use **Shift+Enter** for code snippets
5. **Copy code fast:** Hover over code blocks for instant copy button

### Workflow Optimization

**For developers:**
- Pin your "Code Review" and "Debug" conversations
- Use Thinking Mode for complex refactoring
- Copy code blocks directly to your editor

**For researchers:**
- Create separate conversations per topic
- Use search to find past research
- Export conversations for notes *(coming soon)*

**For writers:**
- Pin your "Writing Assistant" conversation
- Use different models for different styles
- Keep drafts in separate conversations

---

## Questions?

- **General help:** See [SETUP.md](SETUP.md)
- **Security questions:** See [SECURITY.md](SECURITY.md)
- **Contributing:** See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Report issues:** [GitHub Issues](https://github.com/dokterdok/moltzer-client/issues)
