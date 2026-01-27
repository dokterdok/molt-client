# macOS Frozen UI Bug - Fix Summary

## Problem
Moltzer was completely unusable on macOS with these symptoms:
- App shows "Connecting to Gateway" forever
- Can't click any UI element
- Can't move the window
- No onboarding shown despite fresh install

## Root Causes Identified

### 1. Blocking Keychain Operations
**Location:** `src-tauri/src/keychain.rs`

The macOS Keychain access operations were using **synchronous blocking calls** wrapped in async functions:
```rust
// BEFORE (blocking - froze UI)
pub async fn keychain_get(service: String, key: String) -> Result<String, String> {
    let entry = Entry::new(&service, &key).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}
```

**Why this froze the UI:**
- macOS Keychain access can be slow (system calls, disk I/O)
- May trigger system password prompts/dialogs
- Blocked the Tauri command thread
- On macOS, this blocked the main UI thread

### 2. Long Connection Timeout
**Location:** `src-tauri/src/gateway.rs`

Original timeout was 8 seconds, which meant:
- Users waited 16+ seconds for connection attempts (primary + fallback)
- No feedback during this time
- Appeared frozen even when just waiting

### 3. Onboarding Detection Issues
**Location:** `src/App.tsx`

Onboarding check relied on localStorage flags which could be stale or missing, causing:
- Fresh installs skipping onboarding
- No Gateway URL configured
- Infinite connection attempts

## Fixes Applied

### Fix 1: Non-Blocking Keychain Operations
**Commit:** e5c5c73 - "fix: force onboarding when no Gateway URL configured"

Wrapped all keychain operations in `tokio::task::spawn_blocking`:
```rust
// AFTER (non-blocking - UI stays responsive)
pub async fn keychain_get(service: String, key: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(&service, &key).map_err(|e| e.to_string())?;
        entry.get_password().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
```

**Result:**
- Keychain operations run in separate thread pool
- Main UI thread stays responsive
- No freeze even if Keychain is slow or prompts user

### Fix 2: Reduced Connection Timeout
**Commit:** e5c5c73

Changed timeout from 8 seconds to 5 seconds:
```rust
// Connection timeout: 5 seconds (prevents UI freezing)
let timeout_duration = std::time::Duration::from_secs(5);
```

**Result:**
- Faster feedback when Gateway is unreachable
- Maximum 10 seconds for both protocols (ws:// + wss://)
- UI shows error state sooner

### Fix 3: Robust Onboarding Detection
**Commit:** 3891a49 - "fix: make onboarding check robust and version-aware"

Enhanced onboarding check to validate actual configuration:
```typescript
// Check if Gateway URL is actually configured (not empty, valid format)
const hasValidGatewayUrl = 
    currentSettings.gatewayUrl && 
    currentSettings.gatewayUrl.trim() !== "" &&
    (currentSettings.gatewayUrl.startsWith("ws://") || 
     currentSettings.gatewayUrl.startsWith("wss://"));

// ALWAYS show onboarding if Gateway URL is not configured
const needsOnboarding = !hasValidGatewayUrl || 
                       (!onboardingCompleted && !onboardingSkipped);
```

**Result:**
- Fresh installs ALWAYS show onboarding
- Detects missing/invalid Gateway URLs
- Version-aware cleanup of stale flags

## Testing Required

### On macOS:
1. **Fresh Install Test:**
   - Delete app data: `~/Library/Application Support/com.moltzer.client`
   - Launch app → Should show onboarding immediately
   - UI should remain clickable/responsive throughout

2. **Invalid Gateway Test:**
   - Configure non-existent Gateway URL
   - Should show error within 5 seconds
   - UI should remain responsive
   - Should offer retry options

3. **Keychain Access Test:**
   - Launch app with existing token in Keychain
   - UI should load smoothly without freezing
   - Settings load should be non-blocking

4. **Connection Failure Test:**
   - Disconnect from network
   - Launch app → Should show error state within 10 seconds
   - UI should remain fully interactive

### On Windows (for regression testing):
- All the same tests
- Ensure Windows Credential Manager access is also non-blocking

## Files Changed

1. **src-tauri/src/keychain.rs** - Added spawn_blocking to prevent UI freeze
2. **src-tauri/src/gateway.rs** - Reduced timeout from 8s to 5s
3. **src/App.tsx** - Improved onboarding detection and validation
4. **src/components/ErrorBoundary.tsx** - Added for better error handling

## Commits

- `e5c5c73` - fix: force onboarding when no Gateway URL configured
- `3891a49` - fix: make onboarding check robust and version-aware
- `285a583` - docs: add onboarding fix summary and test results

## Status

✅ **Code changes complete**
✅ **Committed with `fix:` prefix**
✅ **Pushed to origin/master**
⏳ **macOS testing pending** (requires macOS device)
⏳ **Windows regression testing pending**

## Expected Behavior After Fix

1. **Fresh Install:**
   - App shows onboarding immediately
   - No freeze or delay
   - UI fully responsive

2. **Connection Failure:**
   - Shows error within 5 seconds
   - UI remains interactive
   - Offers retry options with countdown

3. **Normal Operation:**
   - Smooth loading from Keychain
   - No UI freeze during startup
   - Responsive throughout

## Next Steps

1. Test on macOS device
2. Verify all fixes work as expected
3. Test on Windows for regression
4. If issues found, iterate
5. If all good, close the bug report

---
**Note:** The root cause was primarily the blocking Keychain operations on macOS. The `spawn_blocking` fix is the critical change that makes the UI responsive.
