# Changelog

## [1.1.0] - 2026-01-29

### 🎉 Major UX Overhaul

**Onboarding**
- Rewrote all onboarding copy in plain language (no more "Gateway URL")
- Removed technical jargon - users now see "Connection Address" and "Security Password"
- 80% confusion rate → targeting <20%

**Keyboard Navigation**
- Full keyboard accessibility (Tab, Arrow keys, Enter, Escape)
- Focus traps in all dialogs (Search, Settings, Export, Confirm)
- New shortcuts: Cmd+K (search), Cmd+N (new chat), Cmd+/ (focus input)
- All interactions work without a mouse

**Accessibility (WCAG 2.1 AA)**
- Screen reader support throughout
- 122 ARIA attributes, 20 semantic roles
- Focus indicators on all interactive elements
- Respects `prefers-reduced-motion`

**Error Messages**
- All errors now human-readable
- "Connection refused" → "Nothing is responding at that address"
- Added retry buttons where appropriate
- 20+ error patterns translated

**Performance**
- Lazy load MarkdownRenderer (340KB deferred from initial load)
- Initial bundle: 141KB gzipped (60% reduction)
- Cold start target: <500ms

**Animations**
- Message fade-in with slide
- Button hover scale effects
- Shimmer loading states
- All animations <200ms

**Connection Resilience**
- Automatic reconnection with exponential backoff
- Offline state handling
- Clear "Not connected" messaging

### 🔒 Security
- Grade A security audit
- No protocol downgrade vulnerability
- Tokens stored in OS keychain only
- XSS protection in markdown renderer

### 🧪 Testing
- 437 tests passing
- 62 new tests for error translation
- Build verified clean

### Files Changed
- 61 files modified
- +8,319 lines / -999 lines

---

## [1.0.0] - Initial Release

Base functionality for Moltz desktop client.
