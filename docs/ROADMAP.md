# Moltzer client - Product Roadmap

**Last updated:** 2025-01-23  
**Status:** Pre-release (1.0.0-dev)

---

## ?? Current State Analysis

### ? What's Working Well

**Core Infrastructure:**
- ? **Gateway WebSocket Connection** — Robust connection with automatic protocol fallback (ws?wss), exponential backoff retry logic
- ? **Tauri v2 Backend** — Native Rust backend with efficient WebSocket handling
- ? **React + TypeScript Frontend** — Modern UI with Zustand state management
- ? **Cross-platform Support** — Windows, macOS, Linux builds configured

**Chat Features:**
- ? **Streaming Responses** — Real-time message streaming with proper state handling
- ? **Conversation Management** — Create, delete, select, pin conversations
- ? **Model Selection** — Dynamic model picker with auto-refresh from gateway
- ? **Thinking Mode** — Extended reasoning toggle per conversation
- ? **Markdown Rendering** — Full markdown with GFM (tables, strikethrough) via react-markdown
- ? **Code Highlighting** — Syntax highlighting with copy-to-clipboard for code blocks
- ? **Message Metadata** — Timestamps, model used, relative time display

**Storage & Security:**
- ? **IndexedDB Persistence** — Dexie-based local database
- ? **End-to-End Encryption** — All messages and conversation titles encrypted at rest (Web Crypto API)
- ? **Search Functionality** — Full-text search across encrypted messages
- ? **Keychain Integration** — Native credential storage (macOS Keychain, Windows Credential Manager, Linux Secret Service)

