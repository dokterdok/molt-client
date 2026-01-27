# Architecture Decisions: Moltzer client vs Clawdbot Gateway

**Last updated:** 2026-01-27  
**Purpose:** Define clear boundaries between client and server responsibilities based on Clawdbot Gateway capabilities

---

## Executive Summary

Clawdbot Gateway is a **feature-complete WebSocket server** that handles:
- Multi-agent routing and session management
- All AI tool execution (browser, filesystem, shell, canvas, nodes)
- Authentication, authorization, and security
- Message delivery across channels (WhatsApp, Telegram, Discord, etc.)
- HTTP APIs (OpenAI-compatible, OpenResponses, Tools Invoke)

**Moltzer client should be a thin UI layer** that focuses exclusively on:
- Chat interface and user experience
- Local data caching for performance
- OS-native integrations (keychain, notifications, menu bar)

---

## 1. Gateway Capabilities Analysis

### 1.1 Core Features

| Feature | Gateway Support | Notes |
|---------|----------------|-------|
| **WebSocket Protocol** | ✅ Full | Typed protocol with JSON Schema validation |
| **Session Management** | ✅ Full | Per-agent sessions, auto-reset policies, main/group/DM routing |
| **Multi-Agent Routing** | ✅ Full | Isolated agents with separate workspaces, auth, sessions |
| **Message History** | ✅ Full | JSONL transcripts per session, stored server-side |
| **Tool Execution** | ✅ Full | All tools (browser, exec, nodes, canvas, cron, gateway) |
| **File Access** | ✅ Full | Read/write/edit in agent workspace (sandboxed or host) |
| **Model Management** | ✅ Full | Provider auth, failover, per-agent model selection |
| **Auth Profiles** | ✅ Full | Per-agent OAuth for Anthropic, OpenAI, Google, etc. |
| **Browser Control** | ✅ Full | Multi-profile Playwright/Puppeteer with snapshot/act |
| **Node Integration** | ✅ Full | iOS/Android/macOS nodes for camera, screen, canvas, system.run |
| **Cron Jobs** | ✅ Full | Agent-initiated scheduled tasks with wake events |
| **HTTP APIs** | ✅ Full | OpenAI Chat Completions, OpenResponses, Tools Invoke |
| **Streaming** | ✅ Full | SSE for HTTP, WebSocket events for WS |
| **Presence Tracking** | ✅ Full | Multi-device presence with structured entries |
| **Control UI** | ✅ Full | Vite + Lit browser UI served from Gateway |
| **Pairing/Approvals** | ✅ Full | Device-based pairing with token issuance |
| **Sandboxing** | ✅ Full | Docker sandbox per agent or shared, with allowlists |

### 1.2 Gateway Protocol Overview

**Connection Flow:**
1. Client sends `connect` request with `role` (operator/node), `scopes`, `caps`, `device` identity
2. Gateway validates auth token/password and device pairing
3. Gateway responds with `hello-ok` + initial snapshot (presence, health, sessions)
4. Client can invoke methods (`chat.send`, `sessions.list`, `models.list`, `node.invoke`, etc.)
5. Server pushes events (`chat`, `presence`, `tick`, `shutdown`)

**Key Methods:**
- `chat.send` / `chat.history` / `chat.abort` / `chat.inject`
- `sessions.list` / `sessions.history` / `sessions.send` / `sessions.spawn`
- `models.list` / `health` / `status` / `system-presence`
- `node.list` / `node.describe` / `node.invoke` (canvas, camera, screen, location)
- `cron.add` / `cron.list` / `cron.run`
- `config.get` / `config.apply` / `config.patch`
- `exec.approval.resolve` (for operator clients with approval scope)

**Auth:**
- Gateway token or password required for non-loopback binds
- Device identity + pairing for non-local connections
- Scoped tokens issued after pairing (role + scopes)

---

## 2. Client/Server Boundary Decisions

### 2.1 MUST Be Server-Side (Gateway)

| Responsibility | Rationale |
|----------------|-----------|
| **Tool execution** | Security: shell, file access, browser control must be server-controlled |
| **Agent brain** | LLM prompt construction, context management, workspace files (AGENTS.md, MEMORY.md) |
| **Session storage** | Source of truth for conversation history (JSONL transcripts) |
| **Multi-agent routing** | Bindings, per-agent workspaces, isolated sessions |
| **Auth profiles** | OAuth tokens for Anthropic/OpenAI stored per-agent on server |
| **Model selection** | Provider failover, per-agent defaults, token budgets |
| **File access** | Read/write/edit tools operate in agent workspace (sandboxed or host) |
| **Cron jobs** | Scheduled agent tasks with wake events |
| **Node control** | Camera, screen, canvas, system.run on paired nodes |
| **Approvals** | Exec allowlists, pairing approvals, elevated mode gating |
| **Sandboxing** | Docker containers, per-agent or shared scope |
| **Presence** | Multi-device tracking with structured entries |

