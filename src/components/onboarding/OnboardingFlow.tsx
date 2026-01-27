import React, { useState, useEffect, JSX } from "react";
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
    const savedProgress = localStorage.getItem('molt-onboarding-progress');
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
        console.error('Failed to restore onboarding progress:', err);
      }
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && currentStep !== "complete") {
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep]);

  const handleNext = (nextStep: OnboardingStep) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(nextStep);
      setIsAnimating(false);
    }, 150);
  };

  const handleBack = (prevStep: OnboardingStep) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prevStep);
      setIsAnimating(false);
    }, 150);
  };

  const handleSkip = () => {
    // Mark onboarding as skipped (not completed)
    localStorage.setItem("molt-onboarding-skipped", "true");
    onComplete();
  };

  const handleComplete = () => {
    // Mark onboarding as fully completed
    localStorage.setItem("molt-onboarding-completed", "true");
    localStorage.removeItem("molt-onboarding-skipped");
    onComplete();
  };

  const handleGatewayFound = (url: string) => {
    setGatewayUrl(url);
    // Skip directly to success when auto-detected
    handleNext("success");
  };

  const handleNoGateway = () => {
    // Save progress
    localStorage.setItem('molt-onboarding-progress', JSON.stringify({
      step: 'detection-failed',
      timestamp: Date.now()
    }));
    handleNext("no-gateway");
  };

  const handleRetryDetection = () => {
    handleNext("detection");
  };

  const handleManualSetup = () => {
    // Save progress (token NOT stored in localStorage - security)
    localStorage.setItem('molt-onboarding-progress', JSON.stringify({
      step: 'setup-started',
      gatewayUrl,
      timestamp: Date.now()
    }));
    handleNext("setup");
  };

  const steps: Record<OnboardingStep, JSX.Element> = {
    welcome: (
      <WelcomeStep
        onNext={() => handleNext("detection")}
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
        onBack={() => handleBack("welcome")}
        onSkip={handleSkip}
      />
    ),
    explainer: (
      <GatewayExplainerStep
        onNext={() => handleNext("setup")}
        onBack={() => handleBack("welcome")}
        onSkip={handleSkip}
      />
    ),
    setup: (
      <GatewaySetupStep
        gatewayUrl={gatewayUrl}
        gatewayToken={gatewayToken}
        onGatewayUrlChange={setGatewayUrl}
        onGatewayTokenChange={setGatewayToken}
        onSuccess={() => handleNext("success")}
        onBack={() => handleBack("no-gateway")}
        onSkip={handleSkip}
      />
    ),
    success: (
      <SuccessStep
        onNext={() => handleNext("tour")}
        onSkip={() => handleComplete()}
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
