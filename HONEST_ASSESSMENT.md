# Moltzer - Brutally Honest Assessment

**Date:** 2025-01-27  
**Reviewer:** Claude (subagent)  
**Purpose:** No sugar-coating - what actually works vs what's broken

---

## Executive Summary

**Overall State:** 🟡 **LOOKS GOOD ON PAPER, NEEDS REAL-WORLD TESTING**

The codebase is well-structured with genuine functionality, but there are several critical gaps between documentation promises and actual implementation. The app **might work** if the Gateway protocol matches what's expected, but several pieces are definitely broken or incomplete.

---

## 1. Core Functionality Check

### ✅ Gateway Connection - LOOKS CORRECT
- **Rust WebSocket code:** Properly implemented using `tokio-tungstenite`
- **Protocol fallback:** Auto-switches between `ws://` and `wss://` - GOOD
- **Token authentication:** Passed via query parameter
- **Event emission:** Uses Tauri's event system correctly

**Confidence:** 80% likely to work IF Gateway protocol matches

### ⚠️ Message Sending/Receiving - UNCERTAIN
- **Request format sent:**
  ```json
  {"id": "uuid", "method": "chat.send", "params": {"message": "...", "sessionKey": "...", "model": "...", "thinking": "..."}}
  ```
- **Expected response format:** `StreamChunk` with `requestId`, `content`, `done`, `type` fields
- **CRITICAL UNKNOWN:** Does Clawdbot Gateway actually use this exact JSON-RPC-like protocol?

**Risk:** If Gateway uses a different protocol (e.g., simple text, different JSON structure), **the entire messaging system breaks silently**.

### ⚠️ Streaming - DEPENDENT ON PROTOCOL
- Frontend listens for `gateway:stream` events
- Rust parses incoming messages as `StreamChunk` or `GatewayResponse`
- **Works IF:** Gateway sends `{"content": "chunk of text", "done": false}`
- **Breaks IF:** Gateway sends in any other format

### ✅ Conversation Persistence - SOLID
- **IndexedDB via Dexie:** Properly implemented
- **Encryption:** AES-GCM 256-bit, Web Crypto API - legit
- **Key storage:** OS keychain via Tauri commands
- **Data sync:** Debounced persistence during streaming (smart!)

---

## 2. Recent Changes Audit

Based on git log, tonight's work included comprehensive docs and tests. Key commits:

| Commit | Status | Notes |
|--------|--------|-------|
| `4560822` Add comprehensive test suite | ⚠️ | **18 tests FAILING** (see below) |
| `dc2f9a0` Auto Gateway discovery | ✅ | Code exists, looks correct |
| `1c0b29a` Move token to OS keychain | ✅ | Properly implemented |
| `0aad8ad` Fix custom toggle with shadcn Switch | ✅ | UI fix |
| `ab43524` Connection retry with backoff | ✅ | Exponential backoff: 5s → 10s → 30s → 60s |

### Test Results (FAILING)
```
7 test files FAILED | 5 passed
18 tests FAILED | 174 passed
```

Failing tests are in:
- `formatting.test.ts` - sanitization functions don't match expected behavior
- Other test files - unknown without full output

---

## 3. Integration Points

### ⚠️ WebSocket Protocol - CRITICAL CONCERN
**Moltzer sends:**
```json
{"id":"uuid","method":"chat.send","params":{"message":"...","sessionKey":"...","model":"..."}}
```

**Question:** Does Clawdbot Gateway expect this exact format?

- Method names used: `chat.send`, `models.list`
- This looks like JSON-RPC 2.0-ish format
- **NO VERIFICATION** that this matches Gateway's actual protocol

### ✅ Keychain Integration - FULLY WIRED
```
Frontend → keychain.ts → invoke("keychain_get/set/delete") → Rust keychain.rs → keyring crate
```
- macOS: Keychain ✓
- Windows: Credential Manager ✓
- Linux: Secret Service ✓

**This is actually done properly.**

### ⚠️ Auto-Discovery - CODE EXISTS BUT UNVERIFIABLE
Rust `discovery.rs` implements:
1. Environment variables (`CLAWDBOT_GATEWAY_URL`, etc.)
2. Local port scanning (18789, 8789, 3000, 8080)
3. Config file parsing (.env, JSON configs)
4. Tailscale network scanning

**Problem:** Can't verify Rust compiles (`cargo` not available on this system).

---

## 4. Red Flags

### 🚨 Dead Code: File Attachments
```tsx
// ChatInput.tsx
<input type="file" ... />  // UI exists
```
**Reality:** Files are captured but never sent to Gateway. README admits: "UI exists but not yet functional (planned for v1.1)"

### 🚨 Broken: get_models Returns Hardcoded Fallback
```rust
// gateway.rs
pub async fn get_models(...) -> Result<Vec<ModelInfo>, String> {
    // ...sends request to Gateway...
    
    // TODO: Add response channel to wait for actual model list
    // For now, return fallback models - Gateway will stream the actual list
    Ok(get_fallback_models())  // <-- ALWAYS RETURNS HARDCODED LIST
}
```
**Impact:** Model list is fake. Gateway's actual models are ignored.