**Why:** These require access to system resources, secrets, or agent state that clients should never touch directly.

### 2.2 SHOULD Be Client-Side (Moltzer)

| Responsibility | Rationale |
|----------------|-----------|
| **Chat UI** | Native look-and-feel, OS-specific conventions (menus, shortcuts) |
| **Local caching** | Reduce network round-trips for recent messages/conversations |
| **Keychain storage** | Secure gateway token storage using OS APIs (macOS Keychain, Windows Credential Manager) |
| **Notifications** | Native OS notifications for new messages |
| **Menu bar / system tray** | Quick access, presence indicator |
| **Theme management** | Light/dark mode following OS preferences |
| **Input controls** | File picker, voice recording, attachment preview |
| **Markdown rendering** | Code highlighting, table rendering, image display |
| **Search (local)** | Fast in-memory search over cached conversations |
| **Conversation list** | Pinned chats, sorting, filtering by date/model |
| **Settings UI** | Gateway connection, appearance, keybindings |
| **Offline mode** | Graceful degradation, show cached history when disconnected |

**Why:** These are pure UI concerns or OS integrations that benefit from native APIs and don't require server logic.

### 2.3 Debatable (Current Approach: Client-Side)

| Feature | Current | Rationale | Alternative |
|---------|---------|-----------|-------------|
| **Conversation metadata** | Client | Faster UI updates, reduce Gateway load | Gateway could expose `sessions.list` with full metadata |
| **Message pagination** | Client | Client controls page size, smooth scrolling | Gateway could add `sessions.history` pagination params |
| **Draft messages** | Client | No network needed for local typing | Could sync drafts via `chat.inject` or custom method |
| **Title generation** | Client | Instant title from first user message | Gateway could auto-generate smarter titles using LLM |
| **Pinned conversations** | Client | Pure UI state, no security implications | Could sync pins across devices via server state |

**Decision:** Keep these client-side for now. Gateway already has `sessions.list` for server state; client can cache for performance.

---

## 3. Missing Gateway Features (Potential PRs)

### 3.1 Features Moltzer Needs

| Feature | Current Gateway Support | Benefit to Other Clients | Aligned with Vision? |
|---------|------------------------|--------------------------|---------------------|
| **Conversation metadata in `sessions.list`** | ⚠️ Partial (no `isPinned`, `model`) | ✅ Yes (WebChat, macOS app) | ✅ Yes (multi-client sync) |
| **`chat.history` pagination** | ⚠️ No explicit pagination | ✅ Yes (large histories) | ✅ Yes (performance) |
| **`sessions.patch` for client state** | ❌ No | ✅ Yes (sync pins, drafts) | 🤔 Maybe (bloats Gateway?) |
| **Multi-device presence for operators** | ✅ Yes (`system-presence`) | ✅ Yes | ✅ Already supported |
| **Search endpoint** | ❌ No | ✅ Yes (server-side search) | ✅ Yes (large datasets) |
| **Export conversations** | ❌ No | ✅ Yes (backup, audit) | ✅ Yes (data portability) |

**Recommendation:**
1. **Add to Gateway:** Pagination for `chat.history` (low lift, high value)
2. **Add to Gateway:** Conversation metadata fields in `sessions.list` (isPinned, model, lastMessage preview)
3. **Skip for now:** Full-text search (complex, client-side Dexie search is sufficient for personal use)
4. **Skip for now:** `sessions.patch` (bloats Gateway, not aligned with "sessions are server truth" principle)

### 3.2 PR Proposals

#### PR 1: Add Pagination to `chat.history`

**Current:**
```typescript
{
  "method": "chat.history",
  "params": {
    "sessionKey": "agent:main:main",
    "limit": 50
  }
}
```

**Proposed:**
```typescript
{
  "method": "chat.history",
  "params": {
    "sessionKey": "agent:main:main",
    "limit": 50,
    "before": "msg-uuid-123", // cursor-based pagination
    "includeTools": false      // existing param
  }
}
```

**Benefits:**
- Supports infinite scroll in clients
- Reduces initial load time for large histories
- Standard cursor-based pagination pattern

---

#### PR 2: Extend `sessions.list` Metadata

**Current:**
```typescript
interface SessionEntry {
  sessionKey: string;
  sessionId: string;
  updatedAt: string;
  displayName?: string;
  // ... other fields
}
```

