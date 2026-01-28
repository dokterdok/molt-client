# Moltzer - Real Issues Assessment

**Date:** 2026-01-28 06:40
**Purpose:** Identify what's actually wrong, not what looks good on paper

---

## Critical Questions Not Answered

### 1. Has this been tested with a real Clawdbot Gateway?
**Status: UNKNOWN**

- All tests mock the Gateway
- No integration tests against real Gateway
- Protocol assumed but not verified
- **Risk:** Could completely fail on first real use

### 2. What's the actual user experience?
**Status: UNTESTED BY A HUMAN**

- Automated tests don't catch UX issues
- No real user feedback
- Onboarding flow never tested end-to-end with real Gateway

---

## Known Technical Issues

### Build/Lint Status
- ✅ Build passes
- ⚠️ 9 lint warnings (test files, non-null assertions)
- ✅ 239/239 tests pass

### Bundle Size
- ⚠️ Main chunk: 815 KB (should be < 500 KB)
- Code splitting partially done but main bundle still large

### Protocol Uncertainty
The app sends:
```json
{"id":"uuid","method":"chat.send","params":{...}}
```

**CRITICAL:** Does Clawdbot Gateway actually use this exact protocol?
- Method names: `chat.send`, `models.list` - are these correct?
- Streaming format: expects `{"content":"...","done":false}` - is this right?

---

## Missing Features (For Top-3 App Store Quality)

### 1. No Real Error Recovery UX
- Shows error banner but recovery path unclear
- User doesn't know what to do when Gateway fails

### 2. No Connection Quality Indicator
- Protocol has health metrics but UI doesn't show them
- User can't see if connection is degraded

### 3. No Conversation Management
- Can delete but no bulk operations
- No archive/star/organize features
- No conversation folders or tags

### 4. No Message Attachments
- Code stub exists but not implemented
- ChatInput has attachment button but doesn't work

### 5. No Markdown Preview While Typing
- User types markdown blind
- No live preview before send

### 6. No Keyboard Navigation for Messages
- Can't navigate messages with keyboard
- No "edit last message" shortcut

### 7. No Export to Common Formats
- Export exists but limited formats
- No PDF export
- No copy whole conversation

### 8. No System Prompt / Custom Instructions
- Can't set system prompt per conversation
- No "act as" templates

### 9. No Model Parameter Controls
- Temperature, top_p, etc. not exposed
- Power users can't tune responses

### 10. No Conversation Memory/Context Display
- User can't see how much context is being sent
- No token count indicator

---

## UX Polish Missing

1. **Skeleton loaders** - Added but untested visually
2. **Empty states** - Added but generic
3. **Loading states** - Inconsistent across the app
4. **Error states** - Too technical for normal users
5. **Offline mode** - Logic exists but UX is poor
6. **First-run experience** - Onboarding never tested with real Gateway

---

## What Needs to Happen

### Immediate (Before Any User Sees This)
1. **Test with real Clawdbot Gateway** - This is #1 priority
2. **Verify protocol matches** - Chat.send, models.list, streaming format
3. **Test onboarding flow** - Real Gateway, real token, real connection

### For App Store Quality
1. Fix bundle size (code split more aggressively)
2. Add connection quality indicator
3. Improve error messages for normal users
4. Add token count / context indicator
5. Add system prompt support

### Nice to Have
1. Conversation folders/tags
2. PDF export
3. Model parameter controls
4. Markdown preview

---

## Bottom Line

**The app looks complete on paper but has never been tested with a real Gateway.**

All the overnight work added docs, tests, and polish - but nobody verified the core functionality actually works against the real Clawdbot Gateway protocol.

**Priority #1:** Connect to a real Gateway and verify messages send/receive correctly.
