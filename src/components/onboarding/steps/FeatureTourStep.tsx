import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";

interface FeatureTourStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
  shortcut?: string;
}

const features: Feature[] = [
  {
    icon: "⌘N",
    title: "New Chat",
    description: "Start a fresh conversation anytime",
    shortcut: "⌘N",
  },
  {
    icon: "⌘K",
    title: "Quick Search",
    description: "Find any conversation instantly",
    shortcut: "⌘K",
  },
  {
    icon: "⌘\\",
    title: "Toggle Sidebar",
    description: "Show or hide your conversation list",
    shortcut: "⌘\\",
  },
  {
    icon: "⌘,",
    title: "Settings",
    description: "Customize models, themes, and more",
    shortcut: "⌘,",
  },
];

export function FeatureTourStep({ onComplete, onSkip }: FeatureTourStepProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);

    // Auto-cycle through features
    const interval = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
    }, 3000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onComplete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onComplete]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header */}
        <div
          className={cn(
            "text-center transition-all duration-700 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 shadow-xl shadow-purple-500/20 mb-6">
            <span className="text-4xl">✨</span>
          </div>
          <h2 className="text-4xl font-bold mb-3">Power User Shortcuts</h2>
          <p className="text-lg text-muted-foreground">
            Master these to work at lightning speed
          </p>
        </div>

        {/* Animated feature showcase */}
        <div
          className={cn(
            "relative h-48 transition-all duration-700 delay-200 ease-out",
            isVisible ? "opacity-100" : "opacity-0"
          )}
        >
          {features.map((feature, i) => (
            <div
              key={i}
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center transition-all duration-500",
                i === currentFeatureIndex
                  ? "opacity-100 scale-100 translate-y-0"
                  : i < currentFeatureIndex
                  ? "opacity-0 scale-95 -translate-y-4"
                  : "opacity-0 scale-95 translate-y-4"
              )}
            >
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/30 flex items-center justify-center mb-4">
                <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                  {feature.icon}
                </span>
              </div>
              <h3 className="text-2xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {features.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentFeatureIndex(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                i === currentFeatureIndex
                  ? "w-8 bg-purple-500"
                  : "bg-muted hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to feature ${i + 1}`}
            />
          ))}
        </div>

        {/* Feature grid */}
        <div
          className={cn(
            "grid grid-cols-2 gap-3 transition-all duration-700 delay-400 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          {features.map((feature, i) => (
            <button
              key={i}
              onClick={() => setCurrentFeatureIndex(i)}
              className={cn(
                "p-4 rounded-xl border text-left transition-all duration-200",
                i === currentFeatureIndex
                  ? "bg-purple-500/10 border-purple-500/30"
                  : "border-border hover:border-purple-500/20 hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <kbd className="px-2 py-1 bg-muted rounded font-mono text-sm">
                  {feature.shortcut}
                </kbd>
                <span className="font-medium text-sm">{feature.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </button>
          ))}
        </div>

        {/* CTA */}
        <div
          className={cn(
            "flex flex-col items-center gap-4 transition-all duration-700 delay-600 ease-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <button
            onClick={onComplete}
            className="group px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-lg shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            <span className="flex items-center gap-2">
              Start Using Molt
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
            I've got it, let's go!
          </button>
        </div>

        {/* Keyboard hint */}
        <p
          className={cn(
            "text-center text-xs text-muted-foreground transition-all duration-700 delay-800 ease-out",
            isVisible ? "opacity-100" : "opacity-0"
          )}
        >
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Enter</kbd> to finish
        </p>
      </div>
    </div>
  );
}