**Proposed:**
```typescript
interface SessionEntry {
  sessionKey: string;
  sessionId: string;
  updatedAt: string;
  displayName?: string;
  model?: string;              // NEW: current model for this session
  isPinned?: boolean;          // NEW: client preference (optional)
  lastMessage?: {              // NEW: preview
    role: "user" | "assistant";
    content: string;           // truncated to 100 chars
    timestamp: string;
  };
  // ... other fields
}
```

**Benefits:**
- Clients don't need to fetch full history to show conversation list
- Model info helps users remember which session is using which model
- Last message preview makes conversation list more useful
- `isPinned` syncs across devices (optional, defaults to `false` if not set)

**Concern:** Bloats `sessions.list` response. **Mitigation:** Make `lastMessage` opt-in via `includeLastMessage: true` param.

---

## 4. Client Boundaries: What Moltzer Should NOT Do

### 4.1 Anti-Patterns to Avoid

❌ **Direct tool invocation**
- Moltzer should NEVER implement tools (exec, browser, file access)
- All tool calls go through Gateway via `chat.send` or agent runs

❌ **Direct model API calls**
- Don't call Anthropic/OpenAI APIs directly from client
- Gateway handles auth, failover, and token management

❌ **Workspace file access**
- Don't try to read/write agent workspace files (AGENTS.md, MEMORY.md)
- Gateway owns these; client sees them only via system prompt or tool results

❌ **Session state mutations**
- Don't try to modify session state (except local cache)
- Gateway is source of truth for sessions

❌ **Custom routing logic**
- Don't duplicate multi-agent routing or binding rules
- Gateway decides which agent handles a message

❌ **Approval flows**
- Don't implement exec approval UI (that's for operator clients with `operator.approvals` scope)
- Personal clients should never see approval prompts

### 4.2 Keep It Focused on Chat UX

**Moltzer's job:**
1. Connect to Gateway via WebSocket
2. Send `chat.send` requests with user messages
3. Stream responses and render them beautifully
4. Cache conversations locally for speed
5. Provide native OS integrations (keychain, notifications, menu bar)

**Moltzer's philosophy:**
- **Thin client, fat server:** Let Gateway do the heavy lifting
- **Zero secrets:** No API keys, no auth tokens (except gateway token in keychain)
- **UI-first:** Invest in polish, not reimplementing Gateway features
- **Trust the Gateway:** Don't second-guess its decisions (model selection, tool execution, session routing)

---

## 5. Current Moltzer Architecture Assessment

### 5.1 What's Good

