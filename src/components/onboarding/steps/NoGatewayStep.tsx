import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";

interface NoGatewayStepProps {
  onRetryDetection: () => void;
  onManualSetup: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function NoGatewayStep({
  onRetryDetection,
  onManualSetup,
  onBack,
  onSkip,
}: NoGatewayStepProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
      <div className="max-w-2xl w-full space-y-8 my-auto">
        {/* Header */}
        <div
          className={cn(
            "text-center transition-all duration-700 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          )}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 shadow-xl shadow-orange-500/20 mb-6">
            <span className="text-4xl">🦞</span>
          </div>
          <h2 className="text-4xl font-bold mb-3">Moltz Isn't Running Yet</h2>
          <p className="text-lg text-muted-foreground">
            No worries! Let's get the background service running
          </p>
        </div>

        {/* What is Moltbot? */}
        <div
          className={cn(
            "p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 transition-all duration-700 delay-200 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          )}
        >
          <h3 className="font-semibold text-lg mb-3 text-blue-600 dark:text-blue-400">
            How Moltz Works
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Moltz needs a background service running on your computer. This is
            what lets Moltz access your calendar, email, files, and more—all
            while keeping everything private on your machine.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>
                Everything stays on <strong>your computer</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>
                Runs quietly in the <strong>background</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>
                Takes just a <strong>few minutes</strong> to set up
              </span>
            </li>
          </ul>
        </div>

        {/* Installation steps */}
        <div
          className={cn(
            "space-y-4 transition-all duration-700 delay-400 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          )}
        >
          <h3 className="font-semibold text-lg">Getting Set Up</h3>

          {/* Step 1: Download and install */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <p className="font-medium mb-2">Download and install Moltz</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Visit the installation page to get the background service
                  running.
                </p>
                <a
                  href="https://github.com/yusefmosiah/Choir#installation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  Open Installation Guide
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Step 2: Return */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">
                  Once it's running, come back here
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the green "Check Again" button below
                </p>
              </div>
            </div>
          </div>

          {/* Already installed? */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-muted-foreground">
              <strong>Already installed?</strong> You might need to manually
              enter the connection address. Click "Enter Manually" below.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div
          className={cn(
            "flex flex-col gap-3 transition-all duration-700 delay-600 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          )}
        >
          <button
            onClick={onRetryDetection}
            className="w-full px-6 py-4 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold text-lg shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            ✓ Check Again
          </button>

          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
            >
              ← Back
            </button>

            <button
              onClick={onManualSetup}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
            >
              Enter Manually →
            </button>
          </div>

          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip (I'll set this up later)
          </button>
        </div>
      </div>
    </div>
  );
}