### 🚨 Security Concern: Token in localStorage
```tsx
// GatewaySetupStep.tsx
localStorage.setItem('Moltzer-onboarding-progress', JSON.stringify({
  step: 'setup-complete',
  gatewayUrl: actualUrl,
  gatewayToken: trimmedToken,  // <-- OOPS
  timestamp: Date.now()
}));
```
**Problem:** Token meant for keychain is also saved in localStorage during onboarding. This undermines the "secure keychain storage" promise.

### 🚨 Keyboard Shortcuts - PARTIALLY MISSING
README promises these shortcuts:
| Shortcut | Promised | Actual |
|----------|----------|--------|
| ⌘N New conversation | ✅ | In Sidebar.tsx |
| ⌘K Search | ✅ | In SearchDialog trigger |
| ⌘, Settings | ❓ | Need to verify |
| ⌘\\ Toggle sidebar | ✅ | In App.tsx |
| Delete conversation shortcut | ❓ | Not obviously implemented |

### ⚠️ Voice Input/Output
**Promise:** Listed in roadmap  
**Reality:** No code exists. Not started.

### ⚠️ System Tray Integration
**Promise:** Listed in roadmap  
**Reality:** No code exists.

---

## 5. What ACTUALLY Works End-to-End

### ✅ Verified Working (by code analysis):
1. **App launches** - Tauri setup is correct
2. **Dark/Light theme switching** - CSS classes applied correctly
3. **Sidebar toggle** - State management works
4. **Conversation CRUD** - Create, select, delete, pin
5. **IndexedDB persistence** - Conversations survive restarts
6. **Encryption at rest** - Messages encrypted before storage
7. **Keychain storage** - Gateway token securely stored
8. **Onboarding flow** - Multi-step wizard exists and flows

### ⚠️ Probably Works (needs real test):
1. **WebSocket connection** - Code looks correct
2. **Message sending** - If protocol matches
3. **Streaming display** - If Gateway sends expected format
4. **Auto-discovery** - If Rust compiles
5. **Reconnection with backoff** - Logic is there

### ❌ Definitely Broken:
1. **Model list from Gateway** - Always returns hardcoded fallback
2. **File attachments** - UI only, no backend
3. **Voice input/output** - Non-existent
4. **18 unit tests** - Failing

### ❌ Unverifiable Without Runtime:
1. Does the Rust code compile?
2. Does the WebSocket protocol match Gateway?
3. Does streaming actually work?

---

## 6. What Would Break Immediately

### If a User Tried Today:

1. **Model dropdown** shows generic fallback models, not what Gateway actually supports
2. **Attach file button** does nothing useful
3. **If Gateway uses different JSON protocol** - all messaging broken
4. **Token gets saved to localStorage** during onboarding (security hole)
5. **Certain formatting operations** fail (18 broken tests)

---

## 7. Recommendations

### Before Calling It "Done":

1. **Verify Gateway Protocol**
   - Get actual Clawdbot Gateway docs
   - Compare with Moltzer's expected format
   - Could be completely incompatible

2. **Fix get_models**
   - Actually wait for Gateway response
   - Don't return hardcoded fallback

3. **Fix localStorage Token Leak**
   - Remove `gatewayToken` from onboarding progress
   - Only store in keychain

4. **Fix or Remove Attachment UI**
   - Remove the broken attach button
   - Or implement properly

5. **Fix Failing Tests**
   - 18 tests failing = quality issues
   - `sanitizeInput` doesn't work as documented

6. **Real End-to-End Test**
   - Actually run against Clawdbot Gateway
   - Verify all flows work

---

## Summary Table

| Feature | Docs Say | Reality |
|---------|----------|---------|
| Gateway connection | ✅ | ⚠️ Unverified protocol |
| Message streaming | ✅ | ⚠️ Depends on Gateway format |
| Conversation persistence | ✅ | ✅ Works |
| Encryption at rest | ✅ | ✅ Works |
| OS Keychain | ✅ | ✅ Works |
| Auto-discovery | ✅ | ⚠️ Code exists, unverified |
| Model selection | ✅ | ❌ Hardcoded fallback |
| File attachments | 🔜 v1.1 | ❌ Dead UI code |
| Voice I/O | 🔜 | ❌ Non-existent |
| All tests pass | ✅ | ❌ 18 failing |

---

## Verdict

**The documentation oversells the current state.** The app has a solid foundation with legitimate encryption, persistence, and UI - but the **core messaging functionality is unverified** against actual Clawdbot Gateway, and several features are either broken or missing entirely.

Before shipping to users:
1. Verify WebSocket protocol compatibility
2. Fix the hardcoded models issue
3. Fix the localStorage token leak
4. Either implement or remove attachment UI
5. Fix the 18 failing tests
6. Do a real end-to-end test

**Honest rating: 65% complete.** Good bones, needs finishing work.