✅ **WebSocket client in Rust (`gateway.rs`)**
- Clean abstraction over tokio-tungstenite
- Protocol fallback (ws:// ↔ wss://)
- Event-driven architecture with Tauri emitter

✅ **State management in Zustand (`store.ts`)**
- Lightweight, no Redux boilerplate
- Debounced persistence for streaming
- Separation of concerns (messages, conversations, settings)

✅ **Local persistence with IndexedDB**
- Dexie.js for structured queries
- Encrypted at rest (ENCRYPTION.md plan)
- Fast local search

✅ **Keychain integration (`keychain.rs`)**
- Uses OS APIs (macOS Keychain, Windows Credential Manager)
- Zero plaintext secrets in localStorage

### 5.2 What Needs Refinement

⚠️ **Gateway protocol not fully aligned**
- Current: `chat.send` method is custom
- Gateway: Expects `chat.send` with specific schema (see protocol.md)
- **Fix:** Update `gateway.rs` to match Gateway protocol exactly

⚠️ **Conversation list not synced from Gateway**
- Current: Client generates conversation list from local DB
- Gateway: Has `sessions.list` with server-side session state
- **Fix:** Use `sessions.list` as source of truth, cache locally for speed

⚠️ **Model list hardcoded fallback**
- Current: `get_fallback_models()` in gateway.rs
- Gateway: Provides `models.list` method
- **Fix:** Fetch models from Gateway, use fallback only on error

⚠️ **No reconnection logic**
- Current: Disconnect is permanent until user reconnects
- Gateway: Emits `shutdown` event with `restartExpectedMs`
- **Fix:** Auto-reconnect on disconnect, respect shutdown hint

⚠️ **Missing presence tracking**
- Current: No visibility into other connected clients
- Gateway: `system-presence` method + `presence` events
- **Fix:** Show presence indicator (e.g., "Also connected: macOS app, iPhone")

### 5.3 Recommended Changes

#### Change 1: Align Protocol with Gateway

**File:** `src-tauri/src/gateway.rs`

**Current:**
```rust
let request = GatewayRequest {
    id: request_id.clone(),
    method: "chat.send".to_string(),
    params: serde_json::json!({
        "message": params.message,
        "sessionKey": params.session_key,
        "model": params.model,
        "thinking": params.thinking,
    }),
};
```

**Issue:** Gateway expects different param structure (see `/gateway/protocol.md`).

**Fix:** Review Gateway protocol schema and match exactly:
1. Read `src/gateway/protocol/schema.ts` from Clawdbot repo
2. Update `GatewayRequest` struct to match TypeBox schema
3. Add missing fields: `idempotencyKey`, `stream`, `timeoutSeconds`
4. Use `req` type instead of custom top-level structure

---

#### Change 2: Use Gateway as Session Source of Truth

**File:** `src/stores/store.ts`

**Current:** Conversations are created client-side and never synced.

**Proposed:**
```typescript
// On connect: fetch sessions from Gateway
async function syncSessions() {
  const response = await gatewayRequest('sessions.list', {
    kinds: ['dm', 'group'],
    limit: 100,
    messageLimit: 1, // fetch last message for preview
  });
  
  // Merge with local cache (keep local additions until synced)
  const localOnly = conversations.filter(c => !response.sessions.find(s => s.sessionKey === c.id));
  setConversations([...response.sessions.map(toConversation), ...localOnly]);
}

// On new conversation: create locally, then sync on first message
function createConversation() {
  const conv = { id: generateId(), title: "New Chat", ... };
  // Session is created server-side when first message is sent
  return conv;
}
```

**Benefits:**
- Multi-device sync (conversations appear on all clients)
- Server-managed resets (daily/idle policies apply)
- Reduced state divergence

---

#### Change 3: Implement Auto-Reconnect

**File:** `src-tauri/src/gateway.rs`

**Proposed:**
```rust
// On disconnect, check if shutdown event was received
// If restartExpectedMs > 0, wait and reconnect
// Otherwise, reconnect immediately (with exponential backoff)

let mut reconnect_delay = 1000; // start at 1s
loop {
    match connect_with_retry(&url, &token, reconnect_delay).await {
        Ok(_) => break,
        Err(_) => {
            reconnect_delay = (reconnect_delay * 2).min(30000); // cap at 30s
            tokio::time::sleep(Duration::from_millis(reconnect_delay)).await;
        }
    }
}
```

**Benefits:**
- Graceful reconnect on Gateway restart
- No manual intervention needed
- Respects Gateway restart hints

---

## 6. Recommended Gateway Extensions (Optional)

These are **not required** for Moltzer to function but would improve the ecosystem:

### 6.1 Operator Dashboard Integration

**Use Case:** Desktop clients (Moltzer, macOS app) want embedded settings/status UI.

**Current:** Gateway serves Control UI at `http://<host>:18789/`

**Proposed:** Add `control-ui.embed` mode that returns HTML without `<html>` wrapper for iframe embedding.

**Benefit:** Clients can embed settings directly instead of opening external browser.

**Alignment:** Medium (Gateway vision is browser-first, embedding is secondary).

---

### 6.2 Rich Presence for Operators

**Use Case:** Show which devices/apps are connected to same account.

**Current:** `system-presence` works but lacks operator-specific metadata.

**Proposed:** Add `deviceFamily`, `modelIdentifier`, `appVersion` to presence entries.

**Benefit:** Better multi-device UX ("macOS app is typing...").

**Alignment:** High (already in protocol, just needs client adoption).

---

## 7. Conclusion

### Key Takeaways

1. **Gateway is complete:** Moltzer should NOT reimplement tools, agents, or session logic.
2. **Client is UI:** Focus on chat experience, native integrations, local caching.
3. **Trust the Gateway:** Don't second-guess model selection, routing, or tool execution.
4. **Align protocol:** Update `gateway.rs` to match Gateway schema exactly.
5. **Sync sessions:** Use `sessions.list` as source of truth, cache locally.
6. **PR opportunities:** Pagination for `chat.history`, metadata for `sessions.list`.

### Next Steps

1. ✅ Document architecture decisions (this file)
2. ⬜ Audit `gateway.rs` against Gateway protocol schema
3. ⬜ Implement `sessions.list` sync on connect
4. ⬜ Add auto-reconnect logic
5. ⬜ Submit PR for `chat.history` pagination (if needed)
6. ⬜ Submit PR for `sessions.list` metadata extensions (if needed)

---

**Maintainer:** Moltzer team  
**Reference:** [Clawdbot Gateway Docs](https://docs.clawd.bot/gateway)  
**Last Review:** 2026-01-27
