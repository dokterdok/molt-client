# Molt Client Architecture

## Overview

Molt Client is designed to operate in two distinct modes:

1. **Personal Mode** - Direct connection to Moltbot Gateway (current implementation)
2. **Team Mode** - Connection through Molt Backend for org management, RBAC, and audit

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PERSONAL MODE                                │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │ Molt Client │ ──WS──► │   Gateway   │ ──────► │   Moltbot   │   │
│  │  (Tauri)    │         │  (direct)   │         │             │   │
│  └─────────────┘         └─────────────┘         └─────────────┘   │
│        │                                                            │
│        ▼                                                            │
│  ┌─────────────┐                                                   │
│  │  IndexedDB  │  (local storage)                                  │
│  └─────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                           TEAM MODE                                  │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │ Molt Client │ ──WS──► │Molt Backend │ ──WS──► │   Gateway   │   │
│  │  (Tauri)    │         │  (proxy)    │         │             │   │
│  └─────────────┘         └─────────────┘         └─────────────┘   │
│                                │                        │           │
│                    ┌───────────┼───────────┐           │           │
│                    ▼           ▼           ▼           ▼           │
│              ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│              │PostgreSQL│ │  Redis  │ │  Audit  │ │ Moltbot │     │
│              │(main DB) │ │(pubsub) │ │  Logs   │ │         │     │
│              └──────────┘ └─────────┘ └─────────┘ └─────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Team/Enterprise Architecture

### Data Model

```
Organizations (workspaces)
├── Settings (name, logo, billing, etc.)
├── Members
│   ├── User reference
│   ├── Role
│   └── Custom permission overrides
├── Roles
│   ├── Built-in: owner, admin, member, read-only, guest
│   └── Custom roles with granular permissions
├── Rooms (shared conversation spaces)
│   ├── Public rooms (all members can see)
│   ├── Private rooms (invite-only)
│   └── Direct messages
├── Permission Policies
│   ├── Tool allowlists/denylists
│   ├── Source access rules
│   └── Action restrictions
└── Audit Logs
    └── Every request/response with full context
```

### Database Schema (PostgreSQL)

```sql
-- Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(63) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (can belong to multiple orgs)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization memberships
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id),
    custom_permissions JSONB, -- overrides from role
    status VARCHAR(20) DEFAULT 'active', -- active, invited, suspended
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- Roles (per-org)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(63) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE, -- built-in roles
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, name)
);

-- Rooms (shared conversations)
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'public', -- public, private, dm
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room members (for private rooms)
CREATE TABLE room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    can_write BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- Conversations (within rooms or personal)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL, -- NULL = personal
    owner_id UUID REFERENCES users(id), -- for personal conversations
    title VARCHAR(255),
    model VARCHAR(100),
    settings JSONB DEFAULT '{}',
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id), -- NULL for assistant
    role VARCHAR(20) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- model used, tokens, thinking content, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs (append-only)
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    request JSONB, -- sanitized request
    response_summary JSONB, -- summary, not full response
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX idx_messages_content_fts ON messages 
    USING gin(to_tsvector('english', content));

-- Partitioning for audit logs (by month)
-- Production: partition audit_logs by created_at
```

---

## Permission System (RBAC)

### Permission Structure

```typescript
interface Permission {
  // Resource access
  resources: {
    conversations: 'none' | 'own' | 'room' | 'all';
    rooms: 'none' | 'joined' | 'all';
    members: 'none' | 'view' | 'manage';
    settings: 'none' | 'view' | 'manage';
    audit_logs: 'none' | 'view';
  };
  
  // Tool access (Moltbot capabilities)
  tools: {
    mode: 'allowlist' | 'denylist';
    list: string[]; // tool names
  };
  
  // Source access (integrations)
  sources: {
    mode: 'allowlist' | 'denylist';
    list: string[]; // source identifiers
  };
  
  // Action restrictions
  actions: {
    canChat: boolean;
    canUploadFiles: boolean;
    canUseThinking: boolean;
    canExportData: boolean;
    maxTokensPerRequest?: number;
    maxRequestsPerDay?: number;
  };
}
```

