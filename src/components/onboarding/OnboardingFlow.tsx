import { useState, useEffect } from "react";
import { WelcomeStep } from "./steps/WelcomeStep";
import { GatewayExplainerStep } from "./steps/GatewayExplainerStep";
import { GatewaySetupStep } from "./steps/GatewaySetupStep";
import { SuccessStep } from "./steps/SuccessStep";
import { FeatureTourStep } from "./steps/FeatureTourStep";
import { cn } from "../../lib/utils";

export type OnboardingStep = 
  | "welcome"
  | "explainer"
  | "setup"
  | "success"
  | "tour"
  | "complete";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [isAnimating, setIsAnimating] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState("ws://localhost:18789");
  const [gatewayToken, setGatewayToken] = useState("");

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

  const steps: Record<OnboardingStep, JSX.Element> = {
    welcome: (
      <WelcomeStep
        onNext={() => handleNext("explainer")}
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
        onBack={() => handleBack("explainer")}
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

  // Progress indicator
  const stepOrder: OnboardingStep[] = ["welcome", "explainer", "setup", "success", "tour"];
  const currentStepIndex = stepOrder.indexOf(currentStep);
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
      {["welcome", "explainer", "setup"].includes(currentStep) && (
        <div className="absolute top-4 right-4 text-xs text-muted-foreground animate-in fade-in duration-500 delay-1000">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Esc</kbd> to skip
        </div>
      )}
    </div>
  );
}
