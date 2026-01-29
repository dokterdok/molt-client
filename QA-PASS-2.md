# Pass 2 - QA Report

**Date:** 2025-01-30  
**Tester:** QA Subagent  
**Scope:** Verification of Pass 1 fixes + Additional testing

---

## Pass 1 Fixes Verified ✓

### Critical Issues - FIXED
1. ✅ **localStorage key case mismatch** - Changed "Moltz" to "moltz" in both occurrences
2. ✅ **Back button destination** - Now correctly goes to Welcome instead of orphaned NoGateway
3. ✅ **Timeout error message** - Now shows actual timeout duration (15s or 120s for Tailscale)

### Major Issues - FIXED
4. ✅ **Double-click prevention** - Added guard at start of handleTestConnection
5. ✅ **Progress bar** - Removed detection from stepOrder, shows accurate 4-step progress
6. ✅ **URL auto-fix notification** - Added visual "✓ Updated to ws://" feedback

---

## New Issues Found in Pass 2

### Minor Issues (polish)

#### 1. Orphaned Code - Dead Detection Flow
- **Observation:** DetectionStep, NoGatewayStep, and related handlers still exist but are unreachable
- **Files:** 
  - `src/components/onboarding/steps/DetectionStep.tsx` (entire file)
  - `src/components/onboarding/steps/NoGatewayStep.tsx` (entire file)
  - `src/components/onboarding/OnboardingFlow.tsx` (lines 95-104: `handleGatewayFound`, `handleNoGateway`, etc.)
- **Impact:** ~400 lines of dead code, increases bundle size
- **Recommendation:** Remove if detection is permanently disabled, or re-enable detection with toggle

#### 2. Skip Button UX Inconsistency
- **Observation:** Different skip experiences across steps:
  - WelcomeStep: "Skip setup (I'll just look around)"
  - GatewaySetupStep: "Skip (you can browse, but won't be able to chat yet)"
  - SuccessStep: Primary CTA is skip ("Start Using Moltz"), secondary goes to tour
- **Impact:** Confusing user journey
- **Recommendation:** Unify messaging, clarify what "skip" means at each step

#### 3. Escape Key Still Skips During Test
- **Observation:** Pressing Escape during "Testing Connection..." still skips onboarding
- **File:** `src/components/onboarding/OnboardingFlow.tsx` line 163-166
- **Current behavior:** Escape calls `handleSkip()` unconditionally
- **Impact:** User might accidentally skip while waiting for connection
- **Recommendation:** Block Escape when in testing/verifying state (would require lifting state)

#### 4. Token Show/Hide Toggle Disappears on Error
- **Observation:** The password visibility toggle works, but focus states could be improved
- **File:** `src/components/onboarding/steps/GatewaySetupStep.tsx`
- **Impact:** Minor visual inconsistency
- **Recommendation:** Add consistent focus ring to toggle button

#### 5. Auto-Detect Code Still Present But Disabled
- **Observation:** `autoDetectGateway` function exists (~60 lines) but is commented out
- **File:** `src/components/onboarding/steps/GatewaySetupStep.tsx` lines 278-345
- **Impact:** Dead code in bundle
- **Recommendation:** Remove or re-enable with feature flag

---

## UI Consistency Audit

### Border Radius ✓
- Inputs: `rounded-lg` - Consistent
- Cards: `rounded-xl` - Consistent  
- Primary buttons: `rounded-xl` - Consistent
- **Status:** CONSISTENT

### Color Scheme ✓
- Primary gradient: orange → red
- Success: green/emerald
- Error: red/destructive
- Info: blue
- **Status:** CONSISTENT

### Button Styling ✓
- Primary: gradient background with shadow
- Secondary: border with hover:bg-muted
- Ghost: text-only with hover state
- **Status:** CONSISTENT

### Loading States ✓
- Spinner component used consistently
- Animate-in classes for smooth transitions
- **Status:** CONSISTENT

---

## Accessibility Audit

### Positive Findings
- ✅ Proper ARIA labels on interactive elements
- ✅ Keyboard navigation (Enter to submit, Escape to skip)
- ✅ Focus management on step transitions
- ✅ Screen reader announcements with `aria-live`
- ✅ Proper form labeling with `htmlFor`

### Recommendations
- ⚠️ Add visible focus indicators to all interactive elements
- ⚠️ Consider adding `aria-describedby` for error messages
- ⚠️ Progress bar could announce step changes to screen readers

---

## Performance Observations

### Bundle Size
- Main entry: 271.77 kB (gzipped: 79.86 kB)
- Could reduce by removing dead detection code (~5-10 kB)

### Animation Performance
- Framer Motion used throughout
- Confetti particles (50) could cause jank on low-end devices
- Recommend reducing to 25-30 particles

---

## Remaining Items for Pass 3

1. **Remove dead code** (detection flow, auto-detect function)
2. **Unify skip button messaging**
3. **Consider blocking Escape during connection test** (optional, may be over-engineering)
4. **Reduce confetti particle count** (SuccessStep)

---

## Conclusion

Pass 1 critical and major fixes verified successfully. The onboarding flow is now functional with proper:
- LocalStorage persistence
- Navigation flow (Welcome → Setup → Success → Tour)
- Error handling with accurate timeouts
- Double-click prevention
- Visual feedback for URL normalization

Remaining issues are minor polish items that don't block release but should be addressed in a future cleanup sprint.