### Built-in Roles

```typescript
const BUILT_IN_ROLES = {
  owner: {
    // Full access to everything
    resources: { conversations: 'all', rooms: 'all', members: 'manage', settings: 'manage', audit_logs: 'view' },
    tools: { mode: 'denylist', list: [] }, // all tools allowed
    sources: { mode: 'denylist', list: [] }, // all sources allowed
    actions: { canChat: true, canUploadFiles: true, canUseThinking: true, canExportData: true }
  },
  
  admin: {
    // Manage org, but can't delete it
    resources: { conversations: 'all', rooms: 'all', members: 'manage', settings: 'view', audit_logs: 'view' },
    tools: { mode: 'denylist', list: [] },
    sources: { mode: 'denylist', list: [] },
    actions: { canChat: true, canUploadFiles: true, canUseThinking: true, canExportData: true }
  },
  
  member: {
    // Standard user
    resources: { conversations: 'room', rooms: 'joined', members: 'view', settings: 'none', audit_logs: 'none' },
    tools: { mode: 'denylist', list: ['shell', 'exec', 'file_write'] }, // restricted tools
    sources: { mode: 'denylist', list: [] },
    actions: { canChat: true, canUploadFiles: true, canUseThinking: false, canExportData: false }
  },
  
  restricted: {
    // Limited access - read-heavy, minimal write
    resources: { conversations: 'own', rooms: 'joined', members: 'none', settings: 'none', audit_logs: 'none' },
    tools: { mode: 'allowlist', list: ['web_search', 'calculator'] }, // only safe tools
    sources: { mode: 'allowlist', list: [] }, // no external sources by default
    actions: { canChat: true, canUploadFiles: false, canUseThinking: false, canExportData: false, maxRequestsPerDay: 50 }
  },
  
  readonly: {
    // Can only view, not interact
    resources: { conversations: 'room', rooms: 'joined', members: 'none', settings: 'none', audit_logs: 'none' },
    tools: { mode: 'allowlist', list: [] },
    sources: { mode: 'allowlist', list: [] },
    actions: { canChat: false, canUploadFiles: false, canUseThinking: false, canExportData: false }
  }
};
```

---

## Security Architecture

### Addressing Clawdbot Criticisms

1. **No Unrestricted Tool Access for Non-Admins**
   - Backend validates every request against user's permission scope
   - Tool calls are intercepted and checked before forwarding to gateway
   - Dangerous tools (shell, exec, file_write) denied by default for non-admins

2. **Data Exfiltration Prevention**
   - Outbound network requests monitored and logged
   - Sensitive data patterns detected (SSN, credit cards, API keys)
   - Rate limiting on data exports
   - Audit trail for all file access

3. **Sandboxed Execution**
   - Code execution in isolated containers (when enabled)
   - Network egress controls
   - Resource limits (CPU, memory, time)

### Request Flow with RBAC

```
1. Client sends request to Backend
2. Backend authenticates user (JWT/session)
3. Backend loads user's effective permissions (role + overrides)
4. Backend validates request against permissions:
   - Check if action is allowed
   - Check if tools are allowed
   - Check if sources are allowed
   - Check rate limits
5. If allowed, forward to Gateway with restrictions:
   - Inject tool restrictions into request
   - Add audit context
6. Gateway processes request
7. Backend receives response
8. Backend logs to audit trail
9. Backend streams response to client
```

### Audit Log Format

```typescript
interface AuditLogEntry {
  id: string;
  timestamp: Date;
  orgId: string;
  userId: string;
  userEmail: string;
  
  // What happened
  action: 'chat.send' | 'chat.read' | 'room.create' | 'member.invite' | etc;
  resourceType: 'conversation' | 'room' | 'member' | etc;
  resourceId: string;
  
  // Request details (sanitized)
  request: {
    message?: string; // truncated
    model?: string;
    tools_requested?: string[];
    tools_allowed?: string[];
    tools_denied?: string[];
  };
  
  // Response summary
  response: {
    status: 'success' | 'error' | 'denied';
    tokens_used?: number;
    tools_used?: string[];
    error_code?: string;
  };
  
  // Context
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}
```

