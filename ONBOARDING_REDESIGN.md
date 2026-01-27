# Onboarding Redesign: No-Gateway Flow

## Summary
Enhanced Moltzer onboarding to better handle users who don't have Clawdbot Gateway installed yet.

## Changes Implemented

### 1. **Gateway Auto-Detection** (`DetectionStep.tsx`)
- Automatically scans common ports (18789, 8789) for running Gateway
- Shows real-time progress during detection
- If found, skips directly to success screen
- If not found, guides user to install Gateway

### 2. **"Don't Have Clawdbot?" Flow** (`NoGatewayStep.tsx`)
- **Clear explanation**: What is Clawdbot? Why do you need it?
- **Installation guide**: 
  - Step-by-step instructions
  - One-click copy of install command
  - Platform-specific commands (Windows/macOS/Linux)
  - Link to full documentation
- **"I've installed it" button**: Retries detection after installation
- **Manual setup option**: For advanced users who want to enter URL manually

### 3. **Enhanced Error Recovery** (Updated `GatewaySetupStep.tsx`)
- **Actionable error messages**:
  - "Gateway not running" → Shows `clawdbot gateway start` command
  - "Connection refused" → Explains how to check Gateway status
  - "Auth failed" → Shows where to find token (`clawdbot gateway status`)
  - "Wrong port" → Suggests default port (18789)
- **Copy-to-clipboard buttons** for all commands
- **Port suggestion**: If wrong port detected, offers one-click fix

### 4. **Auto-Fix Features**
- ✅ Trim whitespace from URL and token inputs automatically
- ✅ Detect ws:// vs wss:// automatically (already existed, preserved)
- ✅ Suggest correct port if wrong one detected

### 5. **Progress Persistence**
- Saves partial progress to localStorage
- Restores URL, token, and step if user returns within 24 hours
- Cleared on successful completion or manual setup reset

### 6. **Re-run Setup Option**
- Added "Re-run Setup" button in Settings dialog
- Clears all onboarding flags and starts fresh
- Useful for troubleshooting or changing Gateway

## Flow Diagram

```
Welcome Screen
      ↓
Auto-Detection (new)
   ↙        ↘
Found      Not Found
   ↓           ↓
Success    No-Gateway Screen (new)
   ↓        ↙       ↘
  Tour   Retry    Manual Setup
            ↓           ↓
       Detection   Gateway Setup (enhanced)
                       ↓
                    Success
                       ↓
                     Tour
```

## Technical Details

### New Components
- `src/components/onboarding/steps/DetectionStep.tsx`
- `src/components/onboarding/steps/NoGatewayStep.tsx`

### Modified Components
- `src/components/onboarding/OnboardingFlow.tsx` - Added new flow steps
- `src/components/onboarding/steps/GatewaySetupStep.tsx` - Enhanced errors, auto-fixes, progress persistence
- `src/components/SettingsDialog.tsx` - Added "Re-run Setup" button
- `src/components/Sidebar.tsx` - Wired up re-run setup handler
- `src/App.tsx` - Implemented re-run setup logic

### Progress Storage
```typescript
// localStorage keys
"Moltzer-onboarding-progress" → {
  step: "detection-failed" | "setup-started" | "setup-complete",
  gatewayUrl?: string,
  gatewayToken?: string,
  timestamp: number
}
```

## User Experience Improvements

### Before
1. User opens Moltzer
2. Asked to enter Gateway URL
3. If Gateway not installed → confusing error, no guidance
4. User stuck, doesn't know what Gateway is or how to get it

### After
1. User opens Moltzer
2. Automatic detection tries to find Gateway
3. If found → instant connection, seamless
4. If not found → clear explanation + installation guide
5. After installing → retry button to auto-detect
6. If issues persist → helpful error messages with exact commands to run

## Error Message Examples

**Before**: "Failed to connect: Connection refused"

**After**: 
```
Connection refused

Gateway is not running or not reachable.

Start Gateway with:
┌──────────────────────────┐
│ clawdbot gateway start   │ [Copy]
└──────────────────────────┘
```

## Testing Notes

To test the onboarding flow:
```javascript
// In browser console
localStorage.removeItem('Moltzer-onboarding-completed');
localStorage.removeItem('Moltzer-onboarding-skipped');
localStorage.removeItem('Moltzer-onboarding-progress');
localStorage.removeItem('Moltzer-settings');
// Reload page
```

## Future Enhancements

- [ ] Auto-detect Gateway version and show upgrade notice if outdated
- [ ] In-app Gateway installer (download + run)
- [ ] Health check after connection (verify Gateway is working properly)
- [ ] Telemetry to track where users get stuck in onboarding
