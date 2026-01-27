# Onboarding Flow Test Plan

## Test Cases

### 1. Fresh Install (No Previous Data)
**Setup:**
- Clear all localStorage items:
  - `Moltzer-onboarding-completed`
  - `Moltzer-onboarding-skipped`
  - `Moltzer-settings`
  - `Moltzer-app-version`

**Expected Result:**
✅ Onboarding should show automatically

---

### 2. Stale localStorage with No Gateway URL
**Setup:**
- Set `Moltzer-settings` to `{"gatewayUrl": "", "theme": "dark"}`
- Set `Moltzer-onboarding-completed` to `"true"`

**Expected Result:**
✅ Onboarding should show (because Gateway URL is empty)

---

### 3. Valid Configuration
**Setup:**
- Set `Moltzer-settings` to `{"gatewayUrl": "ws://localhost:18789", "theme": "dark"}`
- Set `Moltzer-onboarding-completed` to `"true"`

**Expected Result:**
✅ App should load normally (no onboarding)

---

### 4. App Version Upgrade
**Setup:**
- Set `Moltzer-app-version` to `"0.9.0"` (old version)
- Set `Moltzer-onboarding-completed` to `"true"`
- Set `Moltzer-settings` to `{"gatewayUrl": "", "theme": "dark"}`

**Expected Result:**
✅ Version upgrade detected → stale flags cleared → onboarding shows

---

### 5. Onboarding Completion Flow
**Steps:**
1. Start with fresh install (no localStorage)
2. Complete onboarding wizard
3. Enter Gateway URL: `ws://localhost:18789`
4. Click "Test Connection" (assume it succeeds)
5. Complete the flow

**Expected Results:**
✅ `Moltzer-onboarding-completed` is set to `"true"`
✅ `Moltzer-settings` contains the Gateway URL
✅ App transitions to main view
✅ Subsequent launches load normally (no onboarding)

---

### 6. Re-run Setup from Settings
**Steps:**
1. Start with valid configuration
2. Open Settings dialog
3. Click "Re-run Setup" button

**Expected Result:**
✅ Onboarding flags are cleared
✅ Onboarding wizard shows immediately
✅ Previous settings are preserved until new ones are saved

---

### 7. Invalid Gateway URL Format
**Setup:**
- Set `Moltzer-settings` to `{"gatewayUrl": "http://localhost:18789", "theme": "dark"}`
- Set `Moltzer-onboarding-completed` to `"true"`

**Expected Result:**
✅ Onboarding should show (because URL doesn't start with ws:// or wss://)

---

## Manual Testing Checklist

Open DevTools Console in the app and run these commands to test different scenarios:

```javascript
// Test 1: Fresh install
localStorage.clear();
location.reload();

// Test 2: Stale localStorage, no URL
localStorage.setItem('Moltzer-onboarding-completed', 'true');
localStorage.setItem('Moltzer-settings', JSON.stringify({gatewayUrl: '', theme: 'dark'}));
location.reload();

// Test 3: Valid configuration
localStorage.setItem('Moltzer-onboarding-completed', 'true');
localStorage.setItem('Moltzer-settings', JSON.stringify({gatewayUrl: 'ws://localhost:18789', theme: 'dark'}));
location.reload();

// Test 4: Version upgrade with no URL
localStorage.setItem('Moltzer-app-version', '0.9.0');
localStorage.setItem('Moltzer-onboarding-completed', 'true');
localStorage.setItem('Moltzer-settings', JSON.stringify({gatewayUrl: '', theme: 'dark'}));
location.reload();

// Test 7: Invalid URL format
localStorage.setItem('Moltzer-onboarding-completed', 'true');
localStorage.setItem('Moltzer-settings', JSON.stringify({gatewayUrl: 'http://localhost:18789', theme: 'dark'}));
location.reload();
```

## Expected Console Logs

When onboarding is triggered, you should see:
```
Onboarding needed: {
  completed: false,
  skipped: false,
  hasValidUrl: false,
  currentUrl: ""
}
```

When version upgrade happens:
```
App upgraded from 0.9.0 to 1.0.0 - clearing stale onboarding data
```