**UX Polish:**
- ? **Onboarding Flow** — First-launch setup wizard for gateway configuration
- ? **Dark/Light/System Theme** — Respects system appearance preferences
- ? **Pinned Conversations** — Keep important chats at the top
- ? **Auto-generated Titles** — Conversations auto-title from first user message
- ? **Connection Status UI** — Visual feedback for connection state, retry countdown
- ? **Keyboard Shortcuts** — `Cmd/Ctrl + \` toggles sidebar, `Cmd/Ctrl + K` opens search
- ? **Toast Notifications** — In-app toast system for errors and success messages
- ? **Window State Persistence** — Remembers window size/position between launches

**Developer Experience:**
- ? **Testing Setup** — Vitest + React Testing Library configured
- ? **Linting & Formatting** — ESLint + Prettier
- ? **TypeScript Strict Mode** — Type-safe development

---

### ?? Gaps vs. Competitors

**Compared to ChatGPT Desktop, Cursor, Windsurf, etc.:**

1. **File Attachments** — UI exists but not fully wired up (Tauri fs plugin needed)
2. **Voice Input/Output** — No voice recording or TTS playback
3. **Image Display** — Can't render AI-generated images or view uploaded images
4. **Export/Share** — No way to export conversations or share them with others
5. **Multi-device Sync** — No cloud sync (desktop-only, no mobile)
6. **Context Management** — No way to attach persistent context files/folders (like Cursor's @workspace)
7. **Regenerate Responses** — Can't retry or regenerate last response
8. **Edit Messages** — Can't edit sent messages and re-run
9. **Branch Conversations** — No way to fork from a specific message
10. **System Tray** — App must stay open in dock/taskbar
11. **Keyboard Navigation** — Limited keyboard-only navigation
12. **Plugin System** — No extensibility for third-party integrations
13. **Analytics/Insights** — No usage stats, token counting, or cost tracking

---

## ?? V1.0 Must-Haves (MVP for Public Release)

**Goal:** Ship a polished, reliable desktop client that covers 80% of daily AI chat needs.

### Critical

- [ ] **File Upload Implementation**
  - Wire up file attachment UI to Tauri fs plugin
  - Support images (PNG, JPG, WEBP), PDFs, text files
  - Display image thumbnails in chat
  - Base64 encode and send to gateway
  - Test with Claude Vision models

- [ ] **Image Rendering**
  - Detect image URLs in responses
  - Render inline images from markdown `![alt](url)`
  - Support both base64 data URIs and external URLs
  - Lightbox/zoom for large images

- [ ] **Regenerate Response**
  - Add "Regenerate" button to last assistant message
  - Re-send last user message with same parameters
  - Show loading state during regeneration
  - Replace old response with new one

- [ ] **Edit & Retry Messages**
  - Edit button on user messages
  - Re-run conversation from edited point
  - Show "edited" indicator
  - Optionally branch or replace

- [ ] **Export Conversations**
  - Export as Markdown (`.md`)
  - Export as JSON (with metadata)
  - Export as plain text
  - "Copy conversation" to clipboard

- [ ] **Error Handling Polish**
  - Better error messages (network, auth, quota)
  - Retry failed messages
  - Graceful degradation when models unavailable
  - Connection recovery UX improvements

- [ ] **Auto-update System**
  - Configure Tauri updater plugin
  - Generate signing keys
  - Set up GitHub releases with `latest.json`
  - In-app update notifications

- [ ] **Documentation**
  - User guide (setup, features, troubleshooting)
  - Developer setup instructions
  - Contributing guidelines
  - Privacy policy (for app stores)

### Nice-to-Have (V1.0)

- [ ] **Keyboard Navigation**
  - Tab through conversations
  - Arrow keys to navigate chat history
  - `Cmd/Ctrl + N` for new chat
  - `Cmd/Ctrl + ,` for settings

- [ ] **Message Actions**
  - Copy message button (in addition to code copy)
  - Delete individual messages
  - Pin important messages within a conversation

- [ ] **Conversation Organization**
  - Sort options (date, alphabetical, pinned)
  - Archive old conversations
  - Bulk delete/export

- [ ] **System Tray / Menu Bar**
  - Quick open/hide via system tray
  - Minimize to tray option
  - System tray icon shows notification badge

---

## ?? V1.1 Quick Wins (Post-Launch Polish)

**Goal:** Address user feedback, improve UX, fix bugs. Low-effort, high-impact.

### UX Improvements

- [ ] **Enhanced Search**
  - Search filters (date range, model, role)
  - Highlight search terms in results
  - Search keyboard shortcuts (arrow keys to navigate)
  - Save recent searches

- [ ] **Better Markdown Support**
  - LaTeX math rendering (KaTeX)
  - Mermaid diagram support
  - Better table styling
  - Collapsible code blocks (for long code)

- [ ] **Conversation Templates**
  - Pre-defined system prompts (coding assistant, creative writing, etc.)
  - Save custom templates
  - "Start from template" in new chat

- [ ] **Quick Actions**
  - "Summarize this" button on long messages
  - "Translate to..." dropdown
  - "Simplify" / "Elaborate" quick edits

- [ ] **Accessibility**
  - Screen reader support (ARIA labels)
  - Keyboard-only navigation improvements
  - High contrast mode
  - Font size preferences

### Performance

- [ ] **Lazy Loading**
  - Virtualized message list for long conversations
  - Paginated conversation list
  - Lazy-load old messages on scroll

- [ ] **Caching**
  - Cache model list (refresh every 10min)
  - Cache gateway connection state
  - Debounce auto-save during typing

- [ ] **Bundle Size Optimization**
  - Code-split UI components
  - Optimize dependencies (highlight.js, markdown)
  - Target <8MB binary size

### Bug Fixes (From User Reports)

- [ ] Audit and fix any crash reports
- [ ] Test edge cases (very long messages, special characters, network interruptions)
- [ ] Memory leak investigation (long-running sessions)
- [ ] Cross-platform UI consistency (font rendering, colors)

---

## ?? V2.0 Major Features (3-6 Month Horizon)

**Goal:** Transform Moltzer into a team-ready, extensible AI platform.

### Multi-User & Collaboration

- [ ] **Team Workspaces**
  - Shared conversation spaces
  - Role-based access (admin, member, viewer)
  - Per-workspace gateway configuration
  - Team model quotas

- [ ] **Conversation Sharing**
  - Generate shareable links (read-only)
  - Publicly published conversations (optional)
  - Embed conversations on web pages
  - Password-protected shares

- [ ] **Collaboration Features**
  - Real-time co-editing (like Google Docs comments)
  - @mention team members in messages
  - Threaded discussions on responses
  - Approval workflows for sensitive prompts

### Voice & Audio

- [ ] **Voice Input**
  - Press-and-hold to record (like WhatsApp)
  - Transcribe via Whisper API or gateway
  - Auto-send transcription as message
  - Language detection

- [ ] **Voice Output (TTS)**
  - Play assistant responses as audio
  - Multiple voice options (ElevenLabs, OpenAI TTS)
  - Adjustable speed, pause/resume
  - Auto-play toggle

- [ ] **Voice Conversations**
  - "Walkie-talkie" mode (voice in ? voice out)
  - Continuous conversation mode
  - Background recording (while multitasking)

### Context Management

- [ ] **Persistent Context Files**
  - Attach files/folders as context (like Cursor's `@workspace`)
  - Auto-index local codebases
  - Markdown knowledge bases
  - PDF/document libraries

- [ ] **Knowledge Bases**
  - RAG integration (vector search)
  - Import from Notion, Obsidian, Google Docs
  - Auto-refresh on file changes
  - Per-conversation context scopes

- [ ] **Web Context**
  - Fetch and include URLs in context
  - "Browse the web" integration
  - Summarize web pages
  - Cite sources in responses

### Plugin System

- [ ] **Plugin Architecture**
  - JavaScript/TypeScript plugin API
  - Sandboxed execution (Tauri IPC)
  - Access to conversation, messages, settings
  - UI injection points (sidebar, message actions)

- [ ] **Official Plugins**
  - GitHub integration (create issues, PRs, search code)
  - Notion integration (save conversations as pages)
  - Google Drive export
  - Slack/Discord bot forwarding

- [ ] **Plugin Marketplace**
  - In-app plugin browser
  - One-click install
  - Auto-updates
  - Community ratings/reviews

### Advanced Chat Features

- [ ] **Branching Conversations**
  - Fork from any message
  - Visualize conversation tree
  - Compare branches side-by-side
  - Merge branches

- [ ] **Prompt Library**
  - Save and organize reusable prompts
  - Variables in prompts (`{{project}}`, `{{language}}`)
  - Share prompt collections
  - Import from PromptBase, etc.

- [ ] **Multi-Model Conversations**
  - Run same prompt across multiple models
  - Compare responses side-by-side
  - Voting/ranking UI
  - Ensemble mode (aggregate responses)

- [ ] **Advanced Settings**
  - Temperature, top-p, max tokens controls
  - Custom system prompts per conversation
  - Token usage tracking & limits
  - Cost estimation (for API models)

### Analytics & Insights

- [ ] **Usage Dashboard**
  - Messages sent per day/week/month
  - Favorite models, topics
  - Time saved estimates
  - Token consumption charts

- [ ] **Conversation Insights**
  - Auto-tag conversations by topic
  - Sentiment analysis
  - Key insight extraction
  - Smart conversation recommendations

- [ ] **Export & Reporting**
  - CSV export of usage data
  - Team analytics (for workspaces)
  - Custom reports

---

## ?? Future Considerations (12+ Months)

**Goal:** Expand Moltzer ecosystem beyond desktop.

### Mobile Apps

- [ ] **Tauri Mobile Support**
  - iOS app (Tauri v2 + Swift)
  - Android app (Tauri v2 + Kotlin)
  - Native mobile UI (bottom sheets, gestures)
  - Push notifications

- [ ] **Mobile-Specific Features**
  - Camera integration (photo capture ? upload)
  - Siri/Google Assistant shortcuts
  - Widget (recent conversations)
  - Offline mode (queue messages)

### Browser Extension

- [ ] **Chrome/Firefox Extension**
  - Right-click ? "Ask Moltzer"
  - Sidebar chat overlay
  - Page context injection
  - Sync with desktop app

- [ ] **Web Clipper**
  - Save web pages to conversations
  - Annotate and highlight
  - Auto-summarize articles

### Integrations

- [ ] **IDE Plugins**
  - VS Code extension
  - JetBrains plugin
  - Vim/Neovim integration
  - Inline code suggestions

- [ ] **Productivity Tools**
  - Calendar integration (Moltzer joins meetings)
  - Email assistant (draft replies)
  - Task manager integration (Todoist, Asana)
  - Note-taking apps (Notion, Obsidian)

- [ ] **Communication Platforms**
  - Slack bot
  - Discord bot
  - Microsoft Teams integration
  - Email gateway (email ? Moltzer)

### Enterprise Features

- [ ] **Self-Hosted Gateway**
  - On-premises gateway deployment
  - SSO/SAML authentication
  - Compliance logging (GDPR, SOC2)
  - Audit trails

- [ ] **Admin Dashboard**
  - User management
  - Usage quotas & billing
  - Policy enforcement (content filtering)
  - Model access control

- [ ] **Security Enhancements**
  - Hardware security key support (YubiKey)
  - Biometric auth (TouchID, FaceID, Windows Hello)
  - DLP (data loss prevention)
  - End-to-end encrypted cloud sync

### AI Innovation

- [ ] **Agentic Features**
  - Multi-step task execution
  - Tool use (calculator, web search, code execution)
  - Background agents (scheduled tasks)
  - Workflow automation

- [ ] **Multimodal**
  - Video understanding (upload MP4)
  - Screen recording analysis
  - Live screen sharing with AI
  - Whiteboard collaboration

- [ ] **Memory & Personalization**
  - Long-term memory across conversations
  - User preference learning
  - Auto-summarize old conversations
  - Proactive suggestions

---

## ?? Release Strategy

### V1.0 MVP (Target: Q1 2025)
- Focus: Stability, core features, polish
- Platforms: Windows, macOS, Linux
- Distribution: GitHub Releases, direct download
- Marketing: Product Hunt launch, HackerNews Show HN

### V1.1 Quick Wins (Target: Q2 2025)
- Focus: User feedback, bug fixes, UX improvements
- Iteration speed: Ship updates every 2 weeks
- Metrics: Daily active users, crash rates, feature usage

### V2.0 Major Features (Target: Q3-Q4 2025)
- Focus: Team features, plugins, voice
- Beta program: Early access for power users
- Revenue model: Freemium (basic free, team features paid)

### V3.0+ Long-Term (2026+)
- Focus: Mobile, enterprise, ecosystem
- Partnerships: IDE vendors, productivity tools
- Expansion: International markets, localization

---

## ??? Technical Debt & Refactoring

### Known Issues
- [ ] Improve test coverage (currently minimal)
- [ ] Add E2E tests (Playwright or Tauri WebDriver)
- [ ] Refactor gateway.rs (split into modules)
- [ ] Optimize encryption (consider libsodium instead of Web Crypto)
- [ ] Better error types (replace String errors with enums)
- [ ] State management audit (consider migrating to React Context + useReducer for simpler state)

### Code Quality
- [ ] Add JSDoc comments to all public APIs
- [ ] Document architecture decisions (ADRs)
- [ ] Performance benchmarks (message rendering, search)
- [ ] Security audit (third-party review)

---

## ?? Contributing

This roadmap is a living document. Contributions welcome!

- **Feature Requests:** Open an issue with the `enhancement` label
- **Bug Reports:** Open an issue with the `bug` label
- **Pull Requests:** Check out `CONTRIBUTING.md` for guidelines

**Priorities are subject to change** based on user feedback, technical feasibility, and market conditions.

---

## ?? Feedback

Have thoughts on this roadmap? Let us know!

- GitHub Discussions: [Roadmap Discussion](https://github.com/dokterdok/molt-client/discussions)
- Discord: [Moltzer Community](https://discord.gg/Moltzer) *(placeholder)*
- Email: feedback@Moltzer.app *(placeholder)*

---

**Last updated:** 2025-01-23  
**Roadmap maintained by:** Moltzer Core Team
