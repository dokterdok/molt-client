# Protocol Verification Report: Moltzer ↔ Clawdbot Gateway

**Date:** 2025-01-27  
**Status:** 🔴 CRITICAL MISMATCHES FOUND

## Summary

Moltzer's WebSocket implementation has several protocol mismatches with Clawdbot Gateway that prevent communication.

---

## 1. Clawdbot Gateway Expected Protocol

### Transport
- WebSocket, text frames with JSON payloads
- First frame **must** be a `connect` request

### Frame Types

**Request Frame:**
```json
{
  "type": "req",
  "id": "<unique-id>",
  "method": "<method-name>",
  "params": { ... }
}
```

**Response Frame:**
```json
{
  "type": "res",
  "id": "<matching-request-id>",
  "ok": true|false,
  "payload": { ... },
  "error": { "code": "...", "message": "...", ... }
}
```

**Event Frame:**
```json
{
  "type": "event",
  "event": "<event-name>",
  "payload": { ... },
  "seq": <optional-int>,
  "stateVersion": <optional>
}
```

### Required Handshake

1. **Client connects** via WebSocket
2. **Gateway sends** challenge event:
   ```json
   {
     "type": "event",
     "event": "connect.challenge",
     "payload": { "nonce": "...", "ts": 1737264000000 }
   }
   ```
3. **Client sends** connect request:
   ```json
   {
     "type": "req",
     "id": "...",
     "method": "connect",
     "params": {
       "minProtocol": 3,
       "maxProtocol": 3,
       "client": {
         "id": "Moltzer",
         "version": "0.1.0",
         "platform": "windows|macos|linux",
         "mode": "operator"
       },
       "role": "operator",
       "scopes": ["operator.read", "operator.write"],
       "caps": [],
       "commands": [],
       "permissions": {},
       "auth": { "token": "..." },
       "locale": "en-US",
       "userAgent": "Moltzer/0.1.0"
     }
   }
   ```
4. **Gateway responds** with hello-ok:
   ```json
   {
     "type": "res",
     "id": "...",
     "ok": true,
     "payload": {
       "type": "hello-ok",
       "protocol": 3,
       "server": { "version": "...", "connId": "..." },
       "features": { "methods": [...], "events": [...] },
       "snapshot": { ... },
       "policy": { "tickIntervalMs": 15000, ... }
     }
   }
   ```

### Chat Methods

**chat.send params** (ChatSendParamsSchema):
```typescript
{
  sessionKey: string,      // REQUIRED
  message: string,         // REQUIRED  
  idempotencyKey: string,  // REQUIRED
  thinking?: string,
  deliver?: boolean,
  attachments?: unknown[],
  timeoutMs?: number
}
```

**models.list params** (ModelsListParamsSchema):
```typescript
{}  // empty object
```

**models.list result:**
```typescript
{
  models: Array<{
    id: string,
    name: string,
    provider: string,
    contextWindow?: number,
    reasoning?: boolean
  }>
}
```

---

## 2. Moltzer's Current Implementation

### What Moltzer Sends (INCORRECT)

**Request format:**
```json
{
  "id": "...",
  "method": "chat.send",
  "params": { ... }
}
```

**Missing:**
- `"type": "req"` field
- No connect handshake
- No `idempotencyKey` in chat.send

### What Moltzer Expects (INCORRECT)

**Response format expected:**
```json
{
  "id": "...",
  "result": { ... },
  "error": { "code": -1, "message": "..." }
}
```

**Should expect:**
```json
{
  "type": "res",
  "id": "...",
  "ok": true|false,
  "payload": { ... },
  "error": { "code": "...", "message": "..." }
}
```

---

## 3. Gap Analysis

| Issue | Moltzer Current | Clawdbot Expected | Severity |
|-------|--------------|-------------------|----------|
| Request type field | Missing | `"type": "req"` | 🔴 CRITICAL |
| Connect handshake | Not performed | Required | 🔴 CRITICAL |
| Response type field | Not expected | `"type": "res"` | 🔴 CRITICAL |
| Response ok field | Not expected | Required `ok: bool` | 🔴 CRITICAL |
| Response payload vs result | `result` field | `payload` field | 🔴 CRITICAL |
| idempotencyKey | Missing | Required for chat.send | 🟡 HIGH |
| Error code type | `i32` | `string` | 🟡 HIGH |
| get_models async | Returns fallback immediately | Should await response | 🟡 HIGH |

---

## 4. Required Fixes

### Fix 1: Add `type: "req"` to requests
```rust
#[derive(Debug, Serialize)]
struct GatewayRequest {
    #[serde(rename = "type")]
    msg_type: String,  // Always "req"
    id: String,
    method: String,
    params: serde_json::Value,
}
```

### Fix 2: Implement connect handshake
After WebSocket connection, wait for challenge event, then send connect request.

### Fix 3: Fix response parsing
```rust
#[derive(Debug, Deserialize)]
pub struct GatewayResponse {
    #[serde(rename = "type")]
    pub msg_type: Option<String>,  // "res"
    pub id: Option<String>,
    pub ok: Option<bool>,
    pub payload: Option<serde_json::Value>,  // NOT "result"
    pub error: Option<GatewayError>,
}

#[derive(Debug, Deserialize)]
pub struct GatewayError {
    pub code: String,  // String, not i32
    pub message: String,
}
```

### Fix 4: Add idempotencyKey to chat.send
```rust
let request = GatewayRequest {
    msg_type: "req".to_string(),
    id: request_id.clone(),
    method: "chat.send".to_string(),
    params: serde_json::json!({
        "message": params.message,
        "sessionKey": params.session_key,
        "thinking": params.thinking,
        "idempotencyKey": uuid::Uuid::new_v4().to_string(),
    }),
};
```

### Fix 5: Fix get_models to await response
Need to implement a proper request/response correlation system using channels.

---

## 5. Event Types to Handle

**From Gateway:**
- `connect.challenge` - Initial handshake challenge
- `tick` - Keepalive (respond with tick acknowledgment)
- `chat` - Chat message stream events
- `shutdown` - Gateway shutting down

**Chat Event payload:**
```typescript
{
  runId: string,
  sessionKey: string,
  seq: number,
  state: "delta" | "final" | "aborted" | "error",
  message?: unknown,
  errorMessage?: string,
  usage?: unknown,
  stopReason?: string
}
```

---

## 6. Implementation Priority

1. **CRITICAL**: Add `type: "req"` to all requests
2. **CRITICAL**: Fix response parsing (`ok`, `payload` fields)
3. **HIGH**: Implement connect handshake
4. **HIGH**: Add idempotencyKey to chat.send
5. **MEDIUM**: Fix get_models async flow
6. **LOW**: Handle tick events for keepalive
