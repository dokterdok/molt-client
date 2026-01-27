import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 100);

    // Auto-advance on Enter
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
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Animated Molt Logo */}
        <div
          className={cn(
            "transition-all duration-700 ease-out",
            isVisible
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-8 scale-95"
          )}
        >
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-3xl bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 shadow-2xl shadow-orange-500/30 mb-8 transform hover:scale-105 transition-transform">
            <span className="text-7xl drop-shadow-lg animate-[wave_2s_ease-in-out_infinite]">
              🦞
            </span>
          </div>
        </div>

        {/* Heading */}
        <div
          className={cn(
            "transition-all duration-700 delay-200 ease-out",
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <h1 className="text-6xl font-bold bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent mb-4">
            Welcome to Molt
          </h1>
          <p className="text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Your AI assistant that doesn't just chat—it actually{" "}
            <span className="font-semibold text-foreground">gets things done</span>.
          </p>
        </div>

        {/* Feature highlights */}
        <div
          className={cn(
            "grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto transition-all duration-700 delay-400 ease-out",
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <div className="p-6 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20">
            <div className="text-3xl mb-3">📧</div>
            <p className="text-sm font-medium">Check your email</p>
          </div>
          <div className="p-6 rounded-xl bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20">
            <div className="text-3xl mb-3">📅</div>
            <p className="text-sm font-medium">Manage your calendar</p>
          </div>
          <div className="p-6 rounded-xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20">
            <div className="text-3xl mb-3">💬</div>
            <p className="text-sm font-medium">Send messages</p>
          </div>
        </div>

        {/* CTA */}
        <div
          className={cn(
            "flex flex-col items-center gap-4 transition-all duration-700 delay-600 ease-out",
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <button
            onClick={onNext}
            className="group px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold text-lg shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            <span className="flex items-center gap-2">
              Get Started
              <svg
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </span>
          </button>

          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            I'll set this up later
          </button>
        </div>

        {/* Keyboard hint */}
        <p
          className={cn(
            "text-xs text-muted-foreground transition-all duration-700 delay-800 ease-out",
            isVisible ? "opacity-100" : "opacity-0"
          )}
        >
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Enter</kbd> to continue
        </p>
      </div>

      <style>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
      `}</style>
    </div>
  );
}