---

## Backend Service Design

### Tech Stack

- **Runtime**: Node.js or Rust (for performance)
- **Framework**: Fastify (Node) or Axum (Rust)
- **Database**: PostgreSQL
- **Cache/PubSub**: Redis
- **Auth**: JWT + refresh tokens, SSO support (SAML, OIDC)

### API Endpoints

```
Authentication
POST   /auth/login              - Email/password login
POST   /auth/logout             - Logout
POST   /auth/refresh            - Refresh token
GET    /auth/sso/:provider      - SSO initiation
POST   /auth/sso/callback       - SSO callback

Organizations
GET    /orgs                    - List user's orgs
POST   /orgs                    - Create org
GET    /orgs/:id                - Get org details
PATCH  /orgs/:id                - Update org
DELETE /orgs/:id                - Delete org (owner only)

Members
GET    /orgs/:id/members        - List members
POST   /orgs/:id/members/invite - Invite member
PATCH  /orgs/:id/members/:uid   - Update member role
DELETE /orgs/:id/members/:uid   - Remove member

Roles
GET    /orgs/:id/roles          - List roles
POST   /orgs/:id/roles          - Create custom role
PATCH  /orgs/:id/roles/:rid     - Update role
DELETE /orgs/:id/roles/:rid     - Delete role

Rooms
GET    /orgs/:id/rooms          - List rooms
POST   /orgs/:id/rooms          - Create room
GET    /rooms/:id               - Get room
PATCH  /rooms/:id               - Update room
DELETE /rooms/:id               - Delete room

Conversations
GET    /rooms/:id/conversations - List conversations in room
GET    /conversations           - List personal conversations
POST   /conversations           - Create conversation
GET    /conversations/:id       - Get conversation with messages
DELETE /conversations/:id       - Delete conversation

Chat (WebSocket)
WS     /ws                      - Main WebSocket connection
       → { type: 'chat', conversationId, message, ... }
       ← { type: 'stream', content, ... }
       ← { type: 'complete', ... }

Search
GET    /search?q=...            - Full-text search across allowed conversations

Audit
GET    /orgs/:id/audit          - Query audit logs (admin only)
```

### WebSocket Protocol

```typescript
// Client → Server
interface ClientMessage {
  type: 'chat' | 'typing' | 'read_receipt' | 'presence';
  
  // For chat
  conversationId?: string;
  message?: string;
  attachments?: Attachment[];
  model?: string;
  thinking?: string;
  
  // For typing indicator
  roomId?: string;
}

// Server → Client
interface ServerMessage {
  type: 'stream' | 'complete' | 'error' | 'typing' | 'presence' | 'room_update';
  
  // For stream/complete
  conversationId?: string;
  content?: string;
  done?: boolean;
  
  // For error
  code?: string;
  message?: string;
  
  // For typing
  roomId?: string;
  userId?: string;
  isTyping?: boolean;
  
  // For presence
  roomId?: string;
  userId?: string;
  status?: 'online' | 'away' | 'offline';
}
```

---

## Client Architecture

### Mode Detection

```typescript
// src/lib/connection.ts
export type ConnectionMode = 'personal' | 'team';

export interface ConnectionConfig {
  mode: ConnectionMode;
  
  // Personal mode
  gatewayUrl?: string;
  gatewayToken?: string;
  
  // Team mode
  backendUrl?: string;
  orgId?: string;
  authToken?: string;
}

export function createConnection(config: ConnectionConfig) {
  if (config.mode === 'personal') {
    return new DirectGatewayConnection(config.gatewayUrl!, config.gatewayToken);
  } else {
    return new TeamBackendConnection(config.backendUrl!, config.authToken!);
  }
}
```

### State Management

```typescript
// src/stores/store.ts
interface Store {
  // Mode
  mode: ConnectionMode;
  
  // Personal mode state
  localConversations: Conversation[];
  
  // Team mode state
  currentOrg: Organization | null;
  rooms: Room[];
  members: Member[];
  sharedConversations: Map<string, Conversation[]>; // roomId → conversations
  
  // Common
  currentConversation: Conversation | null;
  settings: Settings;
}
```

