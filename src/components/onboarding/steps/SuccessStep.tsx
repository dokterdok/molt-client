import React, { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";

interface SuccessStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function SuccessStep({ onNext, onSkip }: SuccessStepProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);

    // Generate confetti particles
    const particles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 1,
    }));
    setConfetti(particles);

    // Auto-advance
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
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Confetti */}
      {confetti.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full animate-[fall_linear_forwards]"
          style={
            {
              left: `${particle.x}%`,
              top: "-10px",
              backgroundColor: ["#f97316", "#ef4444", "#ec4899", "#a855f7", "#3b82f6"][
                Math.floor(Math.random() * 5)
              ],
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              "--fall-rotation": `${Math.random() * 360}deg`,
            } as React.CSSProperties
          }
        />
      ))}

      <div className="max-w-2xl w-full text-center space-y-8 relative z-10">
        {/* Celebration */}
        <div
          className={cn(
            "transition-all duration-700 ease-out",
            isVisible
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-8"
          )}
        >
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-2xl shadow-green-500/40 mb-8 animate-[bounce_1s_ease-in-out_3]">
            <span className="text-7xl">🎉</span>
          </div>
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
            You're All Set!
          </h2>
          <p className="text-xl text-muted-foreground max-w-lg mx-auto">
            Molt is connected and ready to help you get things done.
          </p>
        </div>

        {/* Quick wins */}
        <div
          className={cn(
            "grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto transition-all duration-700 delay-300 ease-out",
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <div className="p-5 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 text-left">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="font-semibold mb-1">Lightning Fast</h3>
            <p className="text-sm text-muted-foreground">
              Your data stays local. No cloud delays.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 text-left">
            <div className="text-2xl mb-2">🔐</div>
            <h3 className="font-semibold mb-1">Totally Private</h3>
            <p className="text-sm text-muted-foreground">
              Everything runs on your machine.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div
          className={cn(
            "flex flex-col items-center gap-4 transition-all duration-700 delay-500 ease-out",
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <button
            onClick={onNext}
            className="group px-8 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold text-lg shadow-xl shadow-green-500/30 hover:shadow-2xl hover:shadow-green-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            <span className="flex items-center gap-2">
              Show Me Around
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
            Skip tour, let me dive in!
          </button>
        </div>

        {/* Keyboard hint */}
        <p
          className={cn(
            "text-xs text-muted-foreground transition-all duration-700 delay-700 ease-out",
            isVisible ? "opacity-100" : "opacity-0"
          )}
        >
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Enter</kbd> to continue
        </p>
      </div>

      <style>{`
        @keyframes fall {
          from {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          to {
            transform: translateY(100vh) rotate(var(--fall-rotation, 360deg));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
