# Molt Testing Requirements

Comprehensive analysis of testing complexity for all Molt features.

**Legend:**
- 🟢 **AUTONOMOUS**: Can test fully without human interaction
- 🟡 **SEMI-AUTO**: Needs initial setup, then autonomous
- 🔴 **MANUAL**: Requires significant human interaction

---

## 1. Gateway Auto-Discovery (DetectionStep)

**Status:** 🟡 SEMI-AUTO

### How to Test

**Manual Steps:**
1. Clear localStorage to simulate first launch
2. Launch app
3. Observe auto-detection trying common URLs:
   - `ws://localhost:18789`
   - `ws://127.0.0.1:18789`
   - `ws://localhost:8789`
   - `wss://localhost:18789`
4. Verify progress bar updates
5. Verify success path if Gateway found
6. Verify fallback to "No Gateway" screen if not found

### Automated E2E (Playwright)

**Possible:** Yes, with caveats

**Approach:**
```typescript
// Test 1: Happy path (Gateway running)
test('should detect Gateway automatically', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Looking for Gateway/i)).toBeVisible();
  // If Gateway is running, should proceed
  await expect(page.getByPlaceholder(/Message Molt/i)).toBeVisible({ timeout: 10000 });
});

// Test 2: Failure path (no Gateway)
test('should show no Gateway screen when detection fails', async ({ page }) => {
  // Disconnect Gateway or use mock
  await page.goto('/');
  await expect(page.getByText(/Gateway Not Found/i)).toBeVisible({ timeout: 15000 });
});
```

### Dependencies

- **Real Gateway Connection:** Optional (can test failure path without Gateway)
- **Real API Keys/Models:** No
- **OS Features:** No
- **Human Actions:** None (for automated tests)

### Test Time

- **Manual:** 2-3 minutes per scenario
- **Automated:** 10-20 seconds per scenario

### Notes