### Storage Strategy

| Mode | Conversations | Messages | Settings |
|------|--------------|----------|----------|
| Personal | IndexedDB (Dexie) | IndexedDB | LocalStorage |
| Team | Server (PostgreSQL) | Server | Server + LocalStorage cache |

---

## Migration Path

### Phase 1: Personal Client (Current)
- [x] Direct gateway connection
- [x] Local storage with IndexedDB
- [ ] Full-text search (Dexie)
- [ ] Settings dialog
- [ ] UI polish

### Phase 2: Team Foundation
- [ ] Backend service scaffold
- [ ] User authentication
- [ ] Organization CRUD
- [ ] Basic RBAC

### Phase 3: Shared Conversations
- [ ] Rooms implementation
- [ ] Real-time presence
- [ ] Shared conversation state
- [ ] Typing indicators

### Phase 4: Enterprise Features
- [ ] Advanced RBAC with custom roles
- [ ] Tool/source restrictions
- [ ] Audit logging
- [ ] SSO integration
- [ ] Admin dashboard

### Phase 5: Security Hardening
- [ ] Sandboxed execution
- [ ] Data exfiltration detection
- [ ] Compliance features (SOC2, GDPR)

---

## File Structure (Future)

```
molt-client/
├── src/                      # React frontend
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   ├── connection.ts     # Connection abstraction
│   │   ├── api.ts           # REST API client
│   │   └── ws.ts            # WebSocket client
│   ├── stores/
│   └── ...
├── src-tauri/                # Rust backend (Tauri)
│   └── src/
│       ├── gateway.rs        # Direct gateway connection
│       └── ...
└── ...

molt-backend/                 # Separate repo for team backend
├── src/
│   ├── api/                  # REST endpoints
│   ├── ws/                   # WebSocket handler
│   ├── services/
│   │   ├── auth.ts
│   │   ├── rbac.ts
│   │   ├── audit.ts
│   │   └── gateway_proxy.ts
│   ├── db/
│   │   ├── schema.sql
│   │   └── migrations/
│   └── ...
└── ...
```

---

## Encryption at Rest (Personal Edition)

All conversation history encrypted locally with zero user friction:

### Implementation

```
┌─────────────────────────────────────────────────────┐
│              OS Keychain                            │
│  (macOS Keychain / Windows Credential Manager /    │
│   Linux Secret Service)                            │
│                                                     │
│  Stores: 256-bit encryption key                    │
│  Auto-generated on first launch                    │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              SQLCipher Database                     │
│                                                     │
│  • All messages encrypted (AES-256)                │
│  • Conversation metadata encrypted                 │
│  • Attachments encrypted                           │
│  • Key never leaves OS keychain                    │
└─────────────────────────────────────────────────────┘
```

### Rust Dependencies

```toml
[dependencies]
tauri-plugin-stronghold = "2"  # Encrypted storage
keyring = "2"                   # OS keychain access
rusqlite = { version = "0.31", features = ["bundled-sqlcipher"] }
```

### User Experience

- **Zero setup** — Key auto-generated on first launch
- **No passwords** — OS handles authentication (biometrics, login password)
- **Transparent** — User never sees encryption, it just works
- **Portable** — Export includes encrypted blob + key (optional password protection)

---

## Security Considerations Summary

1. **Authentication**: JWT with short expiry, refresh tokens, optional MFA
2. **Authorization**: RBAC checked on every request, deny by default
3. **Audit**: Every action logged with full context
4. **Tool Control**: Allowlist/denylist per role, dangerous tools restricted
5. **Data Protection**: Encryption at rest (SQLCipher + OS keychain) and in transit (TLS)
6. **Rate Limiting**: Per-user and per-org limits
7. **Sandboxing**: Code execution in isolated environments
8. **Monitoring**: Real-time alerts for suspicious activity

This architecture provides a clear path from a personal client to a full enterprise solution while maintaining security as a first-class concern.
