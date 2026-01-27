import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";

interface GatewayExplainerStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function GatewayExplainerStep({ onNext, onBack, onSkip }: GatewayExplainerStepProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div
          className={cn(
            "text-center transition-all duration-700 ease-out",
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-xl shadow-blue-500/20 mb-6">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
          </div>
          <h2 className="text-4xl font-bold mb-3">What's a Gateway?</h2>
          <p className="text-lg text-muted-foreground">
            Think of it as Molt's connection to your world
          </p>
        </div>

        {/* Explanation cards */}
        <div
          className={cn(
            "space-y-4 transition-all duration-700 delay-200 ease-out",
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🔐</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-green-600 dark:text-green-400">
                  Your Private Bridge
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Gateway runs on <strong>your machine</strong>, so your data never leaves your control. 
                  It's like having a personal assistant who works in your office, not in the cloud.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🔌</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-purple-600 dark:text-purple-400">
                  Connects Everything
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Gateway lets Molt talk to your calendar, email, files, and more—all while keeping 
                  your credentials secure on your computer.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-orange-600 dark:text-orange-400">
                  Fast & Local
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Most Gateways run at <code className="px-1 py-0.5 bg-muted rounded text-xs">localhost:18789</code>. 
                  If you have one running already, we'll auto-detect it!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className={cn(
            "flex items-center justify-between pt-4 transition-all duration-700 delay-400 ease-out",
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={onNext}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Connect to Gateway →
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Enter</kbd> to continue
        </p>
      </div>
    </div>
  );
}