- Can mock WebSocket responses for predictable testing
- Detection timeout is ~5 seconds (4 URLs × 400ms delay + connection time)
- Test both success and failure paths
- Verify URL switching (ws:// → wss://)

---

## 2. No-Gateway Installation Flow

**Status:** 🔴 MANUAL

### How to Test

**Manual Steps:**
1. Trigger "No Gateway" screen (run app without Gateway)
2. Read installation instructions
3. Copy install command for your platform
4. Open terminal, paste command: `npm install -g clawdbot`
5. Run `clawdbot gateway start`
6. Return to app, click "I've installed it — Retry Detection"
7. Verify detection succeeds

### Automated E2E (Playwright)

**Possible:** Partially (UI only)

**Approach:**
```typescript
test('should show installation instructions', async ({ page }) => {
  await page.goto('/');
  // Wait for detection to fail
  await expect(page.getByText(/Gateway Not Found/i)).toBeVisible({ timeout: 15000 });
  
  // Verify installation instructions
  await expect(page.getByText(/npm install -g clawdbot/i)).toBeVisible();
  
  // Test copy button
  const copyButton = page.getByRole('button', { name: /Copy/i });
  await copyButton.click();
  await expect(page.getByText(/Copied!/i)).toBeVisible();
});
```

### Dependencies

- **Real Gateway Connection:** Yes (for end-to-end flow)
- **Real API Keys/Models:** No
- **OS Features:** Terminal access, npm
- **Human Actions:** **Required** — install Gateway, run commands

### Test Time

- **Manual (first time):** 5-10 minutes (install Gateway)
- **Manual (subsequent):** 1-2 minutes (start/stop Gateway)
- **Automated (UI only):** 30 seconds

### Notes

- **Cannot fully automate** actual Gateway installation
- Can test UI elements (instructions, buttons, flow)
- Can test retry detection after manual setup
- **PARKED FOR MANUAL REVIEW** with David

---

## 3. Keychain Token Storage

**Status:** 🟡 SEMI-AUTO

### How to Test

**Manual Steps:**
1. Open Settings dialog
2. Enter Gateway token (e.g., `test-token-123`)
3. Click "Save Changes"
4. Restart app
5. Open Settings → verify token is loaded (shows placeholder, not actual value)
6. Verify token is stored in OS keychain:
   - **macOS:** `security find-generic-password -s com.molt.client`
   - **Windows:** Credential Manager
   - **Linux:** `secret-tool lookup service com.molt.client key gateway_token`

### Automated E2E (Playwright)

**Possible:** Yes, but needs Tauri runtime

**Approach:**
```typescript
test('should store token in keychain', async ({ page }) => {
  // Open settings
  await page.keyboard.press('Control+,'); // or Cmd+,
  
  // Enter token
  const tokenInput = page.getByPlaceholder(/Stored securely/i);
  await tokenInput.fill('test-token-abc123');
  
  // Save
  await page.getByRole('button', { name: /Save Changes/i }).click();
  
  // Reload app
  await page.reload();
  
  // Open settings again
  await page.keyboard.press('Control+,');
  
  // Token field should be password-masked (shows placeholder)
  await expect(tokenInput).toHaveAttribute('type', 'password');
});
```

### Dependencies

- **Real Gateway Connection:** No (for storage test)
- **Real API Keys/Models:** No
- **OS Features:** **Yes** — Keychain/Credential Manager access
- **Human Actions:** May need to approve keychain access on first use (macOS)

### Test Time

- **Manual:** 3-5 minutes
- **Automated:** 30-60 seconds

### Notes

- Tauri's `keychain` plugin handles OS-specific storage
- First access may trigger OS permission prompt (manual approval)
- Token is never stored in localStorage or visible plaintext
- Delete token test: clear keychain manually or via Tauri command

---

## 4. WebSocket Connection/Retry

**Status:** 🟡 SEMI-AUTO

### How to Test

**Manual Steps:**
1. **Happy Path:**
   - Start Gateway (`clawdbot gateway start`)
   - Launch app → should connect automatically
   - Verify green "Connected" indicator in Settings
2. **Retry on Disconnect:**
   - Stop Gateway while app is running
   - Observe disconnection
   - Restart Gateway
   - App should attempt to reconnect (currently: requires manual reconnect via Settings)
3. **Protocol Fallback (ws:// ↔ wss://):**
   - Try connecting to `ws://` URL
   - If fails, app switches to `wss://` automatically
   - Verify "Connected using wss://" notice in Settings

### Automated E2E (Playwright)

**Possible:** Yes, with local Gateway

**Approach:**
```typescript
test('should connect to Gateway', async ({ page }) => {
  // Assuming Gateway is running on localhost:18789
  await page.goto('/');
  
  // Open settings
  await page.keyboard.press('Control+,');
  
  // Test connection
  await page.getByRole('button', { name: /Test Connection/i }).click();
  
  // Should show success
  await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 5000 });
});

test('should fallback to wss:// if ws:// fails', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+,');
  
  // Enter ws:// URL (that only responds to wss://)
  const urlInput = page.getByPlaceholder(/ws:\/\//i);
  await urlInput.fill('ws://secure-only-gateway.example.com:8080');
  
  await page.getByRole('button', { name: /Test Connection/i }).click();
  
  // Should auto-switch to wss://
  await expect(page.getByText(/Connected using wss:\/\//i)).toBeVisible({ timeout: 10000 });
});
```

### Dependencies

- **Real Gateway Connection:** **Yes** (or mock WebSocket server)
- **Real API Keys/Models:** No
- **OS Features:** No
- **Human Actions:** Start/stop Gateway for reconnect tests

### Test Time

- **Manual:** 5-10 minutes (test all scenarios)
- **Automated:** 1-2 minutes per scenario

### Notes

- Current implementation: Rust (`gateway.rs`) uses `tokio_tungstenite`
- Protocol fallback is automatic (`try_connect_with_fallback`)
- Retry logic: **Not yet implemented** — manual reconnection required
- Future: add exponential backoff reconnection

---

## 5. Message Streaming

**Status:** 🟢 AUTONOMOUS

### How to Test

**Manual Steps:**
1. Send a message (e.g., "Tell me a story")
2. Observe streaming behavior:
   - Message appears word-by-word
   - Cursor pulses while streaming
   - Scroll follows new content
3. Verify "done" event completes stream
4. Test cancel: close conversation mid-stream

### Automated E2E (Playwright)

**Possible:** Yes (with mock or real Gateway)

**Approach:**
```typescript
test('should stream message response', async ({ page }) => {
  await page.goto('/');
  
  // Send message
  const input = page.getByPlaceholder(/Message Molt/i);
  await input.fill('Hello!');
  await page.keyboard.press('Enter');
  
  // Should show user message immediately
  await expect(page.getByText('Hello!')).toBeVisible({ timeout: 1000 });
  
  // If connected to Gateway, should stream response
  // Note: This requires Gateway to be running or mock responses
  
  // Look for streaming indicator
  const streamingIndicator = page.locator('.animate-pulse'); // pulsing cursor
  if (await streamingIndicator.isVisible({ timeout: 2000 })) {
    // Wait for completion
    await expect(streamingIndicator).not.toBeVisible({ timeout: 30000 });
  }
});
```

### Dependencies

- **Real Gateway Connection:** Preferred (can mock for unit tests)
- **Real API Keys/Models:** Yes (if using real Gateway)
- **OS Features:** No
- **Human Actions:** None

### Test Time

- **Manual:** 1-2 minutes per test
- **Automated:** 5-30 seconds (depends on response time)

### Notes

- Streaming uses Tauri events: `gateway:stream`, `gateway:complete`
- Can mock streaming by emitting events manually
- Test both fast and slow streams (character-by-character vs chunk-by-chunk)
- Test interruption: start new message mid-stream

---

## 6. Conversation CRUD

**Status:** 🟢 AUTONOMOUS

### How to Test

**Manual Steps:**
1. **Create:**
   - Click "New Chat" button (or press Cmd+N / Ctrl+N)
   - Verify new empty conversation
2. **Read:**
   - Select conversation from sidebar
   - Verify messages load
3. **Update:**
   - Send message → verify conversation updates
   - Verify title updates (first message)
   - Pin conversation → verify stays at top
4. **Delete:**
   - Hover conversation → click "..." menu → Delete
   - Confirm deletion
   - Verify conversation removed from sidebar and IndexedDB

### Automated E2E (Playwright)

**Possible:** Yes, fully autonomous

**Approach:**
```typescript
test('should create new conversation', async ({ page }) => {
  await page.goto('/');
  
  // Create new conversation
  await page.getByRole('button', { name: /New Chat/i }).click();
  
  // Should show empty input
  const input = page.getByPlaceholder(/Message Molt/i);
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('');
});

test('should delete conversation', async ({ page }) => {
  await page.goto('/');
  
  // Create test conversation
  const uniqueTitle = `Test Conv ${Date.now()}`;
  await page.getByPlaceholder(/Message Molt/i).fill(uniqueTitle);
  await page.keyboard.press('Enter');
  
  // Wait for message to appear
  await expect(page.getByText(uniqueTitle)).toBeVisible();
  
  // Find conversation in sidebar
  const conv = page.getByText(uniqueTitle).first();
  await conv.hover();
  
  // Click delete (if visible)
  const deleteBtn = page.getByRole('button', { name: /Delete/i });
  if (await deleteBtn.isVisible({ timeout: 1000 })) {
    await deleteBtn.click();
    // Confirm if needed
    const confirmBtn = page.getByRole('button', { name: /Confirm|Yes/i });
    if (await confirmBtn.isVisible({ timeout: 500 })) {
      await confirmBtn.click();
    }
  }
  
  // Should be removed
  await expect(conv).not.toBeVisible({ timeout: 2000 });
});
```

### Dependencies

- **Real Gateway Connection:** No (local storage only)
- **Real API Keys/Models:** No
- **OS Features:** IndexedDB (browser feature)
- **Human Actions:** None

### Test Time

- **Manual:** 5-10 minutes (all CRUD operations)
- **Automated:** 2-5 minutes (comprehensive suite)

### Notes

- All operations use Zustand store + IndexedDB persistence
- Deletion is permanent (no undo) — confirm this in tests
- Pinning: conversations with `isPinned: true` show at top
- Title generation: first user message (truncated to 40 chars)

---

## 7. Search (Quick Filter + Full Search)

**Status:** 🟢 AUTONOMOUS

### How to Test

**Manual Steps:**
1. **Quick Filter (Sidebar):**
   - Type in "Filter conversations..." input at top of sidebar
   - Verify conversations filter by title and content
   - Clear filter → all conversations return
2. **Global Search (Cmd+K / Ctrl+K):**
   - Press Cmd+K
   - Type search query (e.g., "python")
   - Verify results show matching messages
   - Use arrow keys to navigate results
   - Press Enter to jump to conversation
   - Press Esc to close

### Automated E2E (Playwright)

**Possible:** Yes, fully autonomous

**Approach:**
```typescript
test('should filter conversations in sidebar', async ({ page }) => {
  await page.goto('/');
  
  // Create a few conversations with distinct names
  await page.getByPlaceholder(/Message Molt/i).fill('Python tutorial');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  
  await page.getByRole('button', { name: /New Chat/i }).click();
  await page.getByPlaceholder(/Message Molt/i).fill('JavaScript guide');
  await page.keyboard.press('Enter');
  
  // Filter by "Python"
  const filterInput = page.getByPlaceholder(/Filter conversations/i);
  await filterInput.fill('Python');
  
  // Should show Python conversation
  await expect(page.getByText('Python tutorial')).toBeVisible();
  
  // Should hide JavaScript conversation
  await expect(page.getByText('JavaScript guide')).not.toBeVisible();
});

test('should search across all messages', async ({ page }) => {
  await page.goto('/');
  
  // Open global search
  await page.keyboard.press('Control+k');
  
  // Search
  const searchInput = page.getByPlaceholder(/Search all messages/i);
  await searchInput.fill('test query');
  
  // Should show results or "no results" message
  const results = page.getByRole('button').filter({ hasText: /You|Molt/ });
  const noResults = page.getByText(/No results found/i);
  
  // One or the other should be visible
  await expect(results.first().or(noResults)).toBeVisible({ timeout: 2000 });
});
```

### Dependencies

- **Real Gateway Connection:** No
- **Real API Keys/Models:** No
- **OS Features:** IndexedDB
- **Human Actions:** None

### Test Time

- **Manual:** 5-8 minutes (both search types)
- **Automated:** 1-3 minutes

### Notes

- Quick filter: simple string matching on conversation titles
- Global search: full-text search using IndexedDB (`searchPersistedMessages`)
- Search decrypts messages on the fly (encryption is transparent)
- Results sorted by timestamp (most recent first)
- Limit: 50 results max

---

## 8. Settings Persistence

**Status:** 🟢 AUTONOMOUS

### How to Test

**Manual Steps:**
1. Open Settings (Cmd+, / Ctrl+,)
2. Change each setting:
   - Gateway URL
   - Default model
   - Thinking mode default
   - Theme (light/dark/system)
3. Save changes
4. Restart app
5. Open Settings → verify all changes persisted

### Automated E2E (Playwright)

**Possible:** Yes, fully autonomous

**Approach:**
```typescript
test('should persist settings across reload', async ({ page }) => {
  await page.goto('/');
  
  // Open settings
  await page.keyboard.press('Control+,');
  
  // Change theme to dark
  await page.getByRole('button', { name: /Dark/i }).click();
  
  // Change default model
  const modelSelect = page.getByLabel(/Default Model/i);
  await modelSelect.selectOption({ label: /Opus/i });
  
  // Save
  await page.getByRole('button', { name: /Save Changes/i }).click();
  
  // Reload page
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  // Open settings again
  await page.keyboard.press('Control+,');
  
  // Verify dark theme is active
  await expect(page.locator('html')).toHaveClass(/dark/);
  
  // Verify model selection persisted
  await expect(modelSelect).toHaveValue(/opus/i);
});
```

### Dependencies

- **Real Gateway Connection:** No
- **Real API Keys/Models:** No
- **OS Features:** localStorage (browser feature)
- **Human Actions:** None

### Test Time

- **Manual:** 3-5 minutes
- **Automated:** 30-60 seconds

### Notes

- Settings stored in localStorage (key: `molt-settings`)
- Gateway token stored separately in OS keychain (not in settings)
- Settings schema defined in Zustand store
- Theme applies immediately without reload (but persists across restarts)

---

## 9. Encryption (E2E)

**Status:** 🟡 SEMI-AUTO

### How to Test

**Manual Steps:**
1. **Verify Encryption:**
   - Send a message
   - Open browser DevTools → IndexedDB → MoltDB → messages
   - Verify `content` field is base64 gibberish (encrypted)
2. **Verify Decryption:**
   - Reload app
   - Verify messages display correctly (decrypted transparently)
3. **Verify Master Key:**
   - Check OS keychain for `molt-client-master-key`
   - **macOS:** `security find-generic-password -s com.molt.client -a molt-client-master-key`
   - Verify key exists and is base64 string
4. **Verify Key Generation:**
   - Delete master key from keychain
   - Restart app
   - Send message
   - Verify new key generated automatically

### Automated E2E (Playwright)

**Possible:** Yes, but limited (can't easily inspect keychain)

**Approach:**
```typescript
test('should encrypt messages in IndexedDB', async ({ page }) => {
  await page.goto('/');
  
  // Send a message
  const uniqueMsg = `Secret message ${Date.now()}`;
  await page.getByPlaceholder(/Message Molt/i).fill(uniqueMsg);
  await page.keyboard.press('Enter');
  
  // Wait for message to be saved
  await page.waitForTimeout(1000);
  
  // Check IndexedDB
  const encryptedContent = await page.evaluate(async (msg) => {
    const db = await (window as any).indexedDB.open('MoltDB');
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const messages = await store.getAll();
    
    // Find our message
    const ourMsg = messages.find((m: any) => m.content.includes(msg));
    
    // If found, content should NOT be plaintext
    return ourMsg ? ourMsg.content : null;
  }, uniqueMsg);
  
  // Content should be encrypted (not match original)
  expect(encryptedContent).not.toContain(uniqueMsg);
});

test('should decrypt messages on load', async ({ page }) => {
  await page.goto('/');
  
  // Send message
  const testMsg = `Test ${Date.now()}`;
  await page.getByPlaceholder(/Message Molt/i).fill(testMsg);
  await page.keyboard.press('Enter');
  
  // Reload page
  await page.reload();
  
  // Message should still be readable (decrypted)
  await expect(page.getByText(testMsg)).toBeVisible({ timeout: 5000 });
});
```

### Dependencies

- **Real Gateway Connection:** No
- **Real API Keys/Models:** No
- **OS Features:** **Yes** — Keychain access (via Tauri)
- **Human Actions:** May need to approve keychain access on first run

### Test Time

- **Manual:** 5-10 minutes
- **Automated:** 1-2 minutes

### Notes

- Uses Web Crypto API (AES-GCM 256-bit)
- Master key stored in OS keychain (never in browser storage)
- Each message has unique IV (12-byte nonce)
- Encryption/decryption is transparent to users
- Key generation happens automatically on first message
- **Important:** No password needed — OS handles auth (biometrics, login password)

---

## 10. Model Selection

**Status:** 🟢 AUTONOMOUS

### How to Test

**Manual Steps:**
1. Open Settings
2. Verify "Default Model" dropdown shows models:
   - If connected to Gateway: fetched models
   - If offline: fallback models (Claude Sonnet 4.5, Opus 4.5, etc.)
3. Select a model (e.g., Claude Opus 4.5)
4. Save settings
5. Create new conversation
6. Send message
7. Verify model is used (check Gateway request if possible)

### Automated E2E (Playwright)

**Possible:** Yes, fully autonomous

**Approach:**
```typescript
test('should allow model selection', async ({ page }) => {
  await page.goto('/');
  
  // Open settings
  await page.keyboard.press('Control+,');
  
  // Change model
  const modelSelect = page.getByLabel(/Default Model/i);
  await expect(modelSelect).toBeVisible();
  
  // Select Opus
  await modelSelect.selectOption({ label: /Opus/i });
  
  // Save
  await page.getByRole('button', { name: /Save Changes/i }).click();
  
  // Verify saved
  await page.keyboard.press('Control+,');
  await expect(modelSelect).toHaveValue(/opus/i);
});

test('should use fallback models when offline', async ({ page }) => {
  // Simulate offline (no Gateway connection)
  await page.goto('/');
  
  // Open settings
  await page.keyboard.press('Control+,');
  
  // Should show fallback models
  const modelSelect = page.getByLabel(/Default Model/i);
  await expect(modelSelect.locator('option', { hasText: /Claude Sonnet 4.5/i })).toBeVisible();
  await expect(modelSelect.locator('option', { hasText: /Claude Opus 4.5/i })).toBeVisible();
});
```

### Dependencies

- **Real Gateway Connection:** Optional (fallback models work offline)
- **Real API Keys/Models:** No (for testing selection UI)
- **OS Features:** No
- **Human Actions:** None

### Test Time

- **Manual:** 3-5 minutes
- **Automated:** 30-60 seconds

### Notes

- Models fetched from Gateway via `get_models` Rust command
- Fallback models defined in `SettingsDialog.tsx` and `gateway.rs`
- Model stored in settings and passed to Gateway with each message
- Per-conversation model switching: not yet implemented (planned v1.1)

---

## 11. Thinking Mode Toggle

**Status:** 🟢 AUTONOMOUS

### How to Test

**Manual Steps:**
1. Open Settings
2. Toggle "Enable Thinking by Default"
3. Save changes
4. Create new conversation
5. Send message
6. Verify thinking mode is enabled (if Gateway supports it):
   - Should show "🧠 Thinking" section
   - Should show extended reasoning before response
7. Toggle off → verify new conversations don't use thinking

### Automated E2E (Playwright)

**Possible:** Yes, with caveats (requires Gateway support)

**Approach:**
```typescript
test('should toggle thinking mode default', async ({ page }) => {
  await page.goto('/');
  
  // Open settings
  await page.keyboard.press('Control+,');
  
  // Enable thinking
  const thinkingToggle = page.getByLabel(/Enable Thinking by Default/i);
  await thinkingToggle.click();
  
  // Save
  await page.getByRole('button', { name: /Save Changes/i }).click();
  
  // Verify persisted
  await page.keyboard.press('Control+,');
  await expect(thinkingToggle).toBeChecked();
});

test('should send thinking parameter when enabled', async ({ page }) => {
  // This requires inspecting Gateway requests (complex)
  // Alternative: check if thinking UI elements appear
  
  await page.goto('/');
  
  // Enable thinking
  await page.keyboard.press('Control+,');
  await page.getByLabel(/Enable Thinking by Default/i).click();
  await page.getByRole('button', { name: /Save Changes/i }).click();
  
  // Send message
  await page.getByPlaceholder(/Message Molt/i).fill('Solve a complex problem');
  await page.keyboard.press('Enter');
  
  // If Gateway supports thinking, should show thinking indicator
  const thinkingIndicator = page.getByText(/🧠|Thinking/i);
  // Note: This may not appear if Gateway doesn't support thinking
});
```

### Dependencies

- **Real Gateway Connection:** Yes (for full thinking display)
- **Real API Keys/Models:** Yes (Claude Opus/Sonnet 4.5 support thinking)
- **OS Features:** No
- **Human Actions:** None

### Test Time

- **Manual:** 3-5 minutes
- **Automated:** 1-2 minutes

### Notes

- Thinking mode requires Gateway + model support (Claude Opus 4.5)
- Toggle only affects default for new conversations
- Per-conversation override: not yet implemented (planned v1.1)
- Thinking content stored separately in message metadata

---

## 12. Keyboard Shortcuts

**Status:** 🟢 AUTONOMOUS

### How to Test

**Manual Steps:**
Test each shortcut:

| Shortcut | Expected Behavior |
|----------|-------------------|
| **Cmd/Ctrl+N** | New conversation |
| **Cmd/Ctrl+K** | Open search dialog |
| **Cmd/Ctrl+,** | Open settings |
| **Cmd/Ctrl+\\** | Toggle sidebar |
| **Enter** (in input) | Send message |
| **Shift+Enter** | New line in message |
| **Esc** (in search) | Close search |
| **↑/↓** (in search) | Navigate results |

### Automated E2E (Playwright)

**Possible:** Yes, fully autonomous

**Approach:**
```typescript
test('Cmd+N should create new conversation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+n');
  
  // Should clear chat and focus input
  const input = page.getByPlaceholder(/Message Molt/i);
  await expect(input).toBeFocused();
});

test('Cmd+K should open search', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  
  // Search dialog should appear
  await expect(page.getByPlaceholder(/Search all messages/i)).toBeVisible();
});

test('Cmd+, should open settings', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+,');
  
  // Settings dialog should appear
  await expect(page.getByText(/Gateway Connection/i)).toBeVisible();
});

test('Shift+Enter should add new line', async ({ page }) => {
  await page.goto('/');
  
  const input = page.getByPlaceholder(/Message Molt/i);
  await input.fill('Line 1');
  await page.keyboard.press('Shift+Enter');
  await input.pressSequentially('Line 2');
  
  // Should not send yet
  await expect(page.getByText('Line 1')).not.toBeVisible();
});

test('Arrow keys should navigate search results', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  
  const searchInput = page.getByPlaceholder(/Search all messages/i);
  await searchInput.fill('test');
  
  // Navigate with arrows
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  
  // First result should be selected
  const firstResult = page.locator('.bg-muted').first();
  await expect(firstResult).toBeVisible();
});
```

### Dependencies

- **Real Gateway Connection:** No
- **Real API Keys/Models:** No
- **OS Features:** No
- **Human Actions:** None

### Test Time

- **Manual:** 10-15 minutes (test all shortcuts)
- **Automated:** 3-5 minutes (comprehensive suite)

### Notes

- Shortcuts implemented with native JS event listeners
- Cross-platform: Cmd (Mac) vs Ctrl (Windows/Linux) handled automatically
- Some shortcuts may conflict with browser/OS shortcuts (test in Tauri app, not browser)

---

## 13. Dark/Light Theme

**Status:** 🟢 AUTONOMOUS

### How to Test

**Manual Steps:**
1. Open Settings
2. Switch between Light, Dark, System themes
3. Verify UI updates immediately
4. Verify persistence: restart app, theme should persist

**Visual checks:**
- Background colors change
- Text colors adjust for contrast
- Code syntax highlighting adapts
- Borders and shadows update

### Automated E2E (Playwright)

**Possible:** Yes, fully autonomous

**Approach:**
```typescript
test('should switch to dark theme', async ({ page }) => {
  await page.goto('/');
  
  // Open settings
  await page.keyboard.press('Control+,');
  
  // Switch to dark
  await page.getByRole('button', { name: /Dark/i }).click();
  
  // Save
  await page.getByRole('button', { name: /Save Changes/i }).click();
  
  // Verify dark class on html
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('should switch to light theme', async ({ page }) => {
  await page.goto('/');
  
  // Open settings
  await page.keyboard.press('Control+,');
  
  // Switch to light
  await page.getByRole('button', { name: /Light/i }).click();
  await page.getByRole('button', { name: /Save Changes/i }).click();
  
  // Verify no dark class
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('should persist theme across reload', async ({ page }) => {
  await page.goto('/');
  
  // Set to dark
  await page.keyboard.press('Control+,');
  await page.getByRole('button', { name: /Dark/i }).click();
  await page.getByRole('button', { name: /Save Changes/i }).click();
  
  // Reload
  await page.reload();
  
  // Should still be dark
  await expect(page.locator('html')).toHaveClass(/dark/);
});
```

### Dependencies

- **Real Gateway Connection:** No
- **Real API Keys/Models:** No
- **OS Features:** System theme detection (for "system" option)
- **Human Actions:** None

### Test Time

- **Manual:** 3-5 minutes
- **Automated:** 1-2 minutes

### Notes

- Theme stored in localStorage
- Tailwind CSS handles theme switching via `.dark` class on `<html>`
- System theme uses `prefers-color-scheme` media query
- Theme applies immediately (no reload needed)

---

## 14. File Attachments (if implemented)

**Status:** 🔴 MANUAL

### How to Test

**Manual Steps:**
1. Click attachment icon in chat input
2. Select file (image, PDF, text, code)
3. Verify preview appears
4. Send message with attachment
5. Verify attachment displays in message bubble
6. Test download/open attachment

### Automated E2E (Playwright)

**Possible:** Partially (file upload simulation)

**Approach:**
```typescript
test('should upload file attachment', async ({ page }) => {
  await page.goto('/');
  
  // Upload file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('./test-assets/sample.png');
  
  // Verify preview
  await expect(page.getByAltText(/sample.png/i)).toBeVisible();
  
  // Send message
  await page.keyboard.press('Enter');
  
  // Verify attachment in message
  await expect(page.getByAltText(/sample.png/i)).toBeVisible();
});
```

### Dependencies

- **Real Gateway Connection:** Yes (Gateway must support attachments)
- **Real API Keys/Models:** Yes (multimodal models like GPT-4 Vision, Claude 3+)
- **OS Features:** File picker dialog
- **Human Actions:** **Required** — select files, verify visual rendering

### Test Time

- **Manual:** 10-15 minutes (test various file types)
- **Automated:** 5-10 minutes (limited coverage)

### Notes

- **NOT YET IMPLEMENTED** in Molt (UI exists, functionality planned for v1.1)
- **PARKED FOR MANUAL REVIEW** with David
- Requires Gateway support for multipart/form-data or base64 encoding
- Security: validate file types, size limits
- Accessibility: alt text for images, download links for other files

---

## 15. Image Rendering (if implemented)

**Status:** 🔴 MANUAL

### How to Test

**Manual Steps:**
1. Send message that includes image URL (e.g., from model response)
2. Verify image renders inline
3. Test lazy loading (if implemented)
4. Test lightbox/zoom (if implemented)
5. Verify image accessibility (alt text)

### Automated E2E (Playwright)

**Possible:** Yes, but needs human verification of visual quality

**Approach:**
```typescript
test('should render image in message', async ({ page }) => {
  await page.goto('/');
  
  // Send message with image markdown
  await page.getByPlaceholder(/Message Molt/i).fill('![Test image](https://example.com/image.png)');
  await page.keyboard.press('Enter');
  
  // Verify image element exists
  const img = page.locator('img[alt="Test image"]');
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('src', 'https://example.com/image.png');
});
```

### Dependencies

- **Real Gateway Connection:** Optional (can test with static markdown)
- **Real API Keys/Models:** Optional
- **OS Features:** No
- **Human Actions:** **Required** — verify image displays correctly, good quality

### Test Time

- **Manual:** 5-10 minutes
- **Automated (functional):** 2-3 minutes
- **Manual (visual QA):** 5-10 minutes

### Notes

- **NOT YET FULLY IMPLEMENTED** in Molt (markdown images might work, inline display TBD)
- **PARKED FOR MANUAL REVIEW** with David
- Consider lazy loading for performance
- Accessibility: require alt text, keyboard navigation
- Security: validate image sources (prevent XSS)

---

## Summary Table

| # | Feature | Status | Gateway? | API Keys? | OS Features? | Human? | Test Time |
|---|---------|--------|----------|-----------|--------------|--------|-----------|
| 1 | Gateway Auto-Discovery | 🟡 SEMI | Optional | No | No | None | 10-20s |
| 2 | No-Gateway Install Flow | 🔴 MANUAL | Yes | No | Terminal | **Required** | 5-10m |
| 3 | Keychain Token Storage | 🟡 SEMI | No | No | **Keychain** | Approval (first) | 30-60s |
| 4 | WebSocket Connection/Retry | 🟡 SEMI | **Yes** | No | No | Start/stop | 1-2m |
| 5 | Message Streaming | 🟢 AUTO | Preferred | Yes | No | None | 5-30s |
| 6 | Conversation CRUD | 🟢 AUTO | No | No | IndexedDB | None | 2-5m |
| 7 | Search | 🟢 AUTO | No | No | IndexedDB | None | 1-3m |
| 8 | Settings Persistence | 🟢 AUTO | No | No | localStorage | None | 30-60s |
| 9 | Encryption (E2E) | 🟡 SEMI | No | No | **Keychain** | Approval (first) | 1-2m |
| 10 | Model Selection | 🟢 AUTO | Optional | No | No | None | 30-60s |
| 11 | Thinking Mode Toggle | 🟢 AUTO | Yes | Yes | No | None | 1-2m |
| 12 | Keyboard Shortcuts | 🟢 AUTO | No | No | No | None | 3-5m |
| 13 | Dark/Light Theme | 🟢 AUTO | No | No | System theme | None | 1-2m |
| 14 | File Attachments | 🔴 MANUAL | Yes | Yes | File picker | **Required** | 10-15m |
| 15 | Image Rendering | 🔴 MANUAL | Optional | Optional | No | **QA** | 5-10m |

---

## Recommended Testing Strategy

### Phase 1: Autonomous Tests (CI/CD)
Run on every commit:
- ✅ Conversation CRUD
- ✅ Search (quick filter + global)
- ✅ Settings persistence
- ✅ Keyboard shortcuts
- ✅ Theme switching
- ✅ Model selection (offline mode)

**Runtime:** ~5-10 minutes
**Environment:** GitHub Actions, no Gateway needed

### Phase 2: Semi-Auto Tests (Pre-Release)
Run before releases:
- ⚠️ Gateway auto-discovery (with mock or local Gateway)
- ⚠️ WebSocket connection/retry
- ⚠️ Keychain token storage (Tauri runtime)
- ⚠️ Encryption (E2E)
- ⚠️ Message streaming (with local Gateway)

**Runtime:** ~10-20 minutes
**Environment:** Local dev machine with Gateway running

### Phase 3: Manual Tests (Before Major Releases)
Human QA required:
- 🚫 No-Gateway installation flow (install Clawdbot)
- 🚫 File attachments (verify visual rendering, multi-file support)
- 🚫 Image rendering (verify quality, lazy loading, zoom)
- 🚫 OS-specific keychain approvals (biometric auth, permissions)

**Runtime:** ~30-60 minutes
**Environment:** Real devices (macOS, Windows, Linux)

---

## Parked Features for David's Review

1. **No-Gateway Installation Flow**
   - **Why parked:** Cannot automate actual Gateway installation
   - **Manual steps:** Human must run `npm install -g clawdbot` and `clawdbot gateway start`
   - **Recommendation:** Document in QA checklist, test manually before each release

2. **File Attachments**
   - **Why parked:** Not yet fully implemented (UI exists, functionality planned v1.1)
   - **Blocker:** Gateway support needed for multipart uploads or base64 encoding
   - **Recommendation:** Defer testing until implementation complete

3. **Image Rendering**
   - **Why parked:** Partially implemented (markdown images work, inline display TBD)
   - **Blocker:** Visual QA required — humans must verify rendering quality
   - **Recommendation:** Add to manual QA checklist when feature complete

---

## Next Steps

1. **Set up CI/CD:** Implement Phase 1 autonomous tests in GitHub Actions
2. **Create test fixtures:** Mock Gateway responses for predictable testing
3. **Document manual QA:** Create checklist for Phase 3 manual tests
4. **Review with David:** Discuss parked features and prioritization

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-28  
**Author:** Subagent (deep-review-testing)
