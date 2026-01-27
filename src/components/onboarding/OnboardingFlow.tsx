import { useState, useEffect, useCallback, JSX } from "react";
import { WelcomeStep } from "./steps/WelcomeStep";
import { DetectionStep } from "./steps/DetectionStep";
import { NoGatewayStep } from "./steps/NoGatewayStep";
import { GatewayExplainerStep } from "./steps/GatewayExplainerStep";
import { GatewaySetupStep } from "./steps/GatewaySetupStep";
import { SuccessStep } from "./steps/SuccessStep";
import { FeatureTourStep } from "./steps/FeatureTourStep";
import { cn } from "../../lib/utils";

// Check if running on macOS
const isMacOS = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");

export type OnboardingStep = 
  | "welcome"
  | "detection"
  | "no-gateway"
  | "explainer"
  | "setup"
  | "success"
  | "tour"
  | "complete";

interface OnboardingProgress {
  step: string;
  gatewayUrl?: string;
  // NOTE: gatewayToken is NEVER stored in localStorage - it goes to OS keychain only
  timestamp: number;
}

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [isAnimating, setIsAnimating] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState(
    import.meta.env.VITE_DEFAULT_GATEWAY_URL || "ws://localhost:18789"
  );
  const [gatewayToken, setGatewayToken] = useState("");

  // Restore progress on mount
  useEffect(() => {
    const savedProgress = localStorage.getItem('moltzer-onboarding-progress');
    if (savedProgress) {
      try {
        const progress: OnboardingProgress = JSON.parse(savedProgress);
        // If saved within last 24 hours, restore
        if (Date.now() - progress.timestamp < 24 * 60 * 60 * 1000) {
          if (progress.gatewayUrl) setGatewayUrl(progress.gatewayUrl);
          // Token is NOT restored from localStorage - it's in keychain
          // Start at detection if we have partial progress
          if (progress.step === 'setup-started' || progress.step === 'detection-failed') {
            setCurrentStep('detection');
          }
        }
      } catch (err) {
        console.error('[OnboardingFlow] Failed to restore onboarding progress:', err);
      }
    }
  }, []);

  // Stable transition function
  const transitionTo = useCallback((nextStep: OnboardingStep) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(nextStep);
      setIsAnimating(false);
    }, 150);
  }, []);

  // All callbacks wrapped in useCallback for stability
  const handleSkip = useCallback(() => {
    // Mark onboarding as skipped (not completed)
    localStorage.setItem("moltzer-onboarding-skipped", "true");
    onComplete();
  }, [onComplete]);

  const handleComplete = useCallback(() => {
    // Mark onboarding as fully completed
    localStorage.setItem("moltzer-onboarding-completed", "true");
    localStorage.removeItem("moltzer-onboarding-skipped");
    onComplete();
  }, [onComplete]);

  const handleGatewayFound = useCallback((url: string) => {
    setGatewayUrl(url);
    // Skip directly to success when auto-detected
    transitionTo("success");
  }, [transitionTo]);

  const handleNoGateway = useCallback(() => {
    // Save progress
    localStorage.setItem('moltzer-onboarding-progress', JSON.stringify({
      step: 'detection-failed',
      timestamp: Date.now()
    }));
    transitionTo("no-gateway");
  }, [transitionTo]);

  const handleRetryDetection = useCallback(() => {
    transitionTo("detection");
  }, [transitionTo]);

  const handleManualSetup = useCallback(() => {
    // Save progress (token NOT stored in localStorage - security)
    localStorage.setItem('moltzer-onboarding-progress', JSON.stringify({
      step: 'setup-started',
      gatewayUrl,
      timestamp: Date.now()
    }));
    transitionTo("setup");
  }, [transitionTo, gatewayUrl]);

  const handleWelcomeNext = useCallback(() => {
    transitionTo("detection");
  }, [transitionTo]);

  const handleBackToWelcome = useCallback(() => {
    transitionTo("welcome");
  }, [transitionTo]);

  const handleBackToNoGateway = useCallback(() => {
    transitionTo("no-gateway");
  }, [transitionTo]);

  const handleSetupSuccess = useCallback(() => {
    transitionTo("success");
  }, [transitionTo]);

  const handleSuccessNext = useCallback(() => {
    transitionTo("tour");
  }, [transitionTo]);

  const handleExplainerNext = useCallback(() => {
    transitionTo("setup");
  }, [transitionTo]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && currentStep !== "complete") {
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, handleSkip]);

  const steps: Record<OnboardingStep, JSX.Element> = {
    welcome: (
      <WelcomeStep
        onNext={handleWelcomeNext}
        onSkip={handleSkip}
      />
    ),
    detection: (
      <DetectionStep
        onGatewayFound={handleGatewayFound}
        onNoGateway={handleNoGateway}
        onSkip={handleSkip}
      />
    ),
    "no-gateway": (
      <NoGatewayStep
        onRetryDetection={handleRetryDetection}
        onManualSetup={handleManualSetup}
        onBack={handleBackToWelcome}
        onSkip={handleSkip}
      />
    ),
    explainer: (
      <GatewayExplainerStep
        onNext={handleExplainerNext}
        onBack={handleBackToWelcome}
        onSkip={handleSkip}
      />
    ),
    setup: (
      <GatewaySetupStep
        gatewayUrl={gatewayUrl}
        gatewayToken={gatewayToken}
        onGatewayUrlChange={setGatewayUrl}
        onGatewayTokenChange={setGatewayToken}
        onSuccess={handleSetupSuccess}
        onBack={handleBackToNoGateway}
        onSkip={handleSkip}
        skipAutoDetect={true} // Already tried in DetectionStep
      />
    ),
    success: (
      <SuccessStep
        onNext={handleSuccessNext}
        onSkip={handleComplete}
      />
    ),
    tour: (
      <FeatureTourStep
        onComplete={handleComplete}
        onSkip={handleComplete}
      />
    ),
    complete: <></>, // Should never render
  };

  // Progress indicator (only count main steps, not detection/no-gateway)
  const stepOrder: OnboardingStep[] = ["welcome", "detection", "setup", "success", "tour"];
  let currentStepIndex = stepOrder.indexOf(currentStep);
  // Treat no-gateway as same progress as detection
  if (currentStep === "no-gateway") {
    currentStepIndex = stepOrder.indexOf("detection");
  }
  const progress = ((currentStepIndex + 1) / stepOrder.length) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step content */}
      <div
        className={cn(
          "flex-1 transition-opacity duration-150",
          isAnimating ? "opacity-0" : "opacity-100"
        )}
      >
        {steps[currentStep]}
      </div>

      {/* Skip hint (only on first few steps) */}
      {["welcome", "detection", "no-gateway", "explainer", "setup"].includes(currentStep) && (
        <div className={cn(
          "absolute right-4 text-xs text-muted-foreground animate-in fade-in duration-500 delay-1000",
          isMacOS ? "top-2" : "top-4"
        )}>
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Esc</kbd> to skip
        </div>
      )}
    </div>
  );
}
