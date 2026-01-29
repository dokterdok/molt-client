import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../../lib/utils";

interface FeatureTourStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
  shortcut: string;
}

// Detect platform for keyboard shortcuts
const isMacOS =
  typeof navigator !== "undefined" &&
  navigator.platform.toLowerCase().includes("mac");
const modKey = isMacOS ? "⌘" : "Ctrl+";

const getFeatures = (): Feature[] => [
  {
    icon: `${modKey}N`,
    title: "New Chat",
    description: "Start a fresh conversation anytime",
    shortcut: `${modKey}N`,
  },
  {
    icon: `${modKey}K`,
    title: "Quick Search",
    description: "Find any conversation instantly",
    shortcut: `${modKey}K`,
  },
  {
    icon: `${modKey}\\`,
    title: "Toggle Sidebar",
    description: "Show or hide your conversation list",
    shortcut: `${modKey}\\`,
  },
  {
    icon: `${modKey},`,
    title: "Settings",
    description: "Customize models, themes, and more",
    shortcut: `${modKey},`,
  },
];

export function FeatureTourStep({ onComplete, onSkip }: FeatureTourStepProps) {
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const features = useMemo(() => getFeatures(), []);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus primary button
    primaryButtonRef.current?.focus();

    // Auto-cycle through features
    const interval = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
    }, 3500);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        document.activeElement === primaryButtonRef.current
      ) {
        e.preventDefault();
        onComplete();
      }
      // Allow arrow keys to navigate features
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentFeatureIndex(
          (prev) => (prev - 1 + features.length) % features.length,
        );
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onComplete, features.length]);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-8"
      role="main"
      aria-labelledby="tour-heading"
    >
      <div className="max-w-3xl w-full space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 shadow-xl shadow-purple-500/20 mb-6"
            animate={{
              rotate: [0, 5, -5, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            aria-label="Feature tour icon"
          >
            <span className="text-4xl" role="img" aria-label="Sparkles emoji">
              ✨
            </span>
          </motion.div>
          <h2 id="tour-heading" className="text-4xl font-bold mb-3">
            Power User Shortcuts
          </h2>
          <p className="text-lg text-muted-foreground">
            Master these to work at lightning speed
          </p>
        </motion.div>

        {/* Animated feature showcase */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative h-48"
          role="region"
          aria-live="polite"
          aria-atomic="true"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentFeatureIndex}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <motion.div
                className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/30 flex items-center justify-center mb-4"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                  {features[currentFeatureIndex].icon}
                </span>
              </motion.div>
              <h3 className="text-2xl font-semibold mb-2">
                {features[currentFeatureIndex].title}
              </h3>
              <p className="text-muted-foreground">
                {features[currentFeatureIndex].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Progress dots */}
        <div
          className="flex justify-center gap-2"
          role="tablist"
          aria-label="Feature navigation"
        >
          {features.map((feature, i) => (
            <motion.button
              key={i}
              onClick={() => setCurrentFeatureIndex(i)}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              className={cn(
                "rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-background",
                i === currentFeatureIndex
                  ? "w-8 h-2 bg-purple-500"
                  : "w-2 h-2 bg-muted hover:bg-muted-foreground/50",
              )}
              aria-label={`View ${feature.title} shortcut`}
              aria-selected={i === currentFeatureIndex}
              role="tab"
            />
          ))}
        </div>

        {/* Feature grid */}
        <div
          className="grid grid-cols-2 gap-3"
          role="list"
          aria-label="All keyboard shortcuts"
        >
          {features.map((feature, i) => (
            <motion.button
              key={i}
              role="listitem"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.4 + i * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              onClick={() => setCurrentFeatureIndex(i)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "p-4 rounded-xl border text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-background",
                i === currentFeatureIndex
                  ? "bg-purple-500/10 border-purple-500/30 shadow-lg shadow-purple-500/10"
                  : "border-border hover:border-purple-500/20 hover:bg-muted/50",
              )}
              aria-pressed={i === currentFeatureIndex}
              aria-label={`${feature.title}: ${feature.shortcut}`}
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
            </motion.button>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.button
            ref={primaryButtonRef}
            onClick={onComplete}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="group px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-lg shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Complete tour and start using Moltz"
          >
            <span className="flex items-center gap-2">
              Start Using Moltz
              <motion.svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                initial={{ x: 0 }}
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </motion.svg>
            </span>
          </motion.button>

          <motion.button
            onClick={onSkip}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-muted focus:ring-offset-2 focus:ring-offset-background rounded px-3 py-1"
            aria-label="Skip and start using Moltz"
          >
            I've got it, let's go!
          </motion.button>
        </motion.div>

        {/* Keyboard hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="text-center text-xs text-muted-foreground"
        >
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Enter</kbd>{" "}
          to finish • Use{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">←</kbd>{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">→</kbd> to
          navigate
        </motion.p>
      </div>
    </div>
  );
}
