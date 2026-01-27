# Molt Client Architecture

## Vision

Two deployment models:

### 1. Personal Edition
- Single user, direct Gateway connection
- Full tool/source access
- Local-first, privacy-focused
- No backend needed beyond Moltbot Gateway

### 2. Teams Edition
- Multi-user with org management
- Role-based access control (RBAC)
- Shared conversation rooms
- Audit logging for compliance
- Requires backend service

---

## Personal Edition Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Molt Client                      │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │   React UI  │  │  Zustand    │  │  IndexedDB │  │
│  │  (Frontend) │  │  (State)    │  │  (Storage) │  │
│  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │
│         │                │               │         │
│         └────────────────┼───────────────┘         │
│                          │                         │
│  ┌───────────────────────┴───────────────────────┐ │
│  │              Rust Backend (Tauri)             │ │
│  │  • WebSocket client                           │ │
│  │  • Local file access                          │ │
│  │  • System notifications                       │ │
│  │  • Full-text search (tantivy)                 │ │
│  └───────────────────────┬───────────────────────┘ │
└──────────────────────────┼──────────────────────────┘
                           │ WebSocket
                           ▼
              ┌─────────────────────────┐
              │    Moltbot Gateway      │
              │  • Claude/OpenAI APIs   │
              │  • Tool execution       │
              │  • Session management   │
              └─────────────────────────┘
```

**Key features:**
- Direct WebSocket to Gateway
- Local conversation storage (IndexedDB + optional SQLite)
- Rust-powered full-text search
- Native OS integration (notifications, file dialogs)

---

## Teams Edition Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Molt Client                      │
│  (Same as Personal, but connects to Teams Backend) │
└──────────────────────────┬──────────────────────────┘
                           │ HTTPS + WebSocket
                           ▼
┌─────────────────────────────────────────────────────┐
│                 Molt Teams Backend                  │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │    Auth     │  │    RBAC     │  │   Audit    │  │
│  │  (OAuth/SSO)│  │ (Permissions│  │   Logger   │  │
│  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │
│         │                │               │         │
│  ┌──────┴────────────────┴───────────────┴──────┐  │
│  │              API Gateway / Proxy             │  │
│  │  • Route requests based on permissions       │  │
│  │  • Filter tool access per role               │  │
│  │  • Enforce source restrictions               │  │
│  └───────────────────────┬──────────────────────┘  │
│                          │                         │
│  ┌───────────────────────┴───────────────────────┐ │
│  │              Shared State (Postgres)          │ │
│  │  • Organizations, Users, Roles                │ │
│  │  • Shared rooms / conversations               │ │
│  │  • Audit logs                                 │ │
│  └───────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    Moltbot Gateway(s)   │
              │  (Can be per-org or     │
              │   shared with isolation)│
              └─────────────────────────┘
```

---

## Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|------|-------------|
| **Owner** | Full access, billing, can delete org |
| **Admin** | Manage users, roles, settings |
| **Member** | Full chat access, tool access per policy |
| **Viewer** | Read-only access to shared rooms |
| **Custom** | Admin-defined permission set |

### Permission Scopes

```typescript
interface PermissionScope {
  // Tool access
  tools: {
    shell: boolean;      // Can execute shell commands
    browser: boolean;    // Can control browser
    files: boolean;      // Can read/write files
    email: boolean;      // Can send emails
    calendar: boolean;   // Can access calendar
    // ... extensible
  };
  
  // Source access
  sources: {
    email: 'none' | 'read' | 'write';
    calendar: 'none' | 'read' | 'write';
    crm: 'none' | 'read' | 'write';
    github: 'none' | 'read' | 'write';
    // ... extensible
  };
  
  // Action limits
  limits: {
    messagesPerDay?: number;
    tokensPerDay?: number;
    canCreateRooms: boolean;
    canInviteUsers: boolean;
  };
}
```

### Example Policies

**Developer:**
```json
{
  "tools": { "shell": true, "browser": true, "files": true },
  "sources": { "github": "write", "email": "read" },
  "limits": { "canCreateRooms": true }
}
```

**Sales Rep:**
```json
{
  "tools": { "shell": false, "browser": false, "files": false },
  "sources": { "crm": "write", "email": "read", "calendar": "read" },
  "limits": { "messagesPerDay": 100 }
}
```

**Intern (Read-Only):**
```json
{
  "tools": { "shell": false, "browser": false, "files": false },
  "sources": { "crm": "read" },
  "limits": { "canCreateRooms": false, "canInviteUsers": false }
}
```

---

## Shared Rooms

Like Slack channels:

- **Public rooms** — Anyone in org can join
- **Private rooms** — Invite-only
- **DMs** — 1:1 with Molt (personal)
- **Group DMs** — Multiple users + Molt

Room features:
- Threaded conversations
- Pinned messages
- Search within room
- @mentions
- File sharing
- Audit trail per room

---

## Audit Logging

Every action logged:

```typescript
interface AuditEntry {
  timestamp: Date;
  userId: string;
  orgId: string;
  roomId?: string;
  action: 'message' | 'tool_call' | 'file_access' | 'settings_change';
  details: {
    input?: string;       // User message (redactable)
    toolName?: string;    // Tool invoked
    toolParams?: object;  // Parameters (redactable)
    result?: string;      // Outcome
  };
  ip?: string;
  userAgent?: string;
}
```

Admin dashboard:
- Filter by user, date, action type
- Export for compliance
- Anomaly detection (unusual patterns)

---

## Security Measures

### Addressing Clawdbot Criticisms

| Concern | Solution |
|---------|----------|
| Unrestricted tool access | RBAC + per-user tool allowlists |
| Data exfiltration | Scoped source permissions, output filtering |
| No audit trail | Comprehensive logging |
| Single-user focus | Multi-tenant architecture |
| Shared secrets | Per-user credentials, vault integration |
| No sandboxing | Containerized tool execution (Teams) |

### Additional Security

- **E2E encryption** for DMs (optional)
- **SSO/SAML** for enterprise auth
- **IP allowlisting** per org
- **Session management** (force logout, device list)
- **API rate limiting** per user/org

---

## Implementation Phases

### Phase 1: Personal Edition (Current)
- [x] Basic Tauri app structure
- [ ] WebSocket connection to Gateway
- [ ] Chat UI with streaming
- [ ] Conversation persistence
- [ ] Full-text search
- [ ] Settings UI

### Phase 2: Polish
- [ ] Code syntax highlighting
- [ ] File attachments
- [ ] Voice messages
- [ ] Keyboard shortcuts
- [ ] System tray
- [ ] Auto-updates

### Phase 3: Teams Foundation
- [ ] Backend service (Node/Rust)
- [ ] User authentication
- [ ] Organization management
- [ ] Basic RBAC

### Phase 4: Teams Features
- [ ] Shared rooms
- [ ] Audit logging
- [ ] Admin dashboard
- [ ] SSO integration

### Phase 5: Enterprise
- [ ] Advanced permissions
- [ ] Compliance exports
- [ ] On-premise deployment
- [ ] Custom integrations

---

## Tech Stack

### Client (Both Editions)
- **Tauri v2** — Native app shell
- **React 18** — UI framework
- **TypeScript** — Type safety
- **Tailwind CSS** — Styling
- **Zustand** — State management
- **Tantivy** (Rust) — Full-text search

### Teams Backend
- **Node.js** or **Rust** — API server
- **PostgreSQL** — Primary database
- **Redis** — Caching, pub/sub
- **S3-compatible** — File storage

### Infrastructure
- **GitHub Actions** — CI/CD
- **Docker** — Containerization
- **Kubernetes** — Orchestration (enterprise)
