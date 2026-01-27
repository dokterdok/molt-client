# Molt Client Onboarding Flow

## Overview
World-class first-launch experience inspired by Linear, Notion, and Arc browser.

## Flow Steps

1. **Welcome Screen** (`WelcomeStep.tsx`)
   - Animated Molt lobster with gradient background
   - Feature highlights (email, calendar, messaging)
   - Smooth entrance animations
   - Keyboard: `Enter` to continue, `Esc` to skip

2. **Gateway Explainer** (`GatewayExplainerStep.tsx`)
   - Friendly explanation of what Gateway is
   - No technical jargon
   - Visual cards explaining security, connectivity, and local operation
   - Back/forward navigation

3. **Gateway Setup** (`GatewaySetupStep.tsx`)
   - Auto-detection of local Gateway (`localhost:18789`, etc.)
   - Manual URL input with validation
   - Live connection testing with friendly error messages
   - Success state with visual confirmation
   - Token authentication (optional)

4. **Success Celebration** (`SuccessStep.tsx`)
   - Confetti animation
   - Positive reinforcement
   - Quick wins highlighted

5. **Feature Tour** (`FeatureTourStep.tsx`)
   - Keyboard shortcuts showcase
   - Auto-cycling feature cards
   - Interactive navigation dots
   - Shortcuts: ⌘N (new chat), ⌘K (search), ⌘\\ (sidebar), ⌘, (settings)

## UX Principles

- **Progressive disclosure**: One concept at a time
- **Escape hatches**: Skip option at every step
- **Immediate feedback**: Live validation, loading states
- **Celebration moments**: Success animations, encouraging copy
- **Zero jargon**: Human-friendly language
- **Keyboard-first**: Full keyboard navigation
- **Smooth animations**: 200-700ms transitions with easing

## First Launch Detection

```typescript
const onboardingCompleted = localStorage.getItem('molt-onboarding-completed');
const onboardingSkipped = localStorage.getItem('molt-onboarding-skipped');
const hasSettings = localStorage.getItem('molt-settings');

if (!onboardingCompleted && !onboardingSkipped && !hasSettings) {
  showOnboarding();
}
```

## Toast Suppression

During onboarding, retry toasts and connection errors are suppressed to avoid overwhelming new users:

```typescript
if (!showOnboarding) {
  showError("Failed to connect to Gateway. Retrying...");
}
```

## Development

**Models used:**
- **Opus-level thinking**: UX design decisions, flow architecture
- **Sonnet**: Implementation, component creation
- **Haiku**: Trivial fixes (unused imports)

**Testing:**
- Clear localStorage to trigger onboarding again:
  ```javascript
  localStorage.removeItem('molt-onboarding-completed');
  localStorage.removeItem('molt-onboarding-skipped');
  localStorage.removeItem('molt-settings');
  ```

## Files

- `OnboardingFlow.tsx` - Main orchestrator with progress bar
- `steps/WelcomeStep.tsx` - Hero welcome screen
- `steps/GatewayExplainerStep.tsx` - Educational step
- `steps/GatewaySetupStep.tsx` - Connection wizard
- `steps/SuccessStep.tsx` - Celebration screen
- `steps/FeatureTourStep.tsx` - Keyboard shortcuts tour

## macOS Native Integration

The onboarding flow respects macOS window chrome:
- Skip hint positioned below traffic lights (`top-2` on macOS vs `top-4` elsewhere)
- Consistent with main app's Slack-style window integration
- Native drag regions and traffic light spacing throughout

## Future Enhancements

- [ ] Animated screenshots/demos of features
- [ ] Personalization step (name, preferences)
- [ ] Integration showcase (connect calendar, email)
- [ ] Video tutorial option
- [ ] Accessibility improvements (screen reader announcements)
