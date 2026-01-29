# Clawdbot Gateway Protocol v3 - Moltz Implementation Guide

This document specifies the Clawdbot Gateway WebSocket protocol as implemented by Moltz.

## Overview

- **Transport**: WebSocket (ws:// or wss://)
- **Protocol Version**: 3
- **Frame Format**: JSON text frames
- **First Frame**: MUST be a `connect` request

## Connection Handshake

### Step 1: Establish WebSocket

Connect to the gateway URL (e.g., `ws://100.70.200.79:18789`).

### Step 2: Send Connect Request

Immediately after WebSocket opens, send:

```json
{
  "type": "req",
  "id": "<uuid>",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "clawdbot-control-ui",
      "version": "1.0.0",
      "platform": "macos",
      "mode": "cli"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "caps": [],
    "auth": {
      "token": "<gateway-token-or-empty>"
    },
    "locale": "en-US",
    "userAgent": "moltz/1.0.0"
  }
}
```

### Step 3: Receive Response

**Success:**
```json
{
  "type": "res",
  "id": "<same-uuid>",
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

**Failure:**
```json
{
  "type": "res",
  "id": "<same-uuid>",
  "ok": false,
  "error": {
    "code": "unauthorized",
    "message": "device identity required"
  }
}
```

Or the WebSocket is closed with reason: `"device identity required"`

## Authentication

### Method 1: Token Auth (Recommended for Control UI)

Gateway config (`clawdbot.json`):
```json
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "your-secret-token"
    },
    "controlUi": {
      "allowInsecureAuth": true
    }
  }
}
```

Client sends:
```json
{
  "auth": { "token": "your-secret-token" }
}
```

**Requirements:**
- `client.id` MUST be `"clawdbot-control-ui"`
- `allowInsecureAuth` MUST be `true` in gateway config
- Token MUST match `gateway.auth.token`

### Method 2: Device Identity (Default)

For untrusted clients, device identity + signature is required:
```json
{
  "device": {
    "id": "device-fingerprint",
    "publicKey": "...",
    "signature": "...",
    "signedAt": 1737264000000,
    "nonce": "..."
  }
}
```

Moltz does NOT implement device identity - it relies on token auth.

## Frame Types

### Request
```json
{ "type": "req", "id": "<uuid>", "method": "<method>", "params": {...} }
```

### Response
```json
{ "type": "res", "id": "<uuid>", "ok": true|false, "payload": {...}, "error": {...} }
```

### Event
```json
{ "type": "event", "event": "<event-name>", "payload": {...} }
```

## Key Methods

| Method | Description |
|--------|-------------|
| `connect` | Initial handshake |
| `send` | Send chat message |
| `poll` | Poll for session updates |
| `status` | Get gateway status |
| `models.list` | List available models |
| `sessions.list` | List sessions |
| `config.get` | Get gateway config |

## Key Events

| Event | Description |
|-------|-------------|
| `tick` | Keepalive (every ~15s) |
| `chat` | Streaming chat content |
| `agent` | Agent status updates |
| `shutdown` | Gateway shutting down |

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `device identity required` | No auth/device | Add token or enable allowInsecureAuth |
| `token_mismatch` | Wrong token | Check token matches config |
| `unauthorized` | Auth failed | Check auth config |
| `pairing_required` | Device needs approval | Approve device or use token |

## Client IDs

Valid `client.id` values:
- `clawdbot-control-ui` - Control UI (supports allowInsecureAuth)
- `cli` - CLI client
- `webchat-ui` - Webchat
- `clawdbot-macos` - macOS app
- `clawdbot-ios` - iOS app
- `clawdbot-android` - Android app

## Client Modes

Valid `client.mode` values:
- `cli` - Command-line interface
- `ui` - User interface
- `webchat` - Web chat
- `node` - Capability host
- `backend` - Backend service
- `probe` - Health probe

## Moltz-Specific Notes

1. **Token Storage**: Stored in OS keychain (macOS Keychain, Windows Credential Manager)
2. **Platform**: Reports actual OS (`macos`, `windows`, `linux`)
3. **No Device Identity**: Relies solely on `allowInsecureAuth` mode
4. **Reconnection**: Automatic with exponential backoff
5. **Streaming**: Listens for `chat` events for streaming responses

## Debugging Connection Issues

### "device identity required"
- Check `gateway.controlUi.allowInsecureAuth: true` in gateway config
- Verify token is being sent (not empty)
- Verify `client.id` is exactly `"clawdbot-control-ui"`

### "token_mismatch"  
- Token sent doesn't match `gateway.auth.token`
- Check for whitespace/encoding issues

### Connection drops immediately
- Check gateway is running
- Verify WebSocket URL is correct
- Check for firewall/network issues

## References

- Gateway Protocol Source: `clawdbot/src/gateway/protocol/`
- Schema: `clawdbot/src/gateway/protocol/schema/frames.ts`
- Auth Logic: `clawdbot/src/gateway/auth.ts`
- Message Handler: `clawdbot/src/gateway/server/ws-connection/message-handler.ts`
